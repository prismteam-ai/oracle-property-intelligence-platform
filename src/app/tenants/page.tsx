import Link from "next/link";
import { Store, Layers, Search } from "lucide-react";
import { listTenants } from "@/lib/queries";
import {
  PageHeader, Card, Kpi, Table, Th, Td, Badge, EmptyState, Provenance,
} from "@/components/ui";
import { fmtDate, fmtNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const multi = sp.multi === "1";
  const sort = sp.sort ?? "locations";

  const rows = await listTenants({ q: q || undefined, multiOnly: multi, sort });

  const total = rows.length;
  const multiCount = rows.filter((r: any) => (r.locations ?? 0) > 1).length;
  const activeCount = rows.filter((r: any) => (r.active ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explore entities"
        title="Tenants"
        subtitle="Businesses occupying properties across Lee County, reconciled from occupancy records. Surface multi-location operators expanding their footprint over time."
        actions={<Provenance source="oracle-derived-occupancy" />}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Kpi label="Tenants shown" value={fmtNum(total)} tone="brand" icon={<Store className="h-4 w-4" />} />
        <Kpi label="Multi-location operators" value={fmtNum(multiCount)} sub="More than one property" tone="accent" icon={<Layers className="h-4 w-4" />} />
        <Kpi label="Currently active" value={fmtNum(activeCount)} sub="With a current occupancy" />
      </div>

      <Card className="p-4">
        <TenantFilters q={q} multi={multi} sort={sort} />
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">
            {fmtNum(total)} tenant{total === 1 ? "" : "s"}
          </h3>
          <span className="text-xs text-slate-500">Occupancy reconciled by Oracle</span>
        </div>
        {total === 0 ? (
          <div className="p-4">
            <EmptyState title="No tenants match" hint="Try clearing filters or a broader name search." />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tenant</Th>
                <Th>Entity type</Th>
                <Th align="right">Locations</Th>
                <Th align="right">Active now</Th>
                <Th>First lease</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.company_id} className="group hover:bg-slate-50/70">
                  <Td>
                    <Link href={`/tenants/${r.company_id}`} className="font-medium text-brand-600 hover:underline">
                      {r.name}
                    </Link>
                    {(r.locations ?? 0) > 1 && (
                      <Badge tone="violet" className="ml-2 align-middle">Multi-location</Badge>
                    )}
                  </Td>
                  <Td className="text-slate-600">{r.filing_type ?? <span className="text-slate-300">—</span>}</Td>
                  <Td align="right">{fmtNum(r.locations)}</Td>
                  <Td align="right">{fmtNum(r.active)}</Td>
                  <Td>{fmtDate(r.since)}</Td>
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
function TenantFilters({ q, multi, sort }: { q: string; multi: boolean; sort: string }) {
  const inputCls =
    "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand-300";
  return (
    <form method="GET" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-1 min-w-[220px] flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Search name</span>
        <span className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 focus-within:border-brand-300">
          <Search className="h-4 w-4 text-slate-400" />
          <input name="q" defaultValue={q} placeholder="Tenant name…" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-slate-400" />
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Sort by</span>
        <select name="sort" defaultValue={sort} className={inputCls}>
          <option value="locations">Most locations</option>
          <option value="name">Name (A–Z)</option>
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
