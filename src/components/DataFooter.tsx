import Link from "next/link";

import { datasetMode, isSynthetic } from "@/lib/dataset";

export function DataFooter() {
  const synthetic = isSynthetic();
  const source = datasetMode();
  return (
    <footer className="datafooter" data-testid="data-footer">
      <span className="muted">
        Oracle Property Intelligence Platform · DATA_SOURCE=<code>{source}</code> ·{" "}
        {synthetic ? (
          <>
            Disclosed <strong>SYNTHETIC</strong> dataset generated to the @elephant-xyz/query-db
            lexicon at production scale. Not real records.
          </>
        ) : (
          <>
            Real Lee County public records ingested into the{" "}
            <strong>@elephant-xyz/query-db</strong> lexicon (Neon); reputation layers illustrative.
          </>
        )}{" "}
        <Link href="/sources">Sources &amp; provenance</Link>
      </span>
    </footer>
  );
}
