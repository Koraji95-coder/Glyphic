# Glyphic Embedding Engine

**Status**: Phase 2 Backend Infrastructure  
**Model**: `sentence-transformers/all-MiniLM-L6-v2` (22MB, CPU-friendly)  
**Framework**: FastAPI + sentence-transformers  
**Port**: 8001 (default)

---

## Overview

The embedding_engine is a FastAPI microservice that provides semantic embedding capabilities for Glyphic. It generates vector embeddings for text using the **all-MiniLM-L6-v2** model, which is:

- **Lightweight**: 22MB model size
- **Fast**: Inference on CPU in ~10-50ms per text
- **Accurate**: Strong semantic understanding for educational content
- **Efficient**: Supports batch processing with configurable batch sizes

### Key Features

- ✅ Single text embedding (synchronous)
- ✅ Batch embedding with NDJSON streaming
- ✅ Cosine similarity computation
- ✅ Health checks and status endpoints
- ✅ Configurable device (CPU/CUDA)
- ✅ Automatic model caching

---

## Installation

### Prerequisites

- Python 3.9+
- pip or conda

### Setup

```bash
# Navigate to embedding engine directory
cd backend/sidecars/embedding_engine

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create model cache directory
mkdir -p ~/.glyphic/embedding_models
```

---

## Usage

### Start Server

```bash
# Development mode
python main.py

# Production mode (with uvicorn workers)
EMBEDDING_WORKERS=4 python main.py

# Custom configuration
EMBEDDING_DEVICE=cuda EMBEDDING_HOST=0.0.0.0 EMBEDDING_PORT=9000 python main.py
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | HuggingFace model identifier |
| `EMBEDDING_HOST` | `127.0.0.1` | Server bind address |
| `EMBEDDING_PORT` | `8001` | Server port |
| `EMBEDDING_DEVICE` | `cpu` | Inference device (`cpu` or `cuda`) |
| `EMBEDDING_BATCH_SIZE` | `32` | Batch size for inference |
| `EMBEDDING_MAX_TOKENS` | `512` | Maximum tokens per text |
| `EMBEDDING_CACHE_DIR` | `~/.glyphic/embedding_models` | Model cache directory |
| `EMBEDDING_LOG_LEVEL` | `info` | Logging level |
| `EMBEDDING_WORKERS` | `1` | Number of uvicorn workers |

### API Endpoints

#### 1. Health Check

```bash
GET /health

Response:
{
  "status": "healthy",
  "model_name": "sentence-transformers/all-MiniLM-L6-v2",
  "embedding_dimension": 384,
  "device": "cpu"
}
```

#### 2. Status

```bash
GET /status

Response:
{
  "status": "ok",
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "dimension": 384,
  "device": "cpu",
  "batch_size": 32,
  "max_tokens": 512
}
```

#### 3. Single Text Embedding

```bash
POST /embed
Content-Type: application/json

{
  "text": "What is physics?"
}

Response:
{
  "text": "What is physics?",
  "embedding": [0.123, -0.456, ...],  # 384-dimensional vector
  "dimension": 384,
  "processing_time_ms": 12.5
}
```

#### 4. Batch Embedding (NDJSON)

```bash
POST /embed/batch
Content-Type: application/json

{
  "texts": [
    "What is physics?",
    "Explain calculus",
    "Define integration"
  ]
}

Response (NDJSON):
{"text": "What is physics?", "embedding": [...], "index": 0, "dimension": 384}
{"text": "Explain calculus", "embedding": [...], "index": 1, "dimension": 384}
{"text": "Define integration", "embedding": [...], "index": 2, "dimension": 384}
{"summary": {"count": 3, "dimension": 384, "processing_time_ms": 35.2}}
```

#### 5. Similarity Search

```bash
POST /similarity
Content-Type: application/json

{
  "query": "What is physics?",
  "documents": [
    "Physics is the study of matter and energy",
    "Biology is the study of life",
    "Physics involves mechanics and thermodynamics"
  ]
}

Response:
{
  "query": "What is physics?",
  "documents": [...],
  "similarities": [0.87, 0.12, 0.92],  # One score per document
  "processing_time_ms": 28.3
}
```

---

## Integration with Glyphic

### Phase 2 Integration Points

1. **Scout Agent** (Semantic Search)
   - Query embedding via `/embed` endpoint
   - Document embeddings cached in `note_embeddings` table (sqlite-vec)
   - Similarity ranking: `POST /similarity` endpoint

2. **Mastery Engine** (Phase 2)
   - Embed topic descriptions and student notes
   - Use similarity to identify knowledge gaps

3. **Tauri IPC** (Main App ↔ Sidecar)
   - Auto-started by Tauri on app launch
   - HTTP communication on localhost:8001
   - Graceful shutdown on app close

### Example: Semantic Search Flow

```
Frontend: Scout Agent receives user query
    ↓
Glyphic Main App: Tauri command `search_semantic(query: String)`
    ↓
Rust Backend: Make HTTP request to embedding_engine
    ↓
embedding_engine: POST /embed → generate query_embedding
    ↓
Rust Backend: Query sqlite-vec for top-K similar notes
    ↓
Rust Backend: POST /similarity → rank results
    ↓
Frontend: Display ranked results with confidence scores
```

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Single embedding | < 20ms | CPU inference, all-MiniLM |
| Batch (32 texts) | < 100ms | Amortized ~3ms per text |
| Batch (100 texts) | < 300ms | Supports up to 1000 texts |
| Similarity search | < 50ms | On 100 documents |
| Model load time | < 5s | First startup only |
| Memory footprint | < 500MB | Model + inference buffers |
| Model size | 22MB | Disk storage (HuggingFace cache) |

---

## Testing

### Unit Tests

```bash
# Run all tests
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=html
```

### Manual Testing

```bash
# Test health check
curl http://127.0.0.1:8001/health

# Test single embedding
curl -X POST http://127.0.0.1:8001/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "What is physics?"}'

# Test similarity
curl -X POST http://127.0.0.1:8001/similarity \
  -H "Content-Type: application/json" \
  -d '{
    "query": "physics",
    "documents": ["Physics is the study of matter", "Biology is the study of life"]
  }'
```

### Load Testing

```bash
# Test throughput with 100 concurrent requests
pip install locust

# Create locustfile (see tests/locustfile.py)
locust -f tests/locustfile.py --headless -u 100 -r 10 -t 60s
```

---

## Architecture

### Model: all-MiniLM-L6-v2

- **Architecture**: Sentence-Transformers with MiniLM-L6 backbone
- **Dimension**: 384-dimensional embeddings
- **Training**: Fine-tuned on 1B+ sentence pairs
- **Strengths**:
  - Excellent semantic understanding
  - Fast inference (CPU-friendly)
  - Small model size (22MB)
  - Strong on technical/educational content
- **Weaknesses**:
  - Less specialized than domain-specific models
  - May miss very fine-grained similarities

### Similarity Metric: Cosine

- Embeddings are L2-normalized
- Cosine similarity = dot product of normalized vectors
- Range: [0, 1] where 1 = identical, 0 = orthogonal
- Fast computation: O(n) for n documents

### NDJSON Protocol

- Each result is a JSON object on its own line
- Enables streaming large batches without buffering
- Parseable line-by-line by consuming client
- Final summary line includes aggregate statistics

---

## Troubleshooting

### Issue: Slow First Startup

**Cause**: Model download and cache initialization  
**Solution**: First startup may take 30-60s. Subsequent startups use cached model (~5s).

```bash
# Pre-download model (optional)
python -c "from sentence_transformers import SentenceTransformer; \
  SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', \
  cache_folder='~/.glyphic/embedding_models')"
```

### Issue: Out of Memory

**Cause**: Batch size too large or insufficient RAM  
**Solution**: Reduce batch size via environment variable

```bash
EMBEDDING_BATCH_SIZE=8 python main.py
```

### Issue: CUDA Out of Memory

**Cause**: GPU memory exhausted  
**Solution**: Fall back to CPU (all-MiniLM is CPU-friendly anyway)

```bash
EMBEDDING_DEVICE=cpu python main.py
```

### Issue: Connection Refused

**Cause**: Service not started or port already in use  
**Solution**: Check service is running and port is available

```bash
# Check if service is running
lsof -i :8001

# Use different port
EMBEDDING_PORT=9001 python main.py
```

---

## Future Improvements

- [ ] Support multiple model architectures (e.g., E5, BGE)
- [ ] GPU acceleration (CUDA, TPU)
- [ ] Model quantization (reduce from 22MB to 5MB)
- [ ] Redis caching for frequently embedded texts
- [ ] Distributed embedding with model sharding
- [ ] Metadata indexing (note_id, recency, mastery_gap)
- [ ] Vector database integration (e.g., FAISS, Milvus)

---

## References

- **sentence-transformers**: https://www.sbert.net/
- **all-MiniLM-L6-v2**: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- **FastAPI**: https://fastapi.tiangolo.com/
- **NDJSON**: https://github.com/ndjson/ndjson-spec
