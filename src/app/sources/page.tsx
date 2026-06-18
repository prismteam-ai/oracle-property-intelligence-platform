import { Database, GitBranch, FileCheck2, Layers } from "lucide-react";
import { Card, PageHeader, SectionTitle, Badge } from "@/components/ui";
import { getDataSources } from "@/lib/queries";
import { sql } from "@/db/client";
import { fmtNum, fmtDate, timeAgo, sourceLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LEXICON_ENTITIES: { label: string; table: string }[] = [
  { label: "Properties", table: "properties" },
  { label: "Parcels", table: "parcels" },
  { label: "Addresses", table: "addresses" },
  { label: "Owners & People", table: "people" },
  { label: "Companies", table: "companies" },
  { label: "Permits / Projects", table: "property_improvements" },
  { label: "Inspections", table: "inspections" },
  { label: "Ownerships", table: "ownerships" },
  { label: "Sales / Deeds", table: "sales_histories" },
  { label: "Business Registrations", table: "business_registrations" },
  { label: "Reputation Profiles (BBB)", table: "business_reputation_profiles" },
  { label: "Complaints", table: "business_reputation_complaints" },
  { label: "Reviews", table: "business_reputation_reviews" },
  { label: "Occupancies (Tenants)", table: "occupancies" },
];

export default async function SourcesPage() {
  const sources = (await getDataSources()) as any[];
  const counts: Record<string, number> = {};
  await Promise.all(
    LEXICON_ENTITIES.map(async (e) => {
      const r = await sql.unsafe(`select count(*)::int as n from ${e.table}`);
      counts[e.table] = (r[0] as any).n;
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge layer"
        title="Data & Provenance"
        subtitle="Oracle reconciles public records into the canonical Elephant Lexicon model, preserving source URLs, refresh timestamps, and lineage on every record."
      />

      <Card className="p-5">
        <SectionTitle title="Ingested sources" subtitle="Refresh ledger — collection & lineage metadata" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((s) => (
            <div key={s.ingestion_run_id} className="rounded-card border border-line p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><Database className="h-4 w-4" /></span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{sourceLabel(s.source_system)}</div>
                    <div className="font-mono text-[10px] text-slate-400">{s.source_system}</div>
                  </div>
                </div>
                <Badge tone="green" dot>{s.status}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-[10px] uppercase tracking-wide text-slate-400">Records</div><div className="font-semibold tabular text-ink">{fmtNum(s.records_loaded)}</div></div>
                <div><div className="text-[10px] uppercase tracking-wide text-slate-400">Refreshed</div><div className="text-ink">{timeAgo(s.refreshed_at)}</div></div>
              </div>
              {s.source_url && <a href={s.source_url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-[11px] text-brand-600 hover:underline">{s.source_url}</a>}
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{s.notes}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Canonical entities" subtitle="Elephant Lexicon model — loaded record counts" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LEXICON_ENTITIES.map((e) => (
              <div key={e.table} className="rounded-lg border border-line px-3 py-2.5">
                <div className="text-lg font-semibold tabular text-ink">{fmtNum(counts[e.table] ?? 0)}</div>
                <div className="text-[11px] text-slate-500">{e.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Provenance model" />
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-2"><Layers className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><span>Every record stores <span className="font-mono text-[11px]">source_system</span>, <span className="font-mono text-[11px]">source_record_key</span>, <span className="font-mono text-[11px]">source_url</span>, and <span className="font-mono text-[11px]">retrieved_at</span>.</span></li>
            <li className="flex gap-2"><GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><span>Entities are reconciled across sources by normalized parcel STRAP and address hash, with durable IDs.</span></li>
            <li className="flex gap-2"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><span>RAG answers cite the originating public record so every claim is verifiable.</span></li>
          </ul>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            This demo runs on a representative Lee County dataset generated to the exact lexicon shape. In production the same model is populated by the Oracle ingestion pipeline (oracle-node + elephant-xyz/skills) into the Neon query DB.
          </div>
        </Card>
      </div>
    </div>
  );
}
