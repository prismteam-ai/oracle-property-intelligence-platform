import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtUsd = (n?: number | null, compact = false) => {
  if (n == null) return "—";
  if (compact)
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
};
export const fmtNum = (n?: number | null) => (n == null ? "—" : new Intl.NumberFormat("en-US").format(n));
export const fmtDate = (d?: string | Date | null) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
export const timeAgo = (d?: string | Date | null) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(dt);
};

/** Color + label metadata for permit categories. */
export const PERMIT_META: Record<string, { color: string; bg: string }> = {
  Roofing: { color: "#b45309", bg: "#fef3c7" },
  Electrical: { color: "#1d4ed8", bg: "#dbeafe" },
  Plumbing: { color: "#0e7490", bg: "#cffafe" },
  "HVAC / Mechanical": { color: "#7c3aed", bg: "#ede9fe" },
  Concrete: { color: "#475569", bg: "#e2e8f0" },
  "Structural / Building": { color: "#be123c", bg: "#ffe4e6" },
  "Pool / Spa": { color: "#0891b2", bg: "#cffafe" },
  "Solar / PV": { color: "#ca8a04", bg: "#fef9c3" },
  "Windows / Doors": { color: "#0d9488", bg: "#ccfbf1" },
  Demolition: { color: "#9a3412", bg: "#ffedd5" },
  "Sign / Site": { color: "#6b7280", bg: "#f1f5f9" },
};
export const permitColor = (t?: string | null) => PERMIT_META[t ?? ""] ?? { color: "#475569", bg: "#e2e8f0" };

/** BBB rating → tone. */
export function bbbTone(rating?: string | null): "good" | "ok" | "bad" | "neutral" {
  if (!rating) return "neutral";
  if (["A+", "A", "A-"].includes(rating)) return "good";
  if (["B+", "B", "B-"].includes(rating)) return "ok";
  if (["C+", "C", "C-", "D+", "D", "D-", "F", "NR"].includes(rating)) return "bad";
  return "neutral";
}
export const bbbColor = (rating?: string | null) => {
  const t = bbbTone(rating);
  return t === "good" ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : t === "ok" ? "text-blue-700 bg-blue-50 border-blue-200"
    : t === "bad" ? "text-red-700 bg-red-50 border-red-200"
    : "text-slate-600 bg-slate-50 border-slate-200";
};

export const scoreBandColor = (band?: string | null) =>
  band === "Excellent" ? "text-emerald-700"
  : band === "Good" ? "text-blue-700"
  : band === "Fair" ? "text-amber-700"
  : band === "Poor" ? "text-orange-700"
  : "text-red-700";

export const SOURCE_LABELS: Record<string, string> = {
  "lee-county-property-appraiser": "Lee County Property Appraiser",
  "lee-county-accela": "Lee County Accela (permits)",
  "fl-sunbiz": "FL Sunbiz",
  bbb: "Better Business Bureau",
  "oracle-derived-occupancy": "Oracle reconciliation",
  "oracle-derived": "Oracle derived",
};
export const sourceLabel = (s?: string | null) => SOURCE_LABELS[s ?? ""] ?? s ?? "—";

export const entityHref = (type: string, id: string) => {
  switch (type) {
    case "property": return `/properties/${id}`;
    case "contractor": return `/contractors/${id}`;
    case "business": return `/businesses/${id}`;
    case "tenant": return `/tenants/${id}`;
    case "owner": return `/businesses/${id}`;
    default: return `/properties/${id}`;
  }
};
