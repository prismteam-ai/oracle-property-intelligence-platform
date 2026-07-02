import Link from "next/link";
import { notFound } from "next/navigation";

import { Citations } from "@/components/Citations";
import { PermitTable, PropertyLink } from "@/components/PermitTable";
import { Empty, Field, Section } from "@/components/ui";
import { buildCitations } from "@/lib/provenance";
import { data } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await data.getTenantDetail(id);
  if (!detail) notFound();

  const { tenant, occupancies, properties, businesses, permits, projects } = detail;

  return (
    <div data-testid="tenant-detail">
      <div className="breadcrumb">
        <Link href="/tenants">Tenants</Link> / {tenant.tenantName}
      </div>
      <h1 data-testid="tenant-title">{tenant.tenantName ?? "Tenant"}</h1>
      <p className="muted">
        {tenant.tenantType ?? "tenant"} · matched via {tenant.matchMethod ?? "—"} (
        {tenant.matchConfidence ?? "—"})
      </p>

      {/* Occupancy history (AC #25) */}
      <Section title="Occupancy history" count={occupancies.length} testid="tenant-occupancy">
        {occupancies.length ? (
          <table data-testid="tenant-occupancy-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {occupancies.map((o, i) => (
                <tr key={o.occupancyId ?? i} data-testid="tenant-occupancy-row">
                  <td>{o.occupancyType ?? "—"}</td>
                  <td>{o.occupancyStatus ?? "—"}</td>
                  <td>{o.startDate ?? "—"}</td>
                  <td>{o.endDate ?? "present"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No occupancy records.</Empty>
        )}
      </Section>

      <Section
        title="Property relationships"
        count={properties.length}
        testid="tenant-properties"
      >
        {properties.length ? (
          <table data-testid="tenant-properties-table">
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
                <tr key={p.propertyId} data-testid="tenant-property-row">
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
          <Empty>No linked properties.</Empty>
        )}
      </Section>

      {/* Tenant-associated businesses (AC #27) */}
      <Section
        title="Associated businesses"
        count={businesses.length}
        testid="tenant-businesses"
      >
        {businesses.length ? (
          <table data-testid="tenant-businesses-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Status</th>
                <th>Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b, i) => (
                <tr key={b.businessRegistrationId ?? i} data-testid="tenant-business-row">
                  <td>
                    {b.documentNumber ? (
                      <Link href={`/businesses/${b.documentNumber}`}>
                        {b.entityName ?? b.documentNumber}
                      </Link>
                    ) : (
                      b.entityName ?? "—"
                    )}
                  </td>
                  <td>{b.status ?? "—"}</td>
                  <td>{b.occupancyStatus ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No associated businesses (residential tenant).</Empty>
        )}
      </Section>

      {/* Tenant-associated permits & projects (AC #28, #29) */}
      <Section title="Associated permits" count={permits.length} testid="tenant-permits">
        <PermitTable permits={permits.slice(0, 50)} testid="tenant-permits-table" />
      </Section>

      <Section title="Associated projects" count={projects.length} testid="tenant-projects">
        {projects.length ? (
          <ul>
            {projects.slice(0, 25).map((p, i) => (
              <li key={p.projectId ?? i}>
                {p.projectName} — {p.projectStatus ?? "—"}, {p.permitCount ?? 0} permit(s)
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No associated projects.</Empty>
        )}
      </Section>

      <Section title="Identity & provenance" testid="tenant-provenance">
        <Field label="Tenant type" value={tenant.tenantType} />
        <Field label="Match method" value={tenant.matchMethod} />
        <Field label="Match confidence" value={tenant.matchConfidence} />
        <Citations items={buildCitations([tenant])} />
      </Section>
    </div>
  );
}
