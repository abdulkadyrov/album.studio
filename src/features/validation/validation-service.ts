import type {
  CanvasDocument,
  CanvasLayerSnapshot,
  CanvasPageSnapshot,
} from '../../canvas/model/canvas-document';
import { database } from '../../data/db/database';
import type { ParticipantRecord } from '../../data/db/schema';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  scope: 'project' | 'page' | 'layer' | 'participant';
  title: string;
  description: string;
  pageId?: string;
  layerId?: string;
  participantId?: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  summary: Record<ValidationSeverity, number>;
  canExport: boolean;
}

function issue(input: Omit<ValidationIssue, 'id'>): ValidationIssue {
  return {
    ...input,
    id: `${input.severity}:${input.scope}:${input.pageId ?? ''}:${input.layerId ?? ''}:${
      input.participantId ?? ''
    }:${input.title}`,
  };
}

function effectiveDpi(layer: CanvasLayerSnapshot): number | undefined {
  const image = layer.image;
  if (!image) return undefined;
  const cropWidthPx =
    image.fit === 'cover' ? image.naturalWidthPx / image.zoom : image.naturalWidthPx;
  const cropHeightPx =
    image.fit === 'cover' ? image.naturalHeightPx / image.zoom : image.naturalHeightPx;
  return Math.round(
    Math.min(cropWidthPx / (layer.widthMm / 25.4), cropHeightPx / (layer.heightMm / 25.4)),
  );
}

function textCapacityWarning(layer: CanvasLayerSnapshot): boolean {
  const text = layer.text;
  if (!text || text.boxMode === 'auto') return false;
  const lineCount = text.content.split(/\r?\n/).length;
  const approxLineHeightMm = ((text.fontSizePt * text.lineHeight) / 72) * 25.4;
  return lineCount * approxLineHeightMm + text.paddingMm * 2 > layer.heightMm;
}

export async function validateProjectDocument(
  document: CanvasDocument | undefined,
): Promise<ValidationReport> {
  if (!document) {
    const issues = [
      issue({
        severity: 'error',
        scope: 'project',
        title: 'Проект не найден',
        description: 'Нет сохранённых страниц и слоёв для проверки.',
      }),
    ];
    return { issues, summary: { error: 1, warning: 0, info: 0 }, canExport: false };
  }

  const [assets, participants] = await Promise.all([
    database.assets.where('projectId').equals(document.projectId).toArray(),
    database.participants.where('projectId').equals(document.projectId).toArray(),
  ]);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset] as const));
  const issues: ValidationIssue[] = [];

  if (document.pages.length === 0) {
    issues.push(
      issue({
        severity: 'error',
        scope: 'project',
        title: 'Нет страниц',
        description: 'Добавьте хотя бы одну страницу перед экспортом.',
      }),
    );
  }

  for (const page of document.pages) {
    if (page.widthMm <= 0 || page.heightMm <= 0) {
      issues.push(
        issue({
          severity: 'error',
          scope: 'page',
          pageId: page.id,
          title: 'Некорректный размер страницы',
          description: `${page.title}: размер должен быть положительным.`,
        }),
      );
    }
  }

  for (const layer of document.layers) {
    if (!document.pages.some((page) => page.id === layer.pageId)) {
      issues.push(
        issue({
          severity: 'error',
          scope: 'layer',
          layerId: layer.id,
          title: 'Слой без страницы',
          description: `Слой «${layer.name}» привязан к отсутствующей странице.`,
        }),
      );
    }
    if (layer.image) {
      const asset = assetsById.get(layer.image.assetId);
      if (!asset) {
        issues.push(
          issue({
            severity: 'error',
            scope: 'layer',
            pageId: layer.pageId,
            layerId: layer.id,
            title: 'Не найдено изображение',
            description: `Слой «${layer.name}» ссылается на отсутствующий ресурс.`,
          }),
        );
      } else if (!['image', 'svg', 'decoration'].includes(asset.kind)) {
        issues.push(
          issue({
            severity: 'error',
            scope: 'layer',
            pageId: layer.pageId,
            layerId: layer.id,
            title: 'Неверный тип ресурса',
            description: `Слой «${layer.name}» использует ресурс типа ${asset.kind}.`,
          }),
        );
      }
      const dpi = effectiveDpi(layer);
      if (dpi && dpi < 200) {
        issues.push(
          issue({
            severity: 'warning',
            scope: 'layer',
            pageId: layer.pageId,
            layerId: layer.id,
            title: 'Низкое разрешение',
            description: `Слой «${layer.name}» имеет примерно ${dpi} DPI. Для печати лучше 300 DPI.`,
          }),
        );
      }
    }
    if (layer.text && textCapacityWarning(layer)) {
      issues.push(
        issue({
          severity: 'warning',
          scope: 'layer',
          pageId: layer.pageId,
          layerId: layer.id,
          title: 'Текст может не поместиться',
          description: `Слой «${layer.name}» использует фиксированную рамку и близок к переполнению.`,
        }),
      );
    }
    if (layer.binding?.source === 'participant' && participants.length === 0) {
      issues.push(
        issue({
          severity: 'warning',
          scope: 'layer',
          pageId: layer.pageId,
          layerId: layer.id,
          title: 'Нет участников для привязки',
          description: `Слой «${layer.name}» имеет participant binding, но класс ещё не импортирован.`,
        }),
      );
    }
  }

  const repeatPages = document.pages.filter(
    (page) => page.repeatFor === 'student' || page.repeatFor === 'teacher',
  );
  for (const page of repeatPages) {
    const type = page.repeatFor === 'teacher' ? 'teacher' : 'student';
    if (!participants.some((participant) => participant.type === type)) {
      issues.push(
        issue({
          severity: 'info',
          scope: 'page',
          pageId: page.id,
          title: 'Повторяемая страница без данных',
          description: `${page.title}: нет ${type === 'teacher' ? 'учителей' : 'учеников'} для автозаполнения.`,
        }),
      );
    }
  }

  const summary = issues.reduce<Record<ValidationSeverity, number>>(
    (counts, current) => ({ ...counts, [current.severity]: counts[current.severity] + 1 }),
    { error: 0, warning: 0, info: 0 },
  );
  return { issues, summary, canExport: summary.error === 0 };
}

export function pageLabel(page: CanvasPageSnapshot | undefined): string {
  return page ? `${page.order + 1}. ${page.title}` : 'Проект';
}

export function participantLabel(participant: ParticipantRecord | undefined): string {
  if (!participant) return '';
  return (
    participant.displayName ||
    [participant.lastName, participant.firstName, participant.middleName].filter(Boolean).join(' ')
  );
}
