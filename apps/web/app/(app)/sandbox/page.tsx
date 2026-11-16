import type { Metadata } from "next";
import Link from "next/link";
import { Grid } from "@/components/grid/Grid";

export const metadata: Metadata = {
  title: "Sandbox",
  description: "Practice spreadsheet formulas freely in the Excel Guru sandbox.",
  robots: { index: false },
};

export default function SandboxPage() {
  return (
    <div className="wrap">
      <div className="brand">
        <Link href="/" style={{ textDecoration: "none" }}>Excel Guru</Link>
      </div>
      <main style={{ padding: "16px 0 48px" }}>
        <h1 style={{ fontSize: "1.75rem", marginBottom: 8 }}>Sandbox</h1>
        <p style={{ margin: "0 0 16px", color: "var(--muted)" }}>
          Try it: type 1, 2 and 3 into the shaded cells, then <code>=SUM(A1:A3)</code> into the dashed cell.
        </p>
        <Grid grid={[]} highlightCells={["A1:A3"]} targetCell="B1" />
      </main>
    </div>
  );
}
