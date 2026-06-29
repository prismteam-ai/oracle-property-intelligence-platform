import Link from "next/link";

import { FilterBar } from "@/components/FilterBar";
import { Empty } from "@/components/ui";
import { ResultCount } from "@/components/ResultCount";
import { data } from "@/server/db";
import { rowDisplayLimit } from "@/lib/dataset";
import type { PropertyFilters } from "@/server/ports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const limit = rowDisplayLimit();
  const filters: PropertyFilters = {
    county: sp.county || undefined,
    municipality: sp.municipality || undefined,
    permitType: sp.permitType || undefined,
    contractor: sp.contractor || undefined,
    propertyClass: sp.propertyClass || undefined,
    businessType: sp.businessType || undefined,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    limit: limit + 1,
  };
  const [fetched, facets] = await Promise.all([
    data.listProperties(filters),
    data.getFilterFacets(),
  ]);
  const capped = fetched.length > limit;
  const properties = capped ? fetched.slice(0, limit) : fetched;

  return (
    <div data-testid="properties-page">
      <h1>Properties</h1>
      <p className="muted">
        Lee County parcels with ownership, permit, occupancy, and improvement signals.
      </p>
      <FilterBar action="/properties" facets={facets} values={filters} />

      <ResultCount
        shown={properties.length}
        noun="property"
        pluralNoun="properties"
        limit={limit}
        capped={capped}
      />
      <table data-testid="properties-table">
        <thead>
          <tr>
            <th>Parcel</th>
            <th>Type</th>
            <th>Usage / class</th>
            <th>Subdivision</th>
            <th>Built</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <tr key={p.propertyId} data-testid="property-row">
              <td>
                <Link href={`/properties/${p.propertyId}`} data-testid="property-link">
                  {p.parcelIdentifier}
                </Link>
              </td>
              <td>{p.propertyType ?? "—"}</td>
              <td>{p.propertyUsageType ?? "—"}</td>
              <td>{p.subdivision ?? "—"}</td>
              <td>{p.propertyStructureBuiltYear ?? "—"}</td>
              <td className="muted">{p.sourceSystem}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {properties.length === 0 ? <Empty>No properties match these filters.</Empty> : null}
    </div>
  );
}
