import type { Metadata } from "next";
import { Grid } from "@/components/grid/Grid";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Sandbox",
  description: "Practice spreadsheet formulas freely in the Excel Guru sandbox.",
  robots: { index: false },
};

export default function SandboxPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap" id="main" style={{ paddingTop: "var(--s7)", paddingBottom: "var(--s8)" }}>
        <p className="eyebrow"><span className="ref">A1</span>Sandbox</p>
        <h1>Free practice sheet</h1>
        <p className="lead">
          Type 1, 2 and 3 into the shaded cells, then <code className="chip">=SUM(A1:A3)</code> into the dashed cell.
        </p>
        <Grid grid={[]} highlightCells={["A1:A3"]} targetCell="B1" />
      </main>
      <SiteFooter />
    </>
  );
}
