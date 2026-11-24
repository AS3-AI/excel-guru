import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Doodle } from "@/components/Doodles";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="state" id="main">
        <Doodle name="arrow" className="nf-arrow draw" />
        <span className="state-code" aria-hidden="true">#REF!</span>
        <div className="state-fx" aria-hidden="true"><b>fx</b><span>=PAGE(this_address)</span></div>
        <h1>This page doesn&apos;t exist</h1>
        <p>Like a formula pointing at a deleted cell, this link leads nowhere. It may have moved, or the address has a typo.</p>
        <div className="row">
          <Link className="btn" href="/">Go home</Link>
          <Link className="btn btn-quiet" href="/lesson/intro">Try the free lesson</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
