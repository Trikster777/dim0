# Dim0 — Architecture

How the codebase fits together — the non-obvious wiring and invariants, not a file listing (you can `ls`). For what the product does see [`features.md`](./features.md); for in-flight work see [`roadmap.md`](./roadmap.md). Read-on-demand reference — verify against code before relying on a detail.

## Product in one line

Dim0 ("The Thinking Canvas") is a self-hostable infinite real-time canvas where notes, mini-apps, code sandboxes, and documents live as nodes, and a board-aware AI agent reads the canvas and writes results back as editable nodes.

## Repo layout

- `backend/` — FastAPI service. Package name is **`topix`** (the former product name; still the module path, DB name, and Docker command).
- `webui/` — React 19 + TypeScript SPA. Two core domains: `features/agent/` (chat/agent) and `features/board/` (canvas).
- `build/` — Docker Compose, `schema.sql`, published-image compose.
- `docs/`, `scripts/`, `Makefile`, `VERSION` (single semver synced by `scripts/sync_version.py`).
- `@canvas-harness/{core,react,sync-broadcast}` is an **npm dependency** (maintained separately), **not in-tree source**.

## Two mental models to hold

### 1. Two agent execution paths (mid-cutover)

The same chat UI drives one of two runtimes, chosen by `local` on ChatContext (`local = !canCollab`):

- **Server-side agent (legacy, retires in "G5"):** `POST /chats/{id}/messages` → `AssistantManager`/`Plan` on the OpenAI-Agents SDK, runs in-process on OUR keys, writes to boards via `AgentBoardBridge`. Entries `backend/topix/agents/run.py`, `agents/assistant/manager.py`.
- **Browser engine (current, BYOK-or-managed):** the tool-calling loop runs in the browser (`webui/src/features/agent/engine/agent-loop.ts`) and mutates the live canvas store directly. External capabilities go through thin metered proxies `/ai/llm[/stream]`, `/ai/search`, `/ai/code`, `/ai/fetch`, `/ai/parse` (`backend/topix/api/router/ai.py`).

Both coexist today, but the direction is one runtime: **everything moves to the browser engine and the server-side agent is retired entirely** (the backend keeps only the `/ai/*` proxies). See roadmap "North star".

### 2. Two persistence planes (backend REST vs offline-first)

- **Backend/REST plane:** full Dim0 `Note`/`Link` domain model, round-tripped to canvas-harness `Node`/`Edge` through `webui/src/features/board/harness/convert/`.
- **Offline-first plane:** the harness scene *is* the model — geometry/content/style are native harness fields, Dim0 domain fields ride in `node.data`; persistence is identity (no convert layer). `webui/src/features/board/model/`. The three planes + IndexedDB schema + promotion/delete invariants: [`offline-first-data-model.md`](./offline-first-data-model.md).

Don't conflate them.

## Backend

- **Composition root** `backend/topix/api/app.py` — `create_app`/`lifespan` wire ONE shared Postgres pool (per-store pools used to exhaust PG under burst), all stores, the collab `RoomRegistry` (single-worker v1), and `AgentBoardBridge`. `apply_schema` runs idempotently every boot (additive migrations, no manual step). OpenAPI docs are stage-gated to non-prod. CORS is `*` + credentials (worth flagging).
- **Cross-store split (load-bearing):**
  - **Postgres** = relational metadata + durable logs: `graphs` (= boards), `graph_user` (membership/roles), chats, users, billing, share links, `board_oplog`, `note_revisions`, `mini_app_state`. Schema: `build/schema.sql`.
  - **Qdrant** = ALL graph content in one collection (`topix`): notes, links, documents, chunks, chat messages, subscriptions — `type` is a payload field, not separate collections. `backend/topix/store/qdrant/store.py`.
  - **Redis** = ephemeral: WS tickets, the per-board `seq` counter, rate-limit/quota windows.
  - **No transaction spans Postgres + Qdrant.** e.g. adopt creates the PG graph row and separately writes Qdrant content; partial failures can diverge. Chunk cleanup on note delete is fire-and-forget.
- **Collab engine** (`backend/topix/collab/`; WS handler in `api/router/collab.py`). Invariant: **collab is the only edit path** — every mutation (human WS op or in-process agent) flows through allocate-seq → apply-to-`GraphStore` → broadcast `peer-op`. The backend is a sequencer + relay; the client owns conflict resolution — why + the full contract: **[ADR-SYNC-001](./adr/ADR-SYNC-001-offline-first-relay.md)**.
  - Seq authority is the **oplog** (`store/collab_oplog.py`: Redis `INCR` seeded from PG `MAX(seq)`), **not** `room.seq` (a warm cache). Survives restart, so client `serverSeq` ordering holds.
  - WS auth uses a single-use Redis ticket (a WS upgrade can't carry a bearer). Welcome modes by `since_seq`: snapshot / catch-up / live. Reconnecting clients replay their outbox; the relay **dedups by `batch.id`** and re-acks at the original seq.
  - `apply_ops.py` persists `node.*`/`edge.*`; `group.*`/`frame.reorder` are relayed to peers but NOT persisted. Wire colors are theme-adapted and ignored — canonical colors come from `data._storedColors`.
  - `agent_bridge.py`: the server agent appears as room client "agent" (`is_system`) without holding a slot; no-ops the broadcast when no room is open (next opener gets it via snapshot).
- **Model catalog** `backend/topix/config/catalog.py` over `backend/topix/models.yml`: providers + ordered routes per model; resolution picks the first route whose provider key is present (`available_llms` / `resolve_code`). Adding a model = one YAML entry. `backend/topix/services.yml` does the same for non-LLM services. (`llm_models.yml` is dead — see roadmap.)
- **Metering / tiering** `api/utils/rate_limit/`: `enforce_rate_limit` resolves plan → minute/day/billing-cycle quota windows. When billing is OFF (self-host), the plan resolves to `plus` — everything unlocked.
- **Mini-app validation** `backend/topix/mini_app/compile.py`: agent JSX is transpile-validated via a sucrase subprocess, **never evaluated server-side** (evaluating would expose Node globals — an RCE surface).

## Frontend

- **Shell / routing** `webui/src/routes/index.ts` (one file, TanStack code-based). **Local-first "open front door":** `/`, `/local`, `/local/$boardId`, `/share/$token` are intentionally UNGUARDED and make zero backend calls when signed out. Signed-out sentinel is `userId === "root"` (non-empty) — gate on `isSignedIn()`, never `!!userId`. Board surface routes (`/boards/$id/sheets/$noteId`, `/mini-apps/$noteId`, …) are children of `/boards/$id` with `component: () => null` so the board stays mounted while a surface opens.
- **Board harness** `features/board/harness/canvas/harness-canvas.tsx` — one canvas-harness store per board, created once and re-hydrated by scope. Behavior turns on three axes: `local` (device vs backend), `syncEngine` (`legacy`|`v2`, synced boards only), `rootId` (which folder layer is projected). `_storedColors` is the color source of truth across convert + both collab clients.
- **Offline-first sync** `features/board/harness/sync/board-sync.ts` (v2 coordinator) + `persist/local/` (IndexedDB `dim0` DB). The outbox *is* the oplog tail past a `syncedSeq` cursor. Rebase LWW: undo unacked local batches → apply remote → replay local. `deleteBoard` cascades its stores incl. `sync_meta` (a stale cursor is a silent edit-loss trap). Legacy `use-ws-collab.ts` still serves untouched synced boards. Decision + rejected alternatives → **[ADR-SYNC-001](./adr/ADR-SYNC-001-offline-first-relay.md)**; schema + invariants → [`offline-first-data-model.md`](./offline-first-data-model.md).
- **Agent → canvas** `features/board/harness/agent/`: agent tool outputs land as `origin:"remote"` batches (bypass the undo stack + debounced save, since the server already has them). Human edits are `origin:"local"`/`"history"`.
  - **Live inserts must carry the convert layer's `style` + `_storedColors`.** The browser agent's tools (`features/agent/engine/tools.ts`) add harness nodes/edges *directly*, skipping the convert layer that the backend path and reload both use (`noteToNode`/`linkToEdge`). If a live-created node/edge omits `style`/`_storedColors`, the lib paints its own defaults (rounded corners, rougher edges) and dark-mode display colors get persisted as canonical — so the live board drifts from its reloaded/peer form until refresh. Any new live emitter of a node/edge must mirror (or route through) the convert layer's style + canonical-color computation. Regressed twice; see `tools.ts` `canonicalNodeStyle`/`canonicalEdge`.
- **Browser agent on synced boards** (flag `dim0_local_agent_on_synced`): a synced board's chat runs the in-browser engine (pill + drawer, wired at `board-view.tsx`) and rides the v2 relay; its transcript is backed up to the server as opaque JSON for cross-device history. Storage model + why → **[ADR-AGENT-001](./adr/ADR-AGENT-001-opaque-transcript-storage.md)**. A flag-gated step toward retiring the backend agent (roadmap "North star").
- **Off-board tool confirm gate + result contract:** network/code tools are gated behind a user confirmation (`CONFIRM_TOOL_NAMES` → `executeToolCall`), and every tool call resolves to one `ToolFailure` shape (`isToolFailure`). Rules for adding tools + confirm semantics + why → **[ADR-AGENT-002](./adr/ADR-AGENT-002-tool-confirm-gate-and-result-contract.md)**.
- **Service resolution + metering:** each capability (`llm`/`search`/`code`/`fetch`/`parse`) resolves independently to BYOK / managed / off (`engine/services/resolve.ts`); LLM BYOK keys go **direct to the provider** (never our servers), the rest are **relayed per-request** as `X-Provider-Key` (used, not stored, `localStorage`). One `X-Run-Id` per user message meters a whole run as one unit (server charges once). Precedence, transport split, and the two metering deps → **[ADR-AGENT-003](./adr/ADR-AGENT-003-service-resolution-and-metering.md)**.
- **Local document Q&A:** managed OCR (`/ai/parse`) then offline chunk + Orama BM25 index + `doc_search` tool with citations — no vector store. Why + ingest invariants → **[ADR-SEARCH-001](./adr/ADR-SEARCH-001-local-doc-qa-bm25.md)**.

## TTS module (speech synthesis)

- **Flow:** the browser posts an agent answer to our own API (`POST /tts`, body `{"text", "voice"}`); the backend prepares the text, proxies it to the `silero-tts` container and answers with **one** WAV blob; the frontend wraps that blob into an object URL and plays it. The browser never addresses the synthesis service — the service contract stays inside our router. ADR → **[ADR-TTS-005](./adr/ADR-TTS-005-frontend-proxies-through-backend.md)**.
- **Boundaries:** `backend/topix/utils/tts.py` owns the text rules and nothing else (pure functions, no HTTP, no FastAPI): `prepare_tts_text`, `split_text_for_tts`, `transliterate_latin`, `has_speakable_content`, `assemble_wav`. `backend/topix/api/router/tts.py` owns the whole HTTP surface: the enabled check, the validation, the voice default, the chunk-to-request decision, the proxying, the WAV gluing, the voice cache, the status codes. `backend/topix/api/app.py` adds one `include_router(tts.router)`. On the frontend `webui/src/features/agent/components/chat/actions/speak-answer.tsx` owns the button, the playback, the abort, the voice select and the auto-speak flag; `webui/src/api.ts` owns the binary fetch and the error type; `webui/src/lib/i18n/errors.ts` owns the status → locale key map; `webui/src/locales/{en,ru}.json` owns the eleven `tts.*` strings. `build/docker-compose.yml` owns the service. The human-readable doc of the module is [`TTS.md`](../TTS.md) (Russian).
- **The preparation order is load-bearing:** `prepare_tts_text` transliterates Latin → Cyrillic **first** and escapes `&`, `<`, `>` into per-character CDATA sections **second**. Reversing the two steps makes the transliteration rewrite the word `CDATA` inside our own marker → invalid XML → the service answers 400 → the client gets 502. Named and numeric entities are forbidden — the service's normalizer destroys them. ADR → **[ADR-TTS-002](./adr/ADR-TTS-002-backend-transliterates-latin.md)**, **[ADR-TTS-003](./adr/ADR-TTS-003-cdata-escaping.md)**.
- **The split is computed on the *prepared* text,** so a chunk border can land inside an escape marker: the chunker treats CDATA markers and known abbreviations (`т.е.`, `и т.д.`) as protected ranges and moves the border in front of them — every chunk that leaves for the service carries whole CDATA sections. Chunks are ≤ 250 characters, cut on sentence boundaries; a single sentence above the limit is cut on soft separators (comma, semicolon, colon, dash) — a compromise marked in the code.
- **Chunk count ≠ request count:** up to two chunks the whole prepared text goes to the service in **one** request; from three chunks up the text is sent chunk by chunk and the returned WAVs are glued into one file (header of the first chunk, recalculated data length). One failing chunk fails the whole request — no partial file reaches the client. ADR → **[ADR-TTS-004](./adr/ADR-TTS-004-no-streaming-single-wav.md)**.
- **The status code is the error contract:** the backend answers a neutral English `detail` and never forwards the service's text (a service 4xx becomes 502 just like its 5xx): 503 module off, 400 empty or nothing speakable, 413 over 50 000 characters, 502 service unreachable or failed, 401 without auth. The frontend maps them in `ENDPOINT_STATUS_KEYS["/tts"]` → `tts.empty` / `tts.too_long` / `tts.unavailable` / `tts.disabled`; the raw `detail` never reaches the UI. ADR → **[ADR-TTS-006](./adr/ADR-TTS-006-status-code-is-the-error-contract.md)**.
- **The voice list comes from the service:** no voice name is hardcoded in the frontend. The backend asks the service (`GET /voices`, plain text, one name per line), parses it and keeps it in `app.state.tts_voices_cache` for ~300 s; the frontend fetches `GET /tts/voices` on the first opening of the select and keeps it in a module-level cache. A stored voice the service no longer offers is dropped, and the backend then falls back to `TTS_VOICE`. ADR → **[ADR-TTS-008](./adr/ADR-TTS-008-voice-and-auto-speak-in-ui.md)**.
- **Service and switch:** image `navatusein/silero-tts-service:latest`, model `v5_6_ru`, internal port 9898 — inside the compose network only, never published. The module is off by default (`TTS_ENABLED=false` in all five profiles); while it is off the button stays visible, one localized toast explains it, and the button goes inert until the page is reloaded. ADR → **[ADR-TTS-001](./adr/ADR-TTS-001-silero-tts-service-image.md)**, **[ADR-TTS-007](./adr/ADR-TTS-007-module-off-by-default.md)**.

## Build targets

1. Web bundle + PWA (`webui/vite.config.ts` — icon code-splitting, offline SPA fallback).
2. Standalone mini-app runtime inlined to one HTML (`webui/vite.mini-app.config.ts`, `webui/mini-app-runtime/`) — sucrase-compiled agent JSX in a sandboxed iframe (single-frontend opaque-origin by default; cross-origin via `VITE_MINI_APP_ORIGIN`).
3. **Tauri desktop** (`webui/src-tauri/`) — a standalone app: local-first + offline on the user's own keys, and (optionally) managed AI + synced boards when pointed at a server. Reuses the SPA + the #154 seams. Two load-bearing decisions:
   - Local storage swaps IndexedDB → **rusqlite** behind the same `StorageEngine` port (`getLocalStores` on `isTauri()`), with real transactions via a `sql_tx` command. Why (and why not the pooled SQL plugin) → **[ADR-DESKTOP-001](./adr/ADR-DESKTOP-001-rusqlite-local-storage.md)**.
   - BYOK provider calls go **direct** (CORS-free) via `@tauri-apps/plugin-http`; managed + synced ride the one `API_URL`, driven by a baked `VITE_API_URL` (from the `API_ORIGIN` release variable) or a localStorage override (`features/desktop/`). Contract → **[ADR-DESKTOP-002](./adr/ADR-DESKTOP-002-byok-relay-and-remote-path.md)**.
   - Distribution: `desktop-release.yml` publishes a GitHub Release on a version tag; `install.sh`/`install.ps1` install it prompt-free even unsigned (ad-hoc signed, terminal downloads aren't quarantined). Why → **[ADR-DESKTOP-003](./adr/ADR-DESKTOP-003-distribution-and-unsigned-install.md)**.

Self-host via Docker Compose: `make up` (from source) or `make pull && make run` (published images `winlp4ever/dim0-{backend,webui}`). Needs at least one LLM provider key (`OPENAI_API_KEY` or `OPENROUTER_API_KEY`); `LINKUP_API_KEY` powers web search (see `.env.sample`).
