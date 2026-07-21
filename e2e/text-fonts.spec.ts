import { expect, test, type Page } from '@playwright/test';

const TEST_FONT_PATH = 'node_modules/playwright-core/lib/vite/recorder/assets/codicon-DCmgc-ay.ttf';
const TEST_FONT_FAMILY = 'codicon-DCmgc-ay';

async function textPoint(page: Page): Promise<{ x: number; y: number }> {
  return page.getByTestId('canvas-workspace').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const zoom = Number(element.dataset.zoom);
    const viewportX = Number(element.dataset.viewportX);
    const viewportY = Number(element.dataset.viewportY);
    return {
      x: bounds.x + viewportX + 45 * 3 * zoom,
      y: bounds.y + viewportY + 42 * 3 * zoom,
    };
  });
}

async function selectTextLayer(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Слои' }).click();
  await page.getByText('Текстовый слой', { exact: true }).click();
  await page.getByRole('tab', { name: 'Свойства' }).click();
}

test('текст, overflow и пользовательский шрифт восстанавливаются после reload', async ({
  page,
}, testInfo) => {
  const projectId = `stage4-${testInfo.project.name}`;
  await page.goto(`/editor/${projectId}`);
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: 'Текст' }).click();

  const point = await textPoint(page);
  await page.mouse.dblclick(point.x, point.y);
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('Выпускной альбом');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Содержимое текста')).toHaveValue('Выпускной альбом');
  await expect(page.getByRole('button', { name: /Отменить: Редактирование текста/ })).toBeEnabled();
  await page.getByRole('button', { name: /Отменить: Редактирование текста/ }).click();
  await expect(page.getByLabel('Содержимое текста')).toHaveValue('Введите текст');
  await page.getByRole('button', { name: /Повторить: Редактирование текста/ }).click();
  await expect(page.getByLabel('Содержимое текста')).toHaveValue('Выпускной альбом');

  await page.getByLabel('Файл шрифта').setInputFiles(TEST_FONT_PATH);
  const fontSelect = page.getByLabel('Семейство шрифта');
  await expect(fontSelect.locator('option').filter({ hasText: TEST_FONT_FAMILY })).toHaveCount(1);
  const customFontValue = await fontSelect
    .locator('option')
    .filter({ hasText: TEST_FONT_FAMILY })
    .getAttribute('value');
  if (!customFontValue) throw new Error('Пользовательский шрифт не добавлен в список');
  await fontSelect.selectOption(customFontValue);
  await page.getByRole('button', { name: 'Жирный' }).click();
  await page.getByLabel('Выравнивание').selectOption('center');
  await page.getByLabel('По вертикали').selectOption('middle');
  await page.getByLabel('Регистр').selectOption('upper');

  const content = page.getByLabel('Содержимое текста');
  await content.fill(
    'Очень длинный заголовок выпускного альбома, который намеренно не помещается в одну строку',
  );
  await content.blur();
  await page.getByLabel('Высота, мм').fill('8');
  await page.getByLabel('Макс. строк').fill('1');
  await expect(page.getByText(/Текст не помещается/)).toBeVisible();
  await page.getByLabel('Переполнение').selectOption('shrink');
  await page.getByRole('tab', { name: 'Эффекты' }).click();
  await page.getByLabel('Тень').check();
  await page.getByRole('tab', { name: 'Свойства' }).click();
  await expect(page.getByText('Сохранено локально')).toBeVisible();

  await page.reload();
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');
  await selectTextLayer(page);
  await expect(page.getByLabel('Семейство шрифта')).toHaveValue(customFontValue);
  expect(
    await page.evaluate((family) => document.fonts.check(`16px "${family}"`), TEST_FONT_FAMILY),
  ).toBe(true);
  await expect(page.getByRole('button', { name: `В избранное ${TEST_FONT_FAMILY}` })).toBeVisible();
  await page.getByRole('button', { name: `В избранное ${TEST_FONT_FAMILY}` }).click();
  await expect(
    page.getByRole('button', { name: `Убрать из избранного ${TEST_FONT_FAMILY}` }),
  ).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: `Удалить шрифт ${TEST_FONT_FAMILY}` }).click();
  await expect(page.getByRole('alert')).toContainText(`Шрифт «${TEST_FONT_FAMILY}» отсутствует`);
  await expect(page.getByLabel('Семейство шрифта')).toHaveValue(customFontValue);

  const stored = await page.evaluate(
    async ({ databaseName, projectId: currentProjectId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'));
      });
      const read = <T>(storeName: string) =>
        new Promise<T[]>((resolve, reject) => {
          const request = database
            .transaction(storeName, 'readonly')
            .objectStore(storeName)
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () =>
            reject(request.error ?? new Error(`Не удалось прочитать ${storeName}`));
        });
      const assets = await read<{ kind?: string }>('assets');
      const layers = await read<{
        projectId: string;
        payload?: { text?: { fontFamily?: string; content?: string } };
      }>('layers');
      database.close();
      return {
        fontAssets: assets.filter((asset) => asset.kind === 'font').length,
        text: layers.find((layer) => layer.projectId === currentProjectId && layer.payload?.text)
          ?.payload?.text,
      };
    },
    { databaseName: 'vakha-album-designer', projectId },
  );
  expect(stored.fontAssets).toBe(0);
  expect(stored.text?.fontFamily).toBe(TEST_FONT_FAMILY);
  expect(stored.text?.content).toContain('Очень длинный заголовок');
});
