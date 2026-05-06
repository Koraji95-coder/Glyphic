#!/usr/bin/env python3
"""
Glyphic Vault Engine
====================

Sidecar for ingesting documents and querying the local knowledge vault.
Communicates via newline-delimited JSON on stdin/stdout.
Every response is flushed immediately.

Supported actions:
  ingest          — extract, chunk, embed and store a file
  ingest_url      — fetch a URL, extract text, chunk, embed and store
  query           — semantic search via embeddings
  search          — full-text keyword search (uses SQLite FTS5)
  generate_flashcards — placeholder; real generation happens in Rust/Ollama
  list_sources    — list all ingested source metadata
  delete_source   — remove a source and its embeddings
"""

import json
import os
import sqlite3
import sys
import uuid
from dataclasses import asdict, dataclass
from typing import Any

# ── Optional dependency imports ───────────────────────────────────────────────
try:
    import chromadb
except ImportError:
    chromadb = None  # type: ignore

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None  # type: ignore

try:
    import docx  # python-docx
except ImportError:
    docx = None  # type: ignore

try:
    from PIL import Image
    import pytesseract
except ImportError:
    Image = None  # type: ignore
    pytesseract = None  # type: ignore

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore

# ── Configuration ─────────────────────────────────────────────────────────────
# ChromaDB persistent store. Set GLYPHIC_CHROMA_PATH to override.
CHROMA_DIR = os.environ.get(
    "GLYPHIC_CHROMA_PATH",
    os.path.join(os.path.expanduser("~"), "Glyphic", "chroma"),
)

# SQLite database for full-text search index and source metadata.
# Kept separate from the Tauri app's glyphic.db to avoid lock contention.
VAULT_DB_PATH = os.environ.get(
    "GLYPHIC_VAULT_DB",
    os.path.join(os.path.expanduser("~"), "Glyphic", "vault.db"),
)

COLLECTION_NAME = "glyphic_vault"

# Approximate token limits (1 token ≈ 4 chars)
TOKEN_LIMIT = 512
OVERLAP = 64


# ── Data model ────────────────────────────────────────────────────────────────
@dataclass
class SourceMeta:
    id: str
    path: str
    label: str
    topic_tags: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# ── I/O helpers ───────────────────────────────────────────────────────────────
def respond(obj: dict[str, Any]) -> None:
    """Write one JSON object to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


# ── ChromaDB helpers ──────────────────────────────────────────────────────────
def get_chroma_client():
    """Return a persistent ChromaDB client using the v0.4.x API."""
    if chromadb is None:
        raise RuntimeError("chromadb is not installed — run pip install -r requirements.txt")
    os.makedirs(CHROMA_DIR, exist_ok=True)
    # PersistentClient is the correct API for chromadb >= 0.4.0
    return chromadb.PersistentClient(path=CHROMA_DIR)


def get_collection(client):
    """Get or create the vault ChromaDB collection."""
    try:
        return client.get_collection(COLLECTION_NAME)
    except Exception:
        return client.create_collection(COLLECTION_NAME)


# ── SQLite FTS helpers ────────────────────────────────────────────────────────
def get_db() -> sqlite3.Connection:
    """Open the vault SQLite database and ensure schema exists."""
    os.makedirs(os.path.dirname(VAULT_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(VAULT_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sources (
            id          TEXT PRIMARY KEY,
            path        TEXT NOT NULL,
            label       TEXT NOT NULL,
            topic_tags  TEXT NOT NULL DEFAULT '[]'
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts
        USING fts5(
            source_id UNINDEXED,
            chunk_index UNINDEXED,
            content
        );
    """)
    conn.commit()
    return conn


# ── Embedding ─────────────────────────────────────────────────────────────────
def load_embedder() -> Any:
    if SentenceTransformer is None:
        raise RuntimeError(
            "sentence-transformers is not installed — run pip install -r requirements.txt"
        )
    return SentenceTransformer("all-MiniLM-L6-v2")


# ── Text extraction ───────────────────────────────────────────────────────────
def read_file_text(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        if fitz is None:
            raise RuntimeError("PyMuPDF is not installed — cannot ingest PDFs")
        doc = fitz.open(path)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text

    if ext in {".doc", ".docx"}:
        if docx is None:
            raise RuntimeError("python-docx is not installed — cannot ingest Word files")
        document = docx.Document(path)
        return "\n".join(p.text for p in document.paragraphs)

    if ext in {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        if Image is None or pytesseract is None:
            raise RuntimeError("Pillow/pytesseract not installed — cannot ingest images")
        img = Image.open(path)
        text = pytesseract.image_to_string(img)
        img.close()
        return text

    # Fallback: plain text
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def chunk_text(text: str) -> list[str]:
    char_limit = TOKEN_LIMIT * 4
    char_overlap = OVERLAP * 4
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + char_limit)
        chunks.append(text[start:end])
        next_start = end - char_overlap
        if next_start <= start:
            break
        start = next_start
    return [c for c in chunks if c.strip()]


# ── Action handlers ───────────────────────────────────────────────────────────
def _do_ingest(
    source_id: str,
    text: str,
    source_path: str,
    source_label: str,
    topic_tags: list[str],
    embedder,
    client,
    db: sqlite3.Connection,
) -> None:
    """Shared ingest logic for files and URLs."""
    chunks = chunk_text(text)
    total = len(chunks)
    collection = get_collection(client)

    # Batch encode all chunks at once for efficiency
    try:
        embeddings = embedder.encode(chunks)  # numpy array shape (n, dim)
    except Exception as e:
        respond({"status": "error", "error": f"embedding failed: {e}"})
        return

    chunk_ids = [f"{source_id}-{i}" for i in range(total)]

    # ChromaDB metadata values must be scalars (str, int, float, bool).
    # Store topic_tags as a JSON string and decode on read.
    tags_str = json.dumps(topic_tags)
    metadatas = [
        {
            "source_id": source_id,
            "chunk_index": i,
            "label": source_label,
            "path": source_path,
            "topic_tags": tags_str,  # ← serialized, not a list
        }
        for i in range(total)
    ]

    # Add to ChromaDB in batches of 100 to avoid memory spikes
    batch_size = 100
    for batch_start in range(0, total, batch_size):
        batch_end = min(total, batch_start + batch_size)
        try:
            collection.add(
                ids=chunk_ids[batch_start:batch_end],
                # .tolist() converts numpy array to plain Python list
                embeddings=embeddings[batch_start:batch_end].tolist(),
                documents=chunks[batch_start:batch_end],
                metadatas=metadatas[batch_start:batch_end],
            )
        except Exception as e:
            respond({"status": "error", "error": f"failed to store embeddings: {e}"})
            return
        respond({
            "status": "progress",
            "chunks_processed": batch_end,
            "total_chunks": total,
        })

    # Store source metadata in SQLite
    db.execute(
        "INSERT OR REPLACE INTO sources (id, path, label, topic_tags) VALUES (?, ?, ?, ?)",
        (source_id, source_path, source_label, tags_str),
    )

    # Index chunks in FTS5 for keyword search
    db.executemany(
        "INSERT INTO chunks_fts (source_id, chunk_index, content) VALUES (?, ?, ?)",
        [(source_id, i, chunks[i]) for i in range(total)],
    )
    db.commit()

    respond({"status": "complete", "source_id": source_id, "chunks": total})


def ingest_file(req: dict, embedder, client, db: sqlite3.Connection) -> None:
    path: str = req.get("path", "")
    topic_tags: list[str] = req.get("topic_tags", [])
    source_label: str = req.get("source_label", os.path.basename(path))

    if not path or not os.path.isabs(path):
        respond({"status": "error", "error": "ingest requires an absolute file path"})
        return
    if not os.path.exists(path):
        respond({"status": "error", "error": f"file not found: {path}"})
        return

    try:
        text = read_file_text(path)
    except Exception as e:
        respond({"status": "error", "error": f"failed to read file: {e}"})
        return

    _do_ingest(str(uuid.uuid4()), text, path, source_label, topic_tags, embedder, client, db)


def ingest_url(req: dict, embedder, client, db: sqlite3.Connection) -> None:
    url: str = req.get("url", "").strip()
    topic_tags: list[str] = req.get("topic_tags", [])
    source_label: str = req.get("source_label", url)

    if not url:
        respond({"status": "error", "error": "ingest_url requires a URL"})
        return

    try:
        import requests
        from bs4 import BeautifulSoup  # type: ignore
    except ImportError:
        respond({"status": "error", "error": "requests and beautifulsoup4 are required"})
        return

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        respond({"status": "error", "error": f"failed to fetch URL: {e}"})
        return

    from bs4 import BeautifulSoup  # type: ignore
    text = BeautifulSoup(resp.text, "html.parser").get_text(separator="\n")
    _do_ingest(str(uuid.uuid4()), text, url, source_label, topic_tags, embedder, client, db)


def query_vault(req: dict, embedder, client) -> None:
    question: str = req.get("question", "").strip()
    topic_filter: list[str] = req.get("topic_filter", [])
    n_results: int = int(req.get("n_results", 5))

    if not question:
        respond({"status": "error", "error": "query requires a non-empty question"})
        return

    try:
        q_vec = embedder.encode([question])[0].tolist()
    except Exception as e:
        respond({"status": "error", "error": f"embedding failed: {e}"})
        return

    collection = get_collection(client)
    try:
        results = collection.query(query_embeddings=[q_vec], n_results=n_results)
    except Exception as e:
        respond({"status": "error", "error": f"query failed: {e}"})
        return

    matches = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(docs, metas, distances):
        # Deserialize topic_tags from JSON string back to list
        stored_tags = json.loads(meta.get("topic_tags", "[]"))
        if topic_filter and not any(tag in stored_tags for tag in topic_filter):
            continue
        matches.append({
            "chunk": doc,
            "metadata": {**meta, "topic_tags": stored_tags},
            "score": float(dist),
        })

    respond({"status": "results", "results": matches})


def search_vault(req: dict, db: sqlite3.Connection) -> None:
    """
    Full-text keyword search using SQLite FTS5.
    This is fast regardless of vault size because FTS5 maintains an index.
    ChromaDB has no built-in full-text search; do NOT use collection.get() for this.
    """
    keywords: str = req.get("keywords", "").strip()
    topic_filter: list[str] = req.get("topic_filter", [])

    if not keywords:
        respond({"status": "error", "error": "search requires keywords"})
        return

    try:
        rows = db.execute(
            """
            SELECT f.source_id, f.chunk_index, f.content,
                   s.label, s.path, s.topic_tags
            FROM chunks_fts f
            JOIN sources s ON s.id = f.source_id
            WHERE chunks_fts MATCH ?
            LIMIT 50
            """,
            (keywords,),
        ).fetchall()
    except Exception as e:
        respond({"status": "error", "error": f"search failed: {e}"})
        return

    matches = []
    for row in rows:
        stored_tags = json.loads(row["topic_tags"])
        if topic_filter and not any(tag in stored_tags for tag in topic_filter):
            continue
        matches.append({
            "chunk": row["content"],
            "metadata": {
                "source_id": row["source_id"],
                "chunk_index": row["chunk_index"],
                "label": row["label"],
                "path": row["path"],
                "topic_tags": stored_tags,
            },
        })

    respond({"status": "results", "results": matches})


def list_sources(db: sqlite3.Connection) -> None:
    rows = db.execute(
        "SELECT id, path, label, topic_tags FROM sources ORDER BY rowid DESC"
    ).fetchall()
    sources = [
        {
            "id": row["id"],
            "path": row["path"],
            "label": row["label"],
            "topic_tags": json.loads(row["topic_tags"]),
        }
        for row in rows
    ]
    respond({"status": "sources", "sources": sources})


def delete_source(req: dict, client, db: sqlite3.Connection) -> None:
    source_id: str = req.get("source_id", "").strip()
    if not source_id:
        respond({"status": "error", "error": "delete_source requires source_id"})
        return

    collection = get_collection(client)

    # Delete from ChromaDB — fetch ids for this source first
    try:
        result = collection.get(where={"source_id": source_id}, include=[])
        ids_to_delete = result.get("ids", [])
        if ids_to_delete:
            collection.delete(ids=ids_to_delete)
    except Exception as e:
        respond({"status": "error", "error": f"failed to delete embeddings: {e}"})
        return

    # Delete from SQLite
    db.execute("DELETE FROM chunks_fts WHERE source_id = ?", (source_id,))
    db.execute("DELETE FROM sources WHERE id = ?", (source_id,))
    db.commit()

    respond({"status": "complete", "deleted_source_id": source_id})


def generate_flashcards(req: dict, db: sqlite3.Connection) -> None:
    """
    Placeholder: returns raw chunks for the given source so the Rust layer
    can send them to Ollama for real flashcard generation.
    The sentence-splitting approach is not used — LLM generation is superior.
    """
    source_id: str = req.get("source_id", "").strip()
    n: int = int(req.get("n", 5))

    if not source_id:
        respond({"status": "error", "error": "generate_flashcards requires source_id"})
        return

    rows = db.execute(
        "SELECT content FROM chunks_fts WHERE source_id = ? LIMIT ?",
        (source_id, n),
    ).fetchall()

    chunks = [row["content"] for row in rows]
    respond({"status": "chunks_for_flashcards", "source_id": source_id, "chunks": chunks})


# ── Main loop ─────────────────────────────────────────────────────────────────
def main() -> None:
    try:
        client = get_chroma_client()
        embedder = load_embedder()
        db = get_db()
    except Exception as e:
        respond({"status": "error", "error": f"startup failed: {e}"})
        return

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            respond({"status": "error", "error": "invalid JSON"})
            continue

        action = req.get("action")
        try:
            if action == "ingest":
                ingest_file(req, embedder, client, db)
            elif action == "ingest_url":
                ingest_url(req, embedder, client, db)
            elif action == "query":
                query_vault(req, embedder, client)
            elif action == "search":
                search_vault(req, db)
            elif action == "list_sources":
                list_sources(db)
            elif action == "delete_source":
                delete_source(req, client, db)
            elif action == "generate_flashcards":
                generate_flashcards(req, db)
            else:
                respond({"status": "error", "error": f"unknown action: {action}"})
        except Exception as e:
            respond({"status": "error", "error": f"unhandled error in {action}: {e}"})


if __name__ == "__main__":
    main()
