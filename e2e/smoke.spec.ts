import { expect, test } from '@playwright/test';

test('основная оболочка и маршруты открываются', async ({ page }) => {
  await page.goto('/projects');

  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Шаблоны' })).toBeVisible();

  await page.getByRole('link', { name: 'Шаблоны' }).click();
  await expect(page.getByRole('heading', { name: 'Каталог шаблонов' })).toBeVisible();

  await page.goto('/editor/preview');
  await expect(page.getByTestId('editor-shell')).toBeVisible();
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');
});

test('минимальный настольный размер не создаёт вертикальную прокрутку редактора', async ({
  page,
}) => {
  await page.goto('/editor/preview');

  const dimensions = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));

  expect(dimensions.scrollHeight).toBe(dimensions.clientHeight);
});
