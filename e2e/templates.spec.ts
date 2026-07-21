import { expect, test, type Page } from '@playwright/test';

async function independenceState(page: Page, projectId: string) {
  return page.evaluate(async (currentProjectId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('vakha-album-designer');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'));
    });
    const read = <T>(store: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = database.transaction(store, 'readonly').objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error(`Не удалось прочитать ${store}`));
      });
    const templates = await read<{
      id: string;
      payload?: { document?: { layers?: Array<{ id: string }> } };
    }>('templates');
    const layers = await read<{ projectId: string; id: string }>('layers');
    database.close();
    const templateLayers =
      templates.find((template) => template.id === 'system-editorial-red')?.payload?.document
        ?.layers ?? [];
    const projectLayers = layers.filter((layer) => layer.projectId === currentProjectId);
    return {
      templateCount: templateLayers.length,
      projectCount: projectLayers.length,
      idsOverlap: projectLayers.some((layer) =>
        templateLayers.some((templateLayer) => templateLayer.id === layer.id),
      ),
      userTemplates: templates.filter((template) => template.id.startsWith('user-template-'))
        .length,
    };
  }, projectId);
}

test('каталог создаёт независимый проект и переносит редактируемый пакет', async ({ page }) => {
  await page.goto('/templates');
  await expect(page.getByTestId('templates-page')).toBeVisible();
  await expect(page.getByText('Редакционный красный', { exact: true })).toBeVisible();
  await expect(page.getByText('Школьная доска', { exact: true })).toBeVisible();
  await expect(page.getByText('Премьера', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Предпросмотр Редакционный красный' }).click();
  const preview = page.getByRole('dialog', { name: 'Предпросмотр Редакционный красный' });
  await expect(preview).toBeVisible();
  await expect(preview.locator('figure')).toHaveCount(4);
  await expect(preview.getByText(/repeatFor: student/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await preview.getByRole('button', { name: 'Экспортировать' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Экспорт шаблона не создал локальный файл');
  await preview.getByRole('button', { name: 'Закрыть предпросмотр' }).click();

  const editorialCard = page
    .locator('.template-card')
    .filter({ hasText: 'Редакционный красный' })
    .first();
  await editorialCard.getByRole('button', { name: 'Создать проект' }).click();
  await expect(page).toHaveURL(/\/editor\/project-/);
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');
  const projectId = new URL(page.url()).pathname.split('/').pop()!;
  await expect(page.locator('.layer-row__name').filter({ hasText: 'ВЫПУСКНОЙ' })).toBeVisible();

  await page.getByRole('button', { name: 'Текст' }).click();
  let dialogIndex = 0;
  page.on('dialog', async (dialog) => {
    dialogIndex += 1;
    if (dialog.type() === 'prompt') await dialog.accept('Мой редактируемый шаблон');
    else if (dialog.type() === 'confirm') await dialog.dismiss();
    else await dialog.accept();
  });
  await page.getByRole('button', { name: 'В шаблоны' }).click();
  await expect.poll(() => dialogIndex).toBe(3);
  await expect(page.getByText('Сохранено локально')).toBeVisible();

  const state = await independenceState(page, projectId);
  expect(state.projectCount).toBeGreaterThan(state.templateCount);
  expect(state.idsOverlap).toBe(false);
  expect(state.userTemplates).toBeGreaterThan(0);

  await page.goto('/templates');
  await page.getByLabel('Импортировать шаблон').setInputFiles(downloadPath);
  await expect(page.getByRole('status')).toContainText('импортирован');
  await page.getByLabel('Источник шаблона').selectOption('user');
  await expect(page.getByText('Мой редактируемый шаблон', { exact: true })).toBeVisible();
});
