import Link from "next/link";
import { MARKETING_LINKS, type NavKey } from "@/lib/nav-links";
import { SiteHeaderActions } from "./SiteHeaderActions";

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="Excel Guru home">
      <span className="logo-mark" aria-hidden="true">
        fx
      </span>
      Excel Guru
    </Link>
  );
}

/** One header for every page. Omit `signedIn` on static pages so auth state resolves client-side. */
export function SiteHeader({
  signedIn,
  current,
  minimal = false,
}: {
  signedIn?: boolean;
  current?: NavKey;
  minimal?: boolean;
}) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Logo />
        {!minimal && (
          <nav className="site-nav" aria-label="Main">
            {MARKETING_LINKS.map((l) => (
              <Link key={l.key} href={l.href} aria-current={current === l.key ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="site-actions">
          <SiteHeaderActions initialSignedIn={signedIn} current={current} minimal={minimal} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>
          <span className="logo-mark" aria-hidden="true">
            fx
          </span>
          © {new Date().getFullYear()} Excel Guru
        </p>
        <nav aria-label="Footer">
          <Link href="/lesson/intro">Free lesson</Link>
          <Link href="/learn">Guides</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
