import { describe, expect, it } from 'vitest';

import { assertSafeSvg, validateImageSignature } from './image-repository';

describe('image repository validation', () => {
  it('распознаёт растровые форматы по сигнатуре', () => {
    expect(validateImageSignature('photo.jpg', new Uint8Array([0xff, 0xd8, 0xff]))).toBe(
      'image/jpeg',
    );
    expect(validateImageSignature('photo.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(
      'image/png',
    );
    expect(validateImageSignature('photo.webp', new TextEncoder().encode('RIFF0000WEBP'))).toBe(
      'image/webp',
    );
  });

  it('отклоняет расширение без подходящей сигнатуры', () => {
    expect(() => validateImageSignature('photo.jpg', new Uint8Array([1, 2, 3]))).toThrow();
  });

  it('не допускает исполняемый или внешний SVG', () => {
    expect(() => assertSafeSvg('<svg><rect width="10" height="10"/></svg>')).not.toThrow();
    expect(() => assertSafeSvg('<svg><script>alert(1)</script></svg>')).toThrow(/небезопасные/);
    expect(() => assertSafeSvg('<svg><image href="https://example.com/a.png"/></svg>')).toThrow(
      /внешнюю/,
    );
  });
});
