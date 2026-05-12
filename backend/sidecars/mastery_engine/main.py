"""FastAPI server for mastery_engine sidecar.

This service provides Bayesian mastery modeling for Glyphic.
It computes posterior mastery distributions based on student attempt history.

Usage:
    python main.py
"""

import logging
import time
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from model import BayesianMasteryModel, MasteryEstimate

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Glyphic Mastery Engine",
    version="1.0.0",
    description="Bayesian mastery modeling service for Glyphic using PyMC"
)

# Global model instance
mastery_model: Optional[BayesianMasteryModel] = None

# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------

class AttemptRecord(BaseModel):
    """Single student attempt."""
    topic: str
    correct: bool
    timestamp: Optional[str] = None


class ComputeMasteryRequest(BaseModel):
    """Request to compute mastery for a topic."""
    topic: str
    n_correct: int
    n_total: int


class ComputeMasteryResponse(BaseModel):
    """Response with mastery estimate."""
    topic: str
    point_estimate: float
    lower_95: float
    upper_95: float
    probability_mastery: float
    sample_count: int
    batch_id: str


class BatchUpdateRequest(BaseModel):
    """Request to update mastery for multiple topics."""
    attempts: List[AttemptRecord]
    batch_id: str = "batch_1"


class BatchUpdateResponse(BaseModel):
    """Response with mastery estimates for multiple topics."""
    topics: Dict[str, ComputeMasteryResponse]
    processing_time_ms: float
    batch_id: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model: str
    prior_alpha: float
    prior_beta: float


# ---------------------------------------------------------------------------
# Lifecycle Events
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    """Initialize mastery model on server startup."""
    global mastery_model
    try:
        logger.info("Starting mastery_engine sidecar...")
        mastery_model = BayesianMasteryModel(prior_alpha=2.0, prior_beta=5.0)
        logger.info("Mastery engine ready on 127.0.0.1:8002")
    except Exception as e:
        logger.error(f"Failed to initialize mastery model: {e}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on server shutdown."""
    logger.info("Shutting down mastery_engine sidecar")


# ---------------------------------------------------------------------------
# Health & Status Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    if mastery_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    return HealthResponse(
        status="healthy",
        model="BayesianMasteryModel (Beta-Binomial)",
        prior_alpha=mastery_model.prior_alpha,
        prior_beta=mastery_model.prior_beta
    )


@app.get("/status")
async def status():
    """Get server status."""
    if mastery_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    return {
        "status": "ok",
        "model": "BayesianMasteryModel",
        "prior": {
            "alpha": mastery_model.prior_alpha,
            "beta": mastery_model.prior_beta,
            "prior_mean": mastery_model.prior_alpha / (mastery_model.prior_alpha + mastery_model.prior_beta)
        }
    }


# ---------------------------------------------------------------------------
# Mastery Computation Endpoints
# ---------------------------------------------------------------------------

@app.post("/compute", response_model=ComputeMasteryResponse)
async def compute_mastery(req: ComputeMasteryRequest):
    """Compute mastery estimate for a topic.
    
    Uses analytical Beta-Binomial conjugate prior for fast, exact inference.
    
    Args:
        req: ComputeMasteryRequest with topic, n_correct, n_total
    
    Returns:
        ComputeMasteryResponse with posterior summary statistics
    
    Example:
        POST /compute
        {
            "topic": "calculus_integration",
            "n_correct": 7,
            "n_total": 10
        }
        
        Response:
        {
            "topic": "calculus_integration",
            "point_estimate": 0.68,
            "lower_95": 0.45,
            "upper_95": 0.85,
            "probability_mastery": 0.32,
            "sample_count": 10,
            "batch_id": "single"
        }
    """
    if req.n_total <= 0:
        raise HTTPException(status_code=400, detail="n_total must be > 0")
    
    if req.n_correct < 0 or req.n_correct > req.n_total:
        raise HTTPException(status_code=400, detail="n_correct must be in [0, n_total]")
    
    if mastery_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    try:
        start = time.time()
        estimate = mastery_model.compute_posterior_analytical(
            req.n_correct,
            req.n_total,
            mastery_threshold=0.7
        )
        estimate.topic = req.topic
        estimate.batch_id = "single"
        processing_time = (time.time() - start) * 1000
        
        return ComputeMasteryResponse(
            topic=estimate.topic,
            point_estimate=estimate.point_estimate,
            lower_95=estimate.lower_95,
            upper_95=estimate.upper_95,
            probability_mastery=estimate.probability_mastery,
            sample_count=estimate.sample_count,
            batch_id=estimate.batch_id
        )
    except Exception as e:
        logger.error(f"Mastery computation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch", response_model=BatchUpdateResponse)
async def batch_update(req: BatchUpdateRequest):
    """Compute mastery for multiple topics from a batch of attempts.
    
    Aggregates attempts by topic and computes posterior for each.
    
    Args:
        req: BatchUpdateRequest with attempts list and batch_id
    
    Returns:
        BatchUpdateResponse with mastery estimates per topic
    
    Example:
        POST /batch
        {
            "attempts": [
                {"topic": "calculus_integration", "correct": true},
                {"topic": "calculus_integration", "correct": false},
                {"topic": "linear_algebra", "correct": true}
            ],
            "batch_id": "session_2026_05_11"
        }
        
        Response:
        {
            "topics": {
                "calculus_integration": {...},
                "linear_algebra": {...}
            },
            "processing_time_ms": 5.2,
            "batch_id": "session_2026_05_11"
        }
    """
    if not req.attempts:
        raise HTTPException(status_code=400, detail="Attempts list cannot be empty")
    
    if mastery_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")
    
    try:
        start = time.time()
        
        # Convert to dict format for model
        attempt_dicts = [
            {"topic": a.topic, "correct": a.correct}
            for a in req.attempts
        ]
        
        # Compute mastery for all topics
        results = mastery_model.batch_update(attempt_dicts, req.batch_id)
        
        # Convert to response format
        topics_response = {
            topic: ComputeMasteryResponse(
                topic=estimate.topic,
                point_estimate=estimate.point_estimate,
                lower_95=estimate.lower_95,
                upper_95=estimate.upper_95,
                probability_mastery=estimate.probability_mastery,
                sample_count=estimate.sample_count,
                batch_id=estimate.batch_id
            )
            for topic, estimate in results.items()
        }
        
        processing_time = (time.time() - start) * 1000
        
        return BatchUpdateResponse(
            topics=topics_response,
            processing_time_ms=processing_time,
            batch_id=req.batch_id
        )
    except Exception as e:
        logger.error(f"Batch update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    
    logger.info("Starting mastery_engine on 127.0.0.1:8002")
    
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8002,
        workers=1,
        log_level="info"
    )
