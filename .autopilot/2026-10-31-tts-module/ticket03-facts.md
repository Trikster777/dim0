# Факты для тикета 03 — материал для `TTS.md`

Всё, что ниже, — **живые факты, проверенные на машине 31.10.2026**. Документ `TTS.md`
описывает **собранный** модуль: каждая команда и каждый путь в нём проверяемы по репозиторию.
Если что-то не сходится с кодом — это дефект тикета 01 или 02, а не повод выдумать правду.

## Образ и модель

- Образ: **`navatusein/silero-tts-service:latest`** — живой `docker pull` 31.10.2026: **3,73 ГБ**,
  индекс `sha256:53f53add…`, мультиарх **amd64 + arm64** (нужно под MacBook arm64).
- Модель: **`v5_6_ru`** (`TTS_MODEL_URL=https://models.silero.ai/models/tts/ru/v5_6_ru.pt`,
  147 664 410 Б, Last-Modified 2026-10-15). В образе модели нет — она скачивается при первом
  старте контейнера в volume `silero_models` (147 МБ, ~50 с).
- Внутренний порт сервиса: **9898**. Наружу **не публикуется** — только внутри сети compose.
- Пять спикеров модели: `aidar`, `baya`, `kseniya`, `xenia`, `eugene`. `GET /voices` отдаёт их
  пятью строками plain text, без завершающего перевода строки.
- Потребление памяти контейнера: **700–900 МБ RSS** (197 МБ torch, 430 МБ после загрузки модели).
  На VPS с 512 МБ модуль не влезет — это ограничение эксплуатации.

## Переменные окружения (`.env.sample`, строки 90–101)

| Переменная | По умолчанию | Смысл |
|---|---|---|
| `TTS_ENABLED` | `false` | Модуль выключен → `POST /tts` и `GET /tts/voices` отвечают **503** |
| `TTS_SERVICE_URL` | `http://silero-tts:9898` | Адрес сервиса внутри сети compose |
| `TTS_VOICE` | `xenia` | Голос по умолчанию, когда клиент не прислал `voice` |
| `TTS_FORMAT` | `wav` | Формат ответа: WAV, 48 кГц, моно, 16 бит |
| `TTS_STREAMING` | `false` | Стриминга в v1 нет — `StreamingResponse` не используется |
| `TTS_MODEL_URL` | `https://models.silero.ai/models/tts/ru/v5_6_ru.pt` | Ссылка на модель; откат — одна строка env |

## Переменные сервиса (compose, `build/docker-compose.yml`)

`LANGUAGE=ru`, `SAMPLE_RATE=48000`, `NUMBER_OF_THREADS=4`,
`SILERO_SETTINGS={"ru":{"model_link":"${TTS_MODEL_URL:-…}","speakers":[aidar,baya,kseniya,xenia,eugene]}}`.
Сервис `silero-tts` объявлен с `profiles: ["local","dev","test","staging","prod"]`, volumes
`silero_models:/usr/app/models` и `silero_audios:/usr/app/audios`, healthcheck — `python -c
"import urllib.request; urllib.request.urlopen('http://localhost:9898/').read()"` (интервал 10 с,
`start_period` 60 с под скачивание модели).

## Контракт сервиса (проверен на живом контейнере)

- `POST /process` — тело **form-urlencoded**: `voice=<спикер>&input_text=<текст>` → `audio/wav`.
  Имена полей регистронезависимы, `text` тоже принимается. Сервис **сам** оборачивает текст в
  `<speak>` — шлём чистый текст, без SSML.
- `GET /voices` → plain text, голос по строке.
- `GET /` → `{"status":"work"}` (healthcheck).

## Подготовка текста в бэкенде — порядок обязателен

1. **Транслитерация латиницы в кириллицу** своей полной таблицей на 52 буквы.
2. **Экранирование** `&`, `<`, `>` → **по-символьный CDATA**: `<![CDATA[&]]>`,
   `<![CDATA[<]]>`, `<![CDATA[>]]>`.

Наоборот нельзя: своя транслитерация испортит собственный маркер (`CDATA` → `ЦДАТА`) → 400.
Named- и numeric-сущности использовать нельзя — нормализатор сервиса их разрушает
(`&amp;` → `&амп;`, `&#38;` → `&#тридцать восемь;`).

Живая проверка на контейнере: сырой `&`, `<`, `>` → 400 «Invalid XML format»; `&amp;`, `&#38]` →
400; по-символьный CDATA → 200 + WAV с настоящим звуком (peak > 17000).

## Чанкер и формат звука

- Границы реза только по `.` `!` `?` `…` и пустой строке. По запятым, словам и символам — **нельзя**.
- Сокращения не рвутся: `т.е.`, `и т.д.`, `т.п.`, `т.к.`, `др.`, `см.`, `стр.`, `напр.`, `руб.`,
  `тыс.`, `млн.`, `г.`, `гг.`, `вв.` — все точки внутри известного сокращения защищены.
- Предложения короче 50 символов склеиваются; чанк — не длиннее **250** символов.
- **≤2 чанка** → один запрос к сервису. **≥3** → по запросу на чанк, куски PCM склеиваются в
  один WAV. Любой упавший чанк → **502 целиком, частичного файла нет**.
- Каждый чанк, уходящий в сервис, содержит **целые CDATA-секции** — маркер не рвётся границей.
- Ответ: WAV, 48 кГц, моно, 16 бит, RIFF-заголовок.

## Бэкенд-эндпоинты (`backend/topix/api/router/tts.py`)

- `POST /tts` — тело `{text, voice?}`. 400 — пустой текст, 413 — длиннее 50 000 символов,
  502 — сервис недоступен или упал, 503 — модуль выключен. Ответ — `audio/wav`.
- `GET /tts/voices` — `{"voices": [...]}`; кэш ~300 с; сервис недоступен или список пуст → 503.
- Роутер подключён в `backend/topix/api/app.py` (одна строка). Роутеры живут **в корне**, без
  префикса `/api`.
- Таймаут вызова сервиса — **15 с** на чанк.

## Фронтенд (`webui/src/features/agent/components/chat/actions/speak-answer.tsx`)

- Кнопка «Озвучить» у **каждого** ответа агента в ленте (у сообщений пользователя — нет).
  Текст для озвучки — **тот же**, что копирует «Скопировать».
- Состояния кнопки: покой / синтез / играет (иконка стоп) / ошибка (локализованная подсказка).
- 503 → один тост `t('tts.disabled')`, кнопка остаётся видимой и уходит в неактивное состояние
  **до перезагрузки страницы** — дальше запросов не уходит.
- Список голосов приходит с бэкенда (`GET /tts/voices`) и грузится **лениво** — при первом
  раскрытии, не при монтировании; дальше из кэша. Имён голосов во фронте нет.
- Выбранный голос — в `localStorage` под ключом **`dim0.tts.voice`**, флаг автоозвучки — под
  **`dim0.tts.autoSpeak`**. Пока голос не выбран, он не отправляется.
- Отмена: клик «стоп» и новое сообщение пользователя → `AbortController`, звук останавливается,
  `URL.revokeObjectURL` вызывается.

## Ключи локализации — **одиннадцать** `tts.*` (en и ru)

`play`, `stop`, `loading`, `error`, `disabled`, `too_long`, `unavailable`, `empty`, `voice`,
`voicesUnavailable`, `autoSpeak`.

Соответствие кодам ответа: 400 → `tts.empty`, 413 → `tts.too_long`, 502 → `tts.unavailable`,
503 → `tts.disabled`. Сырой английский `detail` бэкенда в интерфейс не попадает.

## Файлы ветки `feature/tts-module` (от базы `dc508e1e`)

**Новые:**
- `backend/topix/utils/tts.py` — утилиты: транслитерация, экранирование, чанкер, склейка WAV
- `backend/topix/api/router/tts.py` — роутер `/tts` и `/tts/voices`
- `backend/test/unit/utils/test_tts_utils.py`
- `backend/test/unit/api/router/test_tts_router.py`
- `webui/src/features/agent/components/chat/actions/speak-answer.tsx`
- `webui/src/features/agent/components/chat/actions/__tests__/speak-answer.test.tsx`
- `webui/src/api.test.ts`
- `webui/src/components/icons/registry.test.tsx`

**Изменённые:**
- `backend/topix/api/app.py` — одна строка подключения роутера
- `webui/src/api.ts` — `responseType: "blob" | "json"`, класс `ApiRequestError` со `status` и `endpoint`
- `webui/src/lib/i18n/errors.ts` — карта кодов `/tts`
- `webui/src/lib/i18n/errors.test.ts`
- `webui/src/components/icons/registry.ts`, `webui/src/components/icons/index.ts` — иконка динамика
- `webui/src/features/agent/components/chat/actions/response-actions.tsx` — подключение кнопки
- `webui/src/locales/en.json`, `webui/src/locales/ru.json` — 11 ключей `tts.*`
- `build/docker-compose.yml` — сервис `silero-tts`, профили, volumes, healthcheck
- `.env.sample` — 6 переменных `TTS_*`
- `.autopilot/**` — служебная запись прогона

## Результаты проверок — строго три категории

### Проверено вживью (на этой машине, 31.10.2026)

- `docker pull navatusein/silero-tts-service:latest` — 3,73 ГБ, `sha256:53f53add…`, amd64 + arm64.
- Контейнер поднялся, модель скачалась (147 МБ), healthcheck `healthy`.
- `GET /` → `{"status":"work"}`; `GET /voices` → 5 голосов; `POST /process` → WAV,
  RIFF/WAVE, 48 кГц, моно, 16 бит (99 000 кадров = 2,06 с, peak 25 577).
- `docker compose --profile local up -d silero-tts` → сервис `healthy`, имя `silero-tts:9898`
  резолвится внутри сети compose, наружу порт **не** публикуется.
- Экранирование: сырые `&` `<` `>` → 400; `&amp;` / `&#38;` → 400; по-символьный CDATA → 200 + WAV.
- Латиница: `workflow`, `PowerShell`, `XML`, `API`, `JSON`, `R&D`, `Q&A` → **200 + WAV**
  (без собственной транслитерации — те же кейсы дают 400).
- Сквозной `POST /tts` через **наш** бэкенд (`127.0.0.1:9899`) с текстом из 15 чанков и 58
  CDATA-маркеров: после ремонта — 200, WAV 48 кГц/моно/16 бит, 12 488 444 Б (до ремонта — 502).
- `GET /tts/voices` через наш бэкенд → 5 голосов.

### Проверено статически

- Backend: `ruff` — чисто; `pytest` — **840 passed / 0 failed**.
- Frontend: `npm run check-all` (`tsc --noEmit` + `eslint`) — чисто.
- `npm run i18n:check` — **en=1222 / ru=1222, OK**.
- `npx vitest run` — **172 файла / 1743 теста**, все зелёные (база была 169 / 1722).
- `npx playwright test e2e/i18n-ru.spec.ts` — **1 passed**.

### Не проверено — ждёт машину владельца

- **Звук в колонках**: ни один WAV не прозвучал — на этой машине нет аудиоустройства.
- **Клик по кнопке в живом чате**: нужен ответ агента, а он требует LLM-провайдера
  владельца. Проверен компонент и его тесты, но не путь «живой чат → звук».
- **Полный `docker compose --profile local up -d` целиком** (весь стек, а не только
  `silero-tts`): не поднимался.
- **Playwright на Windows**: `webServer.command` в `playwright.config.ts` задан как
  `APP_PORT=4321 npm run dev` — POSIX-префикс, который `cmd.exe` не понимает. Сервер был
  поднят вручную в Git Bash с `APP_PORT=4321`. Это **проблема платформы, а не модуля**;
  на Linux/macOS команда работает как есть.

## Чего в v1 нет

- Стриминга (`TTS_STREAMING=false`, `StreamingResponse` не используется).
- SSML — текст шлётся чистым, сервис сам оборачивает в `<speak>`.
- Клонирования голоса — только пять спикеров модели.
- Отдельной страницы настроек TTS — настройки живут рядом с ответом агента.
- Голосов сверх пяти спикеров модели.

## Адрес PR

Форк **`Trikster777/dim0`**, ветка **`feature/tts-module`** → **`main`**, **без мерджа**.
Сам PR открывает оркестратор после приёмки.

## Места, где ожидаются конфликты при обновлении форка из upstream

`.env.sample`, `build/docker-compose.yml`, `backend/topix/api/app.py` (одна строка),
`backend/topix/api/router/tts.py`, `backend/topix/utils/tts.py`, роутер и утилиты TTS,
компонент сообщения агента (`speak-answer.tsx` + `response-actions.tsx`), `webui/src/api.ts`,
`webui/src/lib/i18n/errors.ts`, реестр иконок, словари локализации, `TTS.md`.

## Ручной чек-лист — ровно шесть пунктов

Пункты сформулированы так, чтобы их можно было пройти по шагам и зафиксировать
«прошло / не прошло»:

1. `docker compose --profile local up -d` поднимает `silero-tts` и `dim0`; `silero-tts` стал
   `healthy`.
2. Кнопка «Озвучить» появляется у сообщения агента (и **не** появляется у сообщения пользователя).
3. Клик по кнопке — слышен русский голос.
4. Клик «стоп» (второй клик) останавливает звук.
5. При `TTS_ENABLED=false` — локализованная ошибка вместо звука.
6. Смена голоса в выпадающем списке работает: следующий ответ звучит другим голосом.
