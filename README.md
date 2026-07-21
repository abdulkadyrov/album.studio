# Vakha Album Designer

Профессиональный offline-first редактор выпускных альбомов. Проект создаётся как самостоятельное локальное приложение без CRM, backend, авторизации, аналитики и отправки пользовательских фотографий в интернет.

## Текущий статус

Завершён фундамент этапа 1:

- React, TypeScript и Vite;
- маршрутизация разделов;
- тёмная дизайн-система по утверждённым интерфейсным коллажам;
- App shell и Editor shell;
- IndexedDB через Dexie, schema v1;
- Zustand stores;
- PWA app shell и update prompt;
- ESLint, Prettier, Vitest, Testing Library и Playwright.

Canvas, импорт класса, bindings и экспорт альбомов намеренно ещё не реализованы. Их элементы интерфейса отключены и подписаны «Будет добавлено позже».

## Требования

- Node.js 22.12 или новее;
- npm 11 или совместимая версия.

## Установка и запуск

```bash
npm install
npm run dev
```

Vite выведет локальный адрес приложения. Начальный маршрут — `/projects`.

## Проверки

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm run format:check
```

Дополнительные команды:

```bash
npm run preview
npm run test:watch
npm run format
```

Для первого локального E2E-запуска может потребоваться установка браузера:

```bash
npx playwright install chromium
```

## Маршруты

- `/projects` — проекты;
- `/templates` — каталог шаблонов;
- `/editor/:projectId` — оболочка редактора;
- `/projects/:projectId/import-class` — импорт класса;
- `/projects/:projectId/participants` — участники;
- `/projects/:projectId/references` — референсы;
- `/projects/:projectId/ideas` — идеи;
- `/projects/:projectId/annotations` — аннотации;
- `/projects/:projectId/validation` — проверка;
- `/projects/:projectId/export` — экспорт;
- `/settings` — настройки.

## Локальное хранение и офлайн-режим

Dexie открывает базу `vakha-album-designer` в IndexedDB. PWA Service Worker кэширует только версионированную оболочку приложения и статические ресурсы. Пользовательские данные не дублируются в Cache Storage и не отправляются в сеть.

В настройках можно переключить фиолетовый или синий интерфейсный акцент. Выбор сохраняется в IndexedDB и восстанавливается после перезапуска.

## Архитектура и план

- [План разработки](./PLAN.md)
- [Архитектура](./ARCHITECTURE.md)
- [Roadmap](./ROADMAP.md)

Форматы `.vsclass` и `.vsalbum` будут документированы в `DATA_FORMATS.md` при реализации соответствующих этапов, чтобы документация отражала реально работающие схемы.
