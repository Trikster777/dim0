"""Router for the Silero TTS module.

The backend owns the whole HTTP surface of the module: it prepares the text,
chunks it, calls the TTS service and returns one single WAV file.
"""

import logging
import os
import time

import httpx

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from topix.api.utils.security import get_current_user_uid
from topix.utils.tts import assemble_wav, has_speakable_content, prepare_tts_text, split_text_for_tts

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/tts",
    tags=["tts"],
    dependencies=[Depends(get_current_user_uid)],
)

# Timeout of a single call to the TTS service (per chunk).
TTS_REQUEST_TIMEOUT_SECONDS = 15.0
# Upper bound of the text accepted by the endpoint.
MAX_TEXT_LENGTH = 50_000
# How long the voice list of the service is cached.
VOICES_CACHE_TTL_SECONDS = 300


class TtsRequest(BaseModel):
    """Body of the synthesis request."""

    text: str
    voice: str | None = None


class _VoicesCache:
    """Voice list of the service with the time it was fetched."""

    def __init__(self) -> None:
        """Init."""
        self.voices: list[str] = []
        self.fetched_at: float = 0.0

    def get(self) -> list[str] | None:
        """Return the cached voices while they are fresh, otherwise None."""
        if self.voices and (time.monotonic() - self.fetched_at) < VOICES_CACHE_TTL_SECONDS:
            return list(self.voices)
        return None

    def set(self, voices: list[str]) -> None:
        """Remember the voices of the service."""
        self.voices = list(voices)
        self.fetched_at = time.monotonic()


def create_client() -> httpx.AsyncClient:
    """Create the HTTP client used to reach the TTS service."""
    return httpx.AsyncClient(timeout=TTS_REQUEST_TIMEOUT_SECONDS)


def _is_enabled() -> bool:
    """Tell whether the TTS module is switched on."""
    return (os.getenv("TTS_ENABLED") or "").strip().lower() == "true"


def _service_url() -> str:
    """Return the base URL of the TTS service."""
    return (os.getenv("TTS_SERVICE_URL") or "http://silero-tts:9898").rstrip("/")


def _default_voice() -> str:
    """Return the voice used when the request does not name one."""
    return os.getenv("TTS_VOICE") or "xenia"


def _voices_cache(app) -> _VoicesCache:
    """Return the voice cache of the application, creating it on first use."""
    cache = getattr(app.state, "tts_voices_cache", None)
    if cache is None:
        cache = _VoicesCache()
        app.state.tts_voices_cache = cache
    return cache


async def _synthesize(text: str, voice: str) -> bytes:
    """Ask the TTS service for the audio of one chunk of text."""
    url = f"{_service_url()}/process"
    try:
        async with create_client() as client:
            response = await client.post(url, data={"voice": voice, "input_text": text})
    except (httpx.HTTPError, httpx.InvalidURL) as exc:
        logger.error("TTS service is not reachable: %s", exc)
        raise HTTPException(status_code=502, detail="TTS service is unavailable") from exc
    if response.status_code != 200:
        # The answer of the service is never passed on: it may carry internals.
        logger.error("TTS service answered with status %s", response.status_code)
        raise HTTPException(status_code=502, detail="TTS service failed")
    return response.content


@router.post("/", include_in_schema=False)
@router.post("")
async def synthesize_tts(payload: TtsRequest) -> Response:
    """Synthesize the given text and return it as one single WAV file."""
    if not _is_enabled():
        raise HTTPException(status_code=503, detail="TTS module is disabled")

    text = payload.text or ""
    if len(text) > MAX_TEXT_LENGTH:
        raise HTTPException(status_code=413, detail="Text is too long")
    if not text.strip() or not has_speakable_content(text):
        raise HTTPException(status_code=400, detail="Text has nothing to speak")

    voice = (payload.voice or "").strip() or _default_voice()
    # Preparation order is fixed: transliterate first, escape the XML specials
    # afterwards, so that our own CDATA marker is not rewritten.
    prepared = prepare_tts_text(text)
    chunks = split_text_for_tts(prepared)

    if len(chunks) <= 2:
        audio = await _synthesize(prepared, voice)
    else:
        # Every chunk is synthesized on its own and joined into one file.
        # A failing chunk aborts the whole request, no partial file is returned.
        pieces = [await _synthesize(chunk, voice) for chunk in chunks]
        audio = assemble_wav(pieces)

    return Response(content=audio, media_type="audio/wav")


@router.get("/voices")
async def list_voices(request: Request) -> dict:
    """Return the voices offered by the TTS service.

    The service answers with plain text (one voice per line), the list is
    normalized here and cached for a few minutes.
    """
    if not _is_enabled():
        raise HTTPException(status_code=503, detail="TTS module is disabled")

    cache = _voices_cache(request.app)
    cached = cache.get()
    if cached is not None:
        return {"voices": cached}

    url = f"{_service_url()}/voices"
    try:
        async with create_client() as client:
            response = await client.get(url)
    except (httpx.HTTPError, httpx.InvalidURL) as exc:
        logger.error("TTS service is not reachable: %s", exc)
        raise HTTPException(status_code=503, detail="TTS service is unavailable") from exc
    if response.status_code != 200:
        logger.error("TTS service answered with status %s", response.status_code)
        raise HTTPException(status_code=503, detail="TTS service is unavailable")

    voices = [line.strip() for line in response.text.splitlines() if line.strip()]
    if not voices:
        raise HTTPException(status_code=503, detail="TTS service is unavailable")

    cache.set(voices)
    return {"voices": voices}
