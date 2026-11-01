"""Unit tests for the embedder's per-input token clamping."""

import asyncio
import logging

import tiktoken

from topix.config import catalog
from topix.nlp import embed as embed_mod
from topix.nlp.embed import MAX_EMBED_TOKENS, OpenAIEmbedder
from topix.nlp.tokens import EMBED_ENCODING

_enc = tiktoken.get_encoding(EMBED_ENCODING)


class _FakeEmbeddings:
    """Captures the `input` it receives and returns matching dummy vectors."""

    def __init__(self):
        self.last_input: list[str] | None = None

    async def create(self, *, model, input, dimensions):
        """Stand in for `client.embeddings.create`, recording the input."""
        self.last_input = input
        data = [type("E", (), {"embedding": [0.0] * dimensions})() for _ in input]
        return type("R", (), {"data": data})()


class _FakeClient:
    """Minimal AsyncOpenAI stand-in exposing `.embeddings.create`."""

    def __init__(self):
        self.embeddings = _FakeEmbeddings()


class TestEmbedderClamping:
    """The embedder must never hand the API an over-limit input."""

    def _embedder(self) -> tuple[OpenAIEmbedder, _FakeClient]:
        fake = _FakeClient()
        embedder = OpenAIEmbedder(client=fake)
        return embedder, fake

    async def test_oversized_input_is_clamped_before_api_call(self):
        """A >8191-token text reaches the API clamped under MAX_EMBED_TOKENS."""
        embedder, fake = self._embedder()
        huge = "lorem ipsum dolor sit amet " * 5000

        await embedder.embed([huge])

        sent = fake.embeddings.last_input
        assert sent is not None and len(sent) == 1
        assert len(_enc.encode_ordinary(sent[0])) <= MAX_EMBED_TOKENS

    async def test_empty_text_becomes_placeholder(self):
        """Empty strings keep the existing `$` placeholder behaviour."""
        embedder, fake = self._embedder()

        await embedder.embed([""])

        assert fake.embeddings.last_input == ["$"]

    async def test_short_text_passes_through_untouched(self):
        """Normal short text is sent verbatim."""
        embedder, fake = self._embedder()

        await embedder.embed(["The capital of Peru is Lima."])

        assert fake.embeddings.last_input == ["The capital of Peru is Lima."]

    async def test_long_batch_offloads_encode_to_thread(self, monkeypatch):
        """A batch with encode-worthy text runs the fit off the event loop."""
        embedder, _ = self._embedder()
        calls = {"n": 0}
        real = asyncio.to_thread

        async def _spy(fn, *args, **kwargs):
            calls["n"] += 1
            return await real(fn, *args, **kwargs)

        monkeypatch.setattr(embed_mod.asyncio, "to_thread", _spy)
        await embedder.embed(["x" * (MAX_EMBED_TOKENS * 4)])
        assert calls["n"] == 1

    async def test_short_batch_fits_inline(self, monkeypatch):
        """An all-short batch never pays for a thread hop."""
        embedder, _ = self._embedder()
        calls = {"n": 0}

        async def _spy(fn, *args, **kwargs):
            calls["n"] += 1
            return fn(*args, **kwargs)

        monkeypatch.setattr(embed_mod.asyncio, "to_thread", _spy)
        await embedder.embed(["short text", "another short one"])
        assert calls["n"] == 0


def _resolved_embedding() -> catalog.Resolved:
    """Build a resolved embedding route as the catalog would return it."""
    return catalog.Resolved(
        id="text-embedding-3-small",
        label="Embedding",
        family="embedding",
        dim=512,
        provider="openai",
        model="text-embedding-3-small",
        call="openai/text-embedding-3-small",
    )


class TestEmbedderFromConfig:
    """The embedder is optional: `from_config` must never raise on a missing provider."""

    def test_returns_none_when_no_embedding_provider(self, monkeypatch, caplog):
        """No embedding provider → None plus a warning, so the backend still boots."""
        monkeypatch.setattr(embed_mod.catalog, "available_embedding", lambda: None)

        with caplog.at_level(logging.WARNING, logger="topix.nlp.embed"):
            embedder = OpenAIEmbedder.from_config()

        assert embedder is None
        warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert warnings
        assert "vector search is unavailable" in caplog.text.lower()

    def test_returns_none_when_client_cannot_be_built(self, monkeypatch, caplog):
        """A provider without an OpenAI-compatible client → None plus a warning."""
        monkeypatch.setattr(embed_mod.catalog, "available_embedding", _resolved_embedding)
        monkeypatch.setattr(embed_mod.catalog, "openai_compatible_client", lambda _resolved: None)

        with caplog.at_level(logging.WARNING, logger="topix.nlp.embed"):
            embedder = OpenAIEmbedder.from_config()

        assert embedder is None
        assert any(r.levelno == logging.WARNING for r in caplog.records)

    def test_returns_embedder_when_provider_is_available(self, monkeypatch):
        """A reachable provider yields a usable embedder."""
        client = _FakeClient()
        monkeypatch.setattr(embed_mod.catalog, "available_embedding", _resolved_embedding)
        monkeypatch.setattr(embed_mod.catalog, "openai_compatible_client", lambda _resolved: client)

        embedder = OpenAIEmbedder.from_config()

        assert embedder is not None
        assert embedder.model == "text-embedding-3-small"
        assert embedder.dimensions == 512

