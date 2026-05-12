"""Configuration for embedding_engine sidecar."""

import os
from typing import Optional

class EmbeddingConfig:
    """Embedding engine configuration."""
    
    # Model settings
    MODEL_NAME: str = os.getenv(
        "EMBEDDING_MODEL", 
        "sentence-transformers/all-MiniLM-L6-v2"
    )
    MODEL_CACHE_DIR: str = os.getenv(
        "EMBEDDING_CACHE_DIR",
        os.path.expanduser("~/.glyphic/embedding_models")
    )
    
    # Server settings
    HOST: str = os.getenv("EMBEDDING_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("EMBEDDING_PORT", "8001"))
    WORKERS: int = int(os.getenv("EMBEDDING_WORKERS", "1"))
    
    # Performance settings
    BATCH_SIZE: int = int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))
    MAX_TOKENS: int = int(os.getenv("EMBEDDING_MAX_TOKENS", "512"))
    
    # Inference settings
    DEVICE: str = os.getenv("EMBEDDING_DEVICE", "cpu")  # 'cpu' or 'cuda'
    
    # Logging
    LOG_LEVEL: str = os.getenv("EMBEDDING_LOG_LEVEL", "info").lower()
    
    @classmethod
    def verify(cls) -> bool:
        """Verify configuration is valid."""
        if not cls.MODEL_NAME:
            raise ValueError("MODEL_NAME not configured")
        if cls.PORT < 1024 or cls.PORT > 65535:
            raise ValueError(f"Invalid PORT: {cls.PORT}")
        if cls.BATCH_SIZE < 1:
            raise ValueError(f"Invalid BATCH_SIZE: {cls.BATCH_SIZE}")
        return True
