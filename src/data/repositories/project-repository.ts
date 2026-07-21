import { database } from '../db/database';

export const projectRepository = {
  async list() {
    return database.projects.orderBy('updatedAt').reverse().toArray();
  },

  async rename(id: string, name: string): Promise<void> {
    await database.projects.update(id, { name: name.trim(), updatedAt: new Date().toISOString() });
  },

  async delete(id: string): Promise<void> {
    await database.transaction(
      'rw',
      database.projects,
      database.pages,
      database.layers,
      database.assets,
      async () => {
        await database.projects.delete(id);
        await database.pages.where('projectId').equals(id).delete();
        await database.layers.where('projectId').equals(id).delete();
        await database.assets.where('projectId').equals(id).delete();
      },
    );
  },
};
