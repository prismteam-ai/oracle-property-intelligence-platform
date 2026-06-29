import Link from "next/link";

import { Empty } from "@/components/ui";
import { ResultCount } from "@/components/ResultCount";
import { data } from "@/server/db";
import { rowDisplayLimit } from "@/lib/dataset";
import type { BusinessFilters } from "@/server/ports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const limit = rowDisplayLimit();
  const filters: BusinessFilters = {
    businessType: sp.businessType || undefined,
    status: sp.status || undefined,
    query: sp.q || undefined,
    limit: limit + 1,
  };
  const [fetched, facets] = await Promise.all([
    data.listBusinesses(filters),
    data.getFilterFacets(),
  ]);
  const capped = fetched.length > limit;
  const businesses = capped ? fetched.slice(0, limit) : fetched;

  return (
    <div data-testid="businesses-page">
      <h1>Businesses</h1>
      <p className="muted">Florida Sunbiz registrations reconciled to Lee County locations.</p>

      <form method="get" action="/businesses" className="card" data-testid="business-filters">
        <div className="grid">
          <label>
            <div className="muted">Search</div>
            <input type="text" name="q" defaultValue={filters.query ?? ""} data-testid="business-search" />
          </label>
          <label>
            <div className="muted">Business type</div>
            <select
              name="businessType"
              defaultValue={filters.businessType ?? ""}
              data-testid="filter-business-type"
            >
              <option value="">Any</option>
              {facets.businessTypes.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="muted">Status</div>
            <select name="status" defaultValue={filters.status ?? ""} data-testid="business-status">
              <option value="">Any</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="DISSOLVED">DISSOLVED</option>
            </select>
          </label>
        </div>
        <button type="submit" data-testid="business-apply">
          Apply
        </button>{" "}
        <a className="chip" href="/businesses">
          Clear
        </a>
      </form>

      <ResultCount
        shown={businesses.length}
        noun="business"
        pluralNoun="businesses"
        limit={limit}
        capped={capped}
      />
      <table data-testid="businesses-table">
        <thead>
          <tr>
            <th>Entity</th>
            <th>Doc #</th>
            <th>Status</th>
            <th>Filing type</th>
            <th>Filed</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((b) => (
            <tr key={b.businessRegistrationId} data-testid="business-row">
              <td>
                <Link href={`/businesses/${b.documentNumber}`} data-testid="business-link">
                  {b.entityName}
                </Link>
              </td>
              <td>{b.documentNumber}</td>
              <td>{b.status ?? "—"}</td>
              <td>{b.filingType ?? "—"}</td>
              <td>{b.filedDate ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {businesses.length === 0 ? <Empty>No businesses match these filters.</Empty> : null}
    </div>
  );
}
