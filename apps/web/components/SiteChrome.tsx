import Link from "next/link";
import { Icon } from "./icons";

type NavKey = "learn" | "pricing" | "help" | "profile";

const MARKETING: { key: NavKey; href: string; label: string }[] = [
  { key: "learn", href: "/learn", label: "Guides" },
  { key: "pricing", href: "/pricing", label: "Pricing" },
  { key: "help", href: "/help", label: "Help" },
];

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

/** One header for every page. `signedIn` swaps the auth buttons for an account menu; `minimal` drops the nav (auth pages). */
export function SiteHeader({
  signedIn = false,
  current,
  minimal = false,
}: {
  signedIn?: boolean;
  current?: NavKey;
  minimal?: boolean;
}) {
  const links = MARKETING;
  return (
    <header className="site-header">
      <div className="wrap">
        <Logo />
        {!minimal && (
          <nav className="site-nav" aria-label="Main">
            {links.map((l) => (
              <Link key={l.key} href={l.href} aria-current={current === l.key ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="site-actions">
          {signedIn ? (
            <>
              <Link
                href="/profile"
                className="nav-profile-link"
                aria-current={current === "profile" ? "page" : undefined}
              >
                <span className="avatar" aria-hidden="true">
                  <Icon name="user" size={13} />
                </span>
                Profile
              </Link>
              {!minimal && (
                <details className="menu menu-mobile">
                  <summary aria-label="Menu">
                    <Icon name="menu" size={18} />
                  </summary>
                  <div className="menu-panel">
                    {links.map((l) => (
                      <Link key={l.key} href={l.href}>
                        {l.label}
                      </Link>
                    ))}
                    <Link href="/profile">Profile</Link>
                    <hr />
                    <form action="/auth/signout" method="post">
                      <button type="submit">
                        <Icon name="logOut" size={16} />
                        Log out
                      </button>
                    </form>
                  </div>
                </details>
              )}
            </>
          ) : minimal ? null : (
            <>
              <Link className="hide-sm" href="/login">
                Log in
              </Link>
              <Link className="btn" href="/signup">
                Sign up free
              </Link>
              <details className="menu menu-mobile">
                <summary aria-label="Menu">
                  <Icon name="menu" size={18} />
                </summary>
                <div className="menu-panel">
                  {links.map((l) => (
                    <Link key={l.key} href={l.href}>
                      {l.label}
                    </Link>
                  ))}
                  <hr />
                  <Link href="/login">Log in</Link>
                </div>
              </details>
            </>
          )}
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
