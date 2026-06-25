import Link from "next/link";
import { ExternalLink, ShieldCheck, AlertTriangle, Star } from "lucide-react";
import { Card, SectionTitle, Badge, Table, Th, Td, BackLink, Field, Provenance, StatusDot, EmptyState } from "@/components/ui";
import { HBars } from "@/components/charts";
import {
  getContractor, getContractorPermits, getContractorTypeBreakdown, getContractorComplaints, getContractorReviews,
} from "@/lib/queries";
import { fmtUsd, fmtNum, fmtDate, bbbColor, scoreBandColor, permitColor, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContractorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getContractor(id);
  if (!c) return <Card className="p-8"><EmptyState title="Contractor not found" /></Card>;

  const [permits, breakdown, complaints, reviews] = await Promise.all([
    getContractorPermits(id), getContractorTypeBreakdown(id), getContractorComplaints(id), getContractorReviews(id),
  ]) as any[];

  // contractor → property relationships (distinct)
  const propsMap = new Map<string, any>();
  for (const p of permits) if (p.property_id && !propsMap.has(p.property_id)) propsMap.set(p.property_id, p);
  const properties = [...propsMap.values()];
  const negative = ["C+", "C", "C-", "D+", "D", "D-", "F", "NR"].includes(c.bbb_rating);

  return (
    <div className="space-y-5">
      <BackLink href="/contractors">Contractors</BackLink>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{c.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {c.primary_category && <Badge tone="slate">{c.primary_category}</Badge>}
              {c.is_accredited && <Badge tone="green" dot><ShieldCheck className="h-3 w-3" /> BBB Accredited</Badge>}
              {negative && <Badge tone="red" dot><AlertTriangle className="h-3 w-3" /> Reputation risk</Badge>}
              {c.years_in_business != null && <span className="text-xs text-slate-400">{c.years_in_business} years in business</span>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {c.bbb_rating && (
              <div className="text-center">
                <div className={cn("rounded-lg border px-3 py-1.5 text-xl font-bold", bbbColor(c.bbb_rating))}>{c.bbb_rating}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">BBB rating</div>
              </div>
            )}
            {c.quality_score != null && (
              <div className="text-center">
                <div className={cn("text-2xl font-bold tabular", scoreBandColor(c.score_band))}>{Math.round(c.quality_score)}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{c.score_band}</div>
              </div>
            )}
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3 xl:grid-cols-6">
          <Field label="Permitted projects">{fmtNum(c.projects)}</Field>
          <Field label="Major renovations">{fmtNum(c.major_projects)}</Field>
          <Field label="Complaints"><span className={c.complaint_count >= 5 ? "font-semibold text-red-600" : ""}>{c.complaint_count ?? 0}</span></Field>
          <Field label="Reviews">{c.review_count ?? 0} · {c.review_average_rating ?? "—"}★</Field>
          <Field label="Reputation score">{c.rating_score ?? "—"}</Field>
          <Field label="Source">{c.bbb_url ? <Provenance source="bbb" url={c.bbb_url} compact /> : <span className="text-xs text-slate-400">No BBB profile</span>}</Field>
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <SectionTitle title="Project & permit history" subtitle={`${permits.length} permits on record`} action={<Provenance source="lee-county-accela" compact />} />
            {permits.length === 0 ? <EmptyState title="No permits on record" /> : (
              <Table>
                <thead><tr><Th>Permit</Th><Th>Type</Th><Th>Status</Th><Th align="right">Issued</Th><Th align="right">Value</Th><Th>Property</Th></tr></thead>
                <tbody>
                  {permits.slice(0, 40).map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <Td className="font-mono text-[11px]">{p.permit_number}{p.is_major_renovation && <Badge tone="orange" className="ml-1">major</Badge>}</Td>
                      <Td><span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: permitColor(p.type).color, background: permitColor(p.type).bg }}>{p.type}</span></Td>
                      <Td><span className="inline-flex items-center gap-1.5 text-xs"><StatusDot open={p.is_open} />{p.is_open ? "Open" : "Closed"}</span></Td>
                      <Td align="right">{fmtDate(p.issued)}</Td>
                      <Td align="right">{fmtUsd(p.value)}</Td>
                      <Td>{p.property_id ? <Link href={`/properties/${p.property_id}`} className="text-brand-600 hover:underline">{p.address}</Link> : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            {permits.length > 40 && <div className="mt-2 text-xs text-slate-400">Showing 40 of {permits.length}.</div>}
          </Card>

          {complaints.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="BBB complaints" subtitle={`${complaints.length} on file`} action={<Provenance source="bbb" compact />} />
              <div className="space-y-2.5">
                {complaints.slice(0, 12).map((co: any, i: number) => (
                  <div key={i} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="red">{co.complaint_type}</Badge>
                        <span className="text-[11px] text-slate-400">{co.complaint_category}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{fmtDate(co.complaint_date)}</span>
                        <Badge tone={co.complaint_status === "Resolved" ? "green" : co.complaint_status === "Unanswered" ? "red" : "amber"}>{co.complaint_status}</Badge>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[13px] text-slate-600">{co.complaint_summary}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle title="Work mix" subtitle="Permits by category" />
            <HBars data={(breakdown as any[]).map((b) => ({ label: b.label, value: b.value, color: permitColor(b.label).color }))} />
          </Card>

          <Card className="p-5">
            <SectionTitle title="Properties worked on" subtitle={`${properties.length} distinct properties`} />
            {properties.length === 0 ? <EmptyState title="None" /> : (
              <div className="space-y-2">
                {properties.slice(0, 10).map((p: any) => (
                  <Link key={p.property_id} href={`/properties/${p.property_id}`} className="block truncate text-sm text-brand-600 hover:underline">
                    {p.address}<span className="text-[11px] text-slate-400"> · {p.city}</span>
                  </Link>
                ))}
                {properties.length > 10 && <div className="text-xs text-slate-400">+{properties.length - 10} more</div>}
              </div>
            )}
          </Card>

          {reviews.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="Recent reviews" />
              <div className="space-y-3">
                {reviews.slice(0, 6).map((r: any, i: number) => (
                  <div key={i} className="border-b border-line/60 pb-2.5 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink">{r.review_title}</span>
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-500"><Star className="h-3 w-3 fill-current" />{r.review_rating}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-slate-500">{r.review_text}</p>
                    <div className="mt-0.5 text-[10px] text-slate-400">{r.reviewer_display_name} · {fmtDate(r.review_date)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
