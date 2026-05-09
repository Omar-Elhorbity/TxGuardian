import Link from "next/link";
import { Shield, Github } from "lucide-react";

const links = [
  { href: "/scan", label: "Scan" },
  { href: "/docs", label: "Docs" },
  { href: "/playground", label: "Playground" },
  { href: "/registry", label: "Registry" },
  { href: "/about", label: "About" },
];

export function Nav() {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 z-30 w-full border-b border-border bg-base/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-8 px-6">
        <Link
          href="/"
          aria-label="TxGuardian home"
          className="group flex items-center gap-2 text-text-primary"
        >
          <Shield
            className="h-5 w-5 text-accent transition-colors group-hover:text-accent-hover"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="text-[15px] font-semibold tracking-tight">
            TxGuardian
          </span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-sm px-3 py-1.5 text-[13px] text-text-secondary transition-colors hover:text-text-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="rounded-sm p-2 text-text-secondary transition-colors hover:text-text-primary"
          >
            <Github className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </a>
          <Link href="/scan" className="btn btn-primary text-[13px]">
            Scan a transaction
          </Link>
        </div>
      </div>
    </nav>
  );
}
