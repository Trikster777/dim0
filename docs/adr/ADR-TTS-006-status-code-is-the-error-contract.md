# ADR-TTS-006: The response status is the error contract — the backend stays neutral, the frontend localizes

**Status:** Accepted · 2026-10-31
**Applies to:** `backend/topix/api/router/tts.py`, `webui/src/lib/i18n/errors.ts`, `webui/src/api.ts`, `webui/src/locales/{en,ru}.json`

## Decision

- The backend answers errors with a status code and a **neutral English** `detail`. It
  never translates anything and never forwards the service's error text — the service's
  4xx answers are converted to 502 just like its 5xx.
- The status code carries the whole meaning. The frontend maps it to a locale key:
  `ENDPOINT_STATUS_KEYS["/tts"] = {400: "tts.empty", 413: "tts.too_long",
  502: "tts.unavailable", 503: "tts.disabled"}`.
- The backend validates before it spends a synthesis:
  - empty text → **400**;
  - text with nothing to say in it — no letter and no digit (`>`, `---`, `***`, emoji
    only) → **400**, and the request never reaches the service;
  - more than 50 000 characters → **413**;
  - the module is off (`TTS_ENABLED` is not `true`) → **503**;
  - the service failed or answered an error → **502**.
- `400` gets its own key `tts.empty` and does not reuse `tts.too_long`: 413 means "too
  long", and for an empty answer that would be a lie.
- The frontend needs the status to survive the request: `apiFetch` throws a plain `Error`
  without a `status` field, so TTS uses its own error class carrying `status` and
  `endpoint` (precedent: `SendMessageError`).

This ADR closes **D05**.

## Why

**D05**: text that collapses into nothing after the service's normalization (`>`,
`---`, `***`, emoji only) does not produce an error at the service — it produces a WAV
with almost no sound. The model receives `<speak></speak>` and answers with a file. The
user would press the button and hear silence with no explanation. Therefore the backend
checks the text itself: if it contains neither a letter nor a digit, there is nothing to
say, and the request is rejected with 400 before a synthesis is paid for. (A failed
synthesis does not poison the service's cache: six 400s left no file in
`/usr/app/audios`.)

The localization rule is the project's existing one (`I18N.md` §7.1): strings that reach
the UI are translated on the frontend; the backend's Python files stay English so the
fork does not diverge from upstream on every merge. The same pattern is already used for
the rest of the API, so TTS follows it instead of inventing a second one.

Mapping the status instead of the text is what makes the "nothing to say" case possible
at all: the service's own error message ("Silero model failed: Invalid XML format")
would be neither localized nor safe to show.

The status has to survive the HTTP layer, otherwise the frontend cannot tell 503 from
502 from 413 — hence the separate error class.

## Consequences

- The frontend has to know the status vocabulary of the endpoint; adding a status means
  adding a key in both dictionaries and in `ENDPOINT_STATUS_KEYS`.
- The backend's `detail` is not meant to be read by a user — it exists for the logs.
- The 400 check is a heuristic ("a letter or a digit"), so text made only of symbols is
  refused even if a service could pronounce it.
- A service that answers an error and a service that is broken are indistinguishable:
  both become 502. That is deliberate — the client must not see another system's text.
- The 50 000 character limit is a safety net, not a product rule: the service has no
  limit of its own (it is a POST, not a GET), and any real agent answer is far below it.

## Rejected alternatives

- **Let the service decide what is speakable** — it answers with near-silence instead of
  an error; the user hears nothing and does not learn why.
- **Reuse `tts.too_long` for an empty answer** — 413 means "too long"; the message
  would be wrong.
- **Translate on the backend** — the backend's Python files would diverge from upstream
  on every merge, against the project's rule.
- **Forward the service's error text to the client** — foreign, untranslated text, and it
  can leak the service's internals.
- **Derive the message from the `detail` string** — brittle and untranslatable.

## Verify

```bash
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
cd webui && npm run i18n:check
```
