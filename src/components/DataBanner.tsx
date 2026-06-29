import Link from "next/link";

import { datasetMode, isSynthetic } from "@/lib/dataset";

export function DataBanner() {
  const mode = datasetMode();
  const synthetic = isSynthetic(mode);

  if (!synthetic) {
    return (
      <div className="databanner databanner-real" role="note" data-testid="data-banner">
        <span className="databanner-tag">LIVE DATA</span>
        <span className="databanner-text">
          Real Lee County public records — parcels, owners, sales, permits, and addresses from the
          County Property Appraiser — ingested into the <strong>@elephant-xyz/query-db</strong>{" "}
          lexicon on Neon. Business, contractor, and tenant reputation layers are illustrative
          pending those source integrations.{" "}
          <Link href="/sources" className="databanner-link">
            Provenance &amp; transparency note →
          </Link>
        </span>
      </div>
    );
  }

  return (
    <div className="databanner databanner-synthetic" role="note" data-testid="data-banner">
      <span className="databanner-tag">SYNTHETIC DATA</span>
      <span className="databanner-text">
        Every record shown is from a <strong>representative SYNTHETIC dataset</strong> generated to
        the <strong>@elephant-xyz/query-db</strong> lexicon at production scale — parcel IDs,
        permit numbers, and source URLs are illustrative, <strong>not real records</strong>. The
        canonical Neon dataset is <strong>access-gated</strong>; switching to it is one env change
        (<code>DATA_SOURCE=neon</code>) with no code change.{" "}
        <Link href="/sources" className="databanner-link">
          Provenance &amp; transparency note →
        </Link>
      </span>
    </div>
  );
}
