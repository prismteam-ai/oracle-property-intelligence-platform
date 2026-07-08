import type { Metadata } from "next";
import { WorkbenchShell } from "@/components/app/workbench-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Oracle Property Intelligence",
    template: "%s — Oracle Property Intelligence",
  },
  description:
    "Lee County property intelligence over the Elephant open-data network: 511,695 provenance-tracked properties, permits, businesses, and contractors with source-cited answers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      style={
        {
          "--font-sans": 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          "--font-display":
            '"Arial Black", "Franklin Gothic Heavy", "Avenir Next Condensed", Impact, sans-serif',
        } as React.CSSProperties
      }
    >
      <body className="min-h-screen font-sans">
        <WorkbenchShell>{children}</WorkbenchShell>
      </body>
    </html>
  );
}
