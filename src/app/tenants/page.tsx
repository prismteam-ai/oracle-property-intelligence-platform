import Link from "next/link";

import { Empty } from "@/components/ui";
import { ResultCount } from "@/components/ResultCount";
import { data } from "@/server/db";
import { rowDisplayLimit } from "@/lib/dataset";
import type { TenantFilters } from "@/server/ports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const limit = rowDisplayLimit();
  const filters: TenantFilters = {
    tenantType: sp.tenantType || undefined,
    query: sp.q || undefined,
    limit: limit + 1,
  };
  const fetched = await data.listTenants(filters);
  const capped = fetched.length > limit;
  const tenants = capped ? fetched.slice(0, limit) : fetched;

  return (
    <div data-testid="tenants-page">
      <h1>Tenants</h1>
      <p className="muted">Occupants reconciled across leases, Sunbiz, and occupancy sources.</p>

      <form method="get" action="/tenants" className="card" data-testid="tenant-filters">
        <div className="grid">
          <label>
            <div className="muted">Search</div>
            <input type="text" name="q" defaultValue={filters.query ?? ""} data-testid="tenant-search" />
          </label>
          <label>
            <div className="muted">Tenant type</div>
            <select name="tenantType" defaultValue={filters.tenantType ?? ""} data-testid="tenant-type">
              <option value="">Any</option>
              <option value="commercial">commercial</option>
              <option value="residential">residential</option>
            </select>
          </label>
        </div>
        <button type="submit" data-testid="tenant-apply">
          Apply
        </button>{" "}
        <a className="chip" href="/tenants">
          Clear
        </a>
      </form>

      <ResultCount shown={tenants.length} noun="tenant" limit={limit} capped={capped} />
      <table data-testid="tenants-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Match</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.tenantId} data-testid="tenant-row">
              <td>
                <Link href={`/tenants/${t.tenantId}`} data-testid="tenant-link">
                  {t.tenantName ?? t.tenantId}
                </Link>
              </td>
              <td>{t.tenantType ?? "—"}</td>
              <td className="muted">{t.matchMethod ?? "—"}</td>
              <td className="muted">{t.sourceSystem}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {tenants.length === 0 ? <Empty>No tenants match these filters.</Empty> : null}
    </div>
  );
}
