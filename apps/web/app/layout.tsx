import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const description =
  "Learn Excel by doing: type real formulas in a spreadsheet in your browser and get instant feedback. 86 interactive lessons, from SUM to dynamic arrays.";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Excel Guru — Learn Excel by typing real formulas",
  description,
  openGraph: {
    title: "Excel Guru — Learn Excel by typing real formulas",
    description,
    type: "website",
    siteName: "Excel Guru",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#107c41" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
