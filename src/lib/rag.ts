/**
 * Oracle RAG query engine.
 *
 * Answers natural-language questions against the knowledge layer in two modes:
 *  1. STRUCTURED — routes known analytical questions to a precise, source-backed
 *     SQL inquiry (deterministic, correct, fully cited).
 *  2. SEMANTIC — hybrid retrieval over the `entity_documents` index: pgvector
 *     cosine similarity (local bge-small embeddings) fused with Postgres full-text
 *     search, returning the most relevant entities with provenance citations.
 *
 * Every answer is grounded in retrieved records and carries citations back to the
 * originating public source (appraiser / Accela / Sunbiz / BBB).
 */
import { sql } from "@/db/client";
import { INQUIRIES, type Inquiry, type InquiryResult } from "@/lib/inquiries";

const EMBEDDINGS_URL = process.env.EMBEDDINGS_URL || "http://127.0.0.1:8900";

export interface Citation { source: string; url?: string | null; recordKey?: string | null; }
export interface SemanticHit {
  documentId: string; entityType: string; entityId: string; title: string; subtitle: string | null;
  snippet: string; score: number; sourceSystems: string[]; citations: Citation[]; href: string;
}
export type Answer =
  | { mode: "structured"; question: string; inquiryId: string; inquiryLabel: string; answer: string; result: InquiryResult; matched: number }
  | { mode: "semantic"; question: string; answer: string; hits: SemanticHit[]; sourceSystems: string[]; embedded: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set("show all the a an of in with that have has and or to for by on are is properties property contractor contractors business businesses tenant tenants which who".split(" "));

/** Score how well a user question matches an inquiry. */
function scoreInquiry(q: string, inq: Inquiry): number {
  const nq = norm(q);
  let score = 0;
  for (const kw of inq.keywords) {
    const nk = norm(kw);
    if (nq.includes(nk)) score += 10 + nk.length / 8;
  }
  // token overlap with the canonical question
  const qToks = new Set(nq.split(" ").filter((t) => t.length > 2 && !STOP.has(t)));
  const iToks = norm(inq.question).split(" ").filter((t) => t.length > 2 && !STOP.has(t));
  let overlap = 0;
  for (const t of iToks) if (qToks.has(t)) overlap++;
  score += overlap * 1.6;
  return score;
}

export function routeInquiry(q: string): { inquiry: Inquiry; score: number } | null {
  let best: { inquiry: Inquiry; score: number } | null = null;
  for (const inq of INQUIRIES) {
    const s = scoreInquiry(q, inq);
    if (!best || s > best.score) best = { inquiry: inq, score: s };
  }
  return best && best.score >= 6 ? best : null;
}

/** Get an embedding for a query string from the local embeddings service. */
export async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${EMBEDDINGS_URL}/embed`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: [text] }), signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.embeddings?.[0] ?? null;
  } catch {
    return null;
  }
}

let _embeddedCount: number | null = null;
async function embeddingsReady(): Promise<boolean> {
  if (_embeddedCount === null) {
    try {
      const r = await sql`select count(*)::int as n from entity_documents where embedding is not null`;
      _embeddedCount = (r[0] as any).n;
    } catch { _embeddedCount = 0; }
  }
  return (_embeddedCount ?? 0) > 0;
}

const hrefFor = (type: string, id: string) =>
  type === "property" || type === "neighborhood" ? `/properties/${id}`
  : type === "contractor" ? `/contractors/${id}`
  : type === "tenant" ? `/tenants/${id}`
  : `/businesses/${id}`;

/** Hybrid semantic + keyword retrieval over entity_documents. */
export async function semanticSearch(q: string, k = 12): Promise<{ hits: SemanticHit[]; embedded: boolean }> {
  const vec = (await embeddingsReady()) ? await embedQuery(q) : null;
  let rows: any[] = [];
  if (vec) {
    const lit = `[${vec.join(",")}]`;
    // Fuse vector similarity with full-text rank.
    rows = await sql`
      with v as (
        select document_id, 1 - (embedding <=> ${lit}::vector) as vscore
        from entity_documents where embedding is not null
        order by embedding <=> ${lit}::vector limit 40
      ),
      f as (
        select document_id, ts_rank(tsv, websearch_to_tsquery('english', ${q})) as fscore
        from entity_documents where tsv @@ websearch_to_tsquery('english', ${q}) limit 40
      )
      select d.document_id, d.entity_type, d.entity_id, d.title, d.subtitle, d.body,
             d.source_systems, d.citations,
             coalesce(v.vscore,0)*0.75 + coalesce(f.fscore,0)*4 as score
      from entity_documents d
      left join v on v.document_id = d.document_id
      left join f on f.document_id = d.document_id
      where v.document_id is not null or f.document_id is not null
      order by score desc limit ${k}`;
  } else {
    // FTS-only fallback (also trigram on title for fuzzy entity lookups)
    rows = await sql`
      select d.document_id, d.entity_type, d.entity_id, d.title, d.subtitle, d.body,
             d.source_systems, d.citations,
             ts_rank(tsv, websearch_to_tsquery('english', ${q})) + similarity(title, ${q}) as score
      from entity_documents d
      where tsv @@ websearch_to_tsquery('english', ${q}) or title % ${q}
      order by score desc limit ${k}`;
  }
  const hits: SemanticHit[] = rows.map((r: any) => ({
    documentId: r.document_id, entityType: r.entity_type, entityId: r.entity_id, title: r.title,
    subtitle: r.subtitle, snippet: snippet(r.body, q), score: Number(r.score),
    sourceSystems: r.source_systems ?? [], citations: (r.citations ?? []) as Citation[],
    href: hrefFor(r.entity_type, r.entity_id),
  }));
  return { hits, embedded: !!vec };
}

function snippet(body: string, q: string, len = 240): string {
  if (!body) return "";
  const toks = norm(q).split(" ").filter((t) => t.length > 3);
  const lower = body.toLowerCase();
  let pos = -1;
  for (const t of toks) { const i = lower.indexOf(t); if (i >= 0) { pos = i; break; } }
  if (pos < 0) return body.slice(0, len) + (body.length > len ? "…" : "");
  const start = Math.max(0, pos - 60);
  return (start > 0 ? "…" : "") + body.slice(start, start + len) + (start + len < body.length ? "…" : "");
}

export async function answerQuestion(q: string): Promise<Answer> {
  const routed = routeInquiry(q);
  if (routed) {
    const result = await routed.inquiry.run();
    return {
      mode: "structured", question: q, inquiryId: routed.inquiry.id, inquiryLabel: routed.inquiry.label,
      answer: result.summary, result, matched: Math.round(routed.score),
    };
  }
  const { hits, embedded } = await semanticSearch(q, 12);
  const sourceSystems = [...new Set(hits.flatMap((h) => h.sourceSystems))];
  const answer = hits.length
    ? `Found ${hits.length} relevant records in the knowledge layer for “${q}”. The strongest match is ${hits[0].title} (${hits[0].entityType}). Results are ranked by ${embedded ? "semantic similarity fused with keyword relevance" : "keyword relevance"}; each is backed by its source record below.`
    : `No records in the knowledge layer matched “${q}”. Try a property address, a contractor or business name, or one of the suggested questions.`;
  return { mode: "semantic", question: q, answer, hits, sourceSystems, embedded };
}
