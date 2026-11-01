"""Helper functions for API responses."""
import logging

from functools import wraps
from typing import Any, AsyncGenerator, Awaitable, Callable, TypeVar

from fastapi import HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)


def _domain_error(error: Exception) -> tuple[int, str] | None:
    """Return the (status, detail) of a domain error, or None for an ordinary one.

    A domain error carries its own HTTP status and message (e.g. "vector search
    is unavailable" → 503). Anything else stays a plain exception.
    """
    status_code = getattr(error, "status_code", None)
    detail = getattr(error, "detail", None)
    if isinstance(status_code, int) and isinstance(detail, str):
        return status_code, detail
    return None


def with_standard_response(func: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
    """Standardize API responses."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        response: Response = kwargs.get("response")  # Injected by FastAPI
        try:
            result = await func(*args, **kwargs)

            if response:
                response.status_code = 200
            if result:
                return {"status": "success", "data": result}
            return {"status": "success"}

        except HTTPException as http_exc:
            # Preserve HTTPException's status code and message
            if response:
                response.status_code = http_exc.status_code
            logger.error(f"HTTPException in {func.__name__}: {http_exc.detail}", exc_info=True)
            return {
                "status": "error",
                "data": {"message": http_exc.detail}
            }

        except Exception as e:
            # A domain error carries its own status and message (e.g. "vector
            # search is unavailable" → 503). Keep it instead of flattening it
            # into a 500 with the raw exception text.
            domain = _domain_error(e)
            if domain is not None:
                status_code, detail = domain
                if response:
                    response.status_code = status_code
                logger.error(f"Domain error in {func.__name__}: {detail}", exc_info=True)
                return {"status": "error", "data": {"message": detail}}
            logger.error(f"Error in {func.__name__}: {str(e)}", exc_info=True)
            if response:
                response.status_code = 500
            return {
                "status": "error",
                "data": {"message": "Internal server error", "details": str(e)}
            }

    return wrapper


T = TypeVar("T", bound=BaseModel)


def with_streaming(
    async_func: Callable[..., AsyncGenerator[T, None]]
) -> Callable[..., StreamingResponse]:
    """Handle streaming responses.

    This decorator wraps an async function to yield JSON responses line by line.
    The async function should yield data in pydantic's BaseModel format.
    """
    @wraps(async_func)
    async def wrapper(*args, **kwargs):
        async def wrapped_generator():
            async for item in async_func(*args, **kwargs):
                yield item.model_dump_json(exclude_none=True) + "\n"
        return StreamingResponse(wrapped_generator(), media_type="text/event-stream")
    return wrapper
