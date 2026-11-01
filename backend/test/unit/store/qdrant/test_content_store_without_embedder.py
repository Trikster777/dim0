"""Unit tests for ContentStore running without an embedding provider.

Without an embedding provider the store must still accept writes (zero
vectors) and serve id/filter based reads, while vector (semantic) search must
fail explicitly with `EmbeddingUnavailableError`.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from qdrant_client.models import Filter

from topix.datatypes.note.note import Note
from topix.datatypes.resource import RichText
from topix.nlp.embed import DIMENSIONS, EmbeddingUnavailableError, OpenAIEmbedder
from topix.store.qdrant.store import ContentStore


class _FakeQdrantClient:
    """Minimal async Qdrant client stand-in recording the calls the store makes."""

    def __init__(self) -> None:
        """Create the recorded async methods used by the store."""
        self.collection_exists = AsyncMock(return_value=False)
        self.create_collection = AsyncMock()
        self.create_payload_index = AsyncMock()
        self.delete_collection = AsyncMock()
        self.upsert = AsyncMock()
        self.query_points = AsyncMock(return_value=SimpleNamespace(points=[]))
        self.query_batch_points = AsyncMock(return_value=[])
        self.scroll = AsyncMock(return_value=([], None))


def _store(embedder: OpenAIEmbedder | None = None) -> ContentStore:
    """Build a ContentStore backed by the fake client."""
    return ContentStore(qdrant_client=_FakeQdrantClient(), embedder=embedder)


def _entry() -> Note:
    """Build a note with two embeddable texts."""
    return Note(
        label=RichText(markdown="Hello"),
        content=RichText(markdown="World"),
    )


class TestContentStoreWithoutEmbedder:
    """The store stays usable (writes + reads) when no embedder is configured."""

    def test_vector_size_falls_back_to_the_default_width(self):
        """Without an embedder the collection uses the default vector width."""
        store = _store()

        assert store.embedder is None
        assert store.vector_size == DIMENSIONS == 512

    async def test_create_collection_uses_the_default_vector_size(self):
        """The collection is created with the default vector width."""
        store = _store()

        await store.create_collection()

        kwargs = store.client.create_collection.await_args.kwargs
        assert kwargs["vectors_config"].size == 512

    async def test_embed_returns_zero_vectors(self):
        """Entries are embedded as zero vectors of the collection's width."""
        store = _store()

        embeddings = await store._embed([_entry()])

        assert len(embeddings) == 1
        vectors = embeddings[0]
        assert len(vectors) == 1
        assert len(vectors[0]) == 512
        assert all(value == 0.0 for value in vectors[0])

    async def test_embed_does_not_call_the_embedder(self, monkeypatch):
        """No embedder call happens while no embedding provider is configured."""
        calls: list[list[str]] = []

        async def _spy(self, texts, batch_size=1000):
            calls.append(texts)
            return [[0.1] * DIMENSIONS for _ in texts]

        monkeypatch.setattr(OpenAIEmbedder, "embed", _spy)

        store = _store()
        embeddings = await store._embed([_entry()])

        assert calls == []
        assert all(value == 0.0 for value in embeddings[0][0])

    async def test_search_raises_embedding_unavailable(self):
        """Semantic search needs a query vector → it fails explicitly."""
        store = _store()

        with pytest.raises(EmbeddingUnavailableError):
            await store.search("cats")

    async def test_batch_search_raises_embedding_unavailable(self):
        """Batch semantic search needs query vectors → it fails explicitly."""
        store = _store()

        with pytest.raises(EmbeddingUnavailableError):
            await store.batch_search(["cats", "dogs"])

    async def test_search_by_id_still_works_without_embedder(self):
        """Id based lookup does not build a query vector, so it keeps working."""
        store = _store()

        results = await store.search_by_id("point-1")

        assert results == []

    async def test_filter_query_still_works_without_embedder(self):
        """Filter based reads do not build a query vector, so they keep working."""
        store = _store()

        results = await store.filt(filters=Filter(must=[]))

        assert results == []
