import type { TextCase, TextOverflowMode } from '../model/canvas-document';
import { clamp } from '../../utils/dimensions';

export function applyTextCase(content: string, textCase: TextCase): string {
  if (textCase === 'upper') return content.toLocaleUpperCase('ru-RU');
  if (textCase === 'lower') return content.toLocaleLowerCase('ru-RU');
  if (textCase === 'title') {
    return content.replace(
      /(^|[\s—–-])([\p{L}])/gu,
      (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('ru-RU')}`,
    );
  }
  if (textCase === 'sentence') {
    const lowered = content.toLocaleLowerCase('ru-RU');
    return lowered.replace(
      /(^|[.!?]\s+)([\p{L}])/gu,
      (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('ru-RU')}`,
    );
  }
  return content;
}

export interface TextOverflowInput {
  mode: TextOverflowMode;
  fontSizePt: number;
  minFontSizePt: number;
  measuredHeightMm: number;
  availableHeightMm: number;
  lineCount: number;
  maxLines?: number;
}

export interface TextOverflowResult {
  overflowed: boolean;
  appliedFontSizePt: number;
  clipped: boolean;
  belowMinimum: boolean;
}

export function resolveTextOverflow(input: TextOverflowInput): TextOverflowResult {
  const heightRatio =
    input.measuredHeightMm > 0 ? input.availableHeightMm / input.measuredHeightMm : 1;
  const lineRatio = input.maxLines ? input.maxLines / Math.max(1, input.lineCount) : 1;
  const fitRatio = Math.min(1, heightRatio, lineRatio);
  const initiallyOverflowed = fitRatio < 0.999;
  if (input.mode !== 'shrink' || !initiallyOverflowed) {
    return {
      overflowed: initiallyOverflowed,
      appliedFontSizePt: input.fontSizePt,
      clipped: input.mode === 'clip' && initiallyOverflowed,
      belowMinimum: false,
    };
  }

  const requiredSize = input.fontSizePt * fitRatio;
  const appliedFontSizePt = clamp(requiredSize, input.minFontSizePt, input.fontSizePt);
  return {
    overflowed: requiredSize < input.minFontSizePt,
    appliedFontSizePt,
    clipped: false,
    belowMinimum: requiredSize < input.minFontSizePt,
  };
}
