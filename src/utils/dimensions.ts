export const MILLIMETERS_PER_INCH = 25.4;
export const EDITOR_PIXELS_PER_MM = 3;

export function millimetersToPixels(millimeters: number, dpi: number): number {
  if (!Number.isFinite(millimeters) || millimeters < 0) {
    throw new RangeError('Размер в миллиметрах должен быть конечным неотрицательным числом');
  }
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError('DPI должен быть конечным положительным числом');
  }

  return (millimeters / MILLIMETERS_PER_INCH) * dpi;
}

export function millimetersToLogicalPixels(millimeters: number): number {
  return millimeters * EDITOR_PIXELS_PER_MM;
}

export function logicalPixelsToMillimeters(pixels: number): number {
  return pixels / EDITOR_PIXELS_PER_MM;
}

export function roundMillimeters(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
