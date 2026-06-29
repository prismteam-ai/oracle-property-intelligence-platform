import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Nav } from "@/components/Nav";
import { DataBanner } from "@/components/DataBanner";
import { DataFooter } from "@/components/DataFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oracle Property Intelligence Platform",
  description:
    "RAG + exploration platform over Lee County property, permit, Sunbiz, and BBB data on the Elephant Lexicon.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <DataBanner />
        <main className="container">{children}</main>
        <DataFooter />
      </body>
    </html>
  );
}
