import Link from "next/link";
import { Building2, FileText, MapPin, Users, Hammer } from "lucide-react";
import {
  getBusiness, getBusinessParties, getBusinessLocations, getBusinessRelatedPermits,
} from "@/lib/queries";
import {
  Card, SectionTitle, Badge, StatusDot, Table, Th, Td, EmptyState, Provenance, BackLink, Field,
} from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusTone(status?: string | null): "green" | "slate" | "red" | "amber" {
  const s = (status ?? "").toUpperCase();
  if (s === "ACTIVE") return "green";
  if (s.includes("DISSOLV") || s === "INACTIVE" || s.includes("REVOK")) return "red";
  if (s.includes("INACT") || s.includes("DELINQ")) return "amber";
  return "slate";
}

/** Party role → tone. */
function roleTone(role?: string | null): "brand" | "teal" | "slate" {
  const r = (role ?? "").toLowerCase();
  if (r.includes("agent")) return "brand";
  if (r.includes("manager") || r.includes("president") || r.includes("officer") || r.includes("director")) return "teal";
  return "slate";
}

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [biz, parties, locations, permits] = await Promise.all([
    getBusiness(id),
    getBusinessParties(id),
    getBusinessLocations(id),
    getBusinessRelatedPermits(id),
  ]);

  if (!biz) {
    return (
      <div className="space-y-6">
        <BackLink href="/businesses">Back to businesses</BackLink>
        <Card className="p-6">
          <EmptyState title="Business not found" hint="This company id has no registration record in the dataset." />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/businesses">Back to businesses</BackLink>
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-400">
                <Building2 className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">Business entity</span>
              </div>
              <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">{biz.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {biz.filing_type && <Badge tone="slate">{biz.filing_type}</Badge>}
                {biz.status && <Badge tone={statusTone(biz.status)} dot>{biz.status}</Badge>}
                {(locations?.length ?? 0) > 1 && <Badge tone="violet">Multi-location</Badge>}
              </div>
            </div>
            <Provenance source="fl-sunbiz" url={biz.source_url} recordKey={biz.document_number} retrievedAt={biz.retrieved_at} />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-3 lg:grid-cols-5">
            <Field label="Document #">{biz.document_number ?? "—"}</Field>
            <Field label="FEI / EIN">{biz.fei_number ?? "—"}</Field>
            <Field label="Filed">{fmtDate(biz.filed_date)}</Field>
            <Field label="Principal address">{biz.principal_address ?? "—"}</Field>
            <Field label="Last transaction">{fmtDate(biz.last_transaction_date)}</Field>
          </dl>
        </Card>
      </div>

      {/* Business registration */}
      <Card className="p-5">
        <SectionTitle
          title="Business registration"
          subtitle="Florida Division of Corporations (Sunbiz) filing"
          action={<Provenance source="fl-sunbiz" url={biz.source_url} recordKey={biz.document_number} compact />}
        />
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Entity name">{biz.entity_name ?? biz.name}</Field>
          <Field label="Filing type">{biz.filing_type ?? "—"}</Field>
          <Field label="Status">
            {biz.status ? <Badge tone={statusTone(biz.status)} dot>{biz.status}</Badge> : "—"}
          </Field>
          <Field label="Document number">{biz.document_number ?? "—"}</Field>
          <Field label="FEI / EIN number">{biz.fei_number ?? "—"}</Field>
          <Field label="Date filed">{fmtDate(biz.filed_date)}</Field>
          <Field label="Last transaction">{fmtDate(biz.last_transaction_date)}</Field>
          <Field label="Principal address">{biz.principal_address ?? "—"}</Field>
        </dl>
      </Card>

      {/* Business ownership / officers */}
      <Card className="p-5">
        <SectionTitle
          title="Ownership & officers"
          subtitle="Registered agents, managers, and officers on the Sunbiz filing"
          action={<span className="inline-flex items-center gap-1 text-xs text-slate-400"><Users className="h-3.5 w-3.5" />{parties.length} part{parties.length === 1 ? "y" : "ies"}</span>}
        />
        {parties.length === 0 ? (
          <EmptyState title="No officers on file" hint="The Sunbiz filing lists no parties for this entity." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Role</Th>
                <Th>Name</Th>
                <Th>Title</Th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/70">
                  <Td><Badge tone={roleTone(p.party_role)}>{p.party_role}</Badge></Td>
                  <Td className="font-medium text-ink">{p.name}</Td>
                  <Td className="text-slate-600">{p.title ?? <span className="text-slate-300">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Business locations / related properties */}
      <Card className="p-5">
        <SectionTitle
          title="Locations & related properties"
          subtitle="Properties this business occupies — reconciled occupancy records"
          action={<Provenance source="oracle-derived-occupancy" compact />}
        />
        {locations.length === 0 ? (
          <EmptyState title="No locations recorded" hint="No occupancy records link this business to a property." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Address</Th>
                <Th>City</Th>
                <Th>Use</Th>
                <Th>Space / suite</Th>
                <Th>Start</Th>
                <Th>End</Th>
                <Th align="center">Current</Th>
              </tr>
            </thead>
            <tbody>
              {locations.map((l: any) => (
                <tr key={l.occupancy_id} className="hover:bg-slate-50/70">
                  <Td>
                    <Link href={`/properties/${l.property_id}`} className="flex items-center gap-1.5 font-medium text-brand-600 hover:underline">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {l.address}
                    </Link>
                  </Td>
                  <Td className="text-slate-600">{l.city ?? <span className="text-slate-300">—</span>}</Td>
                  <Td className="text-slate-600">{l.usage ?? <span className="text-slate-300">—</span>}</Td>
                  <Td className="text-slate-600">{l.space_name ?? <span className="text-slate-300">—</span>}</Td>
                  <Td>{fmtDate(l.start_date)}</Td>
                  <Td>{l.end_date ? fmtDate(l.end_date) : <span className="text-slate-300">—</span>}</Td>
                  <Td align="center">
                    {l.is_current
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><StatusDot open={false} />Current</span>
                      : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><StatusDot open />Past</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Related permits & projects */}
      <Card className="p-5">
        <SectionTitle
          title="Related permits & projects"
          subtitle="Permits at properties this business occupies"
          action={<span className="inline-flex items-center gap-1 text-xs text-slate-400"><Hammer className="h-3.5 w-3.5" />{permits.length}</span>}
        />
        {permits.length === 0 ? (
          <EmptyState title="No related permits" hint="No permit activity recorded at this business's properties." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Permit #</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Issued</Th>
                <Th>Property</Th>
              </tr>
            </thead>
            <tbody>
              {permits.map((p: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/70">
                  <Td className="font-medium text-ink">
                    <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" />{p.permit_number ?? "—"}</span>
                  </Td>
                  <Td className="text-slate-600">{p.type ?? <span className="text-slate-300">—</span>}</Td>
                  <Td>{p.status ? <Badge tone="slate">{p.status}</Badge> : <span className="text-slate-300">—</span>}</Td>
                  <Td>{fmtDate(p.issued)}</Td>
                  <Td>
                    <Link href={`/properties/${p.property_id}`} className="text-brand-600 hover:underline">
                      {p.address ?? "View property"}
                    </Link>
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
