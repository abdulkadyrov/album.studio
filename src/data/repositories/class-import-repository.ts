import JSZip from 'jszip';

import {
  classImportStrategySchema,
  classManifestSchema,
  participantStatusLabels,
  type ClassImportStrategy,
  type ClassManifest,
  type ClassManifestPerson,
} from '../../features/participants/class-schema';
import { database } from '../db/database';
import type { AssetRecord, ParticipantPhotoRecord, ParticipantRecord } from '../db/schema';

const MAX_CLASS_BYTES = 500 * 1024 * 1024;
const MAX_CLASS_FILES = 5000;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

export interface ClassImportPreviewPerson {
  type: ParticipantRecord['type'];
  externalId?: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  displayName: string;
  status: ParticipantRecord['status'];
  photoCount: number;
  warnings: string[];
}

export interface ClassImportPreview {
  manifest: ClassManifest;
  people: ClassImportPreviewPerson[];
  warnings: string[];
  stats: {
    students: number;
    teachers: number;
    photos: number;
    bytes: number;
  };
}

export interface ClassImportResult {
  imported: number;
  updated: number;
  removed: number;
  photos: number;
  warnings: string[];
}

function assertSafePath(path: string, label = 'архив'): void {
  if (path.startsWith('/') || path.split(/[\\/]/).includes('..')) {
    throw new Error(`${label} содержит небезопасный путь`);
  }
}

function displayName(person: ClassManifestPerson): string {
  return (
    person.displayName ||
    [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ')
  );
}

function fullNameKey(person: Pick<ParticipantRecord, 'type' | 'firstName' | 'lastName'>): string {
  return `${person.type}:${person.lastName.trim().toLocaleLowerCase('ru')}:${person.firstName
    .trim()
    .toLocaleLowerCase('ru')}`;
}

function flattenPeople(manifest: ClassManifest): ClassImportPreviewPerson[] {
  return [
    ...manifest.students.map((person) => ({ person, type: 'student' as const })),
    ...manifest.teachers.map((person) => ({ person, type: 'teacher' as const })),
  ].map(({ person, type }) => ({
    type,
    externalId: person.externalId,
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName,
    displayName: displayName(person),
    status: person.status,
    photoCount: person.photos.length,
    warnings: person.photos.length === 0 ? ['Нет привязанной фотографии'] : [],
  }));
}

function filenameFromPath(path: string): string {
  return path.split('/').at(-1) || path;
}

async function readArchive(file: File): Promise<{ zip: JSZip; manifest: ClassManifest }> {
  if (file.size <= 0 || file.size > MAX_CLASS_BYTES) {
    throw new Error('Размер класса превышает 500 МБ');
  }
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files);
  if (entries.length > MAX_CLASS_FILES) throw new Error('В классе слишком много файлов');
  for (const entry of entries) assertSafePath(entry.unsafeOriginalName ?? entry.name, 'Класс');
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new Error('В классе отсутствует manifest.json');
  return {
    zip,
    manifest: classManifestSchema.parse(JSON.parse(await manifestEntry.async('text'))),
  };
}

async function validateAssets(zip: JSZip, manifest: ClassManifest): Promise<string[]> {
  const warnings: string[] = [];
  let totalBytes = 0;
  const usedPaths = new Set<string>();
  const people = [...manifest.students, ...manifest.teachers];
  for (const person of people) {
    for (const photo of person.photos) {
      assertSafePath(photo.path, 'Фото');
      if (!photo.path.startsWith('assets/')) throw new Error('Фото должны находиться в assets/');
      if (usedPaths.has(photo.path)) warnings.push(`Фото «${photo.path}» используется повторно`);
      usedPaths.add(photo.path);
      const entry = zip.file(photo.path);
      if (!entry) throw new Error(`Фото «${photo.path}» отсутствует в архиве`);
      const blob = await entry.async('blob');
      totalBytes += blob.size;
      if (totalBytes > MAX_CLASS_BYTES) throw new Error('Суммарный размер класса превышает 500 МБ');
      if (photo.byteSize && blob.size !== photo.byteSize) {
        throw new Error(`Размер фото «${photo.path}» не совпадает с manifest`);
      }
      const mimeType = photo.mimeType || blob.type || 'application/octet-stream';
      if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
        throw new Error(`Формат фото «${photo.path}» не поддерживается`);
      }
    }
  }
  if (manifest.students.length === 0) warnings.push('В архиве нет учеников');
  if (manifest.teachers.length === 0) warnings.push('В архиве нет учителей');
  return warnings;
}

async function deleteParticipantResources(
  projectId: string,
  participantIds: string[],
): Promise<void> {
  if (participantIds.length === 0) return;
  const photos = await database.participantPhotos.where('projectId').equals(projectId).toArray();
  const targetPhotos = photos.filter((photo) => participantIds.includes(photo.participantId));
  await database.participantPhotos.bulkDelete(targetPhotos.map((photo) => photo.id));
  await database.assets.bulkDelete(targetPhotos.map((photo) => photo.assetId));
}

export const classImportRepository = {
  async preview(file: File): Promise<ClassImportPreview> {
    const { zip, manifest } = await readArchive(file);
    const assetWarnings = await validateAssets(zip, manifest);
    const people = flattenPeople(manifest);
    return {
      manifest,
      people,
      warnings: [...assetWarnings, ...people.flatMap((person) => person.warnings)],
      stats: {
        students: manifest.students.length,
        teachers: manifest.teachers.length,
        photos: people.reduce((sum, person) => sum + person.photoCount, 0),
        bytes: file.size,
      },
    };
  },

  async import(
    projectId: string,
    file: File,
    strategy: ClassImportStrategy,
  ): Promise<ClassImportResult> {
    classImportStrategySchema.parse(strategy);
    const { zip, manifest } = await readArchive(file);
    const warnings = await validateAssets(zip, manifest);
    const batchId = `class-import-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const incoming = [
      ...manifest.students.map((person) => ({ person, type: 'student' as const })),
      ...manifest.teachers.map((person) => ({ person, type: 'teacher' as const })),
    ];
    const existing = await database.participants.where('projectId').equals(projectId).toArray();
    const byExternalId = new Map(
      existing.flatMap((person) =>
        person.externalId ? [[`${person.type}:${person.externalId}`, person] as const] : [],
      ),
    );
    const byName = new Map(existing.map((person) => [fullNameKey(person), person] as const));
    let updated = 0;
    let imported = 0;
    let removed = 0;
    let photos = 0;

    const participantRecords: ParticipantRecord[] = [];
    const participantPhotoRecords: ParticipantPhotoRecord[] = [];
    const assetRecords: AssetRecord[] = [];
    const participantIdsToReplacePhotos: string[] = [];

    if (strategy === 'replace') {
      removed = existing.length;
      participantIdsToReplacePhotos.push(...existing.map((person) => person.id));
    }

    for (const { person, type } of incoming) {
      const existingMatch =
        strategy === 'merge'
          ? person.externalId
            ? byExternalId.get(`${type}:${person.externalId}`)
            : byName.get(
                fullNameKey({ type, firstName: person.firstName, lastName: person.lastName }),
              )
          : undefined;
      const participantId = existingMatch?.id ?? `participant-${crypto.randomUUID()}`;
      if (existingMatch) {
        updated += 1;
        participantIdsToReplacePhotos.push(participantId);
      } else {
        imported += 1;
      }
      participantRecords.push({
        id: participantId,
        projectId,
        type,
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
        displayName: displayName(person),
        externalId: person.externalId,
        role: person.role,
        email: person.email,
        phone: person.phone,
        notes: person.notes,
        tags: person.tags,
        status: person.status,
        importBatchId: batchId,
        importedAt: now,
        updatedAt: now,
      });
      for (const photo of person.photos) {
        const entry = zip.file(photo.path);
        if (!entry) throw new Error(`Фото «${photo.path}» отсутствует в архиве`);
        const blob = await entry.async('blob');
        const assetId = `participant-asset-${crypto.randomUUID()}`;
        const photoId = `participant-photo-${crypto.randomUUID()}`;
        photos += 1;
        assetRecords.push({
          id: assetId,
          projectId,
          ownerType: 'project',
          kind: 'image',
          filename: photo.filename || filenameFromPath(photo.path),
          mimeType: photo.mimeType || blob.type || 'image/jpeg',
          byteSize: blob.size,
          blob,
          metadata: { participantId, classImportBatchId: batchId, sourcePath: photo.path },
          createdAt: now,
        });
        participantPhotoRecords.push({
          id: photoId,
          projectId,
          participantId,
          assetId,
          role: photo.role,
          order: photo.order,
          sourcePath: photo.path,
        });
      }
    }

    await database.transaction(
      'rw',
      database.projects,
      database.participants,
      database.participantPhotos,
      database.assets,
      async () => {
        if (strategy === 'replace') {
          await database.participants.where('projectId').equals(projectId).delete();
        }
        await deleteParticipantResources(projectId, participantIdsToReplacePhotos);
        await database.participants.bulkPut(participantRecords);
        if (assetRecords.length > 0) await database.assets.bulkPut(assetRecords);
        if (participantPhotoRecords.length > 0) {
          await database.participantPhotos.bulkPut(participantPhotoRecords);
        }
        await database.projects.update(projectId, {
          schoolName: manifest.class.schoolName ?? '',
          className: manifest.class.className ?? '',
          academicYear: manifest.class.academicYear ?? '',
          updatedAt: now,
        });
      },
    );

    return {
      imported,
      updated,
      removed,
      photos,
      warnings:
        warnings.length > 0
          ? warnings
          : [`Статусы: ${Object.values(participantStatusLabels).join(', ')}`],
    };
  },
};
