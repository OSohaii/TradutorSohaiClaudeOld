"""Tests for the OCR/translation caches and the dedup-aware translator.

These tests are hermetic: they never hit the network, and they install
isolated cache instances per test (memory-only SQLite, fresh OcrCache).
"""
from __future__ import annotations

import pytest

from app.deps import KeyResolver, Byok
from app.config import Settings
from app.schemas.common import BoundingBox, EngineId, TextBubble, TokenUsage
from app.schemas.pipeline import (
    CleanerConfig,
    OcrConfig,
    PipelineOptions,
    PipelineRequest,
    TranslationConfig,
)
from app.services import cache as cache_module
from app.services import pipeline as pipeline_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_bubble(idx: int, *, text: str, translated: str = "") -> TextBubble:
    return TextBubble(
        id=f"b{idx}",
        original_text=text,
        translated_text=translated,
        box=BoundingBox(ymin=0, xmin=0, ymax=100, xmax=100),
    )


def _build_translation_plan(engine: EngineId) -> pipeline_service.Plan:
    """Plan that triggers the standalone translation step for ``engine``."""
    return pipeline_service.Plan(
        use_torii_full=False,
        use_torii_cleaner=False,
        ocr_engine=EngineId.GEMINI_FLASH,
        translation_engine=engine,
        ocr_skip_translation=True,
        translation_done_in_ocr=False,
    )


def _key_resolver_with_byok() -> KeyResolver:
    """A KeyResolver populated with placeholder BYOK values so the dedup
    helper has credentials available even though we monkeypatch the actual
    provider calls."""
    settings = Settings(
        gemini_api_key="server-gemini",
        deepl_api_key="server-deepl",
        openai_api_key="server-openai",
    )
    byok = Byok()
    return KeyResolver(settings, byok)


@pytest.fixture(autouse=True)
def _isolated_caches(monkeypatch):
    """Install fresh caches per test and re-enable caching on the settings."""
    cache_module.reset_caches_for_tests()
    ocr = cache_module.OcrCache(max_entries=5)
    translation = cache_module.TranslationCache(":memory:")
    cache_module.set_caches_for_tests(ocr=ocr, translation=translation)

    # Force cache_enabled regardless of any env override.
    from app.config import get_settings as _gs

    settings = _gs()
    monkeypatch.setattr(settings, "cache_enabled", True, raising=False)

    yield

    cache_module.reset_caches_for_tests()


# ---------------------------------------------------------------------------
# OcrCache
# ---------------------------------------------------------------------------


class TestOcrCache:
    def test_hit_returns_independent_copies(self):
        cache = cache_module.OcrCache(max_entries=3)
        key = "k1"
        bubbles = [_make_bubble(1, text="hello")]
        cache.set(key, bubbles)

        first = cache.get(key)
        assert first is not None
        # Mutating the returned list must not affect future hits.
        first[0].translated_text = "tampered"
        second = cache.get(key)
        assert second is not None
        assert second[0].translated_text == ""

    def test_lru_eviction(self):
        cache = cache_module.OcrCache(max_entries=2)
        cache.set("a", [_make_bubble(1, text="A")])
        cache.set("b", [_make_bubble(2, text="B")])
        # Touch "a" so it becomes most-recently-used.
        assert cache.get("a") is not None
        cache.set("c", [_make_bubble(3, text="C")])
        # "b" was the LRU at the time of inserting "c", so it must be gone.
        assert cache.get("b") is None
        assert cache.get("a") is not None
        assert cache.get("c") is not None

    def test_miss_increments_counter(self):
        cache = cache_module.OcrCache(max_entries=2)
        assert cache.get("missing") is None
        stats = cache.stats()
        assert stats["misses"] == 1
        assert stats["hits"] == 0

    def test_make_key_distinguishes_target_lang_when_unified(self):
        k1 = cache_module.OcrCache.make_key(
            image_sha="abc",
            ocr_engine=EngineId.GEMINI_FLASH_FULL,
            source_language="Japanese",
            target_language="Portuguese (Brazil)",
        )
        k2 = cache_module.OcrCache.make_key(
            image_sha="abc",
            ocr_engine=EngineId.GEMINI_FLASH_FULL,
            source_language="Japanese",
            target_language="English",
        )
        assert k1 != k2

    def test_make_key_collapses_target_lang_for_ocr_only(self):
        """If the engine only does OCR, the target lang must NOT influence the
        key — otherwise we'd cache the same OCR result under N keys."""
        k1 = cache_module.OcrCache.make_key(
            image_sha="abc",
            ocr_engine=EngineId.GEMINI_FLASH,
            source_language="Japanese",
            target_language=None,
        )
        k2 = cache_module.OcrCache.make_key(
            image_sha="abc",
            ocr_engine=EngineId.GEMINI_FLASH,
            source_language="Japanese",
            target_language=None,
        )
        assert k1 == k2


# ---------------------------------------------------------------------------
# TranslationCache
# ---------------------------------------------------------------------------


class TestTranslationCache:
    def test_round_trip(self):
        cache = cache_module.TranslationCache(":memory:")
        cache.set(
            source_text="ドキッ",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="*coração disparado*",
        )
        hit = cache.get(
            source_text="ドキッ",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
        )
        assert hit == ("*coração disparado*", "dialogue")

    def test_normalises_whitespace(self):
        """Trailing/leading whitespace must collapse to a single cache slot."""
        cache = cache_module.TranslationCache(":memory:")
        cache.set(
            source_text="hello",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="ola",
        )
        hit = cache.get(
            source_text="  hello  ",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
        )
        assert hit is not None
        assert hit[0] == "ola"

    def test_engine_isolation(self):
        cache = cache_module.TranslationCache(":memory:")
        cache.set(
            source_text="hi",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="oi-gemini",
        )
        cache.set(
            source_text="hi",
            target_lang="pt-BR",
            engine=EngineId.DEEPL,
            translated_text="oi-deepl",
        )
        gemini_hit = cache.get(
            source_text="hi", target_lang="pt-BR", engine=EngineId.GEMINI_PRO
        )
        deepl_hit = cache.get(
            source_text="hi", target_lang="pt-BR", engine=EngineId.DEEPL
        )
        assert gemini_hit is not None and gemini_hit[0] == "oi-gemini"
        assert deepl_hit is not None and deepl_hit[0] == "oi-deepl"

    def test_target_lang_isolation(self):
        cache = cache_module.TranslationCache(":memory:")
        cache.set(
            source_text="hi",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="oi",
        )
        en_hit = cache.get(
            source_text="hi", target_lang="en-US", engine=EngineId.GEMINI_PRO
        )
        assert en_hit is None

    def test_empty_inputs_are_silent_no_ops(self):
        cache = cache_module.TranslationCache(":memory:")
        cache.set(
            source_text="   ",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="should not cache",
        )
        cache.set(
            source_text="real",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="",  # empty translation = transient failure
        )
        assert cache.stats()["size"] == 0

    def test_persistence_across_reopen(self, tmp_path):
        db = tmp_path / "cache.db"
        first = cache_module.TranslationCache(db)
        first.set(
            source_text="hi",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="oi",
        )
        # Simulate process restart.
        second = cache_module.TranslationCache(db)
        hit = second.get(
            source_text="hi", target_lang="pt-BR", engine=EngineId.GEMINI_PRO
        )
        assert hit is not None and hit[0] == "oi"

    def test_bubble_type_is_preserved(self):
        cache = cache_module.TranslationCache(":memory:")
        cache.set(
            source_text="boom",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="BUM",
            bubble_type="sfx",
        )
        hit = cache.get(
            source_text="boom",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
        )
        assert hit == ("BUM", "sfx")


# ---------------------------------------------------------------------------
# Dedup + cache integration in _translate_with_cache_and_dedup
# ---------------------------------------------------------------------------


class TestTranslateWithCacheAndDedup:
    @pytest.fixture
    def fake_provider(self, monkeypatch):
        """Replace the underlying _run_translation_step with a counting stub.

        The stub uppercases each bubble's source text and tracks how many
        bubbles it received per call.
        """
        calls: list[list[str]] = []

        async def _stub(bubbles, plan, keys, *, target_language="Portuguese (Brazil)"):
            calls.append([b.original_text for b in bubbles])
            translated = [
                b.model_copy(update={"translated_text": (b.original_text or "").upper()})
                for b in bubbles
            ]
            return translated, TokenUsage(input=10, output=10, total=20, model="stub")

        monkeypatch.setattr(pipeline_service, "_run_translation_step", _stub)
        return calls

    @pytest.mark.asyncio
    async def test_dedup_reduces_provider_calls(self, fake_provider):
        keys = _key_resolver_with_byok()
        plan = _build_translation_plan(EngineId.GEMINI_PRO)
        bubbles = [
            _make_bubble(1, text="..."),
            _make_bubble(2, text="hello"),
            _make_bubble(3, text="..."),  # duplicate of #1
            _make_bubble(4, text="..."),  # duplicate of #1
            _make_bubble(5, text="hello"),  # duplicate of #2
        ]

        result, _ = await pipeline_service._translate_with_cache_and_dedup(
            bubbles,
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )

        # Provider must have been called once with two unique inputs.
        assert len(fake_provider) == 1
        assert sorted(fake_provider[0]) == ["...", "hello"]
        # Every bubble keeps its id and gets the right translation.
        assert [b.id for b in result] == ["b1", "b2", "b3", "b4", "b5"]
        assert [b.translated_text for b in result] == [
            "...",
            "HELLO",
            "...",
            "...",
            "HELLO",
        ]

    @pytest.mark.asyncio
    async def test_cache_hit_skips_provider(self, fake_provider):
        keys = _key_resolver_with_byok()
        plan = _build_translation_plan(EngineId.GEMINI_PRO)

        # Pre-populate the translation cache.
        cache_module.get_translation_cache().set(
            source_text="hello",
            target_lang="pt-BR",
            engine=EngineId.GEMINI_PRO,
            translated_text="ola-cached",
        )

        bubbles = [_make_bubble(1, text="hello")]
        result, tokens = await pipeline_service._translate_with_cache_and_dedup(
            bubbles,
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )

        assert len(fake_provider) == 0  # provider untouched
        assert tokens is None  # no tokens billed
        assert result[0].translated_text == "ola-cached"

    @pytest.mark.asyncio
    async def test_cache_miss_writes_through(self, fake_provider):
        keys = _key_resolver_with_byok()
        plan = _build_translation_plan(EngineId.GEMINI_PRO)

        bubbles = [_make_bubble(1, text="hi")]
        await pipeline_service._translate_with_cache_and_dedup(
            bubbles,
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )
        # Second call with the same input must NOT reach the provider again.
        bubbles2 = [_make_bubble(2, text="hi")]
        await pipeline_service._translate_with_cache_and_dedup(
            bubbles2,
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )
        assert len(fake_provider) == 1

    @pytest.mark.asyncio
    async def test_empty_source_bubbles_pass_through(self, fake_provider):
        keys = _key_resolver_with_byok()
        plan = _build_translation_plan(EngineId.GEMINI_PRO)

        bubbles = [
            _make_bubble(1, text="", translated="kept-as-is"),
            _make_bubble(2, text="   "),
            _make_bubble(3, text="real"),
        ]
        result, _ = await pipeline_service._translate_with_cache_and_dedup(
            bubbles,
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )
        # Only the non-empty bubble was sent.
        assert fake_provider[0] == ["real"]
        # Empty bubbles preserved exactly.
        assert result[0].translated_text == "kept-as-is"
        assert result[1].translated_text == ""
        assert result[2].translated_text == "REAL"

    @pytest.mark.asyncio
    async def test_cache_disabled_via_settings(self, fake_provider, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "cache_enabled", False, raising=False)

        keys = _key_resolver_with_byok()
        plan = _build_translation_plan(EngineId.GEMINI_PRO)

        bubbles = [_make_bubble(1, text="hi"), _make_bubble(2, text="hi")]
        await pipeline_service._translate_with_cache_and_dedup(
            bubbles,
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )
        # cache disabled -> dedup ALSO runs (it doesn't depend on the cache),
        # so a single call but with a single deduped input.
        assert len(fake_provider) == 1
        assert fake_provider[0] == ["hi"]
        # Run again: cache is off, so the provider is invoked again.
        await pipeline_service._translate_with_cache_and_dedup(
            [_make_bubble(3, text="hi")],
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )
        assert len(fake_provider) == 2

    @pytest.mark.asyncio
    async def test_torii_engine_bypasses_translation_cache(
        self, fake_provider, monkeypatch
    ):
        """Torii doesn't translate via this path — guard against accidental
        regression that would lookup/store TORII rows in the cache."""
        keys = _key_resolver_with_byok()
        plan = pipeline_service.Plan(
            use_torii_full=False,
            use_torii_cleaner=False,
            ocr_engine=EngineId.GEMINI_FLASH,
            translation_engine=EngineId.TORII,
            ocr_skip_translation=True,
            translation_done_in_ocr=False,
        )

        bubbles = [_make_bubble(1, text="hi"), _make_bubble(2, text="hi")]
        await pipeline_service._translate_with_cache_and_dedup(
            bubbles,
            plan,
            keys,
            target_language="Portuguese (Brazil)",
            target_lang_code="pt-BR",
        )
        # Cache must remain empty for the TORII engine.
        cache = cache_module.get_translation_cache()
        assert (
            cache.get(source_text="hi", target_lang="pt-BR", engine=EngineId.TORII)
            is None
        )
