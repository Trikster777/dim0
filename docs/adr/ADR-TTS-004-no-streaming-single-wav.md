# ADR-TTS-004: No streaming — the backend returns one WAV (48 kHz, mono, 16 bit) glued from the chunk PCM

**Status:** Accepted · 2026-10-31
**Applies to:** `backend/topix/api/router/tts.py`, `backend/topix/utils/tts.py`, `webui/src/features/agent/components/chat/actions/speak-answer.tsx`

## Decision

- The module has **no streaming** in this version: `TTS_STREAMING=false` by default and
  `StreamingResponse` is not used anywhere. The service returns a finished WAV and
  cannot stream.
- The backend splits the text into chunks (≤ 250 characters, only at sentence
  boundaries), synthesizes every chunk and glues them into **one** WAV file:
  - the RIFF header is taken from the first chunk,
  - the PCM data of the chunks follows one another without gaps,
  - the data length in the header is recomputed.
- The response is a single binary `audio/wav` — never base64, never a JSON envelope —
  and the endpoint is **not** wrapped in `@with_standard_response` (that decorator wraps
  the body in `{"status":"success","data":…}` and swallows `HTTPException`, so a binary
  WAV cannot pass through it).
- A failure of **any** chunk fails the whole request: 502, no partial file.
- The frontend plays the finished file with `new Audio(URL.createObjectURL(blob))` — no
  Web Audio scheduler, no crossfade.

This ADR closes two decisions at once: **there is no streaming**, and **the gluing rule
lives on the backend**.

## Why

The chosen image produces a complete WAV and has no streaming endpoint, so
`StreamingResponse` would have had nothing to stream. The owner's decision of
31.10.2026 put streaming, the Web Audio scheduler and the crossfade out of the first
version.

The gluing rule follows from that. The alternative — concatenating the chunks in the
browser — means parsing RIFF headers on the frontend and reassembling them there, which
is exactly the work the brief cancelled together with streaming. Keeping the assembly on
the backend also keeps the response a single file, which is what the `Blob` +
`URL.createObjectURL` playback path expects.

Partial results are rejected for the same reason: a half-synthesized answer would be
played as if it were complete. When the second of two chunks fails, the client gets 502
and no audio at all.

## Consequences

- The user waits for the whole answer before hearing anything; a long answer has a
  proportionally long delay before the first sound.
- The browser holds the whole file in memory as a `Blob` — acceptable at the 50 000
  character limit.
- The format is fixed: WAV, 48 kHz, mono, 16 bit, RIFF. The frontend does not transcode.
- A chunk boundary must never split a CDATA marker (ADR-TTS-003). This was a real defect
  found in review: with three or more chunks the cut landed inside `<![CDATA[…]]>` (the
  marker contains `!`, which the sentence splitter counted as a sentence end), the
  service rejected the invalid XML and the client got 502 instead of sound. A live
  re-check with 15 chunks and 58 markers confirmed the fix (200, valid WAV).
- Streaming, the Web Audio buffer scheduler and the crossfade stay out of scope; adding
  them later means a new ADR.

## Rejected alternatives

- **Streaming via `StreamingResponse` + Web Audio** — the service cannot stream; the
  crossfade and the two-chunk buffer would be frontend complexity with nothing to play.
- **Raw PCM from the backend, RIFF parsing on the frontend** — the frontend would have
  to rebuild the header, i.e. the assembly rule would live in two places.
- **Concatenating the chunks in the browser** — the frontend would parse headers and
  merge blobs; the same rule in TypeScript and in Python.
- **Base64 in a JSON response** — inflates the payload by about a third and breaks the
  playback path; a binary answer is the first in this project, so it is set explicitly.
- **Returning the chunks as they become ready** — the client would have to join them,
  which is the frontend assembly we just rejected.

## Verify

```bash
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
cd webui && npx vitest run src/features/agent/components/chat/actions/__tests__/speak-answer.test.tsx
```
