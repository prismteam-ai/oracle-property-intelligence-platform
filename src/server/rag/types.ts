export type Citation = {
  label: string;
  url: string | null;
  recordKey?: string | null;
  sourceSystem?: string | null;
};

export type RagEvidence = {
  documentId: string;
  entityType: string;
  entityId: string | null;
  title: string;
  snippet: string;
  score: number;
  vectorScore?: number;
  ftsScore?: number;
  sourceUri?: string | null;
  citations: Citation[];
};

export type RagMode = "structured" | "semantic" | "none";

export type RagAnswer = {
  question: string;
  answer: string;
  mode: RagMode;
  route: "structured" | "semantic";
  synthesizedBy: "llm" | "template";
  evidence: RagEvidence[];
  citations: Citation[];
};

export interface EmbeddingService {
  readonly model: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
  embedConcurrent?(
    texts: string[],
    concurrency?: number,
    onProgress?: (done: number) => void,
  ): Promise<number[][]>;
}
