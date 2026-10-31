# ADR-TTS-003: XML-special characters are escaped with a per-character CDATA marker, applied after transliteration

**Status:** Accepted · 2026-10-31
**Applies to:** `backend/topix/utils/tts.py`, `backend/topix/api/router/tts.py`

## Decision

- `&`, `<` and `>` are escaped by wrapping **each character** in its own CDATA section:
  `&` → `<![CDATA[&]]>`, `<` → `<![CDATA[<]]>`, `>` → `<![CDATA[>]]>`. One pass, three
  characters, nothing else.
- Named entities (`&amp;`, `&lt;`) and numeric entities (`&#38;`) are forbidden.
- The whole text is never wrapped in CDATA — only those three characters are.
- Escaping is step 2 of `prepare_tts_text()` and therefore runs **after** the
  transliteration (ADR-TTS-002).
- A chunk boundary may never fall inside a CDATA marker: the marker is a protected range
  for the splitter, exactly like an abbreviation. Every chunk that leaves for the service
  must contain whole CDATA sections.

## Why

**This ADR closes D01.** The service wraps our text into `<speak>` but does not escape
it, and its normalizer destroys XML entities: `translit_text` strips tags and
transliterates any `[a-zA-Z]+`, while `num2words` expands numbers — so `&amp;` becomes
`&амп;` and `&#38;` becomes `&#тридцать восемь;`. Both end up as invalid XML and the
service answers 400 "Invalid XML format", which the client sees as 502. Live check on
the container: raw `&`, `<` and `]]>` → 400; `&amp;` and `&#38;` → 400 as well; the
per-character CDATA form → 200 + WAV with real sound. A 16-case accumulator: 5/16 with
raw text, 16/16 with prepared text.

Only the three characters are wrapped because the service's normalizer still has to see
the content: if the whole text sat inside a CDATA section, the normalizer (numbers →
words, markdown → plain text) would stop seeing it and the reading would get worse.

The marker is placed after the transliteration because the normalizer strips tags
**before** transliterating, so the Latin letters of the word `CDATA` never reach the
model — but that same strip is why our own transliteration would rewrite `CDATA` →
`ЦДАТА` if it ran second, producing invalid XML.

## Consequences

- The prepared text contains XML markup: it is not human-readable and must not be shown
  to the user, logged as the text of the answer, or compared with the original answer.
- The markers are the only place where Latin letters survive preparation — which is why
  the "no Latin letters" assertion has to strip them first.
- The splitter has to treat a marker as an atomic range. The first implementation did
  not, and a long answer with many markers broke the XML and produced 502 instead of
  sound.
- `>` is escaped although a bare `>` is valid XML — for symmetry, and so that a stray
  `]]>` in user text cannot assemble itself.

## Rejected alternatives

- **Named entities (`&amp;`)** — the service's normalizer transliterates the letters
  inside them and the XML stays invalid: 400 on a live container.
- **Numeric entities (`&#38;`)** — the normalizer expands numbers inside them
  (`&#38;` → `&#тридцать восемь;`): also 400.
- **Wrap the whole text in one CDATA section** — the service's normalizer stops seeing
  the content, so numbers and markdown are no longer prepared for speech.
- **Escape on the frontend** — the text would have to travel twice and the same rule
  would exist in two languages; the backend already owns the text.
- **Let the service fail and map its 400 to a friendly message** — the user would get an
  error for an answer that is perfectly speakable.

## Verify

```bash
cd backend && uv run pytest test/unit/utils/test_tts_utils.py -v
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
```
