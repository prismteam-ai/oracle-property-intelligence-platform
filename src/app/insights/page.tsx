import Link from "next/link";

import { ResultTable } from "@/components/ResultTable";
import {
  DEMO_INQUIRIES,
  STRETCH_INQUIRIES,
  inquiryDeepLink,
  type InquiryDef,
} from "@/lib/inquiries";
import { data } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  return (
    <div>
      <h1>Insights</h1>
      <p className="muted">
        All {DEMO_INQUIRIES.length} demo + {STRETCH_INQUIRIES.length} stretch inquiries, each
        backed by canonical analytics with provenance. Deep-link any section by its #id (e.g.{" "}
        <code>/insights#contractors-negative-bbb</code>).
      </p>

      <nav className="card" data-testid="inquiry-index">
        <strong>Jump to:</strong>{" "}
        {[...DEMO_INQUIRIES, ...STRETCH_INQUIRIES].map((i) => (
          <a key={i.id} href={`#${i.id}`} style={{ marginRight: 8 }}>
            {i.kind === "demo" ? `D${i.ordinal}` : `S${i.ordinal}`}
          </a>
        ))}
      </nav>

      <h2>Demo inquiries</h2>
      {DEMO_INQUIRIES.map((i) => (
        <InquirySection key={i.id} inquiry={i} />
      ))}

      <h2>Stretch inquiries</h2>
      {STRETCH_INQUIRIES.map((i) => (
        <InquirySection key={i.id} inquiry={i} />
      ))}
    </div>
  );
}

async function InquirySection({ inquiry }: { inquiry: InquiryDef }) {
  const result = await data.runInquiry(inquiry.id);
  // Count distinct source-backed citations across the result.
  const citedRows = result.rows.filter(
    (r) => Array.isArray(r.citations) && r.citations.length > 0,
  ).length;
  return (
    <section id={inquiry.id} className="card" data-testid={`inquiry-${inquiry.id}`}>
      <h3>
        {inquiry.kind === "demo" ? `Demo ${inquiry.ordinal}` : `Stretch ${inquiry.ordinal}`}:{" "}
        {inquiry.label}
      </h3>
      <p className="muted">{inquiry.question}</p>
      <p className="muted" data-testid={`inquiry-meta-${inquiry.id}`}>
        {result.rows.length} result(s) · {citedRows} with source provenance ·{" "}
        <Link href={inquiryDeepLink(inquiry)}>permalink</Link> ·{" "}
        <Link href={`/explore?q=${encodeURIComponent(inquiry.question)}`}>ask in RAG</Link>
      </p>
      <ResultTable
        columns={result.columns}
        rows={result.rows}
        emptyNote="No permit records in the current parcels-only ingest — pending permit-source integration."
      />
    </section>
  );
}
