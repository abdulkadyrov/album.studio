import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.join(root, 'fixtures', 'large-project.fixture.json');
const outDir = path.join(root, 'test-results');
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

function now() {
  return performance.now();
}

const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  const started = now();
  await page.goto(`${baseURL}/projects`);
  await page.evaluate(
    async ({ documentFixture }) => {
      const database = await new Promise((resolve, reject) => {
        const request = globalThis.indexedDB.open('vakha-album-designer');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Не удалось открыть IndexedDB'));
      });
      const projectId = documentFixture.projectId;
      const tx = database.transaction(['projects', 'pages', 'layers'], 'readwrite');
      const done = new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Транзакция не завершена'));
      });
      const put = (store, value) =>
        new Promise((resolve, reject) => {
          const request = tx.objectStore(store).put(value);
          request.onsuccess = () => resolve();
          request.onerror = () =>
            reject(request.error ?? new Error(`Не удалось записать ${store}`));
        });
      const timestamp = new Date().toISOString();
      await put('projects', {
        id: projectId,
        name: 'Large Profile Fixture',
        schoolName: 'Synthetic School',
        className: '11-П',
        academicYear: '2026',
        status: 'draft',
        schemaVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      for (const pagePayload of documentFixture.pages) {
        await put('pages', {
          id: pagePayload.id,
          projectId,
          order: pagePayload.order,
          type: 'canvas-page',
          payload: { ...pagePayload, updatedAt: documentFixture.updatedAt },
        });
      }
      for (const layerPayload of documentFixture.layers) {
        await put('layers', {
          id: layerPayload.id,
          projectId,
          pageId: layerPayload.pageId,
          type: layerPayload.kind,
          zIndex: layerPayload.zIndex,
          payload: layerPayload,
        });
      }
      await done;
      database.close();
    },
    { documentFixture: fixture.document },
  );
  const seedMs = Math.round(now() - started);

  const validationStarted = now();
  await page.goto(`${baseURL}/projects/${fixture.document.projectId}/validation`);
  await page.getByRole('heading', { name: 'Проверка проекта' }).waitFor({ timeout: 15000 });
  const validationMs = Math.round(now() - validationStarted);

  const exportStarted = now();
  await page.goto(`${baseURL}/projects/${fixture.document.projectId}/export`);
  await page.getByRole('heading', { name: 'Экспорт' }).waitFor({ timeout: 15000 });
  const exportRouteMs = Math.round(now() - exportStarted);

  const metrics = {
    generatedAt: new Date().toISOString(),
    baseURL,
    projectId: fixture.document.projectId,
    pages: fixture.document.pages.length,
    layers: fixture.document.layers.length,
    seedMs,
    validationRouteMs: validationMs,
    exportRouteMs,
    heap: await page.evaluate(() => {
      const memory = performance.memory;
      return memory
        ? {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          }
        : null;
    }),
    targets: fixture.profileTargets,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'large-project-profile.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
  );
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  await browser.close();
}
