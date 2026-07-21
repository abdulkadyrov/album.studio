import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function seedPrintableProject(page: Page, projectId: string) {
  await page.evaluate(async (id) => {
    const now = new Date().toISOString();
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('vakha-album-designer');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'));
    });
    const transaction = database.transaction(['projects', 'pages', 'layers'], 'readwrite');
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Транзакция не завершена'));
    });
    const put = (store: string, value: unknown) =>
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(store).put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error(`Не удалось записать ${store}`));
      });
    const pagePayload = {
      id: `${id}:page-print`,
      title: 'Print 1 inch',
      order: 0,
      widthMm: 25.4,
      heightMm: 25.4,
      bleedMm: 0,
      safeZoneMm: 0,
      gridStepMm: 5,
      updatedAt: now,
    };
    const layerPayload = {
      id: `${id}:layer-rect`,
      pageId: pagePayload.id,
      name: 'Плашка',
      kind: 'rect',
      visible: true,
      locked: false,
      zIndex: 0,
      xMm: 0,
      yMm: 0,
      widthMm: 25.4,
      heightMm: 25.4,
      rotationDeg: 0,
      fill: '#7657e8',
      stroke: 'transparent',
      strokeWidthMm: 0,
      opacity: 1,
    };
    await put('projects', {
      id,
      name: 'Print Gate',
      schoolName: '',
      className: '',
      academicYear: '2026',
      status: 'draft',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    await put('pages', {
      id: pagePayload.id,
      projectId: id,
      order: 0,
      type: 'canvas-page',
      payload: pagePayload,
    });
    await put('layers', {
      id: layerPayload.id,
      projectId: id,
      pageId: pagePayload.id,
      type: 'rect',
      zIndex: 0,
      payload: layerPayload,
    });
    await done;
    database.close();
  }, projectId);
}

function pngSize(bytes: Buffer) {
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test('экспорт создаёт PNG с точными пикселями и настоящий PDF', async ({ page }) => {
  const projectId = `export-gate-${Date.now()}`;
  await page.goto('/projects');
  await seedPrintableProject(page, projectId);

  await page.goto(`/projects/${projectId}/export`);
  await expect(page.getByRole('heading', { name: 'Экспорт' })).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Формат экспорта' })
    .getByRole('radio', { name: 'PNG' })
    .click();
  await page.getByLabel('DPI экспорта').selectOption('150');

  const pngDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспортировать' }).click();
  const pngPath = await (await pngDownloadPromise).path();
  if (!pngPath) throw new Error('PNG download path missing');
  const png = await readFile(pngPath);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(pngSize(png)).toEqual({ width: 150, height: 150 });

  await page
    .getByRole('radiogroup', { name: 'Формат экспорта' })
    .getByRole('radio', { name: 'PDF' })
    .click();
  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспортировать' }).click();
  const pdfPath = await (await pdfDownloadPromise).path();
  if (!pdfPath) throw new Error('PDF download path missing');
  const pdf = await readFile(pdfPath, 'utf8');
  expect(pdf.startsWith('%PDF-1.7')).toBe(true);
  expect(pdf).toContain('/MediaBox [0 0 72 72]');
});
