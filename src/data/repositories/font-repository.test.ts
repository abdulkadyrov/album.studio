import { database } from '../db/database';
import { fontRepository, validateFontFile } from './font-repository';

function fontFile(name = 'VakhaTest.woff'): File {
  return new File([new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0, 1, 2, 3])], name, {
    type: 'font/woff',
  });
}

describe('fontRepository', () => {
  beforeEach(async () => {
    database.close();
    await database.delete();
    await database.open();
  });

  afterEach(() => database.close());

  it('валидирует, сохраняет и обновляет локальный font asset', async () => {
    const saved = await fontRepository.save(fontFile(), 'Vakha Test');
    await fontRepository.setFavorite(saved.id, true);
    await fontRepository.markUsed(saved.id);

    const fonts = await fontRepository.list();
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatchObject({ id: saved.id, family: 'Vakha Test', favorite: true });
    expect(typeof fonts[0]?.lastUsedAt).toBe('string');
    expect(await fontRepository.getBlob(saved.id)).toBeDefined();

    await fontRepository.delete(saved.id);
    expect(await fontRepository.list()).toEqual([]);
  });

  it('отклоняет расширение и сигнатуру, не похожие на шрифт', async () => {
    await expect(validateFontFile(fontFile('font.exe'))).rejects.toThrow('TTF');
    await expect(
      validateFontFile(new File(['not-font'], 'broken.woff', { type: 'font/woff' })),
    ).rejects.toThrow('Сигнатура');
  });
});
