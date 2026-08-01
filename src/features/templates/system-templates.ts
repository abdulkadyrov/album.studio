import {
  createDefaultImageStyle,
  createDefaultTextStyle,
  type CanvasDocument,
  type CanvasLayerSnapshot,
  type CanvasPageSnapshot,
} from '../../canvas/model/canvas-document';
import type {
  TemplateCategory,
  TemplateColor,
  TemplateManifest,
  TemplateStyle,
} from './template-schema';

interface Palette {
  background: string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
}

const createdAt = '2026-01-01T00:00:00.000Z';
const grade4NeutralPlaceholderAssetId = 'system-grade4-neutral-placeholder-v2';

function makePage(
  templateId: string,
  index: number,
  title: string,
  pageType: CanvasPageSnapshot['pageType'],
  repeatFor: CanvasPageSnapshot['repeatFor'] = 'none',
  spreadId?: string,
  spreadSide?: 'left' | 'right',
): CanvasPageSnapshot {
  return {
    id: `${templateId}:page-${index + 1}`,
    title,
    order: index,
    spreadId,
    spreadSide,
    widthMm: 200,
    heightMm: 280,
    bleedMm: 3,
    safeZoneMm: 5,
    gridStepMm: 5,
    pageType,
    repeatFor,
  };
}

function baseLayer(
  id: string,
  pageId: string,
  name: string,
  kind: CanvasLayerSnapshot['kind'],
  zIndex: number,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  fill: string,
): CanvasLayerSnapshot {
  return {
    id,
    pageId,
    name,
    kind,
    visible: true,
    locked: false,
    zIndex,
    xMm,
    yMm,
    widthMm,
    heightMm,
    rotationDeg: 0,
    fill,
    stroke: 'transparent',
    strokeWidthMm: 0,
    opacity: 1,
  };
}

function textLayer(
  templateId: string,
  pageId: string,
  index: number,
  content: string,
  xMm: number,
  yMm: number,
  widthMm: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
): CanvasLayerSnapshot {
  return {
    ...baseLayer(
      `${templateId}:${pageId}:text-${index}`,
      pageId,
      content,
      'text',
      20 + index,
      xMm,
      yMm,
      widthMm,
      Math.max(18, size * 0.55),
      color,
    ),
    text: {
      ...createDefaultTextStyle(),
      content,
      fontSizePt: size,
      minFontSizePt: Math.min(10, size),
      fontWeight: size >= 30 ? 'bold' : 'normal',
      textAlign: align,
      boxMode: 'auto',
      maxLines: undefined,
    },
  };
}

function photoFrame(
  templateId: string,
  pageId: string,
  index: number,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  fill: string,
  shape: 'rectangle' | 'rounded' | 'circle' = 'rectangle',
): CanvasLayerSnapshot {
  return {
    ...baseLayer(
      `${templateId}:${pageId}:frame-${index}`,
      pageId,
      `Фото ${index + 1}`,
      'frame',
      10 + index,
      xMm,
      yMm,
      widthMm,
      heightMm,
      fill,
    ),
    stroke: '#ffffff',
    strokeWidthMm: 0.8,
    image: {
      ...createDefaultImageStyle({
        assetId: `${templateId}:placeholder`,
        filename: 'Замените фотографию',
        mimeType: 'image/png',
        naturalWidthPx: 1600,
        naturalHeightPx: 2000,
      }),
      frameShape: shape,
    },
  };
}

function background(templateId: string, pageId: string, color: string) {
  return {
    ...baseLayer(
      `${templateId}:${pageId}:background`,
      pageId,
      'Фон',
      'rect',
      0,
      0,
      0,
      200,
      280,
      color,
    ),
    locked: true,
  } satisfies CanvasLayerSnapshot;
}

function createSystemTemplate(config: {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  style: TemplateStyle;
  color: TemplateColor;
  palette: Palette;
}): TemplateManifest {
  const { id, palette } = config;
  const spreadId = `${id}:spread-main`;
  const pages = [
    makePage(id, 0, 'Обложка', 'cover'),
    makePage(id, 1, 'Портрет', 'portrait', 'student', spreadId, 'left'),
    makePage(id, 2, 'Наш класс', 'class', 'none', spreadId, 'right'),
    makePage(id, 3, 'Финальная страница', 'closing'),
  ];
  const [cover, portrait, group, closing] = pages as [
    CanvasPageSnapshot,
    CanvasPageSnapshot,
    CanvasPageSnapshot,
    CanvasPageSnapshot,
  ];
  const layers: CanvasLayerSnapshot[] = [
    background(id, cover.id, palette.background),
    baseLayer(`${id}:cover-accent`, cover.id, 'Акцент', 'rect', 2, 0, 0, 34, 280, palette.accent),
    photoFrame(id, cover.id, 0, 52, 34, 126, 150, palette.surface, 'rounded'),
    textLayer(id, cover.id, 0, 'ВЫПУСКНОЙ\nАЛЬБОМ', 44, 198, 140, 35, palette.text),
    textLayer(id, cover.id, 1, '11 класс · 2026', 44, 246, 140, 14, palette.accent),

    background(id, portrait.id, palette.background),
    photoFrame(id, portrait.id, 0, 18, 24, 94, 166, palette.surface, 'rounded'),
    textLayer(id, portrait.id, 0, 'ИВАНОВА\nАЛЕКСАНДРА', 122, 40, 62, 25, palette.text),
    textLayer(id, portrait.id, 1, 'Выпускница 11-А', 122, 110, 62, 12, palette.accent),
    textLayer(id, portrait.id, 2, '«Будущее начинается с мечты»', 122, 150, 62, 11, palette.muted),
    baseLayer(
      `${id}:portrait-line`,
      portrait.id,
      'Линия',
      'rect',
      6,
      122,
      132,
      48,
      1.2,
      palette.accent,
    ),

    background(id, group.id, palette.background),
    textLayer(id, group.id, 0, 'НАШ КЛАСС', 18, 18, 164, 28, palette.text, 'center'),
    ...Array.from({ length: 12 }, (_, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      return photoFrame(
        id,
        group.id,
        index,
        18 + column * 42,
        58 + row * 62,
        34,
        46,
        palette.surface,
      );
    }),
    textLayer(id, group.id, 20, 'ШКОЛА №25 · МОСКВА', 18, 248, 164, 12, palette.accent, 'center'),

    background(id, closing.id, palette.background),
    textLayer(id, closing.id, 0, 'ЛУЧШИЕ ГОДЫ\nВМЕСТЕ', 24, 84, 152, 38, palette.text, 'center'),
    textLayer(id, closing.id, 1, '2026', 24, 180, 152, 42, palette.accent, 'center'),
  ];
  const portraitPhoto = layers.find((layer) => layer.id === `${id}:${portrait.id}:frame-0`);
  if (portraitPhoto) {
    portraitPhoto.binding = {
      source: 'participant',
      field: 'photoAssetId',
      fallback: `${id}:placeholder`,
    };
  }
  const portraitName = layers.find((layer) => layer.id === `${id}:${portrait.id}:text-0`);
  if (portraitName) {
    portraitName.binding = {
      source: 'participant',
      field: 'fullName',
      fallback: 'ИВАНОВА АЛЕКСАНДРА',
    };
  }
  const document: CanvasDocument = {
    version: 2,
    projectId: id,
    pages,
    layers,
    updatedAt: createdAt,
  };
  return {
    format: 'vakha-template',
    version: 1,
    template: {
      id,
      name: config.name,
      description: config.description,
      category: config.category,
      style: config.style,
      color: config.color,
      orientation: 'portrait',
      source: 'system',
      favorite: false,
      createdAt,
      updatedAt: createdAt,
    },
    document,
    assets: [],
  };
}

function decorativeLayer(
  templateId: string,
  pageId: string,
  id: string,
  name: string,
  kind: 'rect' | 'circle',
  zIndex: number,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  fill: string,
  opacity = 1,
  rotationDeg = 0,
  stroke = 'transparent',
  strokeWidthMm = 0,
): CanvasLayerSnapshot {
  return {
    ...baseLayer(
      `${templateId}:${pageId}:${id}`,
      pageId,
      name,
      kind,
      zIndex,
      xMm,
      yMm,
      widthMm,
      heightMm,
      fill,
    ),
    opacity,
    rotationDeg,
    stroke,
    strokeWidthMm,
  };
}

function tunedTextLayer(
  templateId: string,
  pageId: string,
  index: number,
  content: string,
  xMm: number,
  yMm: number,
  widthMm: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
  options: Partial<
    Pick<
      CanvasLayerSnapshot['text'],
      'fontFamily' | 'fontWeight' | 'fontStyle' | 'letterSpacingEm' | 'lineHeight' | 'textCase'
    >
  > = {},
): CanvasLayerSnapshot {
  const layer = textLayer(
    templateId,
    pageId,
    index,
    content,
    xMm,
    yMm,
    widthMm,
    size,
    color,
    align,
  );
  if (layer.text) {
    layer.text = {
      ...layer.text,
      ...options,
      content,
      boxMode: 'auto',
      maxLines: undefined,
      paddingMm: 0.8,
    };
  }
  return layer;
}

function createGrade4GeometryTemplate(): TemplateManifest {
  const id = 'system-grade4-geometry-2026';
  const paper = '#f7f7f4';
  const white = '#ffffff';
  const ink = '#202124';
  const muted = '#777b80';
  const yellow = '#f2ad16';
  const blue = '#6f9cc6';
  const paleBlue = '#dce8f1';
  const gray = '#c8cbce';
  const spreadEvents = `${id}:spread-events`;
  const spreadPortrait = `${id}:spread-portrait`;
  const pages = [
    makePage(id, 0, 'Обложка · 4 класс', 'cover'),
    makePage(id, 1, 'Школьная жизнь · левая', 'events', 'none', spreadEvents, 'left'),
    makePage(id, 2, 'Школьная жизнь · правая', 'events', 'none', spreadEvents, 'right'),
    makePage(id, 3, 'Выпускник · портрет', 'portrait', 'student', spreadPortrait, 'left'),
    makePage(id, 4, 'Выпускник · наш класс', 'portrait', 'student', spreadPortrait, 'right'),
    makePage(id, 5, 'Задняя обложка', 'closing'),
  ];
  const [cover, eventsLeft, eventsRight, portraitLeft, portraitRight, backCover] = pages as [
    CanvasPageSnapshot,
    CanvasPageSnapshot,
    CanvasPageSnapshot,
    CanvasPageSnapshot,
    CanvasPageSnapshot,
    CanvasPageSnapshot,
  ];

  const shape = (
    page: CanvasPageSnapshot,
    key: string,
    name: string,
    kind: 'rect' | 'circle',
    zIndex: number,
    xMm: number,
    yMm: number,
    widthMm: number,
    heightMm: number,
    fill: string,
    rotationDeg = 0,
    opacity = 1,
    stroke = 'transparent',
    strokeWidthMm = 0,
  ) =>
    decorativeLayer(
      id,
      page.id,
      key,
      name,
      kind,
      zIndex,
      xMm,
      yMm,
      widthMm,
      heightMm,
      fill,
      opacity,
      rotationDeg,
      stroke,
      strokeWidthMm,
    );

  const text = (
    page: CanvasPageSnapshot,
    index: number,
    name: string,
    content: string,
    xMm: number,
    yMm: number,
    widthMm: number,
    fontSizePt: number,
    color = ink,
    align: 'left' | 'center' | 'right' = 'left',
    options: Parameters<typeof tunedTextLayer>[10] = {},
  ) => {
    const layer = tunedTextLayer(
      id,
      page.id,
      index,
      content,
      xMm,
      yMm,
      widthMm,
      fontSizePt,
      color,
      align,
      { fontFamily: 'sans-serif', ...options },
    );
    layer.name = name;
    return layer;
  };

  const photo = (
    page: CanvasPageSnapshot,
    index: number,
    name: string,
    xMm: number,
    yMm: number,
    widthMm: number,
    heightMm: number,
    options: { rotation?: number; rounded?: boolean; shadow?: boolean } = {},
  ) => {
    const layer = photoFrame(
      id,
      page.id,
      index,
      xMm,
      yMm,
      widthMm,
      heightMm,
      '#e8ebed',
      options.rounded ? 'rounded' : 'rectangle',
    );
    layer.name = name;
    layer.rotationDeg = options.rotation ?? 0;
    layer.stroke = white;
    layer.strokeWidthMm = 1.2;
    layer.binding = {
      source: 'project',
      field: `commonPhotos.page${page.order + 1}.slot${index + 1}`,
      fallback: grade4NeutralPlaceholderAssetId,
    };
    if (layer.image) {
      layer.image.assetId = grade4NeutralPlaceholderAssetId;
      layer.image.filename = 'grade4-neutral-placeholder.svg';
      layer.image.mimeType = 'image/svg+xml';
      layer.image.naturalWidthPx = 2400;
      layer.image.naturalHeightPx = 3200;
      layer.image.cornerRadiusMm = options.rounded ? 2.5 : 0;
      layer.image.shadow = {
        enabled: options.shadow ?? true,
        color: '#202124',
        opacity: 0.18,
        blur: 7,
        offsetXmm: 1.2,
        offsetYmm: 1.8,
      };
    }
    return layer;
  };

  const magnifier = (page: CanvasPageSnapshot, prefix: string, x: number, y: number) => [
    shape(
      page,
      `${prefix}-ring`,
      'Декор · кольцо лупы',
      'circle',
      4,
      x,
      y,
      18,
      18,
      'transparent',
      0,
      1,
      ink,
      1.1,
    ),
    shape(
      page,
      `${prefix}-handle`,
      'Декор · ручка лупы',
      'rect',
      4,
      x + 15,
      y + 17,
      2.2,
      12,
      ink,
      -42,
    ),
  ];

  const triangle = (
    page: CanvasPageSnapshot,
    prefix: string,
    x: number,
    y: number,
    size: number,
    color: string,
    zIndex = 3,
  ) => [
    shape(
      page,
      `${prefix}-a`,
      'Декор · сторона треугольника',
      'rect',
      zIndex,
      x,
      y,
      size,
      1,
      color,
    ),
    shape(
      page,
      `${prefix}-b`,
      'Декор · сторона треугольника',
      'rect',
      zIndex,
      x,
      y,
      size,
      1,
      color,
      60,
    ),
    shape(
      page,
      `${prefix}-c`,
      'Декор · сторона треугольника',
      'rect',
      zIndex,
      x + size,
      y,
      size,
      1,
      color,
      120,
    ),
  ];

  const dottedArc = (
    page: CanvasPageSnapshot,
    prefix: string,
    cx: number,
    cy: number,
    radius: number,
    startDeg: number,
    endDeg: number,
    color: string,
  ) =>
    Array.from({ length: 12 }, (_, index) => {
      const angle = (startDeg + ((endDeg - startDeg) * index) / 11) * (Math.PI / 180);
      return shape(
        page,
        `${prefix}-${index + 1}`,
        'Декор · пунктирная дуга',
        'circle',
        3,
        cx + Math.cos(angle) * radius,
        cy + Math.sin(angle) * radius,
        1.1,
        1.1,
        color,
        0,
        0.8,
      );
    });

  const inkDots = (page: CanvasPageSnapshot, prefix: string, x: number, y: number, count: number) =>
    Array.from({ length: count }, (_, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const diameter = [1.2, 2.1, 1.5, 3.1, 1.1][index % 5]!;
      return shape(
        page,
        `${prefix}-${index + 1}`,
        'Декор · чернильная точка',
        'circle',
        5,
        x + column * 5.2 + (row % 2) * 2.1,
        y + row * 5.2,
        diameter,
        diameter,
        ink,
        0,
        0.88,
      );
    });

  const coverClass = text(cover, 0, 'Класс · цифра', '4', 26, 68, 100, 190, yellow, 'center', {
    fontWeight: '700',
    lineHeight: 0.8,
  });
  coverClass.binding = { source: 'class', field: 'gradeNumber', fallback: '4' };
  const coverLetter = text(cover, 1, 'Класс · буква', 'а', 108, 77, 58, 105, ink, 'left', {
    fontWeight: '300',
  });
  coverLetter.binding = { source: 'class', field: 'classLetter', fallback: 'а' };
  const coverSchool = text(cover, 2, 'Название школы', 'ШКОЛА', 46, 226, 108, 10, ink, 'center', {
    letterSpacingEm: 0.15,
  });
  coverSchool.binding = { source: 'class', field: 'schoolName', fallback: 'ШКОЛА' };
  const coverYear = text(cover, 3, 'Год выпуска', '2026', 46, 242, 108, 9, muted, 'center', {
    letterSpacingEm: 0.1,
  });
  coverYear.binding = { source: 'class', field: 'academicYear', fallback: '2026' };

  const eventPhotoSpecs = [
    [0, 'Общее фото класса', 18, 24, 164, 66, -1.2],
    [1, 'Событие · фото 1', 18, 102, 74, 72, 0.8],
    [2, 'Событие · фото 2', 102, 99, 80, 49, -0.8],
    [3, 'Событие · фото 3', 100, 157, 82, 56, 1.2],
    [4, 'Событие · фото 4', 18, 184, 74, 64, -1],
  ] as const;
  const leftEventPhotos = eventPhotoSpecs.map(([index, name, x, y, width, height, rotation]) =>
    photo(eventsLeft, index, name, x, y, width, height, { rotation }),
  );
  const eventTitle = text(
    eventsLeft,
    0,
    'Заголовок разворота',
    'НАША ШКОЛЬНАЯ ИСТОРИЯ',
    22,
    257,
    156,
    12,
    ink,
    'center',
    { fontWeight: '600', letterSpacingEm: 0.12 },
  );

  const rightEventPhotos = [
    photo(eventsRight, 0, 'Событие · фото 5', 16, 23, 78, 61, { rotation: 1 }),
    photo(eventsRight, 1, 'Событие · фото 6', 104, 24, 80, 86, { rotation: -0.8 }),
    photo(eventsRight, 2, 'Событие · фото 7', 16, 95, 78, 92, { rotation: -1.2 }),
    photo(eventsRight, 3, 'Событие · фото 8', 104, 122, 80, 62, { rotation: 1 }),
    photo(eventsRight, 4, 'Событие · фото 9', 16, 198, 168, 57, { rotation: -0.4 }),
  ];
  const rightEventCaption = text(
    eventsRight,
    0,
    'Подпись разворота',
    'ДРУЖБА · ОТКРЫТИЯ · ВОСПОМИНАНИЯ',
    26,
    261,
    148,
    8,
    muted,
    'center',
    { letterSpacingEm: 0.12 },
  );

  const portraitHero = photo(portraitLeft, 0, 'Главное фото выпускника', 42, 38, 122, 178, {
    rounded: false,
    shadow: true,
  });
  portraitHero.binding = {
    source: 'participant',
    field: 'photoAssetId',
    fallback: grade4NeutralPlaceholderAssetId,
  };
  const portraitName = text(
    portraitLeft,
    0,
    'ФИО выпускника',
    'ИМЯ ФАМИЛИЯ',
    30,
    228,
    140,
    20,
    ink,
    'center',
    { fontWeight: '700', letterSpacingEm: 0.08 },
  );
  portraitName.binding = {
    source: 'participant',
    field: 'fullName',
    fallback: 'ИМЯ ФАМИЛИЯ',
  };
  const portraitRole = text(
    portraitLeft,
    1,
    'Подпись выпускника',
    'ВЫПУСКНИК · 4 КЛАСС',
    44,
    254,
    112,
    8,
    muted,
    'center',
    { letterSpacingEm: 0.14 },
  );

  const rosterFrames = Array.from({ length: 18 }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const layer = photo(
      portraitRight,
      10 + index,
      `Фото одноклассника ${index + 1}`,
      18 + column * 58,
      29 + row * 39,
      39,
      27,
      { rounded: false, shadow: false },
    );
    layer.binding = {
      source: 'class',
      field: `students.${index + 1}.photoAssetId`,
      fallback: grade4NeutralPlaceholderAssetId,
    };
    return layer;
  });
  const rosterNames = Array.from({ length: 18 }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    return text(
      portraitRight,
      30 + index,
      `Имя одноклассника ${index + 1}`,
      'ИМЯ ФАМИЛИЯ',
      16 + column * 58,
      57 + row * 39,
      43,
      5.7,
      ink,
      'center',
      { fontWeight: '500', lineHeight: 0.9 },
    );
  });
  const rosterTitle = text(
    portraitRight,
    0,
    'Заголовок сетки класса',
    'МЫ ВМЕСТЕ',
    20,
    8,
    160,
    11,
    ink,
    'center',
    { fontWeight: '700', letterSpacingEm: 0.16 },
  );
  const rosterYear = text(
    portraitRight,
    1,
    'Год на сетке класса',
    '2026',
    70,
    264,
    60,
    8,
    muted,
    'center',
    { letterSpacingEm: 0.18 },
  );
  rosterYear.binding = { source: 'class', field: 'academicYear', fallback: '2026' };

  const backSchool = text(
    backCover,
    0,
    'Название школы · задняя обложка',
    'ШКОЛА',
    46,
    152,
    108,
    12,
    ink,
    'center',
    { fontWeight: '600', letterSpacingEm: 0.16 },
  );
  backSchool.binding = { source: 'class', field: 'schoolName', fallback: 'ШКОЛА' };
  const backClass = text(
    backCover,
    1,
    'Класс · задняя обложка',
    '4-А',
    64,
    93,
    72,
    46,
    yellow,
    'center',
    { fontWeight: '700' },
  );
  backClass.binding = { source: 'class', field: 'className', fallback: '4-А' };
  const backYear = text(
    backCover,
    2,
    'Год · задняя обложка',
    '2026',
    64,
    180,
    72,
    10,
    muted,
    'center',
    { letterSpacingEm: 0.14 },
  );
  backYear.binding = { source: 'class', field: 'academicYear', fallback: '2026' };

  const layers: CanvasLayerSnapshot[] = [
    background(id, cover.id, paper),
    ...triangle(cover, 'cover-triangle-top', 31, 54, 18, gray),
    ...magnifier(cover, 'cover-magnifier', 43, 28),
    ...dottedArc(cover, 'cover-dots', 129, 127, 29, -78, 72, muted),
    shape(
      cover,
      'cover-yellow-dash',
      'Декор · жёлтый штрих',
      'rect',
      4,
      121,
      35,
      4,
      18,
      yellow,
      34,
    ),
    shape(cover, 'cover-blue-dash', 'Декор · голубой штрих', 'rect', 4, 144, 63, 8, 25, blue, 38),
    shape(cover, 'cover-black-dash', 'Декор · чёрный штрих', 'rect', 4, 50, 168, 4, 22, ink, -52),
    ...inkDots(cover, 'cover-ink', 69, 176, 15),
    coverClass,
    coverLetter,
    text(cover, 4, 'Служебная подпись «класс»', 'КЛАСС', 22, 94, 24, 6.5, ink, 'center', {
      letterSpacingEm: 0.12,
    }),
    coverSchool,
    coverYear,

    background(id, eventsLeft.id, paper),
    shape(
      eventsLeft,
      'events-left-yellow',
      'Декор · жёлтая плашка',
      'rect',
      2,
      154,
      8,
      24,
      7,
      yellow,
      -8,
    ),
    shape(
      eventsLeft,
      'events-left-blue',
      'Декор · голубая плашка',
      'rect',
      2,
      8,
      146,
      25,
      6,
      blue,
      42,
    ),
    ...triangle(eventsLeft, 'events-left-triangle', 159, 224, 14, gray),
    ...dottedArc(eventsLeft, 'events-left-dots', 103, 142, 22, 200, 340, gray),
    ...leftEventPhotos,
    eventTitle,

    background(id, eventsRight.id, paper),
    shape(
      eventsRight,
      'events-right-yellow',
      'Декор · жёлтый угол',
      'rect',
      2,
      0,
      10,
      30,
      6,
      yellow,
      12,
    ),
    shape(
      eventsRight,
      'events-right-blue',
      'Декор · голубой штрих',
      'rect',
      2,
      172,
      182,
      6,
      28,
      blue,
      48,
    ),
    ...magnifier(eventsRight, 'events-right-magnifier', 160, 238),
    ...inkDots(eventsRight, 'events-right-ink', 9, 256, 8),
    ...rightEventPhotos,
    rightEventCaption,

    background(id, portraitLeft.id, paper),
    shape(
      portraitLeft,
      'portrait-left-yellow',
      'Декор · жёлтая плашка',
      'rect',
      2,
      18,
      24,
      44,
      9,
      yellow,
      -8,
    ),
    shape(
      portraitLeft,
      'portrait-left-blue',
      'Декор · голубая плашка',
      'rect',
      2,
      151,
      207,
      31,
      8,
      blue,
      42,
    ),
    ...triangle(portraitLeft, 'portrait-left-triangle', 15, 202, 19, gray),
    ...dottedArc(portraitLeft, 'portrait-left-dots', 166, 51, 20, -70, 75, muted),
    ...inkDots(portraitLeft, 'portrait-left-ink', 23, 232, 10),
    portraitHero,
    portraitName,
    portraitRole,

    background(id, portraitRight.id, paper),
    shape(
      portraitRight,
      'portrait-right-yellow',
      'Декор · жёлтая плашка',
      'rect',
      2,
      158,
      10,
      23,
      6,
      yellow,
      12,
    ),
    shape(
      portraitRight,
      'portrait-right-blue',
      'Декор · голубой плашка',
      'rect',
      2,
      8,
      254,
      27,
      6,
      blue,
      -36,
    ),
    shape(
      portraitRight,
      'portrait-right-wash',
      'Декор · светло-голубой фон',
      'rect',
      1,
      0,
      0,
      6,
      280,
      paleBlue,
    ),
    ...rosterFrames,
    ...rosterNames,
    rosterTitle,
    rosterYear,

    background(id, backCover.id, paper),
    ...magnifier(backCover, 'back-magnifier', 139, 43),
    ...triangle(backCover, 'back-triangle', 42, 53, 20, gray),
    ...dottedArc(backCover, 'back-dots', 105, 126, 36, -55, 65, muted),
    ...inkDots(backCover, 'back-ink', 82, 210, 15),
    shape(
      backCover,
      'back-blue-dash',
      'Декор · голубой штрих',
      'rect',
      3,
      54,
      194,
      6,
      24,
      blue,
      47,
    ),
    shape(
      backCover,
      'back-yellow-dash',
      'Декор · жёлтый штрих',
      'rect',
      3,
      132,
      72,
      5,
      18,
      yellow,
      31,
    ),
    backClass,
    backSchool,
    backYear,
  ];

  const document: CanvasDocument = {
    version: 2,
    projectId: id,
    pages,
    layers,
    updatedAt: createdAt,
  };

  return {
    format: 'vakha-template',
    version: 1,
    template: {
      id,
      name: '4-А · геометрия',
      description:
        'Оригинальный светлый альбом для 4 класса: крупная типографика, жёлто-голубой геометрический декор, событийный фотоколлаж и персональный разворот. Все элементы и фотографии редактируются отдельно.',
      category: 'grade-4',
      style: 'geometric',
      color: 'multicolor',
      orientation: 'portrait',
      source: 'codex',
      favorite: false,
      createdAt,
      updatedAt: createdAt,
    },
    document,
    assets: [
      {
        id: grade4NeutralPlaceholderAssetId,
        path: `assets/${grade4NeutralPlaceholderAssetId}`,
        filename: 'grade4-neutral-placeholder.svg',
        mimeType: 'image/svg+xml',
        kind: 'svg',
        byteSize: 1082,
        metadata: { widthPx: 2400, heightPx: 3200 },
      },
    ],
  };
}

function createReferenceMixTemplate(): TemplateManifest {
  const id = 'system-reference-mix-2026';
  const pages = [
    makePage(id, 0, 'Обложка · 2026', 'cover'),
    makePage(id, 1, 'Наш класс · левая', 'class', 'none', `${id}:spread-class`, 'left'),
    makePage(id, 2, 'Наш класс · правая', 'class', 'none', `${id}:spread-class`, 'right'),
    makePage(
      id,
      3,
      'Персональный портрет · левая',
      'portrait',
      'student',
      `${id}:spread-portrait`,
      'left',
    ),
    makePage(
      id,
      4,
      'Персональный портрет · правая',
      'portrait',
      'student',
      `${id}:spread-portrait`,
      'right',
    ),
    makePage(id, 5, 'Наши учителя · левая', 'teachers', 'teacher', `${id}:spread-teachers`, 'left'),
    makePage(id, 6, 'Наши учителя · правая', 'teachers', 'none', `${id}:spread-teachers`, 'right'),
    makePage(id, 7, 'Премия выпускников · левая', 'events', 'none', `${id}:spread-premium`, 'left'),
    makePage(
      id,
      8,
      'Премия выпускников · правая',
      'events',
      'student',
      `${id}:spread-premium`,
      'right',
    ),
    makePage(id, 9, 'Школьные будни · левая', 'events', 'none', `${id}:spread-story`, 'left'),
    makePage(id, 10, 'Школьные будни · правая', 'events', 'none', `${id}:spread-story`, 'right'),
    makePage(id, 11, 'Финальная страница', 'closing'),
  ];
  const [
    cover,
    classLeft,
    classRight,
    portraitLeft,
    portraitRight,
    teacherLeft,
    teacherRight,
    premiumLeft,
    premiumRight,
    storyLeft,
    storyRight,
    closing,
  ] = pages;
  const layers: CanvasLayerSnapshot[] = [
    background(id, cover.id, '#f4f1eb'),
    decorativeLayer(
      id,
      cover.id,
      'cover-spine',
      'Бордовый корешок',
      'rect',
      2,
      0,
      0,
      24,
      280,
      '#8f2930',
    ),
    decorativeLayer(
      id,
      cover.id,
      'cover-paper-a',
      'Бумажная плашка',
      'rect',
      3,
      32,
      26,
      124,
      210,
      '#ffffff',
      0.78,
      -3,
      '#ded8cf',
      0.4,
    ),
    decorativeLayer(
      id,
      cover.id,
      'cover-paper-b',
      'Светлая плашка',
      'rect',
      4,
      46,
      16,
      118,
      220,
      '#ebe9e4',
      0.82,
      2,
    ),
    decorativeLayer(
      id,
      cover.id,
      'cover-circle',
      'Мягкий круг',
      'circle',
      5,
      104,
      36,
      70,
      70,
      '#d8e2e6',
      0.55,
    ),
    photoFrame(id, cover.id, 0, 54, 46, 88, 118, '#cfd3d5', 'rounded'),
    tunedTextLayer(id, cover.id, 0, '20\n26', 42, 164, 76, 54, '#1d2228', 'left', {
      fontFamily: 'Georgia',
      fontWeight: 'normal',
      lineHeight: 0.85,
    }),
    tunedTextLayer(id, cover.id, 1, 'Выпускной', 82, 186, 86, 26, '#8f2930', 'left', {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontWeight: 'normal',
    }),
    tunedTextLayer(id, cover.id, 2, 'АЛЬБОМ', 84, 211, 72, 18, '#1d2228', 'left', {
      letterSpacingEm: 0.18,
      textCase: 'upper',
    }),
    tunedTextLayer(
      id,
      cover.id,
      3,
      '11-А класс · Школа №25',
      52,
      246,
      116,
      12,
      '#4d555d',
      'center',
    ),

    background(id, classLeft.id, '#f6f2eb'),
    decorativeLayer(
      id,
      classLeft.id,
      'blue-leaf-block',
      'Акварельный блок',
      'rect',
      1,
      0,
      178,
      54,
      102,
      '#d8e6ed',
      0.55,
    ),
    decorativeLayer(
      id,
      classLeft.id,
      'red-index',
      'Бордовый индекс',
      'rect',
      3,
      18,
      66,
      8,
      58,
      '#9f3039',
    ),
    tunedTextLayer(id, classLeft.id, 0, 'НАШ', 30, 28, 54, 18, '#29323a', 'left', {
      letterSpacingEm: 0.14,
      fontWeight: '600',
    }),
    tunedTextLayer(id, classLeft.id, 1, 'КЛАСС', 78, 28, 70, 18, '#9f3039', 'left', {
      letterSpacingEm: 0.12,
      fontWeight: '600',
    }),
    tunedTextLayer(
      id,
      classLeft.id,
      2,
      'люди, с которыми начинается история',
      30,
      49,
      112,
      10,
      '#6a7379',
      'left',
    ),
    ...Array.from({ length: 12 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return photoFrame(
        id,
        classLeft.id,
        index,
        30 + column * 46,
        76 + row * 45,
        34,
        36,
        '#e8ecee',
        'rounded',
      );
    }),
    ...Array.from({ length: 12 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return tunedTextLayer(
        id,
        classLeft.id,
        20 + index,
        'Имя\nФамилия',
        30 + column * 46,
        114 + row * 45,
        34,
        7.5,
        '#2f373d',
        'center',
        {
          lineHeight: 1,
        },
      );
    }),

    background(id, classRight.id, '#f6f2eb'),
    photoFrame(id, classRight.id, 0, 24, 30, 108, 146, '#e3e0db', 'rounded'),
    decorativeLayer(
      id,
      classRight.id,
      'right-blue-block',
      'Синий акцент',
      'rect',
      2,
      146,
      170,
      54,
      110,
      '#1f6f84',
      0.88,
    ),
    decorativeLayer(
      id,
      classRight.id,
      'right-red-line',
      'Вертикальный акцент',
      'rect',
      4,
      154,
      46,
      6,
      68,
      '#9f3039',
    ),
    tunedTextLayer(id, classRight.id, 0, 'НАШ\nКЛАСС', 145, 32, 38, 28, '#29323a', 'left', {
      fontWeight: '700',
      lineHeight: 0.95,
    }),
    tunedTextLayer(
      id,
      classRight.id,
      1,
      'самые важные кадры выпуска',
      145,
      100,
      42,
      10,
      '#69747a',
      'left',
    ),
    tunedTextLayer(id, classRight.id, 2, '2026', 147, 204, 44, 30, '#f3efe6', 'center', {
      fontFamily: 'Georgia',
    }),

    background(id, portraitLeft.id, '#f5f0e8'),
    decorativeLayer(
      id,
      portraitLeft.id,
      'portrait-navy',
      'Тёмная страница',
      'rect',
      1,
      0,
      0,
      200,
      280,
      '#102b36',
    ),
    decorativeLayer(
      id,
      portraitLeft.id,
      'portrait-dot-a',
      'Точки декора',
      'rect',
      2,
      142,
      30,
      34,
      1.2,
      '#d0b066',
      0.7,
    ),
    decorativeLayer(
      id,
      portraitLeft.id,
      'portrait-dot-b',
      'Точки декора',
      'rect',
      2,
      142,
      238,
      34,
      1.2,
      '#d0b066',
      0.7,
    ),
    photoFrame(id, portraitLeft.id, 0, 28, 30, 106, 176, '#eceff0', 'rounded'),
    tunedTextLayer(id, portraitLeft.id, 0, 'ВЫПУСКНИК', 144, 86, 38, 10, '#d0b066', 'left', {
      letterSpacingEm: 0.14,
    }),
    tunedTextLayer(id, portraitLeft.id, 1, '2026', 142, 104, 46, 28, '#edf2f2', 'left', {
      fontFamily: 'Georgia',
    }),
    tunedTextLayer(
      id,
      portraitLeft.id,
      2,
      'Время мечтать,\nверить в себя\nи строить планы\nна будущее',
      144,
      148,
      42,
      9.5,
      '#cdd9da',
      'left',
      {
        lineHeight: 1.28,
      },
    ),

    background(id, portraitRight.id, '#f6f2eb'),
    decorativeLayer(
      id,
      portraitRight.id,
      'botanical-wash',
      'Акварельная заливка',
      'rect',
      1,
      124,
      0,
      76,
      280,
      '#d8e6ed',
      0.5,
    ),
    decorativeLayer(
      id,
      portraitRight.id,
      'portrait-line',
      'Тонкая рамка',
      'rect',
      2,
      28,
      30,
      144,
      184,
      'transparent',
      1,
      0,
      '#c8b99b',
      0.45,
    ),
    photoFrame(id, portraitRight.id, 0, 42, 42, 68, 98, '#e4e5e2', 'rounded'),
    tunedTextLayer(
      id,
      portraitRight.id,
      0,
      'ИВАНОВ\nАЛЕКСАНДР\nСЕРГЕЕВИЧ',
      112,
      54,
      56,
      28,
      '#27313a',
      'center',
      {
        fontFamily: 'Georgia',
        fontWeight: '700',
        lineHeight: 1.06,
      },
    ),
    tunedTextLayer(
      id,
      portraitRight.id,
      1,
      '11-А класс\nШкола №25\n2026',
      118,
      128,
      44,
      11,
      '#27313a',
      'center',
      {
        lineHeight: 1.25,
      },
    ),
    tunedTextLayer(
      id,
      portraitRight.id,
      2,
      '«Каждый день — это новая история»',
      36,
      222,
      126,
      12,
      '#6a7379',
      'center',
      {
        fontStyle: 'italic',
      },
    ),
    decorativeLayer(
      id,
      portraitRight.id,
      'leaf-stem',
      'Ботаника линия',
      'rect',
      3,
      164,
      156,
      1,
      74,
      '#88aab2',
      0.7,
      16,
    ),
    decorativeLayer(
      id,
      portraitRight.id,
      'leaf-a',
      'Лист',
      'circle',
      4,
      154,
      172,
      12,
      22,
      '#88aab2',
      0.5,
      -28,
    ),
    decorativeLayer(
      id,
      portraitRight.id,
      'leaf-b',
      'Лист',
      'circle',
      4,
      170,
      194,
      10,
      20,
      '#88aab2',
      0.45,
      34,
    ),

    background(id, teacherLeft.id, '#102928'),
    tunedTextLayer(id, teacherLeft.id, 0, 'НАШИ УЧИТЕЛЯ', 24, 24, 152, 22, '#f2efe6', 'center', {
      fontFamily: 'Georgia',
      fontWeight: '700',
    }),
    tunedTextLayer(
      id,
      teacherLeft.id,
      1,
      'формулы, советы и большая поддержка',
      24,
      51,
      152,
      9,
      '#bfd0cc',
      'center',
    ),
    ...Array.from({ length: 8 }, (_, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      return photoFrame(
        id,
        teacherLeft.id,
        index,
        36 + column * 70,
        76 + row * 44,
        42,
        34,
        '#eff1ee',
        'rounded',
      );
    }),
    ...Array.from({ length: 8 }, (_, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      return tunedTextLayer(
        id,
        teacherLeft.id,
        20 + index,
        'Фамилия И.О.',
        36 + column * 70,
        112 + row * 44,
        42,
        7.5,
        '#f2efe6',
        'center',
      );
    }),
    tunedTextLayer(id, teacherLeft.id, 40, 'a² + b² = c²', 132, 224, 50, 13, '#7f9993', 'center', {
      fontFamily: 'Georgia',
      fontStyle: 'italic',
    }),

    background(id, teacherRight.id, '#102928'),
    tunedTextLayer(
      id,
      teacherRight.id,
      0,
      'Спасибо за знания,\nтерпение и веру в нас',
      22,
      36,
      84,
      25,
      '#f2efe6',
      'left',
      {
        fontFamily: 'Georgia',
        fontStyle: 'italic',
        lineHeight: 1.08,
      },
    ),
    photoFrame(id, teacherRight.id, 0, 116, 36, 56, 74, '#eff1ee', 'rounded'),
    photoFrame(id, teacherRight.id, 1, 26, 150, 64, 82, '#eff1ee', 'rounded'),
    photoFrame(id, teacherRight.id, 2, 102, 142, 70, 92, '#eff1ee', 'rounded'),
    decorativeLayer(
      id,
      teacherRight.id,
      'chalk-line-a',
      'Меловая линия',
      'rect',
      3,
      20,
      126,
      160,
      0.8,
      '#7f9993',
      0.75,
      -8,
    ),
    decorativeLayer(
      id,
      teacherRight.id,
      'chalk-line-b',
      'Меловая линия',
      'rect',
      3,
      120,
      18,
      0.8,
      222,
      '#7f9993',
      0.45,
      0,
    ),
    tunedTextLayer(id, teacherRight.id, 1, 'ШКОЛА №25', 40, 244, 120, 11, '#d0b066', 'center', {
      letterSpacingEm: 0.16,
    }),

    background(id, premiumLeft.id, '#100f12'),
    decorativeLayer(
      id,
      premiumLeft.id,
      'gold-stage',
      'Золотая дорожка',
      'rect',
      1,
      0,
      218,
      200,
      62,
      '#351a12',
      0.92,
    ),
    decorativeLayer(
      id,
      premiumLeft.id,
      'gold-line',
      'Золотая линия',
      'rect',
      2,
      0,
      214,
      200,
      2,
      '#c99b47',
    ),
    tunedTextLayer(
      id,
      premiumLeft.id,
      0,
      'ПРЕМИЯ\nВЫПУСКНИКОВ',
      24,
      30,
      116,
      32,
      '#f3e5c6',
      'left',
      {
        fontWeight: '700',
        lineHeight: 1,
        letterSpacingEm: 0.08,
      },
    ),
    photoFrame(id, premiumLeft.id, 0, 26, 102, 58, 76, '#22242b', 'rounded'),
    photoFrame(id, premiumLeft.id, 1, 98, 82, 74, 104, '#22242b', 'rounded'),
    tunedTextLayer(
      id,
      premiumLeft.id,
      1,
      'BEST CLASS\n2026',
      28,
      194,
      144,
      18,
      '#c99b47',
      'center',
      {
        letterSpacingEm: 0.12,
      },
    ),

    background(id, premiumRight.id, '#100f12'),
    tunedTextLayer(id, premiumRight.id, 0, 'НОМИНАЦИИ', 24, 24, 152, 18, '#f3e5c6', 'center', {
      fontWeight: '700',
      letterSpacingEm: 0.18,
    }),
    ...Array.from({ length: 9 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return photoFrame(
        id,
        premiumRight.id,
        index,
        28 + column * 50,
        58 + row * 56,
        38,
        44,
        '#22242b',
        'rounded',
      );
    }),
    ...Array.from({ length: 9 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return tunedTextLayer(
        id,
        premiumRight.id,
        20 + index,
        'Номинация',
        26 + column * 50,
        104 + row * 56,
        42,
        7.5,
        '#c99b47',
        'center',
      );
    }),
    tunedTextLayer(
      id,
      premiumRight.id,
      40,
      'каждый — главный герой',
      32,
      238,
      136,
      12,
      '#f3e5c6',
      'center',
      {
        fontStyle: 'italic',
      },
    ),

    background(id, storyLeft.id, '#f5f1ea'),
    tunedTextLayer(id, storyLeft.id, 0, 'ШКОЛЬНЫЕ БУДНИ', 24, 24, 152, 18, '#303741', 'center', {
      fontWeight: '700',
      letterSpacingEm: 0.12,
    }),
    photoFrame(id, storyLeft.id, 0, 22, 58, 78, 98, '#ddd9d0', 'rounded'),
    photoFrame(id, storyLeft.id, 1, 112, 58, 54, 42, '#ddd9d0', 'rounded'),
    photoFrame(id, storyLeft.id, 2, 112, 112, 54, 44, '#ddd9d0', 'rounded'),
    photoFrame(id, storyLeft.id, 3, 26, 176, 56, 42, '#ddd9d0', 'rounded'),
    photoFrame(id, storyLeft.id, 4, 94, 176, 78, 54, '#ddd9d0', 'rounded'),
    decorativeLayer(
      id,
      storyLeft.id,
      'film-strip',
      'Киноплёнка',
      'rect',
      2,
      10,
      46,
      6,
      198,
      '#cfc6b7',
      0.8,
    ),
    tunedTextLayer(
      id,
      storyLeft.id,
      1,
      'экскурсии · уроки · перемены · первые победы',
      28,
      246,
      144,
      10,
      '#69747a',
      'center',
    ),

    background(id, storyRight.id, '#f5f1ea'),
    tunedTextLayer(id, storyRight.id, 0, 'КАК ВСЁ\nНАЧИНАЛОСЬ', 24, 28, 84, 28, '#303741', 'left', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      lineHeight: 1.05,
    }),
    tunedTextLayer(id, storyRight.id, 1, '11 лет назад', 132, 35, 42, 9, '#69747a', 'right'),
    photoFrame(id, storyRight.id, 0, 38, 80, 42, 48, '#ddd9d0', 'rounded'),
    photoFrame(id, storyRight.id, 1, 92, 72, 78, 70, '#ddd9d0', 'rounded'),
    photoFrame(id, storyRight.id, 2, 38, 148, 132, 58, '#ddd9d0', 'rounded'),
    decorativeLayer(
      id,
      storyRight.id,
      'paper-note',
      'Бумажная заметка',
      'rect',
      2,
      24,
      64,
      152,
      160,
      '#ffffff',
      0.36,
      -3,
    ),
    tunedTextLayer(
      id,
      storyRight.id,
      2,
      'Каждый день — это маленькая история',
      30,
      230,
      136,
      10,
      '#69747a',
      'center',
    ),

    background(id, closing.id, '#f4f1eb'),
    decorativeLayer(
      id,
      closing.id,
      'closing-navy',
      'Тёмный блок',
      'rect',
      1,
      0,
      0,
      200,
      104,
      '#102b36',
    ),
    tunedTextLayer(id, closing.id, 0, 'ЛУЧШИЕ ГОДЫ\nВМЕСТЕ', 26, 44, 148, 34, '#f3efe6', 'center', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      lineHeight: 1.05,
    }),
    photoFrame(id, closing.id, 0, 28, 124, 144, 78, '#dcd8d0', 'rounded'),
    tunedTextLayer(id, closing.id, 1, '2026', 54, 214, 92, 42, '#9f3039', 'center', {
      fontFamily: 'Georgia',
    }),
    tunedTextLayer(
      id,
      closing.id,
      2,
      'до встречи на следующей странице жизни',
      32,
      258,
      136,
      10,
      '#69747a',
      'center',
    ),
  ];

  const portraitFrames = [`${id}:${portraitLeft.id}:frame-0`, `${id}:${portraitRight.id}:frame-0`];
  for (const layer of layers) {
    if (portraitFrames.includes(layer.id)) {
      layer.binding = {
        source: 'participant',
        field: 'photoAssetId',
        fallback: `${id}:placeholder`,
      };
    }
    if (layer.id === `${id}:${portraitRight.id}:text-0`) {
      layer.binding = {
        source: 'participant',
        field: 'fullName',
        fallback: 'ИВАНОВ АЛЕКСАНДР СЕРГЕЕВИЧ',
      };
    }
  }

  const document: CanvasDocument = {
    version: 2,
    projectId: id,
    pages,
    layers,
    updatedAt: createdAt,
  };
  return {
    format: 'vakha-template',
    version: 1,
    template: {
      id,
      name: 'Выпускной 2026 · микс референсов',
      description:
        'Большой редактируемый шаблон с обложкой и разворотами: минимализм, ботаника, школьная доска, тёмный премиум и фотоколлажи.',
      category: 'grade-11',
      style: 'modern',
      color: 'multicolor',
      orientation: 'portrait',
      source: 'system',
      favorite: false,
      createdAt,
      updatedAt: createdAt,
    },
    document,
    assets: [],
  };
}

function createSpbMarbleTemplate(): TemplateManifest {
  const id = 'system-spb-marble-2025';
  const pageTitles = [
    ['Обложка', 'cover'],
    ['Портрет ученика', 'portrait'],
    ['Наша группа', 'group'],
    ['Наши друзья', 'group'],
    ['Руководитель', 'teachers'],
    ['Пожелания', 'universal'],
    ['Учителя', 'teachers'],
    ['Портрет выпускника', 'portrait'],
    ['Достижения', 'events'],
    ['Спорт', 'events'],
    ['Творчество', 'events'],
    ['Прогулки по Петербургу', 'events'],
    ['Классный коллаж', 'class'],
    ['Лучшие моменты', 'events'],
    ['Финальный разворот', 'closing'],
    ['Последняя страница', 'closing'],
  ] as const;
  const pages = pageTitles.map(([title, pageType], index) =>
    makePage(id, index, title, pageType, pageType === 'portrait' ? 'student' : 'none'),
  );
  const page = (index: number) => pages[index]!;
  const green = '#243522';
  const text = '#465140';
  const marble = '#f5f4ef';
  const photo = '#c9c9c9';

  const marbleBackground = (canvasPage: CanvasPageSnapshot, pageNumber?: number) => [
    background(id, canvasPage.id, marble),
    decorativeLayer(
      id,
      canvasPage.id,
      'marble-wash-left',
      'Мраморная заливка',
      'rect',
      1,
      0,
      0,
      40,
      280,
      '#e9e7df',
      0.65,
    ),
    decorativeLayer(
      id,
      canvasPage.id,
      'marble-wash-top',
      'Мраморная заливка',
      'rect',
      1,
      0,
      0,
      200,
      42,
      '#ffffff',
      0.55,
    ),
    ...Array.from({ length: 7 }, (_, index) =>
      decorativeLayer(
        id,
        canvasPage.id,
        `marble-vein-${index}`,
        'Мраморная прожилка',
        'rect',
        2,
        12 + index * 27,
        26 + (index % 3) * 48,
        0.45,
        132,
        index % 2 ? '#aeb3ad' : '#d8d5cf',
        0.34,
        index % 2 ? 36 : -42,
      ),
    ),
    decorativeLayer(
      id,
      canvasPage.id,
      'trim-ready',
      'Граница готового изделия',
      'rect',
      3,
      3,
      3,
      194,
      274,
      'transparent',
      1,
      0,
      '#d55b4b',
      0.35,
    ),
    decorativeLayer(
      id,
      canvasPage.id,
      'safe-zone',
      'Безопасная зона',
      'rect',
      3,
      13,
      10,
      174,
      260,
      'transparent',
      1,
      0,
      '#6aa060',
      0.32,
    ),
    ...(pageNumber
      ? [
          decorativeLayer(
            id,
            canvasPage.id,
            'page-number-block',
            'Номер страницы',
            'rect',
            30,
            174,
            258,
            12,
            14,
            green,
          ),
          tunedTextLayer(
            id,
            canvasPage.id,
            96,
            String(pageNumber).padStart(2, '0'),
            175,
            260,
            10,
            9,
            '#f5f4ef',
            'center',
          ),
        ]
      : []),
  ];

  const pageLabel = (canvasPage: CanvasPageSnapshot, caption: string, right = false) => [
    decorativeLayer(
      id,
      canvasPage.id,
      'label',
      'Зелёная плашка раздела',
      'rect',
      20,
      right ? 142 : 0,
      8,
      right ? 58 : 66,
      10,
      green,
    ),
    tunedTextLayer(
      id,
      canvasPage.id,
      90,
      caption,
      right ? 146 : 16,
      9.5,
      right ? 44 : 46,
      8,
      '#f5f4ef',
      'center',
    ),
  ];

  const citySketch = (
    canvasPage: CanvasPageSnapshot,
    xMm: number,
    yMm: number,
    accent = '#789b9a',
  ) => [
    decorativeLayer(
      id,
      canvasPage.id,
      'city-wash',
      'Акварель под рисунком',
      'circle',
      8,
      xMm,
      yMm,
      42,
      34,
      accent,
      0.22,
    ),
    tunedTextLayer(id, canvasPage.id, 91, 'СПБ', xMm + 12, yMm + 8, 22, 18, green, 'center', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      letterSpacingEm: 0.08,
    }),
    decorativeLayer(
      id,
      canvasPage.id,
      'city-line-a',
      'Архитектурная линия',
      'rect',
      9,
      xMm + 6,
      yMm + 26,
      46,
      0.7,
      green,
      0.45,
      -18,
    ),
    decorativeLayer(
      id,
      canvasPage.id,
      'city-line-b',
      'Архитектурная линия',
      'rect',
      9,
      xMm + 16,
      yMm + 18,
      32,
      0.7,
      green,
      0.45,
      28,
    ),
  ];

  const portraitPage = (canvasPage: CanvasPageSnapshot, pageNumber: number, heading: string) => [
    ...marbleBackground(canvasPage, pageNumber),
    ...pageLabel(canvasPage, heading),
    photoFrame(id, canvasPage.id, 0, 46, 32, 104, 156, photo, 'rectangle'),
    tunedTextLayer(id, canvasPage.id, 0, 'ФАМИЛИЯ', 46, 200, 96, 16, text, 'left', {
      fontFamily: 'Georgia',
      fontWeight: 'normal',
    }),
    tunedTextLayer(id, canvasPage.id, 1, 'Имя  Отчество', 46, 217, 96, 14, text, 'left', {
      fontFamily: 'Georgia',
    }),
    ...citySketch(canvasPage, 128, 202),
  ];

  const collagePage = (
    canvasPage: CanvasPageSnapshot,
    pageNumber: number,
    heading: string,
    frames: Array<[number, number, number, number]>,
    quote?: string,
  ) => [
    ...marbleBackground(canvasPage, pageNumber),
    ...pageLabel(canvasPage, heading, pageNumber % 2 === 1),
    ...frames.map(([x, y, w, h], index) =>
      photoFrame(id, canvasPage.id, index, x, y, w, h, photo, 'rectangle'),
    ),
    ...(quote
      ? [
          tunedTextLayer(id, canvasPage.id, 10, quote, 62, 130, 80, 12, text, 'center', {
            fontFamily: 'serif',
            fontStyle: 'italic',
            lineHeight: 1.1,
          }),
        ]
      : []),
  ];

  const teacherGrid = (canvasPage: CanvasPageSnapshot, pageNumber: number) => [
    ...marbleBackground(canvasPage, pageNumber),
    ...pageLabel(canvasPage, 'Учителя'),
    ...Array.from({ length: 6 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return photoFrame(
        id,
        canvasPage.id,
        index,
        24 + column * 54,
        34 + row * 104,
        42,
        66,
        photo,
        'rectangle',
      );
    }),
    ...Array.from({ length: 6 }, (_, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      return tunedTextLayer(
        id,
        canvasPage.id,
        20 + index,
        'Фамилия\nИмя Отчество\nпредмет',
        24 + column * 54,
        103 + row * 104,
        42,
        8.5,
        text,
        'center',
        {
          lineHeight: 1.05,
        },
      );
    }),
  ];

  const layers: CanvasLayerSnapshot[] = [
    background(id, page(0).id, green),
    decorativeLayer(id, page(0).id, 'cover-spine', 'Корешок', 'rect', 2, 0, 0, 96, 280, '#1f301f'),
    decorativeLayer(
      id,
      page(0).id,
      'cover-safe',
      'Безопасная зона',
      'rect',
      3,
      12,
      15,
      176,
      250,
      'transparent',
      1,
      0,
      '#5d8758',
      0.35,
    ),
    decorativeLayer(
      id,
      page(0).id,
      'cover-seam-a',
      'Линия корешка',
      'rect',
      4,
      96,
      0,
      0.6,
      280,
      '#97a58e',
      0.7,
    ),
    decorativeLayer(
      id,
      page(0).id,
      'cover-seam-b',
      'Линия корешка',
      'rect',
      4,
      103,
      0,
      0.6,
      280,
      '#97a58e',
      0.55,
    ),
    tunedTextLayer(id, page(0).id, 0, 'Вы\nпус\nк', 106, 48, 74, 86, '#f5f4ef', 'center', {
      fontFamily: 'Georgia',
      fontSizePt: 70,
      lineHeight: 0.82,
    }),
    tunedTextLayer(id, page(0).id, 1, '2025', 160, 104, 18, 25, '#f5f4ef', 'center', {
      fontFamily: 'Georgia',
      letterSpacingEm: 0.08,
    }),
    tunedTextLayer(id, page(0).id, 2, 'Санкт-Петербург', 122, 248, 56, 10, '#f5f4ef', 'center'),

    ...portraitPage(page(1), 1, 'Выпускник'),
    ...collagePage(
      page(2),
      2,
      'Наша группа',
      [
        [30, 34, 128, 82],
        [28, 132, 74, 96],
        [110, 154, 62, 74],
      ],
      'Славные времена,\nпроведённые вместе',
    ),
    ...collagePage(
      page(3),
      3,
      'Наша группа',
      [
        [30, 34, 76, 100],
        [112, 28, 60, 108],
        [30, 162, 76, 66],
        [116, 148, 56, 82],
      ],
      'Спасибо за подаренное\nвдохновение!',
    ),
    ...portraitPage(page(4), 4, 'Руководитель'),
    ...marbleBackground(page(5), 5),
    ...pageLabel(page(5), 'Пожелания', true),
    decorativeLayer(
      id,
      page(5).id,
      'wish-paper',
      'Поле для пожеланий',
      'rect',
      6,
      26,
      36,
      148,
      200,
      '#ffffff',
      0.62,
    ),
    ...Array.from({ length: 22 }, (_, index) =>
      decorativeLayer(
        id,
        page(5).id,
        `wish-line-${index}`,
        'Строка пожеланий',
        'rect',
        7,
        33,
        48 + index * 8,
        134,
        0.28,
        '#bfc5bd',
        0.75,
      ),
    ),
    ...teacherGrid(page(6), 6),
    ...portraitPage(page(7), 7, 'Выпускник'),
    ...collagePage(
      page(8),
      8,
      'Достижения',
      [
        [24, 32, 68, 88],
        [106, 32, 68, 88],
        [24, 142, 68, 88],
        [106, 142, 68, 88],
      ],
      'Наши победы',
    ),
    ...collagePage(page(9), 10, 'Спорт', [
      [24, 30, 70, 104],
      [106, 30, 70, 104],
      [24, 146, 70, 90],
      [106, 146, 70, 90],
    ]),
    ...citySketch(page(9), 132, 210, '#5aa3a1'),
    ...collagePage(
      page(10),
      11,
      'Творчество',
      [
        [26, 32, 58, 76],
        [96, 30, 78, 54],
        [24, 128, 70, 98],
        [106, 112, 66, 112],
      ],
      'Каждый талант\nзвучит по‑своему',
    ),
    ...collagePage(page(11), 12, 'Петербург', [
      [22, 34, 72, 90],
      [106, 34, 72, 90],
      [22, 148, 156, 72],
    ]),
    ...citySketch(page(11), 66, 210, '#b36b5d'),
    ...collagePage(
      page(12),
      13,
      'Наш класс',
      [
        [20, 34, 48, 62],
        [76, 34, 48, 62],
        [132, 34, 48, 62],
        [20, 118, 48, 62],
        [76, 118, 48, 62],
        [132, 118, 48, 62],
      ],
      'Вместе — сильнее',
    ),
    ...collagePage(page(13), 14, 'Моменты', [
      [24, 30, 150, 72],
      [24, 116, 68, 94],
      [106, 116, 68, 94],
    ]),
    ...collagePage(
      page(14),
      15,
      'Финал',
      [
        [24, 34, 150, 92],
        [40, 150, 120, 66],
      ],
      'Впереди — новый город,\nновые маршруты,\nновые мы',
    ),
    ...marbleBackground(page(15), 16),
    tunedTextLayer(
      id,
      page(15).id,
      0,
      'ДО ВСТРЕЧИ\nВ НОВОЙ ИСТОРИИ',
      32,
      78,
      136,
      30,
      green,
      'center',
      {
        fontFamily: 'Georgia',
        fontWeight: '700',
        lineHeight: 1.05,
      },
    ),
    tunedTextLayer(id, page(15).id, 1, 'Санкт-Петербург · 2025', 44, 156, 112, 12, text, 'center'),
    ...citySketch(page(15), 76, 186),
  ];

  for (const layer of layers) {
    if (layer.kind === 'frame' && layer.pageId === page(1).id) {
      layer.binding = {
        source: 'participant',
        field: 'photoAssetId',
        fallback: `${id}:placeholder`,
      };
    }
    if (layer.kind === 'text' && layer.pageId === page(1).id && layer.name === 'ФАМИЛИЯ') {
      layer.binding = { source: 'participant', field: 'lastName', fallback: 'ФАМИЛИЯ' };
    }
  }

  const document: CanvasDocument = {
    version: 2,
    projectId: id,
    pages,
    layers,
    updatedAt: createdAt,
  };
  return {
    format: 'vakha-template',
    version: 1,
    template: {
      id,
      name: 'Санкт-Петербург · мрамор',
      description:
        'Светлый выпускной шаблон по референсу генератора: мрамор, зелёные разделы, портреты, группы, учителя, пожелания и события.',
      category: 'grade-11',
      style: 'classic',
      color: 'green',
      orientation: 'portrait',
      source: 'system',
      favorite: false,
      createdAt,
      updatedAt: createdAt,
    },
    document,
    assets: [],
  };
}

const editorialBurgundyStudentAssetId = 'system-editorial-burgundy-students';
const editorialBurgundyTeacherAssetId = 'system-editorial-burgundy-teachers';

function demoPortraitFrame(
  templateId: string,
  pageId: string,
  index: number,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  type: 'student' | 'teacher',
  portraitIndex: number,
): CanvasLayerSnapshot {
  const layer = photoFrame(templateId, pageId, index, xMm, yMm, widthMm, heightMm, '#b8b8b8');
  const columns = 4;
  const rows = type === 'student' ? 3 : 2;
  const column = portraitIndex % columns;
  const row = Math.floor(portraitIndex / columns) % rows;
  layer.name = `${type === 'student' ? 'Ученик' : 'Учитель'} · заменяемое фото ${
    portraitIndex + 1
  }`;
  layer.image = {
    ...createDefaultImageStyle({
      assetId:
        type === 'student' ? editorialBurgundyStudentAssetId : editorialBurgundyTeacherAssetId,
      filename:
        type === 'student' ? 'Демонстрационные выпускники.png' : 'Демонстрационные учителя.png',
      mimeType: 'image/png',
      naturalWidthPx: type === 'student' ? 1448 : 1536,
      naturalHeightPx: type === 'student' ? 1086 : 1024,
    }),
    cropX: columns === 1 ? 0.5 : column / (columns - 1),
    cropY: rows === 1 ? 0.5 : row / (rows - 1),
    zoom: type === 'student' ? 3.1 : 2,
  };
  return layer;
}

function createEditorialBurgundyTemplate(): TemplateManifest {
  const id = 'system-editorial-burgundy-2026';
  const spread = (name: string) => `${id}:spread-${name}`;
  const pages = [
    makePage(id, 0, 'Передняя обложка', 'cover'),
    makePage(id, 1, 'Титульная страница', 'universal', 'none', spread('intro'), 'left'),
    makePage(id, 2, 'Наш класс · 1', 'class', 'none', spread('intro'), 'right'),
    makePage(id, 3, 'Наш класс · 2', 'class', 'none', spread('class'), 'left'),
    makePage(id, 4, 'Большой портрет класса', 'class', 'none', spread('class'), 'right'),
    makePage(id, 5, 'Портрет выпускника', 'portrait', 'student', spread('student'), 'left'),
    makePage(id, 6, 'Имя и пожелание', 'portrait', 'student', spread('student'), 'right'),
    makePage(id, 7, 'Наши учителя', 'teachers', 'none', spread('teachers'), 'left'),
    makePage(id, 8, 'Классный руководитель', 'teachers', 'teacher', spread('teachers'), 'right'),
    makePage(id, 9, 'Школьные моменты · 1', 'events', 'none', spread('moments'), 'left'),
    makePage(id, 10, 'Школьные моменты · 2', 'events', 'none', spread('moments'), 'right'),
    makePage(id, 11, 'Пожелания · 1', 'universal', 'none', spread('wishes'), 'left'),
    makePage(id, 12, 'Пожелания · 2', 'universal', 'none', spread('wishes'), 'right'),
    makePage(id, 13, 'Задняя обложка', 'closing'),
  ];
  const [
    cover,
    titlePage,
    classOne,
    classTwo,
    classHero,
    studentPortrait,
    studentName,
    teachersGrid,
    teacherHero,
    momentsLeft,
    momentsRight,
    wishesLeft,
    wishesRight,
    backCover,
  ] = pages;
  const paper = '#f4f3ef';
  const white = '#ffffff';
  const burgundy = '#9d2932';
  const burgundyDark = '#7f1f27';
  const ink = '#17191d';
  const muted = '#6c6c6a';
  const names = [
    'Алексей Смирнов',
    'Анна Волкова',
    'Максим Орлов',
    'София Морозова',
    'Мария Соколова',
    'Даниил Кузнецов',
    'Елизавета Попова',
    'Артём Лебедев',
    'Илья Козлов',
    'Полина Новикова',
    'Роман Павлов',
    'Дарья Семёнова',
  ];
  const teacherNames = [
    'А.В. Петров',
    'Е.С. Иванова',
    'М.Н. Орлов',
    'Т.А. Волкова',
    'Д.С. Лебедев',
    'О.П. Соколова',
    'В.И. Морозов',
    'Н.А. Кузнецова',
  ];
  const pinstripe = (page: CanvasPageSnapshot, prefix: string, xMm: number, yMm: number) =>
    Array.from({ length: 13 }, (_, index) =>
      decorativeLayer(
        id,
        page.id,
        `${prefix}-${index}`,
        'Тонкая штриховка',
        'rect',
        2,
        xMm,
        yMm + index * 1.6,
        38,
        0.35,
        index % 3 === 0 ? burgundy : '#9b9b99',
        0.64,
      ),
    );
  const pageMark = (page: CanvasPageSnapshot, value: string, right = false) => [
    decorativeLayer(
      id,
      page.id,
      'page-mark-line',
      'Номер страницы · линия',
      'rect',
      40,
      right ? 164 : 22,
      260,
      14,
      0.8,
      ink,
    ),
    tunedTextLayer(id, page.id, 98, value, right ? 178 : 8, 254, 14, 9, burgundy, 'center', {
      fontWeight: '700',
    }),
  ];
  const rosterPage = (page: CanvasPageSnapshot, startIndex: number, right = false) => [
    background(id, page.id, paper),
    decorativeLayer(
      id,
      page.id,
      'roster-accent',
      'Бордовая полоса',
      'rect',
      2,
      right ? 184 : 0,
      0,
      16,
      280,
      burgundy,
    ),
    ...pinstripe(page, 'roster-stripe', right ? 140 : 22, 18),
    tunedTextLayer(id, page.id, 0, 'ВЫПУСК', right ? 22 : 38, 18, 68, 11, burgundy, 'left', {
      letterSpacingEm: 0.16,
      fontWeight: '600',
    }),
    tunedTextLayer(id, page.id, 1, '2026', right ? 94 : 110, 13, 48, 22, ink, 'left', {
      fontFamily: 'Georgia',
    }),
    ...Array.from({ length: 12 }, (_, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      return demoPortraitFrame(
        id,
        page.id,
        index,
        (right ? 20 : 24) + column * 40,
        50 + row * 66,
        32,
        45,
        'student',
        (startIndex + index) % 12,
      );
    }),
    ...Array.from({ length: 12 }, (_, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      return tunedTextLayer(
        id,
        page.id,
        20 + index,
        names[(startIndex + index) % names.length]!,
        (right ? 18 : 22) + column * 40,
        96 + row * 66,
        36,
        7,
        ink,
        'center',
        { lineHeight: 1.02 },
      );
    }),
    ...pageMark(page, right ? '03' : '02', right),
  ];
  const layers: CanvasLayerSnapshot[] = [
    background(id, cover.id, paper),
    decorativeLayer(
      id,
      cover.id,
      'cover-spine',
      'Бордовый корешок',
      'rect',
      2,
      0,
      0,
      28,
      280,
      burgundy,
    ),
    decorativeLayer(
      id,
      cover.id,
      'cover-field',
      'Серая плоскость',
      'rect',
      2,
      28,
      0,
      172,
      280,
      '#dddddc',
    ),
    decorativeLayer(
      id,
      cover.id,
      'cover-white-panel',
      'Белая карточка',
      'rect',
      3,
      42,
      22,
      138,
      232,
      white,
      0.96,
      -2,
      '#d2d2d0',
      0.45,
    ),
    decorativeLayer(
      id,
      cover.id,
      'cover-red-band',
      'Горизонтальный акцент',
      'rect',
      4,
      28,
      94,
      172,
      28,
      burgundy,
    ),
    ...pinstripe(cover, 'cover-stripe-top', 102, 18),
    ...pinstripe(cover, 'cover-stripe-bottom', 94, 222),
    decorativeLayer(id, cover.id, 'cover-year-box', 'Плашка года', 'rect', 5, 76, 34, 40, 52, ink),
    tunedTextLayer(id, cover.id, 1, '20\n26', 78, 39, 36, 26, white, 'center', {
      fontFamily: 'Georgia',
      lineHeight: 0.94,
    }),
    tunedTextLayer(id, cover.id, 2, 'В', 38, 96, 66, 68, burgundy, 'center', {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontWeight: 'normal',
    }),
    tunedTextLayer(id, cover.id, 3, 'выпускной', 88, 103, 88, 22, ink, 'left', {
      fontWeight: '300',
      letterSpacingEm: 0.08,
    }),
    tunedTextLayer(id, cover.id, 4, 'АЛЬБОМ', 92, 132, 78, 17, burgundy, 'left', {
      fontFamily: 'Georgia',
      letterSpacingEm: 0.12,
    }),
    tunedTextLayer(id, cover.id, 5, '11-Б\nКЛАСС', 92, 180, 52, 15, ink, 'left', {
      lineHeight: 1.05,
      fontWeight: '600',
    }),
    tunedTextLayer(id, cover.id, 6, 'С НАЗВАНИЕМ', 160, 46, 12, 9, ink, 'center', {
      letterSpacingEm: 0.08,
    }),

    background(id, titlePage.id, paper),
    decorativeLayer(
      id,
      titlePage.id,
      'title-spine',
      'Бордовая полоса',
      'rect',
      2,
      0,
      0,
      18,
      280,
      burgundy,
    ),
    ...pinstripe(titlePage, 'title-lines', 28, 28),
    tunedTextLayer(id, titlePage.id, 0, 'НАША\nИСТОРИЯ', 36, 62, 126, 40, ink, 'left', {
      fontFamily: 'Georgia',
      lineHeight: 0.98,
    }),
    tunedTextLayer(id, titlePage.id, 1, 'ШКОЛА №25', 38, 157, 94, 12, burgundy, 'left', {
      letterSpacingEm: 0.16,
      fontWeight: '600',
    }),
    tunedTextLayer(id, titlePage.id, 2, '11-Б КЛАСС · 2026', 38, 179, 112, 15, ink, 'left'),
    tunedTextLayer(
      id,
      titlePage.id,
      3,
      'Один класс. Один выпуск.\nСотни историй, которые\nостанутся с нами.',
      38,
      208,
      112,
      11,
      muted,
      'left',
      { fontStyle: 'italic', lineHeight: 1.3 },
    ),
    ...pageMark(titlePage, '01'),

    ...rosterPage(classOne, 0, true),
    ...rosterPage(classTwo, 6, false),

    background(id, classHero.id, paper),
    decorativeLayer(
      id,
      classHero.id,
      'hero-band',
      'Бордовый блок',
      'rect',
      2,
      0,
      206,
      200,
      74,
      burgundy,
    ),
    demoPortraitFrame(id, classHero.id, 0, 18, 22, 136, 176, 'student', 0),
    tunedTextLayer(id, classHero.id, 0, 'НАШ\nКЛАСС', 158, 30, 34, 34, ink, 'left', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      lineHeight: 0.92,
    }),
    tunedTextLayer(id, classHero.id, 1, '11-Б', 144, 218, 48, 30, white, 'center', {
      fontFamily: 'Georgia',
    }),
    tunedTextLayer(id, classHero.id, 2, 'вместе с 2015 года', 58, 229, 80, 11, white, 'center', {
      letterSpacingEm: 0.08,
    }),

    background(id, studentPortrait.id, '#dddddc'),
    decorativeLayer(
      id,
      studentPortrait.id,
      'student-white-card',
      'Белое поле',
      'rect',
      2,
      18,
      18,
      164,
      244,
      white,
    ),
    decorativeLayer(
      id,
      studentPortrait.id,
      'student-red-corner',
      'Бордовый угол',
      'rect',
      3,
      18,
      18,
      22,
      244,
      burgundy,
    ),
    demoPortraitFrame(id, studentPortrait.id, 0, 48, 34, 116, 184, 'student', 2),
    tunedTextLayer(id, studentPortrait.id, 0, 'ВЫПУСКНИК', 48, 228, 70, 10, burgundy, 'left', {
      letterSpacingEm: 0.16,
      fontWeight: '600',
    }),
    tunedTextLayer(id, studentPortrait.id, 1, '2026', 120, 222, 44, 24, ink, 'right', {
      fontFamily: 'Georgia',
    }),

    background(id, studentName.id, paper),
    decorativeLayer(
      id,
      studentName.id,
      'name-band',
      'Бордовая вертикаль',
      'rect',
      2,
      172,
      0,
      28,
      280,
      burgundy,
    ),
    ...pinstripe(studentName, 'name-lines', 126, 28),
    tunedTextLayer(id, studentName.id, 0, 'АЛЕКСЕЙ\nСМИРНОВ', 24, 54, 136, 38, ink, 'left', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      lineHeight: 1.02,
    }),
    tunedTextLayer(id, studentName.id, 1, '11-Б КЛАСС', 28, 143, 82, 12, burgundy, 'left', {
      letterSpacingEm: 0.15,
      fontWeight: '600',
    }),
    tunedTextLayer(
      id,
      studentName.id,
      2,
      '«Смело идти вперёд,\nне забывая тех,\nс кем всё начиналось»',
      28,
      181,
      118,
      15,
      muted,
      'left',
      { fontFamily: 'serif', fontStyle: 'italic', lineHeight: 1.24 },
    ),
    demoPortraitFrame(id, studentName.id, 1, 126, 214, 34, 44, 'student', 2),

    background(id, teachersGrid.id, paper),
    decorativeLayer(
      id,
      teachersGrid.id,
      'teachers-spine',
      'Бордовая полоса',
      'rect',
      2,
      0,
      0,
      18,
      280,
      burgundy,
    ),
    tunedTextLayer(id, teachersGrid.id, 0, 'НАШИ УЧИТЕЛЯ', 30, 20, 142, 22, ink, 'center', {
      fontFamily: 'Georgia',
      fontWeight: '700',
    }),
    tunedTextLayer(
      id,
      teachersGrid.id,
      1,
      'спасибо за знания и поддержку',
      30,
      45,
      142,
      9,
      muted,
      'center',
    ),
    ...Array.from({ length: 8 }, (_, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      return demoPortraitFrame(
        id,
        teachersGrid.id,
        index,
        28 + column * 39,
        70 + row * 88,
        31,
        54,
        'teacher',
        index,
      );
    }),
    ...Array.from({ length: 8 }, (_, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      return tunedTextLayer(
        id,
        teachersGrid.id,
        20 + index,
        teacherNames[index]!,
        26 + column * 39,
        126 + row * 88,
        35,
        7,
        ink,
        'center',
      );
    }),
    ...pageMark(teachersGrid, '07'),

    background(id, teacherHero.id, paper),
    decorativeLayer(
      id,
      teacherHero.id,
      'teacher-band',
      'Бордовая плоскость',
      'rect',
      2,
      0,
      0,
      54,
      280,
      burgundy,
    ),
    demoPortraitFrame(id, teacherHero.id, 0, 40, 30, 116, 174, 'teacher', 1),
    tunedTextLayer(
      id,
      teacherHero.id,
      0,
      'ЕЛЕНА\nСЕРГЕЕВНА\nИВАНОВА',
      78,
      214,
      102,
      25,
      ink,
      'center',
      {
        fontFamily: 'Georgia',
        fontWeight: '700',
        lineHeight: 1.02,
      },
    ),
    tunedTextLayer(
      id,
      teacherHero.id,
      1,
      'КЛАССНЫЙ РУКОВОДИТЕЛЬ',
      64,
      255,
      128,
      9,
      burgundy,
      'center',
      {
        letterSpacingEm: 0.12,
        fontWeight: '600',
      },
    ),

    background(id, momentsLeft.id, paper),
    decorativeLayer(
      id,
      momentsLeft.id,
      'moments-left-band',
      'Бордовая полоса',
      'rect',
      2,
      0,
      0,
      20,
      280,
      burgundy,
    ),
    tunedTextLayer(id, momentsLeft.id, 0, 'ШКОЛЬНЫЕ\nМОМЕНТЫ', 34, 24, 138, 27, ink, 'left', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      lineHeight: 1,
    }),
    demoPortraitFrame(id, momentsLeft.id, 0, 34, 92, 62, 86, 'student', 5),
    demoPortraitFrame(id, momentsLeft.id, 1, 106, 82, 64, 52, 'student', 7),
    demoPortraitFrame(id, momentsLeft.id, 2, 106, 144, 64, 78, 'student', 9),
    tunedTextLayer(
      id,
      momentsLeft.id,
      1,
      'УРОКИ · ПЕРЕМЕНЫ · ПОБЕДЫ',
      34,
      236,
      136,
      9,
      burgundy,
      'center',
      {
        letterSpacingEm: 0.1,
      },
    ),

    background(id, momentsRight.id, paper),
    ...pinstripe(momentsRight, 'moments-right-lines', 142, 18),
    demoPortraitFrame(id, momentsRight.id, 0, 22, 24, 112, 92, 'student', 10),
    demoPortraitFrame(id, momentsRight.id, 1, 22, 128, 54, 74, 'student', 1),
    demoPortraitFrame(id, momentsRight.id, 2, 86, 128, 92, 112, 'student', 11),
    decorativeLayer(
      id,
      momentsRight.id,
      'moments-red-block',
      'Бордовая плашка',
      'rect',
      3,
      0,
      244,
      200,
      36,
      burgundy,
    ),
    tunedTextLayer(id, momentsRight.id, 0, 'ЭТО БЫЛО С НАМИ', 34, 252, 132, 13, white, 'center', {
      letterSpacingEm: 0.14,
      fontWeight: '600',
    }),

    background(id, wishesLeft.id, burgundyDark),
    tunedTextLayer(id, wishesLeft.id, 0, 'ПОЖЕЛАНИЯ', 24, 26, 152, 24, white, 'center', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      letterSpacingEm: 0.08,
    }),
    ...Array.from({ length: 4 }, (_, index) =>
      decorativeLayer(
        id,
        wishesLeft.id,
        `wish-card-${index}`,
        'Карточка пожелания',
        'rect',
        3,
        24 + (index % 2) * 80,
        72 + Math.floor(index / 2) * 88,
        68,
        70,
        white,
        0.96,
        index % 2 ? 1.5 : -1.5,
      ),
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      tunedTextLayer(
        id,
        wishesLeft.id,
        10 + index,
        'Здесь будет\nтёплое пожелание\nот одноклассника',
        31 + (index % 2) * 80,
        91 + Math.floor(index / 2) * 88,
        54,
        9,
        ink,
        'center',
        { fontStyle: 'italic', lineHeight: 1.25 },
      ),
    ),

    background(id, wishesRight.id, paper),
    decorativeLayer(
      id,
      wishesRight.id,
      'wish-right-band',
      'Бордовая полоса',
      'rect',
      2,
      180,
      0,
      20,
      280,
      burgundy,
    ),
    tunedTextLayer(id, wishesRight.id, 0, 'ВПЕРЕДИ —\nЦЕЛАЯ ЖИЗНЬ', 26, 38, 138, 34, ink, 'left', {
      fontFamily: 'Georgia',
      fontWeight: '700',
      lineHeight: 1.02,
    }),
    tunedTextLayer(
      id,
      wishesRight.id,
      1,
      'Пусть всё задуманное сбудется,\nа школьные годы останутся\nточкой опоры.',
      28,
      142,
      126,
      14,
      muted,
      'left',
      { fontStyle: 'italic', lineHeight: 1.3 },
    ),
    tunedTextLayer(id, wishesRight.id, 2, '2026', 92, 214, 68, 38, burgundy, 'right', {
      fontFamily: 'Georgia',
    }),

    background(id, backCover.id, '#dddddc'),
    decorativeLayer(
      id,
      backCover.id,
      'back-spine',
      'Бордовый корешок',
      'rect',
      2,
      172,
      0,
      28,
      280,
      burgundy,
    ),
    decorativeLayer(
      id,
      backCover.id,
      'back-card',
      'Белая карточка',
      'rect',
      3,
      28,
      34,
      124,
      210,
      white,
      0.96,
      1.4,
    ),
    ...pinstripe(backCover, 'back-lines', 38, 52),
    tunedTextLayer(id, backCover.id, 0, '11-Б', 54, 92, 74, 36, burgundy, 'center', {
      fontFamily: 'Georgia',
      fontWeight: '700',
    }),
    tunedTextLayer(id, backCover.id, 1, 'ШКОЛА №25', 46, 142, 90, 13, ink, 'center', {
      letterSpacingEm: 0.14,
    }),
    tunedTextLayer(id, backCover.id, 2, 'МОСКВА · 2026', 46, 168, 90, 11, muted, 'center'),
    tunedTextLayer(
      id,
      backCover.id,
      3,
      'НАША ИСТОРИЯ\nПРОДОЛЖАЕТСЯ',
      44,
      206,
      94,
      12,
      burgundy,
      'center',
      {
        fontWeight: '600',
        letterSpacingEm: 0.1,
      },
    ),
  ];

  const studentPhotoIds = [
    `${id}:${studentPortrait.id}:frame-0`,
    `${id}:${studentName.id}:frame-1`,
  ];
  for (const layer of layers) {
    if (studentPhotoIds.includes(layer.id)) {
      layer.binding = {
        source: 'participant',
        field: 'photoAssetId',
        fallback: editorialBurgundyStudentAssetId,
      };
    }
    if (layer.id === `${id}:${studentName.id}:text-0`) {
      layer.binding = {
        source: 'participant',
        field: 'fullName',
        fallback: 'АЛЕКСЕЙ СМИРНОВ',
      };
    }
    if (layer.id === `${id}:${teacherHero.id}:frame-0`) {
      layer.binding = {
        source: 'teacher',
        field: 'photoAssetId',
        fallback: editorialBurgundyTeacherAssetId,
      };
    }
    if (layer.id === `${id}:${teacherHero.id}:text-0`) {
      layer.binding = {
        source: 'teacher',
        field: 'fullName',
        fallback: 'ЕЛЕНА СЕРГЕЕВНА ИВАНОВА',
      };
    }
  }

  const document: CanvasDocument = {
    version: 2,
    projectId: id,
    pages,
    layers,
    updatedAt: createdAt,
  };
  return {
    format: 'vakha-template',
    version: 1,
    template: {
      id,
      name: 'Выпускной 2026 · бордовая редакция',
      description:
        'Полный альбом по референсу: передняя и задняя обложки, 6 разворотов, сетки выпускников и учителей, персональные страницы, события и пожелания. Все фото заменяются кликом.',
      category: 'grade-11',
      style: 'classic',
      color: 'red',
      orientation: 'portrait',
      source: 'system',
      favorite: false,
      createdAt,
      updatedAt: createdAt,
    },
    document,
    assets: [
      {
        id: editorialBurgundyStudentAssetId,
        path: `assets/${editorialBurgundyStudentAssetId}`,
        filename: 'editorial-burgundy-students.png',
        mimeType: 'image/png',
        kind: 'image',
        byteSize: 1989153,
        metadata: { widthPx: 1448, heightPx: 1086 },
      },
      {
        id: editorialBurgundyTeacherAssetId,
        path: `assets/${editorialBurgundyTeacherAssetId}`,
        filename: 'editorial-burgundy-teachers.png',
        mimeType: 'image/png',
        kind: 'image',
        byteSize: 2335326,
        metadata: { widthPx: 1536, heightPx: 1024 },
      },
    ],
  };
}

export const systemTemplates: TemplateManifest[] = [
  createGrade4GeometryTemplate(),
  createSpbMarbleTemplate(),
  createEditorialBurgundyTemplate(),
  createReferenceMixTemplate(),
  createSystemTemplate({
    id: 'system-editorial-red',
    name: 'Редакционный красный',
    description: 'Строгая белая сетка, графичная типографика и красные акценты.',
    category: 'grade-11',
    style: 'modern',
    color: 'red',
    palette: {
      background: '#f4f3ef',
      surface: '#d4d3cf',
      accent: '#a42128',
      text: '#18191c',
      muted: '#68686b',
    },
  }),
  createSystemTemplate({
    id: 'system-chalkboard',
    name: 'Школьная доска',
    description: 'Тёмно-зелёная школьная эстетика с меловыми подписями и сеткой портретов.',
    category: 'grade-4',
    style: 'school',
    color: 'green',
    palette: {
      background: '#163b3a',
      surface: '#315553',
      accent: '#f2d385',
      text: '#f6f3e9',
      muted: '#b9cbc5',
    },
  }),
  createSystemTemplate({
    id: 'system-cinema-gold',
    name: 'Премьера',
    description: 'Чёрный фон, золотые рамки и торжественная кинематографическая композиция.',
    category: 'grade-11',
    style: 'premium',
    color: 'gold',
    palette: {
      background: '#11100f',
      surface: '#292522',
      accent: '#c89b42',
      text: '#f1e7d2',
      muted: '#b7a98f',
    },
  }),
];
