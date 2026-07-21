import { beforeEach, describe, expect, it } from 'vitest';

import {
  createDefaultCanvasDocument,
  createDefaultTextStyle,
  type CanvasLayerSnapshot,
} from '../../canvas/model/canvas-document';
import { database } from '../db/database';
import { canvasSceneRepository } from './canvas-scene-repository';
import { personalizationRepository } from './personalization-repository';

async function seedPersonalizedProject() {
  const now = new Date().toISOString();
  await database.projects.put({
    id: 'personal-project',
    name: 'Персональный альбом',
    schoolName: 'Школа №25',
    className: '4А',
    academicYear: '2026',
    status: 'draft',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  });
  await database.participants.bulkPut([
    {
      id: 'student-a',
      projectId: 'personal-project',
      type: 'student',
      firstName: 'Александр',
      lastName: 'Иванов',
      status: 'ready',
      updatedAt: now,
    },
    {
      id: 'student-b',
      projectId: 'personal-project',
      type: 'student',
      firstName: 'Мария',
      lastName: 'Петрова',
      status: 'ready',
      updatedAt: now,
    },
  ]);
  const document = createDefaultCanvasDocument('personal-project');
  const portraitPage = document.pages[0]!;
  portraitPage.pageType = 'portrait';
  portraitPage.repeatFor = 'student';
  const nameLayer: CanvasLayerSnapshot = {
    id: 'bound-name',
    pageId: portraitPage.id,
    name: 'Имя участника',
    kind: 'text',
    visible: true,
    locked: false,
    zIndex: 1,
    xMm: 20,
    yMm: 20,
    widthMm: 80,
    heightMm: 20,
    rotationDeg: 0,
    fill: '#111111',
    stroke: 'transparent',
    strokeWidthMm: 0,
    opacity: 1,
    binding: { source: 'participant', field: 'fullName', fallback: 'ФИО' },
    text: {
      ...createDefaultTextStyle(),
      content: 'ФИО',
    },
  };
  document.layers = [nameLayer];
  await canvasSceneRepository.save(document);
}

describe('personalization repository', () => {
  beforeEach(async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });

  it('материализует bindings и сохраняет только overrides выбранного участника', async () => {
    await seedPersonalizedProject();

    const first = await personalizationRepository.getParticipantView(
      'personal-project',
      'student-a',
    );
    const second = await personalizationRepository.getParticipantView(
      'personal-project',
      'student-b',
    );

    expect(first?.viewDocument.layers[0]?.text?.content).toBe('Иванов Александр');
    expect(second?.viewDocument.layers[0]?.text?.content).toBe('Петрова Мария');

    const editedFirst = {
      ...first!.viewDocument,
      layers: first!.viewDocument.layers.map((layer) =>
        layer.id === 'bound-name' ? { ...layer, xMm: 44, fill: '#ff0000' } : layer,
      ),
    };
    await personalizationRepository.saveParticipantView(
      'personal-project',
      'student-a',
      first!.baseDocument,
      editedFirst,
    );

    const firstAgain = await personalizationRepository.getParticipantView(
      'personal-project',
      'student-a',
    );
    const secondAgain = await personalizationRepository.getParticipantView(
      'personal-project',
      'student-b',
    );
    const base = await canvasSceneRepository.load('personal-project');

    expect(firstAgain?.viewDocument.layers[0]).toMatchObject({ xMm: 44, fill: '#ff0000' });
    expect(secondAgain?.viewDocument.layers[0]).toMatchObject({ xMm: 20, fill: '#111111' });
    expect(base?.layers[0]).toMatchObject({ xMm: 20, fill: '#111111' });
    expect(await database.overrides.where('participantId').equals('student-a').count()).toBe(1);
    expect(await database.overrides.where('participantId').equals('student-b').count()).toBe(0);
  });
});
