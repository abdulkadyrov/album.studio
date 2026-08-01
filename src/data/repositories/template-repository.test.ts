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

  it('регистрирует геометрический шаблон 4 класса как набор редактируемых слоёв', async () => {
    const source = await templateRepository.get('system-grade4-geometry-2026');

    expect(source?.template.name).toBe('4-А · геометрия');
    expect(source?.template.source).toBe('codex');
    expect(source?.document.pages).toHaveLength(6);
    expect(source?.document.pages.filter((page) => page.spreadId)).toHaveLength(4);
    expect(source?.document.pages.filter((page) => page.repeatFor === 'student')).toHaveLength(2);
    expect(source?.document.layers.filter((layer) => layer.kind === 'frame')).toHaveLength(29);
    expect(
      source?.document.layers.filter((layer) => layer.kind === 'frame' && layer.binding),
    ).toHaveLength(29);
    expect(source?.document.layers.length).toBeGreaterThan(120);
    expect(source?.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'system-grade4-neutral-placeholder-v2',
          kind: 'svg',
          mimeType: 'image/svg+xml',
        }),
      ]),
    );
    expect(
      source?.document.layers.some(
        (layer) =>
          layer.binding?.source === 'participant' && layer.binding.field === 'photoAssetId',
      ),
    ).toBe(true);
    expect(
      source?.document.layers.some(
        (layer) => layer.binding?.source === 'class' && layer.binding.field === 'schoolName',
      ),
    ).toBe(true);
  });

  it('регистрирует полный бордовый альбом с заменяемыми портретами', async () => {
    const source = await templateRepository.get('system-editorial-burgundy-2026');

    expect(source?.template.name).toBe('Выпускной 2026 · бордовая редакция');
    expect(source?.document.pages).toHaveLength(14);
    expect(source?.document.pages.filter((page) => page.spreadId)).toHaveLength(12);
    expect(source?.document.pages[0]?.pageType).toBe('cover');
    expect(source?.document.pages.at(-1)?.pageType).toBe('closing');
    expect(
      source?.document.layers.filter((layer) => layer.name.includes('заменяемое фото')).length,
    ).toBeGreaterThan(30);
    expect(
      source?.document.layers.some(
        (layer) =>
          layer.binding?.source === 'participant' && layer.binding.field === 'photoAssetId',
      ),
    ).toBe(true);
    expect(
      source?.document.layers.some(
        (layer) => layer.binding?.source === 'teacher' && layer.binding.field === 'photoAssetId',
      ),
    ).toBe(true);
  });

  it('регистрирует мраморный шаблон Санкт-Петербурга из генератора', async () => {
    const source = await templateRepository.get('system-spb-marble-2025');

    expect(source?.template.name).toBe('Санкт-Петербург · мрамор');
    expect(source?.document.pages).toHaveLength(16);
    expect(source?.document.pages.map((page) => page.title)).toEqual(
      expect.arrayContaining(['Пожелания', 'Учителя', 'Спорт']),
    );
    expect(source?.document.layers.some((layer) => layer.name === 'Безопасная зона')).toBe(true);
    expect(
      source?.document.layers.filter((layer) => layer.kind === 'frame').length,
    ).toBeGreaterThan(30);
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
