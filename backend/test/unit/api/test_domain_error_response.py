"""Unit tests for the domain-error contract of the standard API response wrapper."""

from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

from topix.api.utils.decorators import with_standard_response
from topix.nlp.embed import EmbeddingUnavailableError


def _client() -> TestClient:
    """Build an app whose route fails with a domain error inside the wrapper."""
    app = FastAPI()

    @app.get("/search")
    @with_standard_response
    async def _search(response: Response) -> dict:
        """Raise the domain error from inside the standard response wrapper."""
        raise EmbeddingUnavailableError()

    return TestClient(app, raise_server_exceptions=False)


def test_domain_error_keeps_its_status():
    """A domain error answers its own status (503), not a generic 500."""
    res = _client().get("/search")

    assert res.status_code == 503


def test_domain_error_keeps_its_message():
    """The client gets the neutral capability message, not the raw exception."""
    res = _client().get("/search")

    body = res.json()
    assert body["status"] == "error"
    assert body["data"]["message"] == EmbeddingUnavailableError.detail


def test_unknown_exception_stays_a_500():
    """An ordinary error is still a 500 with the generic message."""
    app = FastAPI()

    @app.get("/boom")
    @with_standard_response
    async def _boom(response: Response) -> dict:
        """Raise an ordinary error."""
        raise ValueError("boom")

    res = TestClient(app, raise_server_exceptions=False).get("/boom")

    assert res.status_code == 500
    assert res.json()["data"]["message"] == "Internal server error"
