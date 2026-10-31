# 01 — Ядро i18n, переключатель языка, тестовая обвязка

**Требования:** R05, R06, R07, R08, R09, R09.1, R10, R11, R11.1, R14, R16, R18, R22, R23, R24, R33, R34, R35, R39i, G05, G08, G10, G12, G13, G14, G17, G18, G19, G21, G31
**Зависит от:** —
**Зона:** `webui/src/i18n/` · `webui/src/locales/` · `webui/src/components/language-toggle.tsx` · `webui/src/components/sidebar/app-sidebar.tsx` · `webui/src/main.tsx` · `webui/mini-app-runtime/main.tsx` · `webui/src/features/mini-app/mount.tsx` · `webui/src/routes/index.ts` · `webui/src/lib/i18n/` · `webui/src/test/setup.ts` · `webui/scripts/` · `webui/e2e/setup.ts` · `webui/playwright.config.ts` · `webui/tsconfig.app.json` · `webui/package.json`
**Волна:** 1
**Ревью:** да — фундамент
**Модель:** сильная

## Что должно заработать

В `webui` стоят `i18next`, `react-i18next`, `i18next-browser-languagedetector`. Есть `src/i18n/index.ts`
с инициализацией, `src/locales/en.json` и `src/locales/ru.json`. Обе точки входа (`src/main.tsx` и
`src/features/mini-app/mount.tsx`) инициализируют i18n до первого рендера. В футере сайдбара рядом с
`ModeToggle` появляется компактный переключатель «English / Русский»; выбор пишется в
`localStorage['dim0.lang']`, `<html lang>` меняется вместе с ним. Тесты получают английский принудительно,
`npm run i18n:check` проверяет паритет ключей, `npm run build` проходит. Маппинг сетевых ошибок
(`errors.*`) готов к использованию, но строки экранов ещё не извлечены — это следующие таски.

## Из брифа, дословно

> «Установи в webui/ зависимости: `react-i18next`, `i18next`, `i18next-browser-languagedetector`»
> «Создай файл `webui/src/i18n.ts` (или `i18n/index.ts` — по конвенции проекта).»
> «Добавь переключатель языка в UI ... простой селектор EN / RU с сохранением выбора в localStorage.»
> «Playwright: в playwright.config.ts задай storageState с `{ "dim0.lang": "en" }` ... Плюс глобальный setup-файл»
> «Скрипт webui/scripts/i18n-check.mjs, без внешних зависимостей ... `i18n:check` и `i18n:check:strict`»

## Разделы спецификации

Истории 3, 4, 5, 6, 14, 18, 24, 27; Решения по реализации (библиотека, namespace, детект, `setLanguage`,
обе точки входа, тесты); `interfaces.md` модули 1–5.

## Критерии приёмки

- [ ] `cd webui && npm ls i18next react-i18next i18next-browser-languagedetector` показывает все три
- [ ] `src/i18n/index.ts` экспортирует `initI18n`, `i18n`, `setLanguage`, `getLanguage`, `SUPPORTED_LANGS`, `LANG_STORAGE_KEY`; `initI18n()` вызван в `main.tsx` и `mini-app-runtime/main.tsx` до `createRoot` (D01), JSON-локали импортированы статически при `resolveJsonModule` (D02)
- [ ] `LanguageToggle` стоит в футере `app-sidebar.tsx` рядом с `ModeToggle`; клик по «Русский» пишет `dim0.lang=ru` и ставит `document.documentElement.lang="ru"`; после перезагрузки язык сохраняется
- [ ] `src/lib/i18n/errors.ts` экспортирует `localizeApiError` и `apiErrorKey`; юнит-тест на известные статусы и дословный неизвестный `detail` зелёный (`npx vitest run src/lib/i18n/`)
- [ ] `src/test/setup.ts` ставит `dim0.lang=en` и `I18N_FORCE_LANG=en`; `npx vitest run` не знает о русском
- [ ] `playwright.config.ts` + `e2e/setup.ts` форсят `dim0.lang=en` для `http://localhost:4321`; существующие e2e зелёные
- [ ] `npm run i18n:check` и `npm run i18n:check:strict` существуют и на текущем скелете завершаются 0
- [ ] `npm run check-all` и `npm run build` зелёные; в `dist/` нет строки `capture-spike` и кода экрана (D03, DEV-only динамический маршрут)
- [ ] Husky не добавлен; ESLint-плагин i18next не добавлен
