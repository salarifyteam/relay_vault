import Link from "next/link";
import s from "./landing.module.css";

export const metadata = {
  title: "Relay — Build BYOK in an afternoon",
  description:
    "Let your users bring their own AI keys (OpenAI, Anthropic, Gemini). Relay stores them encrypted and proxies every call, so you never touch a raw key.",
};

const WIDGET_SNIPPET = `<div id="relay-widget"></div>
<script src="https://vault.relayservice.im/widget.js"></script>
<script>
  Relay.mount('#relay-widget', { registrationToken });
</script>`;

const SDK_SNIPPET = `import { Relay } from "@relayservice/sdk";

const relay = new Relay({ key: process.env.RELAY_KEY });

// Same code you already write with OpenAI —
// billed to your user's own key.
const ai = relay.openai({ user: "jieun_123" });
const res = await ai.chat.completions.create({
  model: "claude-haiku-4-5",
  messages: [{ role: "user", content: "Hello!" }],
});`;

export default function Landing() {
  return (
    <div className={s.page}>
      {/* nav */}
      <header className={s.container}>
        <nav className={s.nav}>
          <div className={s.brand}>
            <span className={s.brandMark}>◆</span>
            Relay
          </div>
          <div className={s.navLinks}>
            <Link href="/docs" className={s.navLink}>Docs</Link>
            <Link href="/login" className={s.navLink}>Sign in</Link>
            <Link href="/login" className={s.btnPrimary}>Get started</Link>
          </div>
        </nav>
      </header>

      {/* hero */}
      <section className={s.hero}>
        <div className={s.container}>
          <div className={s.heroInner}>
            <div>
              <div className={s.eyebrow}>BYOK infrastructure</div>
              <h1 className={s.heroTitle}>Build BYOK in an afternoon.</h1>
              <p className={s.heroSub}>
                Let your users bring their own AI keys — OpenAI, Anthropic,
                Gemini. Relay stores them encrypted and proxies every call, so
                you never touch a raw key.
              </p>
              <div className={s.heroCtas}>
                <Link href="/login" className={s.btnPrimary}>Start free →</Link>
                <Link href="/docs" className={s.textLink}>Read the docs →</Link>
              </div>
            </div>
            <div className={s.mockWrap}>
              <HeroMock />
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className={`${s.section} ${s.sectionAlt}`}>
        <div className={s.container}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>From zero to BYOK in three steps</h2>
            <p className={s.sectionDesc}>
              Drop in a widget, let your user connect their key, then call one
              endpoint. No key handling on your side.
            </p>
          </div>
          <div className={s.steps}>
            <div className={s.step}>
              <span className={s.stepNum}>1</span>
              <div className={s.stepTitle}>Drop in the widget</div>
              <p className={s.stepDesc}>
                One <code>&lt;script&gt;</code> tag renders a provider picker and
                key input in your app.
              </p>
            </div>
            <div className={s.step}>
              <span className={s.stepNum}>2</span>
              <div className={s.stepTitle}>User connects their key</div>
              <p className={s.stepDesc}>
                The key goes straight to Relay, encrypted — it never passes
                through your server.
              </p>
            </div>
            <div className={s.step}>
              <span className={s.stepNum}>3</span>
              <div className={s.stepTitle}>Call one endpoint</div>
              <p className={s.stepDesc}>
                <code>vault.relayservice.im/api/v1/chat/completions</code> —
                same call for every provider.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* features */}
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Everything BYOK needs, built in</h2>
            <p className={s.sectionDesc}>
              Encryption, isolation, spend control, and SDKs — so you ship the
              feature, not the plumbing.
            </p>
          </div>
          <div className={s.features}>
            <Feature
              title="One endpoint, every provider"
              desc="OpenAI, Anthropic, and Gemini through a single OpenAI-compatible API — plus OpenAI-compatible providers like xAI and Z.ai."
            />
            <Feature
              title="The key never reaches you"
              desc="Users connect their key directly to Relay. Your code calls AI by user id — you never see a raw key."
            />
            <Feature
              title="Encrypted at rest"
              desc="Keys are envelope-encrypted with Google Cloud KMS and decrypted only to proxy a call."
            />
            <Feature
              title="Test & live keys"
              desc="Separate, fully isolated test and live keys — shown once at creation, Stripe-style."
            />
            <Feature
              title="Spend caps & origin allowlist"
              desc="Cap spend per tenant and restrict which origins may embed the widget."
            />
            <Feature
              title="Drop-in widget + SDKs"
              desc="TypeScript and Python SDKs wrap the official OpenAI client — there's nothing new to learn."
            />
          </div>
        </div>
      </section>

      {/* code */}
      <section className={`${s.section} ${s.sectionAlt}`}>
        <div className={s.container}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>From your code, it&apos;s one import</h2>
            <p className={s.sectionDesc}>
              Embed the widget on the front end; call AI from the back end with
              the SDK you already know.
            </p>
          </div>
          <div className={s.codeGrid}>
            <div className={s.codeCard}>
              <div className={s.codeLabel}>Front end — embed the widget</div>
              <pre className={s.code}>{WIDGET_SNIPPET}</pre>
            </div>
            <div className={s.codeCard}>
              <div className={s.codeLabel}>Back end — call AI as your user</div>
              <pre className={s.code}>{SDK_SNIPPET}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* facts + screenshots */}
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.stats}>
            <Stat value="5" label="providers" />
            <Stat value="KMS" label="encrypted at rest" />
            <Stat value="Test / live" label="key isolation" />
            <Stat value="TS + Py" label="official SDKs" />
            <Stat value="OpenAI-compatible" label="drop-in API" />
          </div>
          {/* screenshots are added after capture: see public/shot-*.png */}
        </div>
      </section>

      {/* final CTA */}
      <section className={`${s.cta} ${s.sectionAlt}`}>
        <div className={s.container}>
          <h2 className={s.ctaTitle}>Ship BYOK today.</h2>
          <p className={s.ctaSub}>
            Create test and live keys, embed the widget, and proxy your first
            call in minutes.
          </p>
          <Link href="/login" className={`${s.btnPrimary} ${s.ctaBtn}`}>
            Start free →
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className={s.footer}>
        <div className={s.container}>
          <div className={s.footerInner}>
            <div className={s.brand}>
              <span className={s.brandMark}>◆</span>
              Relay
            </div>
            <div className={s.footerLinks}>
              <Link href="/docs" className={s.navLink}>Docs</Link>
              <Link href="/login" className={s.navLink}>Sign in</Link>
            </div>
            <div>© Relay</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={s.feature}>
      <span className={s.featureIcon}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <div className={s.featureTitle}>{title}</div>
      <p className={s.featureDesc}>{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={s.stat}>
      <div className={s.statValue}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}

/* Stylized product mockup — a widget card connecting a key, drawn as SVG. */
function HeroMock() {
  return (
    <svg className={s.mock} viewBox="0 0 440 320" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Relay key-connect widget">
      <defs>
        <linearGradient id="relayAccent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#635bff" />
          <stop offset="1" stopColor="#8b85ff" />
        </linearGradient>
        <filter id="relayShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="#0a2540" floodOpacity="0.14" />
        </filter>
      </defs>

      {/* card */}
      <rect x="40" y="30" width="360" height="260" rx="16" fill="#ffffff" stroke="#e6e8eb" filter="url(#relayShadow)" />

      {/* header */}
      <rect x="64" y="56" width="26" height="26" rx="7" fill="url(#relayAccent)" />
      <rect x="100" y="62" width="120" height="9" rx="4.5" fill="#0a2540" />
      <rect x="100" y="76" width="180" height="7" rx="3.5" fill="#aab4c0" />

      {/* provider tiles */}
      <rect x="64" y="104" width="312" height="44" rx="10" fill="#f6f9fc" stroke="#e6e8eb" />
      <circle cx="88" cy="126" r="10" fill="#0a2540" />
      <rect x="108" y="121" width="90" height="9" rx="4.5" fill="#425466" />
      <path d="M356 122l8 8-8 8" stroke="#aab4c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* key input */}
      <rect x="64" y="160" width="312" height="42" rx="10" fill="#ffffff" stroke="#d5dbe1" />
      <text x="80" y="186" fontFamily="monospace" fontSize="13" fill="#697386">sk-ant-••••••••••••••••</text>

      {/* connect button */}
      <rect x="64" y="214" width="312" height="44" rx="10" fill="url(#relayAccent)" />
      <rect x="180" y="231" width="80" height="10" rx="5" fill="#ffffff" opacity="0.95" />

      {/* lock / safety note */}
      <circle cx="74" cy="278" r="5" fill="none" stroke="#1a7f4b" strokeWidth="1.6" />
      <rect x="231" y="273" width="145" height="7" rx="3.5" fill="#cdd7e0" />
      <rect x="86" y="274" width="120" height="7" rx="3.5" fill="#1a7f4b" opacity="0.65" />
    </svg>
  );
}
