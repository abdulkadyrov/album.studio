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

export const systemTemplates: TemplateManifest[] = [
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
