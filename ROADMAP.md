# Roadmap Vakha Album Designer

## 1. Принцип roadmap

Разработка идёт последовательными, проверяемыми этапами. Следующий этап начинается только после завершения проверок предыдущего. Roadmap описывает порядок и контрольные точки; детальный объём и архитектура находятся в `PLAN.md` и `ARCHITECTURE.md`.

## 2. Карта зависимостей

```text
0 Анализ
└── 1 Фундамент
    └── 2 Canvas core
        └── 3 Layers & pages
            ├── 4 Text & fonts
            └── 5 Images & frames
                └── 6 Templates
                    └── 7 Class import & participants
                        └── 8 Bindings & personalization
                            └── 9 Validation & export
                                └── 10 References, ideas, annotations
                                    └── 11 Stabilization
```

Документация, accessibility, privacy и performance не откладываются полностью до этапа 11: соответствующие проверки входят в каждый этап.

## 3. Контрольные точки

### M0 — План готов

Статус: документация этапа 0 подготовлена.

Артефакты:

- `PLAN.md`;
- `ARCHITECTURE.md`;
- `ROADMAP.md`;
- анализ пустого репозитория;
- анализ двух утверждённых UI-коллажей;
- каталоговая структура и domain model;
- risk register.

Gate: явное принятие плана пользователем.

### M1 — Запускаемый offline shell

Ценность: приложение устанавливается локально, открывает все разделы и задаёт устойчивую основу разработки.

Инкременты:

1. Toolchain и npm scripts.
2. Design tokens и UI primitives.
3. AppShell/EditorShell и маршруты.
4. Dexie v1 + минимальные repositories.
5. Zustand session stores.
6. PWA shell/update state.
7. Unit/component/smoke E2E.

Gate:

- `typecheck`, `lint`, `test`, `build` проходят;
- `/projects`, `/templates`, `/settings` и project-scoped routes доступны;
- reload deep link не даёт белый экран;
- offline reload app shell работает после первичной загрузки;
- неготовые действия честно disabled;
- layout проверен на 1440 × 900 и 1280 × 720.

Рекомендуемая граница коммита: `feat: scaffold offline application foundation`.

### M2 — Редактируемый логический холст

Ценность: пользователь взаимодействует с объектами, а их состояние не зависит от экранного масштаба.

Инкременты:

1. Fabric adapter и object mapping spike.
2. mm/px utilities и page viewport.
3. Selection/transform/pan/zoom.
4. Grid/guides/safe/bleed overlays.
5. Command transactions и Undo/Redo.
6. Save/reload canvas state.

Gate: geometry round-trip и history tests проходят; transform одного объекта не сериализует весь проект.

Рекомендуемые границы коммитов:

- `feat: add logical canvas coordinate system`;
- `feat: add transactional canvas history`.

### M3 — Многостраничная объектная модель

Ценность: проект становится настоящим редактируемым альбомом.

Инкременты:

1. Pages/spreads commands.
2. Layer tree and ordering.
3. Lock/visibility/duplicate/delete.
4. Group/ungroup.
5. Page strip, keyboard navigation and thumbnails.
6. Autosave/reopen scenario.

Gate: E2E создаёт несколько страниц и восстанавливает порядок страниц/слоёв после reload.

### M4 — Полноценный текст

Ценность: пользователь создаёт типографику альбома и управляет шрифтами без скрытых замен.

Инкременты:

1. Text layer and inline edit.
2. Typography properties.
3. FontFace registry and IndexedDB font assets.
4. Missing-font workflow.
5. Overflow rules and validation.

Gate: пользовательский font asset работает после перезапуска; missing font виден как issue.

### M5 — Фотографии, рамки и визуальные элементы

Ценность: можно собрать базовую печатную страницу из оригинальных фотографий и независимых слоёв.

Инкременты:

1. Asset ingestion, metadata and thumbnails.
2. Image layer and nondestructive effects.
3. Photo-frame masks and crop state.
4. Shapes/decor/background.
5. Effective DPI validation.
6. Memory lifecycle tests.

Gate: оригинал сравним по hash/size до и после редактирования; crop/effects восстанавливаются из проекта.

### M6 — Шаблоны

Ценность: повторяемые стили страниц можно применять без разрушения исходника.

Инкременты:

1. Template domain/schema/repository.
2. Catalog, filters, favorite and preview.
3. Project from template.
4. User-created templates.
5. Template import/export.
6. Page types and repeatFor.

Gate: изменение проекта не меняет template fixture; системные и пользовательские шаблоны различимы.

### M7 — Класс и участники

Ценность: пользователь локально загружает подготовленный класс и управляет готовностью участников.

Инкременты:

1. `.vsclass` schemas and versioning.
2. Archive safety validator.
3. Preview and error report.
4. Transactional import/rollback.
5. Reimport conflict strategies.
6. Participants UI/status/filter/actions.

Gate: corrupted/traversal/oversized fixtures отклоняются без изменения проекта; valid fixture импортируется.

### M8 — Персональные экземпляры

Ценность: один шаблон порождает представления участников без тяжёлого копирования.

Инкременты:

1. Typed binding catalog and resolver.
2. Participant context switching.
3. Template edit mode.
4. Instance edit mode and layer overrides.
5. Autofill for repeatFor pages.
6. Conflict warnings and validation.

Gate: два участника используют одну base page; override первого не влияет на второго; размер данных растёт пропорционально изменениям, а не полной странице.

### M9 — Проверка и локальный экспорт

Ценность: пользователь получает реальные печатные файлы для выбранных участников.

Инкременты:

1. Validation rules and navigation to issue.
2. Export selection wizard.
3. High-resolution single-page PNG/JPEG.
4. Multi-page real PDF.
5. ZIP structure and filenames.
6. Progress/cancel/worker/memory limits.
7. `.vsalbum` archive, safe import and migrations.

Gate:

- pixel dimensions точны для preset/DPI;
- PDF signature и page physical sizes проверены;
- массовый export не загружает все страницы одновременно;
- отмена освобождает ресурсы;
- `.vsalbum` round-trip сохраняет редактируемые слои и originals.

### M10 — Творческие материалы и ревью

Ценность: референсы, идеи и комментарии живут рядом с проектом, не загрязняя печатный результат.

Инкременты:

1. References.
2. Ideas.
3. Canvas annotations.
4. Annotation statuses and navigation.
5. JSON/Markdown annotation export.
6. Render exclusion tests.

Gate: reference/annotation assets отсутствуют в album export, но присутствуют в `.vsalbum` backup согласно настройке формата.

### M11 — MVP release candidate

Ценность: полный критический путь надёжен на realistic project.

Работы:

- регрессионный unit/component/E2E suite;
- профиль памяти и скорости на большой fixture;
- IndexedDB and file-format migration drills;
- PWA update/recovery/offline checks;
- accessibility keyboard pass;
- security fixtures for ZIP/SVG;
- финальная документация;
- demo project и removable seed;
- проверка всех 35 критериев MVP.

Gate: нет TypeScript/ESLint/build/test ошибок, критический E2E проходит с чистой базой и после migration fixture.

## 4. Сквозные дорожки качества

### Privacy/offline

На каждом milestone проверяется отсутствие обязательных network requests. CSP и dependency review обновляются при добавлении новых библиотек.

### Accessibility

Каждый новый dialog, toolbar и form проходит keyboard/focus/accessible-name проверку в своём этапе.

### Data migrations

Изменение persistable DTO всегда сопровождается schema version/migration test; нельзя откладывать миграции на конец проекта.

### Performance

С M2 сохраняется realistic fixture. На M5 добавляются high-resolution images, на M8 — participants/overrides, на M9 — массовый экспорт.

### Documentation

README и format docs обновляются в том же этапе, где появляется пользовательская функция или формат.

## 5. Порядок ручной приёмки MVP

1. Установить зависимости и запустить приложение.
2. Проверить offline reload.
3. Создать проект и выбрать печатный preset.
4. Создать страницу и разворот.
5. Добавить/изменить текст и пользовательский шрифт.
6. Добавить фотографию, photoframe, crop, shape и фон.
7. Переставить, скрыть, заблокировать и сгруппировать слои.
8. Проверить Undo/Redo и горячие клавиши.
9. Перезагрузить и убедиться в autosave.
10. Экспортировать/импортировать `.vsalbum`.
11. Импортировать test `.vsclass`.
12. Проверить participants, bindings и autofill.
13. Создать instance override и убедиться, что другие участники не изменились.
14. Запустить validation и перейти к проблемному слою.
15. Выбрать участников и экспортировать PNG/JPEG/PDF/ZIP при 300 DPI.
16. Проверить physical/pixel dimensions и содержимое ZIP.
17. Создать reference, idea и annotation; убедиться, что они не попали в печатный рендер.

## 6. Ближайший шаг

Roadmap останавливается на gate M0. Для начала M1 требуется отдельная команда пользователя: «План принимаю. Начинай этап 1».
