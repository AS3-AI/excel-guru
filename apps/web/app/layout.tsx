import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const description =
  "Learn Excel by doing: type real formulas in a spreadsheet in your browser and get instant feedback. 86 interactive lessons, from SUM to dynamic arrays.";

export const metadata: Metadata = {
  metadataBase: new URL("https://excelguru.in"),
  title: {
    default: "Excel Guru — Learn Excel by typing real formulas",
    template: "%s | Excel Guru",
  },
  description,
  openGraph: {
    title: "Excel Guru — Learn Excel by typing real formulas",
    description,
    type: "website",
    siteName: "Excel Guru",
  },
  twitter: { card: "summary_large_image" },
};

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-disp", display: "swap", axes: ["opsz"] });
const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf9f6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${code.variable}`}>
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
