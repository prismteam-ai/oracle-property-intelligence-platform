"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Sparkles, Building2, HardHat, Briefcase, Store,
  Database, Telescope, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SECTIONS: { title: string; items: { href: string; label: string; icon: React.ReactNode }[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: "/explore", label: "Ask Oracle", icon: <Sparkles className="h-4 w-4" /> },
      { href: "/insights", label: "Insights & Signals", icon: <Telescope className="h-4 w-4" /> },
    ],
  },
  {
    title: "Explore entities",
    items: [
      { href: "/properties", label: "Properties", icon: <Building2 className="h-4 w-4" /> },
      { href: "/contractors", label: "Contractors", icon: <HardHat className="h-4 w-4" /> },
      { href: "/businesses", label: "Businesses", icon: <Briefcase className="h-4 w-4" /> },
      { href: "/tenants", label: "Tenants", icon: <Store className="h-4 w-4" /> },
    ],
  },
  {
    title: "Knowledge layer",
    items: [
      { href: "/sources", label: "Data & Provenance", icon: <Database className="h-4 w-4" /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-[#0b1220] text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-teal-500 text-white">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[15px] font-semibold leading-none text-white">Oracle</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">Property Intelligence</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{s.title}</div>
            <div className="space-y-0.5">
              {s.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                    active(it.href) ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  )}
                >
                  {it.icon}
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Lee County, FL · RAG online
        </div>
        <p className="mt-1 text-[10px] leading-snug text-slate-600">
          Elephant Lexicon model · 4 public sources
        </p>
      </div>
    </aside>
  );
}
