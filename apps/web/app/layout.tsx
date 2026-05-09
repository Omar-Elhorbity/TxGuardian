import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WalletContextProvider } from "@/components/WalletContextProvider";

export const metadata: Metadata = {
  title: "TxGuardian — Pre-sign transaction safety for Solana",
  description:
    "Inspect any Solana transaction before you sign. Deterministic risk rules + plain-English AI translation.",
  metadataBase: new URL("https://txguardian.vercel.app"),
  openGraph: {
    title: "TxGuardian",
    description:
      "Pre-sign transaction safety copilot for Solana. Deterministic rules, AI translation, no signing surface.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The geist `.variable` classes set `--font-geist-sans` and `--font-geist-mono`
  // on <html>. globals.css picks those up via `--font-sans` / `--font-mono`
  // so the design tokens stay the single source of truth.
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-base text-text-primary antialiased">
        <WalletContextProvider>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </WalletContextProvider>
      </body>
    </html>
  );
}
