"""Server-side caches for the translation pipeline.

Two independent caches sit in front of the paid provider calls:

* :class:`OcrCache` — in-memory LRU. Keyed by image content hash plus the OCR
  engine identity, so re-running OCR on the exact same page (same engine,
  same source language) is free. Cleared on server restart.
* :class:`TranslationCache` — SQLite-backed. Keyed by the normalised source
  text plus the target language code plus the translation engine. Persists
  across restarts so onomatopoeias / very short replies / repeated phrases
  cost exactly one provider call across the entire history of the app.

Both caches are designed so they can be **independently disabled** at config
time without code changes (they short-circuit on every operation), and so
the test suite can spin up isolated instances pointing at temporary files.

Both caches store **plain Python primitives** (dicts/strings), never live
Pydantic instances. That keeps them safe against accidental mutation by
callers downstream — every ``get`` returns a freshly rehydrated copy.
"""
from __future__ import annotations

import hashlib
import logging
import sqlite3
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Iterable

from ..schemas.common import EngineId, TextBubble

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def hash_image(image_bytes: bytes) -> str:
    """Return the lowercase hex SHA-256 of the given image bytes.

    Hex (not base64) is used so the value is safe inside cache keys, log
    lines, and human-readable diagnostics.
    """
    return hashlib.sha256(image_bytes).hexdigest()


def normalise_source_text(text: str) -> str:
    """Normalise text for translation cache lookups.

    Two source bubbles that differ only in surrounding whitespace must hit
    the same cache entry, since the providers themselves treat them as
    interchangeable. Internal whitespace is preserved (newlines inside a
    bubble can change the meaning).
    """
    return (text or "").strip()


# ---------------------------------------------------------------------------
# OCR cache (in-memory LRU)
# ---------------------------------------------------------------------------


class OcrCache:
    """Bounded in-memory LRU cache for OCR results.

    The stored value is the list of bubbles serialised as plain dicts (via
    :py:meth:`~pydantic.BaseModel.model_dump`). Returning copies keeps
    callers from accidentally mutating the cached entry.

    Thread-safety: :class:`OrderedDict` mutations are protected by a single
    lock. Concurrent FastAPI workers running in the same process can share
    a single instance safely.
    """

    def __init__(self, max_entries: int = 100) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be >= 1")
        self._max = max_entries
        self._store: "OrderedDict[str, list[dict]]" = OrderedDict()
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    @staticmethod
    def make_key(
        *,
        image_sha: str,
        ocr_engine: EngineId,
        source_language: str,
        target_language: str | None,
    ) -> str:
        """Build the cache key for an OCR call.

        ``target_language`` only matters when the OCR engine ALSO produces
        translations in the same call (the "Full" Gemini engines). When the
        OCR pass is text-only, callers should pass ``None`` so the same
        entry is reused regardless of what the user picks for translation.
        """
        target = target_language if target_language else "*"
        return f"{image_sha}|{ocr_engine.value}|{source_language}|{target}"

    def get(self, key: str) -> list[TextBubble] | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            # Mark as most-recently-used.
            self._store.move_to_end(key)
            self._hits += 1
        # Rehydrate to fresh Pydantic models so callers can mutate freely.
        return [TextBubble(**dict(d)) for d in entry]

    def set(self, key: str, bubbles: Iterable[TextBubble]) -> None:
        snapshot = [b.model_dump() for b in bubbles]
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
                self._store[key] = snapshot
                return
            self._store[key] = snapshot
            if len(self._store) > self._max:
                # popitem(last=False) evicts least-recently-used.
                evicted_key, _ = self._store.popitem(last=False)
                logger.debug("OcrCache evicted oldest entry %s", evicted_key)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "size": len(self._store),
                "max": self._max,
                "hits": self._hits,
                "misses": self._misses,
            }


# ---------------------------------------------------------------------------
# Translation cache (SQLite)
# ---------------------------------------------------------------------------


class TranslationCache:
    """SQLite-backed cache for individual bubble translations.

    Schema (single table)::

        translations(
            source_text TEXT NOT NULL,
            target_lang TEXT NOT NULL,   -- e.g. "pt-BR"
            engine      TEXT NOT NULL,   -- e.g. "GEMINI_PRO"
            translated_text TEXT NOT NULL,
            bubble_type TEXT NOT NULL DEFAULT 'dialogue',
            created_at  REAL NOT NULL,
            PRIMARY KEY (source_text, target_lang, engine)
        )

    ``bubble_type`` is stored because Gemini and OpenAI may classify a
    response as a sound effect (``"sfx"``) based on the source text — when
    we replay from cache we have to restore that classification too.

    Connections are short-lived (one per call). SQLite handles concurrent
    readers fine; writes serialise on the file lock. For the expected
    workload (one user, occasional writes) this is plenty.
    """

    _SCHEMA = """
        CREATE TABLE IF NOT EXISTS translations (
            source_text TEXT NOT NULL,
            target_lang TEXT NOT NULL,
            engine TEXT NOT NULL,
            translated_text TEXT NOT NULL,
            bubble_type TEXT NOT NULL DEFAULT 'dialogue',
            created_at REAL NOT NULL,
            PRIMARY KEY (source_text, target_lang, engine)
        )
    """

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = str(db_path)
        # Make sure the parent directory exists. ":memory:" is special-cased
        # so tests can spin up purely in-RAM caches.
        if self._db_path != ":memory:":
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        # ":memory:" databases vanish when the connection closes, so we keep
        # one persistent connection in that case.
        self._memory_conn: sqlite3.Connection | None = None
        if self._db_path == ":memory:":
            self._memory_conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._lock = threading.Lock()
        self._init_schema()
        self._hits = 0
        self._misses = 0

    # -- internal -----------------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        if self._memory_conn is not None:
            return self._memory_conn
        return sqlite3.connect(self._db_path, check_same_thread=False)

    def _init_schema(self) -> None:
        conn = self._connect()
        try:
            conn.execute(self._SCHEMA)
            conn.commit()
        finally:
            if self._memory_conn is None:
                conn.close()

    @staticmethod
    def _normalise(text: str) -> str:
        return normalise_source_text(text)

    # -- public API ---------------------------------------------------------

    def get(
        self,
        *,
        source_text: str,
        target_lang: str,
        engine: EngineId,
    ) -> tuple[str, str] | None:
        """Return ``(translated_text, bubble_type)`` if cached, else ``None``.

        Empty / whitespace-only source texts always miss — they shouldn't
        consume a cache slot to begin with.
        """
        norm = self._normalise(source_text)
        if not norm:
            return None
        conn = self._connect()
        try:
            cur = conn.execute(
                "SELECT translated_text, bubble_type FROM translations "
                "WHERE source_text = ? AND target_lang = ? AND engine = ?",
                (norm, target_lang, engine.value),
            )
            row = cur.fetchone()
        finally:
            if self._memory_conn is None:
                conn.close()
        with self._lock:
            if row is None:
                self._misses += 1
                return None
            self._hits += 1
        return (row[0], row[1])

    def set(
        self,
        *,
        source_text: str,
        target_lang: str,
        engine: EngineId,
        translated_text: str,
        bubble_type: str = "dialogue",
    ) -> None:
        """Store a translation. No-ops on empty source/translated text.

        We refuse to cache empty translated text because providers
        sometimes return empty on transient failure — caching those would
        poison subsequent lookups.
        """
        norm = self._normalise(source_text)
        if not norm or not translated_text:
            return
        conn = self._connect()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO translations "
                "(source_text, target_lang, engine, translated_text, bubble_type, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    norm,
                    target_lang,
                    engine.value,
                    translated_text,
                    bubble_type or "dialogue",
                    time.time(),
                ),
            )
            conn.commit()
        finally:
            if self._memory_conn is None:
                conn.close()

    def clear(self) -> None:
        conn = self._connect()
        try:
            conn.execute("DELETE FROM translations")
            conn.commit()
        finally:
            if self._memory_conn is None:
                conn.close()
        with self._lock:
            self._hits = 0
            self._misses = 0

    def stats(self) -> dict[str, int]:
        conn = self._connect()
        try:
            cur = conn.execute("SELECT COUNT(*) FROM translations")
            (size,) = cur.fetchone()
        finally:
            if self._memory_conn is None:
                conn.close()
        with self._lock:
            return {
                "size": int(size),
                "hits": self._hits,
                "misses": self._misses,
            }

    def close(self) -> None:
        """Release the in-memory connection if any. File-backed instances
        own no long-lived resources, so this is a no-op for them."""
        if self._memory_conn is not None:
            self._memory_conn.close()
            self._memory_conn = None


# ---------------------------------------------------------------------------
# Module-level singletons (lazy-initialised)
# ---------------------------------------------------------------------------


_ocr_cache: OcrCache | None = None
_translation_cache: TranslationCache | None = None


def get_ocr_cache() -> OcrCache:
    """Return the process-wide OCR cache, creating it on first use."""
    global _ocr_cache
    if _ocr_cache is None:
        # Avoid a circular import: app.config imports schemas which import
        # nothing of ours, but we keep this lazy anyway for symmetry.
        from ..config import get_settings

        settings = get_settings()
        _ocr_cache = OcrCache(max_entries=settings.cache_ocr_max_entries)
    return _ocr_cache


def get_translation_cache() -> TranslationCache:
    """Return the process-wide translation cache, creating it on first use."""
    global _translation_cache
    if _translation_cache is None:
        from ..config import get_settings

        settings = get_settings()
        _translation_cache = TranslationCache(settings.cache_db_path)
    return _translation_cache


def reset_caches_for_tests() -> None:
    """Discard the singletons so tests can install isolated instances.

    Tests that need a fresh state should call this in a fixture *and*
    install their own caches via :func:`set_caches_for_tests` if they want
    deterministic behaviour.
    """
    global _ocr_cache, _translation_cache
    if _translation_cache is not None:
        _translation_cache.close()
    _ocr_cache = None
    _translation_cache = None


def set_caches_for_tests(
    *,
    ocr: OcrCache | None = None,
    translation: TranslationCache | None = None,
) -> None:
    """Install caches built by a test fixture (use with care)."""
    global _ocr_cache, _translation_cache
    if ocr is not None:
        _ocr_cache = ocr
    if translation is not None:
        _translation_cache = translation
