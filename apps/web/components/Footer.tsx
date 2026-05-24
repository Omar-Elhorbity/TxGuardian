import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-6 py-8 text-[12px] text-text-muted md:flex-row md:items-center md:justify-between">
        <div>
          TxGuardian — Solana safety in your browser. Open source, MIT.
        </div>
        <ul className="flex items-center gap-5">
          <li>
            <Link href="/docs" className="hover:text-text-primary">
              Docs
            </Link>
          </li>
          <li>
            <Link href="/about" className="hover:text-text-primary">
              About
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="hover:text-text-primary">
              Privacy
            </Link>
          </li>
          <li>
            <a
              href="https://github.com/Omar-Elhorbity/TxGuardian"
              target="_blank"
              rel="noreferrer"
              className="hover:text-text-primary"
            >
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
