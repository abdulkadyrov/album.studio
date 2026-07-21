import { database } from '../db/database';
import type { ParticipantPhotoRecord, ParticipantRecord } from '../db/schema';

export interface ParticipantWithPhotos extends ParticipantRecord {
  photos: ParticipantPhotoRecord[];
}

export const participantRepository = {
  async list(projectId: string): Promise<ParticipantWithPhotos[]> {
    const [participants, photos] = await Promise.all([
      database.participants.where('projectId').equals(projectId).sortBy('lastName'),
      database.participantPhotos.where('projectId').equals(projectId).toArray(),
    ]);
    const photosByParticipant = new Map<string, ParticipantPhotoRecord[]>();
    for (const photo of photos) {
      const list = photosByParticipant.get(photo.participantId) ?? [];
      list.push(photo);
      photosByParticipant.set(photo.participantId, list);
    }
    return participants.map((participant) => ({
      ...participant,
      photos: (photosByParticipant.get(participant.id) ?? []).sort(
        (left, right) => left.order - right.order,
      ),
    }));
  },

  async updateStatus(projectId: string, ids: string[], status: string): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    await database.transaction('rw', database.participants, async () => {
      for (const id of ids) {
        await database.participants.update(id, { projectId, status, updatedAt: now });
      }
    });
  },
};
