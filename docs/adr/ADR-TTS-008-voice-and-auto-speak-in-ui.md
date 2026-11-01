# ADR-TTS-008: Voice and auto-speak are UI settings; the voice list comes from the service

**Status:** Accepted · 2026-10-31
**Applies to:** `webui/src/features/agent/components/chat/actions/speak-answer.tsx`, `backend/topix/api/router/tts.py`, `webui/src/locales/{en,ru}.json`

## Decision

- Every agent answer carries a voice selector and a checkbox "Speak agent answers
  automatically" next to the Speak button.
- The list of voices is **not** hardcoded in the frontend. It is fetched from
  `GET /tts/voices`, which proxies `GET {TTS_SERVICE_URL}/voices`, parses the plain-text
  answer into `{"voices": [...]}` and caches it for ~300 s in the backend. If the service
  is unavailable or the list is empty, the endpoint answers 503 and the frontend shows one
  localized toast and hides the list.
- The list is loaded **lazily**: the request goes out on the first opening of the
  dropdown, not when the message is mounted; afterwards the frontend module caches it and
  no further requests are made.
- The chosen voice is stored in `localStorage` under `dim0.tts.voice` (the pattern of
  `dim0.lang`) and sent with every request as the `voice` field. If no voice was chosen,
  `voice` is **not sent** and the backend falls back to `TTS_VOICE` from the environment.
- Auto-speak is **off** by default and stored under `dim0.tts.autoSpeak`. Enabling it is
  an explicit action of the user.
- The `tts.*` namespace has **eleven** keys in `en.json` and `ru.json`: `play`, `stop`,
  `loading`, `error`, `disabled`, `too_long`, `unavailable`, `empty`, `voice`,
  `voicesUnavailable`, `autoSpeak`.

This ADR closes **D06**.

## Why

**D06**: the key list could not stay at ten. The auto-speak checkbox needs its own
label, and that label matches none of the ten keys that already existed; reusing a
foreign string is not an option — it is a different caption on screen. The rule that
every new UI string goes through `t()` therefore forces an eleventh key, `tts.autoSpeak`.
The requirement was not weakened, one key was added: the count "ten keys" in the ticket
reads as "eleven".

The voice list comes from the service because the list of speakers is a property of the
model, not of our API. A hardcoded list in the frontend would break as soon as the model
or the image changes, and it would duplicate a fact that already exists in one place —
`SILERO_SETTINGS` in the compose file.

The list is loaded lazily so that a chat with fifty answers does not send fifty voice
requests, and so that the frontend does not ask the backend about voices in a
conversation where nobody wants to listen.

The auto-speak default of "off" is the owner's decision: a voice that starts talking
without being asked is worse than a missing feature.

The fallback to `TTS_VOICE` keeps a deployment that never touches the UI working: the
environment default applies until the user picks a voice.

## Consequences

- The backend must be able to reach the service before a voice can be picked; without it
  the dropdown stays empty and the toast explains why.
- The voice list can be stale for up to ~300 s (backend cache) after the model changes.
- The chosen voice lives in the browser only — a different browser or a cleared
  `localStorage` returns to the environment default.
- Eleven `tts.*` keys have to exist in **both** `en.json` and `ru.json`;
  `npm run i18n:check` enforces the parity. The count in the build documents was
  corrected to eleven after the build.
- The key `dim0.tts.autoSpeak` differs from the key named in the brief
  (`dim0.tts.autoplay`); the implementation follows the owner's later naming.

## Rejected alternatives

- **Hardcode the five voices in the frontend** — the list would drift from the model and
  would be wrong for any other image; it also breaks the project rule that addresses,
  ports and voices come from the environment.
- **Load the voices when the message is mounted** — one request per agent answer in a
  chat, for a list most users open once.
- **Load the voices once at application start** — a request on every page, even when the
  user never wants to listen.
- **Auto-speak on by default** — the agent would start talking without a user action.
- **Reuse an existing label for the auto-speak checkbox** — a different caption must
  have its own key.

## Verify

```bash
cd webui && npm run i18n:check
cd webui && npx vitest run src/features/agent/components/chat/actions/__tests__/speak-answer.test.tsx
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
```
