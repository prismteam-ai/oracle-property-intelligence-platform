import type { FilterFacets, PropertyFilters } from "@/server/ports";

export type FilterField =
  | "county"
  | "municipality"
  | "permitType"
  | "contractor"
  | "propertyClass"
  | "businessType"
  | "dateFrom"
  | "dateTo";

const ALL_FIELDS: FilterField[] = [
  "county",
  "municipality",
  "permitType",
  "contractor",
  "propertyClass",
  "businessType",
  "dateFrom",
  "dateTo",
];

export function FilterBar({
  action,
  facets,
  values = {},
  fields = ALL_FIELDS,
}: {
  action: string;
  facets: FilterFacets;
  values?: PropertyFilters;
  fields?: FilterField[];
}) {
  const show = new Set(fields);
  return (
    <form
      method="get"
      action={action}
      className="card"
      data-testid="filter-bar"
      aria-label="filters"
    >
      <div className="grid">
        {show.has("county") ? (
          <label>
            <div className="muted">County</div>
            <select name="county" defaultValue={values.county ?? ""} data-testid="filter-county">
              <option value="">Any</option>
              {facets.counties.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {show.has("municipality") ? (
          <label>
            <div className="muted">Municipality</div>
            <select
              name="municipality"
              defaultValue={values.municipality ?? ""}
              data-testid="filter-municipality"
            >
              <option value="">Any</option>
              {facets.municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {show.has("permitType") ? (
          <label>
            <div className="muted">Permit type</div>
            <select
              name="permitType"
              defaultValue={values.permitType ?? ""}
              data-testid="filter-permit-type"
            >
              <option value="">Any</option>
              {facets.permitTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {show.has("contractor") ? (
          <label>
            <div className="muted">Contractor</div>
            <input
              type="text"
              name="contractor"
              defaultValue={values.contractor ?? ""}
              data-testid="filter-contractor"
            />
          </label>
        ) : null}
        {show.has("propertyClass") ? (
          <label>
            <div className="muted">Property class</div>
            <select
              name="propertyClass"
              defaultValue={values.propertyClass ?? ""}
              data-testid="filter-property-class"
            >
              <option value="">Any</option>
              {facets.propertyClasses.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {show.has("businessType") ? (
          <label>
            <div className="muted">Business type</div>
            <select
              name="businessType"
              defaultValue={values.businessType ?? ""}
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
        ) : null}
        {show.has("dateFrom") ? (
          <label>
            <div className="muted">From</div>
            <input
              type="date"
              name="dateFrom"
              defaultValue={values.dateFrom ?? ""}
              data-testid="filter-date-from"
            />
          </label>
        ) : null}
        {show.has("dateTo") ? (
          <label>
            <div className="muted">To</div>
            <input
              type="date"
              name="dateTo"
              defaultValue={values.dateTo ?? ""}
              data-testid="filter-date-to"
            />
          </label>
        ) : null}
      </div>
      <button type="submit" data-testid="filter-apply">
        Apply filters
      </button>{" "}
      <a href={action} className="chip" data-testid="filter-clear">
        Clear
      </a>
    </form>
  );
}
