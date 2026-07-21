import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturesDir = path.join(root, 'fixtures');

function svgAvatar(name, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <rect width="800" height="1000" fill="${color}"/>
  <circle cx="400" cy="320" r="150" fill="#f8fafc"/>
  <rect x="190" y="540" width="420" height="260" rx="80" fill="#f8fafc"/>
  <text x="400" y="900" text-anchor="middle" font-family="Arial" font-size="52" fill="#111827">${name}</text>
</svg>`;
}

async function createClassFixture() {
  const zip = new JSZip();
  const students = Array.from({ length: 8 }, (_, index) => {
    const n = index + 1;
    return {
      externalId: `student-${String(n).padStart(2, '0')}`,
      firstName: `Имя${n}`,
      lastName: `Ученик${n}`,
      status: n % 3 === 0 ? 'needs-review' : 'ready',
      photos: [
        {
          path: `assets/student-${String(n).padStart(2, '0')}.svg`,
          role: 'main',
          order: 0,
          mimeType: 'image/svg+xml',
        },
      ],
    };
  });
  const teachers = [
    {
      externalId: 'teacher-01',
      firstName: 'Мария',
      lastName: 'Наставник',
      role: 'Классный руководитель',
      status: 'ready',
      photos: [
        {
          path: 'assets/teacher-01.svg',
          role: 'main',
          order: 0,
          mimeType: 'image/svg+xml',
        },
      ],
    },
  ];
  for (const person of [...students, ...teachers]) {
    const photo = person.photos[0];
    const label = person.externalId.includes('teacher') ? 'Учитель' : person.externalId.slice(-2);
    const bytes = new TextEncoder().encode(
      svgAvatar(label, person.externalId.includes('teacher') ? '#4338ca' : '#0f766e'),
    );
    photo.byteSize = bytes.byteLength;
    zip.file(photo.path, bytes);
  }
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        format: 'vakha-class',
        version: 1,
        class: {
          schoolName: 'Тестовая школа',
          className: '11-Т',
          academicYear: '2026',
          curatorName: 'Мария Наставник',
        },
        students,
        teachers,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(fixturesDir, 'test-class.vsclass'),
    Buffer.from(await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })),
  );
}

function createLargeProjectFixture() {
  const projectId = 'fixture-large-project';
  const pages = Array.from({ length: 40 }, (_, index) => ({
    id: `${projectId}:page-${index + 1}`,
    title: `Страница ${index + 1}`,
    order: index,
    widthMm: 200,
    heightMm: 200,
    bleedMm: 3,
    safeZoneMm: 5,
    gridStepMm: 5,
    pageType: index === 0 ? 'cover' : index % 5 === 0 ? 'class' : 'universal',
    repeatFor: index % 7 === 0 ? 'student' : 'none',
  }));
  const layers = pages.flatMap((page, pageIndex) =>
    Array.from({ length: 10 }, (_, layerIndex) => ({
      id: `${page.id}:layer-${layerIndex + 1}`,
      pageId: page.id,
      name: `Слой ${layerIndex + 1}`,
      kind: layerIndex % 3 === 0 ? 'text' : layerIndex % 3 === 1 ? 'rect' : 'circle',
      visible: true,
      locked: false,
      zIndex: layerIndex,
      xMm: 8 + ((layerIndex * 17) % 150),
      yMm: 10 + ((pageIndex + layerIndex * 13) % 150),
      widthMm: 28 + (layerIndex % 4) * 9,
      heightMm: 18 + (layerIndex % 5) * 8,
      rotationDeg: layerIndex % 2 === 0 ? 0 : -4,
      fill: layerIndex % 3 === 0 ? '#1f2937' : layerIndex % 3 === 1 ? '#e5e7eb' : '#93c5fd',
      stroke: 'transparent',
      strokeWidthMm: 0,
      opacity: 1,
      ...(layerIndex % 3 === 0
        ? {
            text: {
              content: `Тестовый текст ${pageIndex + 1}.${layerIndex + 1}`,
              fontFamily: 'sans-serif',
              fontSizePt: 14,
              minFontSizePt: 8,
              fontWeight: 'normal',
              fontStyle: 'normal',
              underline: false,
              linethrough: false,
              textAlign: 'left',
              verticalAlign: 'top',
              letterSpacingEm: 0,
              lineHeight: 1.16,
              textCase: 'original',
              paddingMm: 1,
              direction: 'ltr',
              boxMode: 'fixed',
              maxLines: 3,
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
          }
        : {}),
    })),
  );
  return {
    format: 'vakha-large-fixture',
    generatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    document: {
      version: 2,
      projectId,
      pages,
      layers,
      updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
    profileTargets: {
      pages: pages.length,
      layers: layers.length,
      participants: 30,
      expected300DpiPagePx: {
        width: Math.round((200 / 25.4) * 300),
        height: Math.round((200 / 25.4) * 300),
      },
    },
  };
}

await mkdir(fixturesDir, { recursive: true });
await createClassFixture();
await writeFile(
  path.join(fixturesDir, 'large-project.fixture.json'),
  `${JSON.stringify(createLargeProjectFixture(), null, 2)}\n`,
);

console.log('Generated fixtures/test-class.vsclass and fixtures/large-project.fixture.json');
