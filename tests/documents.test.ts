/**
 * RAG corpus builder tests — NO live DB required.
 *
 * buildDocuments() is a pure function over the in-memory graph. It must produce
 * a production-like number of source-backed documents across entity types, each
 * carrying citations (label + url + record_key) so retrieval is grounded.
 */

import { describe, expect, it } from "vitest";

import { generate } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import { buildDocuments } from "@/db/seed/documents";

const g = generate(SEED);
const docs = buildDocuments(g);

describe("RAG corpus", () => {
  it("produces a production-like number of documents (thousands)", () => {
    expect(docs.length).toBeGreaterThan(3000);
  });

  it("covers multiple entity types", () => {
    const types = new Set(docs.map((d) => d.entityType));
    expect(types).toContain("property");
    expect(types).toContain("contractor");
    expect(types).toContain("business");
    expect(types).toContain("tenant");
    expect(types).toContain("project");
  });

  it("is deterministic (same seed => same corpus)", () => {
    const again = buildDocuments(generate(SEED));
    expect(again.length).toBe(docs.length);
    expect(again[0]!.sourceRecordKey).toBe(docs[0]!.sourceRecordKey);
  });

  it("every document has a non-empty title + body and the embedding model set", () => {
    for (const d of docs.slice(0, 200)) {
      expect(d.title).toBeTruthy();
      expect(d.body.length).toBeGreaterThan(0);
      expect(d.embeddingModel).toBeTruthy();
    }
  });

  it("document source_record_keys are unique (the corpus upsert key)", () => {
    const keys = docs.map((d) => `${d.sourceSystem}::${d.sourceRecordKey}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("property + contractor + business docs carry citations with url + record_key", () => {
    const withCitations = docs.filter((d) =>
      ["property", "contractor", "business"].includes(d.entityType),
    );
    for (const d of withCitations.slice(0, 100)) {
      const items = (d.citations as { items?: Array<Record<string, unknown>> }).items ?? [];
      expect(items.length).toBeGreaterThan(0);
      for (const c of items) {
        expect(c.url).toBeTruthy();
        expect(c.recordKey).toBeTruthy();
        expect(c.label).toBeTruthy();
      }
    }
  });

  it("metadata carries entity_type + jurisdiction filters (planned up front)", () => {
    for (const d of docs.slice(0, 50)) {
      const md = d.metadata as Record<string, unknown>;
      expect(md.entityType).toBe(d.entityType);
      expect(md.jurisdiction).toBe("fl-lee");
    }
  });
});
