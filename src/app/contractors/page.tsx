import Link from "next/link";

import { Empty } from "@/components/ui";
import { ResultCount } from "@/components/ResultCount";
import { data } from "@/server/db";
import { rowDisplayLimit } from "@/lib/dataset";
import type { ContractorFilters } from "@/server/ports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const limit = rowDisplayLimit();
  const filters: ContractorFilters = {
    rating: (sp.rating as ContractorFilters["rating"]) ?? "all",
    sort: (sp.sort as ContractorFilters["sort"]) ?? "projects",
    trade: sp.trade || undefined,
    query: sp.q || undefined,
    limit: limit + 1,
  };
  const [fetched, facets] = await Promise.all([
    data.listContractors(filters),
    data.getFilterFacets(),
  ]);
  const capped = fetched.length > limit;
  const contractors = capped ? fetched.slice(0, limit) : fetched;

  return (
    <div data-testid="contractors-page">
      <h1>Contractors</h1>
      <p className="muted">
        Lee County contractors from BBB reputation records — rating, reviews, and complaints. Permit/project counts are 0 pending permit-source integration.
      </p>

      <form method="get" action="/contractors" className="card" data-testid="contractor-filters">
        <div className="grid">
          <label>
            <div className="muted">Search</div>
            <input type="text" name="q" defaultValue={filters.query ?? ""} data-testid="contractor-search" />
          </label>
          <label>
            <div className="muted">Rating</div>
            <select name="rating" defaultValue={filters.rating} data-testid="contractor-rating">
              <option value="all">all</option>
              <option value="negative">negative only</option>
              <option value="positive">positive only</option>
            </select>
          </label>
          <label>
            <div className="muted">Trade</div>
            <select name="trade" defaultValue={filters.trade ?? ""} data-testid="contractor-trade">
              <option value="">Any</option>
              {facets.contractorTrades.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div className="muted">Sort by</div>
            <select name="sort" defaultValue={filters.sort} data-testid="contractor-sort">
              <option value="projects">project count</option>
              <option value="complaints">complaints</option>
              <option value="reviews">reviews</option>
              <option value="score">review score</option>
            </select>
          </label>
        </div>
        <button type="submit" data-testid="contractor-apply">
          Apply
        </button>{" "}
        <a className="chip" href="/contractors">
          Clear
        </a>
      </form>

      <ResultCount
        shown={contractors.length}
        noun="contractor"
        limit={limit}
        capped={capped}
      />
      <table data-testid="contractors-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Trade</th>
            <th>Permits</th>
            <th>BBB</th>
            <th>Reviews</th>
            <th>Complaints</th>
          </tr>
        </thead>
        <tbody>
          {contractors.map((c) => (
            <tr key={c.companyId} data-testid="contractor-row">
              <td>
                <Link href={`/contractors/${c.companyId}`} data-testid="contractor-link">
                  {c.name}
                </Link>
              </td>
              <td>{c.trade ?? "—"}</td>
              <td>{c.permitCount}</td>
              <td>
                <span className={c.isNegative ? "pill pill-bad" : "pill pill-good"}>
                  {c.bbbRating ?? "NR"}
                </span>
              </td>
              <td>
                {c.reviewAverageRating ?? "—"}{" "}
                <span className="muted">({c.reviewCount ?? 0})</span>
              </td>
              <td>{c.complaintCount ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {contractors.length === 0 ? <Empty>No contractors match these filters.</Empty> : null}
    </div>
  );
}
