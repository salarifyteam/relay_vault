# Design: test/live API key separation

Status: **proposed** — awaiting sign-off before implementation.
Owner: backend. Scope: priority (1) of the "Stripe-level DX" track.

## Goal

Give every Relay project two isolated environments — `test` and `live` — distinguished by
the API key used on a request, exactly like Stripe's `sk_test_…` / `sk_live_…`. A request
authenticated with a test key must only ever see test data (BYOK keys, usage, rate-limit
budget); a live key only ever sees live data. Same project, same team, same plan — separate data.

## Decisions (locked with product)

1. **One Tenant, environment lives on the key + data rows** — not on the Tenant.
   test and live share the project identity, members (RBAC), plan, and name. Isolation is by
   an `environment` field on the API key and on every scoped data row. The Tenant stays
   environment-agnostic. (This is what makes "toggle test/live in the dashboard" possible
   without switching projects.)
2. **Keys are hashed at rest, shown once.** SHA-256(secret) is stored and indexed; the
   plaintext is returned exactly once at creation. Lists show `prefix + last4`
   (`rly_live_••••a3f9`). No plaintext key in the DB.
3. **Clean cutover (no live users yet).** Relay has no production users, so there is no
   compatibility burden. We do a full Stripe-style cutover: `Tenant.rlyKey` is **removed**,
   no plaintext key remains anywhere, and `regenerate-key` is replaced (not aliased) by the
   `ApiKey` CRUD. New keys use `rly_live_` / `rly_test_`. The migration still accepts a legacy
   `rly-` row for any leftover dev data, and the auth regex still tolerates `rly-`, but we do
   not preserve plaintext or the old UI contract.

## The core idea

> **The key carries the environment.** Authentication resolves a key → an `ApiKey` row →
> `{ tenantId, environment }`. Everything downstream filters by *both* `tenantId` AND
> `environment`. There is no "current environment" stored server-side; it is derived from
> the credential on each request. This is stateless and matches Stripe.

## Data model

### New: `ApiKey` collection

Replaces the single `Tenant.rlyKey` string. One row per issued key; a project can have many
(multiple live keys for rotation, multiple test keys, named keys).

```ts
interface IApiKey {
  tenantId: ObjectId;                 // ref Tenant — the project
  environment: "test" | "live";       // which env this key authenticates into
  keyHash: string;                    // sha256(secret), hex — UNIQUE index, the lookup key
  prefix: string;                     // "rly_live_" | "rly_test_" | "rly-" (legacy)
  last4: string;                      // last 4 chars of secret, for display
  name: string;                       // human label, e.g. "default", "CI", "mobile-app"
  status: "active" | "revoked";
  createdByAccountId?: ObjectId;      // who minted it
  lastUsedAt?: Date;                  // updated best-effort on auth (throttled)
  revokedAt?: Date;
  createdAt: Date; updatedAt: Date;
}
```

Indexes:
- `{ keyHash: 1 }` unique  ← the hot path: auth lookup
- `{ tenantId: 1, environment: 1, status: 1 }`  ← console listing
- `{ lastUsedAt: 1 }` sparse (optional, for "stale key" surfacing later)

> Note: we keep `keyHash` unique globally. SHA-256 collisions are not a concern; a global
> unique index also guards against the astronomically unlikely duplicate-secret generation.

### Changed: scope existing rows by environment

Add `environment: "test" | "live"` to the three collections that hold per-request data:

| Collection      | Why it needs `environment`                                              |
|-----------------|--------------------------------------------------------------------------|
| `EndUserKey`    | A test BYOK key must not be usable by a live request, and vice versa.    |
| `UsageRecord`   | Test traffic must not appear in live usage/billing numbers.             |
| `RateCounter`   | Test load must not consume the live rate-limit budget (and vice versa). |

Index changes:
- `EndUserKey`: the unique index becomes
  `{ tenantId, environment, endUserLabel, provider }` (was without `environment`).
  → the *same* end-user label can register a key in test and in live independently.
- `UsageRecord`: `{ tenantId, environment, endUserLabel, createdAt: -1 }`.
- `RateCounter`: unique `{ tenantId, environment, windowStart }`.

`RegistrationToken` **also** gains `environment` — it is the BYOK submission path. A token is
minted by an authenticated request bearing an rly key, so the key's environment flows onto the
token, and the `EndUserKey` created when the token is redeemed inherits that environment. (A
test key → test registration token → test EndUserKey. Matches Stripe: a test publishable key
creates test-mode objects.)

`Tenant`, `TenantMember`, `TenantInvite`, `AuditLog`, `Session` are **unchanged** —
they are project-level, not environment-level. (Audit logs *record* which environment an
action touched via the existing `detail`/`target` fields; no schema change.)

### `Tenant.rlyKey`

**Removed.** No users exist, so there is no continuity to preserve. The field is deleted from
the `Tenant` model and dropped from `/api/me`. The console keys page is rebuilt to the
show-once model in this slice (it can no longer read a plaintext key, so leaving it would
break the build). No plaintext key remains in the DB.

## Key format

```
rly_<env>_<48 base62 chars>
   └ "live" | "test"
e.g.  rly_live_8Kd2…a3f9   (62-char total secret incl. prefix)
```

- The plaintext secret is `prefix + body`. We hash the **whole thing** (`rly_live_8Kd2…`),
  so the stored hash is bound to its environment — a test secret and live secret can never
  collide or be confused even before we read the `environment` column.
- `last4` = last 4 chars of the body.
- Legacy `rly-…` keys keep their original plaintext form; migration hashes them as-is and
  sets `prefix = "rly-"`, `environment = "live"`.

## Auth flow (the rewrite)

Current ([proxyCommon.ts:78-95](../../src/lib/proxyCommon.ts#L78-L95)):

```ts
const rlyKey = bearer;
if (!rlyKey.startsWith("rly-")) → 401
const tenant = await Tenant.findOne({ rlyKey, status: "active" });
```

New:

```ts
const secret = bearer;                                   // raw key from Authorization
if (!/^rly[_-]/.test(secret)) → 401                      // accept rly_ and legacy rly-
const keyHash = sha256(secret);
const apiKey = await ApiKey.findOne({ keyHash, status: "active" });
if (!apiKey) → 401 "Unknown or revoked Relay key"
const tenant = await Tenant.findById(apiKey.tenantId);
if (!tenant || tenant.status !== "active") → 401
const environment = apiKey.environment;                  // ← drives everything below
// best-effort, throttled: ApiKey.updateOne({_id}, {$set:{lastUsedAt: now}})
```

Then thread `environment` through the rest of `authenticateAndAuthorize`:
- rate limit: `checkRateLimit(tid, environment, limitPerMin)` → counter keyed by env
- end-user key lookup: `EndUserKey.findOne({ tenantId, environment, endUserLabel, provider, isActive: true })`
- `getActiveKeyStats` / `isKeyActiveThisMonth`: filtered by env
- `recordUsage`: writes `environment` onto the `UsageRecord`
- `ProxyIds` / `AuthContext` gain an `environment` field

The plan hard-caps (Free active-key limit) become **per-environment** (confirmed with
product): you can exercise test keys freely without eating your live Free-tier key cap.
`getActiveKeyStats` / `isKeyActiveThisMonth` are filtered by `environment`.

## Console API surface

Replace the single `POST /api/console/regenerate-key` with key management:

| Route                                   | Method | Purpose                                                       |
|-----------------------------------------|--------|---------------------------------------------------------------|
| `/api/console/api-keys`                 | GET    | List keys for active tenant, grouped by environment (no secrets) |
| `/api/console/api-keys`                 | POST   | Create a key `{ environment, name }` → returns plaintext **once** |
| `/api/console/api-keys/[id]/roll`       | POST   | Create a new key + revoke the old one (atomic-ish), returns new plaintext once |
| `/api/console/api-keys/[id]`            | DELETE | Revoke (soft: status→revoked, revokedAt set)                  |

All gated by `requireRole(me, "member")`. All `recordAudit` with the environment in `detail`.
Create/roll responses are the *only* place plaintext is ever returned. Ownership is enforced:
`[id]` routes scope by `tenantId` so one tenant cannot touch another's keys.

`regenerate-key` route: **deleted.** No alias — there are no users depending on it. The console
keys page is rebuilt to call `POST /api/console/api-keys` and show the secret once.

## Migration (`scripts/migrateApiKeys.ts`)

No production data, so this is a **dev-data convenience**, not a production cutover. Idempotent;
safe to run repeatedly. It exists so any local/seed dev database doesn't break.

1. For each `Tenant` with a non-empty `rlyKey` and no existing `ApiKey` row for that hash:
   - insert `ApiKey { tenantId, environment: "live", keyHash: sha256(rlyKey),
     prefix: "rly-", last4: rlyKey.slice(-4), name: "default", status: "active" }`.
   (Promotes any leftover dev key so a developer's existing local key keeps working.)
2. `EndUserKey.updateMany({ environment: { $exists: false } }, { $set: { environment: "live" } })`.
3. `UsageRecord.updateMany({ environment: { $exists: false } }, { $set: { environment: "live" } })`.
4. `RateCounter`: no backfill (TTL-expiring, 2-min lifetime — they'll roll over naturally;
   the unique index change is forward-only).

The `Tenant.rlyKey` field removal: since no users exist, no data migration is needed to drop
it — the field simply stops being read/written. Mongo leaves the orphan field on old docs
harmlessly; a one-liner `Tenant.updateMany({}, { $unset: { rlyKey: 1 } })` is included for
tidiness.

Order vs. index build: add the new `environment` fields/indexes in the same deploy as the
code, but **build the new EndUserKey unique index after step 2** so existing rows have the
field set (otherwise the unique build on a missing field collapses many rows to one null key).
The migration script handles index management explicitly to avoid that footgun.

Rollback: old auth path (`Tenant.findOne({ rlyKey })`) still works because we don't delete
`rlyKey`. Reverting the code reverts behavior; `ApiKey` rows are inert.

## Out of scope (explicitly)

- No UI/React work in this slice — API + model + migration only. The keys *page* rebuild is a
  follow-up once the backend is in.
- No per-key scopes/permissions (read-only keys etc.) — future.
- No webhook signing secrets — that's its own track.
- Priorities (2) error-code reference, (3) browser tester, (4) multi-lang SDK — later slices.

## Verification plan

- Unit: `sha256` hashing stable; key generator emits correct prefix per env; `last4` correct.
- Unit/integration: `authenticateAndAuthorize`
  - live key → resolves to live, sees only live EndUserKey, writes live UsageRecord.
  - test key → resolves to test; a live EndUserKey with same label is **invisible**.
  - revoked key → 401.
  - legacy `rly-` key → resolves to live (back-compat).
- Migration idempotency: running twice produces no duplicate `ApiKey` rows; `environment`
  backfill is stable.
- Rate limit isolation: hammering a test key does not 429 a live key in the same window.
