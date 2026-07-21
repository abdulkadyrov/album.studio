import { database } from './database';
import { settingsRepository } from '../repositories/settings-repository';

describe('VakhaDatabase', () => {
  beforeEach(async () => {
    database.close();
    await database.delete();
    await database.open();
  });

  afterEach(() => {
    database.close();
  });

  it('создаёт нормализованную схему v1', () => {
    const tableNames = database.tables.map((table) => table.name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        'projects',
        'pages',
        'layers',
        'assets',
        'participants',
        'overrides',
        'settings',
      ]),
    );
  });

  it('сохраняет небольшие настройки локально', async () => {
    await settingsRepository.set('accent', 'blue');

    await expect(settingsRepository.get('accent')).resolves.toBe('blue');
  });
});
