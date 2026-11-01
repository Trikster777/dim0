"""HTTP error mapping for backend domain errors."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from topix.nlp.embed import EmbeddingUnavailableError

EMBEDDING_UNAVAILABLE_DETAIL = EmbeddingUnavailableError.detail


def register_exception_handlers(app: FastAPI) -> None:
    """Register app-level handlers for domain errors that map to HTTP statuses."""

    @app.exception_handler(EmbeddingUnavailableError)
    async def _embedding_unavailable(_request: Request, exc: EmbeddingUnavailableError) -> JSONResponse:
        """Map a missing embedding provider to HTTP 503 with a neutral message."""
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )
