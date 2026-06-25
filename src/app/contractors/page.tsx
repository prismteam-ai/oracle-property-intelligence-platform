import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, PageHeader, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { listContractors, getContractorFacets } from "@/lib/queries";
import { fmtNum, bbbColor, scoreBandColor, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContractorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { categories } = await getContractorFacets();
  const rows = await listContractors({
    category: sp.category, rating: sp.rating, q: sp.q, sort: sp.sort, flagged: sp.flagged === "1", limit: 80,
  }) as any[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explore entities"
        title="Contractors"
        subtitle="Contractors active on Lee County permits, enriched with BBB reputation, complaint history, reviews, and an Oracle contractor-quality score."
      />

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Search</label>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Contractor name…" className="w-56 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-300" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Trade</label>
            <select name="category" defaultValue={sp.category ?? ""} className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-300">
              <option value="">All trades</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Reputation</label>
            <select name="rating" defaultValue={sp.rating ?? ""} className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-300">
              <option value="">All ratings</option>
              <option value="top">A-rated (A+/A/A-)</option>
              <option value="negative">Negative (C and below)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Sort</label>
            <select name="sort" defaultValue={sp.sort ?? "projects"} className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-300">
              <option value="projects">Most projects</option>
              <option value="score">Reputation score</option>
              <option value="complaints">Most complaints</option>
              <option value="name">Name</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" name="flagged" value="1" defaultChecked={sp.flagged === "1"} className="h-4 w-4 rounded border-line" />
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Risk-flagged only
          </label>
          <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <Link href="/contractors" className="text-sm text-slate-500 hover:text-brand-600">Reset</Link>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 text-sm text-slate-500">{rows.length} contractors</div>
        {rows.length === 0 ? <div className="p-4"><EmptyState title="No contractors match" /></div> : (
          <Table>
            <thead><tr><Th>Contractor</Th><Th>Trade</Th><Th align="center">BBB</Th><Th align="right">Score</Th><Th align="right">Complaints</Th><Th align="right">Reviews</Th><Th align="right">Projects</Th><Th>Quality</Th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company_id} className="hover:bg-slate-50/70">
                  <Td><Link href={`/contractors/${r.company_id}`} className="font-medium text-brand-600 hover:underline">{r.name}</Link>{r.is_accredited && <Badge tone="green" className="ml-1.5">Accredited</Badge>}</Td>
                  <Td><span className="text-xs">{r.category ?? "—"}</span></Td>
                  <Td align="center">{r.rating ? <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", bbbColor(r.rating))}>{r.rating}</span> : <span className="text-slate-300">—</span>}</Td>
                  <Td align="right">{r.score ?? "—"}</Td>
                  <Td align="right">{r.complaints > 0 ? <span className={r.complaints >= 5 ? "font-semibold text-red-600" : ""}>{r.complaints}</span> : "0"}</Td>
                  <Td align="right">{r.reviews ? `${r.reviews}★` : "—"}</Td>
                  <Td align="right">{fmtNum(r.projects)}</Td>
                  <Td>{r.score_band ? <span className={cn("text-xs font-medium", scoreBandColor(r.score_band))}>{r.score_band}</span> : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
