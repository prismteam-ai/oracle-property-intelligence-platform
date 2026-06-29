"""Offline embeddings sidecar for the Oracle RAG layer.

Exposes POST /embed { texts: [...], model } -> { embeddings: [[...384]] } using
fastembed (BAAI/bge-small-en-v1.5, 384-dim). No API key, fully offline. This is
the local EmbeddingService implementation behind src/server/rag/embed-client.ts.
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel
from fastembed import TextEmbedding

MODEL_NAME = "BAAI/bge-small-en-v1.5"
DIM = 384

app = FastAPI(title="oracle-embeddings")
_model = TextEmbedding(MODEL_NAME)


class EmbedRequest(BaseModel):
    texts: list[str]
    model: str | None = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL_NAME, "dim": DIM}


@app.post("/embed")
def embed(req: EmbedRequest) -> dict:
    vectors = [list(map(float, v)) for v in _model.embed(req.texts)]
    return {"model": MODEL_NAME, "dim": DIM, "embeddings": vectors}
