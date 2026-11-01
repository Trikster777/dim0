# ADR-TTS-001: Silero TTS runs as `navatusein/silero-tts-service:latest` (model `v5_6_ru`) and is spoken to only through its published contract

**Status:** Accepted · 2026-10-31
**Applies to:** `build/docker-compose.yml`, `.env.sample`, `backend/topix/api/router/tts.py`

## Decision

- The synthesis service is the published image `navatusein/silero-tts-service:latest`
  with the Russian model `v5_6_ru`
  (`https://models.silero.ai/models/tts/ru/v5_6_ru.pt`), five speakers
  (`aidar`, `baya`, `kseniya`, `xenia`, `eugene`), on the internal port **9898**.
- The service is described **once** in `build/docker-compose.yml` through a YAML anchor
  (`x-silero-tts: &silero-base`) with `profiles: [local, dev, test, staging, prod]`.
  Its port is never published. The model cache and the phrase cache live in the volumes
  `silero_models` and `silero_audios`, so the 147 MB model is downloaded once instead of
  on every container start.
- We speak exactly the published contract and nothing else:
  - `POST {TTS_SERVICE_URL}/process` — form-urlencoded body
    `voice=<speaker>&input_text=<text>` → `audio/wav`;
  - `GET {TTS_SERVICE_URL}/voices` — plain text, one voice per line;
  - `GET /` — `{"status":"work"}`, used as the container healthcheck.
- The request body MUST be produced by the HTTP client (`httpx` with `data={...}`),
  never hand-assembled as a string: the service parses it with `parse_qs`.
- We send plain text, never SSML — the service wraps the text into `<speak>` itself.
- `TTS_SERVICE_URL=http://silero-tts:9898`. The model URL stays overridable
  (`TTS_MODEL_URL`), so a version rollback is one env line and not a compose edit.
- Text preparation happens before the request leaves the backend — see ADR-TTS-002 and
  ADR-TTS-003.

## Why

The plan was written against an assumed GET-style service; the audit read the facts off
a running container instead of the README. Only this image is multi-arch (amd64 + arm64,
so the module also works on an arm64 laptop), was pushed recently (2026-10-22), is
MIT-licensed, ships a healthcheck and normalizes text the way LLM answers need it. The
live container gave the exact contract: `GET /` → 200 `{"status":"work"}`, `GET /voices`
→ 200 `text/html` with exactly five lines, `POST /process` → 200 `audio/wav`, RIFF/WAVE,
48 kHz, mono, 16 bit.

**This ADR closes D04.** The body of `POST /process` is form-urlencoded and the service
reads it through `parse_qs`: an unescaped `&` inside a value silently truncates the text
(`цена 5 & 10` arrives as `цена 5 `) without any error. That is a property of the request
format, not a service bug — so the encoding has to happen on our side, and the tests have
to assert the **encoded** body. A test written against the raw body checks the wrong
contract and produces false conclusions (raw `&` → "200", CDATA → "400").

## Consequences

- The module depends on one specific third-party image: a breaking change in that image
  breaks the module, and the fix is a new ADR, not a config tweak.
- `v5_6_ru` cannot pronounce Latin letters at all (`ext_alph = None`) — that is why the
  backend transliterates (ADR-TTS-002). A rollback to `v5_1_ru` keeps that rule valid
  but redundant.
- The container needs 700–900 MB RSS; on a VPS with 512 MB the module does not fit.
- The first start downloads the model (147 MB) into the volume — the cold start is slow
  and needs network access.
- Asserting the encoded request body is now part of the contract, not an implementation
  detail of a test.

## Rejected alternatives

- **`twirapp` TTS image** — amd64 only (no arm64), last pushed 2024-05-21, and its API
  takes the text in the query string of a GET, which caps the answer length.
- **`mmusikhin` TTS image** — amd64 only and no text normalization, so LLM answers are
  read out with their raw markdown and numbers.
- **`ndrco` TTS image** — no Docker Hub image at all (404 on pull).
- **Own Dockerfile** — a second image to maintain, and the model would have to be baked
  in or fetched at build time; the published image already covers both architectures.
- **A GET-based contract** — URL length limits cap the answer length; the 1000–1500
  character limit from the brief existed only because of it and was dropped.

## Verify

```bash
docker compose -f build/docker-compose.yml --profile local up -d silero-tts
docker exec silero-tts curl -s http://localhost:9898/          # {"status":"work"}
docker exec silero-tts curl -s http://localhost:9898/voices    # five lines
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
```
