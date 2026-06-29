export const runtime = "nodejs";

const SOURCES = [
  {
    system: "leepa",
    name: "Lee County Property Appraiser",
    url: "https://www.leepa.org/",
    covers: "Properties, parcels, ownership, taxes, valuations, structures.",
  },
  {
    system: "lee_accela",
    name: "Lee County Permits (Accela)",
    url: "https://aca-prod.accela.com/LEE/",
    covers: "Permits (property improvements), inspections, contacts, fees.",
  },
  {
    system: "sunbiz",
    name: "Florida Sunbiz",
    url: "https://search.sunbiz.org/",
    covers: "Business registrations, parties, addresses, annual reports.",
  },
  {
    system: "bbb",
    name: "Better Business Bureau",
    url: "https://www.bbb.org/",
    covers: "Contractor reputation profiles, ratings, reviews, complaints.",
  },
];

export default function SourcesPage() {
  return (
    <div>
      <h1>Sources &amp; Provenance</h1>

      <div className="card">
        <h2>Transparency note</h2>
        <p>
          This deployment runs on <strong>real Lee County public records</strong> ingested
          directly into the <code>@elephant-xyz/query-db</code> lexicon on Neon: roughly{" "}
          <strong>554,000 parcels</strong> with their owners, tax and valuation history, sales,
          structures, permits, and addresses, sourced from the{" "}
          <strong>Lee County Property Appraiser</strong> and the county GIS feature services.
          Every row carries full source provenance — source_system, record key, artifact URI,
          and load timestamp.
        </p>
        <p>
          Business registrations, contractor reputation, and tenant occupancy layers are{" "}
          <strong>illustrative</strong> — representative records pending the Sunbiz, BBB, and
          tenancy source integrations — and are labeled as such rather than presented as
          verified public record.
        </p>
        <p>
          The schema, the kit-named queries, the RAG pipeline, and the UI are source-agnostic:
          pointing <code>DATA_SOURCE=neon</code> and <code>DATABASE_URL</code> at the canonical
          access-gated <strong>@elephant-xyz/query-db</strong> runs everything unchanged.
        </p>
      </div>

      <div className="card">
        <h2>Source systems</h2>
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Name</th>
              <th>Covers</th>
              <th>Portal</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.system}>
                <td>{s.system}</td>
                <td>{s.name}</td>
                <td>{s.covers}</td>
                <td>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    open
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Lineage model</h2>
        <p className="muted">
          Every lexicon row carries source_system, source_record_key, source_record_hash,
          source_artifact_uri, and loaded_at. The additive public_records ledger adds source_url,
          collection_timestamp, refresh_timestamp, and a lineage JSON object, polymorphically
          attached to any entity via (entity_type, entity_id).
        </p>
      </div>
    </div>
  );
}
