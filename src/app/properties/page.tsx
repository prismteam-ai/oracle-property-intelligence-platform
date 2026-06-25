import Link from "next/link";
import { Card, PageHeader, Table, Th, Td, Badge, Bar, EmptyState } from "@/components/ui";
import { listProperties, getPropertyFacets } from "@/lib/queries";
import { fmtUsd, fmtNum, permitColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { cities, usages } = await getPropertyFacets();
  const rows = await listProperties({
    city: sp.city, usage: sp.usage, q: sp.q, sort: sp.sort, openOnly: sp.open === "1", limit: 80,
  }) as any[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Explore entities"
        title="Properties"
        subtitle="Every parcel in the loaded dataset, with ownership, permit, contractor, and occupancy signals reconciled across sources."
      />

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Filter label="Search">
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Address or STRAP…" className="w-56 rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-300" />
          </Filter>
          <Filter label="City">
            <Select name="city" value={sp.city} options={cities} />
          </Filter>
          <Filter label="Use">
            <Select name="usage" value={sp.usage} options={usages} />
          </Filter>
          <Filter label="Sort">
            <select name="sort" defaultValue={sp.sort ?? "score"} className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-300">
              <option value="score">Improvement score</option>
              <option value="open">Open permits</option>
              <option value="permits">Permits (5y)</option>
              <option value="value">Market value</option>
            </select>
          </Filter>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" name="open" value="1" defaultChecked={sp.open === "1"} className="h-4 w-4 rounded border-line" /> Open permits only
          </label>
          <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
          <Link href="/properties" className="text-sm text-slate-500 hover:text-brand-600">Reset</Link>
        </form>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">{rows.length} properties</span>
        </div>
        {rows.length === 0 ? <div className="p-4"><EmptyState title="No properties match" /></div> : (
          <Table>
            <thead>
              <tr>
                <Th>Property</Th><Th>City</Th><Th>Use</Th><Th align="right">Built</Th>
                <Th align="right">Value</Th><Th align="center">Open</Th><Th align="right">Major</Th><Th>Improvement</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.property_id} className="hover:bg-slate-50/70">
                  <Td>
                    <Link href={`/properties/${r.property_id}`} className="font-medium text-brand-600 hover:underline">{r.address}</Link>
                    <div className="text-[11px] text-slate-400">STRAP {r.strap}</div>
                  </Td>
                  <Td>{r.city}</Td>
                  <Td><span className="text-xs">{r.usage}</span></Td>
                  <Td align="right">{r.built}</Td>
                  <Td align="right">{fmtUsd(r.value)}</Td>
                  <Td align="center">{r.open_permits > 0 ? <Badge tone="amber">{r.open_permits}</Badge> : <span className="text-slate-300">0</span>}</Td>
                  <Td align="right">{r.major_renos}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-20"><Bar value={r.score} max={100} tone={r.score >= 60 ? "amber" : "brand"} /></div>
                      <span className="text-xs tabular text-slate-500">{r.score}</span>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</label>
      {children}
    </div>
  );
}
function Select({ name, value, options }: { name: string; value?: string; options: string[] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="rounded-lg border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-300">
      <option value="">All</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
