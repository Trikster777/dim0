"""Unit tests for the EmbeddingUnavailableError → HTTP 503 mapping."""

import asyncio
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from topix.api.errors import EMBEDDING_UNAVAILABLE_DETAIL, register_exception_handlers
from topix.nlp.embed import EmbeddingUnavailableError


def _client() -> TestClient:
    """Build an app with the handler registered and a route that raises the error."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/search")
    async def _search() -> dict:
        """Raise the domain error as an unhandled route failure."""
        raise EmbeddingUnavailableError()

    return TestClient(app, raise_server_exceptions=False)


def test_embedding_unavailable_maps_to_503():
    """A vector search without an embedding provider answers 503."""
    res = _client().get("/search")

    assert res.status_code == 503
    assert "Vector search is unavailable" in res.json()["detail"]


def test_error_detail_is_neutral():
    """The message states the capability is missing, without leaking config details."""
    res = _client().get("/search")

    detail = res.json()["detail"]
    assert detail == EMBEDDING_UNAVAILABLE_DETAIL
    assert "API_KEY" not in detail
    assert "OPENAI" not in detail.upper()
    assert "OPENROUTER" not in detail.upper()


def test_handler_responds_with_a_json_503():
    """Called directly, the handler returns a 503 JSON response."""
    app = FastAPI()
    register_exception_handlers(app)
    handler = app.exception_handlers[EmbeddingUnavailableError]

    response = asyncio.run(handler(None, EmbeddingUnavailableError()))

    assert response.status_code == 503
    assert json.loads(response.body)["detail"] == EMBEDDING_UNAVAILABLE_DETAIL
