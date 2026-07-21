import { fontRepository, type FontAsset } from '../data/repositories/font-repository';

export const BUILTIN_FONTS = [
  { id: 'builtin-sans', family: 'sans-serif', label: 'Vakha Sans' },
  { id: 'builtin-serif', family: 'serif', label: 'Vakha Serif' },
  { id: 'builtin-mono', family: 'monospace', label: 'Vakha Mono' },
] as const;

class FontRegistry {
  private readonly faces = new Map<string, FontFace>();
  private assets: FontAsset[] = [];

  async initialize(): Promise<FontAsset[]> {
    this.assets = await fontRepository.list();
    await Promise.allSettled(this.assets.map((asset) => this.register(asset)));
    return this.getAssets();
  }

  async register(asset: FontAsset): Promise<void> {
    if (this.faces.has(asset.id)) return;
    const blob = await fontRepository.getBlob(asset.id);
    if (!blob) throw new Error(`Файл шрифта «${asset.family}» отсутствует`);
    const face = new FontFace(asset.family, await blob.arrayBuffer());
    await face.load();
    document.fonts.add(face);
    this.faces.set(asset.id, face);
    this.assets = [...this.assets.filter((candidate) => candidate.id !== asset.id), asset];
  }

  unregister(assetId: string): void {
    const face = this.faces.get(assetId);
    if (face) document.fonts.delete(face);
    this.faces.delete(assetId);
    this.assets = this.assets.filter((asset) => asset.id !== assetId);
  }

  isAvailable(family: string, assetId?: string): boolean {
    if (BUILTIN_FONTS.some((font) => font.family === family)) return true;
    if (assetId) return this.faces.has(assetId);
    return this.assets.some((asset) => asset.family === family && this.faces.has(asset.id));
  }

  getAssets(): FontAsset[] {
    return [...this.assets].sort(
      (left, right) =>
        Number(right.favorite) - Number(left.favorite) ||
        (right.lastUsedAt ?? '').localeCompare(left.lastUsedAt ?? '') ||
        left.family.localeCompare(right.family, 'ru'),
    );
  }
}

export const fontRegistry = new FontRegistry();
