import { database } from '../db/database';

export const settingsRepository = {
  async get(key: string): Promise<unknown> {
    return (await database.settings.get(key))?.value;
  },

  async set(key: string, value: unknown): Promise<void> {
    await database.settings.put({ key, value, updatedAt: new Date().toISOString() });
  },
};
