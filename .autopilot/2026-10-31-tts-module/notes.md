# Карта кода для модуля Silero TTS (`POST /tts` + кнопка «Озвучить»)

Разведка по реальному коду форка `Dim0` (корень `C:\Users\Андрей\Desktop\DIM\dim0`).
Все пути абсолютные. Идентификаторы — точные, как в исходниках.

---

## 1. Backend — точка входа приложения

**Файл:** `C:\Users\Андрей\Desktop\DIM\dim0\backend\topix\api\app.py`

Функция `create_app(stage: StageEnum) -> FastAPI` создаёт приложение, вешает `CORSMiddleware`
(`allow_origins=["*"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`),
и в конце подключает роутеры **ровно одной строкой на роутер, без префикса**:

```python
    app.include_router(ai.router)
    app.include_router(boards.router)
    app.include_router(chats.router)
    app.include_router(collab.router)
    app.include_router(sharing.router)
    app.include_router(tools.router)
    app.include_router(users.router)
    app.include_router(subscriptions.router)
    app.include_router(billing.router)
    app.include_router(mini_app_state.router)
    app.include_router(utils.router)
    app.include_router(finance.router)
    app.include_router(files.router)
    app.include_router(documents.router)
```

Импорт роутеров — один grouped-import (isort-стиль, `lines-between-types = 1`):

```python
from topix.api.router import (
    ai,
    billing,
    boards,
    chats,
    collab,
    documents,
    files,
    finance,
    mini_app_state,
    sharing,
    subscriptions,
    tools,
    users,
    utils,
)
```

**Что делать для TTS:** добавить `tts,` в этот кортеж (по алфавиту — между `tools` и `users`)
и `app.include_router(tts.router)` в блок `include_router` (порядок в блоке не алфавитный;
`files`/`documents` в конце — видимо, дописывались последними). Новую строку разумно поставить
в конец блока, рядом с `documents.router`.

**Префиксы:** глобального префикса `/api` в проекте **нет** — эндпоинт будет доступен как
`POST /tts` (ровно как задумано в брифе). Префикс задаётся на самом роутере:
`APIRouter(prefix="/utils", ...)`, `APIRouter(prefix="/ai", ...)`, `APIRouter(prefix="/files", ...)`,
`APIRouter(prefix="/mini-app-state", ...)`. Есть и роутеры без префикса (`sharing`, `boards`),
у которых полный путь пишется в самом декораторе: `@router.post("/boards/{graph_id}/share-links")`.

**Стиль URL:** у каждого эндпоинта дублируется декоратор — со и без завершающего слэша,
второй (без слэша) — основной, первый помечен `include_in_schema=False`:

```python
@router.get("/services/", include_in_schema=False)
@router.get("/services")
@with_standard_response
async def get_services(...):
```

Тот же приём в `sharing.py`, `mini_app_state.py`, `files.py`, `utils.py`.

---

## 2. Backend — роутеры

**Каталог:** `C:\Users\Андрей\Desktop\DIM\dim0\backend\topix\api\router\`

Модули (14 + `__init__.py`):

| Файл | Размер | Префикс / теги |
|---|---|---|
| `ai.py` | 25 680 | `prefix="/ai"`, `tags=["ai"]` |
| `billing.py` | 16 520 | — |
| `boards.py` | 24 657 | — |
| `chats.py` | 13 037 | — |
| `collab.py` | 21 289 | — |
| `documents.py` | 2 873 | — |
| `files.py` | 2 501 | `prefix="/files"`, `tags=["files"]` |
| `finance.py` | 839 | — |
| `mini_app_state.py` | 2 732 | `prefix="/mini-app-state"`, `tags=["mini-app"]` |
| `sharing.py` | 9 025 | `tags=["sharing"]` (без префикса) |
| `subscriptions.py` | 7 672 | — |
| `tools.py` | 7 598 | — |
| `users.py` | 21 979 | — |
| `utils.py` | 3 669 | `prefix="/utils"`, `tags=["utils"]` |

`__init__.py` содержит одну строку: `"""API routers."""`

### 2.1 Объявление роутера

`sharing.py`:

```python
router = APIRouter(
    tags=["sharing"],
    responses={404: {"description": "Not found"}},
)
```

`utils.py`:

```python
router = APIRouter(
    prefix="/utils",
    tags=["utils"],
    responses={404: {"description": "Not found"}},
)
```

`ai.py` — самый краткий вариант:

```python
router = APIRouter(prefix="/ai", tags=["ai"])
```

`files.py` — вариант с dependency на уровне роутера:

```python
router = APIRouter(
    prefix="/files",
    tags=["files"],
    dependencies=[Depends(get_current_user_uid)],
    responses={404: {"description": "Not found"}},
)
```

Во всех модулях: `logger = logging.getLogger(__name__)` после импортов, docstring модуля в первой строке.

### 2.2 Тела запросов — pydantic-модели

Pydantic-модели **объявляются прямо в модуле роутера** (не в отдельном `datatypes/`), если
относятся только к одному эндпоинту. Найденные примеры:

- `ai.py`: `AiLlmRequest`, `AiSearchRequest`, `AiCodeRequest`, `AiFetchRequest`
- `mini_app_state.py`: `PutStateRequest`

```python
class PutStateRequest(BaseModel):
    """Body for ``PUT /mini-app-state/{note_id}``."""

    state: Any
```

```python
class AiLlmRequest(BaseModel):
    """One model turn (OpenAI-shaped `messages`/`tools`; `model` is a catalog id or "auto")."""

    model: str = "auto"
    messages: list[dict[str, Any]] = []
    tools: list[dict[str, Any]] = []
    reasoning_effort: Literal["low", "medium", "high"] | None = None
```

Модель подключается как обычный параметр функции:

```python
async def put_mini_app_state(
    response: Response,
    request: Request,
    note_id: Annotated[str, Path(description="Note UID")],
    payload: PutStateRequest,
    user_uid: Annotated[str, Depends(get_current_user_uid)],
):
```

В `sharing.py` вместо pydantic используется свободный словарь:

```python
    body: Annotated[
        dict, Body(description="{ role: 'member' | 'viewer' }"),
    ],
```

### 2.3 Авторизация

Точное имя зависимости — **`get_current_user_uid`**, импорт:

```python
from topix.api.utils.security import get_current_user_uid
```

Объявление (`backend/topix/api/utils/security.py:134`):

```python
async def get_current_user_uid(request: Request, token: Annotated[str, Depends(oauth2_scheme)]) -> str:
    """Extract the user uid from the *access* token."""
```

`oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/signin")` — без токена бросает 401.

Использование как параметр (инъекция uid):

```python
    user_id: Annotated[str, Depends(get_current_user_uid)],
```

Или как зависимость уровня роутера (весь роутер требует авторизации) — `files.py`:

```python
router = APIRouter(
    prefix="/files",
    tags=["files"],
    dependencies=[Depends(get_current_user_uid)],
    ...
)
```

Другие зависимости из того же модуля: `verify_board_owner`, `verify_board_member`,
`verify_chat_user`, `decode_and_validate_token`. Для необязательного токена в `ai.py` заведён
**отдельный** `OAuth2PasswordBearer(tokenUrl="/users/signin", auto_error=False)` и своя зависимость
`optional_user_uid`.

### 2.4 Ошибки

Ошибки — обычный `fastapi.HTTPException` с полем `detail`:

```python
raise HTTPException(status_code=400, detail="role must be 'member' or 'viewer'")
raise HTTPException(status_code=404, detail="Share link not found or revoked")
raise HTTPException(
    status_code=400,
    detail="The board owner cannot be removed. Transfer ownership first.",
)
```

Отдельных exception-классов проекта для API нет (`topix/api/` не содержит своих
`BadRequest`-типов; `http_exceptions` импортируется только в `config/config.py` для Doppler).

**Важно:** большинство эндпоинтов обёрнуты декоратором
`from topix.api.utils.decorators import with_standard_response`. Он **ловит** `HTTPException`
и превращает её в JSON-тело вида `{"status": "error", "data": {"message": <detail>}}`,
сохраняя HTTP-код в `response.status_code`:

```python
        except HTTPException as http_exc:
            # Preserve HTTPException's status code and message
            if response:
                response.status_code = http_exc.status_code
            logger.error(f"HTTPException in {func.__name__}: {http_exc.detail}", exc_info=True)
            return {
                "status": "error",
                "data": {"message": http_exc.detail}
            }
```

Успех — `{"status": "success", "data": <result>}`.

**Для TTS это критично:** `with_standard_response` оборачивает тело в JSON-обёртку, а TTS
должен отдать **бинарный** `audio/wav`. Значит TTS-эндпоинт `@with_standard_response` **не применяет**
и отвечает сырым `Response(content=..., media_type="audio/wav")`.

### 2.5 Бинарные / не-JSON ответы

Прецеденты есть, но все — **стриминговые JSON-ish**, не бинарные:

- `ai.py:385` → `return StreamingResponse(generate(), media_type="application/x-ndjson")`
- `chats.py:201` → `media_type="application/x-ndjson"`
- `api/utils/decorators.py:69` → `with_streaming` → `StreamingResponse(..., media_type="text/event-stream")`
- `api/utils/resilient_streaming.py:93` → `StreamingResponse(gen(), media_type=media_type)`

**Бинарного ответа (например `audio/wav`) в проекте сейчас НЕТ** — прецедента нет,
придётся создать первый (`Response(content=..., media_type="audio/wav")`).

Кстати, `files.py` отдаёт файл **не бинарью, а base64 внутри JSON**:
`return {"base64_url": base64_url}` — фронт это разворачивает в data-URL.

---

## 3. Backend — конфигурация

**Файл:** `C:\Users\Андрей\Desktop\DIM\dim0\backend\topix\config\config.py`

Чтение env — **только через `os.getenv(...)` внутри `model_post_init`** (Pydantic v2).
Пример:

```python
class AppSettings(BaseModel):
    """Application settings."""

    port: int = 8888

    def model_post_init(self, __context):
        """Post-initialization to set up any derived attributes."""
        env_port = os.getenv("API_PORT")
        if env_port:
            self.port = int(env_port)
            logger.info(f"App port set from environment API_PORT: {self.port}")
```

Секреты читаются через `SecretStr`:

```python
class BaseAPIConfig(BaseModel):
    """Base configuration for APIs used in the application."""

    url: str | None = None
    api_key: SecretStr | None = None
    env_var: str  # Environment variable name to load the API key from must be UPPERCASE
```

Структура класса `Config`:

```python
class Config(BaseModel, metaclass=ConfigMeta):
    """Configuration class for TopiX application."""

    stage: StageEnum = StageEnum.LOCAL
    run: RunConfig = Field(default_factory=RunConfig)
    app: AppConfig = Field(default_factory=AppConfig)
```

`Config` — синглтон (`ConfigMeta(SingletonMeta, type(BaseModel))`), точка доступа
`Config.instance()`; `Config.load(stage)` тянет секреты из Doppler.

**Где живут «app-level settings»:** `AppConfig` → `settings: AppSettings` (`port`),
`security: SecuritySettings` (`secret_key`, `algorithm`). Внешние API — в `RunConfig.apis`
(`APIsConfig` с `OpenAIConfig`, `AnthropicConfig`, … — все наследуют `BaseAPIConfig`).

**Конвенция для новой настройки TTS:** есть два согласованных пути.

1. **Локально в роутере/утилите** — просто `os.getenv("TTS_ENABLED")` в момент запроса.
   В проекте есть прецедент прямых `os.getenv` вне `config.py`: `ai.py` импортирует `os`
   (строки `import os`, `import tempfile`).
2. **В `config/config.py`** — добавить `TTSConfig(BaseModel)` c `model_post_init`, читающим
   `TTS_*` через `os.getenv`, и вложить его в `AppConfig`/`RunConfig`. Так сделано для
   всех внешних API (ключи, URL). Это «правильная» конвенция для URL/флага внешнего сервиса.

**Важно:** env в docker-compose для backend-сервисов передаётся **и** через `environment:`
**и** через volume `../${ENVFILE:-.env}:/.env:ro`. То есть `.env` монтируется в контейнер,
но `Config.load()` читает Doppler, а `.env` — через `python-dotenv` в `topix/setup.py`.
Проверьте `backend/topix/setup.py`, как именно подхватывается `.env` (в репозитории есть
`--env-file` в `app.py` и в `pytest` conftest).

Смежные модули в `backend/topix/config/`: `__init__.py`, `catalog.py`, `config.py`,
`services.py`, `utils.py`. `services.py` — описание сервисов из `services.yml`
(`ServiceEnum`, `BaseService`, `ServiceConfig`), **не** место для TTS.

---

## 4. Backend — утилиты

**Каталог:** `C:\Users\Андрей\Desktop\DIM\dim0\backend\topix\utils\`

```
__init__.py
colors.py
common.py
file.py
logging.py
retry.py
singleton.py
timeit.py
finance/     (__init__.py, trading.py)
graph/       (__init__.py, layout.py, text_measure.py)
images/      (__init__.py, search.py, web.py)
web/         (__init__.py, favicon.py, preview.py)
```

**Стиль маленьких утилит** (образец для нового `utils/tts.py`):

`common.py`:

```python
"""Common utility functions."""
from pathlib import Path
from uuid import uuid4


def gen_uid() -> str:
    """Generate a unique id string."""
    return str(uuid4()).replace('-', '')


def running_in_docker() -> bool:
    """Check if the code is running inside a Docker container."""
    return Path("/.dockerenv").exists()
```

`retry.py`:

```python
"""Asynchronous retry decorator."""
import asyncio

from functools import wraps


def async_retry(retries=3, delay_ms=200, exceptions=(Exception,)):
    """Asynchronous retry decorator."""
```

Итого конвенции утилит:
- docstring модуля в первой строке (одна строка, `"""..."""`);
- docstring у каждой функции/класса (1–3 строки, по `backend/AGENTS.md`);
- type hints везде (`-> str`, `-> bool`, параметры аннотированы);
- `snake_case` для функций и переменных, `PascalCase` для классов;
- пустая строка между импортами разных типов (isort `lines-between-types = 1`);
- ruff: line-length 150, включены `D` (pydocstyle), `N` (pep8-naming), `I` (isort);
  `D203` и `D213` в ignore.

`backend/topix/utils/__init__.py` — 58 байт (пустой/минимальный).

---

## 5. Backend — тесты роутеров

**Каталог:** `C:\Users\Андрей\Desktop\DIM\dim0\backend\test\unit\api\router\`

Имена файлов: `test_<область>_<что>_router.py` — например `test_sharing_router.py`,
`test_utils_ping_router.py`, `test_ai_llm_router.py`, `test_boards_adopt_router.py`,
`test_mini_app_state_router.py`, `test_users_email_verification_router.py`.

**Для TTS по конвенции → `backend/test/unit/api/router/test_tts_router.py`.**

### 5.1 Полная разборка `test_sharing_router.py`

Импорты:

```python
from __future__ import annotations

from unittest.mock import AsyncMock

from fastapi import FastAPI
from fastapi.testclient import TestClient

from topix.api.router.sharing import router
from topix.api.utils.security import get_current_user_uid, verify_board_owner
from topix.collab.room import RoomRegistry
```

**Приложение для теста строится вручную, НЕ через `create_app()`** (никакого БД/Redis):

```python
def _build_client(*, user_uid: str = "u1", is_owner: bool = True) -> tuple[TestClient, FastAPI]:
    """Build client."""
    app = FastAPI()
    app.include_router(router)
    app.graph_store = _FakeGraphStore()
    app.collab_rooms = RoomRegistry()

    async def _fake_current_user_uid():
        """Fake current user uid."""
        return user_uid

    async def _fake_verify_owner():
        """Fake verify owner."""
        if not is_owner:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Board not found")

    app.dependency_overrides[get_current_user_uid] = _fake_current_user_uid
    app.dependency_overrides[verify_board_owner] = _fake_verify_owner
    return TestClient(app), app
```

Ключевые факты:
- `fastapi.testclient.TestClient` (**синхронный**, НЕ `httpx.AsyncClient`);
- dependency overrides — через `app.dependency_overrides[<зависимость>] = <функция>`;
  override-функции объявляются **внутри** `_build_client` (не фикстуры pytest);
- строки-заглушки для стора пишутся руками: `_FakeGraphStore`, `_FakePool`, `_AsyncAcquire`
  (async context manager для `pool.acquire()`);
- `AsyncMock` из `unittest.mock` для мока async-функций;
- мок модуля — `monkeypatch.setattr(sharing_router.links, "mint_link", AsyncMock(return_value=...))`
  (атрибут модуля, а не объекта);
- тесты — **синхронные** `def test_...`, без `@pytest.mark.asyncio`;
- проверка формы ответа: `body["status"] == "success"`, `body["data"]["..."]`;
- отдельный тест на 401: приложение собирается **без** override'а →
  `response.status_code == 401` («No JWT → OAuth2PasswordBearer raises 401»).

### 5.2 Прецедент мока исходящего HTTP — `httpx.MockTransport` **есть**

Файл: `C:\Users\Андрей\Desktop\DIM\dim0\backend\test\unit\agents\test_parallel_search.py`

```python
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(handle),
        ...
    )
```

где `handle` — обычная sync-функция, возвращающая `httpx.Response(...)`:

```python
            raise httpx.ReadTimeout("fixture timeout", request=request)
            return httpx.Response(state["status"], headers={"Retry-After": "60"}, text="rate limited")
            return httpx.Response(200, json={"jsonrpc": "2.0", "id": "fixture", "error": {"message": state["rpc_error"]}})
```

Там же — прецедент вызова **ASGI-приложения** через httpx:

```python
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://dim0") as caller:
```

**Резюме по мокам:** `respx` **не используется**; `mock.patch` of `httpx.AsyncClient`
**не используется**; `monkeypatch` на `httpx` **не используется**. Единственный прецедент —
`httpx.MockTransport`, подставляемый в `httpx.AsyncClient(transport=...)` (то есть мокается
**транспорт**, а не класс клиента). Чтобы применить это к TTS, клиент TTS должен создаваться
**внутри** функции (фабрика `httpx.AsyncClient(...)`) либо принимать `transport` параметром —
иначе `monkeypatch` придётся навесить на `httpx.AsyncClient.__init__`/`httpx.AsyncClient.post`.

Также: `backend/test/conftest.py` добавляет кастомную опцию `--env-file`
и session-фикстуру `env_file` (путь к env-файлу, по умолчанию `.env`).

Полный список unit-тестов роутеров (21 файл) — в `backend/test/unit/api/router/`.

---

## 6. Backend — pytest и зависимости

**`C:\Users\Андрей\Desktop\DIM\dim0\backend\pytest.ini`** (целиком):

```ini
[pytest]
asyncio_default_fixture_loop_scope = module
asyncio_mode = auto
log_cli = 1
log_cli_level = INFO
log_cli_format = %(asctime)s [%(levelname)8s] %(message)s (%(filename)s:%(lineno)s)
log_cli_date_format=%Y-%m-%d %H:%M:%S
log_format = %(asctime)s %(levelname)s %(message)s
log_date_format = %Y-%m-%d %H:%M:%S
minversion = 6.0
addopts = -ra -q
pythonpath = .
testpaths =
    test
```

Ключевое: `asyncio_mode = auto` (async-тесты идут без маркера), `pythonpath = .` (импорт `topix`
работает из каталога `backend/`), `testpaths = test` (unit **и** integration попадают в прогон
по умолчанию — integration требует живых БД и падает без них).

**`backend/pyproject.toml`:**

```toml
[tool.pytest.ini_options]
timeout = 30
timeout_method = "thread"
```

(per-test лимит 30 с; `timeout_method = "thread"` — чтобы прерывать зависшие WS-тесты.)

**Зависимости (`[project.dependencies]`):**

- `httpx>=0.28.1` — **httpx объявлен**, установленная версия в `backend/.venv`: **`httpx 0.28.1`**
  (проверено: `.venv/Scripts/python.exe -c "import httpx; print(httpx.__version__)"`).
- `fastapi==0.128.0`, `pydantic[email]>=2.12.4`, `uvicorn==0.41.0`, `aiohttp>=3.12.13`.
- Dev: `pytest>=8.4.1`, `pytest-asyncio>=1.0.0`, `pytest-timeout>=2.3.1`, `pytest-cov>=6.0.0`,
  `ruff>=0.12.2`, `black>=25.1.0`.

**Python:** `requires-python = ">=3.13"`; в `.venv` — **Python 3.13.15**.
Менеджер — **uv** (`backend/uv.lock` есть, `[tool.uv]` в pyproject).

---

## 7. Frontend — `apiFetch`

**Файл:** `C:\Users\Андрей\Desktop\DIM\dim0\webui\src\api.ts`

Тип опций (точное имя — **`ApiOptions`**, generic по телу):

```typescript
export type ApiOptions<TBody = unknown> = {
  path: string | URL
  method?: HttpMethod
  params?: Record<string, string | number | boolean | null | undefined>
  headers?: HeadersInit
  body?: TBody extends FormData ? FormData : TBody
  signal?: AbortSignal
  noAuth?: boolean
}
```

`HttpMethod`:

```typescript
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
```

Сигнатура функции (точная):

```typescript
export async function apiFetch<TResponse = unknown, TBody = unknown>(
  opts: ApiOptions<TBody>
): Promise<TResponse> {
```

Как добавляется токен:

```typescript
  const h = new Headers(headers)

  if (!noAuth) {
    const token = getAccessToken()
    if (token) h.set("Authorization", `Bearer ${token}`)
  }
```

`getAccessToken` — из `./features/signin/auth-storage` (`localStorage["access_token"]`).

Тело запроса:

```typescript
  let payload: BodyInit | undefined
  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined && body !== null) {
    h.set("Content-Type", "application/json")
    payload = JSON.stringify(body)
  }
```

`signal` пробрасывается в оба вызова `fetch` (первый и retry после refresh):

```typescript
  let res = await trackedFetch(url.toString(), { method, headers: h, body: payload, signal })
```

**Ветка не-JSON ответа** (это `res.text()`, а НЕ `res.blob()`!):

```typescript
  const ct = res.headers.get("content-type") || ""
  return ct.includes("application/json")
    ? ((await res.json()) as TResponse)
    : ((await res.text()) as unknown as TResponse)
```

> **Критично для TTS:** `apiFetch` **не умеет отдавать бинарь** — для `audio/wav` он вернёт
> строку-текст (искажённую). Для TTS нужен либо отдельный fetch (`fetchWithAuthRaw`),
> либо `apiFetch` придётся расширять (риск сломать общие контракты).

**Как бросаются ошибки:**

```typescript
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText} - ${text}`)
  }
```

> **Критично:** это обычный `new Error(message)` — **HTTP-статус НЕ переносится отдельным полем**.
> В `Error` есть только `message`, `name`, `stack`. Ни `status`, ни `statusCode`, ни `endpoint`
> на объекте ошибки нет. Значит `localizeApiError()` (см. §9) **не сможет выбрать
> `ENDPOINT_STATUS_KEYS["/tts"]`** для ошибок, порождённых `apiFetch` — статус потеряется,
> а текст вернётся дословно. Чтобы per-endpoint маппинг заработал, фронт должен бросать
> собственный класс ошибки с полями `status`/`statusCode` и `endpoint`
> (прецедент: `SendMessageError` в `features/agent/api/send-message.ts` —
> `class SendMessageError extends Error { status: number; retryAfter?: number }`).

Прочие экспорты `api.ts`: `HttpMethod`, `ApiOptions`, `TokenPayload`, `EmailVerificationStatus`,
`AuthMethods`, `registerLogoutHandler`, `signin`, `signup`, `getAuthMethods`,
`googleSigninWeb`, `googleSigninDesktop`, `refresh`, `getEmailVerificationStatus`,
`resendVerificationEmail`, `verifyEmailToken`, `getPasswordResetStatus`, `forgotPassword`,
`resetPassword`, `PasswordResetStatus`, `RawInit`, `fetchWithAuthRaw`.

`fetchWithAuthRaw` — низкоуровневый вариант, **возвращает `Response` без чтения тела**
(подходит для бинаря/стрима):

```typescript
export type RawInit = RequestInit & { noAuth?: boolean }

export async function fetchWithAuthRaw(input: string | URL, init: RawInit = {}): Promise<Response>
```

URL строится от `API_URL` (`webui/src/config/api.ts`):
`export const API_URL = runtime || getEffectiveApiBase() || "http://localhost:8888"`.

---

## 8. Frontend — карта ошибок i18n

**Файл:** `C:\Users\Андрей\Desktop\DIM\dim0\webui\src\lib\i18n\errors.ts`

`STATUS_KEYS` — точный тип и содержимое:

```typescript
/** Status → locale key, shared by every endpoint. */
const STATUS_KEYS: Partial<Record<number, string>> = {
  400: "errors.bad_request",
  401: "errors.unauthorized",
  403: "errors.forbidden",
  404: "errors.not_found",
  409: "errors.conflict",
  413: "errors.payload_too_large",
  429: "errors.rate_limited",
  500: "errors.server",
  502: "errors.unavailable",
  503: "errors.unavailable",
  504: "errors.timeout",
}
```

`ENDPOINT_STATUS_KEYS` — точный тип и текущая единственная запись:

```typescript
/** Endpoints where a status means something more specific than its generic key. */
const ENDPOINT_STATUS_KEYS: Record<string, Partial<Record<number, string>>> = {
  // A 401 here is a wrong username/password pair, not an expired session.
  "/users/signin": { 401: "errors.bad_credentials" },
}
```

> **Регистрация per-endpoint статуса** = добавить ключ пути в `ENDPOINT_STATUS_KEYS`,
> значение — `Partial<Record<number, string>>`. Для TTS, например:
> `"/tts": { 413: "tts.too_long", 502: "tts.unavailable", 503: "tts.disabled" }`.
> Обратите внимание: текущие per-endpoint ключи ссылаются на пространство `errors.*`;
> TTS-ключи из брифа (`tts.*`) — другое пространство, но формат тот же (строка-ключ).

Тип полей ошибки:

```typescript
/** Fields a thrown API error may carry alongside its message. */
type ApiErrorFields = {
  status?: unknown
  statusCode?: unknown
  endpoint?: unknown
  detail?: unknown
  message?: unknown
}
```

**Функция перевода ошибки** (точное имя и сигнатура):

```typescript
export function localizeApiError(error: unknown, fallbackKey: string): string
```

Плюс вспомогательная (экспортируется тоже):

```typescript
export function apiErrorKey(status: number, endpoint?: string): string | undefined
```

Логика `localizeApiError`:

```typescript
export function localizeApiError(error: unknown, fallbackKey: string): string {
  const fields = fieldsOf(error)
  const status = toStatus(fields.status ?? fields.statusCode)
  if (status !== undefined) {
    const key = apiErrorKey(status, toEndpoint(fields.endpoint))
    if (key !== undefined) return i18n.t(key)
  }

  const detail = firstText(fields.detail, fields.message, error)
  if (detail !== undefined) return detail

  return i18n.t(fallbackKey)
}
```

Порядок: статус → per-endpoint → generic `STATUS_KEYS` → `detail`/`message` **дословно** →
`fallbackKey`. Модуль использует `import { i18n } from "@/i18n"` и `i18n.t(...)` (не React).

Тесты: `webui/src/lib/i18n/errors.test.ts` (vitest, `beforeAll` → `initI18n()` + `setLanguage("en")`).

---

## 9. Frontend — ряд действий под ответом агента

**Каталог:** `C:\Users\Андрей\Desktop\DIM\dim0\webui\src\features\agent\components\chat\actions\`

Файлы (3):
- `copy-answer.tsx` (1 738 б)
- `response-actions.tsx` (1 727 б)
- `save-as-note.tsx` (11 434 б)

### 9.1 `response-actions.tsx` — полностью

```typescript
import clsx from "clsx"
import { useChat } from "@/features/agent/hooks/chat-context"
import { CopyAnswer } from "./copy-answer"
import { SaveAsNote } from "./save-as-note"
import { useListChats } from "@/features/agent/api/list-chats"
import { useAppStore } from "@/store"


type ResponseActionsLayout = "horizontal" | "vertical-compact"


export const ResponseActions = ({
  message,
  saveAsIs = false,
  layout = "horizontal",
}: {
  message: string
  saveAsIs?: boolean
  layout?: ResponseActionsLayout
}) => {
```

> **Props-интерфейса как отдельного `interface`/`type` НЕТ** — пропсы объявлены инлайновым
> типом-объектом в сигнатуре. Имя типа макета: **`ResponseActionsLayout`** =
> `"horizontal" | "vertical-compact"`.

Рендер:

```typescript
      <CopyAnswer answer={message} compact={compact} />
      {/* SaveAsNote self-routes: backend board-picker online, in-browser
          transform on local boards. */}
      <SaveAsNote message={message} type="notify" saveAsIs={saveAsIs} boardId={attachedBoardId} compact={compact} />
      <SaveAsNote message={message} type="mapify" boardId={attachedBoardId} compact={compact} />
      <SaveAsNote message={message} type="schemify" boardId={attachedBoardId} compact={compact} />
```

`compact = layout === "vertical-compact"`.

**Потребители `ResponseActions`:**
- `webui/src/features/agent/components/chat/assistant-message.tsx:51` →
  `<ResponseActions message={responseMarkdown} />`
- `webui/src/features/board/components/flow/floating-assistant/answer-card.tsx:72` →
  `<ResponseActions message={text} layout='vertical-compact' />`

> **Куда вставлять кнопку «Озвучить»:** в `response-actions.tsx` рядом с `<CopyAnswer …/>`
> (одна строка в ряд «horizontal», одна в «vertical-compact» — оба режима покрываются
> автоматически, т.к. `compact` передаётся в компонент).

### 9.2 `copy-answer.tsx` — полностью

```typescript
import { CheckIcon, CopyActionIcon } from "@/components/icons"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import clsx from "clsx"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"


export const CopyAnswer = ({ answer, compact = false }: { answer: string, compact?: boolean }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const actionLabel = t("agent.copy.current_answer")

  const handleCopy = () => {
    void navigator.clipboard.writeText(answer).then(() => {
      setCopied(true)
      toast(t("agent.copy.copied"))
      setTimeout(() => setCopied(false), 2000) // Reset after 2 seconds
    })
  }

  const Icon = copied ? CheckIcon : CopyActionIcon

  const buttonEl = (
    <button
      className={clsx(
        "transition-all text-muted-foreground hover:text-foreground flex flex-row items-center rounded-md",
        compact ? "justify-center size-8" : "text-xs gap-2 p-1",
      )}
      onClick={handleCopy}
      aria-label={actionLabel}
      title={actionLabel}
    >
      <Icon className='size-4 shrink-0' strokeWidth={2} weight={compact ? "duotone" : undefined} />
      {!compact && <span>{t("agent.copy.label")}</span>}
    </button>
  )

  if (!compact) return buttonEl

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
      <TooltipContent side='left'>{t("agent.copy.label")}</TooltipContent>
    </Tooltip>
  )
}
```

Ответы на вопросы:

| Вопрос | Ответ (точное имя / путь) |
|---|---|
| Как `CopyAnswer` получает текст ответа | проп **`answer`** (`{ answer: string, compact?: boolean }`) |
| Как вызывается тост | `import { toast } from "sonner"` → `toast(t("agent.copy.copied"))` |
| Какой `Tooltip` используется | `import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"` (Radix-обёртка, `webui/src/components/ui/tooltip.tsx`) |
| Свойства `Tooltip` | `Tooltip` = `TooltipPrimitive.Root` (любые пропсы Radix), `TooltipTrigger` (используется `asChild`), `TooltipContent` (используется `side='left'`, `sideOffset` по умолчанию 0) |
| Путь импорта иконок | `import { CheckIcon, CopyActionIcon } from "@/components/icons"` |
| Как импортируется и вызывается `t()` | `import { useTranslation } from "react-i18next"` → `const { t } = useTranslation()`, далее `t("agent.copy.label")` (точечная нотация) |
| Иконка «в процессе» | `const Icon = copied ? CheckIcon : CopyActionIcon` — смена иконки по состоянию |

Стиль: без `export default`, именованный экспорт, без `;`, TS-типы, `clsx` для классов,
`<button>` c `aria-label` и `title`.

---

## 10. Frontend — иконки

**Каталог:** `C:\Users\Андрей\Desktop\DIM\dim0\webui\src\components\icons\`

```
icon-base.tsx
icon-color-resolver.ts / .test.ts
icon-picker-lazy.tsx
icon-picker.tsx
icon-property-view.tsx
index.ts
note-icon-control.tsx
picker-set.ts / .test.ts
picker-value-mapping.ts / .test.ts
registry.ts
types.ts
```

Связь трёх файлов:

- **`picker-set.ts`** — «сырой» список ~500 Phosphor-иконок, импортированных напрямую из
  `@phosphor-icons/react`, сгруппированных по категориям (`id`/`label`/`icons`). Экспортирует
  массив-константу (например `] as const`) — это **пикер** иконок для досок, НЕ реестр приложения.
- **`registry.ts`** — **единственный** файл, где иконки превращаются в приложенческие компоненты:
  импорт глифов из `@phosphor-icons/react` и создание обёрток
  `export const <Name>Icon = createPhosphorIcon(<GlyphIcon>)`.
- **`index.ts`** — **ре-экспорт** из `registry.ts` ( barrel ). Именно из `@/components/icons`
  импортируют в коде (`import { CheckIcon, CopyActionIcon } from "@/components/icons"`).

`registry.ts` также держит `iconRegistry` — мапу «имя-в-строке → компонент»:

```typescript
export const iconRegistry: Record<AppIconName, AppIconComponent> = {
  add: AddIcon,
  alert: AlertIcon,
  board_context: BoardContextIcon,
  ...
  tools_menu: ToolsMenuIcon,
}
```

`AppIconName` — закрытый union в `types.ts`:

```typescript
export type AppIconName =
  | "add"
  | "alert"
  ...
  | "tools_menu"
```

### 10.1 `SpeakerHighIcon` — **Существует, но НЕ экспортируется наружу**

- `picker-set.ts:217` — `SpeakerHighIcon,` в импорте из `@phosphor-icons/react`;
- `picker-set.ts:565` — `{ name: "SpeakerHigh", component: SpeakerHighIcon },` в категории
  `{ id: "media", label: "Media", … }`.

**В `registry.ts` его нет**, и в `index.ts` его нет → импортировать как
`import { SpeakerHighIcon } from "@/components/icons"` **НЕЛЬЗЯ**.

### 10.2 Как добавить иконку в реестр (точно, по шагам)

1. `registry.ts` — добавить глиф в импорт из `@phosphor-icons/react` (список идёт в
   алфавитном порядке по имени глифа; `SpeakerHighIcon` там ещё не импортирован);
2. `registry.ts` — рядом с прочими `export const …Icon = createPhosphorIcon(…)`
   (блок идёт в основном по алфавиту по **имени экспорта**, с несколькими исключениями)
   добавить:

   ```typescript
   export const SpeakerHighIcon = createPhosphorIcon(SpeakerHighGlyphIcon)
   ```

   > Внимание: в `registry.ts` принято **алиасить глиф при импорте**, если его имя
   > совпадает с будущим экспортом, чтобы избежать коллизии имён, например
   > `CheckIcon as CheckmarkGlyphIcon`, `CopyIcon` → `CopyActionIcon`,
   > `WarningCircleIcon` → `AlertIcon`/`WarningIcon`. Поэтому глиф надо импортировать
   > как `SpeakerHighIcon as SpeakerHighGlyphIcon`, а экспортировать под именем
   > `SpeakerHighIcon` (это имя фигурирует в брифе и в `spec.md`).
3. `index.ts` — добавить имя в **большой блок `export { … } from "./registry"`**
   (блок отсортирован «примерно» по алфавиту; `SpeakerHighIcon` логично поставить
   рядом с `SparklesIcon` / `SquareShapeIcon`);
4. Если иконка нужна как *динамическая* (по строковому имени) — добавить ещё и в
   `iconRegistry` + в union `AppIconName` в `types.ts`. Для статической кнопки
   «Озвучить» это **не требуется**.

`icon-base.tsx` даёт `createPhosphorIcon` / `createReactIcon` и типы
`AppIconComponent`, `AppIconProps` (`types.ts`).

---

## 11. Frontend — локали

**Файлы (оба существуют):**
- `C:\Users\Андрей\Desktop\DIM\dim0\webui\src\locales\en.json` — 63 127 б, 1 554 строки
- `C:\Users\Андрей\Desktop\DIM\dim0\webui\src\locales\ru.json` — 91 093 б, 1 554 строки

**Текущий размер:** **1211 листовых ключей в каждом** (совпадает с таблицей в `I18N.md`).
Пустых значений в `ru.json` — 0.

**Формат — ВЛОЖЕННЫЕ ОБЪЕКТЫ (НЕ плоские ключи с точками).**
Схема: `область.компонент.смысл`, snake_case. Примеры из `en.json`:

```json
{
  "agent": {
    "copy": {
      "copied": "Answer copied to clipboard!",
      "current_answer": "Copy current answer to the clipboard",
      "label": "Copy"
    },
    "input": {
      "placeholder_ask": "Ask anything...",
      "send_failed": "Could not send message.",
      "start": "Start Deep Research"
    },
    "documents": {
      "added_one": "Added {{name}} — {{count}} passage ready to ask about.",
      "too_large": "PDF must be under {{size}} MB."
    }
  }
}
```

**23 top-level пространства** (одинаково в en и ru, в алфавитном порядке):

```
agent, auth, billing, board, charts, common, desktop, editor, errors,
harness, home, install, markdown, mini_app, newsfeed, not_found, offline,
progress, settings, share, sidebar, theme, widgets
```

**Порядок ключей:** файлы **отсортированы по алфавиту на каждом уровне** (по `I18N.md` §2 п.2:
«файл отсортирован по алфавиту»). Проверено программно: отсортированы все уровни, кроме
5 исключений (`agent.search_engine`, `harness.footer`, `harness.peer`, `harness.relative`,
`harness.toast`) — их не нужно повторять.

**Куда вставлять TTS-ключи.** Есть два согласованных места:

- **(а) Пространство `tts.*` на верхнем уровне** (по брифу: `tts.play`, `tts.stop`,
  `tts.loading`, `tts.error`, `tts.disabled`, + `tts.too_long` (413), `tts.unavailable` (502),
  `tts.empty` (400) — итого **восемь**).
  Тогда в `en.json`/`ru.json` добавляется **новый top-level блок `"tts": { … }`** —
  по алфавиту он встанет **между `theme` и `widgets`** (последние два: `theme`, `widgets`).
- **(б) Внутри существующего `agent.*`** — например `agent.tts.*` (в `agent` под-ключи идут
  по алфавиту: `chat, chat_history, code_result, context_board, copy, documents, input,
  local, memory, note_tool, save_note, search_engine, send, settings, sources,
  starter_prompts, synthesis, thinking, thought, tool, tool_confirm, tool_step, welcome` —
  `tts` встал бы между `tool_step` и `welcome`).

Спека (`spec.md` §Q05) говорит про «восемь ключей `tts.*`» — значит ожидается **отдельное
пространство `tts`**, вариант (а). `I18N.md` §2 требует: ключ — в `en.json` **и** `ru.json`,
пустое значение запрещено, значение = точная исходная строка.

**Проверка:** `npm run i18n:check` — падает, если ключ из `en` отсутствует в `ru` или
значение в `ru` пустое; `npm run i18n:check:strict` — дополнительно падает при
ru-only ключах. Скрипт: `webui/scripts/i18n-check.mjs`.

---

## 12. Frontend — `t()` и localStorage

**Файл:** `C:\Users\Андрей\Desktop\DIM\dim0\webui\src\i18n\index.ts`

Единственный инстанс i18next, экспортируется как `export { i18n }`:

```typescript
export const SUPPORTED_LANGS = ["en", "ru"] as const

export type Lang = (typeof SUPPORTED_LANGS)[number]

/** `localStorage` key holding the language the user picked explicitly. */
export const LANG_STORAGE_KEY = "dim0.lang"

const DEFAULT_LANG: Lang = "en"

const resources = {
  en: { translation: en as ResourceLanguage },
  ru: { translation: ru as ResourceLanguage },
}
```

**Форма JSON, который потребляет `t()`:** вложенные объекты; обращение — точечной нотацией
`t("agent.copy.label")`; интерполяция `{{name}}` (`interpolation: { escapeValue: false }`);
плюрализация через соседние суффиксы `_one/_few/_many/_other`.

**Чтение `localStorage["dim0.lang"]`** — точный код: **прямого `localStorage.getItem` в
`i18n/index.ts` нет**. Чтение делегировано детектору `i18next-browser-languagedetector`
через `lookupLocalStorage`:

```typescript
  const detection =
    forced === undefined
      ? {
          order: ["localStorage", "navigator"],
          caches: ["localStorage"],
          lookupLocalStorage: LANG_STORAGE_KEY,
        }
      : { order: [], caches: [] }
```

Запись — в `setLanguage`:

```typescript
export async function setLanguage(lang: Lang): Promise<void> {
  await initI18n()
  await i18n.changeLanguage(lang)
  try {
    globalThis.localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — the switch
    // still applies for the current session.
  }
  applyDocumentLang(lang)
}
```

**Образец для `dim0.tts.*`:** в проекте есть ровно такой шаблон для флагов — модуль
`webui/src/features/agent/local/vision-context-flag.ts` и `.../local-agent-flag.ts`:

```typescript
    return localStorage.getItem(KEY) !== "0"     // чтение
    else localStorage.setItem(KEY, "0")           // запись
```

Другие `dim0.*` ключи в проекте: `dim0.byok` (`features/agent/byok/byok-store.ts`),
`dim0.debug.agent` (`features/agent/engine/debug.ts`),
`dim0_local_agent_on_synced`, `dim0.theme` и др.

**Инициализация:** `initI18n()` идемпотентна, вызывается до первого рендера (в `src/main.tsx`);
`getLanguage()` возвращает текущий код; `applyDocumentLang` зеркалит язык в `<html lang>`.
Принудительный язык — `I18N_FORCE_LANG` / `VITE_I18N_FORCE_LANG`.

---

## 13. Frontend — package.json

**Файл:** `C:\Users\Андрей\Desktop\DIM\dim0\webui\package.json` (version `0.3.101`, `"type": "module"`)

Скрипты (точные):

```json
"dev": "dotenv -e ../${npm_config_envfile:-.env} -- vite",
"dev:mini-app": "dotenv -e ../${npm_config_envfile:-.env} -- vite --config vite.mini-app.config.ts",
"dev:tauri": "dotenv -e ../${npm_config_envfile:-.env} -- vite --port 1420 --strictPort",
"build": "dotenv -e ../${npm_config_envfile:-.env} -- vite build --config vite.mini-app.config.ts && dotenv -e ../${npm_config_envfile:-.env} -- tsc -b && dotenv -e ../${npm_config_envfile:-.env} -- vite build",
"build:mini-app": "dotenv -e ../${npm_config_envfile:-.env} -- vite build --config vite.mini-app.config.ts",
"lint": "eslint .",
"preview": "vite preview",
"preview:mini-app": "dotenv -e ../${npm_config_envfile:-.env} -- vite preview --config vite.mini-app.config.ts",
"tauri-dev": "npx tauri dev",
"tauri-build": "npx tauri build",
"type-check": "tsc -p tsconfig.app.json --noEmit",
"test": "vitest",
"test:run": "vitest run",
"test:cov": "vitest run --coverage",
"e2e": "playwright test",
"i18n:check": "node scripts/i18n-check.mjs",
"i18n:check:strict": "node scripts/i18n-check.mjs --strict",
"check-all": "npm run type-check && npm run lint"
```

> `check-all` = **type-check + eslint**. Тестов в него **не входит**.

**Тест-раннеры:**

- **vitest** (`^4.1.7`), конфиг `webui/vitest.config.ts`:
  - `environment: "jsdom"`,
  - `setupFiles: ["./src/test/setup.ts"]`,
  - `include: ["src/**/*.{test,spec}.{ts,tsx}", "mini-app-runtime/**/*.{test,spec}.{ts,tsx}"]`,
  - alias `@` → `./src`,
  - coverage: v8, `reportsDirectory: "./coverage"`.
  `webui/src/test/setup.ts` фиксирует `process.env.I18N_FORCE_LANG = "en"`,
  `localStorage["dim0.lang"] = "en"` и вызывает `initI18n()`.
- **playwright** (`@playwright/test ^1.61.1`), конфиг `webui/playwright.config.ts`:
  `testDir: "./e2e"`, `timeout: 30_000`, `expect.timeout: 10_000`,
  `fullyParallel: false`, `baseURL: "http://localhost:4321"`,
  `use.storageState: EN_STORAGE_STATE` (из `e2e/setup.ts`),
  `webServer: { command: "APP_PORT=4321 npm run dev", url: "http://localhost:4321", reuseExistingServer: true, timeout: 120_000 }`.
- Спеки в `webui/e2e/`: `i18n-ru.spec.ts`, `local.spec.ts`, `offline.spec.ts`,
  `parallel-search.spec.ts`, `theme.spec.ts` + `setup.ts`.

Релевантные зависимости: `sonner ^2.0.7` (тосты), `@phosphor-icons/react ^2.1.10`,
`i18next ^26.5.12`, `react-i18next ^17.1.9`, `i18next-browser-languagedetector ^8.2.4`,
`@tanstack/react-query ^5.83.0`, `clsx ^2.1.1`, `zod ^4.4.3`.

---

## 14. Compose

**Файл:** `C:\Users\Андрей\Desktop\DIM\dim0\build\docker-compose.yml` (12 566 б, 461 строка)

### 14.1 YAML-anchors (в самом верху файла, до `services:`)

```yaml
x-qdrant: &qdrant-base
  image: qdrant/qdrant:latest

x-postgres: &postgres-base
  image: postgres:15
  environment:
    POSTGRES_DB: topix
    POSTGRES_USER: topix
    POSTGRES_HOST_AUTH_METHOD: trust

x-redis: &redis-base
  image: redis:7-alpine
  command: redis-server --appendonly yes
```

Использование — через merge-ключ `<<: *anchor`:

```yaml
  postgres-local:
    <<: *postgres-base
    container_name: postgres-local
    profiles: ["local"]
```

> **Прецедента якоря для «сервиса-приложения» пока нет** — все три якоря — это образы
> инфраструктуры (БД). Для `silero-tts` понадобится **новый** якорь
> (например `x-silero: &silero-base`) либо описание сервиса один раз + `profiles: [local, dev, test, staging, prod]`.

### 14.2 `profiles`

Объявляются **списком строк** на уровне сервиса:

```yaml
    profiles: ["local"]
    profiles: ["dev"]
    profiles: ["test"]
    profiles: ["staging"]
    profiles: ["prod"]
```

Профили: `local`, `dev`, `test`, `staging`, `prod` (по одному на стадию).

### 14.3 `depends_on` — **списком** (не map-форма!)

Буквально:

```yaml
    depends_on:
      - postgres-local
      - qdrant-local
      - redis-local
```

```yaml
    depends_on:
      - backend-local
```

То есть в проекте **нет** ни одной map-формы `depends_on` и **нет** `condition: service_healthy`.
Сервисы `postgres-*`/`redis-*` объявляют `healthcheck:`, но он **никем не ожидается**
(нет `depends_on: { postgres: { condition: service_healthy } }`).

> **Следствие для TTS:** требование из брифа «`depends_on: silero-tts` с `condition: service_started`»
> **не совместимо** с текущим стилем файла (везде список). Придётся ввести **map-форму**
> в одном-двух местах либо отказаться от `condition` (просто `- silero-tts` в списке) —
> это первое отступление от конвенции файла, и его надо явно зафиксировать.

### 14.4 Пять backend-сервисов

| Сервис | `container_name` | `profiles` | `API_PORT` (по умолчанию) | Зависит от |
|---|---|---|---|---|
| `backend-local` | `backend-local` | `["local"]` | 8081 | `postgres-local`, `qdrant-local`, `redis-local` |
| `backend-dev` | `backend-dev` | `["dev"]` | 8081 | `postgres-dev`, `qdrant-dev`, `redis-dev` |
| `backend-test` | `backend-test` | `["test"]` | 8082 | `postgres-test`, `qdrant-test`, `redis-test` |
| `backend-staging` | `backend-staging` | `["staging"]` | 8083 | `postgres-staging`, `qdrant-staging`, `redis-staging` |
| `backend-prod` | `backend-prod` | `["prod"]` | 8084 | `postgres`, `qdrant`, `redis` |

### 14.5 Как backend получает env — **и** `environment:`, **и** `.env`-mount

Литеральный фрагмент `backend-local`:

```yaml
  # ---- Backend (LOCAL) ----
  backend-local:
    build:
      context: ..
      dockerfile: backend/Dockerfile
    container_name: backend-local
    profiles: ["local"]
    volumes:
      - ../${ENVFILE:-.env}:/.env:ro
      - backend_data_local:/app/data
    environment:
      DOPPLER_TOKEN: ${DOPPLER_TOKEN}
      API_HOST: 0.0.0.0
      API_PORT: ${API_PORT:-8081}
      QDRANT_HOST: ${QDRANT_HOST:-qdrant-local}
      QDRANT_PORT: ${QDRANT_PORT:-6333}
      POSTGRES_HOST: ${POSTGRES_HOST:-postgres-local}
      POSTGRES_PORT: ${POSTGRES_PORT:-5432}
      REDIS_HOST: ${REDIS_HOST:-redis-local}
      REDIS_PORT: ${REDIS_PORT:-6379}
    command: ["python","-m","topix.api.app","--stage","local"]
    depends_on:
      - postgres-local
      - qdrant-local
      - redis-local
    ports:
      - "${API_PORT:-8081}:${API_PORT:-8081}"
```

Итого два канала:
1. **volume-монтирование** `../${ENVFILE:-.env}:/.env:ro` — весь `.env` (включая `TTS_*`)
   попадает внутрь контейнера как `/app/.env`;
2. **блок `environment:`** — только явно перечисленные переменные с интерполяцией
   `${VAR:-default}` из `.env` хоста (compose сам читает `.env` из каталога compose-файла,
   т.е. `build/.env`; `${ENVFILE:-.env}` — оверрайд имени).

> **Для TTS:** чтобы переменная гарантированно доехала, её надо **и** добавить в
> `environment:` блок **всех пяти** `backend-<stage>` (как `TTS_ENABLED: ${TTS_ENABLED:-false}`),
> **и** описать в `.env.sample`. При этом монтирование `.env` в контейнер уже есть —
> если `topix/setup.py` читает `/app/.env` через `python-dotenv`, то `os.getenv("TTS_ENABLED")`
> подхватит значение и без правки `environment:`. **Это надо проверить в
> `backend/topix/setup.py` перед выбором.**

Прочие сервисы в compose: `qdrant-*`, `postgres-*`, `redis-*` (по 5 стадий),
`webui-local|dev|test|staging|prod`, `backend-*` (5).

Все имена томов перечислены в секции `volumes:` (низ файла) — по шаблону
`<service>_data_<stage>` и `backend_data_<stage>`. Для TTS понадобится
`silero_models` и/или `silero_audios`.

---

## 15. `.env.sample`

**Путь:** `C:\Users\Андрей\Desktop\DIM\dim0\.env.sample` — **87 строк**, 2 856 байт.
(Рядом лежит `.env` — такой же размер/длина, и `.env.signing.sample`.)

**Структура — плоский список `KEY=value`, разбитый на блоки комментариями** (без секций
`[...]`, без YAML). Фактические «заголовки» — комментарии-разделители:

```
DOPPLER_TOKEN=

API_PORT=8081
APP_PORT=5175
MINI_APP_PORT=5176

API_ORIGIN=http://localhost:${API_PORT}

VITE_API_URL=${API_ORIGIN}

# Mini-app sandboxed runtime origins (see mini-app-archi.md §6.1).
# Both bundles validate event.origin on incoming postMessage.
VITE_HOST_ORIGIN=http://localhost:${APP_PORT}
VITE_MINI_APP_ORIGIN=http://localhost:${MINI_APP_PORT}

# model providers API keys
# Set at least ONE of OPENAI_API_KEY or OPENROUTER_API_KEY — that alone powers
# chat, auto-model, and embeddings. OpenRouter unlocks every other model (and
# embeddings) without their native keys; native keys below are optional and
# preferred over OpenRouter when present.
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
MISTRAL_API_KEY=
OPENROUTER_API_KEY=
# for code execution
DAYTONA_API_KEY=
DAYTONA_API_URL=
DAYTONA_TARGET=
# Optional per-runtime-family sandbox images (selected by note language).
...
# for websearch
# one of the keys for image search should be set
LINKUP_API_KEY=
TAVILY_API_KEY=
PERPLEXITY_API_KEY=
# for unsplash image search
UNSPLASH_ACCESS_KEY=
# for web image search
SERPER_API_KEY=

POSTGRES_HOST=
POSTGRES_PORT=5432
QDRANT_HOST=
QDRANT_PORT=6333
REDIS_HOST=
REDIS_PORT=6379
REDIS_PASSWORD=

# For backend API JWT authentication
JWT_SECRET_KEY=

# Email + password reset (both flows use Resend.com).
...
APP_BASE_URL=http://localhost:${APP_PORT}
RESEND_API_KEY=
RESEND_FROM_EMAIL=

EMAIL_VERIFICATION_ENABLED=false
# EMAIL_VERIFICATION_TTL_HOURS=24

PASSWORD_RESET_ENABLED=false
# PASSWORD_RESET_TTL_HOURS=1

# Enable or disable tracing and logging
OPENAI_AGENTS_DISABLE_TRACING=
OPENAI_AGENTS_DONT_LOG_MODEL_DATA=
OPENAI_AGENTS_DONT_LOG_TOOL_DATA=

# Google sign-in (optional). ...
GOOGLE_CONNECT_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_DESKTOP_CLIENT_ID=
GOOGLE_DESKTOP_CLIENT_SECRET=
```

**Стиль документации переменной:** строка-комментарий-разделитель, ниже — комментарий с
объяснением (в т.ч. ссылка на документ), затем `KEY=` с пустым значением (или значением
по умолчанию). Закомментированные опциональные переменные пишутся с `#` в начале
(например `# EMAIL_VERIFICATION_TTL_HOURS=24`).

**Куда естественно вписать TTS-переменные:** новым блоком после блока
`GOOGLE_*` (в самом конце файла) либо рядом с блоком `POSTGRES/QDRANT/REDIS` (там же
живут инфраструктурные хосты-порты). Логичнее всего — **отдельный блок в конце** с
комментарием-разделителем `# Silero TTS (optional; off by default)` и описанием
`TTS_ENABLED`, `TTS_SERVICE_URL`, `TTS_VOICE`, `TTS_FORMAT`, `TTS_STREAMING`, `TTS_MODEL_URL`.
Значения по умолчанию — `${...:-...}`-стиля, как в compose, либо пустые `=`.

---

## 16. Команды (точные, из реальных конфигов)

Все команды — **из каталога, указанного в первой колонке**.

### Backend pytest (каталог `backend/`)

```bash
# один файл
uv run pytest test/unit/api/router/test_sharing_router.py
uv run pytest test/unit/api/router/test_tts_router.py

# весь unit-набор (то, что делает `make test-backend`)
uv run pytest test/unit

# весь набор из pytest.ini (testpaths = test) — включает integration, нужны живые БД
uv run pytest

# с покрытием (как `make test-backend-cov`)
uv run pytest test/unit --cov=topix --cov-report=xml --cov-report=term-missing:skip-covered
```

Эквивалент через Makefile (корень репо): `make test-backend` → `cd backend && uv run pytest test/unit`.

Замечание: есть локальный venv `backend/.venv` (Python 3.13.15) — можно и
`backend/.venv/Scripts/python.exe -m pytest …`, но конвенция репо — **uv**.

### Frontend (каталог `webui/`)

```bash
npm run check-all          # = npm run type-check && npm run lint
npm run i18n:check         # = node scripts/i18n-check.mjs
npm run i18n:check:strict  # = node scripts/i18n-check.mjs --strict
npm run type-check         # = tsc -p tsconfig.app.json --noEmit
npm run lint               # = eslint .

npx vitest run             # однократный прогон всех unit-тестов
npm run test:run           # то же самое (vitest run)

npx playwright test e2e/i18n-ru.spec.ts
npm run e2e                # = playwright test (все спеки)
```

Makefile-эквиваленты (корень): `make lint-ui` → `cd webui && npm run check-all`.

`npx playwright test e2e/i18n-ru.spec.ts` поднимает dev-сервер на `http://localhost:4321`
(автоматически, `reuseExistingServer: true`).

---

## 17. Итог: что это значит для реализации TTS

1. **Backend:** новый `backend/topix/api/router/tts.py` с `router = APIRouter(tags=["tts"])`
   (без префикса — путь будет `/tts`), подключить в `app.py` (`from topix.api.router import ... tts ...`
   + `app.include_router(tts.router)`). Эндпоинт **не** оборачивать в `with_standard_response`
   (он ломает бинарный ответ) — отдавать `Response(content=..., media_type="audio/wav")`,
   а ошибки — `HTTPException(status_code=..., detail="...")`.
2. **Авторизация:** `user_id: Annotated[str, Depends(get_current_user_uid)]` —
   импорт `from topix.api.utils.security import get_current_user_uid`.
3. **Env:** читать `TTS_*` через `os.getenv` (конвенция `config/config.py` — `model_post_init`)
   или добавить `TTSConfig` в `backend/topix/config/config.py`.
4. **Тест:** `backend/test/unit/api/router/test_tts_router.py` — приложение строится
   вручную `FastAPI()` + `app.include_router(router)` + `app.dependency_overrides[get_current_user_uid] = ...`,
   клиент — `fastapi.testclient.TestClient`; мок исходящего HTTP — `httpx.MockTransport`
   (прецедент `backend/test/unit/agents/test_parallel_search.py`).
5. **Frontend:** кнопка — новый `webui/src/features/agent/components/chat/actions/speak-answer.tsx`
   (по образцу `copy-answer.tsx`: `toast` из `sonner`, `Tooltip`/`TooltipTrigger`/`TooltipContent`
   из `@/components/ui/tooltip`, `t()` из `useTranslation()`), вставка одной строкой
   в `response-actions.tsx` рядом с `<CopyAnswer …/>`.
6. **Иконка:** `SpeakerHighIcon` есть только в `picker-set.ts` — его надо **завести**
   в `registry.ts` (`export const SpeakerHighIcon = createPhosphorIcon(...)`, глиф алиасить
   при импорте) и **пере-экспортировать** в `index.ts`.
7. **Локализация:** новый top-level блок `"tts"` в `en.json` и `ru.json` (между `theme` и `widgets`),
   7 ключей: `play`, `stop`, `loading`, `error`, `disabled`, `too_long`, `unavailable`.
   В `errors.ts` добавить `ENDPOINT_STATUS_KEYS["/tts"] = { 413: "tts.too_long", 502: "tts.unavailable", 503: "tts.disabled" }`.
8. **Ошибки на фронте:** `apiFetch` бросает plain `Error` **без** поля `status` — чтобы
   per-endpoint маппинг работал, нужен собственный класс ошибки с `status`/`endpoint`
   (прецедент `SendMessageError`) либо расширение `apiFetch`.
9. **Бинарь:** `apiFetch` на не-JSON ответе делает `res.text()` — для `audio/wav` он вернёт
   искажённую строку. Нужен `fetchWithAuthRaw` (`webui/src/api.ts`) либо отдельный fetch.
10. **Compose:** сервис `silero-tts` — новый YAML-anchor (прецедента для сервисов-приложений нет),
    `profiles` — список из 5 стадий, `depends_on` в текущем файле — **список**, map-форма с
    `condition: service_started` введёт первое отступление от конвенции.
11. **`.env.sample`:** 87 строк, плоский `KEY=value` с комментариями-разделителями — новый
    блок TTS в конце файла.
