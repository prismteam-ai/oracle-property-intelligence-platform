import Link from "next/link";
import { notFound } from "next/navigation";

import { Citations } from "@/components/Citations";
import { PermitTable, PropertyLink } from "@/components/PermitTable";
import { Empty, Field, Section } from "@/components/ui";
import { buildCitations } from "@/lib/provenance";
import { data } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await data.getBusinessDetail(id);
  if (!detail) notFound();

  const { business, parties, properties, permits, projects } = detail;

  return (
    <div data-testid="business-detail">
      <div className="breadcrumb">
        <Link href="/businesses">Businesses</Link> / {business.entityName}
      </div>
      <h1 data-testid="business-title">{business.entityName}</h1>
      <p className="muted">
        Doc #{business.documentNumber} · {business.status ?? "—"} · {business.filingType ?? "—"}
      </p>

      {/* Registration (AC #31) */}
      <Section title="Registration" testid="business-registration">
        <Field label="Document number" value={business.documentNumber} />
        <Field label="Status" value={business.status} />
        <Field label="Filing type" value={business.filingType} />
        <Field label="Filed date" value={business.filedDate} />
        <Field label="FEI / EIN" value={business.feiNumber} />
        <Field label="State / country" value={business.stateCountry} />
        <Field label="Last transaction" value={business.lastTransactionDate} />
      </Section>

      {/* Ownership / parties (AC #31) */}
      <Section title="Ownership & officers" count={parties.length} testid="business-parties">
        {parties.length ? (
          <table data-testid="parties-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p, i) => (
                <tr key={p.businessRegistrationPartyId ?? i} data-testid="party-row">
                  <td>{p.name}</td>
                  <td>{p.partyRole}</td>
                  <td>{p.title ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No officers / parties on file.</Empty>
        )}
      </Section>

      <Section
        title="Locations & related properties"
        count={properties.length}
        testid="business-properties"
      >
        {properties.length ? (
          <table data-testid="business-properties-table">
            <thead>
              <tr>
                <th>Parcel</th>
                <th>Subdivision</th>
                <th>Municipality</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.propertyId} data-testid="business-property-row">
                  <td>
                    <PropertyLink propertyId={p.propertyId} label={p.parcelIdentifier} />
                  </td>
                  <td>{p.subdivision ?? "—"}</td>
                  <td>{p.municipalityName ?? "—"}</td>
                  <td>{p.propertyUsageType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No reconciled locations.</Empty>
        )}
      </Section>

      {/* Related permits (AC #34) */}
      <Section title="Related permits" count={permits.length} testid="business-permits">
        <PermitTable permits={permits.slice(0, 50)} testid="business-permits-table" />
      </Section>

      {/* Related projects (AC #34) */}
      <Section title="Related projects" count={projects.length} testid="business-projects">
        {projects.length ? (
          <ul>
            {projects.slice(0, 25).map((p, i) => (
              <li key={p.projectId ?? i}>
                {p.projectName} — {p.projectStatus ?? "—"}, {p.permitCount ?? 0} permit(s)
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No related projects.</Empty>
        )}
      </Section>

      <Section title="Provenance" testid="business-provenance">
        <Citations items={buildCitations([business])} />
      </Section>
    </div>
  );
}
