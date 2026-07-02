/**
 * Cited-answer synthesis tests — NO live DB, NO network, NO LLM key.
 *
 * Drives the full RAG answer pipeline through the in-memory provider + stub
 * embeddings: the structured-query router (factual questions hit canonical
 * tables), the hybrid semantic route (open questions hit the vector corpus), the
 * deterministic templated synthesis (works with no LLM), and source-backed
 * provenance (entity ids + source_uri/title as citations). Also asserts the
 * injected-LLM path is honored when configured.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { generate, type GeneratedGraph } from "@/db/seed/generate";
import { SEED } from "@/db/seed/rng";
import { createInMemoryAccess, type InMemoryAccess } from "@/db/seed/in-memory-access";
import { InMemoryRagIndex } from "@/db/seed/memory-index";
import {
  synthesizeAnswer,
  templatedAnswer,
  dedupeCitations,
} from "@/server/rag/synthesize";
import type { RagEvidence } from "@/server/rag/types";

let g: GeneratedGraph;
let access: InMemoryAccess;

beforeAll(() => {
  g = generate(SEED);
  access = createInMemoryAccess(g);
});

describe("structured-query router", () => {
  it("routes a factual inquiry to canonical tables (structured mode)", async () => {
    const ans = await access.answerQuestion(
      "Show all properties with more than one open permit.",
    );
    expect(ans.route).toBe("structured");
    expect(ans.mode).toBe("structured");
    expect(ans.evidence.length).toBeGreaterThan(0);
    // Structured evidence comes from the canonical inquiry, not the corpus.
    expect(ans.evidence[0]!.entityType).toBe("inquiry");
    expect(ans.answer).toContain("structured inquiry");
  });

  it("structured answers carry provenance citations (url + record_key)", async () => {
    const ans = await access.answerQuestion(
      "Show all properties with more than one open permit.",
    );
    expect(ans.citations.length).toBeGreaterThan(0);
    const c = ans.citations[0]!;
    expect(c.url).toBeTruthy();
    expect(c.recordKey).toBeTruthy();
  });

  it("routes negative-BBB contractor question to the canonical contractor inquiry", async () => {
    const ans = await access.answerQuestion("Show contractors with negative BBB ratings.");
    expect(ans.route).toBe("structured");
    expect(ans.evidence.length).toBeGreaterThan(0);
    expect(ans.citations.some((c) => c.url?.includes("bbb.org"))).toBe(true);
  });
});

describe("hybrid semantic route", () => {
  it("routes an open-ended question to the vector corpus (semantic mode)", async () => {
    const ans = await access.answerQuestion(
      "What do reviewers say about poor quality roofing workmanship and leaks?",
    );
    expect(ans.route).toBe("semantic");
    expect(["semantic", "none"]).toContain(ans.mode);
    expect(ans.evidence.length).toBeGreaterThan(0);
  });

  it("semantic answer is the deterministic template when no LLM is configured", async () => {
    const ans = await access.answerQuestion(
      "Tell me about contractor reputations and workmanship complaints in the area.",
    );
    expect(ans.synthesizedBy).toBe("template");
    expect(ans.answer).toContain("source-backed record");
  });

  it("semantic evidence carries source_uri provenance for every cited record", async () => {
    const ans = await access.answerQuestion(
      "summarize the reputation and workmanship quality of local building firms",
    );
    expect(ans.route).toBe("semantic");
    expect(ans.evidence.length).toBeGreaterThan(0);
    for (const e of ans.evidence) {
      // contractor/business/property docs always have a source_uri.
      if (["contractor", "business", "property"].includes(e.entityType)) {
        expect(e.sourceUri).toBeTruthy();
      }
    }
  });
});

describe("templated synthesis + citation dedupe (pure)", () => {
  const evidence: RagEvidence[] = [
    {
      documentId: "d1",
      entityType: "contractor",
      entityId: "c1",
      title: "Acme Roofing",
      snippet: "BBB rating F, 9 complaints.",
      score: 0.9,
      sourceUri: "https://www.bbb.org/profile/acme",
      citations: [
        {
          label: "BBB Profile",
          url: "https://www.bbb.org/profile/acme",
          recordKey: "bbb:profile:1",
          sourceSystem: "bbb",
        },
      ],
    },
    {
      documentId: "d2",
      entityType: "contractor",
      entityId: "c1",
      title: "Acme Roofing (dup)",
      snippet: "duplicate citation source.",
      score: 0.8,
      sourceUri: "https://www.bbb.org/profile/acme",
      citations: [
        {
          label: "BBB Profile",
          url: "https://www.bbb.org/profile/acme",
          recordKey: "bbb:profile:1",
          sourceSystem: "bbb",
        },
      ],
    },
  ];

  it("templated answer names each piece of evidence with its source", () => {
    const text = templatedAnswer("which contractors are risky?", evidence);
    expect(text).toContain("Acme Roofing");
    expect(text).toContain("source: https://www.bbb.org/profile/acme");
    expect(text).toContain("[1]");
  });

  it("says so honestly when there is no evidence", () => {
    const text = templatedAnswer("unanswerable", []);
    expect(text.toLowerCase()).toContain("no supporting evidence");
  });

  it("leads with a DIRECT answer naming the top entity (not just an evidence dump)", () => {
    const text = templatedAnswer("which contractors are risky?", evidence);
    // The improved synthesis directly names the strongest-matching entity up
    // front and labels its entity type, with its [1] citation.
    expect(text).toMatch(/^The (closest|strongest) match/);
    expect(text).toContain("contractor Acme Roofing");
    // Still source-backed + still lists the cited bullets.
    expect(text).toContain("source-backed record");
    expect(text).toContain("[1]");
  });

  it("dedupes identical citations across evidence", () => {
    expect(dedupeCitations(evidence)).toHaveLength(1);
  });
});

describe("injectable LLM path (still no real network)", () => {
  it("uses the injected LLM synthesis when it returns text", async () => {
    const index = await InMemoryRagIndex.fromGraph(g);
    const ans = await synthesizeAnswer("what is the general sentiment about local building work quality", {
      retrieve: (q, limit) => index.retrieve(q, { limit }),
      runInquiry: (id) => Promise.resolve(access.runInquiry(id)),
      // Stubbed "LLM" — grounded synthesis without any external call.
      llmSynthesize: async (_q, ev) =>
        ev.length ? `LLM grounded answer citing [1].` : null,
    });
    expect(ans.route).toBe("semantic");
    expect(ans.synthesizedBy).toBe("llm");
    expect(ans.answer).toContain("LLM grounded answer");
    // Provenance still attached regardless of who wrote the prose.
    expect(ans.evidence.length).toBeGreaterThan(0);
  });

  it("falls back to the template when the injected LLM returns null", async () => {
    const index = await InMemoryRagIndex.fromGraph(g);
    const ans = await synthesizeAnswer("what is the general sentiment about local building work quality", {
      retrieve: (q, limit) => index.retrieve(q, { limit }),
      runInquiry: (id) => Promise.resolve(access.runInquiry(id)),
      llmSynthesize: async () => null,
    });
    expect(ans.synthesizedBy).toBe("template");
  });
});
