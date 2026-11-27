"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MARKETING_LINKS, type NavKey } from "@/lib/nav-links";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export function SiteHeaderActions({
  initialSignedIn,
  current,
  minimal = false,
}: {
  initialSignedIn?: boolean;
  current?: NavKey;
  minimal?: boolean;
}) {
  const [signedIn, setSignedIn] = useState(initialSignedIn ?? false);

  useEffect(() => {
    if (initialSignedIn !== undefined) return;
    const supabase = createClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(!!data.session?.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(!!session?.user);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [initialSignedIn]);

  if (signedIn) {
    return (
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
              {MARKETING_LINKS.map((l) => (
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
    );
  }

  if (minimal) return null;

  return (
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
          {MARKETING_LINKS.map((l) => (
            <Link key={l.key} href={l.href}>
              {l.label}
            </Link>
          ))}
          <hr />
          <Link href="/login">Log in</Link>
        </div>
      </details>
    </>
  );
}
