import { expect, test, type Page } from '@playwright/test';

async function readObjectX(page: Page, projectId: string): Promise<number | undefined> {
  return page.evaluate(
    async ({ databaseName, objectId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(
            request.error instanceof Error
              ? request.error
              : new Error('Не удалось открыть IndexedDB'),
          );
      });

      const records = await new Promise<Array<{ payload?: { id?: string; xMm?: number } }>>(
        (resolve, reject) => {
          const transaction = database.transaction('layers', 'readonly');
          const request = transaction.objectStore('layers').getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(
              request.error instanceof Error
                ? request.error
                : new Error('Не удалось прочитать слои IndexedDB'),
            );
        },
      );
      database.close();
      return records.find((record) => record.payload?.id === objectId)?.payload?.xMm;
    },
    { databaseName: 'vakha-album-designer', objectId: `${projectId}:object-geometry` },
  );
}

test('трансформация, Undo/Redo и IndexedDB работают одной транзакцией', async ({
  page,
}, testInfo) => {
  const projectId = `stage2-${testInfo.project.name}`;
  await page.goto(`/editor/${projectId}`);
  const workspace = page.getByTestId('canvas-workspace');
  await expect(workspace).toHaveAttribute('data-status', 'ready');

  const canvas = workspace.locator('.upper-canvas');
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Холст не получил экранные размеры');

  await page.mouse.click(bounds.x + 220, bounds.y + 245);
  await expect(page.getByText('Геометрический блок')).toBeVisible();

  await page.mouse.move(bounds.x + 220, bounds.y + 245);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 265, bounds.y + 245, { steps: 5 });
  await page.mouse.up();

  const undo = page.getByRole('button', { name: /Отменить: Перемещение объекта/ });
  await expect(undo).toBeEnabled();
  await expect(page.getByText('Сохранено локально')).toBeVisible();
  const movedX = await readObjectX(page, projectId);
  expect(movedX).toBeGreaterThan(44);

  await undo.click();
  await expect(page.getByRole('button', { name: /Повторить: Перемещение объекта/ })).toBeEnabled();
  await expect.poll(() => readObjectX(page, projectId)).toBe(44);

  await page.getByRole('button', { name: /Повторить: Перемещение объекта/ }).click();
  await expect.poll(() => readObjectX(page, projectId)).toBe(movedX);

  await page.reload();
  await expect(workspace).toHaveAttribute('data-status', 'ready');
  await expect.poll(() => readObjectX(page, projectId)).toBe(movedX);
});
