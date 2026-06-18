import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { Card, SectionTitle, Badge, Table, Th, Td, BackLink, Field, Provenance, StatusDot, EmptyState } from "@/components/ui";
import {
  getProperty, getPropertyOwnership, getPropertySales, getPropertyPermits,
  getPropertyContractors, getPropertyOccupancies,
} from "@/lib/queries";
import { fmtUsd, fmtNum, fmtDate, permitColor, bbbColor, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prop = await getProperty(id);
  if (!prop) return <Card className="p-8"><EmptyState title="Property not found" /></Card>;

  const [ownership, sales, permits, contractors, occupancies] = await Promise.all([
    getPropertyOwnership(id), getPropertySales(id), getPropertyPermits(id),
    getPropertyContractors(id), getPropertyOccupancies(id),
  ]) as any[];

  const openPermits = permits.filter((p: any) => p.is_open);
  const majorPermits = permits.filter((p: any) => p.is_major_renovation);
  const currentOwner = ownership.find((o: any) => o.is_current);
  const currentTenants = occupancies.filter((o: any) => o.is_current);

  return (
    <div className="space-y-5">
      <BackLink href="/properties">Properties</BackLink>

      {/* hero */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-slate-400"><MapPin className="h-4 w-4" /><span className="text-xs">{prop.city}, FL {prop.zip}</span></div>
            <h1 className="mt-1 text-2xl font-semibold text-ink">{prop.address}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={prop.property_type === "Commercial" ? "violet" : "blue"}>{prop.property_type}</Badge>
              <Badge tone="slate">{prop.property_usage_type}</Badge>
              <Badge tone="slate">Zoning {prop.zoning}</Badge>
              <Badge tone="slate">Built {prop.property_structure_built_year}</Badge>
              <span className="text-xs text-slate-400">· {prop.neighborhood}</span>
            </div>
          </div>
          <div className="text-right">
            <Provenance source="lee-county-property-appraiser" url={prop.appraiser_url} recordKey={prop.strap} />
            <div className="mt-2 text-[11px] text-slate-400">STRAP {prop.strap}</div>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4 xl:grid-cols-8">
          <Field label="Market value">{fmtUsd(prop.market_value_amount)}</Field>
          <Field label="Assessed">{fmtUsd(prop.assessed_value_amount)}</Field>
          <Field label="Living area">{fmtNum(prop.livable_floor_area_sqft)} sf</Field>
          <Field label="Units">{prop.number_of_units}</Field>
          <Field label="Open permits"><span className={prop.open_permit_count > 0 ? "text-amber-600 font-semibold" : ""}>{prop.open_permit_count}</span></Field>
          <Field label="Major renos">{prop.major_renovation_count}</Field>
          <Field label="Permits (5y)">{prop.permit_count_5y}</Field>
          <Field label="Improvement">{prop.improvement_score}/100</Field>
        </dl>
      </Card>

      {/* open permits highlight */}
      {openPermits.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40 p-5">
          <SectionTitle title={`${openPermits.length} open permit${openPermits.length === 1 ? "" : "s"}`} subtitle="Active work currently on record" />
          <div className="flex flex-wrap gap-2">
            {openPermits.map((p: any) => (
              <a key={p.id} href={p.source_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs hover:border-amber-400">
                <span className="rounded px-1.5 py-0.5 font-medium" style={{ color: permitColor(p.type).color, background: permitColor(p.type).bg }}>{p.type}</span>
                <span className="font-mono text-[11px] text-slate-500">{p.permit_number}</span>
                <span className="text-slate-400">{p.source_status}</span>
                <ExternalLink className="h-3 w-3 text-slate-300" />
              </a>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <SectionTitle title="Permit history" subtitle={`${permits.length} permits · ${majorPermits.length} major renovations`} action={<Provenance source="lee-county-accela" compact />} />
            {permits.length === 0 ? <EmptyState title="No permits on record" /> : (
              <Table>
                <thead><tr><Th>Permit</Th><Th>Type</Th><Th>Status</Th><Th align="right">Issued</Th><Th align="right">Value</Th><Th>Contractor</Th></tr></thead>
                <tbody>
                  {permits.slice(0, 40).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <Td>
                        <a href={p.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-600 hover:underline">
                          {p.permit_number}<ExternalLink className="h-2.5 w-2.5" />
                        </a>
                        {p.is_major_renovation && <Badge tone="orange" className="ml-1">major</Badge>}
                      </Td>
                      <Td><span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: permitColor(p.type).color, background: permitColor(p.type).bg }}>{p.type}</span></Td>
                      <Td><span className="inline-flex items-center gap-1.5 text-xs"><StatusDot open={p.is_open} />{p.is_open ? "Open" : p.source_status}</span></Td>
                      <Td align="right">{fmtDate(p.issued)}</Td>
                      <Td align="right">{fmtUsd(p.value)}</Td>
                      <Td>{p.contractor ? <Link href={`/contractors/${p.contractor_id}`} className="text-brand-600 hover:underline">{p.contractor}</Link> : <span className="text-slate-400">Owner / Builder</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {permits.length > 40 && <div className="mt-2 text-xs text-slate-400">Showing 40 of {permits.length} permits.</div>}
          </Card>

          {majorPermits.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="Major improvement activity" subtitle="Roofing, electrical, concrete, structural, plumbing & HVAC work" />
              <Table>
                <thead><tr><Th>Type</Th><Th>Description</Th><Th align="right">Job value</Th><Th align="right">Completed</Th></tr></thead>
                <tbody>
                  {majorPermits.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <Td><span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: permitColor(p.type).color, background: permitColor(p.type).bg }}>{p.type}</span></Td>
                      <Td className="max-w-md text-xs">{p.description}</Td>
                      <Td align="right">{fmtUsd(p.value)}</Td>
                      <Td align="right">{fmtDate(p.closed)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          <Card className="p-5">
            <SectionTitle title="Sales history" subtitle="Deeds & transfers" action={<Provenance source="lee-county-property-appraiser" compact />} />
            {sales.length === 0 ? <EmptyState title="No sales on record" /> : (
              <Table>
                <thead><tr><Th>Date</Th><Th align="right">Price</Th><Th>Instrument</Th><Th>Deed</Th></tr></thead>
                <tbody>
                  {sales.map((s: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <Td>{fmtDate(s.date)}</Td><Td align="right">{fmtUsd(s.price)}</Td>
                      <Td><span className="text-xs">{s.sale_type}</span><div className="font-mono text-[10px] text-slate-400">{s.instrument_number}</div></Td>
                      <Td className="text-xs text-slate-500">Bk {s.deed_book} / Pg {s.deed_page}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {/* side column */}
        <div className="space-y-5">
          {/* relationships */}
          <Card className="p-5">
            <SectionTitle title="Connected entities" subtitle="Property relationship graph" />
            <div className="space-y-2.5 text-sm">
              <Rel label="Current owner" value={currentOwner?.owner_name} href={currentOwner?.owner_company_id ? `/businesses/${currentOwner.owner_company_id}` : undefined} />
              <Rel label="Top contractor" value={contractors[0]?.name} href={contractors[0] ? `/contractors/${contractors[0].company_id}` : undefined} sub={contractors[0]?.bbb_rating ? `BBB ${contractors[0].bbb_rating}` : undefined} />
              <Rel label="Current tenant" value={currentTenants[0]?.business} href={currentTenants[0] ? `/businesses/${currentTenants[0].company_id}` : undefined} />
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">Contractors · Tenants</span>
                <span className="text-xs font-medium tabular text-ink">{contractors.length} · {occupancies.length}</span>
              </div>
            </div>
          </Card>

          {/* ownership history */}
          <Card className="p-5">
            <SectionTitle title="Ownership history" action={<Provenance source="lee-county-property-appraiser" compact />} />
            <div className="space-y-2.5">
              {ownership.map((o: any) => (
                <div key={o.ownership_id} className="flex items-start justify-between gap-2 border-b border-line/60 pb-2.5 last:border-0">
                  <div>
                    {o.owner_company_id ? <Link href={`/businesses/${o.owner_company_id}`} className="text-sm font-medium text-brand-600 hover:underline">{o.owner_name}</Link> : <span className="text-sm font-medium text-ink">{o.owner_name}</span>}
                    <div className="text-[11px] text-slate-400">{o.owned_by === "company" ? "Entity" : "Individual"}{o.owner_occupied_indicator ? " · owner-occupied" : ""}</div>
                  </div>
                  <div className="text-right">
                    {o.is_current ? <Badge tone="green">Current</Badge> : <Badge tone="slate">Prior</Badge>}
                    <div className="mt-0.5 text-[10px] text-slate-400">{fmtDate(o.date_acquired)}{o.date_sold ? ` – ${fmtDate(o.date_sold)}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* occupancy / tenants */}
          <Card className="p-5">
            <SectionTitle title="Business occupancy & tenants" action={<Provenance source="oracle-derived-occupancy" compact />} />
            {occupancies.length === 0 ? <EmptyState title="No occupancy records" /> : (
              <div className="space-y-2.5">
                {occupancies.map((o: any) => (
                  <div key={o.occupancy_id} className="flex items-start justify-between gap-2 border-b border-line/60 pb-2.5 last:border-0">
                    <div>
                      <Link href={`/businesses/${o.company_id}`} className="text-sm font-medium text-brand-600 hover:underline">{o.business}</Link>
                      <div className="text-[11px] text-slate-400">{o.space_name ?? "—"}{o.filing_type ? ` · ${o.filing_type}` : ""}</div>
                    </div>
                    <div className="text-right">
                      {o.is_current ? <Badge tone="green">Current</Badge> : <Badge tone="slate">Past</Badge>}
                      <div className="mt-0.5 text-[10px] text-slate-400">{fmtDate(o.start_date)}{o.end_date ? ` – ${fmtDate(o.end_date)}` : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* contractor activity */}
          <Card className="p-5">
            <SectionTitle title="Contractor activity" />
            {contractors.length === 0 ? <EmptyState title="No contractors on record" /> : (
              <div className="space-y-2.5">
                {contractors.map((c: any) => (
                  <div key={c.company_id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/contractors/${c.company_id}`} className="block truncate text-sm font-medium text-brand-600 hover:underline">{c.name}</Link>
                      <div className="text-[11px] text-slate-400">{c.projects} project{c.projects === 1 ? "" : "s"} · last {fmtDate(c.last_project)}</div>
                    </div>
                    {c.bbb_rating && <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold", bbbColor(c.bbb_rating))}>{c.bbb_rating}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Rel({ label, value, href, sub }: { label: string; value?: string; href?: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="text-right">
        {value ? (href ? <Link href={href} className="text-sm font-medium text-brand-600 hover:underline">{value}</Link> : <span className="text-sm font-medium text-ink">{value}</span>) : <span className="text-sm text-slate-300">—</span>}
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}
