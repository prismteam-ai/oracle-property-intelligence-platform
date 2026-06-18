import Link from "next/link";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Card, PageHeader, Badge, SectionTitle } from "@/components/ui";
import { INQUIRIES } from "@/lib/inquiries";
import { sourceLabel, fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GROUP_ORDER = [
  "Open permits", "Major renovations", "Activity", "Contractor activity", "Contractor risk",
  "Ownership", "Businesses", "Tenants", "Investment signals", "Neighborhoods",
];

export default async function InsightsPage() {
  const results = await Promise.all(
    INQUIRIES.map(async (inq) => {
      try { return { inq, res: await inq.run() }; }
      catch { return { inq, res: null }; }
    }),
  );
  const byGroup = new Map<string, typeof results>();
  for (const r of results) {
    const g = r.inq.group;
    (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(r);
  }
  const groups = [...byGroup.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytical layer"
        title="Insights & Signals"
        subtitle="Every required demo inquiry, computed live over the loaded dataset. Each signal is a precise, source-backed query — click through to the full source-cited result in Ask Oracle."
      />

      {groups.map((g) => (
        <div key={g}>
          <SectionTitle title={g} subtitle={`${byGroup.get(g)!.length} signal${byGroup.get(g)!.length === 1 ? "" : "s"}`} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byGroup.get(g)!.map(({ inq, res }) => (
              <Link key={inq.id} href={`/explore?q=${encodeURIComponent(inq.question)}`}
                className="group block rounded-card border border-line bg-white p-4 transition hover:border-brand-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold leading-snug text-ink">{inq.label}</div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tabular text-brand-600">{res ? fmtNum(res.total) : "—"}</span>
                  <span className="text-xs text-slate-400">matches</span>
                  {inq.stretch && <Badge tone="violet" className="ml-1">stretch</Badge>}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-slate-500">{res?.summary ?? inq.question}</p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {(res?.sourceSystems ?? []).map((s) => (
                    <span key={s} className="rounded border border-line bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">{sourceLabel(s)}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <Card className="flex items-center gap-3 p-4">
        <TrendingUp className="h-5 w-5 text-brand-500" />
        <p className="text-sm text-slate-600">
          These signals also answer free-form questions — head to <Link href="/explore" className="font-medium text-brand-600 hover:underline">Ask Oracle</Link> to query in natural language with full citations.
        </p>
      </Card>
    </div>
  );
}
