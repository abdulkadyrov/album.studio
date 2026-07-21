import { database } from '../db/database';
import type { AssetRecord } from '../db/schema';

const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

export interface ImageAsset {
  id: string;
  thumbnailId?: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  widthPx: number;
  heightPx: number;
  hash: string;
}

function extension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function validateImageSignature(filename: string, bytes: Uint8Array): string {
  const ext = extension(filename);
  if (['jpg', 'jpeg'].includes(ext) && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (
    ext === 'png' &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return 'image/png';
  if (
    ext === 'webp' &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  throw new Error('Поддерживаются только JPEG, PNG, WebP и SVG');
}

export function assertSafeSvg(source: string): void {
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('SVG содержит ошибку разметки');
  if (document.querySelector('script, foreignObject, iframe, object, embed'))
    throw new Error('SVG содержит небезопасные элементы');
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of element.getAttributeNames()) {
      const value = element.getAttribute(attribute)?.trim() ?? '';
      if (attribute.toLowerCase().startsWith('on'))
        throw new Error('SVG содержит исполняемые обработчики');
      if (
        ['href', 'xlink:href'].includes(attribute.toLowerCase()) &&
        value &&
        !value.startsWith('#') &&
        !value.startsWith('data:image/')
      )
        throw new Error('SVG содержит внешнюю ссылку');
    }
  }
}

async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function makeThumbnail(image: HTMLImageElement): Promise<Blob> {
  const maximum = 640;
  const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось создать миниатюру'))),
      'image/webp',
      0.82,
    ),
  );
}

function toImageAsset(record: AssetRecord): ImageAsset {
  return {
    id: record.id,
    thumbnailId:
      typeof record.metadata?.thumbnailAssetId === 'string'
        ? record.metadata.thumbnailAssetId
        : undefined,
    filename: record.filename,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    widthPx: Number(record.metadata?.widthPx),
    heightPx: Number(record.metadata?.heightPx),
    hash: record.hash ?? '',
  };
}

export const imageRepository = {
  async save(file: File, projectId: string): Promise<ImageAsset> {
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES)
      throw new Error('Размер изображения должен быть от 1 байта до 100 МБ');
    const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
    const mimeType = validateImageSignature(file.name, bytes);
    if (!SUPPORTED_TYPES.has(mimeType)) throw new Error('Неподдерживаемый формат изображения');
    if (mimeType === 'image/svg+xml') assertSafeSvg(await file.text());
    const hash = await sha256(file);
    const duplicate = (await database.assets.where('hash').equals(hash).toArray()).find(
      (record) => record.projectId === projectId,
    );
    if (duplicate && duplicate.kind !== 'font') return toImageAsset(duplicate);

    const image = await loadImage(file);
    if (!image.naturalWidth || !image.naturalHeight)
      throw new Error('Не удалось прочитать изображение');
    const thumbnail = await makeThumbnail(image);
    const id = `image-${crypto.randomUUID()}`;
    const thumbnailId = `thumbnail-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    await database.transaction('rw', database.assets, async () => {
      await database.assets.bulkAdd([
        {
          id,
          projectId,
          ownerType: 'project',
          kind: mimeType === 'image/svg+xml' ? 'svg' : 'image',
          filename: file.name,
          mimeType,
          byteSize: file.size,
          blob: file,
          hash,
          metadata: {
            widthPx: image.naturalWidth,
            heightPx: image.naturalHeight,
            thumbnailAssetId: thumbnailId,
          },
          createdAt,
        },
        {
          id: thumbnailId,
          projectId,
          ownerType: 'project',
          kind: 'thumbnail',
          filename: `${file.name}.preview.webp`,
          mimeType: thumbnail.type,
          byteSize: thumbnail.size,
          blob: thumbnail,
          sourceAssetId: id,
          createdAt,
        },
      ]);
    });
    return {
      id,
      thumbnailId,
      filename: file.name,
      mimeType,
      byteSize: file.size,
      widthPx: image.naturalWidth,
      heightPx: image.naturalHeight,
      hash,
    };
  },

  async list(projectId: string): Promise<ImageAsset[]> {
    const records = await database.assets.where('projectId').equals(projectId).toArray();
    return records.filter((record) => ['image', 'svg'].includes(record.kind)).map(toImageAsset);
  },

  async getBlob(assetId: string): Promise<Blob | undefined> {
    return (await database.assets.get(assetId))?.blob;
  },

  async delete(assetId: string): Promise<void> {
    const thumbnails = await database.assets.where('sourceAssetId').equals(assetId).primaryKeys();
    await database.assets.bulkDelete([assetId, ...thumbnails]);
  },
};
