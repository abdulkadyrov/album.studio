import { beforeEach, describe, expect, it } from 'vitest';

import { createDefaultCanvasDocument } from '../../canvas/model/canvas-document';
import { database } from '../db/database';
import { canvasSceneRepository } from './canvas-scene-repository';
import { workspaceMaterialsRepository } from './workspace-materials-repository';

describe('workspace materials repository', () => {
  beforeEach(async () => {
    await Promise.all(database.tables.map((table) => table.clear()));
  });

  it('сохраняет и фильтрует референсы, идеи и аннотации локально', async () => {
    const document = createDefaultCanvasDocument('workspace-project');
    await canvasSceneRepository.save(document);

    const pageId = document.pages[0]!.id;
    const layerId = document.layers[0]!.id;
    await workspaceMaterialsRepository.saveReference('workspace-project', {
      title: 'Коллаж обложки',
      notes: 'Светлый бумажный стиль',
      tags: ['cover', 'paper'],
      pageId,
      layerId,
      favorite: true,
    });
    await workspaceMaterialsRepository.saveIdea('workspace-project', {
      title: 'Разворот с цитатами',
      description: 'Сделать рядом с групповым фото',
      priority: 'high',
      status: 'selected',
      pageId,
    });
    const annotationId = await workspaceMaterialsRepository.saveAnnotation('workspace-project', {
      title: 'Проверить подпись',
      body: 'Фамилия должна быть крупнее',
      kind: 'layer',
      status: 'open',
      pageId,
      layerId,
    });

    await workspaceMaterialsRepository.updateAnnotationStatus(annotationId, 'resolved');

    await expect(
      workspaceMaterialsRepository.listReferences('workspace-project', { query: 'бумажный' }),
    ).resolves.toHaveLength(1);
    await expect(
      workspaceMaterialsRepository.listIdeas('workspace-project', { status: 'selected' }),
    ).resolves.toHaveLength(1);
    await expect(
      workspaceMaterialsRepository.listAnnotations('workspace-project', { status: 'resolved' }),
    ).resolves.toHaveLength(1);
  });

  it('экспортирует аннотации отдельно в JSON и Markdown', async () => {
    const document = createDefaultCanvasDocument('workspace-export');
    await canvasSceneRepository.save(document);
    await workspaceMaterialsRepository.saveAnnotation('workspace-export', {
      title: 'Не печатать в альбом',
      body: 'Это рабочий комментарий',
      kind: 'point',
      pageId: document.pages[0]!.id,
      xMm: 12,
      yMm: 18,
    });

    const json = await workspaceMaterialsRepository.exportAnnotations('workspace-export', 'json');
    await expect(json.text()).resolves.toContain('vakha-annotations');

    const markdown = await workspaceMaterialsRepository.exportAnnotations(
      'workspace-export',
      'markdown',
    );
    await expect(markdown.text()).resolves.toContain('## Не печатать в альбом');
  });
});
