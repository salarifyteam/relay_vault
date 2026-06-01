import s from "./landing.module.css";

/**
 * Hero illustrations — one per rotating headline, all provider-facing.
 * Pure SVG/HTML + CSS (landing.module.css). Deliberately uses different visual
 * metaphors from the audience sections below (pricing card / key widget /
 * terminal) so the two don't read as duplicates.
 */

/* 1. Easier acquisition — a low price pulls a crowd of users in. */
export function AcquireArt() {
  return (
    <div className={s.heroArt} aria-hidden>
      <div className={s.acqPriceWrap}>
        <span className={s.acqPriceLabel}>Your price</span>
        <span className={s.acqPrice}>
          $<span className={s.acqPriceNum}>19</span>/mo
        </span>
        <span className={s.acqPriceCut}>was $49</span>
      </div>
      <div className={s.acqFunnel}>
        {Array.from({ length: 7 }).map((_, n) => (
          <span
            key={n}
            className={s.acqUser}
            style={{ animationDelay: `${n * 0.45}s` }}
          />
        ))}
        <span className={s.acqTarget}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>
      <div className={s.acqCaption}>More signups, less price resistance</div>
    </div>
  );
}

/* 2. Off your hands — the user's key skips your server and lands in Relay's
   vault. You never see it, so you can't be liable for it. */
export function CustodyArt() {
  return (
    <div className={s.heroArt} aria-hidden>
      <div className={s.custodyRow}>
        <span className={s.custodyKey}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="15" r="4" />
            <path d="m10.85 12.15 8.15-8.15" />
            <path d="m18 5 2 2" />
            <path d="m15 8 2 2" />
          </svg>
        </span>
        <span className={s.custodyPath} />
        <span className={`${s.custodyNode} ${s.custodyYou}`}>
          Your app
          <span className={s.custodyNo}>key never lands here</span>
        </span>
        <span className={s.custodyPath} />
        <span className={`${s.custodyNode} ${s.custodyVault}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Relay vault
        </span>
      </div>
      <div className={s.custodyCaption}>
        Encrypted with Cloud KMS · you never see it
      </div>
    </div>
  );
}

/* 3. No heavy-user penalty — usage can spike, but your AI cost line stays flat
   at zero. Resolves the "more usage = more cost" contradiction. */
export function CostArt() {
  return (
    <div className={s.heroArt} aria-hidden>
      <div className={s.costChart}>
        <svg viewBox="0 0 240 120" className={s.costSvg} preserveAspectRatio="none">
          {/* usage spikes upward */}
          <polyline
            className={s.costUsage}
            points="0,108 40,96 80,70 120,78 160,40 200,30 240,8"
            fill="none"
          />
          {/* your AI cost stays flat at the bottom */}
          <line className={s.costFlat} x1="0" y1="112" x2="240" y2="112" />
        </svg>
        <span className={`${s.costTag} ${s.costTagUsage}`}>User usage ↑</span>
        <span className={`${s.costTag} ${s.costTagFlat}`}>Your AI cost — $0</span>
      </div>
      <div className={s.costCaption}>Heavy users cost you nothing</div>
    </div>
  );
}

export const HERO_ART = [AcquireArt, CustodyArt, CostArt];
