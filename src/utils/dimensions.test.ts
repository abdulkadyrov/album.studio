import {
  EDITOR_PIXELS_PER_MM,
  logicalPixelsToMillimeters,
  millimetersToLogicalPixels,
  millimetersToPixels,
  roundMillimeters,
} from './dimensions';

describe('dimensions', () => {
  it('переводит миллиметры в печатные пиксели', () => {
    expect(millimetersToPixels(25.4, 300)).toBe(300);
    expect(Math.round(millimetersToPixels(200, 300))).toBe(2362);
  });

  it('отделяет логические координаты редактора от DPI', () => {
    expect(millimetersToLogicalPixels(20)).toBe(20 * EDITOR_PIXELS_PER_MM);
    expect(logicalPixelsToMillimeters(60)).toBe(20);
  });

  it('округляет отображаемые миллиметры до десятых', () => {
    expect(roundMillimeters(12.349)).toBe(12.3);
    expect(roundMillimeters(12.351)).toBe(12.4);
  });

  it('отклоняет некорректные размеры', () => {
    expect(() => millimetersToPixels(-1, 300)).toThrow(RangeError);
    expect(() => millimetersToPixels(10, 0)).toThrow(RangeError);
  });
});
