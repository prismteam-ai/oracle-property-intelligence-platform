import Link from "next/link";
import { cn, sourceLabel } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function PageHeader({
  title, subtitle, eyebrow, actions,
}: { title: React.ReactNode; subtitle?: React.ReactNode; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({
  title, subtitle, action, className,
}: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kpi({
  label, value, sub, tone = "default", icon,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "default" | "brand" | "accent" | "warning" | "danger"; icon?: React.ReactNode }) {
  const toneCls = {
    default: "text-ink", brand: "text-brand-600", accent: "text-teal-600", warning: "text-amber-600", danger: "text-red-600",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular", toneCls)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

type Tone = "slate" | "brand" | "green" | "amber" | "red" | "blue" | "teal" | "violet" | "orange";
const TONE_CLS: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  brand: "bg-brand-50 text-brand-700 border-brand-100",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
};
export function Badge({
  children, tone = "slate", className, dot,
}: { children: React.ReactNode; tone?: Tone; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", TONE_CLS[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export function StatusDot({ open }: { open: boolean }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", open ? "bg-amber-500" : "bg-emerald-500")} />;
}

/* table primitives */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return (
    <th className={cn("border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500", align === "right" && "text-right", align === "center" && "text-center", className)}>
      {children}
    </th>
  );
}
export function Td({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" | "center" }) {
  return <td className={cn("border-b border-line/70 px-3 py-2.5 align-middle text-slate-700", align === "right" && "text-right tabular", align === "center" && "text-center", className)}>{children}</td>;
}

export function Bar({ value, max, tone = "brand" }: { value: number; max: number; tone?: "brand" | "amber" | "green" | "red" | "teal" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bg = { brand: "bg-brand-500", amber: "bg-amber-500", green: "bg-emerald-500", red: "bg-red-500", teal: "bg-teal-500" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full", bg)} style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line py-12 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** Provenance chip — links back to the public source record. */
export function Provenance({
  source, url, recordKey, retrievedAt, compact,
}: { source: string; url?: string | null; recordKey?: string | null; retrievedAt?: string | Date | null; compact?: boolean }) {
  const inner = (
    <span className="inline-flex items-center gap-1 rounded border border-line bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:border-brand-200 hover:text-brand-600">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
      {sourceLabel(source)}
      {!compact && recordKey ? <span className="text-slate-400">· {recordKey}</span> : null}
      {url && <ExternalLink className="h-2.5 w-2.5" />}
    </span>
  );
  if (url) return <a href={url} target="_blank" rel="noreferrer" title={`Source: ${recordKey ?? source}`}>{inner}</a>;
  return inner;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600">
      ← {children}
    </Link>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}
