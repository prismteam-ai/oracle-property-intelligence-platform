import Link from "next/link";
import { Building2, FileStack, FolderOpen, HardHat, Briefcase, Hammer, ArrowUpRight, Database } from "lucide-react";
import { Card, Kpi, PageHeader, SectionTitle, Badge } from "@/components/ui";
import { ActivityArea, HBars } from "@/components/charts";
import {
  getOverviewKpis, getPermitActivityByMonth, getPermitsByType, getPermitsByCity, getDataSources,
} from "@/lib/queries";
import { fmtNum, fmtUsd, timeAgo, permitColor, sourceLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FEATURED = [
  { q: "Show all properties with more than one open permit", label: "Properties with multiple open permits" },
  { q: "Show contractors with negative BBB ratings", label: "Contractors with negative BBB ratings" },
  { q: "Show owners associated with multiple properties", label: "Owners with multiple properties" },
  { q: "Show neighborhoods with increasing permit activity", label: "Neighborhoods heating up" },
  { q: "Which properties are likely candidates for acquisition based on permit, ownership, and occupancy signals?", label: "Acquisition / redevelopment candidates" },
];

export default async function Dashboard() {
  const [kpis, activity, byType, byCity, sources] = await Promise.all([
    getOverviewKpis(), getPermitActivityByMonth(36), getPermitsByType(), getPermitsByCity(), getDataSources(),
  ]);

  const typeData = (byType as any[]).map((r) => ({ label: r.label, value: r.value, color: permitColor(r.label).color }));
  const cityData = (byCity as any[]).map((r) => ({ label: r.label, value: r.value, color: "#2f6df6" }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lee County, FL · Property Intelligence"
        title="Network Overview"
        subtitle="A unified, RAG-accessible knowledge layer over Lee County property, permit, business, and contractor records — modeled on the Elephant Lexicon, with full source provenance."
        actions={
          <Link href="/explore" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Ask Oracle <ArrowUpRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Properties" value={fmtNum(kpis.properties)} icon={<Building2 className="h-4 w-4" />} sub="parcels modeled" />
        <Kpi label="Permits" value={fmtNum(kpis.permits)} icon={<FileStack className="h-4 w-4" />} sub="Accela records" />
        <Kpi label="Open permits" value={fmtNum(kpis.open_permits)} tone="warning" icon={<FolderOpen className="h-4 w-4" />} sub="active work" />
        <Kpi label="Contractors" value={fmtNum(kpis.contractors)} icon={<HardHat className="h-4 w-4" />} sub="with reputation data" />
        <Kpi label="Businesses" value={fmtNum(kpis.businesses)} icon={<Briefcase className="h-4 w-4" />} sub="Sunbiz registered" />
        <Kpi label="Major renovations" value={fmtNum(kpis.major_renovations)} tone="brand" icon={<Hammer className="h-4 w-4" />} sub="classified" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Permit activity" subtitle="Permits issued per month — last 36 months" />
          <ActivityArea data={activity as any} />
        </Card>
        <Card className="p-5">
          <SectionTitle title="Knowledge layer" subtitle="Indexed for semantic + structured retrieval" />
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">Entity documents</span>
              <span className="text-xl font-semibold tabular text-ink">{fmtNum(kpis.documents)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">Total market value</span>
              <span className="text-xl font-semibold tabular text-ink">{fmtUsd(Number(kpis.total_value), true)}</span>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Retrieval</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                pgvector (bge-small, 384d) semantic search fused with Postgres full-text, plus a structured query router for analytical questions. Every answer is source-cited.
              </p>
            </div>
            <Link href="/sources" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              <Database className="h-3.5 w-3.5" /> View data sources & provenance
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <SectionTitle title="Permits by category" subtitle="All time" />
          <HBars data={typeData} />
        </Card>
        <Card className="p-5">
          <SectionTitle title="Permits by municipality" subtitle="All time" />
          <HBars data={cityData} />
        </Card>
        <Card className="p-5">
          <SectionTitle title="Try an inquiry" subtitle="Natural-language, source-backed" />
          <div className="space-y-2">
            {FEATURED.map((f) => (
              <Link key={f.q} href={`/explore?q=${encodeURIComponent(f.q)}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40">
                <span>{f.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Data sources" subtitle="Public-records ingestion — refresh timestamps & lineage preserved" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(sources as any[]).map((s) => (
            <div key={s.ingestion_run_id} className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-ink">{sourceLabel(s.source_system)}</span>
              </div>
              <div className="mt-2 text-lg font-semibold tabular text-ink">{fmtNum(s.records_loaded)}</div>
              <div className="text-[11px] text-slate-500">records · refreshed {timeAgo(s.refreshed_at)}</div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{s.notes}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
