import { expect, test, type Page } from '@playwright/test';

const TEST_IMAGE_PATH = 'node_modules/playwright-core/lib/tools/dashboard/appIcon.png';

async function storedImageState(page: Page, projectId: string) {
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
    const assets = await read<{
      id: string;
      projectId?: string;
      kind: string;
      byteSize: number;
      hash?: string;
      sourceAssetId?: string;
    }>('assets');
    const layers = await read<{
      projectId: string;
      payload?: {
        image?: {
          assetId: string;
          cropX: number;
          zoom: number;
          effects: { contrast: number; grayscale: boolean };
        };
      };
    }>('layers');
    database.close();
    const original = assets.find(
      (asset) => asset.projectId === currentProjectId && asset.kind === 'image',
    );
    return {
      original,
      thumbnails: assets.filter(
        (asset) => asset.kind === 'thumbnail' && asset.sourceAssetId === original?.id,
      ).length,
      image: layers.find((layer) => layer.projectId === currentProjectId && layer.payload?.image)
        ?.payload?.image,
    };
  }, projectId);
}

test('оригинал, crop, эффекты и фоторамка восстанавливаются после reload', async ({
  page,
}, testInfo) => {
  const projectId = `stage5-${testInfo.project.name}`;
  await page.goto(`/editor/${projectId}`);
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Фоторамка' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(TEST_IMAGE_PATH);

  await expect(page.getByText('appIcon.png', { exact: true })).toBeVisible();
  await page.getByLabel('Форма фоторамки').selectOption('circle');
  await page.getByLabel('Фокус по X').fill('0.25');
  await page.getByLabel('Масштаб кадра').fill('1.5');
  await page.getByRole('tab', { name: 'Эффекты' }).click();
  await page.getByLabel('Контраст').fill('0.3');
  await page.getByLabel('Ч/б').check();
  await page.getByLabel('Тень изображения').check();
  await page.getByRole('tab', { name: 'Свойства' }).click();
  await expect(page.getByText(/Эффективно: \d+ DPI/)).toBeVisible();
  await expect(page.getByText('Сохранено локально')).toBeVisible();

  const beforeReload = await storedImageState(page, projectId);
  expect(beforeReload.original?.hash).toBeTruthy();
  expect(beforeReload.thumbnails).toBe(1);

  await page.reload();
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('tab', { name: 'Слои' }).click();
  await page.locator('.layer-row__name').getByText('Фоторамка', { exact: true }).click();
  await page.getByRole('tab', { name: 'Свойства' }).click();
  await expect(page.getByLabel('Форма фоторамки')).toHaveValue('circle');
  await expect(page.getByLabel('Фокус по X')).toHaveValue('0.25');
  await expect(page.getByLabel('Масштаб кадра')).toHaveValue('1.5');
  await page.getByRole('tab', { name: 'Эффекты' }).click();
  await expect(page.getByLabel('Контраст')).toHaveValue('0.3');
  await expect(page.getByLabel('Ч/б')).toBeChecked();

  const afterReload = await storedImageState(page, projectId);
  expect(afterReload.original).toEqual(beforeReload.original);
  expect(afterReload.image?.cropX).toBe(0.25);
  expect(afterReload.image?.zoom).toBe(1.5);
  expect(afterReload.image?.effects).toMatchObject({ contrast: 0.3, grayscale: true });
});
