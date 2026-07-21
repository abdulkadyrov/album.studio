import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';

async function makeClassArchive(path: string, assetPath = 'assets/ivanov.jpg') {
  const zip = new JSZip();
  const photo = Buffer.from('photo-bytes');
  zip.file(
    'manifest.json',
    JSON.stringify({
      format: 'vakha-class',
      version: 1,
      class: { schoolName: 'Школа №25', className: '4А', academicYear: '2026' },
      students: [
        {
          externalId: 's-1',
          firstName: 'Александр',
          lastName: 'Иванов',
          status: 'ready',
          photos: [{ path: assetPath, mimeType: 'image/jpeg', byteSize: photo.byteLength }],
        },
      ],
      teachers: [
        {
          externalId: 't-1',
          firstName: 'Мария',
          lastName: 'Петрова',
          status: 'needs-review',
          photos: [],
        },
      ],
    }),
  );
  zip.file(assetPath.startsWith('assets/') ? assetPath : 'assets/ivanov.jpg', photo);
  await writeFile(path, Buffer.from(await zip.generateAsync({ type: 'arraybuffer' })));
}

async function readClassState(page: Page, projectId: string) {
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
    const participants = (await read<{ projectId: string; status: string }>('participants')).filter(
      (participant) => participant.projectId === currentProjectId,
    );
    const photos = (await read<{ projectId: string }>('participantPhotos')).filter(
      (photo) => photo.projectId === currentProjectId,
    );
    database.close();
    return { participants: participants.length, photos: photos.length };
  }, projectId);
}

test('импорт класса делает preview, отклоняет unsafe archive и записывает valid archive', async ({
  page,
}, testInfo) => {
  const projectId = `class-${testInfo.project.name}`;
  const invalidPath = testInfo.outputPath('invalid.vsclass');
  const validPath = testInfo.outputPath('valid.vsclass');
  await makeClassArchive(invalidPath, '../ivanov.jpg');
  await makeClassArchive(validPath);

  await page.goto(`/projects/${projectId}/import-class`);
  await page.getByLabel('Выбрать .vsclass').setInputFiles(invalidPath);
  await expect(page.getByRole('status')).toContainText('небезопасный путь');
  await expect
    .poll(() => readClassState(page, projectId))
    .toMatchObject({
      participants: 0,
      photos: 0,
    });

  await page.getByLabel('Выбрать .vsclass').setInputFiles(validPath);
  await expect(page.getByText('Иванов Александр')).toBeVisible();
  await expect(page.getByText('Петрова Мария')).toBeVisible();
  await page.getByRole('button', { name: 'Записать в проект' }).click();
  await expect(page.getByRole('status')).toContainText('Импортировано: 2');
  await expect
    .poll(() => readClassState(page, projectId))
    .toMatchObject({
      participants: 2,
      photos: 1,
    });

  await page.getByRole('link', { name: 'Открыть участников' }).click();
  await expect(page.getByRole('heading', { name: 'Участники' })).toBeVisible();
  await expect(page.getByText('Иванов Александр')).toBeVisible();
});

test('инструменты редактора переключают визуальное выделение', async ({ page }) => {
  await page.goto('/editor/preview');
  await expect(page.getByTestId('canvas-workspace')).toHaveAttribute('data-status', 'ready');

  const select = page.getByRole('button', { name: 'Выделение' });
  const text = page.getByRole('button', { name: 'Текст', exact: true });
  const pan = page.getByRole('button', { name: 'Рука', exact: true });

  await expect(select).toHaveClass(/is-active/);
  await text.click();
  await expect(text).toHaveClass(/is-active/);
  await expect(select).not.toHaveClass(/is-active/);
  await pan.click();
  await expect(pan).toHaveClass(/is-active/);
  await expect(text).not.toHaveClass(/is-active/);
  await select.click();
  await expect(select).toHaveClass(/is-active/);
  await expect(pan).not.toHaveClass(/is-active/);
});
