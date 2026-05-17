"""FastAPI server for embedding_engine sidecar.

This service provides semantic embedding capabilities for Glyphic.
It exposes HTTP endpoints for:
- Single text embedding
- Batch embedding (NDJSON protocol)
- Similarity search
- Health checks

Usage:
    python main.py
"""

import logging
import time
import json
import numpy as np
from typing import List
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import EmbeddingConfig
from embedding import EmbeddingModel, compute_similarity

# Configure logging
logging.basicConfig(
    level=getattr(logging, EmbeddingConfig.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Glyphic Embedding Engine",
    version="1.0.0",
    description="Semantic embedding service for Glyphic using sentence-transformers"
)

# Global embedding model instance
embedding_model: EmbeddingModel = None

# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class EmbedRequest(BaseModel):
    """Request to embed a single text."""
    text: str


class EmbedResponse(BaseModel):
    """Response with embedding vector."""
    text: str
    embedding: List[float]
    dimension: int
    processing_time_ms: float


class BatchEmbedRequest(BaseModel):
    """Request to embed multiple texts."""
    texts: List[str]


class SimilarityRequest(BaseModel):
    """Request to compute similarity between query and documents."""
    query: str
    documents: List[str]


class SimilarityResponse(BaseModel):
    """Response with similarity scores."""
    query: str
    documents: List[str]
    similarities: List[float]  # One score per document
    processing_time_ms: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model_name: str
    embedding_dimension: int
    device: str


# ---------------------------------------------------------------------------
# Lifecycle Events
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    """Initialize embedding model on server startup."""
    global embedding_model
    try:
        logger.info("Starting embedding_engine sidecar...")
        EmbeddingConfig.verify()
        embedding_model = EmbeddingModel.get_instance(
            model_name=EmbeddingConfig.MODEL_NAME,
            cache_dir=EmbeddingConfig.MODEL_CACHE_DIR,
            device=EmbeddingConfig.DEVICE
        )
        logger.info(
            f"Embedding engine ready on {EmbeddingConfig.HOST}:{EmbeddingConfig.PORT}"
        )
    except Exception as e:
        logger.error(f"Failed to initialize embedding model: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on server shutdown."""
    logger.info("Shutting down embedding_engine sidecar")


# ---------------------------------------------------------------------------
# Health & Status Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    if embedding_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    return HealthResponse(
        status="healthy",
        model_name=embedding_model.model_name,
        embedding_dimension=embedding_model.dimension,
        device=embedding_model.device
    )


@app.get("/status")
async def status():
    """Get server status and configuration."""
    if embedding_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    return {
        "status": "ok",
        "model": embedding_model.model_name,
        "dimension": embedding_model.dimension,
        "device": embedding_model.device,
        "batch_size": EmbeddingConfig.BATCH_SIZE,
        "max_tokens": EmbeddingConfig.MAX_TOKENS
    }


# ---------------------------------------------------------------------------
# Embedding Endpoints
# ---------------------------------------------------------------------------

@app.post("/embed", response_model=EmbedResponse)
async def embed_single(req: EmbedRequest):
    """Generate embedding for a single text.
    
    Args:
        req: EmbedRequest with text field
    
    Returns:
        EmbedResponse with embedding vector
    
    Example:
        POST /embed
        {"text": "What is physics?"}
        
        Response:
        {
            "text": "What is physics?",
            "embedding": [0.12, -0.34, ...],
            "dimension": 384,
            "processing_time_ms": 15.2
        }
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if embedding_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    try:
        start = time.time()
        embedding = embedding_model.embed_single(req.text)
        processing_time = (time.time() - start) * 1000
        
        return EmbedResponse(
            text=req.text,
            embedding=embedding.tolist(),
            dimension=embedding_model.dimension,
            processing_time_ms=processing_time
        )
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed/batch")
async def embed_batch(req: BatchEmbedRequest):
    """Generate embeddings for multiple texts using NDJSON streaming.
    
    This endpoint processes texts in batches and streams results as NDJSON
    (newline-delimited JSON) for efficient memory usage.
    
    Args:
        req: BatchEmbedRequest with texts list
    
    Returns:
        StreamingResponse with NDJSON formatted embeddings
    
    Example:
        POST /embed/batch
        {"texts": ["What is physics?", "Explain calculus"]}
        
        Response (NDJSON):
        {"text": "What is physics?", "embedding": [0.12, -0.34, ...], "index": 0}
        {"text": "Explain calculus", "embedding": [0.45, -0.67, ...], "index": 1}
    """
    if not req.texts:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")
    
    if len(req.texts) > 1000:
        raise HTTPException(
            status_code=400,
            detail="Maximum 1000 texts per request"
        )
    
    if embedding_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    async def generate_ndjson():
        """Generate NDJSON stream of embeddings."""
        try:
            start = time.time()
            embeddings = embedding_model.embed(
                req.texts,
                batch_size=EmbeddingConfig.BATCH_SIZE
            )
            
            for idx, (text, embedding) in enumerate(zip(req.texts, embeddings)):
                result = {
                    "text": text,
                    "embedding": embedding.tolist(),
                    "index": idx,
                    "dimension": embedding_model.dimension
                }
                yield json.dumps(result) + "\n"
            
            # Final summary line
            processing_time = (time.time() - start) * 1000
            summary = {
                "summary": {
                    "count": len(req.texts),
                    "dimension": embedding_model.dimension,
                    "processing_time_ms": processing_time
                }
            }
            yield json.dumps(summary) + "\n"
        except Exception as e:
            logger.error(f"Batch embedding failed: {e}")
            error = {"error": str(e)}
            yield json.dumps(error) + "\n"
    
    return StreamingResponse(generate_ndjson(), media_type="application/x-ndjson")


# ---------------------------------------------------------------------------
# Similarity Search Endpoint
# ---------------------------------------------------------------------------

@app.post("/similarity", response_model=SimilarityResponse)
async def compute_similarity_scores(req: SimilarityRequest):
    """Compute cosine similarity between query and documents.
    
    Args:
        req: SimilarityRequest with query and documents
    
    Returns:
        SimilarityResponse with similarity scores
    
    Example:
        POST /similarity
        {
            "query": "What is physics?",
            "documents": [
                "Physics is the study of matter and energy",
                "Biology is the study of life"
            ]
        }
        
        Response:
        {
            "query": "What is physics?",
            "documents": [...],
            "similarities": [0.85, 0.12],
            "processing_time_ms": 25.3
        }
    """
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    if not req.documents:
        raise HTTPException(status_code=400, detail="Documents list cannot be empty")
    
    if embedding_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    try:
        start = time.time()
        
        # Generate embeddings
        query_embedding = embedding_model.embed_single(req.query)
        doc_embeddings = embedding_model.embed(
            req.documents,
            batch_size=EmbeddingConfig.BATCH_SIZE
        )
        
        # Compute similarity
        similarities = compute_similarity(query_embedding, doc_embeddings)
        processing_time = (time.time() - start) * 1000
        
        return SimilarityResponse(
            query=req.query,
            documents=req.documents,
            similarities=similarities.tolist(),
            processing_time_ms=processing_time
        )
    except Exception as e:
        logger.error(f"Similarity computation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting embedding_engine on {EmbeddingConfig.HOST}:{EmbeddingConfig.PORT}")
    
    uvicorn.run(
        app,
        host=EmbeddingConfig.HOST,
        port=EmbeddingConfig.PORT,
        workers=EmbeddingConfig.WORKERS,
        log_level=EmbeddingConfig.LOG_LEVEL
    )
