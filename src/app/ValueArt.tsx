import s from "./landing.module.css";

/**
 * Simplified, self-animating illustrations of the Relay console — one per
 * audience. Pure SVG/HTML + CSS keyframes (see landing.module.css), so they
 * loop on their own, scale crisply, and respect prefers-reduced-motion.
 */

/* Providers — a cheaper BYOK pricing card slides in next to the old expensive
   one, while the "Your revenue" bar stays put: lower price, same revenue. */
export function ProvidersArt() {
  return (
    <div className={s.art} aria-hidden>
      <div className={s.artPricing}>
        <div className={`${s.priceCard} ${s.priceOld}`}>
          <div className={s.priceTag}>Old plan</div>
          <div className={s.priceFig}>
            $49<span className={s.pricePer}>/mo</span>
          </div>
          <div className={s.priceNote}>AI cost eats your margin</div>
          <div className={s.priceCost}>− AI usage</div>
        </div>

        <div className={`${s.priceCard} ${s.priceNew}`}>
          <span className={s.priceBadge}>BYOK</span>
          <div className={s.priceTag}>New plan</div>
          <div className={s.priceFig}>
            $19<span className={s.pricePer}>/mo</span>
          </div>
          <div className={s.priceNote}>AI cost $0 — billed to the user</div>
          <div className={`${s.priceCost} ${s.priceCostZero}`}>AI cost $0</div>
        </div>
      </div>

      <div className={s.artRevenue}>
        <span className={s.artRevenueLabel}>Your revenue</span>
        <span className={s.artRevenueTrack}>
          <span className={s.artRevenueFill} />
        </span>
      </div>
    </div>
  );
}

/* Users — the key-connect widget filling itself in, ending on an encrypted
   lock: pick provider → key types in → "Connected · encrypted". */
export function UsersArt() {
  return (
    <div className={s.art} aria-hidden>
      <div className={s.widgetCard}>
        <div className={s.widgetHead}>
          <span className={s.widgetDot} />
          Connect your AI key
        </div>

        <div className={s.widgetRow}>
          <span className={s.widgetProvider} />
          Anthropic
        </div>

        <div className={s.widgetInput}>
          <span className={s.widgetTyping}>sk-ant-••••••••••••</span>
        </div>

        <div className={s.widgetConnect}>
          <span className={s.widgetLock}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </span>
          Connected · encrypted
        </div>
      </div>
    </div>
  );
}

/* Developers — one line of code is typed, then it "builds" into a streamed
   response: BYOK in a single import. */
export function DevelopersArt() {
  return (
    <div className={s.art} aria-hidden>
      <div className={s.term}>
        <div className={s.termBar}>
          <span className={s.termBtn} />
          <span className={s.termBtn} />
          <span className={s.termBtn} />
        </div>
        <pre className={s.termBody}>
          <span className={s.termCode}>
            <span className={s.termKw}>const</span> ai = relay.openai({'{'} user {'}'});
            <span className={s.termCaret} />
          </span>
          <span className={s.termResp}>
            <span className={s.termCheck}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            Live — billed to your user&apos;s key
          </span>
        </pre>
      </div>
    </div>
  );
}
