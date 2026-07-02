import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/pg";
import { entityDocuments } from "@/db/schema";
import type { Citation, RagEvidence } from "@/server/ports";
import { getEmbeddingService } from "./embed-client";

const VECTOR_WEIGHT = 0.6;
const FTS_WEIGHT = 0.4;

function citationsFromMetadata(value: unknown): Citation[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as { items?: unknown }).items ?? value;
  if (Array.isArray(raw)) {
    return raw
      .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c) => ({
        label: String(c.label ?? "Public record"),
        url: String(c.url ?? ""),
        recordKey: c.recordKey ? String(c.recordKey) : undefined,
        sourceSystem: c.sourceSystem ? String(c.sourceSystem) : undefined,
      }));
  }
  return [];
}

export async function ragRetrieve(query: string, limit = 8): Promise<RagEvidence[]> {
  const svc = getEmbeddingService();
  const [vector] = await svc.embed([query]);
  if (!vector || vector.length === 0) {
    throw new Error(
      "[oracle] RAG retrieval aborted: the embedding provider returned no vector for the query. " +
        "Refusing to degrade to lexical FTS-only results that look semantic but are not.",
    );
  }

  const vecLiteral = `[${vector.join(",")}]`;
  let rows;
  try {
    rows = await db.execute<{
      document_id: string;
      entity_type: string;
      entity_id: string | null;
      title: string;
      body: string;
      source_uri: string | null;
      citations: unknown;
      vec_score: number;
      fts_score: number;
    }>(sql`
      select
        document_id, entity_type, entity_id, title, body, source_uri, citations,
        1 - (embedding <=> ${vecLiteral}::vector) as vec_score,
        ts_rank(
          to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')),
          websearch_to_tsquery('english', ${query})
        ) as fts_score
      from ${entityDocuments}
      where embedding is not null
      order by embedding <=> ${vecLiteral}::vector
      limit ${limit}
    `);
  } catch (err) {
    throw new Error(
      "[oracle] RAG retrieval aborted: the pgvector path is unavailable or misconfigured " +
        "(extension missing, empty embedding column, or dimension mismatch). " +
        "Refusing to degrade to lexical FTS-only results that look semantic but are not. " +
        `Underlying error: ${(err as Error).message}`,
    );
  }

  return rows.rows
    .map((r) => {
      const vec = Number(r.vec_score) || 0;
      const fts = Number(r.fts_score) || 0;
      return {
        documentId: r.document_id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        title: r.title,
        snippet: r.body.slice(0, 320),
        score: VECTOR_WEIGHT * vec + FTS_WEIGHT * fts,
        vectorScore: vec,
        ftsScore: fts,
        sourceUri: r.source_uri,
        citations: citationsFromMetadata(r.citations),
      };
    })
    .sort((a, b) => b.score - a.score);
}
