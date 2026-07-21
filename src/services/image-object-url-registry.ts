import { imageRepository, type ImageAsset } from '../data/repositories/image-repository';

class ImageObjectUrlRegistry {
  private entries = new Map<string, { url: string; element: HTMLImageElement }>();

  async initialize(projectId: string, referencedAssetIds: string[] = []): Promise<ImageAsset[]> {
    this.clear();
    const assets = await imageRepository.list(projectId);
    const referenced = new Set(referencedAssetIds);
    await Promise.all(
      assets.filter((asset) => referenced.has(asset.id)).map((asset) => this.register(asset.id)),
    );
    return assets;
  }

  async register(assetId: string): Promise<void> {
    this.unregister(assetId);
    const blob = await imageRepository.getBlob(assetId);
    if (!blob) throw new Error('Оригинал изображения не найден');
    const url = URL.createObjectURL(blob);
    try {
      const element = new Image();
      element.decoding = 'async';
      element.src = url;
      await element.decode();
      this.entries.set(assetId, { url, element });
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  getElement(assetId: string): HTMLImageElement | undefined {
    return this.entries.get(assetId)?.element;
  }

  getUrl(assetId: string): string | undefined {
    return this.entries.get(assetId)?.url;
  }

  unregister(assetId: string): void {
    const entry = this.entries.get(assetId);
    if (entry) URL.revokeObjectURL(entry.url);
    this.entries.delete(assetId);
  }

  retain(assetIds: string[]): void {
    const retained = new Set(assetIds);
    for (const assetId of this.entries.keys()) {
      if (!retained.has(assetId)) this.unregister(assetId);
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) URL.revokeObjectURL(entry.url);
    this.entries.clear();
  }
}

export const imageObjectUrlRegistry = new ImageObjectUrlRegistry();
