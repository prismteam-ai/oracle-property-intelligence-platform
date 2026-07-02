# Offline embeddings sidecar — fastembed (BAAI/bge-small-en-v1.5, 384-dim, ONNX).
# The model is baked into the image so the demo needs no API key and no network.
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir fastembed fastapi uvicorn
COPY server.py ./
# Warm the model into the image layer (downloads ONNX weights once at build).
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"
EXPOSE 8080
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
