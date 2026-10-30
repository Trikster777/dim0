# 03 — Вход, настройки, установка, шаринг, ленты, виджеты

**Требования:** R12, R13, R16, R19, R31, R33, R37, G01, G02, G03, G04, G28, G33
**Зависит от:** 02
**Зона:** `webui/src/features/signin/` · `webui/src/components/password-input.tsx` · `webui/src/components/password-strength-meter.tsx` · `webui/src/components/auth-graph-texture.tsx` · `webui/src/features/user-settings/` · `webui/src/features/install/` · `webui/src/features/sharing/` · `webui/src/features/newsfeed/` · `webui/src/features/widgets/` · `webui/src/features/mini-app/` · `webui/src/locales/en.json`
**Волна:** 3
**Ревью:** нет
**Модель:** обычная

## Что должно заработать

Экраны входа, регистрации, восстановления пароля и подтверждения почты; настройки и биллинг
(«Billing Plans», строки лимитов); экран установки; диалог шаринга и лендинг по ссылке; лента
подписок и новостей; виджеты (погода — коды WMO и ошибки API); тосты mini-app. Всё через `t()`,
английские значения вербатим. Строки, которые приходят из бэкенда или из пользовательского iframe,
пробрасываются как есть.

## Из брифа, дословно

> «Для каждой строки: Придумай осмысленный ключ в нотации `snake_case` с группировкой по контексту ... Замени строку в .tsx на вызов `t('...')` через хук `useTranslation()`.»
> «Если в файле строка используется дважды с разным смыслом — делай два разных ключа»
> «кнопки — короткие глаголы, сообщения — вежливые, ошибки — понятные»

## Разделы спецификации

Истории 7, 8, 11, 22, 23; «Вне рамок» — текст из iframe mini-app.

## Критерии приёмки

- [ ] В перечисленных файлах пользовательские литералы заменены на `t()`; технические строки (`VITE_*`, URL, ключи) не тронуты
- [ ] `features/widgets/utils/weather.ts` отдаёт ключи погодных кодов, `t()` — в компоненте; при `ru` погода русская
- [ ] `en.json` пополнен блоками `auth.*`, `settings.*`, `billing.*`, `install.*`, `share.*`, `newsfeed.*`, `widgets.*`, `mini_app.*`
- [ ] Ошибки auth-экранов показываются через `localizeApiError`; неизвестный `detail` — дословно
- [ ] `npm run check-all` и `npm run i18n:check` зелёные
