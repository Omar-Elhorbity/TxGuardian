"use client";

import Link from "next/link";
import { Shield, Github, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";

const links = [
  { href: "/scan", label: "Scan" },
  { href: "/extension", label: "Extension" },
  { href: "/registry", label: "Registry" },
  { href: "/docs", label: "Docs" },
  { href: "/about", label: "About" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Esc
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Lock body scroll while menu open (mobile)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <nav
        aria-label="Primary"
        className="sticky top-0 z-30 w-full border-b border-border bg-base/85 backdrop-blur-md"
      >
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-4 px-6">
          {/* Logo */}
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

          {/* Desktop links — visible at lg+ where there's enough horizontal room
              alongside the wallet button + github icon. Below lg they collapse
              into the hamburger menu. */}
          <ul className="hidden items-center gap-1 lg:flex">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-sm px-3 py-1.5 text-[13px] transition-colors ${
                      active
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Right cluster — always visible */}
          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://github.com/Omar-Elhorbity/TxGuardian"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="hidden rounded-sm p-2 text-text-secondary transition-colors hover:text-text-primary lg:inline-flex"
            >
              <Github className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </a>
            <WalletButton />

            {/* Hamburger — visible below lg */}
            <button
              type="button"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="primary-menu"
              onClick={() => setOpen((v) => !v)}
              className="rounded-sm p-2 text-text-secondary transition-colors hover:text-text-primary lg:hidden"
            >
              {open ? (
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <Menu className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu panel — drops down beneath the nav bar. Inside the same
            <nav> so screen readers treat it as part of primary navigation. */}
        <div
          id="primary-menu"
          className={`overflow-hidden border-t border-border bg-base lg:hidden ${
            open ? "max-h-[400px]" : "max-h-0"
          }`}
          style={{
            transition: "max-height 220ms cubic-bezier(0.2, 0, 0, 1)",
          }}
        >
          <ul className="flex flex-col py-2">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center px-6 py-3 text-[14px] transition-colors ${
                      active
                        ? "text-text-primary bg-surface-1"
                        : "text-text-secondary hover:bg-surface-1 hover:text-text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-border">
              <a
                href="https://github.com/Omar-Elhorbity/TxGuardian"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-6 py-3 text-[14px] text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary"
              >
                <Github className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                GitHub
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Backdrop — closes the menu on tap, doesn't render on lg+ */}
      {open && (
        <button
          aria-label="Close menu backdrop"
          onClick={() => setOpen(false)}
          className="fixed inset-0 top-14 z-20 bg-base/40 backdrop-blur-[2px] lg:hidden"
        />
      )}
    </>
  );
}
