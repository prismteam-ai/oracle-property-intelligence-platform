import Link from "next/link";
import { Briefcase, Layers, Search } from "lucide-react";
import { listBusinesses, getBusinessFacets } from "@/lib/queries";
import {
  PageHeader, Card, Kpi, Table, Th, Td, Badge, EmptyState, Provenance,
} from "@/components/ui";
import { fmtDate, fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Map a Sunbiz registration status to a Badge tone. */
function statusTone(status?: string | null): "green" | "slate" | "red" | "amber" {
  const s = (status ?? "").toUpperCase();
  if (s === "ACTIVE") return "green";
  if (s.includes("DISSOLV") || s === "INACTIVE" || s.includes("REVOK")) return "red";
  if (s.includes("INACT") || s.includes("DELINQ")) return "amber";
  return "slate";
}

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const status = sp.status ?? "";
  const multi = sp.multi === "1";
  const sort = sp.sort ?? "locations";

  const [rows, facets] = await Promise.all([
    listBusinesses({ q: q || undefined, status: status || undefined, multiOnly: multi, sort }),
    getBusinessFacets(),
  ]);

  const total = rows.length;
  const multiCount = rows.filter((r: any) => (r.locations ?? 0) > 1).length;
  const activeCount = rows.filter((r: any) => (r.active ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explore entities"
        title="Businesses"
        subtitle="Sunbiz-registered business entities across Lee County — reconciled against permit and occupancy records, with citations back to the Florida Division of Corporations."
        actions={<Provenance source="fl-sunbiz" url="https://search.sunbiz.org" />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Kpi label="Businesses shown" value={fmtNum(total)} tone="brand" icon={<Briefcase className="h-4 w-4" />} />
        <Kpi label="Multi-location" value={fmtNum(multiCount)} sub="More than one property" tone="accent" icon={<Layers className="h-4 w-4" />} />
        <Kpi label="Currently active" value={fmtNum(activeCount)} sub="With a current occupancy" />
      </div>

      <Card className="p-4">
        <BusinessFilters q={q} status={status} multi={multi} sort={sort} statuses={facets.statuses} />
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">
            {fmtNum(total)} business{total === 1 ? "" : "es"}
          </h3>
          <span className="text-xs text-slate-500">Source: FL Sunbiz</span>
        </div>
        {total === 0 ? (
          <div className="p-4">
            <EmptyState title="No businesses match" hint="Try clearing filters or a broader name search." />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Business</Th>
                <Th>Entity type</Th>
                <Th>Status</Th>
                <Th align="right">Locations</Th>
                <Th align="right">Active</Th>
                <Th>Filed</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.company_id} className="group hover:bg-slate-50/70">
                  <Td>
                    <Link href={`/businesses/${r.company_id}`} className="font-medium text-brand-600 hover:underline">
                      {r.name}
                    </Link>
                    {(r.locations ?? 0) > 1 && (
                      <Badge tone="violet" className="ml-2 align-middle">Multi-location</Badge>
                    )}
                  </Td>
                  <Td className="text-slate-600">{r.filing_type ?? <span className="text-slate-300">—</span>}</Td>
                  <Td>
                    {r.status ? <Badge tone={statusTone(r.status)} dot>{r.status}</Badge> : <span className="text-slate-300">—</span>}
                  </Td>
                  <Td align="right">{fmtNum(r.locations)}</Td>
                  <Td align="right">{fmtNum(r.active)}</Td>
                  <Td>{fmtDate(r.filed_date)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/** Server-rendered GET filter bar — params map directly to searchParams. */
function BusinessFilters({
  q, status, multi, sort, statuses,
}: { q: string; status: string; multi: boolean; sort: string; statuses: string[] }) {
  const inputCls =
    "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-300";
  return (
    <form method="GET" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-1 min-w-[220px] flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Search name</span>
        <span className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 focus-within:border-brand-300">
          <Search className="h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Business name…" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400" />
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Status</span>
        <select name="status" defaultValue={status} className={inputCls}>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Sort by</span>
        <select name="sort" defaultValue={sort} className={inputCls}>
          <option value="locations">Most locations</option>
          <option value="name">Name (A–Z)</option>
          <option value="filed">Most recently filed</option>
        </select>
      </label>

      <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-700">
        <input type="checkbox" name="multi" value="1" defaultChecked={multi} className="h-4 w-4 rounded border-line accent-brand-600" />
        Multi-location only
      </label>

      <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
        Apply
      </button>
    </form>
  );
}
