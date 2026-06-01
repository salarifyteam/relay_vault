import Link from "next/link";
import s from "./landing.module.css";
import HeroRotator from "./HeroRotator";
import ValueSections from "./ValueSections";
import { Wordmark } from "@/components/Wordmark";

// Landing is the site's primary page — it inherits the root layout's
// title/description/OG metadata as-is (the default title, not the "%s · Relay"
// template), so no per-page override is needed here.

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
          <Wordmark height={22} />

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
          <HeroRotator />
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

      {/* value for everyone — one section per audience */}
      <section className={s.valueIntro}>
        <div className={s.container}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>One model, value for everyone</h2>
            <p className={s.sectionDesc}>
              BYOK pays off three ways at once — for the business that sells it,
              the user who trusts it, and the developer who ships it.
            </p>
          </div>
        </div>
      </section>
      <ValueSections />

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
            <Wordmark height={20} />

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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={s.stat}>
      <div className={s.statValue}>{value}</div>
      <div className={s.statLabel}>{label}</div>
    </div>
  );
}
