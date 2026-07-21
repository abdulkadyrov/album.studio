# Архитектура Vakha Album Designer

## 1. Архитектурные цели

Архитектура должна одновременно обеспечить:

- полную локальность пользовательских данных;
- редактируемую объектную модель проекта;
- устойчивость при 30–50 страницах, 30 участниках, сотнях слоёв и больших фотографиях;
- независимость предметной модели от React, Fabric.js и конкретной версии IndexedDB schema;
- отдельный печатный рендер, не зависящий от размера экранного холста;
- возможность будущего встраивания editor package в Vakha Studio CRM без подключения CRM сейчас.

## 2. Архитектурный стиль

Приложение — клиентская React SPA/PWA с feature-oriented структурой и явными слоями:

```text
UI routes/components
        ↓ commands / queries
features + domain services
        ↓ typed repositories
Dexie / IndexedDB

domain page/layer model
        ↕ adapter
Fabric interactive canvas
        ↓ render snapshot
export pipeline / worker
```

Зависимости направлены внутрь:

- UI может зависеть от features, stores и UI-kit;
- features зависят от domain types, services и repository interfaces;
- infrastructure реализует repository interfaces;
- canvas зависит от domain DTO, но domain DTO не зависит от Fabric;
- export получает immutable render snapshot, а не читает живой UI state.

## 3. Основные архитектурные решения

### ADR-001. Web PWA как первая поставка

React/Vite PWA покрывает offline-first сценарий и настольный браузер без backend. Нативная упаковка не входит в MVP, но domain/canvas слои не должны зависеть от Service Worker, чтобы позднее их можно было разместить в desktop shell.

### ADR-002. Dexie — долговременный источник истины

Проекты, страницы, слои, настройки и бинарные ресурсы хранятся в IndexedDB через Dexie. Zustand хранит только активный working set, selection, history session и UI state. localStorage разрешён только для малых несущественных UI preferences, но предпочтительно настройки также хранить в Dexie.

### ADR-003. Собственная domain-модель вместо Fabric JSON

Fabric.js используется как interactive rendering engine. `Layer` и его варианты сериализуются в собственные Zod-валидируемые DTO. Fabric objects создаются factories/adapters и никогда не сохраняются как канонический формат проекта.

### ADR-004. Нормализованное хранение

Проект не сохраняется одним большим JSON после каждого движения. Projects, pages, layers, assets, participants и overrides хранятся отдельно. Изменение слоя обновляет одну запись и метаданные проекта в одной транзакции.

### ADR-005. Template + data + overrides

Персональная страница не копирует базовые слои. Resolver последовательно применяет:

```text
base template layer
→ resolved binding value for participant/project/class
→ participant-specific layer override
→ immutable render layer
```

Override содержит только изменившиеся свойства и ссылку на `layerId`.

### ADR-006. Экранный и печатный рендер разделены

Interactive canvas работает в логических координатах и с ограниченным pixel ratio. Export renderer строит новый snapshot в целевом размере по формуле `px = mm / 25.4 × DPI`. Скриншот UI или экранного canvas не является допустимым экспортом.

### ADR-007. Command transactions для истории

Один жест пользователя формирует одну reversible command. Pointer move обновляет preview, но history entry создаётся только на завершении gesture. История ограничивается по количеству и приблизительному размеру.

### ADR-008. Staged import

`.vsclass`, `.vsalbum`, шрифты и SVG сначала проверяются в памяти/временной области. Канонические таблицы изменяются только после успешной полной проверки и в одной Dexie transaction.

## 4. Точная структура каталогов

Структура создаётся постепенно; пустые каталоги и фиктивные модули заранее не добавляются.

```text
album.studio/
├── public/
│   ├── icons/
│   └── demo-assets/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── routes.ts
│   │   ├── providers/
│   │   │   ├── AppProviders.tsx
│   │   │   ├── DatabaseProvider.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   └── layout/
│   │       ├── AppShell.tsx
│   │       ├── AppSidebar.tsx
│   │       └── EditorShell.tsx
│   ├── features/
│   │   ├── projects/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── project.commands.ts
│   │   │   └── project.queries.ts
│   │   ├── templates/
│   │   ├── editor/
│   │   ├── pages/
│   │   ├── layers/
│   │   ├── text/
│   │   ├── images/
│   │   ├── frames/
│   │   ├── shapes/
│   │   ├── effects/
│   │   ├── participants/
│   │   ├── class-import/
│   │   ├── bindings/
│   │   ├── references/
│   │   ├── ideas/
│   │   ├── annotations/
│   │   ├── validation/
│   │   ├── export/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/
│   │   ├── dialogs/
│   │   ├── panels/
│   │   ├── forms/
│   │   └── feedback/
│   ├── canvas/
│   │   ├── engine/
│   │   │   ├── CanvasController.ts
│   │   │   ├── FabricAdapter.ts
│   │   │   └── viewport.ts
│   │   ├── objects/
│   │   │   ├── layer-object.factory.ts
│   │   │   └── object-layer.mapper.ts
│   │   ├── transformers/
│   │   ├── snapping/
│   │   ├── guides/
│   │   ├── history/
│   │   ├── serialization/
│   │   └── rendering/
│   ├── domain/
│   │   ├── project/
│   │   ├── page/
│   │   ├── layer/
│   │   ├── participant/
│   │   ├── template/
│   │   ├── binding/
│   │   ├── annotation/
│   │   ├── export/
│   │   └── shared/
│   ├── data/
│   │   ├── db/
│   │   │   ├── database.ts
│   │   │   ├── schema.ts
│   │   │   └── migrations/
│   │   ├── repositories/
│   │   ├── import-export/
│   │   │   ├── vsalbum/
│   │   │   ├── vsclass/
│   │   │   └── archive-safety/
│   │   └── fixtures/
│   ├── services/
│   │   ├── autosave-service.ts
│   │   ├── project-service.ts
│   │   ├── font-service.ts
│   │   ├── image-service.ts
│   │   ├── thumbnail-service.ts
│   │   ├── validation-service.ts
│   │   └── export-service.ts
│   ├── stores/
│   │   ├── editor-store.ts
│   │   ├── project-store.ts
│   │   ├── selection-store.ts
│   │   ├── history-store.ts
│   │   └── ui-store.ts
│   ├── workers/
│   │   ├── export.worker.ts
│   │   ├── archive.worker.ts
│   │   └── thumbnail.worker.ts
│   ├── i18n/
│   │   ├── ru.ts
│   │   └── types.ts
│   ├── types/
│   │   ├── brand.ts
│   │   └── utility.ts
│   ├── utils/
│   │   ├── dimensions.ts
│   │   ├── filenames.ts
│   │   ├── ids.ts
│   │   └── object-url-registry.ts
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── reset.css
│   │   └── globals.css
│   ├── test/
│   │   ├── setup.ts
│   │   ├── fixtures/
│   │   └── helpers/
│   ├── main.tsx
│   └── vite-env.d.ts
├── e2e/
│   ├── fixtures/
│   └── smoke.spec.ts
├── scripts/
│   └── verify-demo-archives.mjs
├── README.md
├── PLAN.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── DATA_FORMATS.md
├── TESTING.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── eslint.config.js
└── .prettierrc.json
```

Feature folders создают только при появлении реального кода. Общие компоненты перемещаются в `components/ui` после подтверждённого повторного использования, а не заранее.

## 5. Маршруты и shells

```text
/projects
/templates
/editor/:projectId
/projects/:projectId/import-class
/projects/:projectId/participants
/projects/:projectId/references
/projects/:projectId/ideas
/projects/:projectId/annotations
/projects/:projectId/validation
/projects/:projectId/export
/settings
```

`AppShell` используется для каталожных и служебных экранов. `EditorShell` выделяет максимум пространства холсту, сохраняет глобальную навигацию и добавляет editor top bar/tool rail/page strip/inspector. Route loaders проверяют существование проекта и показывают корректное локальное состояние ошибки.

## 6. Модель данных

Все сущности имеют `id`, `createdAt`, `updatedAt` в ISO 8601 UTC. Версии файлов и базы — целые положительные числа. Ниже приведён архитектурный минимум; окончательные типы закрепляются Zod-схемами рядом с domain-модулями.

### 6.1. Project

```ts
interface Project {
  id: string;
  name: string;
  albumTitle: string;
  school: { name: string; number?: string };
  classInfo: { name: string; letter?: string; academicYear: string; city?: string };
  pagePreset: PagePreset;
  dpi: number;
  bleedMm: number;
  safeZoneMm: number;
  templateId?: string;
  coverAssetId?: string;
  status: 'draft' | 'ready' | 'archived';
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

`Project` не содержит массивы страниц, слоёв и Blob. Они запрашиваются отдельно.

### 6.2. Page

```ts
type PageType =
  | 'cover'
  | 'student-personal'
  | 'teacher-personal'
  | 'class-group'
  | 'common'
  | 'final'
  | 'custom';

type RepeatFor = 'none' | 'students' | 'teachers' | 'allParticipants';

interface Page {
  id: string;
  projectId: string;
  templatePageId?: string;
  title: string;
  type: PageType;
  order: number;
  spreadId?: string;
  spreadSide?: 'left' | 'right';
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeZoneMm: number;
  repeatFor: RepeatFor;
  backgroundLayerId?: string;
  thumbnailAssetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

Разворот связывает две страницы через `spreadId`; он не уничтожает самостоятельность страниц для печатного экспорта.

### 6.3. Layer

```ts
type LayerType =
  | 'text'
  | 'image'
  | 'photo-frame'
  | 'shape'
  | 'background'
  | 'decoration'
  | 'svg'
  | 'group'
  | 'qr-code'
  | 'table'
  | 'guide';

interface LayerBase {
  id: string;
  projectId: string;
  pageId: string;
  parentId?: string;
  name: string;
  type: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: SupportedBlendMode;
  transform: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    rotationDeg: number;
    flipX: boolean;
    flipY: boolean;
  };
  zIndex: number;
  binding?: BindingRef;
  effects: LayerEffects;
  metadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

Конкретные варианты (`TextLayer`, `ImageLayer`, `PhotoFrameLayer` и т. д.) образуют discriminated union по `type`. Специфические поля не складываются в бесконтрольный `metadata`.

### 6.4. Asset

```ts
interface Asset {
  id: string;
  projectId?: string;
  ownerType: 'project' | 'template' | 'system' | 'user';
  kind: 'image' | 'thumbnail' | 'font' | 'svg' | 'decoration';
  filename: string;
  mimeType: string;
  byteSize: number;
  widthPx?: number;
  heightPx?: number;
  hash?: string;
  blob: Blob;
  sourceAssetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

Оригинал изображения хранится неизменным. Миниатюра ссылается на `sourceAssetId`. Hash может применяться для безопасной дедупликации, но не является обязательным идентификатором.

### 6.5. Participant и фотографии

```ts
interface Participant {
  id: string;
  projectId: string;
  externalId?: string;
  type: 'student' | 'teacher';
  firstName: string;
  lastName: string;
  middleName?: string;
  position?: string;
  status: ParticipantStatus;
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ParticipantPhoto {
  id: string;
  projectId: string;
  participantId: string;
  assetId: string;
  role: 'main' | 'additional';
  order: number;
}
```

ФИО для вывода вычисляется функциями binding resolver, а не хранится в нескольких рассинхронизируемых полях.

### 6.6. Binding

```ts
interface BindingRef {
  path: BindingPath;
  fallback?: string;
}
```

`BindingPath` — union поддерживаемых путей (`student.fullName`, `student.mainPhoto`, `class.name`, `project.academicYear` и т. д.). UI выбирает значение из каталога; произвольная строка не вводится.

### 6.7. Participant override

```ts
interface LayerOverride {
  id: string;
  projectId: string;
  participantId: string;
  pageId: string;
  layerId: string;
  patch: LayerOverridePatch;
  createdAt: string;
  updatedAt: string;
}
```

`LayerOverridePatch` — типизированный глубокий partial разрешённых изменяемых свойств. В patch запрещены identity-поля (`id`, `projectId`, `pageId`, `type`, timestamps). Удаление/скрытие экземпляра выражается явным override, а не удалением базового слоя.

### 6.8. Template

Template использует те же Page/Layer DTO с отдельным `ownerType`/`templateId`. При создании проекта выполняется контролируемое клонирование структуры с новыми ID и переиспользованием допустимых read-only assets. Пользовательский шаблон не может мутировать открытый проект и наоборот.

Для внешней генерации шаблонов вводится версионированный декларативный пакет: manifest, страницы/развороты, слои, локальные assets, шрифты, page type, `repeatFor` и bindings. Codex получает схему и локальные референсы, формирует этот пакет в рабочем репозитории, после чего приложение выполняет ту же строгую Zod-проверку, что и для ручного импорта. В приложение не встраивается OpenAI API, фотографии не отправляются в интернет, а результат генерации остаётся набором редактируемых объектов — плоское изображение допускается только как preview.

### 6.9. Reference, Idea и Annotation

Эти сущности нормализованы и связаны ID. Annotation хранит координаты в page mm, `pageId`, необязательные `layerId` и `participantId`, статус `open | in-progress | resolved`. Они не передаются в album render snapshot.

### 6.10. Export job/history

Export settings и результат сохраняются без бинарного содержимого итогового файла: участники, страницы, формат, DPI, warnings, время и status. Это позволяет фильтровать «неэкспортированных» и повторять настройки без хранения второго экземпляра большого архива.

## 7. Dexie schema

Предлагаемые таблицы v1:

```text
projects:          &id, updatedAt, name, status
pages:             &id, projectId, [projectId+order], templatePageId, spreadId
layers:            &id, pageId, projectId, [pageId+zIndex], parentId, type
assets:            &id, projectId, ownerType, kind, hash, sourceAssetId
templates:         &id, category, style, favorite, updatedAt
participants:      &id, projectId, [projectId+type], status, lastName
participantPhotos: &id, participantId, projectId, assetId
overrides:         &id, [participantId+pageId], layerId, projectId
references:        &id, projectId, favorite, category, updatedAt
ideas:             &id, projectId, status, updatedAt
annotations:       &id, projectId, pageId, layerId, participantId, status
settings:          &key
exportHistory:     &id, projectId, createdAt, status
```

Индексы уточняются на основе реальных запросов. Blob не индексируются. Миграции должны быть идемпотентными, тестироваться на fixture предыдущей версии и не выполнять длительный decode изображений внутри upgrade transaction.

## 8. Состояние и autosave

### Zustand stores

- `ui-store`: панели, модальные окна, view mode, notifications;
- `project-store`: метаданные активного проекта и save state;
- `editor-store`: active page/participant/edit mode/viewport/tool;
- `selection-store`: выбранные layer IDs и selection anchor;
- `history-store`: reversible commands текущей сессии.

Stores должны предоставлять узкие selectors. Крупные Blob и полные коллекции всех проектов в Zustand не помещаются.

### Save state machine

```text
saved → dirty → saving → saved
                  ↘ error
error → dirty/saving после следующего изменения или retry
```

Команды записывают domain changes через repository/service. Debounce объединяет частые безопасные обновления, но критические операции (создание проекта, импорт, завершение crop) используют явную transaction. `beforeunload` может предупреждать о незавершённой записи, но не считается единственным механизмом сохранения.

## 9. Canvas и координаты

Канонические размеры и позиции хранятся в миллиметрах. Внутренний canvas adapter преобразует их в logical pixels с фиксированным design scale. Zoom меняет viewport transform, а не физический размер layer DTO.

```ts
pixelsAtDpi = (millimeters / 25.4) * dpi;
```

Правила:

- расчёты mm/px изолированы в чистом протестированном utility;
- UI zoom не записывается в layer geometry;
- bleed, safe zone и spread center — editor overlays, не экспортируемые слои;
- guide — domain entity, но исключается из album render;
- snapping работает в page coordinates и получает threshold, пересчитанный из screen pixels;
- selection updates throttled для React, а canvas gesture остаётся плавным внутри controller.

## 10. История Undo/Redo

Команда содержит `do`, `undo`, label, affected entity IDs и приблизительный размер. Для transform хранится before/after snapshot только затронутых полей. Массовая операция — composite command. Persistence проекта и history session разделены: после перезапуска проект сохраняется, а history может очищаться.

Нельзя создавать запись истории на каждый pointer move. Gesture API:

```text
beginTransaction
preview updates
commitTransaction → one history entry + autosave
cancelTransaction → restore before state
```

## 11. Bindings и вычисление персональной страницы

Resolver получает:

- базовую страницу и слои;
- project/class context;
- participant и его photo records;
- overrides выбранного участника.

Он возвращает immutable `ResolvedPageSnapshot`. Missing binding сохраняет fallback и validation issue. Resolver не мутирует шаблон и не записывает resolved text обратно в базовый слой.

При редактировании:

- template mode формирует command над базовым layer;
- instance mode формирует/обновляет `LayerOverride`;
- UI всегда показывает текущий режим;
- попытка перейти к изменению template из instance context требует подтверждения.

## 12. Импорт `.vsclass` и `.vsalbum`

Pipeline:

1. Проверить общий compressed size до чтения.
2. Прочитать central directory и проверить количество/пути entries.
3. Отклонить абсолютные, пустые, дублирующиеся и traversal paths.
4. Проверить manifest, format и version.
5. Проверить JSON через Zod и cross-references отдельным validator.
6. Проверить magic bytes, расширения, MIME и размеры assets.
7. Санитизировать SVG и запретить external references.
8. Построить preview, warnings и import plan.
9. Получить выбранную стратегию конфликта.
10. Записать изменения атомарной Dexie transaction.

Лимиты должны быть централизованными настройками и покрыты тестами. Фактические значения выбираются после realistic fixture, а UI сообщает пользователю конкретное превышение.

## 13. Экспорт

### Render snapshot

Перед стартом создаётся immutable snapshot проекта, выбранных страниц, participants, assets metadata и settings. Это исключает изменение результата параллельным редактированием.

### Последовательность

```text
validate selection
→ estimate output/memory
→ resolve participant page
→ render one page at target DPI
→ encode PNG/JPEG or embed into real PDF page
→ release bitmap/canvas/object URLs
→ continue
→ package ZIP if required
→ download via explicit user action
```

Массовый экспорт ограничивает concurrency. Progress измеряется количеством завершённых page jobs. Отмена проверяется между этапами и освобождает временные ресурсы.

### PDF

Размер PDF page задаётся в points (`mm / 25.4 × 72`). В MVP допустим высококачественный raster page внутри настоящего PDF, если точны физический размер и DPI исходного render. Текстовая/vector оптимизация может добавляться позже, но не должна изменять внешний вид и шрифтовые метрики.

## 14. PWA и offline

Service Worker кэширует только versioned app shell и статические встроенные ресурсы. Пользовательские проекты/Blob остаются в IndexedDB и не дублируются Cache Storage. Update flow:

- обнаружить новую версию;
- показать ненавязчивое уведомление;
- применить обновление после завершения сохранения;
- перезагрузить с recovery screen при несовместимой ошибке;
- не очищать пользовательскую базу автоматически.

Приложение не делает analytics, preload внешних ресурсов или фоновые сетевые запросы.

## 15. UI architecture и доступность

Design tokens определяют поверхности, границы, текст, accent, status, spacing, radii, z-index и размеры панелей. Компоненты не используют произвольные несогласованные цвета.

Требования:

- semantic HTML на каталожных экранах;
- icon buttons имеют accessible name и tooltip;
- видимый `:focus-visible`;
- диалоги удерживают фокус только пока открыты и закрываются по Escape;
- опасные действия требуют подтверждения;
- editor shortcuts не перехватываются при наборе текста, кроме явно допустимых команд;
- disabled feature имеет `disabled`, пояснение и не содержит пустого handler.

## 16. Тестовая стратегия

### Unit

- dimensions/DPI;
- Zod schemas и migrations;
- layer serialization;
- binding resolver;
- template + data + overrides;
- filenames;
- validation rules;
- command history;
- archive path safety.

### Component

- layer panel;
- text properties;
- participant selection;
- class import preview;
- export settings;
- destructive confirmation;
- focus/keyboard behavior.

### Integration

- repositories на fake IndexedDB;
- autosave state transitions;
- database migrations;
- atomic import rollback;
- asset/original/thumbnail lifecycle.

### E2E

Критический путь из технического задания выполняется на Chromium. Для canvas interactions используются также domain assertions или сохранённый project snapshot, чтобы тест не зависел только от сравнения пикселей.

### Visual regression

Ключевые shells проверяются на 1440 × 900 и 1280 × 720. Скриншоты используются для layout regression, а не вместо функциональных assertions.

## 17. Производительные бюджеты

Бюджеты уточняются профилированием, но принимаются исходные цели:

- shell становится интерактивным без загрузки project originals;
- открытие проекта загружает metadata и текущую страницу, а не все full-size assets;
- pointer gesture не вызывает полную запись проекта;
- thumbnail decode и export не имеют неограниченной параллельности;
- Object URL имеет владельца и гарантированное `revoke`;
- realistic fixture: 30 participants, 40 pages, не менее 400 layers и набор high-resolution images;
- экспорт одной страницы освобождает крупные buffers перед переходом к следующей.

## 18. Безопасность и конфиденциальность

- Content Security Policy запрещает произвольные network destinations;
- обязательные runtime assets поставляются локально, без CDN;
- пользовательский SVG очищается и не исполняет код;
- названия файлов нормализуются и не создают пути;
- импорт имеет лимиты и staged validation;
- содержимое проектов и ФИО не записываются в console/error logs;
- demo data полностью вымышленны;
- destructive cleanup имеет явный scope и подтверждение;
- экспорт и backup запускаются явным действием пользователя.

## 19. Нерешённые вопросы без блокировки этапа 1

- точная стабильная версия Fabric.js фиксируется при начале canvas spike;
- окончательный синий или фиолетовый accent выбирается при визуальной проверке shell этапа 1;
- числовые лимиты архивов и фотографий задаются после realistic fixture;
- стратегия PDF font embedding подтверждается spike этапа 9;
- возможность worker-based render проверяется на целевых браузерах, с main-thread fallback и явным progress.

Эти вопросы не требуют backend и не изменяют базовую модель данных.
