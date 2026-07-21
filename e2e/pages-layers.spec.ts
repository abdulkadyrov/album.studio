import { expect, test, type Page } from '@playwright/test';

interface PersistedStructure {
  pages: Array<{ id: string; order: number; payload?: { spreadId?: string } }>;
  layers: Array<{
    id: string;
    pageId: string;
    parentId?: string;
    zIndex: number;
    payload?: {
      name?: string;
      kind?: string;
      visible?: boolean;
      locked?: boolean;
      xMm?: number;
      yMm?: number;
    };
  }>;
}

async function readStructure(page: Page, projectId: string): Promise<PersistedStructure> {
  return page.evaluate(
    async ({ databaseName, projectId: currentProjectId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'));
      });
      const readStore = <T>(storeName: string) =>
        new Promise<T[]>((resolve, reject) => {
          const request = database
            .transaction(storeName, 'readonly')
            .objectStore(storeName)
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(request.error ?? new Error(`Не удалось прочитать ${storeName}`));
        });
      const pages = await readStore<PersistedStructure['pages'][number]>('pages');
      const layers = await readStore<PersistedStructure['layers'][number]>('layers');
      database.close();
      return {
        pages: pages.filter((record) => record.id.startsWith(currentProjectId)),
        layers: layers.filter((record) => record.id.startsWith(currentProjectId)),
      };
    },
    { databaseName: 'vakha-album-designer', projectId },
  );
}

test('слои, группы и порядок страниц восстанавливаются после reload', async ({
  page,
}, testInfo) => {
  const projectId = `stage3-${testInfo.project.name}`;
  await page.goto(`/editor/${projectId}`);
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');

  const geometry = page.getByText('Геометрический блок', { exact: true });
  await geometry.click();
  await page.getByRole('button', { name: 'Дублировать слой' }).click();
  const geometryCopy = page.getByText('Геометрический блок — копия', { exact: true });
  await page.getByRole('button', { name: 'Опустить слой' }).click();
  await geometry.click();
  await geometryCopy.click({ modifiers: ['Meta'] });
  await page.getByRole('button', { name: 'Сгруппировать выбранные слои' }).click();
  const groupName = page.getByText('Новая группа', { exact: true });
  await groupName.dblclick();
  const groupNameInput = page.getByRole('textbox', { name: 'Название слоя' });
  await groupNameInput.fill('Группа портретов');
  await groupNameInput.press('Enter');
  await expect(page.getByText('Группа портретов', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Скрыть Группа портретов' }).click();
  await expect(page.getByRole('button', { name: 'Показать Группа портретов' })).toBeVisible();
  await page.getByRole('button', { name: 'Заблокировать Группа портретов' }).click();
  await expect(page.getByRole('button', { name: 'Разблокировать Группа портретов' })).toBeVisible();

  const pageGroups = page.locator('[data-testid^="page-group-"]');
  await pageGroups.first().getByRole('button', { name: 'Дублировать страницу' }).click();
  await expect(pageGroups).toHaveCount(2);
  await page
    .getByTestId('page-strip')
    .getByRole('button', { name: 'Страница', exact: true })
    .click();
  await expect(pageGroups).toHaveCount(3);
  page.once('dialog', (dialog) => void dialog.accept());
  await pageGroups.last().getByRole('button', { name: 'Удалить страницу' }).click();
  await expect(pageGroups).toHaveCount(2);
  await page
    .getByTestId('page-strip')
    .getByRole('button', { name: 'Разворот', exact: true })
    .click();
  await expect(pageGroups).toHaveCount(3);
  await pageGroups.last().getByRole('button', { name: 'Переместить страницу влево' }).click();
  await expect(page.getByText('Сохранено локально')).toBeVisible();

  const beforeReload = await readStructure(page, projectId);
  expect(beforeReload.pages).toHaveLength(6);
  expect(beforeReload.layers).toHaveLength(8);
  expect(beforeReload.pages.map((record) => record.order).sort((a, b) => a - b)).toEqual([
    0, 1, 2, 3, 4, 5,
  ]);
  const persistedGroup = beforeReload.layers.find((record) => record.payload?.kind === 'group');
  expect(persistedGroup?.payload).toMatchObject({ visible: false, locked: true });
  expect(
    beforeReload.layers.filter((record) => record.parentId === persistedGroup?.id),
  ).toHaveLength(2);
  const originalLayer = beforeReload.layers.find(
    (record) => record.payload?.name === 'Геометрический блок',
  );
  const copiedLayer = beforeReload.layers.find(
    (record) => record.payload?.name === 'Геометрический блок — копия',
  );
  expect(copiedLayer?.zIndex).toBeLessThan(originalLayer?.zIndex ?? 0);
  expect(originalLayer?.payload).toMatchObject({ xMm: 44, yMm: 48 });

  await page.reload();
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');
  await expect(pageGroups).toHaveCount(3);
  const restoredGroup = page.getByText('Группа портретов', { exact: true });
  await expect(restoredGroup).toBeVisible();
  await expect(page.getByRole('button', { name: 'Показать Группа портретов' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Разблокировать Группа портретов' })).toBeVisible();

  await restoredGroup.click();
  await page.getByRole('button', { name: 'Разгруппировать' }).click();
  await expect(restoredGroup).toHaveCount(0);
  await page.getByRole('button', { name: /Отменить: Разгруппировка слоёв/ }).click();
  await expect(page.getByText('Группа портретов', { exact: true })).toBeVisible();
});
