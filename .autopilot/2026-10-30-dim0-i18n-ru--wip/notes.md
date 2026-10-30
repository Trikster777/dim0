# dim0 / webui → i18n (ru): заметки по разведке кода

Дата: 30.10.2026. Область — только `webui/`; `backend/topix` (FastAPI) не трогаем.
Метод: чтение кода. `npm install` / `npm run build` / тесты **не запускались** (`node_modules` отсутствует).

Итог: i18n-инфраструктуры нет вообще — нет `i18next`/`react-i18next`, нет `IntlProvider`, нет каталога локалей;
кириллицы в `webui/src` нет. Извлечение — greenfield. Всего 273 `.tsx`, 738 non-test `.ts/.tsx`;
строки найдены в **206 файлах**, эвристический нижний итог — **~1013 строк** (реалистично 1100–1200:
не учтены const-массивы подписей внутри `.tsx` — ещё ~109 записей, плюс многострочный JSX).

## 1. Карта фронтенда

Точки входа — две: `src/main.tsx` (основное приложение) и `src/features/mini-app/mount.tsx` (отдельный origin,
single-file сборка `vite.mini-app.config.ts`). В `main.tsx`: StrictMode → `QueryClientProvider` → `RouterProvider`;
`registerSW()` если не Tauri; классы `.tauri`/`.tauri-webkit`; `preloadCanvasFonts()`. Toaster в `main.tsx` НЕТ — он в `RootLayout`.

Роутер — код-дерево `src/routes/index.ts` (389 строк, не file-based): `createRootRoute({ component: RootLayout,
notFoundComponent: NotFoundPage })`. Гарды: `requireAuth` (token + exp из JWT), `requireVerifiedAuth`
(`getEmailVerificationStatus`; 404 "User not found" → `/signin`). Там же URL-константы: `NewChatUrl, ChatUrl, DashboardUrl,
BoardUrl, SheetUrl, CodeSandboxUrl, WidgetUrl, MiniAppUrl, AppletUrl, SubscriptionsUrl, NewsfeedsUrl, NewsfeedDetailUrl,
SettingsUrl, SettingsBillingUrl, InstallUrl, ShareLandingUrl, Local*Url` (7 локальных).

| Маршрут | Компонент | Видно пользователю |
|---|---|---|
| `/signin`, `/signup`, `/signin/google/callback`, `/verify-email`, `/forgot-password`, `/reset-password` | `features/signin/screens/*` | да; шелл сайдбара скрыт |
| `/` · `/home`→редирект | `IndexHome` → `HomePage` / `BoardsHome` | да |
| `/chats`, `/chats/$id` | `ChatScreen` | да |
| `/boards` · `/boards/$id` + дети `/sheets/$noteId`, `/code-sandbox/$noteId`, `/widgets/$noteId`, `/mini-apps/$noteId`, `/applets/$noteId` (компоненты `null`) | `DashboardScreen`, `BoardScreen` | да |
| `/subscriptions`, `/subscriptions/$id`, `.../newsfeeds/$newsfeedId` | newsfeed-экраны | да |
| `/settings`, `/settings/billing`, `/install`, `/share/$token` (без гарда) | `settings-screen`, `billing-screen`, `install-screen`, `share-landing` | да |
| `/local`, `/local/$boardId` + те же 5 детей | `DashboardScreen`, `LocalBoardScreen` | да |
| `/dev/capture-spike` | `features/dev/capture-spike.tsx` | только `import.meta.env.DEV`, в prod не попадает |

Общая рамка `routes/root-layout.tsx` (260 строк): `useAuth()`, сеттеры стора (`setUserId/setUserEmail/setUserPlan/
setEmailVerificationEnabled/setEmailVerified/setBillingActive`), `getBillingPublicConfig()`, `initConnectionState()`,
`AppSidebar`, `SidebarLabel`, `ThemeProvider`, `StyleDefaultsProvider`, `Toaster` (sonner, top-right, closeButton),
`OfflineOverlay`, `ConnectionIndicator`, `DesktopBrand`/`WindowControls`, `AuthGraphTexture`. Логаут: `clearTokens` →
`queryClient.clear()` → `setUserId('root')`/`setUserEmail('root@localhost')` → `/signin` (на десктопе `/`).
Не UI / не переводим: `features/board/{persist,sync,convert,model,providers,search}`, `features/applet/*` (рантайм
пользовательского JSX), `features/connection/*` (кроме `offline-overlay.tsx`), `lib/*`, `hooks/*`, `src/test/*`,
`components/icons/picker-set.ts` (275 имён иконок).

## 2. Сущности, где лежат строки (точные имена)

- Каркас: `components/sidebar/` — `app-sidebar.tsx` (454 стр.), `board.tsx` (462), `sidebar-label.tsx` (335), `board-tree-node.tsx`,
  `chat.tsx`, `chats-dialog.tsx`, `confirm-delete-board.tsx`, `home.tsx`, `label-editor.tsx`, `subscription.tsx`,
  `board-offline-action.tsx`. Тексты: "WORKSPACE"/"SYNCED"/"LOCAL"/"SHARED WITH ME"/"CHATS"/"View all chats",
  "Profile"/"Upgrade Plan"/"Logout"/"Install app", `alt="Dim0 Home"`, `v{__APP_VERSION__}`,
  `toast.error("Couldn't create a board. Please try again.")` ×2.
- Тема: `components/mode-toggle.tsx` (const `MODES` = Light/Dark/System; "Theme", "Mode", sr-only "Theme and mode",
  `aria-label="Toggle theme"`), `components/theme-constants.ts` (`THEMES` — 8: Parchment, Matcha, Noir, Catppuccin,
  Tokyo Night, Gruvbox, Monokai Pro, Rosé Pine; типы `Mode`, `ThemeMeta`).
- Настройки: `features/user-settings/screens/settings-screen.tsx` (83 стр.), `billing-screen.tsx` (**плотнейший файл, 42**:
  "Billing Plans", `FeatureRow`, "50 AI requests / day", "5 boards", "Up to N collaborators / board", "N documents / board").
- Auth/установка: `features/signin/screens/{sign-in,sign-up,forgot-password,reset-password,verify-email,google-callback}.tsx`,
  `components/{password-input,password-strength-meter,auth-graph-texture}.tsx`, `features/install/screens/install-screen.tsx` (24).
- Шаринг: `features/sharing/{share-dialog.tsx (17 строк, 9 тостов), share-button.tsx, api.ts, screens/share-landing.tsx}`.
- Лента: `features/newsfeed/screens/{subscriptions,newsfeeds,newsfeed-linear-page}.tsx`, `components/newsfeeds/*`
  (`info.tsx` — 19, `card`, `create-subscription-dialog`, `top-panel`, `grid`, `view`, `create-new`, `subscription-card`).
- Агент: `screens/chat-screen.tsx` (тонкий), `components/chat-view.tsx`, `components/chat/*` (`input`, `assistant-message`,
  `user-message`, `welcome-message`, `starter-prompts`, `tool-step-row`, `tool-confirm-dialog`, `reasoning-step(s)`,
  `sources-view`, `doc-sources-view`, `note-sources-view`, `memory-button`, `actions/save-as-note.tsx` — 19 тостов,
  `actions/copy-answer.tsx`, `input-settings/*`), `settings/settings-dialog.tsx` (24: `NAV` General/Model providers/
  Web search/Code interpreter/Documents; `SEARCH_ENGINES` Perplexity/Tavily/Linkup/Exa/Parallel (keyless);
  чипы "No key needed"/"Our keys"/"Your key"), `settings-button.tsx`, `byok/*`, `local/*`, `prompts/*`.
- Доска: `screens/{board-screen,dashboard-screen,boards-home}.tsx`, `local/{local-board-screen,local-dashboard}.tsx`,
  `components/{board-card,board-limit-dialog,board-view,breadcrumb/board-breadcrumb}`, `components/flow/*`
  (`code-area`, `copilot-sheet`, `widget-iframe`, `widget-document`, `floating-assistant/*`), `harness/canvas/harness-canvas.tsx`,
  `harness/chrome/*` (`toolbar.tsx` 33, `canvas-context-menu.tsx` 29 с 16 тостами, `viewport-controls`, `presentation-controls`,
  `slides-panel`, `style-panel/*`, `document-upload-dialog`, `empty-board-coachmarks`, `icon-search-dialog`,
  `image-search-dialog`, `toolbar-more`, `collab-status`, `readonly-chip`), `harness/node-types/*`,
  `const.ts` (`UNTITLED_LABEL = "Untitled"`), `lib/board-limit.ts` (`BOARD_LIMITS` 5/∞, `NODE_LIMITS` 3/10/25…).
- Прочее видимое: `features/widgets/components/*` + `utils/weather.ts`, `features/desktop/desktop-chrome.tsx`
  (Minimize/Maximize/Restore/Close), `features/connection/offline-overlay.tsx`, `features/mini-app/mount.tsx`,
  `components/ui/{dialog,sheet,sidebar}.tsx` (sr-only "Close"/"Toggle Sidebar"), `components/markdown/*`,
  `components/editor/tiptap/slash-command/commands.ts`, `components/editor/tiptap/status-bar.tsx`, `components/not-found.tsx`.
- Ошибки/тосты: обёртки нет — `sonner` вызывается напрямую в 28 файлах. Путь бэкенд-ошибки: `api.ts#readErrorMessage(res,
  fallback)` читает `{data:{message}}` → `throw new Error(...)` → auth-экраны рендерят inline, остальные — `toast.error`.
- Стор/сеть: `src/store.ts` (zustand `useAppStore`; дефолты `userId:"root"`, `userEmail:"root@localhost"`, `userPlan:"free"`),
  `src/query-client.ts`, `src/api.ts` (542 строки, 11 сообщений), `src/routes/index.ts`, `src/routes/root-layout.tsx`.

## 3. Инвентаризация по каталогам

Эвристика: JSX-текст + значения атрибутов (`placeholder/aria-label/aria-description/title/alt/label`) +
`toast.*`/`confirm`/`alert` + label-подобные литералы в `.ts`. Тесты исключены; числа в `.ts` — самая шумная часть.

| Каталог | файлов | jsx | attr | toast | .ts | итого |
|---|---|---|---|---|---|---|
| `features/board` | 66 | 109 | 165 | 43 | 24 | **341** |
| `features/agent` | 53 | 71 | 52 | 36 | 86 | **245** |
| `features/signin` | 7 | 56 | 6 | 1 | 2 | 65 |
| `components/sidebar` | 8 | 38 | 17 | 3 | 0 | 58 |
| `features/user-settings` | 2 | 26 | 23 | 0 | 0 | 49 |
| `features/newsfeed` | 11 | 16 | 29 | 1 | 1 | 47 |
| `components/editor` | 14 | 18 | 4 | 2 | 11 | 35 |
| `features/sharing` | 4 | 14 | 4 | 10 | 1 | 29 |
| `features/widgets` | 3 | 10 | 3 | 0 | 14 | 27 |
| `features/install` | 1 | 22 | 2 | 0 | 0 | 24 |
| `src/api.ts` | 1 | 0 | 0 | 0 | 11 | 11 |
| `features/dev` | 1 | 7 | 3 | 0 | 0 | 10 |
| `components/ui` | 5 | 6 | 4 | 0 | 0 | 10 |
| `components/animate-ui` | 4 | 10 | 0 | 0 | 0 | 10 |
| `features/{mini-app,applet}` | 4 | 7 | 3 | 4 | 0 | 14 |
| `components/charts` | 4 | 4 | 2 | 0 | 1 | 7 |
| мелкие (16 файлов: `components/{icons,markdown}`, `features/desktop`, `mode-toggle`, `theme-constants`, `fonts`, `features/connection`, `not-found`, `progress-bar`, `features/home`, `lib/{decode-jwt,shiki}`, `routes/index`) | 16 | ~25 | ~12 | 0 | ~5 | ~40 |

Топ-30 файлов (путь от `webui/src/`; `всего | jsx/attr/toast/.ts`):

| Файл | всего | разбивка | Файл | всего | разбивка |
|---|---|---|---|---|---|
| `features/user-settings/screens/billing-screen.tsx` | 42 | 19/23/0/0 | `.../chrome/viewport-controls.tsx` | 14 | 6/8/0/0 |
| `features/board/harness/chrome/toolbar.tsx` | 33 | 11/22/0/0 | `features/widgets/utils/weather.ts` | 14 | 0/0/0/14 |
| `.../chrome/canvas-context-menu.tsx` | 29 | 12/1/16/0 | `.../node-surface-host/code-sandbox-panel.tsx` | 13 | 6/7/0/0 |
| `features/agent/types/stream.ts` | 28 | 0/0/0/28 | `.../node-surface-host/applet-panel.tsx` | 12 | 6/6/0/0 |
| `features/agent/settings/settings-dialog.tsx` | 24 | 11/13/0/0 | `.../node-surface-host/mini-app-panel.tsx` | 12 | 5/7/0/0 |
| `features/install/screens/install-screen.tsx` | 24 | 22/2/0/0 | `src/api.ts` | 11 | 0/0/0/11 |
| `features/agent/components/chat/actions/save-as-note.tsx` | 23 | 4/0/19/0 | `features/agent/components/chat/input.tsx` | 11 | 8/1/2/0 |
| `components/sidebar/app-sidebar.tsx` | 22 | 12/7/3/0 | `features/agent/components/chat-view.tsx` | 11 | 7/3/1/0 |
| `features/agent/engine/tools.ts` | 20 | 0/0/0/20 | `features/agent/local/use-local-doc-upload.tsx` | 11 | 3/0/8/0 |
| `features/signin/screens/sign-in.tsx` | 20 | 18/2/0/0 | `.../chrome/presentation-controls.tsx` | 11 | 0/11/0/0 |
| `features/newsfeed/components/newsfeeds/info.tsx` | 19 | 1/18/0/0 | `features/signin/screens/reset-password.tsx` | 11 | 10/0/1/0 |
| `components/sidebar/board.tsx` | 18 | 13/5/0/0 | `.../floating-assistant/floating-island.tsx` | 10 | 2/7/1/0 |
| `.../chrome/style-panel/panel.tsx` | 18 | 5/13/0/0 | `.../chrome/document-upload-dialog.tsx` | 10 | 3/0/7/0 |
| `features/sharing/share-dialog.tsx` | 17 | 6/2/9/0 | `features/widgets/components/trading-widget.tsx` | 10 | 10/0/0/0 |
| `features/signin/screens/sign-up.tsx` | 15 | 12/3/0/0 | `.../chrome/sheet-panel.tsx` | 10 | 3/7/0/0 |

Далее (9–8 строк): `agent/components/chat/tool-step-row.tsx`, `board/components/flow/copilot-sheet.tsx`, `.../chrome/toolbar-more.tsx`,
`.../shared-views/node-traffic-lights.tsx`, `board/hooks/use-ai-spark-actions.tsx` (9 тостов), `signin/screens/forgot-password.tsx`,
`.../chrome/slides-panel.tsx`, `board/local/local-dashboard.tsx`.

## 4. Строки, живущие в `.ts` (не `.tsx`)

- `features/agent/engine/tools.ts` — 20 описаний LLM-инструментов. **Промпты, не переводим**, но текст виден в UI через tool-call карточки.
- `features/agent/types/stream.ts` — `ToolNameDescription`: 26 подписей ("Reformulate answer", "Search the web",
  "Search memory", "Interpret code", "Write note", "Create note", "Edit note", "Read note", "Link notes", "Arrange notes",
  "Open folder", "Create folder", "Generate outline", "Collect web content", "Synthesize response", "Reasoning",
  "Describe image", "Illustrate topic", "Learn widget and visual explainer skill"…). Плюс `ToolNameIcon`. Ключи Record
  переводить нельзя — только значения.
- `features/agent/types/services.ts` — `AUTO_LLM_OPTION` (label "Auto"), каталог провайдеров/моделей (торговые имена — нет).
- `features/agent/prompts/` — `plan-system.md` (144), `describe-board.md`, `skills/{applet.md 385, diagram.md 101,
  html-widget.md 203}`, `index.ts`, `render.ts` (`planSystemPrompt(now)`, `{{ time }}`). **Вне перевода** (LLM).
- `features/board/lib/board-limit.ts` (лимиты планов — числа подставляются в `billing-screen`), `const.ts`
  (`UNTITLED_LABEL = "Untitled"` — дефолтное имя доски, видно в UI).
- `features/board/harness/agent/{agent-event-to-step.ts ("Arranged N notes"), describe-board.ts}`.
- `features/widgets/utils/weather.ts` — WMO-коды ("Clear sky", "Partly cloudy"…) + ошибки API.
- `components/editor/tiptap/slash-command/commands.ts` — `SLASH_COMMANDS` (Text, Heading 1/2/3, Quote, Code block, Math,
  Table, Divider, Image, TOC, Subpage; `keywords` для поиска тоже нужны переводы).
- `components/charts/{chart-translate.ts,map-geo.ts}` — подписи графиков и названия стран; `features/applet/compile/dry-eval.ts`
  — тексты `SmokeFail` (`<Chart> needs a \`type\` — one of …`), видны автору апплета.
- `src/api.ts` — 11 fallback-сообщений auth и `Unauthorized`; `src/config/api.ts` — URL (не переводим).
- `features/mini-app/{validate.ts,dispatch.ts}` — протокол (не переводим) + `toastInfo/toastError` (текст из iframe,
  т.е. произвольный пользовательский — только пробрасываем).

## 5. @canvas-harness (npm, `^0.2.0`)

Пакеты: `@canvas-harness/{core,react,sync-broadcast}` 0.2.0 (`package-lock`). `harness/canvas/harness-canvas.tsx`
передаёт в `<Canvas>` только `tool, theme={theme.resolver}, selectionColor, background, maxDpr={isTauri()?1.5:undefined},
renderCustomNodeView, editorAdapter, arrowDefaults, inkDefaults, onCreateDrag, onDoubleClick, onRenderer`; в `CanvasProvider` —
только `store`; в `Minimap` — `width/height/colors/style`. **Никаких** `labels/texts/locale/menu/messages` нет. Есть ли они
в API библиотеки — **проверить нельзя**: `node_modules` отсутствует; если есть, точка подключения одна — `harness-canvas.tsx`.

## 6. Тесты и CI

- `src/test/setup.ts` — **весь файл**: `import "fake-indexeddb/auto"` + doc-комментарий. Больше ничего.
- `vitest.config.ts`: alias `@` → `./src`, `jsdom`, `setupFiles: ["./src/test/setup.ts"]`, include
  `src/**/*.{test,spec}.{ts,tsx}` + `mini-app-runtime/**`, coverage v8 → `./coverage`.
- Тестов: **152** `*.test.ts`, **16** `*.test.tsx`. Query по тексту/роли — только `features/applet/render/render.test.tsx`.
- `playwright.config.ts`: `testDir ./e2e`, timeout 30s, `baseURL http://localhost:4321`, headless,
  `webServer { command: "APP_PORT=4321 npm run dev", reuseExistingServer: true, timeout: 120_000 }`.
- e2e — 4 файла: `local.spec.ts` (131), `parallel-search.spec.ts` (81), `theme.spec.ts` (46), `offline.spec.ts` (24).
  Текстовые селекторы (26) — главный риск: `getByRole("list",{name:"On this device"})`, `getByText("New Board")`,
  heading `"On this device"`, `getByText("Untitled board")`, buttons `"Agent settings"`/`"Model providers"`/`"Save"`,
  `getByPlaceholder(/sk-/)`, `getByPlaceholder(/Ask about this board/)`, `getByText("Note created.")`, heading `"Local boards"`,
  `button /^Web search/`, `"Parallel (keyless)"`, `getByText(/No search API key and no sign-in needed/)`,
  `getByRole("switch",{name:"Always allow web search", exact:true})`, `getByText("Found asyncio documentation.")`.
- CI `.github/workflows/tests.yml`: `webui` — `npm ci`, `make lint-ui`, `make test-ui-cov`, codecov; `e2e` —
  `npx playwright install --with-deps chromium`, `cp .env.sample .env`, `npm run e2e`; `backend` — `uv sync`/ruff/pytest;
  `tauri` — `make test-tauri`. Хуков/проверок i18n нет, husky в проекте нет.

## 7. Сборка и окружение

`npm run build` = `dotenv -e ../${npm_config_envfile:-.env} -- vite build --config vite.mini-app.config.ts`
`&& dotenv -e ../.env -- tsc -b && dotenv -e ../.env -- vite build`. То есть **файл `../.env` обязателен**
(иначе dotenv-cli падает), но **живой бэкенд для сборки не нужен**: `VITE_API_URL` лишь запекается в бандл,
а в Docker адрес подставляется в рантайме через `window.__APP_CONFIG__` (`webui/config.template.js` →
`apiBase/billingEnabled/miniAppOrigin/hostOrigin`; `docker-entrypoint.sh` подставляет env через `sed` в `dist/config.js`).
`vite.config.ts`: `define __APP_VERSION__` из `package.json`, build-time сканирование имён иконок из `picker-set.ts`,
PWA-плагин, порт `Number(process.env.APP_PORT)||5173`, `ANALYZE=true` → visualizer.
Env (`.env.sample`): `API_PORT=8081, APP_PORT=5175, MINI_APP_PORT=5176, API_ORIGIN, VITE_API_URL, VITE_HOST_ORIGIN,
VITE_MINI_APP_ORIGIN`, ключи моделей (OPENAI/GEMINI/ANTHROPIC/MISTRAL/OPENROUTER), `DAYTONA_*`, поисковые ключи,
POSTGRES/QDRANT/REDIS, `JWT_SECRET_KEY`, `RESEND_*`, `APP_BASE_URL`, `EMAIL_VERIFICATION_ENABLED`,
`PASSWORD_RESET_ENABLED`, `GOOGLE_*`. `VITE_BILLING_ENABLED` в sample нет, но он используется в `config.template.js`.
`index.html`: `<html lang="en" data-theme="parchment" data-mode="light">`, `<title>Dim0</title>`, до `main.tsx` грузятся
`/config.js` и скрипт темы (`localStorage`: `topix-ui-theme`, `vite-ui-theme`). `mini-app-runtime/index.html`: `lang="en"`,
title "Mini-app runtime".

## 8. Конвенции

`webui/AGENTS.md`: только TS; **без точек с запятой**; компоненты — **именованный экспорт** (не `export default`);
**без `any`**; **2 пустые строки** между top-level декларациями, 1 внутри блоков; прогон `npm run check-all`.
Контекст оттуда же: два рантайма агента (новый `features/agent/engine/` и легаси `features/agent/api/send-message.ts`,
выводится в G5); доска = mount `harness`; `_storedColors` — источник истины цветов; «не авторизован» = `userId === "root"`
(проверка через `isSignedIn()`).
`eslint.config.js`: ignores `dist`, `src-tauri/target`; для `**/*.{ts,tsx}` — `js.configs.recommended` +
`tseslint.configs.recommended` + react-hooks (`recommended-latest`) + react-refresh (vite); `ecmaVersion: 2020`;
браузерные глобалы; для `src/features/agent/**`, `board/local/**`, `board/persist/local/**`, `board/harness/agent/**`,
`mini-app/**` — type-checked блок (`no-unsafe-*` выкл., `require-await` выкл., `no-misused-promises.checksVoidReturn.attributes: false`).
Правила против «магических строк» нет; `i18next`-плагин по решению пользователя не включаем.

## 9. Риски извлечения (конкретика)

- Шаблоны/конкатенации: `editor/tiptap/status-bar.tsx` — `{words} words · {characters} chars`;
  `widgets/components/image-card.tsx` — `title={\`View ${hiddenCount} more\`}`; `applet/render/renderer.tsx` — `… ${n} more`;
  `agent/local/use-local-doc-upload.tsx` — `${chunks} passages ready to ask about.`; `agent/components/chat/input.tsx` —
  `Try again in ${retryAfter}s.` / `${minutes} min.`; `.../chrome/document-upload-dialog.tsx` — `(${nodeLimitFor("document", userPlan)})`;
  `link-preview` — `+${extraCount}`; `actions/save-as-note.tsx` — `(${finalElapsed})`, `Rewriting… ${formatElapsed()}`;
  `canvas-context-menu.tsx` — `Rendering applets… ${done}/${total}`; `code-sandbox-panel.tsx` — `Last run • ${durationMs} ms`;
  `steps-popover-row.tsx` — `${k} · ${value}`; `board-breadcrumb.tsx` — `title={\`${leafDisplay} — click to rename\`}`;
  `board-tree-node.tsx` — `aria-label={expanded ? \`Collapse ${item.kind}\` : \`Expand ${item.kind}\`}`;
  `sidebar/board.tsx` — `title={\`Chats — ${boardDisplayLabel}\`}`; `input-settings/web-search` — `Web search ({engine})`.
  Всё это → интерполяция `{{count}}` + CLDR-плюрализация (`1/2/5/1.5` → one/few/many/other).
- Счётчиков реально **больше восьми** (весь список выше); отдельно лимиты в `billing-screen.tsx` ("5 boards", "Up to N
  collaborators / board") — это не счётчики, а текст лимита из `lib/board-limit.ts`.
- Атрибуты с выражениями: `aria-label`, `title`, `alt`, `placeholder` — большинство статические, но перечисленные выше —
  шаблоны и тернарники; `aria-*` и `title` извлекать **обязательно** (их читают e2e). `dangerouslySetInnerHTML`:
  `components/illustrations/install-phone-illustration.tsx:123`, `components/markdown/lite-markdown.tsx:308,318`,
  `board/harness/node-types/code-sandbox/view.tsx:95` (первые два — текст/SVG-иллюстрация, третий — подсветка кода).
- Локали/даты/числа — 23 места, везде локаль `undefined` (→ язык браузера): `widgets/utils/weather.ts:84,93`,
  `weather-widget.tsx:94,99,111`, `trading-widget.tsx:19,34-39,56-57`, `settings-screen.tsx:35`, `billing-screen.tsx:213,229`,
  `sidebar/chats-dialog.tsx:26` (`Intl.DateTimeFormat`), `newsfeeds/card.tsx:79`, `agent/components/chat-view.tsx:42`,
  `chat/user-message.tsx:21`, `board/utils/datetime.ts:20`, `board/utils/date.ts:44`, `.../sheet/view.tsx:43`,
  `shared-views/node-footer.tsx:69`, `agent/local/use-local-submit-prompt.ts:318` — здесь локальная дата **вставляется в промпт**,
  менять её нельзя (вход LLM).
- Прочее: подписи внутри const-массивов (`THEMES`, `SLASH_COMMANDS`, `MODES`, `SEARCH_ENGINES`) — `t()` там недоступен
  без переноса в рендер (конфликтует с «меняем только литералы»); `empty-board-coachmarks.tsx` содержит `"name your\ncanvas"`
  — переносы строк внутри литерала; `ToolNameDescription` — Record, переводим только значения.

## Что осталось неизвестным

1. API `@canvas-harness`: есть ли пропсы/конфиг для подписей, `locale`, контекстного меню. `node_modules` нет, типы не
   прочитать; известно лишь, что `webui` ничего такого не передаёт.
2. Точное число строк: 1013 — нижняя эвристика; многострочный JSX, литералы в выражениях и const-массивы подписей в `.tsx` учтены не полностью (реалистично 1100–1200).
3. Бэкенд-тексты: 74 `detail="…"` в `backend/topix`, письма (Resend), серверные LLM-промпты — не инвентаризированы (вне области), но именно они всплывут в UI как английские.
4. Пользовательский контент (`toastInfo/toastError` из mini-app iframe, ответы модели, названия узлов, тексты апплетов) — переводить нечего, но это надо явно зафиксировать в «намеренно не переведено».
5. Локаль для `Intl`/`toLocaleString`: решения в репозитории нет (везде `undefined`); как привязать к `dim0.lang` — не определено.
6. `src-tauri`: HTML-страницы OAuth (`src-tauri/src/oauth-{success,error}.html` из `scripts/gen-oauth-pages.py`, текст английский) и меню/`tauri.conf.json` (productName/description) — не инвентаризированы.
7. PWA-манифест и метаданные (`vite-plugin-pwa`), `index.html` `lang`/meta description — не собраны.
8. Ни `npm install`, ни `build`, ни `type-check`, ни `e2e` не запускались: вывод «сборка работает без живого бэкенда» — по чтению конфигов, не по факту прогона.
