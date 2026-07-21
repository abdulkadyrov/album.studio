import { describe, expect, it } from 'vitest';

import { createDefaultCanvasDocument } from '../../canvas/model/canvas-document';
import { templateRepository } from './template-repository';
import { canvasSceneRepository } from './canvas-scene-repository';

describe('template repository', () => {
  it('создаёт независимый проект с новыми ID', async () => {
    const source = await templateRepository.get('system-editorial-red');
    expect(source).toBeDefined();

    const projectId = await templateRepository.createProject('system-editorial-red');
    const project = await canvasSceneRepository.load(projectId);

    expect(project).toBeDefined();
    expect(project?.pages).toHaveLength(source?.document.pages.length ?? 0);
    expect(project?.pages[0]?.id).not.toBe(source?.document.pages[0]?.id);
    expect(project?.layers[0]?.id).not.toBe(source?.document.layers[0]?.id);

    project!.layers[0]!.fill = '#ff00ff';
    await canvasSceneRepository.save(project!);
    const unchanged = await templateRepository.get('system-editorial-red');
    expect(unchanged?.document.layers[0]?.fill).toBe(source?.document.layers[0]?.fill);
  });

  it('регистрирует большой шаблон по референсам с разворотами', async () => {
    const source = await templateRepository.get('system-reference-mix-2026');

    expect(source?.template.name).toBe('Выпускной 2026 · микс референсов');
    expect(source?.document.pages).toHaveLength(12);
    expect(source?.document.pages.filter((page) => page.spreadId)).toHaveLength(10);
    expect(source?.document.pages.some((page) => page.repeatFor === 'student')).toBe(true);
    expect(source?.document.layers.length).toBeGreaterThan(80);
  });

  it('сохраняет отдельную страницу с page type и импортирует свой экспорт', async () => {
    const document = createDefaultCanvasDocument(`template-test-${crypto.randomUUID()}`);
    document.pages[0]!.pageType = 'portrait';
    document.pages[0]!.repeatFor = 'student';
    const saved = await templateRepository.saveFromDocument(document, {
      name: 'Тестовая страница',
      category: 'general',
      style: 'minimal',
      color: 'light',
      scope: 'page',
      pageId: document.pages[0]!.id,
    });

    expect(saved.document.pages).toHaveLength(1);
    expect(saved.document.pages[0]).toMatchObject({ pageType: 'portrait', repeatFor: 'student' });

    const blob = await templateRepository.export(saved.template.id);
    const imported = await templateRepository.import(
      new File([blob], 'template.vstemplate', { type: 'application/zip' }),
    );
    expect(imported.template.id).not.toBe(saved.template.id);
    expect(imported.template.name).toBe(saved.template.name);
    expect(imported.document.pages[0]).toMatchObject({
      pageType: 'portrait',
      repeatFor: 'student',
    });
  });
});
