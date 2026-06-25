import Link from "next/link";
import { Sparkles, Database, ListTree, FileSearch, ArrowUpRight } from "lucide-react";
import { Card, PageHeader, Badge, SectionTitle, Provenance, EmptyState } from "@/components/ui";
import { ResultTable } from "@/components/result-table";
import { AskBar } from "./search-bar";
import { answerQuestion } from "@/lib/rag";
import { INQUIRIES } from "@/lib/inquiries";
import { sourceLabel, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SUGGESTIONS = [
  "Show all properties with more than one open permit",
  "Show all properties with open roofing permits",
  "Show all properties that underwent major concrete work",
  "Show all contractors performing electrical work in Lee County",
  "Show contractors with complaint histories",
  "Show projects completed by contractors with negative BBB ratings or complaint histories",
  "Show owners associated with multiple properties",
  "Show tenants operating across multiple locations",
  "Show neighborhoods with the highest concentration of major renovations",
  "Which properties are likely candidates for acquisition based on permit, ownership, and occupancy signals?",
];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const answer = q ? await answerQuestion(q) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="RAG knowledge layer"
        title="Ask Oracle"
        subtitle="Natural-language questions answered against the full Lee County dataset. Analytical questions route to precise structured queries; everything else uses hybrid semantic + keyword retrieval. Every answer is backed by its source records."
      />
      <AskBar initial={q ?? ""} />

      {!answer && (
        <Card className="p-5">
          <SectionTitle title="Try one of these" subtitle="Curated from the demo inquiry set" />
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Link key={s} href={`/explore?q=${encodeURIComponent(s)}`}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700">
                {s}
              </Link>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Capability icon={<ListTree className="h-4 w-4" />} title="Structured router" body={`${INQUIRIES.length} analytical inquiries answered with exact SQL over the lexicon.`} />
            <Capability icon={<Sparkles className="h-4 w-4" />} title="Semantic search" body="pgvector (bge-small, 384d) over 3,400+ entity documents." />
            <Capability icon={<FileSearch className="h-4 w-4" />} title="Provenance" body="Citations link back to the appraiser, Accela, Sunbiz, and BBB." />
          </div>
        </Card>
      )}

      {answer && (
        <div className="space-y-4">
          {/* Answer card */}
          <Card className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Sparkles className="h-4 w-4" />
              </span>
              <Badge tone={answer.mode === "structured" ? "blue" : "violet"}>
                {answer.mode === "structured" ? "Structured query" : answer.embedded ? "Semantic (vector + keyword)" : "Keyword search"}
              </Badge>
              {answer.mode === "structured" && <span className="text-xs text-slate-400">matched “{answer.inquiryLabel}”</span>}
            </div>
            <p className="text-[15px] leading-relaxed text-ink">{answer.answer}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Sources</span>
              {(answer.mode === "structured" ? answer.result.sourceSystems : answer.sourceSystems).map((s) => (
                <Badge key={s} tone="slate" dot>{sourceLabel(s)}</Badge>
              ))}
            </div>
          </Card>

          {/* Results */}
          {answer.mode === "structured" ? (
            <Card className="p-5">
              <SectionTitle
                title={`${answer.result.total} result${answer.result.total === 1 ? "" : "s"}`}
                subtitle="Source-backed structured query result"
                action={<Link href="/insights" className="text-xs text-brand-600 hover:underline">All insights →</Link>}
              />
              <ResultTable columns={answer.result.columns} rows={answer.result.rows} />
            </Card>
          ) : (
            <div className="space-y-3">
              {answer.hits.length === 0 && <EmptyState title="No matching records" hint="Try rephrasing or use a suggested question." />}
              {answer.hits.map((h) => (
                <Card key={h.documentId} className="p-4 transition hover:border-brand-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge tone="slate">{h.entityType}</Badge>
                        <Link href={h.href} className="truncate text-sm font-semibold text-brand-600 hover:underline">{h.title}</Link>
                      </div>
                      {h.subtitle && <div className="mt-0.5 text-xs text-slate-500">{h.subtitle}</div>}
                      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{h.snippet}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {h.citations.length > 0
                          ? h.citations.map((c, i) => <Provenance key={i} source={c.source} url={c.url} recordKey={c.recordKey} compact />)
                          : h.sourceSystems.map((s) => <Provenance key={s} source={s} compact />)}
                      </div>
                    </div>
                    <Link href={h.href} className="shrink-0 text-slate-300 hover:text-brand-500"><ArrowUpRight className="h-4 w-4" /></Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Capability({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center gap-1.5 text-brand-600">{icon}<span className="text-xs font-semibold text-ink">{title}</span></div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{body}</p>
    </div>
  );
}
