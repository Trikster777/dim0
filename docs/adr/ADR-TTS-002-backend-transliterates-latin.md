# ADR-TTS-002: The backend transliterates Latin into Cyrillic with its own 52-letter table before proxying

**Status:** Accepted · 2026-10-31
**Applies to:** `backend/topix/utils/tts.py`, `backend/topix/api/router/tts.py`

## Decision

- Preparing the text is the backend's job, not the service's. Before a request leaves for
  the synthesis service, `prepare_tts_text()` runs two steps **in this fixed order**:
  1. `transliterate_latin()` — a table of our own, 52 letters, Latin → Cyrillic
     (`q`→`к`, `w`→`в`, `x`→`кс`, `y`→`й`); after it no Latin letter remains;
  2. XML escaping — see ADR-TTS-003.
- `prepare_tts_text()` is the **single entry point**. `transliterate_latin()` is an
  internal step of it, exported only so it can be unit-tested as a pure function; no
  other caller may call it, and the two steps may not be swapped.
- The backend adds **no** transliteration dependency: the `transliterate` package is not
  pulled into `backend/pyproject.toml`.
- The prepared text is what the service receives; the service's own transliteration is
  never relied upon.

## Why

**This ADR closes D02 and D03.**

The Russian model cannot pronounce Latin at all: `convert_to_orig` works with
`ext_alph = None` for `ru` and fails with "Failed to parse SSML: 'NoneType' object has
no attribute 'keys'" as soon as a single Latin letter is present. Live check on the
container: `workflow`, `PowerShell`, `XML`/`API`/`JSON`, `R&D`, `Q&A` → 400.

The service's own transliteration cannot be a substitute — it has two defects: its
Russian table has no `q`, `w`, `x` (they stay Latin), and it replaces **whole words**
(`text.replace(word, result)`), so our CDATA marker breaks the word it is looking for.
In the tag-stripped copy `R&D` collapses to `RD`, the full text contains no such token,
the replacement silently does nothing and the Latin survives.

The `transliterate` package has the same hole: its Russian table leaves `q`/`w`/`x` in
Latin. A table of our own, 52 letters, is cheaper and has no such gap.

One side effect we keep deliberately: our own transliteration rewrites a user's word
`CDATA` into `ЦДАТА` before the service ever sees it, so the service's replacement can
no longer corrupt our own CDATA markers.

## Consequences

- Every Latin token in an answer is read out phonetically rather than literally — `API`
  is pronounced as a Cyrillic word, not as letters. That is the price of a Russian model
  that cannot pronounce Latin.
- The table is maintained by hand; a new letter is a one-line change plus a test.
- `prepare_tts_text` output still contains Latin letters — the word `CDATA` inside our
  markers. A naive assertion "the prepared text has no Latin letters" is therefore
  always red. The two required assertions are: on `transliterate_latin(...)` directly,
  and on the final string after stripping the markers with
  `re.sub(r"<!\[CDATA\[.*?\]\]>", "", text)`.
- The order is load-bearing: escaping first would let our own transliteration rewrite
  `CDATA` → `ЦДАТА` and produce invalid XML (400).

## Rejected alternatives

- **Rely on the service's transliteration** — incomplete table (`q`, `w`, `x` survive) and
  whole-word replacement that silently misses our CDATA markers; live results: 400 on
  `workflow`, `PowerShell`, `XML`, `R&D`, `Q&A`.
- **Add the `transliterate` package** — its Russian table leaves `q`/`w`/`x` in Latin,
  i.e. the same hole with a new dependency; the brief forbids new dependencies anyway.
- **Roll the model back to `v5_1_ru`**, which does have `ext_alph` — it would make the
  rule redundant rather than wrong, but it buys a newer model for a convenience.
- **Let the model fail and surface the error** — every answer containing a product name
  (`API`, `JSON`) would break the button; the fault is in our text, so we fix our text.

## Verify

```bash
cd backend && uv run pytest test/unit/utils/test_tts_utils.py -v
cd backend && uv run pytest test/unit/api/router/test_tts_router.py -v
```
