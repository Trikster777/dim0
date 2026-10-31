window.STATE =
{
  "version": 2,
  "slug": "tts-module",
  "dir": "2026-10-31-tts-module--wip",
  "title": "Модуль Silero TTS в форке dim0",
  "mode": "interview",
  "depth": "normal",
  "tier": null,
  "briefFile": "2026-10-31-brief.md",
  "memoryFile": "AGENTS.md",
  "memoryOwner": "user",
  "skillDir": "C:/Users/Андрей/.qoder/skills/autopilot",
  "baseCommit": "dc508e1e",
  "startedAt": "2026-10-31T13:34:32+03:00",
  "updatedAt": "2026-10-31T17:11:06+03:00",
  "finishedAt": null,
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-31T13:34:32+03:00",
      "finishedAt": "2026-10-31T13:37:12+03:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-31T13:37:12+03:00",
      "finishedAt": "2026-10-31T13:37:37+03:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-10-31T13:37:37+03:00",
      "finishedAt": "2026-10-31T15:30:24+03:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-31T15:30:24+03:00",
      "finishedAt": "2026-10-31T16:48:46+03:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-31T17:11:06+03:00",
      "finishedAt": "2026-10-31T17:11:06+03:00"
    },
    {
      "id": "build",
      "status": "active",
      "startedAt": "2026-10-31T17:11:06+03:00"
    },
    {
      "id": "review",
      "status": "pending"
    },
    {
      "id": "final",
      "status": "pending"
    }
  ],
  "requirements": {
    "total": 97,
    "done": 0,
    "inTicket": 93,
    "inSpec": 0,
    "placeholder": 0,
    "deferred": 4,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Проксирующий бэкенд и контейнер silero-tts",
      "requirements": [
        "R02",
        "R03",
        "R04",
        "R05",
        "R07",
        "R08",
        "R09",
        "R10",
        "R11",
        "R12",
        "R13",
        "R14",
        "R15",
        "R16",
        "R17",
        "R18",
        "R19",
        "R20",
        "R21",
        "R22",
        "R23",
        "R24",
        "R25",
        "R26",
        "R26.1",
        "R27",
        "R28",
        "R28.1",
        "R29",
        "R29.1",
        "R30",
        "R32",
        "R34",
        "R35",
        "R36",
        "R37",
        "R38",
        "R39",
        "R40",
        "R41",
        "R41.1",
        "R54",
        "R55",
        "R55.1",
        "R55.2",
        "R70",
        "R71",
        "R78i",
        "R79i",
        "R81",
        "R82",
        "R83",
        "R84",
        "R84.1",
        "R85",
        "R86",
        "R87",
        "R88",
        "R90",
        "R91",
        "R91.1",
        "R91.2",
        "R91.4",
        "R93",
        "R94",
        "R95",
        "R96",
        "R97",
        "R97.1",
        "D01",
        "D02",
        "D03",
        "D04",
        "D05",
        "A01",
        "A02"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "backend/topix/api/",
        "backend/topix/utils/",
        "backend/test/",
        "build/",
        ".env.sample"
      ],
      "review": "да — фундамент",
      "model": "сильная",
      "status": "in-progress",
      "retries": 0,
      "repairs": 0,
      "startedAt": "2026-10-31T17:11:06+03:00"
    },
    {
      "id": "02",
      "title": "Кнопка озвучки, выбор голоса и автоозвучка в интерфейсе",
      "requirements": [
        "R01",
        "R01.1",
        "R01.2",
        "R01.4",
        "R01.5",
        "R06",
        "R33",
        "R44",
        "R44.1",
        "R45",
        "R45.1",
        "R46",
        "R47",
        "R48",
        "R48.1",
        "R50",
        "R51",
        "R52",
        "R53",
        "R53.1",
        "R53.2",
        "R53.3",
        "R53.4",
        "R53.5",
        "R53.6",
        "R56",
        "R57",
        "R58",
        "R59",
        "R67",
        "R68",
        "R69",
        "R80i",
        "R89",
        "R91.3",
        "R92",
        "R92.1",
        "A03"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "webui/src/"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    },
    {
      "id": "03",
      "title": "Документация TTS.md и чек-лист ручной проверки",
      "requirements": [
        "R60",
        "R61",
        "R62",
        "R63",
        "R64",
        "R65",
        "R66",
        "R72",
        "R73",
        "R74",
        "R75",
        "R76",
        "R77"
      ],
      "blockedBy": [
        "01",
        "02"
      ],
      "wave": 3,
      "zone": [
        "TTS.md"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "pending",
      "retries": 0,
      "repairs": 0
    }
  ],
  "tests": null,
  "debt": {
    "placeholders": [],
    "assumptions": [],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 14,
    "fixed": 14,
    "deferred": 0,
    "items": [
      "A01 → R78i (авторизация POST /tts) — оставлено: A## с родителем, глубина normal",
      "A02 → R79i (синтез длинного ответа целиком + склейка WAV) — оставлено: A## с родителем",
      "R28.1 (400 для текста без букв и цифр) — оставлено: углубление R28, не новая возможность",
      "Ключи локализации сверх брифа (too_long, unavailable, empty, voice, voicesUnavailable) — оставлено: R74 требует перечень, сведён к десяти",
      "R26.1 (эндпоинт не оборачивается в @with_standard_response) — оставлено: углубление R26",
      "R93.2 (v5_1_ru латиницу умеет) — оставлено: проверенный факт живой проверки владельца"
    ]
  },
  "concerns": [],
  "blind": null,
  "beats": [
    "2026-10-31T13:34:32+03:00",
    "2026-10-31T13:37:10+03:00",
    "2026-10-31T13:37:12+03:00",
    "2026-10-31T13:37:37+03:00",
    "2026-10-31T13:58:55+03:00",
    "2026-10-31T15:21:58+03:00",
    "2026-10-31T15:30:24+03:00",
    "2026-10-31T16:40:44+03:00",
    "2026-10-31T16:48:32+03:00",
    "2026-10-31T16:48:46+03:00",
    "2026-10-31T16:49:27+03:00",
    "2026-10-31T16:59:25+03:00",
    "2026-10-31T16:59:34+03:00",
    "2026-10-31T16:59:50+03:00",
    "2026-10-31T16:59:51+03:00",
    "2026-10-31T17:01:31+03:00",
    "2026-10-31T17:03:59+03:00",
    "2026-10-31T17:04:01+03:00",
    "2026-10-31T17:10:12+03:00",
    "2026-10-31T17:10:13+03:00",
    "2026-10-31T17:11:06+03:00"
  ],
  "rev": 27,
  "waiting": null,
  "waits": [
    {
      "kind": "briefing",
      "from": "2026-10-31T13:58:55+03:00",
      "to": "2026-10-31T15:21:58+03:00"
    }
  ],
  "log": [
    {
      "t": "2026-10-31T13:34:32+03:00",
      "k": "init"
    },
    {
      "t": "2026-10-31T13:37:12+03:00",
      "k": "stage",
      "id": "manifest",
      "act": "start"
    },
    {
      "t": "2026-10-31T13:37:37+03:00",
      "k": "stage",
      "id": "briefing",
      "act": "start"
    },
    {
      "t": "2026-10-31T13:58:55+03:00",
      "k": "ask",
      "kind": "briefing",
      "note": "раунд 1: образ Silero, кнопка при выключенном модуле, стриминг в v1, баги прошлой сборки"
    },
    {
      "t": "2026-10-31T15:21:58+03:00",
      "k": "answered",
      "kind": "briefing"
    },
    {
      "t": "2026-10-31T15:30:24+03:00",
      "k": "gate",
      "g": "G1",
      "ok": false,
      "open": 85,
      "total": 90
    },
    {
      "t": "2026-10-31T15:30:24+03:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-10-31T16:40:44+03:00",
      "k": "gate",
      "g": "G1",
      "ok": true,
      "open": 0,
      "total": 97
    },
    {
      "t": "2026-10-31T16:40:44+03:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-10-31T16:48:32+03:00",
      "k": "gate",
      "g": "G2",
      "ok": false,
      "found": 14,
      "fixed": 8,
      "deferred": 0
    },
    {
      "t": "2026-10-31T16:48:46+03:00",
      "k": "gate",
      "g": "G1",
      "ok": true,
      "open": 0,
      "total": 97
    },
    {
      "t": "2026-10-31T16:48:46+03:00",
      "k": "stage",
      "id": "spec",
      "act": "done"
    },
    {
      "t": "2026-10-31T16:49:27+03:00",
      "k": "gate",
      "g": "G2",
      "ok": true,
      "found": 14,
      "fixed": 14,
      "deferred": 0
    },
    {
      "t": "2026-10-31T16:59:25+03:00",
      "k": "tickets",
      "n": 3
    },
    {
      "t": "2026-10-31T16:59:34+03:00",
      "k": "gate",
      "g": "G3",
      "ok": false,
      "problems": 1
    },
    {
      "t": "2026-10-31T16:59:50+03:00",
      "k": "tickets",
      "n": 3
    },
    {
      "t": "2026-10-31T16:59:51+03:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    },
    {
      "t": "2026-10-31T17:04:01+03:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    },
    {
      "t": "2026-10-31T17:10:13+03:00",
      "k": "tickets",
      "n": 3
    },
    {
      "t": "2026-10-31T17:10:13+03:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    },
    {
      "t": "2026-10-31T17:11:06+03:00",
      "k": "stage",
      "id": "build",
      "act": "start"
    },
    {
      "t": "2026-10-31T17:11:06+03:00",
      "k": "ticket",
      "ids": [
        "01"
      ],
      "act": "start"
    }
  ],
  "reqList": [
    {
      "id": "R01",
      "text": "«Кнопка «Озвучить» у сообщений агента, озвучка ответа на русском»",
      "status": "in-ticket"
    },
    {
      "id": "R02",
      "text": "«Silero TTS — отдельный сервис, общающийся с Dim0 по HTTP»",
      "status": "in-ticket"
    },
    {
      "id": "R03",
      "text": "«НЕ менять ядро Dim0 сверх необходимого: никаких правок в бизнес-логике агента, чата, холста»",
      "status": "in-ticket"
    },
    {
      "id": "R04",
      "text": "«TTS-сервис — отдельный контейнер, общается с Dim0 по HTTP»",
      "status": "in-ticket"
    },
    {
      "id": "R05",
      "text": "«Фронтенд НЕ обращается к TTS-сервису напрямую — только к своему бэкенду Dim0»",
      "status": "in-ticket"
    },
    {
      "id": "R06",
      "text": "«Все новые UI-строки — через t(), ключи с префиксом tts. в en.json и ru.json»",
      "status": "in-ticket"
    },
    {
      "id": "R07",
      "text": "«Выключатель модуля — переменная окружения TTS_ENABLED (по умолчанию false)»",
      "status": "in-ticket"
    },
    {
      "id": "R08",
      "text": "«Пробежаться по фактам из раздела «[V2] Факты по репозиторию» и убедиться, что они соответствуют текущему состоянию кода»",
      "status": "in-ticket"
    },
    {
      "id": "R09",
      "text": "«Проверить, тянется ли выбранный образ из Docker Hub (docker pull), какой у него порт и точный путь эндпоинта (не полагаться на память и README вслепую)»",
      "status": "in-ticket"
    },
    {
      "id": "R10",
      "text": "«Проверить, какие русские спикеры реально доступны у выбранного образа (у twirapp — GET /speakers)»",
      "status": "in-ticket"
    },
    {
      "id": "R11",
      "text": "«Показать мне результаты аудита и 2–3 варианта образа с плюсами/минусами — прежде чем писать код»",
      "status": "in-ticket"
    },
    {
      "id": "R12",
      "text": "«По умолчанию, если я не ответил: образ, который тянется с Docker Hub, поддерживает русского спикера и отдаёт wav; TTS_SERVICE_URL — на его порт»",
      "status": "in-ticket"
    },
    {
      "id": "R13",
      "text": "«сервис silero-tts описать ОДИН раз через YAML-anchor (как x-postgres: &postgres-base)»",
      "status": "in-ticket"
    },
    {
      "id": "R14",
      "text": "«порт наружу не публиковать (только внутренняя сеть Docker); для отладки — рядом закомментированная строка»",
      "status": "in-ticket"
    },
    {
      "id": "R15",
      "text": "«volume для кэша моделей, чтобы не качать модель при каждом старте»",
      "status": "in-ticket"
    },
    {
      "id": "R16",
      "text": "«healthcheck — если у образа есть подходящий HTTP-эндпоинт»",
      "status": "in-ticket"
    },
    {
      "id": "R17",
      "text": "«В каждом из пяти backend-<stage> сервисов добавить: TTS_ENABLED=${TTS_ENABLED:-false}»",
      "status": "in-ticket"
    },
    {
      "id": "R18",
      "text": "«TTS_SERVICE_URL=http://silero-tts:<порт>»",
      "status": "in-ticket"
    },
    {
      "id": "R19",
      "text": "«TTS_VOICE=${TTS_VOICE:-xenia}»",
      "status": "in-ticket"
    },
    {
      "id": "R20",
      "text": "«TTS_FORMAT=${TTS_FORMAT:-wav}»",
      "status": "in-ticket"
    },
    {
      "id": "R21",
      "text": "«TTS_STREAMING=${TTS_STREAMING:-false}»",
      "status": "in-ticket"
    },
    {
      "id": "R22",
      "text": "«depends_on: silero-tts (condition: service_started, БЕЗ healthcheck-ожидания)»",
      "status": "in-ticket"
    },
    {
      "id": "R23",
      "text": "«В .env.sample (НЕ .env.example — такого файла в проекте нет) добавить эти же переменные с комментариями»",
      "status": "in-ticket"
    },
    {
      "id": "R24",
      "text": "«Новый роутер backend/topix/api/router/tts.py, подключить в backend/topix/api/app.py одной строкой рядом с остальными include_router — существующие роутеры не трогать»",
      "status": "in-ticket"
    },
    {
      "id": "R25",
      "text": "«Эндпоинт: POST /tts — Вход: { \"text\": str, \"voice\": str | null } (voice по умолчанию из env)»",
      "status": "in-ticket"
    },
    {
      "id": "R26",
      "text": "«Выход: аудиофайл, Content-Type: audio/wav (бинарный, не base64 — base64 раздувает поток на треть и портит стриминг)»",
      "status": "in-ticket"
    },
    {
      "id": "R27",
      "text": "«TTS_ENABLED != true → 503 с нейтральным (английским) detail»",
      "status": "in-ticket"
    },
    {
      "id": "R28",
      "text": "«валидация текста: непустой, лимит длины (учесть ограничение GET-образов, см. выше); превышение → 413»",
      "status": "in-ticket"
    },
    {
      "id": "R29",
      "text": "«проксирование в TTS_SERVICE_URL через httpx.AsyncClient с таймаутом (~15 с на чанк)»",
      "status": "in-ticket"
    },
    {
      "id": "R30",
      "text": "«ошибка TTS-сервиса → 502 с нейтральным detail, без внутренних деталей»",
      "status": "in-ticket"
    },
    {
      "id": "R31",
      "text": "«стриминг — через StreamingResponse, если образ умеет»",
      "status": "deferred",
      "why": "Отложено решением владельца (31.10.2026): стриминга в v1 нет — navatusein отдаёт готовый WAV, потока не умеет. Вне первой версии"
    },
    {
      "id": "R32",
      "text": "«Никаких API-ключей в коде — только env»",
      "status": "in-ticket"
    },
    {
      "id": "R33",
      "text": "«backend отдаёт нейтральный английский detail и код ответа (503/413/502), а фронтенд локализует по коду ответа через t('tts.')»",
      "status": "in-ticket"
    },
    {
      "id": "R34",
      "text": "«Утилита split_text_for_tts(text: str) -> list[str] (место — по конвенции проекта, рядом с другими утилитами; уточни в backend/topix/utils/)»",
      "status": "in-ticket"
    },
    {
      "id": "R35",
      "text": "«резать ТОЛЬКО по границам предложений: . ! ? … \\n\\n»",
      "status": "in-ticket"
    },
    {
      "id": "R36",
      "text": "«НЕ резать по запятым/словам/символам; не ломать сокращения («т.е.», «и т.д.»)»",
      "status": "in-ticket"
    },
    {
      "id": "R37",
      "text": "«короткие предложения (< 50 символов) склеивать со следующим»",
      "status": "in-ticket"
    },
    {
      "id": "R38",
      "text": "«максимум ~250 символов на чанк»",
      "status": "in-ticket"
    },
    {
      "id": "R39",
      "text": "«предложение длиннее — резать по запятой/точке с запятой/двоеточию/тире (крайний случай) с комментарием в коде, что это компромисс»",
      "status": "in-ticket"
    },
    {
      "id": "R40",
      "text": "«покрыть pytest: пустой текст, одно длинное предложение, много коротких, текст с числами, текст с эмодзи, текст с сокращениями»",
      "status": "in-ticket"
    },
    {
      "id": "R41",
      "text": "«/tts: если чанков 1–2 — синтезировать целиком»",
      "status": "in-ticket"
    },
    {
      "id": "R42",
      "text": "«если TTS_STREAMING=true и образ умеет — отдавать чанки по мере синтеза через StreamingResponse»",
      "status": "deferred",
      "why": "Отложено решением владельца (31.10.2026): стриминга в v1 нет. Вне первой версии"
    },
    {
      "id": "R43",
      "text": "«Выбрать один [вариант формата потока] и описать в TTS.md»: (а) raw PCM с бэкенда либо (б) разбор RIFF-заголовков на фронте",
      "status": "deferred",
      "why": "Отложено: стриминга в v1 нет (R42). Формат фиксирован как WAV 48 кГц моно 16 бит (R85) — фронт играет готовый Blob"
    },
    {
      "id": "R44",
      "text": "«В webui/src/features/agent/components/chat/actions/ добавить компонент (например speak-answer.tsx) и подключить его в response-actions.tsx рядом с CopyAnswer. Взять за образец copy-answer.tsx»",
      "status": "in-ticket"
    },
    {
      "id": "R45",
      "text": "«Состояния кнопки: idle / loading / playing (иконка «стоп», клик — остановка) / error (кратко, tooltip с локализованным текстом ошибки)»",
      "status": "in-ticket"
    },
    {
      "id": "R46",
      "text": "«POST /tts с текстом ответа (текст — тот же, что копирует CopyAnswer)»",
      "status": "in-ticket"
    },
    {
      "id": "R47",
      "text": "«503 → toast с t('tts.disabled') и больше не пытаться (запомнить выключенное состояние в компоненте)»",
      "status": "in-ticket"
    },
    {
      "id": "R48",
      "text": "«бинарный ответ → new Audio(URL.createObjectURL(blob)) либо Web Audio»",
      "status": "in-ticket"
    },
    {
      "id": "R49",
      "text": "«при потоковом ответе — Web Audio API: буферизация минимум 2 чанка перед стартом, текущий чанк всегда доигрывать до конца, кроссфейд 10–20 мс между чанками»",
      "status": "deferred",
      "why": "Отложено решением владельца (31.10.2026): стриминга в v1 нет — образ отдаёт готовый WAV. Вне первой версии"
    },
    {
      "id": "R50",
      "text": "«Кнопка только у сообщений агента (обеспечивается компонентом AssistantMessage)»",
      "status": "in-ticket"
    },
    {
      "id": "R51",
      "text": "«Отмена: новое сообщение пользователя или клик «стоп» → AbortController отменяет запрос, воспроизведение останавливается, URL.revokeObjectURL вызывается»",
      "status": "in-ticket"
    },
    {
      "id": "R52",
      "text": "«Строки — через t(): tts.play, tts.stop, tts.loading, tts.error, tts.disabled. Добавить в en.json И ru.json»",
      "status": "in-ticket"
    },
    {
      "id": "R53",
      "text": "«Настройки (опционально): выпадающий список голосов (xenia, kseniya, aidar, baya, eugene — только те, что есть у выбранного образа) и чекбокс «Автоозвучивать ответы агента» (по умолчанию off). Хранить в localStorage под ключами dim0.tts.vo…",
      "status": "in-ticket"
    },
    {
      "id": "R54",
      "text": "«pytest для split_text_for_tts — обязательно»",
      "status": "in-ticket"
    },
    {
      "id": "R55",
      "text": "«pytest для /tts (мок TTS-сервиса через httpx.MockTransport): 503 при TTS_ENABLED=false, 413 при слишком длинном тексте, 502 при ошибке TTS-сервиса»",
      "status": "in-ticket"
    },
    {
      "id": "R56",
      "text": "«npm run check-all (tsc + eslint) — зелёный»",
      "status": "in-ticket"
    },
    {
      "id": "R57",
      "text": "«npm run i18n:check — зелёный (новые ключи tts. есть в обоих словарях)»",
      "status": "in-ticket"
    },
    {
      "id": "R58",
      "text": "«npx vitest run — зелёный (169 файлов / 1722 теста на текущем main; после правок цифра не должна уменьшиться)»",
      "status": "in-ticket"
    },
    {
      "id": "R59",
      "text": "«npx playwright test e2e/i18n-ru.spec.ts — зелёный (существующий русский смоук)»",
      "status": "in-ticket"
    },
    {
      "id": "R60",
      "text": "«Ручной чек-лист (описать в отчёте)»: compose поднимает silero-tts и dim0; кнопка появляется у сообщения агента; клик — слышен русский голос; «стоп» останавливает; при TTS_ENABLED=false — локализованная ошибка; смена голоса работает",
      "status": "in-ticket"
    },
    {
      "id": "R61",
      "text": "«Создать TTS.md в корне репозитория: архитектура (диаграмма: frontend → dim0 backend → silero-tts)»",
      "status": "in-ticket"
    },
    {
      "id": "R62",
      "text": "«TTS.md: переменные окружения (TTS_ENABLED, TTS_SERVICE_URL, TTS_VOICE, TTS_FORMAT, TTS_STREAMING)»",
      "status": "in-ticket"
    },
    {
      "id": "R63",
      "text": "«TTS.md: как запустить (docker compose --profile <stage> up -d); как поменять голос (env или настройки UI); как отключить модуль»",
      "status": "in-ticket"
    },
    {
      "id": "R64",
      "text": "«TTS.md: формат аудио и как собирается поток (raw PCM или WAV + разбор заголовков)»",
      "status": "in-ticket"
    },
    {
      "id": "R65",
      "text": "«TTS.md: как обновляться из upstream — конфликты ожидаются только в .env.sample, build/docker-compose.yml, backend/topix/api/app.py (одна строка подключения роутера), backend/topix/api/router/tts.py, компоненте сообщения агента и файлах ло…",
      "status": "in-ticket"
    },
    {
      "id": "R66",
      "text": "«TTS.md: известные ограничения (числа могут читаться как цифры, если образ их не расширяет; SSML не используется в первой версии; клонирование голоса не поддерживается; GET-образы ограничивают длину текста)»",
      "status": "in-ticket"
    },
    {
      "id": "R67",
      "text": "«Не переписывать существующие роутеры и компоненты — только добавлять новое»",
      "status": "in-ticket"
    },
    {
      "id": "R68",
      "text": "«Не хардкодить URL, порты, голоса — только env / настройки»",
      "status": "in-ticket"
    },
    {
      "id": "R69",
      "text": "«Не тащить новые фронтенд-зависимости: Web Audio API и нативный fetch. Если нужна библиотека для потокового аудио — сначала спроси меня»",
      "status": "in-ticket"
    },
    {
      "id": "R70",
      "text": "«Не переводить на бэкенде то, что уже уходит в UI: TTS-ошибки локализуются на фронте по коду ответа (правило из I18N.md)»",
      "status": "in-ticket"
    },
    {
      "id": "R71",
      "text": "«Не забыть, что compose-профилей пять: правка только одного backend-local оставит dev/test/staging/prod без TTS»",
      "status": "in-ticket"
    },
    {
      "id": "R72",
      "text": "«Отчёт в конце: Выбранный Docker-образ Silero TTS и почему (с проверкой docker pull)»",
      "status": "in-ticket"
    },
    {
      "id": "R73",
      "text": "«Отчёт в конце: Список новых/изменённых файлов (backend, frontend, compose, docs)»",
      "status": "in-ticket"
    },
    {
      "id": "R74",
      "text": "«Отчёт в конце: Новые ключи локализации tts. (en/ru)»",
      "status": "in-ticket"
    },
    {
      "id": "R75",
      "text": "«Отчёт в конце: Результаты pytest, npm run check-all, i18n:check, vitest, e2e и ручного чек-листа»",
      "status": "in-ticket"
    },
    {
      "id": "R76",
      "text": "«Отчёт в конце: Ссылка на PR в мой форк (ветка feature/tts-module → main)»",
      "status": "in-ticket"
    },
    {
      "id": "R77",
      "text": "«Отчёт в конце: Что осталось за рамками первой версии (стриминг, SSML, клонирование голоса, настройки в UI — если что-то не делал)»",
      "status": "in-ticket"
    },
    {
      "id": "R78i",
      "text": "(подразумевается) Эндпоинт POST /tts защищён так же, как остальные эндпоинты Dim0 — не открыт анонимно",
      "status": "in-ticket"
    },
    {
      "id": "R79i",
      "text": "(подразумевается) Длинный ответ агента озвучивается целиком, а не обрезается",
      "status": "in-ticket"
    },
    {
      "id": "R80i",
      "text": "(подразумевается) Кнопка «Озвучить» есть у каждого сообщения агента в ленте, а не только у последнего",
      "status": "in-ticket"
    },
    {
      "id": "R81",
      "text": "Модель голоса — v5_6_ru (https://models.silero.ai/models/tts/ru/v5_6_ru.pt, 147 664 410 Б, Last-Modified 2026-10-15), на поколение новее v5_5_ru (2026-04-16)",
      "status": "in-ticket"
    },
    {
      "id": "R82",
      "text": "SILERO_SETTINGS в compose задаёт язык, ссылку на модель и список спикеров",
      "status": "in-ticket"
    },
    {
      "id": "R83",
      "text": "TTS_MODEL_URL в .env.sample — переопределяемая ссылка на модель",
      "status": "in-ticket"
    },
    {
      "id": "R84",
      "text": "Подготовка текста в бэкенде перед проксированием — два шага строго по порядку: (1) транслитерация латиницы в кириллицу своей полной таблицей на 52 буквы; (2) экранирование XML-спецсимволов &, <, > → CDATA-секция на каждый символ (<![CDATA[…",
      "status": "in-ticket"
    },
    {
      "id": "R85",
      "text": "Формат аудио: WAV, 48 кГц, моно, 16 бит, RIFF-заголовок",
      "status": "in-ticket"
    },
    {
      "id": "R86",
      "text": "Потребление памяти контейнера — 700–900 МБ RSS (197 МБ torch, 430 МБ после загрузки модели)",
      "status": "in-ticket"
    },
    {
      "id": "R87",
      "text": "Модель скачивается при первом старте контейнера (147 МБ) в /usr/app/models → volume обязателен",
      "status": "in-ticket"
    },
    {
      "id": "R88",
      "text": "Стриминга в v1 нет: TTS_STREAMING=false по умолчанию, StreamingResponse не используется",
      "status": "in-ticket"
    },
    {
      "id": "R89",
      "text": "Поведение кнопки при TTS_ENABLED=false: кнопка остаётся видимой; первый 503 → один локализованный тост t('tts.disabled'); после этого кнопка уходит в неактивное состояние с подсказкой t('tts.disabled') до перезагрузки страницы",
      "status": "in-ticket"
    },
    {
      "id": "R90",
      "text": "Контракт TTS-сервиса: POST /process, form-urlencoded voice=<speaker>&input_text=<текст> → audio/wav; порт внутри сети 9898",
      "status": "in-ticket"
    },
    {
      "id": "R91",
      "text": "Эндпоинт GET /tts/voices — список доступных голосов: проксирует GET {TTS_SERVICE_URL}/voices, парсит plain text (по голосу в строке, не JSON), нормализует в JSON {\"voices\": [\"…\"]}, кэширует ~300 с; сервис недоступен или список пуст → 503 с…",
      "status": "in-ticket"
    },
    {
      "id": "R92",
      "text": "Чекбокс «Автоозвучивать ответы агента» в UI у сообщения агента: по умолчанию off, состояние в localStorage под ключом dim0.tts.autoSpeak",
      "status": "in-ticket"
    },
    {
      "id": "R93",
      "text": "Docker Desktop установлен, демон поднят — docker info отвечает",
      "status": "in-ticket"
    },
    {
      "id": "R94",
      "text": "Контейнерный смоук выполнен: pull образа (digest, размер, дата, мультиархность), GET / → {\"status\":\"work\"}, GET /voices → plain text по строке на голос, POST /process → audio/wav с проверкой RIFF / 48 кГц / моно / 16 бит",
      "status": "in-ticket"
    },
    {
      "id": "R95",
      "text": "Сквозная проверка бэкенд → TTS в compose: docker compose --profile local up -d, TTS_ENABLED=true, POST /tts с текстом, содержащим & и <, → WAV; GET /tts/voices → массив из пяти голосов",
      "status": "in-ticket"
    },
    {
      "id": "R96",
      "text": "Экранирование XML подтверждено на живом сервисе: сырые & и < → 400 «Invalid XML format»; named-сущности (&amp;) → тоже 400 (нормализатор разрушает); по-символьный CDATA → 200 + WAV",
      "status": "in-ticket"
    },
    {
      "id": "R97",
      "text": "Латиница в ответе агента не ломает озвучку: после подготовки текста в нём не остаётся ни одной латинской буквы — сервис получает только кириллицу",
      "status": "in-ticket"
    }
  ],
  "gates": {
    "G1": {
      "ok": true,
      "at": "2026-10-31T16:48:46+03:00",
      "open": 0,
      "total": 97
    },
    "G2": {
      "ok": true,
      "at": "2026-10-31T16:49:27+03:00",
      "found": 14,
      "fixed": 14,
      "deferred": 0
    },
    "G3": {
      "ok": true,
      "at": "2026-10-31T17:10:13+03:00",
      "problems": 0
    }
  },
  "result": null
}
