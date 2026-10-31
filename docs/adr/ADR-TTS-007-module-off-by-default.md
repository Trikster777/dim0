# ADR-TTS-007: The TTS module is off by default and is switched on by one environment variable

**Status:** Accepted · 2026-10-31
**Applies to:** `build/docker-compose.yml`, `.env.sample`, `backend/topix/api/router/tts.py`, `webui/src/features/agent/components/chat/actions/speak-answer.tsx`

## Decision

- The module is **off by default**: `TTS_ENABLED=${TTS_ENABLED:-false}` in **all five**
  `backend-<stage>` services (`local`, `dev`, `test`, `staging`, `prod`) and in
  `.env.sample`.
- While the module is off, `POST /tts` answers 503 and `GET /tts/voices` answers 503.
- The "Speak" button stays **visible** while the module is off. The first 503 produces
  exactly one localized toast (`tts.disabled`); after that the button goes inactive with
  the same text as its tooltip and stops sending requests until the page is reloaded.
- Everything else about the module is configured through the environment as well:
  `TTS_SERVICE_URL`, `TTS_VOICE`, `TTS_FORMAT`, `TTS_STREAMING`, `TTS_MODEL_URL` — no
  TTS address, port, voice or model is hardcoded anywhere.
- `depends_on: silero-tts` with `condition: service_started` (map form): the backend
  waits for the container to start but does **not** wait for its healthcheck. A synthesis
  service that is slow to become healthy must not hold the backend back.

## Why

Dim0 is a fork of someone else's product and the module is added sideways: it must not
change the behaviour of an installation that does not want it. Off by default means a
deployment that never heard of TTS behaves exactly as before, and the memory the
container needs (700–900 MB) is not spent.

The button stays visible on purpose. A module that is off is a normal state, not a
broken feature; a button that vanishes leaves the user wondering whether the fork lost
the feature, while a button that explains itself tells the user what to switch on. The
state lives in the component until the page is reloaded — that was the owner's decision.

Not waiting for the healthcheck follows the same principle: the backend must start
whether or not the synthesis service is healthy. TTS answers fail with 502 until the
service is up; the rest of Dim0 does not care.

All five profiles must carry the variables, otherwise a fix tested on `local` silently
does nothing on `dev`, `test`, `staging` or `prod`.

## Consequences

- Out of the box the button does not work — this is the intended state and it is
  explained in the UI, but it is still the first thing a new user sees.
- Turning the module on is a two-step operation: set `TTS_ENABLED=true` in the env file
  and restart the backend containers.
- The "disabled" state survives only until the page is reloaded; after a restart of the
  backend the browser has to be refreshed to see the change.
- `depends_on` in map form is the only place where the compose file breaks its own
  convention (everywhere else it is a list) — the condition cannot be expressed in a
  list. The map form was therefore applied to the whole `depends_on` of the backend
  services, because one map cannot mix a list and a condition; for `postgres`, `qdrant`
  and `redis` the map form with `service_started` is semantically identical to the
  previous list.
- The service port stays unpublished; debugging it needs a temporary port mapping (a
  commented-out line sits next to the service).

## Rejected alternatives

- **On by default** — every installation would start a 3.7 GB container and spend
  700–900 MB without having asked for speech.
- **Hiding the button while the module is off** — the user would not know the feature
  exists; the module would look like it was lost in the fork.
- **A separate "is it enabled" endpoint** — an extra request per page and an extra code
  path; the 503 already says it.
- **Waiting for the service healthcheck in `depends_on`** — a slow model download would
  delay the whole backend.
- **Disabling the TTS container per profile** — the profiles are deployment stages, not
  features; the feature switch is `TTS_ENABLED`.

## Verify

```bash
docker compose -f build/docker-compose.yml --profile local config | grep -c TTS_ENABLED
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
```
