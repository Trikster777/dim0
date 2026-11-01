"""Router tests for the TTS endpoints — module switch, validation and proxying."""

from __future__ import annotations

import re
import urllib.parse

import httpx

from fastapi import FastAPI
from fastapi.testclient import TestClient

from topix.api.router.tts import router
from topix.api.utils.security import get_current_user_uid

SERVICE_URL = "http://silero-tts:9898"

# A whole CDATA section: the opening, one special character and the closing.
CDATA_SECTION_RE = re.compile(r"<!\[CDATA\[(?:&|<|>)]]>")
# The same section in the form-urlencoded body of the outgoing request.
ENCODED_CDATA_PREFIX = "%3C%21%5BCDATA%5B"


def _wav_bytes(pcm: bytes = b"\x01\x02" * 32) -> bytes:
    """Build a WAV file with the canonical 48 kHz mono 16 bit header."""
    byte_rate = 48000 * 2
    header = (
        b"RIFF"
        + (36 + len(pcm)).to_bytes(4, "little")
        + b"WAVEfmt "
        + (16).to_bytes(4, "little")
        + (1).to_bytes(2, "little")
        + (1).to_bytes(2, "little")
        + (48000).to_bytes(4, "little")
        + byte_rate.to_bytes(4, "little")
        + (2).to_bytes(2, "little")
        + (16).to_bytes(2, "little")
        + b"data"
        + len(pcm).to_bytes(4, "little")
    )
    return header + pcm


def _data_payload(wav: bytes) -> bytes:
    """Extract the PCM payload out of a RIFF/WAVE blob."""
    offset = 12
    while offset + 8 <= len(wav):
        chunk_id = wav[offset : offset + 4]
        size = int.from_bytes(wav[offset + 4 : offset + 8], "little")
        if chunk_id == b"data":
            return wav[offset + 8 : offset + 8 + size]
        offset += 8 + size + (size % 2)
    raise AssertionError("no data chunk found")


def _build_client() -> tuple[TestClient, FastAPI]:
    """Build a test client with the authentication dependency overridden."""
    app = FastAPI()
    app.include_router(router)

    async def _fake_current_user_uid():
        """Fake current user uid."""
        return "u1"

    app.dependency_overrides[get_current_user_uid] = _fake_current_user_uid
    return TestClient(app), app


def _mock_service(monkeypatch, handler) -> list[httpx.Request]:
    """Route every outgoing HTTP call to a mock transport and record the requests."""
    from topix.api.router import tts as tts_router

    requests: list[httpx.Request] = []

    def _handle(request: httpx.Request) -> httpx.Response:
        """Answer one outgoing request with the configured handler."""
        requests.append(request)
        return handler(request)

    monkeypatch.setattr(
        tts_router,
        "create_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(_handle)),
    )
    return requests


def _ok_wav(request: httpx.Request) -> httpx.Response:
    """Answer with a ready made WAV file."""
    return httpx.Response(200, content=_wav_bytes(), headers={"Content-Type": "audio/wav"})


def _sent_text(request: httpx.Request) -> str:
    """Decode the form-urlencoded body and return the text sent to the service."""
    parsed = urllib.parse.parse_qs(request.content.decode("utf-8"))
    return parsed["input_text"][0]


def _sent_voice(request: httpx.Request) -> str:
    """Decode the form-urlencoded body and return the voice sent to the service."""
    parsed = urllib.parse.parse_qs(request.content.decode("utf-8"))
    return parsed["voice"][0]


def _has_latin(text: str) -> bool:
    """Tell whether the text still contains a latin letter."""
    return any(char.isascii() and char.isalpha() for char in text)


def _broken_cdata_fragments(text: str) -> list[str]:
    """Return the parts of the text that lie outside of a whole CDATA section.

    A section is the only place where «<», «>» and «&» may appear, so a marker
    cut in two always leaves a fragment of itself behind.
    """
    rest = CDATA_SECTION_RE.sub("", text)
    return [fragment for fragment in ("<", ">", "&", "]]>", "CDATA[") if fragment in rest]


# ---------------------------------------------------------------------------
# Module switch and validation
# ---------------------------------------------------------------------------


def test_post_tts_is_disabled_by_default(monkeypatch):
    """Without TTS_ENABLED the endpoint answers 503 and never calls the service."""
    monkeypatch.delenv("TTS_ENABLED", raising=False)
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    response = client.post("/tts", json={"text": "Привет"})

    assert response.status_code == 503
    assert requests == []
    assert response.json()["detail"].isascii()


def test_post_tts_rejects_empty_text(monkeypatch):
    """Empty text is refused before the service is called."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    response = client.post("/tts", json={"text": "   "})

    assert response.status_code == 400
    assert requests == []


def test_post_tts_rejects_text_without_letter_and_digit(monkeypatch):
    """Text that the service would normalize into nothing is refused."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    for text in (">", "---", "***", "🎉🚀"):
        response = client.post("/tts", json={"text": text})
        assert response.status_code == 400, text
    assert requests == []


def test_post_tts_rejects_too_long_text(monkeypatch):
    """Text longer than the limit is refused with 413 before the service is called."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    response = client.post("/tts", json={"text": "а" * 50001})

    assert response.status_code == 413
    assert requests == []


def test_post_tts_requires_authentication():
    """Without a token the endpoint answers 401."""
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post("/tts", json={"text": "Привет"})

    assert response.status_code == 401


def test_get_voices_requires_authentication():
    """Without a token the voice list answers 401."""
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.get("/tts/voices")

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Proxying to the TTS service
# ---------------------------------------------------------------------------


def test_post_tts_returns_a_single_wav_file(monkeypatch):
    """A successful synthesis is returned as one binary audio/wav response."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    wav = _wav_bytes()
    requests = _mock_service(monkeypatch, lambda request: httpx.Response(200, content=wav))

    client, _ = _build_client()
    response = client.post("/tts", json={"text": "Привет мир"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.content == wav
    assert response.content[:4] == b"RIFF"
    assert len(requests) == 1
    assert str(requests[0].url) == f"{SERVICE_URL}/process"


def test_post_tts_sends_a_form_urlencoded_body(monkeypatch):
    """The body is form-urlencoded, so an ampersand inside the text survives."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    client.post("/tts", json={"text": "Цена 5 & 10"})

    body = requests[0].content.decode("utf-8")
    assert requests[0].headers["content-type"].startswith("application/x-www-form-urlencoded")
    assert "%26" in body
    parsed = urllib.parse.parse_qs(body)
    sent = parsed["input_text"][0]
    # The ampersand is escaped, but the text behind it is not cut off.
    assert sent.startswith("Цена 5 ")
    assert sent.endswith(" 10")
    assert parsed["voice"]


def test_post_tts_escapes_xml_specials_with_cdata(monkeypatch):
    """XML specials reach the service as per character CDATA sections."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    client.post("/tts", json={"text": "Цена & наличие < остаток >"})

    sent = _sent_text(requests[0])
    assert "<![CDATA[&]]>" in sent
    assert "<![CDATA[<]]>" in sent
    assert "<![CDATA[>]]>" in sent
    assert "&amp;" not in sent
    assert "&#38;" not in sent


def test_post_tts_transliterates_latin_before_sending(monkeypatch):
    """Latin words of an agent answer are sent as Cyrillic."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    response = client.post("/tts", json={"text": "workflow и PowerShell"})

    assert response.status_code == 200
    sent = _sent_text(requests[0])
    assert not _has_latin(sent)


def test_post_tts_keeps_cdata_markers_whole_in_every_chunk(monkeypatch):
    """Every chunk that leaves for the service holds whole CDATA sections.

    A marker cut in two by the chunker sends invalid XML to the service: it
    answers 400 and the client gets a 502 instead of the audio. The check is
    done on the encoded body of the outgoing request, like the check of the
    ampersand in the form-urlencoded body.
    """
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, _ok_wav)

    sentence = "Разговор про R&D и отчёт по продажам. "
    text = sentence * 14 + "В коде A<B и C>D."

    client, _ = _build_client()
    response = client.post("/tts", json={"text": text})

    assert response.status_code == 200
    # Three chunks or more — every chunk leaves for the service on its own.
    assert len(requests) >= 3

    sent_all = ""
    for request in requests:
        body = request.content.decode("utf-8")
        sent = _sent_text(request)
        sent_all += sent

        # The encoded body carries every section of the chunk as one piece.
        for section in CDATA_SECTION_RE.findall(sent):
            assert urllib.parse.quote_plus(section) in body
        # A section cut right after «<!» would leave its head alone on the wire.
        for match in re.finditer(re.escape("%3C%21"), body):
            head = body[match.start() : match.start() + len(ENCODED_CDATA_PREFIX)]
            assert head == ENCODED_CDATA_PREFIX, body

        # The parsed body holds no broken section.
        assert _broken_cdata_fragments(sent) == [], sent

    # All three kinds of sections really went to the service.
    assert "<![CDATA[&]]>" in sent_all
    assert "<![CDATA[<]]>" in sent_all
    assert "<![CDATA[>]]>" in sent_all


def test_post_tts_passes_the_requested_voice(monkeypatch):
    """The voice of the request reaches the service."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    client.post("/tts", json={"text": "Привет", "voice": "eugene"})

    assert _sent_voice(requests[0]) == "eugene"


def test_post_tts_falls_back_to_the_voice_of_the_environment(monkeypatch):
    """Without a voice in the request the voice of the environment is used."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    monkeypatch.setenv("TTS_VOICE", "kseniya")
    requests = _mock_service(monkeypatch, _ok_wav)

    client, _ = _build_client()
    client.post("/tts", json={"text": "Привет", "voice": None})

    assert _sent_voice(requests[0]) == "kseniya"


def test_post_tts_maps_a_service_error_to_502(monkeypatch):
    """Any error of the service becomes a neutral 502 without its own text."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    _mock_service(monkeypatch, lambda request: httpx.Response(400, text="Silero model failed: Invalid XML format"))

    client, _ = _build_client()
    response = client.post("/tts", json={"text": "Привет"})

    assert response.status_code == 502
    assert "Invalid XML format" not in response.text
    assert "Silero" not in response.text


def test_post_tts_maps_a_service_crash_to_502(monkeypatch):
    """A service that is not reachable becomes a neutral 502."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)

    def _broken(request: httpx.Request) -> httpx.Response:
        """Refuse the connection."""
        raise httpx.ConnectError("connection refused", request=request)

    _mock_service(monkeypatch, _broken)

    client, _ = _build_client()
    response = client.post("/tts", json={"text": "Привет"})

    assert response.status_code == 502


def test_post_tts_sends_two_chunks_in_one_request(monkeypatch):
    """Up to two chunks are synthesized in a single request."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, _ok_wav)
    sentence = "слово " * 28 + "."
    text = f"{sentence} {sentence}"

    client, _ = _build_client()
    response = client.post("/tts", json={"text": text})

    assert response.status_code == 200
    assert len(requests) == 1


def test_post_tts_joins_more_than_two_chunks_into_one_wav(monkeypatch):
    """Three chunks or more are synthesized one by one and joined into one file."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, _ok_wav)
    sentence = "слово " * 28 + "."
    text = f"{sentence} {sentence} {sentence}"

    client, _ = _build_client()
    response = client.post("/tts", json={"text": text})

    assert response.status_code == 200
    assert len(requests) == 3
    assert response.content[:4] == b"RIFF"
    assert int.from_bytes(response.content[4:8], "little") == len(response.content) - 8
    assert len(_data_payload(response.content)) == 3 * len(_data_payload(_wav_bytes()))


def test_post_tts_fails_whole_when_a_chunk_fails(monkeypatch):
    """A failing chunk aborts the whole request, no partial file is returned.

    The first chunk is synthesized normally and the second one fails, so the
    scenario of a broken middle of the answer is really covered.
    """
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    sentence = "слово " * 28 + "."
    text = f"{sentence} {sentence} {sentence}"
    sent_chunks: list[str] = []

    def _failing(request: httpx.Request) -> httpx.Response:
        """Answer the first chunk and fail on the second one."""
        sent_chunks.append(_sent_text(request))
        if len(sent_chunks) == 1:
            return _ok_wav(request)
        raise httpx.ConnectError("connection refused", request=request)

    requests = _mock_service(monkeypatch, _failing)

    client, _ = _build_client()
    response = client.post("/tts", json={"text": text})

    assert response.status_code == 502
    # The first chunk was synthesized, the second one failed.
    assert len(sent_chunks) == 2
    assert len(requests) == 2
    # No partial file is returned: the answer is an error, not a piece of audio.
    assert not response.headers["content-type"].startswith("audio/wav")
    assert response.content[:4] != b"RIFF"


# ---------------------------------------------------------------------------
# Voice list
# ---------------------------------------------------------------------------


def test_get_voices_returns_the_voices_of_the_service(monkeypatch):
    """The plain text answer of the service becomes a JSON list."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(
        monkeypatch,
        lambda request: httpx.Response(
            200,
            text="aidar\nbaya\nkseniya\nxenia\neugene",
            headers={"Content-Type": "text/html; charset=utf-8"},
        ),
    )

    client, _ = _build_client()
    response = client.get("/tts/voices")

    assert response.status_code == 200
    assert response.json() == {"voices": ["aidar", "baya", "kseniya", "xenia", "eugene"]}
    assert str(requests[0].url) == f"{SERVICE_URL}/voices"


def test_get_voices_answers_503_when_the_service_fails(monkeypatch):
    """An unreachable service answers 503."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    _mock_service(monkeypatch, lambda request: httpx.Response(500, text="boom"))

    client, _ = _build_client()
    response = client.get("/tts/voices")

    assert response.status_code == 503


def test_get_voices_answers_503_when_the_list_is_empty(monkeypatch):
    """An empty voice list answers 503."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    _mock_service(monkeypatch, lambda request: httpx.Response(200, text=""))

    client, _ = _build_client()
    response = client.get("/tts/voices")

    assert response.status_code == 503


def test_get_voices_caches_the_service_answer(monkeypatch):
    """The service is asked for the voice list once, the answer is cached."""
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setenv("TTS_SERVICE_URL", SERVICE_URL)
    requests = _mock_service(monkeypatch, lambda request: httpx.Response(200, text="aidar\nbaya"))

    client, _ = _build_client()
    first = client.get("/tts/voices")
    second = client.get("/tts/voices")

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == {"voices": ["aidar", "baya"]}
    assert len(requests) == 1
