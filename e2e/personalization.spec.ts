import { expect, test, type Page } from '@playwright/test';

async function seedPersonalizationProject(page: Page, projectId: string) {
  await page.evaluate(async (id) => {
    const now = new Date().toISOString();
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('vakha-album-designer');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'));
    });
    const transaction = database.transaction(
      ['projects', 'pages', 'layers', 'participants', 'overrides'],
      'readwrite',
    );
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
    await put('projects', {
      id,
      name: 'Персональный тест',
      schoolName: 'Школа №25',
      className: '4А',
      academicYear: '2026',
      status: 'draft',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    const pagePayload = {
      id: `${id}:page-portrait`,
      title: 'Портрет',
      order: 0,
      widthMm: 200,
      heightMm: 200,
      bleedMm: 3,
      safeZoneMm: 5,
      gridStepMm: 5,
      pageType: 'portrait',
      repeatFor: 'student',
      updatedAt: now,
    };
    await put('pages', {
      id: pagePayload.id,
      projectId: id,
      order: 0,
      type: 'canvas-page',
      payload: pagePayload,
    });
    const layerPayload = {
      id: `${id}:layer-name`,
      pageId: pagePayload.id,
      name: 'Имя участника',
      kind: 'text',
      visible: true,
      locked: false,
      zIndex: 0,
      xMm: 20,
      yMm: 20,
      widthMm: 100,
      heightMm: 22,
      rotationDeg: 0,
      fill: '#202737',
      stroke: 'transparent',
      strokeWidthMm: 0,
      opacity: 1,
      binding: { source: 'participant', field: 'fullName', fallback: 'ФИО' },
      text: {
        content: 'ФИО',
        fontFamily: 'sans-serif',
        fontSizePt: 24,
        minFontSizePt: 10,
        fontWeight: 'normal',
        fontStyle: 'normal',
        underline: false,
        linethrough: false,
        textAlign: 'left',
        verticalAlign: 'top',
        letterSpacingEm: 0,
        lineHeight: 1.16,
        textCase: 'original',
        paddingMm: 2,
        direction: 'ltr',
        boxMode: 'auto',
        maxLines: 2,
        overflowMode: 'warn',
        shadow: {
          enabled: false,
          color: '#000000',
          opacity: 0.35,
          blur: 4,
          offsetXmm: 1,
          offsetYmm: 1,
        },
      },
    };
    await put('layers', {
      id: layerPayload.id,
      projectId: id,
      pageId: pagePayload.id,
      type: 'text',
      zIndex: 0,
      payload: layerPayload,
    });
    await put('participants', {
      id: `${id}:student-a`,
      projectId: id,
      type: 'student',
      firstName: 'Александр',
      lastName: 'Иванов',
      status: 'ready',
      updatedAt: now,
    });
    await put('participants', {
      id: `${id}:student-b`,
      projectId: id,
      type: 'student',
      firstName: 'Мария',
      lastName: 'Петрова',
      status: 'ready',
      updatedAt: now,
    });
    await done;
    database.close();
  }, projectId);
}

async function readPersonalizationState(page: Page, projectId: string) {
  return page.evaluate(async (id) => {
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
    const layers = await read<{ projectId: string; payload: { id: string; xMm: number } }>(
      'layers',
    );
    const overrides = await read<{
      projectId: string;
      participantId: string;
      layerId: string;
      patch: { xMm?: number; fill?: string };
    }>('overrides');
    database.close();
    return {
      baseX: layers.find(
        (layer) => layer.projectId === id && layer.payload.id.endsWith('layer-name'),
      )?.payload.xMm,
      overrides: overrides.filter((override) => override.projectId === id),
    };
  }, projectId);
}

test('редактор применяет bindings участника и сохраняет только layer override', async ({
  page,
}) => {
  const projectId = `personalization-${Date.now()}`;
  await page.goto('/projects');
  await seedPersonalizationProject(page, projectId);

  await page.goto(`/editor/${projectId}`);
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');
  await page.locator('.editor-mode-switch select').selectOption(`${projectId}:student-a`);
  await expect(page.getByRole('tab', { name: 'Привязки' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('tab', { name: 'Слои' }).click();
  await page.getByTestId(`layer-row-${projectId}:layer-name`).click();
  await page.getByRole('tab', { name: 'Свойства' }).click();
  await expect(page.getByLabel('Содержимое текста')).toHaveValue('Иванов Александр');

  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Сохранено локально')).toBeVisible();
  await expect
    .poll(() => readPersonalizationState(page, projectId))
    .toMatchObject({
      baseX: 20,
      overrides: [
        {
          participantId: `${projectId}:student-a`,
          layerId: `${projectId}:layer-name`,
          patch: { xMm: 21 },
        },
      ],
    });

  await page.locator('.editor-mode-switch select').selectOption(`${projectId}:student-b`);
  await page.getByRole('tab', { name: 'Слои' }).click();
  await page.getByTestId(`layer-row-${projectId}:layer-name`).click();
  await page.getByRole('tab', { name: 'Свойства' }).click();
  await expect(page.getByLabel('Содержимое текста')).toHaveValue('Петрова Мария');
});
