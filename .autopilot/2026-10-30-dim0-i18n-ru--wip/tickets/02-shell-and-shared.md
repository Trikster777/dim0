# 02 — Каркас: сайдбар, тема, общие компоненты

**Требования:** R12, R13, R16, R19, R31, R33, R37, G01, G02, G03, G04, G28, G33
**Зависит от:** 01
**Зона:** `webui/src/components/sidebar/` · `webui/src/components/mode-toggle.tsx` · `webui/src/components/theme-constants.ts` · `webui/src/components/ui/` · `webui/src/components/not-found.tsx` · `webui/src/components/loading-view.tsx` · `webui/src/components/progress-bar.tsx` · `webui/src/components/markdown/` · `webui/src/components/charts/` · `webui/src/features/desktop/` · `webui/src/features/connection/offline-overlay.tsx` · `webui/src/features/home/` · `webui/src/locales/en.json`
**Волна:** 2
**Ревью:** нет
**Модель:** обычная

## Что должно заработать

Рамка приложения говорит по-русски: секции «WORKSPACE / SYNCED / LOCAL / SHARED WITH ME / CHATS»,
«View all chats», «Profile», «Upgrade Plan», «Logout», «Install app», диалоги чатов и подтверждения
удаления доски, пункты темы (Light / Dark / System и названия тем), sr-only подписи общих `ui`-компонентов,
офлайн-оверлей, экран «не найдено», браузерное окно десктопа (Minimize / Maximize / Restore / Close),
подписи графиков и стран в `components/charts`. При `en` всё остаётся байт-в-байт как было.

## Из брифа, дословно

> «Пройдись по всем .tsx / .ts файлам фронтенда и найди ВСЕ пользовательские строки (видимый текст, placeholder'ы, aria-label, tooltips, сообщения об ошибках, подтверждения, названия кнопок и меню).»
> «В каждом .tsx меняем ТОЛЬКО строковые литералы на вызовы t('...'). Разметку, пропсы, логику, импорты, порядок элементов — не трогаем.»
> «Английские значения в en.json копируй ВЕРБАТИМ из кода»

## Разделы спецификации

Истории 7, 8, 11, 22, 23.

## Критерии приёмки

- [ ] В перечисленных файлах не осталось пользовательских литералов вне `t()` (проверка грепом по `aria-label=`, `placeholder=`, `title=`, `alt=`, JSX-тексту)
- [ ] `MODES` и `THEMES` хранят ключи, `t()` вызывается при рендере; при `ru` подписи русские, при `en` — исходные
- [ ] `en.json` пополнен блоком `sidebar.*`, `theme.*`, `common.*`, `charts.*`; значения вербатим
- [ ] Переключение EN → RU меняет весь сайдбар и диалоги; обратно — возвращает исходный текст
- [ ] `npm run check-all` и `npm run i18n:check` зелёные
