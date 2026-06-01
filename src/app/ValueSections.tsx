import s from "./landing.module.css";
import { ProvidersArt, UsersArt, DevelopersArt } from "./ValueArt";

type Card = { title: string; desc: string };
type Group = {
  id: string;
  label: string;
  blurb: string;
  Art: () => React.ReactElement;
  cards: Card[];
};

const GROUPS: Group[] = [
  {
    id: "providers",
    label: "For providers",
    blurb:
      "Add AI to your product with zero token cost, full margin, and onboarding that takes care of itself.",
    Art: ProvidersArt,
    cards: [
      {
        title: "Onboarding that just happens",
        desc: "Security stays tight and your price stays low, so new users sign up without friction. Your hardest growth problem, solved by design.",
      },
      {
        title: "Their tokens, your margin",
        desc: "AI is billed to each user's own key. No token cost eats your revenue — 100% stays SaaS margin.",
      },
      {
        title: "Price however you want",
        desc: "With no AI cost to cover, you're free to design plans and pricing without protecting an unknown usage bill.",
      },
      {
        title: "No runaway-cost risk",
        desc: "A heavy user spends on their own key, not yours. One power user can never turn your unit economics negative.",
      },
      {
        title: "Rate limits don't pile up on you",
        desc: "Provider rate limits spread across each user's own key instead of bottlenecking on one shared account.",
      },
      {
        title: "Less compliance to carry",
        desc: "You never store raw keys, so your audit and liability surface shrinks — a real edge in enterprise deals.",
      },
    ],
  },
  {
    id: "users",
    label: "For your users",
    blurb:
      "Their key, their control. Users get the safety and ownership that makes them comfortable saying yes.",
    Art: UsersArt,
    cards: [
      {
        title: "The key never leaks",
        desc: "Keys go straight to Relay, encrypted with Google Cloud KMS — never through the provider's server. You can't leak what you never hold.",
      },
      {
        title: "Their key, their control",
        desc: "Users connect, swap, or disconnect their key anytime, and see usage right in their own provider dashboard.",
      },
      {
        title: "Pay only for what they use",
        desc: "Billed on real usage through their own provider account — not locked into someone else's package tiers.",
      },
      {
        title: "Data stays under their governance",
        desc: "Calls run on the user's own provider account, so their data stays inside their own AI governance.",
      },
      {
        title: "No vendor lock-in",
        desc: "Their AI access is tied to their own key. If the service changes or shuts down, their key still works.",
      },
      {
        title: "Encrypted at rest",
        desc: "Keys are envelope-encrypted with Google Cloud KMS and decrypted only to proxy a single call.",
      },
    ],
  },
  {
    id: "developers",
    label: "For developers",
    blurb:
      "Ship BYOK without building the plumbing. Encryption, isolation, and SDKs come in the box.",
    Art: DevelopersArt,
    cards: [
      {
        title: "Build BYOK in an afternoon",
        desc: "Skip the key-management, encryption, and proxy infrastructure — drop in a widget and call one endpoint.",
      },
      {
        title: "One endpoint, every provider",
        desc: "OpenAI, Anthropic, and Gemini through a single OpenAI-compatible API — plus providers like xAI and Z.ai.",
      },
      {
        title: "Drop-in widget + SDKs",
        desc: "TypeScript and Python SDKs wrap the official OpenAI client — there's nothing new to learn.",
      },
      {
        title: "Switch providers, no code change",
        desc: "A user on OpenAI or on Anthropic hits the same call in your code. You write it once.",
      },
      {
        title: "Test & live keys",
        desc: "Separate, fully isolated test and live keys — shown once at creation, Stripe-style.",
      },
      {
        title: "Spend caps & origin allowlist",
        desc: "Cap spend per tenant and restrict which origins may embed the widget.",
      },
    ],
  },
];

export default function ValueSections() {
  return (
    <>
      {GROUPS.map((g, i) => (
        <section
          key={g.id}
          className={`${s.section} ${i % 2 === 1 ? s.sectionAlt : ""}`}
        >
          <div className={s.container}>
            <div className={`${s.valueTop} ${i % 2 === 1 ? s.valueTopReverse : ""}`}>
              <div className={s.sectionHead}>
                <div className={s.eyebrow}>{g.label}</div>
                <p className={s.valueBlurb}>{g.blurb}</p>
              </div>
              <g.Art />
            </div>
            <div className={s.features}>
              {g.cards.map((c) => (
                <div className={s.feature} key={c.title}>
                  <span className={s.featureIcon}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <div className={s.featureTitle}>{c.title}</div>
                  <p className={s.featureDesc}>{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
