"""Core embedding generation logic using sentence-transformers."""

import os
import logging
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class EmbeddingModel:
    """Wrapper around sentence-transformers model."""
    
    _instance: Optional['EmbeddingModel'] = None
    
    def __init__(self, model_name: str, cache_dir: str, device: str = "cpu"):
        """Initialize embedding model (singleton).
        
        Args:
            model_name: HuggingFace model identifier (e.g., sentence-transformers/all-MiniLM-L6-v2)
            cache_dir: Directory to cache model weights
            device: 'cpu' or 'cuda'
        """
        self.model_name = model_name
        self.device = device
        self.cache_dir = cache_dir
        
        # Create cache directory if needed
        os.makedirs(cache_dir, exist_ok=True)
        
        # Load model on first access
        self.model = None
        self.dimension = None
        self._load_model()
    
    def _load_model(self) -> None:
        """Load the sentence-transformers model."""
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            self.model = SentenceTransformer(
                self.model_name,
                cache_folder=self.cache_dir,
                device=self.device
            )
            self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"Model loaded successfully. Dimension: {self.dimension}")
        except Exception as e:
            logger.error(f"Failed to load model {self.model_name}: {e}")
            raise
    
    def embed(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Generate embeddings for a batch of texts.
        
        Args:
            texts: List of text strings to embed
            batch_size: Process texts in batches of this size
        
        Returns:
            Numpy array of shape (len(texts), embedding_dimension)
        """
        if not texts:
            return np.array([])
        
        try:
            # Use sentence-transformers batch processing
            embeddings = self.model.encode(
                texts,
                batch_size=batch_size,
                show_progress_bar=False,
                normalize_embeddings=True  # L2 normalized for cosine similarity
            )
            return embeddings
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise
    
    def embed_single(self, text: str) -> np.ndarray:
        """Generate embedding for a single text.
        
        Args:
            text: Text string to embed
        
        Returns:
            Numpy array of shape (embedding_dimension,)
        """
        if not text:
            return np.zeros(self.dimension)
        
        embeddings = self.embed([text], batch_size=1)
        return embeddings[0]
    
    @classmethod
    def get_instance(
        cls,
        model_name: str,
        cache_dir: str,
        device: str = "cpu"
    ) -> 'EmbeddingModel':
        """Get or create singleton instance."""
        if cls._instance is None:
            cls._instance = cls(model_name, cache_dir, device)
        return cls._instance
    
    @classmethod
    def reset_instance(cls) -> None:
        """Reset singleton instance (for testing)."""
        cls._instance = None


def compute_similarity(
    query_embedding: np.ndarray,
    doc_embeddings: np.ndarray
) -> np.ndarray:
    """Compute cosine similarity between query and documents.
    
    Args:
        query_embedding: Shape (embedding_dimension,)
        doc_embeddings: Shape (num_docs, embedding_dimension)
    
    Returns:
        Array of similarity scores (shape: num_docs,), range [0, 1]
    """
    if len(doc_embeddings) == 0:
        return np.array([])
    
    # Cosine similarity (dot product since embeddings are L2 normalized)
    similarities = np.dot(doc_embeddings, query_embedding)
    
    # Ensure range [0, 1]
    similarities = np.clip(similarities, 0.0, 1.0)
    
    return similarities
