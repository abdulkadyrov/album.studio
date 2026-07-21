import { applyTextCase, resolveTextOverflow } from './text-layout';

describe('text layout', () => {
  it('применяет русскоязычные варианты регистра без изменения исходной строки', () => {
    const source = 'иванов александр. ПРИВЕТ МИР';

    expect(applyTextCase(source, 'upper')).toBe('ИВАНОВ АЛЕКСАНДР. ПРИВЕТ МИР');
    expect(applyTextCase(source, 'title')).toBe('Иванов Александр. ПРИВЕТ МИР');
    expect(applyTextCase(source, 'sentence')).toBe('Иванов александр. Привет мир');
    expect(source).toBe('иванов александр. ПРИВЕТ МИР');
  });

  it('уменьшает шрифт до расчётного размера, но не ниже минимума', () => {
    expect(
      resolveTextOverflow({
        mode: 'shrink',
        fontSizePt: 30,
        minFontSizePt: 12,
        measuredHeightMm: 40,
        availableHeightMm: 20,
        lineCount: 4,
        maxLines: 3,
      }),
    ).toMatchObject({ appliedFontSizePt: 15, overflowed: false, belowMinimum: false });

    expect(
      resolveTextOverflow({
        mode: 'shrink',
        fontSizePt: 30,
        minFontSizePt: 12,
        measuredHeightMm: 90,
        availableHeightMm: 18,
        lineCount: 8,
        maxLines: 2,
      }),
    ).toMatchObject({ appliedFontSizePt: 12, overflowed: true, belowMinimum: true });
  });
});
