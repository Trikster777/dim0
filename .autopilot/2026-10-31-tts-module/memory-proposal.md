# Proposal for `AGENTS.md` — what the TTS module adds (branch `feature/tts-module`)

For the next session that opens this repository. The owner's `AGENTS.md` was **not** modified — every block below is ready to paste into it. Written 2026-10-31 from the finished branch, not from the plan.

## Commands

Backend — run from `backend/` (the virtualenv is already there: `backend/.venv`):

| Command | What it does |
|---|---|
| `./.venv/Scripts/python.exe -m pytest test/unit -q` | whole backend unit suite (842 tests) |
| `./.venv/Scripts/python.exe -m ruff check topix test/unit` | backend lint |
| `./.venv/Scripts/python.exe -m pytest test/unit/api/router/test_tts_router.py -v` | one backend test file (24 tests) |
| `./.venv/Scripts/python.exe -m pytest test/unit/utils/test_tts_utils.py -v` | one backend test file (27 tests) |

Frontend — run from `webui/`:

| Command | What it does |
|---|---|
| `npm run check-all` | types (`tsc -p tsconfig.app.json --noEmit`) + lint (`eslint .`) |
| `npm run i18n:check` | en/ru key parity |
| `npx vitest run` | whole frontend unit suite (172 files / 1744 tests) |
| `npx vitest run src/features/agent/components/chat/actions/__tests__/speak-answer.test.tsx` | one frontend test file (16 tests) |
| `npx playwright test e2e/i18n-ru.spec.ts` | e2e smoke (see Traps) |

- Install: nothing to install — `backend/.venv` and `webui/node_modules` are in place; `uv sync` is **not** safe here (see Traps).
- Run (synthesis service only): `docker compose -f build/docker-compose.yml --profile local up -d silero-tts` — the whole stack also needs Postgres, Redis and Qdrant.
- Check the compose file: `docker compose -f build/docker-compose.yml --profile local config` — `silero-tts` must appear with **no** `ports` block.

## Pointers

- `backend/topix/api/router/tts.py` — the whole HTTP surface of the module (`POST /tts`, `GET /tts/voices`), mounted by one `include_router` in `backend/topix/api/app.py`.
- `backend/topix/utils/tts.py` — the text rules, pure functions only: `prepare_tts_text` (transliterate → CDATA), `split_text_for_tts`, `assemble_wav`.
- `webui/src/features/agent/components/chat/actions/speak-answer.tsx` — speak button, playback, abort, voice select, auto-speak; wired next to "Copy" in `response-actions.tsx`.
- `webui/src/api.ts` — `responseType: "blob"` and `ApiRequestError`; the only HTTP layer of the frontend.
- `webui/src/lib/i18n/errors.ts` — `ENDPOINT_STATUS_KEYS["/tts"]`: 400/413/502/503 → `tts.*` locale keys.
- `build/docker-compose.yml` — the `silero-tts` service (internal port 9898) and the `TTS_*` variables of all five `backend-<stage>`.
- `TTS.md` — the module's own doc (Russian): run book, manual checklist, list of upstream conflicts.

## Traps

- `make` is **not installed** on this machine — no `make check` / `make test`; use the commands above.
- `uv run` re-resolves and rewrites `backend/uv.lock` (it pins `topix 0.3.94` while the package `VERSION` says `0.3.101`) — always call `backend/.venv/Scripts/python.exe -m pytest`, never `uv run pytest`, and never `uv sync`.
- Git on this machine has **no author configured**: every commit must pass `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` inline.
- `webui/playwright.config.ts` starts the dev server with the POSIX form `APP_PORT=4321 npm run dev`; `cmd.exe` on Windows cannot run it, so Playwright silently reuses whatever already listens on 4321 (`reuseExistingServer: true`) — a green e2e run on Windows proves nothing unless you know which server answered (the form works on Linux/macOS).
- The path of the project contains a non-ASCII user name — some native libraries misbehave with it.
- `docker compose --profile local up -d` starts the whole stack; the synthesis service alone: `docker compose -f build/docker-compose.yml --profile local up -d silero-tts`.
- The `silero-tts` container downloads the voice model (~147 MB) on **first start** into the `silero_models` volume and keeps ~700–900 MB resident.
- After `prepare_tts_text` the string still holds Latin — the word `CDATA` inside our own markers; a "no Latin letters" assertion must strip the markers first (`re.sub(r"<!\[CDATA\[.*?\]\]>", "", text)`).

## Environment

- `TTS_ENABLED` — master switch; while it is not `true` both endpoints answer 503.
- `TTS_SERVICE_URL` — base URL of the synthesis service inside the compose network (default `http://silero-tts:9898`).
- `TTS_VOICE` — voice used when the request carries none (of `aidar`, `baya`, `kseniya`, `xenia`, `eugene`).
- `TTS_FORMAT` — wire format of the audio; only `wav` is implemented (48 kHz, mono, 16 bit).
- `TTS_STREAMING` — reserved for the future; the module never streams.
- `TTS_MODEL_URL` — model file the container downloads on first start; read by Compose, passed to the service via `SILERO_SETTINGS`.
- `dim0.tts.voice`, `dim0.tts.autoSpeak` — browser `localStorage` keys of the frontend (chosen voice, auto-speak flag).

## Architecture

- Architecture of the project, the TTS data flow and its module boundaries → `docs/architecture.md` (section "TTS module").

## How Autopilot works here

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Требование из `manifest.md` может снять
только пользователь. Прерванную сборку продолжает «продолжи автопилот».

### Правка без автопилота

Мелкий баг или доводка после сборки — обычная сессия, без прогона.

Сначала прочитай:
1. `.autopilot/PROGRESS.md` — что не доделано, известные баги, о чём договорились с пользователем.
2. Что правили после последней сборки — первая строка таблицы в «История git».
3. Только если правка их касается: почему сделано так — `docs/adr/`; что значат слова — `CONTEXT.md`;
   что именно просили — `manifest.md` в папке сборки (указана в начале `PROGRESS.md`).

После правки:
- коммит — по правилам из «История git»;
- строка в «Правки без автопилота» в `PROGRESS.md`: дата — что — почему;
- починенный пункт из «Не доделано» или «Известные баги» — удали;
- договорились с пользователем о том, что следующая сборка не должна пересматривать, —
  строка в «Договорились», его словами.

### История git

Целиком не читай — бери срез под вопрос:

| Вопрос | Команда |
|---|---|
| что правили после последней сборки | `git log --oneline "$(git log -1 --format=%h --grep='^Autopilot: сборка сдана')"..HEAD -- . ':(exclude).autopilot'` |
| всё, что делали ради требования | `git log --oneline --grep="R02"` |
| история файла | `git log --oneline -10 -- <файл>` |
| когда появился или исчез код | `git log --oneline -S "<фрагмент>"` |
| почему строка такая | `git blame -L <с>,<по> <файл>`, затем `git show <sha>` |
| что внутри коммита | `git show --stat <sha>` |

Срез длиннее ~30 коммитов — отдай его субагенту и возьми выжимку в десять строк.

Коммит: заголовок — что (`fix: даты в одном формате`), тело — почему, трейлер
`--trailer "Requirements: R02"`, если правка касается требования из `manifest.md`.
Заголовок `Autopilot: сборка сдана` пишет только автопилот — по нему находят последнюю сборку.

## Corrections to the current `AGENTS.md`

- Nothing in the current file became **false** because of this feature — no correction line is needed.
- What the file lacks and the blocks above add: the check commands, the `TTS_*` variables, the TTS pointers, the pointer to `docs/architecture.md`, and the two subsections «Правка без автопилота» / «История git».
- One pointer the file does not have yet: `TTS.md` — the module's own documentation (Russian).
