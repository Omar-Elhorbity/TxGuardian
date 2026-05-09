import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

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
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        // Bridge next/font CSS variables into our token system.
        // The names align with --font-sans / --font-mono in globals.css.
        ["--font-sans" as string]: GeistSans.style.fontFamily,
        ["--font-mono" as string]: GeistMono.style.fontFamily,
      }}
    >
      <body className="min-h-screen bg-base text-text-primary antialiased">
        <Nav />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
