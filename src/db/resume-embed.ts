import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/server/pg";
import { entityDocuments } from "@/db/schema";
import { getEmbeddingService } from "@/server/rag/embed-client";
import { BedrockTitanEmbeddingService } from "@/server/rag/embed-bedrock";

const CHUNK = Number(process.env.BEDROCK_EMBED_CHUNK ?? 64);

async function writeVectors(
  pairs: { documentId: string; vec: number[] }[],
  model: string,
  dim: number,
): Promise<void> {
  if (pairs.length === 0) return;
  const values = pairs.map(
    (p) => sql`(${p.documentId}::uuid, ${`[${p.vec.join(",")}]`}::vector)`,
  );
  await db.execute(sql`
    update ${entityDocuments} as ed
    set embedding = v.vec,
        embedding_model = ${model},
        embedding_dim = ${dim},
        updated_at = now()
    from (values ${sql.join(values, sql`, `)}) as v(document_id, vec)
    where ed.document_id = v.document_id
  `);
}

async function main(): Promise<void> {
  const svc = getEmbeddingService();
  if (!(svc instanceof BedrockTitanEmbeddingService)) {
    throw new Error(
      `[oracle] resume-embed requires EMBEDDING_PROVIDER=bedrock; got "${svc.model}". ` +
        "Refusing to embed the corpus with a non-Titan provider.",
    );
  }

  const pending = await db
    .select({
      documentId: entityDocuments.documentId,
      title: entityDocuments.title,
      body: entityDocuments.body,
    })
    .from(entityDocuments)
    .where(sql`${entityDocuments.embedding} is null`);

  process.stdout.write(`resume-embed: ${pending.length} rows pending under ${svc.model}\n`);

  const startedAt = Date.now();
  let embedded = 0;

  for (let start = 0; start < pending.length; start += CHUNK) {
    const chunk = pending.slice(start, start + CHUNK);
    const vectors = await svc.embedConcurrent(chunk.map((r) => `${r.title}\n${r.body}`));
    await writeVectors(
      chunk.map((r, i) => ({ documentId: r.documentId, vec: vectors[i]! })),
      svc.model,
      svc.dim,
    );
    embedded += chunk.length;
    const elapsedS = (Date.now() - startedAt) / 1000;
    process.stdout.write(
      `embedded ${embedded}/${pending.length} (~${Math.round((embedded / elapsedS) * 60)}/min)\n`,
    );
  }

  process.stdout.write("Rebuilding HNSW cosine index...\n");
  await db.execute(sql`drop index if exists entity_documents_embedding_hnsw_idx`);
  await db.execute(sql`
    create index entity_documents_embedding_hnsw_idx
    on entity_documents using hnsw (embedding vector_cosine_ops)
  `);

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);
  process.stdout.write(`Resume-embed done: ${embedded} newly embedded in ${elapsedS}s.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Resume-embed failed:", err);
  process.exit(1);
});
