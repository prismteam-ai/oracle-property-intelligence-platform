import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { GlobalSearch } from "@/components/global-search";

export const metadata: Metadata = {
  title: "Oracle · Property Intelligence Platform",
  description:
    "RAG-backed property, permit, business, and contractor intelligence for Lee County, FL — modeled on the Elephant Lexicon.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <div className="ml-60 flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-line bg-white/80 px-8 backdrop-blur">
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
              <span className="hidden items-center gap-1.5 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live dataset
              </span>
              <span className="rounded-full border border-line px-2 py-1 font-medium">Lee County, FL</span>
            </div>
          </header>
          <main className="flex-1 px-8 py-7">{children}</main>
        </div>
      </body>
    </html>
  );
}
