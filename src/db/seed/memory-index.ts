import { buildDocuments } from "./documents";
import type { GeneratedGraph } from "./generate";
import type { NewEntityDocument } from "@/db/schema/types";
import type {
  Citation,
  EmbeddingService,
  RagEvidence,
} from "@/server/rag/types";
import { cosineSimilarity, StubEmbeddingService } from "@/server/rag/embed-stub";

const VECTOR_WEIGHT = 0.6;
const FTS_WEIGHT = 0.4;
const SNIPPET_LEN = 320;

export type RetrieveOptions = {
  limit?: number;
  entityType?: string;
  sourceSystem?: string;
  jurisdiction?: string;
};

type IndexedDoc = {
  doc: NewEntityDocument;
  documentId: string;
  embedding: number[];
  tokens: Set<string>;
  text: string;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function citationsFromDoc(doc: NewEntityDocument): Citation[] {
  const raw = (doc.citations as { items?: unknown } | undefined)?.items;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      label: String(c.label ?? "Public record"),
      url: String(c.url ?? ""),
      recordKey: c.recordKey ? String(c.recordKey) : undefined,
      sourceSystem: c.sourceSystem ? String(c.sourceSystem) : undefined,
    }));
}

function ftsScore(queryTokens: string[], docTokens: Set<string>): number {
  if (queryTokens.length === 0 || docTokens.size === 0) return 0;
  let hits = 0;
  const seen = new Set<string>();
  for (const t of queryTokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    if (docTokens.has(t)) hits++;
  }
  return hits / seen.size;
}

export class InMemoryRagIndex {
  private readonly docs: IndexedDoc[] = [];
  readonly embeddings: EmbeddingService;
  private built = false;

  constructor(embeddings?: EmbeddingService) {
    this.embeddings = embeddings ?? new StubEmbeddingService();
  }

  static async fromGraph(
    graph: GeneratedGraph,
    embeddings?: EmbeddingService,
  ): Promise<InMemoryRagIndex> {
    const index = new InMemoryRagIndex(embeddings);
    await index.build(buildDocuments(graph));
    return index;
  }

  async build(corpus: NewEntityDocument[]): Promise<void> {
    const texts = corpus.map((d) => `${d.title}\n${d.body}`);
    const vectors = await this.embeddings.embed(texts);
    for (let i = 0; i < corpus.length; i++) {
      const doc = corpus[i]!;
      const text = texts[i]!;
      this.docs.push({
        doc,
        documentId: doc.sourceRecordKey,
        embedding: vectors[i] ?? [],
        tokens: new Set(tokenize(text)),
        text,
      });
    }
    this.built = true;
  }

  get size(): number {
    return this.docs.length;
  }

  private matchesFilters(doc: NewEntityDocument, opts: RetrieveOptions): boolean {
    if (opts.entityType && doc.entityType !== opts.entityType) return false;
    const md = (doc.metadata as Record<string, unknown> | undefined) ?? {};
    if (opts.jurisdiction && md.jurisdiction !== opts.jurisdiction) return false;
    if (opts.sourceSystem) {
      const inSystems =
        (doc.sourceSystems ?? []).includes(opts.sourceSystem) ||
        doc.sourceSystem === opts.sourceSystem;
      if (!inSystems) return false;
    }
    return true;
  }

  async retrieve(query: string, opts: RetrieveOptions = {}): Promise<RagEvidence[]> {
    if (!this.built) throw new Error("InMemoryRagIndex.retrieve before build()");
    const limit = opts.limit ?? 8;
    const [qVec] = await this.embeddings.embed([query]);
    const queryVector = qVec ?? [];
    const queryTokens = tokenize(query);

    const scored = this.docs
      .filter((d) => this.matchesFilters(d.doc, opts))
      .map((d) => {
        const vec = cosineSimilarity(queryVector, d.embedding);
        const fts = ftsScore(queryTokens, d.tokens);
        const score = VECTOR_WEIGHT * vec + FTS_WEIGHT * fts;
        return { d, vec, fts, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ d, vec, fts, score }) => ({
      documentId: d.documentId,
      entityType: d.doc.entityType,
      entityId: d.doc.entityId ?? null,
      title: d.doc.title,
      snippet: d.doc.body.slice(0, SNIPPET_LEN),
      score,
      vectorScore: vec,
      ftsScore: fts,
      sourceUri: d.doc.sourceUri ?? null,
      citations: citationsFromDoc(d.doc),
    }));
  }

  async searchDocuments(
    query: string,
    opts: RetrieveOptions = {},
  ): Promise<NewEntityDocument[]> {
    const evidence = await this.retrieve(query, opts);
    const byId = new Map(this.docs.map((d) => [d.documentId, d.doc]));
    return evidence
      .map((e) => byId.get(e.documentId))
      .filter((d): d is NewEntityDocument => !!d);
  }
}
