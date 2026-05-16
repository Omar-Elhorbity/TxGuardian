import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WalletContextProvider } from "@/components/WalletContextProvider";

// Resolve the canonical site URL in this order:
//   1. NEXT_PUBLIC_SITE_URL — explicit override (custom domain, self-host)
//   2. VERCEL_PROJECT_PRODUCTION_URL — stable canonical Vercel domain
//   3. VERCEL_URL — current deployment URL (preview / fallback)
//   4. localhost:3000 — dev
const resolvedSiteUrl = (() => {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.startsWith("http") ? env : `https://${env}`;
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
})();

export const metadata: Metadata = {
  title: "TxGuardian — Pre-sign transaction safety for Solana",
  description:
    "Inspect any Solana transaction before you sign. Deterministic risk rules + plain-English AI translation.",
  metadataBase: new URL(resolvedSiteUrl),
  authors: [{ name: "Omar Elhorbity" }],
  openGraph: {
    title: "TxGuardian — Pre-sign transaction safety for Solana",
    description:
      "Deterministic risk rules, on-chain attestation registry, plain-English AI translation. Browser extension, engine demo, and TypeScript SDK.",
    type: "website",
    siteName: "TxGuardian",
  },
  twitter: {
    card: "summary_large_image",
    title: "TxGuardian — Pre-sign transaction safety for Solana",
    description:
      "Deterministic risk rules, on-chain registry, plain-English AI translation. Scanner + extension + SDK.",
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
