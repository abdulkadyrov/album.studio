import JSZip from 'jszip';
import { beforeEach, describe, expect, it } from 'vitest';

import { database } from '../db/database';
import { classImportRepository } from './class-import-repository';

async function makeClassFile(path = 'assets/ivanov.jpg') {
  const zip = new JSZip();
  const photo = new Blob(['photo-bytes'], { type: 'image/jpeg' });
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
          photos: [{ path, mimeType: 'image/jpeg', byteSize: photo.size }],
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
  zip.file(path, photo);
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'class.vsclass', { type: 'application/zip' });
}

describe('class import repository', () => {
  beforeEach(async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });

  it('показывает staged preview без записи в проект', async () => {
    const preview = await classImportRepository.preview(await makeClassFile());

    expect(preview.stats).toMatchObject({ students: 1, teachers: 1, photos: 1 });
    expect(preview.people.map((person) => person.displayName)).toContain('Иванов Александр');
    expect(await database.participants.count()).toBe(0);
  });

  it('импортирует участников и ресурсы одной операцией', async () => {
    await database.projects.put({
      id: 'project-class',
      name: 'Класс',
      schoolName: '',
      className: '',
      academicYear: '',
      status: 'draft',
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await classImportRepository.import(
      'project-class',
      await makeClassFile(),
      'merge',
    );

    expect(result).toMatchObject({ imported: 2, updated: 0, photos: 1 });
    expect(await database.participants.where('projectId').equals('project-class').count()).toBe(2);
    expect(
      await database.participantPhotos.where('projectId').equals('project-class').count(),
    ).toBe(1);
    expect((await database.projects.get('project-class'))?.className).toBe('4А');
  });

  it('отклоняет unsafe paths и не меняет проект', async () => {
    await expect(classImportRepository.preview(await makeClassFile('../bad.jpg'))).rejects.toThrow(
      /небезопасный путь/,
    );
    expect(await database.participants.count()).toBe(0);
  });
});
