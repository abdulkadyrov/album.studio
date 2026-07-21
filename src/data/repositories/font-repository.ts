import { database } from '../db/database';

export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'] as const;
export const MAX_FONT_BYTES = 20 * 1024 * 1024;

export interface FontAsset {
  id: string;
  family: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  favorite: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

function extension(filename: string): string {
  return filename.split('.').at(-1)?.toLocaleLowerCase('en-US') ?? '';
}

function hasValidSignature(bytes: Uint8Array, fontExtension: string): boolean {
  const signature = String.fromCharCode(...bytes.slice(0, 4));
  if (fontExtension === 'otf') return signature === 'OTTO';
  if (fontExtension === 'woff') return signature === 'wOFF';
  if (fontExtension === 'woff2') return signature === 'wOF2';
  return (
    (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) ||
    signature === 'true' ||
    signature === 'typ1'
  );
}

function toFontAsset(record: {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}): FontAsset {
  return {
    id: record.id,
    family:
      typeof record.metadata?.family === 'string'
        ? record.metadata.family
        : record.filename.replace(/\.[^.]+$/, ''),
    filename: record.filename,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    favorite: record.metadata?.favorite === true,
    lastUsedAt:
      typeof record.metadata?.lastUsedAt === 'string' ? record.metadata.lastUsedAt : undefined,
    createdAt: record.createdAt,
  };
}

export async function validateFontFile(file: File): Promise<void> {
  const fontExtension = extension(file.name);
  if (!FONT_EXTENSIONS.includes(fontExtension as (typeof FONT_EXTENSIONS)[number])) {
    throw new TypeError('Поддерживаются только TTF, OTF, WOFF и WOFF2');
  }
  if (file.size <= 0 || file.size > MAX_FONT_BYTES) {
    throw new RangeError('Размер файла шрифта должен быть от 1 байта до 20 МБ');
  }
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!hasValidSignature(signature, fontExtension)) {
    throw new TypeError('Сигнатура файла не соответствует формату шрифта');
  }
}

export const fontRepository = {
  async list(): Promise<FontAsset[]> {
    const records = await database.assets.where('kind').equals('font').toArray();
    return records
      .map(toFontAsset)
      .sort(
        (left, right) =>
          Number(right.favorite) - Number(left.favorite) ||
          left.family.localeCompare(right.family, 'ru'),
      );
  },

  async save(file: File, family: string): Promise<FontAsset> {
    await validateFontFile(file);
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const hash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const existing = await database.assets.where('hash').equals(hash).first();
    if (existing?.kind === 'font') return toFontAsset(existing);
    const createdAt = new Date().toISOString();
    const id = `font-${crypto.randomUUID()}`;
    await database.assets.put({
      id,
      ownerType: 'user',
      kind: 'font',
      filename: file.name,
      mimeType: file.type || `font/${extension(file.name)}`,
      byteSize: file.size,
      blob: file,
      hash,
      createdAt,
      metadata: { family: family.trim() || file.name.replace(/\.[^.]+$/, ''), favorite: false },
    });
    return (await this.get(id))!;
  },

  async get(id: string): Promise<FontAsset | undefined> {
    const record = await database.assets.get(id);
    return record?.kind === 'font' ? toFontAsset(record) : undefined;
  },

  async getBlob(id: string): Promise<Blob | undefined> {
    const record = await database.assets.get(id);
    return record?.kind === 'font' ? record.blob : undefined;
  },

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    const record = await database.assets.get(id);
    if (!record || record.kind !== 'font') return;
    await database.assets.update(id, { metadata: { ...record.metadata, favorite } });
  },

  async markUsed(id: string): Promise<void> {
    const record = await database.assets.get(id);
    if (!record || record.kind !== 'font') return;
    await database.assets.update(id, {
      metadata: { ...record.metadata, lastUsedAt: new Date().toISOString() },
    });
  },

  async delete(id: string): Promise<void> {
    const record = await database.assets.get(id);
    if (record?.kind === 'font') await database.assets.delete(id);
  },
};
