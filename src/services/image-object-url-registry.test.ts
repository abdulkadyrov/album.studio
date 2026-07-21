import { beforeEach, describe, expect, it, vi } from 'vitest';

import { database } from '../data/db/database';
import { imageObjectUrlRegistry } from './image-object-url-registry';

class MockImage {
  decoding = 'auto';
  src = '';
  naturalWidth = 100;
  naturalHeight = 100;

  decode(): Promise<void> {
    return Promise.resolve();
  }
}

describe('image object url registry', () => {
  beforeEach(async () => {
    imageObjectUrlRegistry.clear();
    await Promise.all(database.tables.map((table) => table.clear()));
    vi.restoreAllMocks();
    vi.stubGlobal('Image', MockImage);
  });

  it('отзывает Object URL при повторной регистрации, retain и clear', async () => {
    const created: string[] = [];
    const revoked: string[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:asset-${created.length + 1}`;
      created.push(url);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revoked.push(url);
    });
    await database.assets.bulkPut([
      {
        id: 'image-a',
        projectId: 'object-url-project',
        ownerType: 'project',
        kind: 'image',
        filename: 'a.png',
        mimeType: 'image/png',
        byteSize: 1,
        blob: new Blob(['a'], { type: 'image/png' }),
        metadata: { widthPx: 100, heightPx: 100 },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'image-b',
        projectId: 'object-url-project',
        ownerType: 'project',
        kind: 'image',
        filename: 'b.png',
        mimeType: 'image/png',
        byteSize: 1,
        blob: new Blob(['b'], { type: 'image/png' }),
        metadata: { widthPx: 100, heightPx: 100 },
        createdAt: new Date().toISOString(),
      },
    ]);

    await imageObjectUrlRegistry.register('image-a');
    expect(imageObjectUrlRegistry.getUrl('image-a')).toBe('blob:asset-1');

    await imageObjectUrlRegistry.register('image-a');
    expect(revoked).toContain('blob:asset-1');
    expect(imageObjectUrlRegistry.getUrl('image-a')).toBe('blob:asset-2');

    await imageObjectUrlRegistry.register('image-b');
    imageObjectUrlRegistry.retain(['image-b']);
    expect(revoked).toContain('blob:asset-2');
    expect(imageObjectUrlRegistry.getUrl('image-a')).toBeUndefined();
    expect(imageObjectUrlRegistry.getUrl('image-b')).toBe('blob:asset-3');

    imageObjectUrlRegistry.clear();
    expect(revoked).toContain('blob:asset-3');
  });
});
