"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="state" id="main">
      <span className="state-code" aria-hidden="true">#VALUE!</span>
      <h1>Something went wrong</h1>
      <p>We couldn&apos;t load this page. Try again, or head back to the dashboard.</p>
      <div className="row">
        <button className="btn" type="button" onClick={reset}>Try again</button>
        <Link className="btn btn-quiet" href="/dashboard">Dashboard</Link>
      </div>
    </main>
  );
}
