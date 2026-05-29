import "./globals.css";
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

export const metadata = {
  title: "Relay for developers",
  description: "BYOK infrastructure for AI apps",
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
