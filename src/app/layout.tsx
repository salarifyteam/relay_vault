import "./globals.css";
import type { Metadata } from "next";
import { Schibsted_Grotesk, JetBrains_Mono } from "next/font/google";

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = "https://vault.relayservice.im";
const TITLE = "Relay — Build BYOK in an afternoon";
const DESCRIPTION =
  "Let your users bring their own AI keys (OpenAI, Anthropic, Gemini). Relay stores them encrypted and proxies every call, so you never touch a raw key.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Relay",
  },
  description: DESCRIPTION,
  applicationName: "Relay",
  keywords: ["BYOK", "AI keys", "OpenAI", "Anthropic", "Gemini", "API proxy", "LLM"],
  openGraph: {
    type: "website",
    siteName: "Relay",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Relay — Build BYOK in an afternoon",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
