import s from "./login.module.css";
import { Wordmark } from "@/components/Wordmark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // 상대경로만 허용(오픈 리디렉트 방지)
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const googleHref = safeNext
    ? `/api/auth/google?next=${encodeURIComponent(safeNext)}`
    : "/api/auth/google";

  return (
    <div className={s.wrap}>
      <div className={s.left}>
        <div className={s.inner}>
          <div className={s.brand}>
            <Wordmark height={20} />
          </div>
          <h1 className={s.title}>Build BYOK in an afternoon.</h1>
          <p className={s.sub}>
            Let your users bring their own AI keys — OpenAI, Anthropic, Gemini.
            Relay stores them encrypted and proxies every call, so you never
            touch a raw key.
          </p>

          <a href={googleHref} className={s.googleBtn}>
            <GoogleMark />
            Continue with Google
          </a>

          <p className={s.fine}>
            By continuing you agree to Relay&apos;s Terms and acknowledge the
            Privacy Policy. We only request your name and email.
          </p>
        </div>
      </div>

      <div className={s.right}>
        <div className={s.quoteCard}>
          <div className={s.quoteLabel}>One endpoint, every provider</div>
          <div className={s.kv}>
            base_url = <b>vault.relayservice.im</b>
            <br />
            model = <b>&quot;gpt-4o-mini&quot;</b>
            <br />
            model = <b>&quot;claude-haiku-4-5&quot;</b>
            <br />
            model = <b>&quot;gemini-2.5-flash&quot;</b>
          </div>
        </div>
        <div className={s.quoteCard}>
          <div className={s.quoteLabel}>The key never reaches you</div>
          <div className={s.kv}>
            user → <b>Relay widget</b> → 🔒 encrypted
            <br />
            your server → <b>X-Relay-User</b> only
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
