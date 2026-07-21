# Testing and MVP release checks

## Быстрый локальный прогон

```bash
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

Для первого запуска Playwright:

```bash
npx playwright install chromium
```

## Фикстуры

Синтетические фикстуры лежат в `fixtures/`:

- `test-class.vsclass` — импорт класса без реальных данных;
- `large-project.fixture.json` — 40 страниц и 400 слоёв для профилирования.

Перегенерация:

```bash
npm run fixtures:generate
```

## Профилирование большого проекта

Сначала соберите и запустите production preview:

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

В другом терминале:

```bash
BASE_URL=http://127.0.0.1:4173 npm run profile:large
```

Скрипт записывает `test-results/large-project-profile.json` с количеством страниц/слоёв, временем
seed, открытием проверки и открытием экспорта. Если браузер отдаёт `performance.memory`, в отчёте
также появится heap snapshot.

## MVP regression path

Критический E2E-путь должен проходить на чистой базе и после актуализации фикстур:

1. открыть `/projects`;
2. создать/открыть проект и редактор;
3. проверить canvas transform, Undo/Redo и autosave;
4. проверить страницы, развороты, слои и группы;
5. проверить текст, overflow и пользовательский шрифт;
6. проверить изображения, crop, эффекты и рамки;
7. импортировать `fixtures/test-class.vsclass`;
8. проверить участников, статусы и фото;
9. проверить bindings и participant overrides;
10. запустить validation;
11. экспортировать PNG/PDF/ZIP и проверить физические размеры;
12. экспортировать/импортировать `.vsalbum`;
13. создать reference, idea и annotation;
14. экспортировать аннотации JSON/Markdown;
15. убедиться, что рабочие материалы не попадают в печатный рендер альбома.

Пункты 1–15 покрываются текущим `npm run test:e2e`; отдельные unit/component тесты закрывают
низкоуровневые инварианты схем, Object URL cleanup, PWA update prompt и безопасные ZIP/SVG проверки.

## PWA update/recovery

Ожидаемое поведение:

- приложение кэширует только версионированную оболочку и статические assets;
- пользовательские данные остаются в IndexedDB, не в Cache Storage;
- при доступном обновлении появляется prompt;
- кнопка «Обновить» вызывает `updateServiceWorker(true)`;
- закрытие prompt сбрасывает `needRefresh`, не перезагружая страницу.

Компонентный тест `PwaUpdatePrompt.test.tsx` фиксирует recovery flow без реального Service Worker.

## Memory/Object URL checks

Object URL создаются только через централизованные registry/loader участки и должны отзываться:

- при повторной регистрации того же asset;
- при `retain()` неиспользуемых asset;
- при `clear()`/dispose.

Регрессия покрыта `image-object-url-registry.test.ts`.

## Migration discipline

- Persisted DTO меняется только вместе с Zod-схемой и тестом старой/новой формы.
- IndexedDB version bump требует отдельного migration test на fixture предыдущей версии.
- File-format version bump требует обновления `DATA_FORMATS.md`, фикстур и import rejection tests.
- Fabric JSON не считается форматом проекта; сохраняется только собственный canvas document DTO.
