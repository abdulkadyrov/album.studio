import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultCanvasDocument } from '../../canvas/model/canvas-document';
import { database } from '../db/database';
import { canvasSceneRepository } from './canvas-scene-repository';
import { albumRepository } from './album-repository';

describe('album repository', () => {
  beforeEach(async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });

  it('экспортирует и импортирует редактируемый .vsalbum', async () => {
    const now = new Date().toISOString();
    await database.projects.put({
      id: 'album-source',
      name: 'Альбом',
      schoolName: 'Школа №25',
      className: '4А',
      academicYear: '2026',
      status: 'draft',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    const document = createDefaultCanvasDocument('album-source');
    await canvasSceneRepository.save(document);
    await database.assets.put({
      id: 'asset-photo',
      projectId: 'album-source',
      ownerType: 'project',
      kind: 'image',
      filename: 'student.jpg',
      mimeType: 'image/jpeg',
      byteSize: 10,
      blob: new TextEncoder().encode('0123456789') as unknown as Blob,
      createdAt: now,
    });
    await database.participants.put({
      id: 'student-source',
      projectId: 'album-source',
      type: 'student',
      firstName: 'Александр',
      lastName: 'Иванов',
      displayName: 'Иванов Александр',
      status: 'approved',
      updatedAt: now,
    });
    await database.participantPhotos.put({
      id: 'student-source-photo',
      projectId: 'album-source',
      participantId: 'student-source',
      assetId: 'asset-photo',
      role: 'main',
      order: 0,
    });
    await database.overrides.put({
      id: 'student-source-override',
      projectId: 'album-source',
      participantId: 'student-source',
      pageId: document.pages[0]!.id,
      layerId: 'missing-layer-ok-for-roundtrip',
      patch: { name: 'Иванов Александр' },
    });

    const exported = await albumRepository.export('album-source');
    expect(exported.filename).toBe('Альбом.vsalbum');

    const importedProjectId = await albumRepository.import(
      new File([exported.blob], 'album.vsalbum', { type: 'application/zip' }),
    );
    const imported = await canvasSceneRepository.load(importedProjectId);

    expect(imported?.pages).toHaveLength(document.pages.length);
    expect(imported?.layers).toHaveLength(document.layers.length);
    expect((await database.projects.get(importedProjectId))?.name).toBe('Альбом — импорт');
    const importedParticipant = await database.participants
      .where('projectId')
      .equals(importedProjectId)
      .first();
    expect(importedParticipant?.id).not.toBe('student-source');
    const importedPhoto = await database.participantPhotos
      .where('projectId')
      .equals(importedProjectId)
      .first();
    expect(importedPhoto?.participantId).toBe(importedParticipant?.id);
    expect(await database.assets.get(importedPhoto?.assetId ?? '')).toBeTruthy();
    const importedOverride = await database.overrides
      .where('projectId')
      .equals(importedProjectId)
      .first();
    expect(importedOverride?.participantId).toBe(importedParticipant?.id);
  });
});
