import type { RenderedPage } from './print-renderer';

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

export async function createRasterPdf(pages: RenderedPage[]): Promise<Blob> {
  if (pages.length === 0) throw new Error('Нет страниц для PDF');
  const objects: Uint8Array[] = [];
  const catalogObject = 1;
  const pagesObject = 2;
  const pageObjects: number[] = [];
  const contentObjects: number[] = [];
  const imageObjects: number[] = [];
  let nextObject = 3;

  for (const page of pages) {
    pageObjects.push(nextObject++);
    contentObjects.push(nextObject++);
    imageObjects.push(nextObject++);
    if (!page.jpegBlob) page.jpegBlob = await page.canvasToJpeg();
  }

  objects[catalogObject] = ascii('<< /Type /Catalog /Pages 2 0 R >>');
  objects[pagesObject] = ascii(
    `<< /Type /Pages /Count ${pages.length} /Kids ${pageObjects
      .map((id) => `${id} 0 R`)
      .join(' ')} >>`,
  );

  for (const [index, page] of pages.entries()) {
    const pageId = pageObjects[index]!;
    const contentId = contentObjects[index]!;
    const imageId = imageObjects[index]!;
    const imageName = `Im${index + 1}`;
    const content = ascii(`q ${page.widthPt} 0 0 ${page.heightPt} 0 0 cm /${imageName} Do Q`);
    const image = await blobBytes(page.jpegBlob!);

    objects[pageId] = ascii(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.widthPt} ${page.heightPt}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects[contentId] = concat([
      ascii(`<< /Length ${content.byteLength} >>\nstream\n`),
      content,
      ascii('\nendstream'),
    ]);
    objects[imageId] = concat([
      ascii(
        `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.byteLength} >>\nstream\n`,
      ),
      image,
      ascii('\nendstream'),
    ]);
  }

  const parts: Uint8Array[] = [ascii('%PDF-1.7\n%Vakha\n')];
  const offsets = [0];
  let cursor = parts[0]!.byteLength;
  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    offsets[objectId] = cursor;
    const body = objects[objectId]!;
    const object = concat([ascii(`${objectId} 0 obj\n`), body, ascii('\nendobj\n')]);
    parts.push(object);
    cursor += object.byteLength;
  }
  const xrefOffset = cursor;
  const xref = [
    `xref\n0 ${objects.length}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    `trailer\n<< /Size ${objects.length} /Root ${catalogObject} 0 R >>`,
    `startxref\n${xrefOffset}`,
    '%%EOF',
  ].join('\n');
  parts.push(ascii(xref));
  return new Blob([concat(parts)], { type: 'application/pdf' });
}
