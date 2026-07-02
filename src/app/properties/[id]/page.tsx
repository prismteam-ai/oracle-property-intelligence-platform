import Link from "next/link";
import { notFound } from "next/navigation";

import { Citations } from "@/components/Citations";
import { PermitTable } from "@/components/PermitTable";
import { Empty, Field, Section, Stat } from "@/components/ui";
import { buildCitations } from "@/lib/provenance";
import { data } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await data.getPropertyDetail(id);
  if (!detail) notFound();

  const {
    property,
    ownershipHistory,
    salesHistory,
    permits,
    openPermits,
    majorImprovements,
    contractorActivity,
    businesses,
    occupancies,
    projects,
    rollup,
  } = detail;

  const citationRows = [
    property,
    ...permits.slice(0, 5),
    ...ownershipHistory.slice(0, 3),
  ];

  return (
    <div data-testid="property-detail">
      <div className="breadcrumb">
        <Link href="/properties">Properties</Link> / {property.parcelIdentifier}
      </div>
      <h1 data-testid="property-title">Property {property.parcelIdentifier}</h1>
      <p className="muted">
        {property.propertyType ?? "property"} · {property.propertyUsageType ?? "—"} ·{" "}
        {property.subdivision ?? "—"} · built {property.propertyStructureBuiltYear ?? "—"}
      </p>

      {/* Improvement signals / indicators (AC #45, #52) */}
      <Section title="Improvement signals" testid="property-signals">
        {rollup ? (
          <div className="grid">
            <Stat label="Open permits" value={rollup.openPermitCount} testid="signal-open-permits" />
            <Stat label="Permits (5y)" value={rollup.permitCount5y} testid="signal-permits-5y" />
            <Stat
              label="Major renovations"
              value={rollup.majorRenovationCount}
              testid="signal-major-renos"
            />
            <Stat
              label="Improvement score"
              value={rollup.improvementScore}
              testid="signal-score"
            />
            <Stat
              label="Ownership changes"
              value={rollup.ownershipChangeCount}
              testid="signal-ownership-changes"
            />
            <Stat
              label="Business turnover"
              value={rollup.businessTurnoverCount}
              testid="signal-turnover"
            />
          </div>
        ) : (
          <Empty>No rollup computed.</Empty>
        )}
        {rollup?.renovationTrades?.length ? (
          <p style={{ marginTop: 12 }}>
            Renovation trades:{" "}
            {rollup.renovationTrades.map((t) => (
              <span key={t} className="pill">
                {t}
              </span>
            ))}
          </p>
        ) : null}
      </Section>

      {/* Ownership history (AC #17) */}
      <Section title="Ownership history" count={ownershipHistory.length} testid="property-ownership">
        {ownershipHistory.length ? (
          <table data-testid="ownership-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Kind</th>
                <th>Acquired</th>
                <th>Sold</th>
                <th>%</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {ownershipHistory.map((o, i) => (
                <tr key={o.ownershipId ?? i} data-testid="ownership-row">
                  <td>{o.ownerName ?? "—"}</td>
                  <td>{o.ownerKind}</td>
                  <td>{o.dateAcquired ?? "—"}</td>
                  <td>{o.dateSold ?? "present"}</td>
                  <td>{o.ownershipPercentage ?? "—"}</td>
                  <td className="muted">{o.sourceSystem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No ownership records.</Empty>
        )}
        {salesHistory.length ? (
          <>
            <h3>Sales / transfers ({salesHistory.length})</h3>
            <table data-testid="sales-table">
              <thead>
                <tr>
                  <th>Transfer date</th>
                  <th>Price</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {salesHistory.map((s, i) => (
                  <tr key={s.salesHistoryId ?? i}>
                    <td>{s.ownershipTransferDate ?? "—"}</td>
                    <td>
                      {s.purchasePriceAmount
                        ? `$${Number(s.purchasePriceAmount).toLocaleString()}`
                        : "—"}
                    </td>
                    <td>{s.saleType ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </Section>

      <Section title="Open permits" count={openPermits.length} testid="property-open-permits">
        <PermitTable permits={openPermits} testid="open-permits-table" />
      </Section>

      {/* Permit history (AC #18) */}
      <Section title="Permit history" count={permits.length} testid="property-permit-history">
        <PermitTable permits={permits} testid="permit-history-table" />
      </Section>

      {/* Major improvement activity (AC #22, #46) */}
      <Section
        title="Major improvement activity"
        count={majorImprovements.length}
        testid="property-major-improvements"
      >
        <PermitTable permits={majorImprovements} testid="major-improvements-table" />
        {projects.length ? (
          <>
            <h3>Projects ({projects.length})</h3>
            <ul>
              {projects.map((pr, i) => (
                <li key={pr.projectId ?? i}>
                  {pr.projectName} — {pr.projectStatus}, {pr.permitCount ?? 0} permit(s),
                  trades: {(pr.renovationTrades ?? []).join(", ") || "—"}
                  {pr.isMajorRenovation ? <span className="pill pill-open">major</span> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Section>

      <Section
        title="Contractor activity"
        count={contractorActivity.length}
        testid="property-contractors"
      >
        {contractorActivity.length ? (
          <table data-testid="contractor-activity-table">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Permits here</th>
                <th>Trades</th>
                <th>BBB</th>
                <th>Complaints</th>
              </tr>
            </thead>
            <tbody>
              {contractorActivity.map((c) => (
                <tr key={c.companyId} data-testid="contractor-activity-row">
                  <td>
                    <Link href={`/contractors/${c.companyId}`}>{c.name ?? c.companyId}</Link>
                  </td>
                  <td>{c.permitCount}</td>
                  <td>{c.trades.join(", ") || "—"}</td>
                  <td>{c.bbbRating ?? "—"}</td>
                  <td>{c.complaintCount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No contractor activity.</Empty>
        )}
      </Section>

      {/* Business occupancy & tenant activity (AC #21, #23) */}
      <Section
        title="Business occupancy & tenant activity"
        count={occupancies.length}
        testid="property-occupancy"
      >
        {businesses.length ? (
          <>
            <h3>Businesses</h3>
            <table data-testid="property-businesses-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Occupancy</th>
                  <th>From</th>
                  <th>To</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b, i) => (
                  <tr key={b.businessRegistrationId ?? i}>
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
                    <td>{b.startDate ?? "—"}</td>
                    <td>{b.endDate ?? "present"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        <h3>Tenant activity</h3>
        {occupancies.length ? (
          <table data-testid="occupancy-table">
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
                <tr key={o.occupancyId ?? i} data-testid="occupancy-row">
                  <td>{o.occupancyType ?? "occupancy"}</td>
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

      {/* Parcel facts */}
      <Section title="Parcel facts" testid="property-facts">
        <Field label="Parcel identifier" value={property.parcelIdentifier} />
        <Field label="Property type" value={property.propertyType} />
        <Field label="Usage / class" value={property.propertyUsageType} />
        <Field label="Subdivision" value={property.subdivision} />
        <Field label="Zoning" value={property.zoning} />
        <Field label="Built year" value={property.propertyStructureBuiltYear} />
      </Section>

      <Section title="Provenance" testid="property-provenance">
        <Citations items={buildCitations(citationRows)} />
      </Section>
    </div>
  );
}
