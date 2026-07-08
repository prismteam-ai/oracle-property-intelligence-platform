"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { WORKBENCH_NAV_ITEMS } from "@oracle/shared/workbench-copy";
import { cn } from "@/lib/utils";

export function WorkbenchShell({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="workbench-shell">
      <aside className="workbench-rail">
        <div className="workbench-brand-wrap">
          <Link href="/" className="workbench-brand">
            <span className="workbench-brand-mark" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Oracle Property Intelligence
              </span>
              <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Lee County public records
              </span>
            </span>
          </Link>
        </div>

        <nav aria-label="Primary" className="mt-8">
          <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Domains
          </div>
          <ul className="space-y-1.5">
            {WORKBENCH_NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn("workbench-nav-link", active && "workbench-nav-link-active")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto space-y-3">
          <div className="workbench-rail-card">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Dataset
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">Hosted demo corpus</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Expanded packaged sample for inquiry, search, and record walkthroughs.
            </p>
          </div>
          <div className="workbench-rail-card">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Focus
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Source-backed property, contractor, business, and tenancy investigation.
            </p>
          </div>
        </div>
      </aside>

      <div className="workbench-main">
        <header className="workbench-topbar">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Workspace
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              Lee County property intelligence workbench
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Sample dataset active
            </span>
          </div>
        </header>
        <main className="workbench-content">{children}</main>
      </div>
    </div>
  );
}
