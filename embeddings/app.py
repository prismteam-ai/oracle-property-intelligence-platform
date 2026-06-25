"""Local embedding microservice for Oracle's RAG layer.

Uses fastembed (ONNX, no torch) with BAAI/bge-small-en-v1.5 (384-dim) so the
platform has fully-local semantic search with no external API dependency.
"""
import os
from typing import List

from fastapi import FastAPI
from pydantic import BaseModel
from fastembed import TextEmbedding

MODEL = os.environ.get("EMB_MODEL", "BAAI/bge-small-en-v1.5")
_model = TextEmbedding(model_name=MODEL)

app = FastAPI(title="Oracle Embeddings", version="1.0")


class EmbedRequest(BaseModel):
    texts: List[str]


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL, "dim": 384}


@app.post("/embed")
def embed(req: EmbedRequest):
    vectors = [vec.tolist() for vec in _model.embed(req.texts)]
    return {"embeddings": vectors, "dim": len(vectors[0]) if vectors else 0}
