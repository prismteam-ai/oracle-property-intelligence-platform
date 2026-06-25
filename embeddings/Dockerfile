FROM python:3.12-slim

WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    FASTEMBED_CACHE_PATH=/app/.cache

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app.py .

# Bake the model into the image so startup is instant and offline-capable.
RUN python -c "from fastembed import TextEmbedding; list(TextEmbedding(model_name='BAAI/bge-small-en-v1.5').embed(['warmup']))"

ENV EMB_MODEL=BAAI/bge-small-en-v1.5
EXPOSE 8900
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8900"]
