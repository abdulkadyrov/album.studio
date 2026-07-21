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

export const systemTemplates: TemplateManifest[] = [
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
