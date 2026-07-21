import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function seedProject(page: Page, projectId: string) {
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
      id: `${id}:page-1`,
      title: 'Страница 1',
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
      name: 'Фон',
      kind: 'rect',
      visible: true,
      locked: false,
      zIndex: 0,
      xMm: 0,
      yMm: 0,
      widthMm: 25.4,
      heightMm: 25.4,
      rotationDeg: 0,
      fill: '#ffffff',
      stroke: 'transparent',
      strokeWidthMm: 0,
      opacity: 1,
    };
    await put('projects', {
      id,
      name: 'Workspace Gate',
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

test('рабочие материалы сохраняются локально и не попадают в PDF альбома', async ({
  page,
}, testInfo) => {
  const projectId = `workspace-${testInfo.project.name}`;
  const annotationTitle = 'Invisible QA note unique';
  await page.goto('/projects');
  await seedProject(page, projectId);

  await page.goto(`/projects/${projectId}/references`);
  await page.getByLabel('Название').fill('Минималистичная обложка');
  await page.getByLabel('URL / источник').fill('https://example.com/reference');
  await page.getByLabel('Заметки').fill('Белая бумага, крупный год');
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByRole('status')).toContainText('Референс сохранён');
  await expect(page.getByText('Минималистичная обложка')).toBeVisible();
  await page.getByPlaceholder('Поиск референсов').fill('бумага');
  await expect(page.getByText('Минималистичная обложка')).toBeVisible();

  await page.goto(`/projects/${projectId}/ideas`);
  await page.getByLabel('Название').fill('Цитаты рядом с портретом');
  await page.getByLabel('Описание').fill('Поставить короткие фразы вокруг фото');
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByRole('status')).toContainText('Идея сохранена');
  await page.getByRole('button', { name: 'В работу' }).click();
  await expect(page.getByRole('status')).toContainText('Идея переведена');

  await page.goto(`/projects/${projectId}/annotations`);
  await page.getByLabel('Заголовок').fill(annotationTitle);
  await page.getByLabel('Комментарий').fill('Рабочий комментарий для дизайнера');
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByRole('status')).toContainText('Аннотация сохранена');
  await expect(page.getByText(annotationTitle)).toBeVisible();

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON' }).click();
  const jsonPath = await (await jsonDownloadPromise).path();
  if (!jsonPath) throw new Error('JSON download path missing');
  const annotationJson = await readFile(jsonPath, 'utf8');
  expect(annotationJson).toContain(annotationTitle);
  expect(annotationJson).toContain('vakha-annotations');

  await page.goto(`/projects/${projectId}/export`);
  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспортировать' }).click();
  const pdfPath = await (await pdfDownloadPromise).path();
  if (!pdfPath) throw new Error('PDF download path missing');
  const pdf = await readFile(pdfPath, 'utf8');
  expect(pdf.startsWith('%PDF-1.7')).toBe(true);
  expect(pdf).not.toContain(annotationTitle);
});
