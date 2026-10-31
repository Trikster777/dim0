# ADR-TTS-005: The browser talks only to the Dim0 backend — the backend proxies to the TTS service

**Status:** Accepted · 2026-10-31
**Applies to:** `backend/topix/api/router/tts.py`, `backend/topix/api/app.py`, `webui/src/api.ts`, `webui/src/features/agent/components/chat/actions/speak-answer.tsx`

## Decision

- The web interface never addresses the synthesis service. It knows only its own API:
  `POST /tts` and `GET /tts/voices` on the Dim0 backend. No TTS service URL, port or path
  appears in the browser.
- The Dim0 backend is the only caller of the service. It owns the service contract
  (`POST /process`, form-urlencoded), the chunking, the WAV assembly, the timeouts
  (15 s per service call) and the voice-list cache (~300 s) — none of that is visible
  outside the router.
- Both endpoints sit behind `Depends(get_current_user_uid)`, like `documents`, `files`
  and `finance`; a request without a token gets 401.
- The router is mounted at the root: `APIRouter(prefix="/tts")` gives exactly `POST /tts`
  and `GET /tts/voices`. `app.py` gets one `include_router` line, and no business logic of
  the agent, the chat or the canvas is touched.
- The voice list is normalized once in the backend — the service's plain-text answer is
  split by line, stripped, empties dropped — and handed to the browser as
  `{"voices": [...]}`.
- The frontend reaches the backend only through `api.ts`; the binary answer is fetched
  with a dedicated helper that returns a `Blob` (the shared `apiFetch` reads non-JSON
  answers as text and would corrupt the sound).

## Why

Dim0 is deployed locally and that is its strength: the data must not leave the machine.
If the browser addressed the service directly, the service's address would live in the
frontend bundle and the TTS service would become a second public entry point of the
product.

Proxying through the Dim0 backend keeps one addressable surface (the backend API), keeps
the service an internal container on the compose network — its port 9898 is never
published — and puts authorization, validation and chunking in one place.

Authorization follows the precedent of the other Dim0 routers: a synthesis call spends
the container's CPU, so it must not be anonymous.

Parsing the voice list in the backend is deliberate: the list of speakers is a property
of the model, not of our API. Normalizing it once means the frontend gets a plain array
and the format of the service's answer never leaks into the UI.

## Consequences

- The backend must be running and reachable for the button to work; the service alone is
  not enough.
- The TTS service is a single point of failure for the feature, but not for the product:
  when it is down, only the TTS answers fail (502), everything else keeps working.
- Two extra layers of latency (browser → backend → service) and one extra copy of the
  audio in the backend process.
- `api.ts` and `errors.ts` change only additively — a blob-capable helper and one entry
  in `ENDPOINT_STATUS_KEYS` — so the rest of the frontend contracts stay intact.
- The frontend cannot be extended with a direct service call without a new ADR.

## Rejected alternatives

- **Browser → service directly** — the service address would ship to the client, the
  service would become a public surface, and validation, authorization and the voice
  list would have to be duplicated in the frontend.
- **A separate public endpoint for the TTS** — a second API surface to document,
  authorize and keep in sync.
- **An anonymous TTS endpoint** — a free synthesis endpoint for anyone who can reach the
  port.
- **Handing the service's plain-text voice list to the browser as is** — the frontend
  would parse a service-specific format, and the normalization would be duplicated per
  caller.

## Verify

```bash
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
docker compose -f build/docker-compose.yml --profile local ps   # silero-tts publishes no port
```
