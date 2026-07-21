import JSZip from 'jszip';

import type { CanvasDocument, CanvasPageGroup } from '../../canvas/model/canvas-document';
import { database } from '../../data/db/database';
import { personalizationRepository } from '../../data/repositories/personalization-repository';
import { createRasterPdf } from './pdf-writer';
import { renderPage, type RenderedPage } from './print-renderer';

export type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'zip';

export interface ExportJobSettings {
  projectId: string;
  document: CanvasDocument;
  groups: CanvasPageGroup[];
  participantIds: string[];
  format: ExportFormat;
  imageFormat: 'png' | 'jpeg';
  dpi: number;
  spread: boolean;
}

export interface ExportProgress {
  completed: number;
  total: number;
  currentLabel: string;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  pages: number;
  warnings: string[];
}

function safeName(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function renderJobs(
  settings: ExportJobSettings,
  signal: AbortSignal,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Array<{ label: string; rendered: RenderedPage }>> {
  const participantIds =
    settings.participantIds.length > 0 ? settings.participantIds : ['template'];
  const total = participantIds.length * settings.groups.length;
  const rendered: Array<{ label: string; rendered: RenderedPage }> = [];
  let completed = 0;

  for (const participantId of participantIds) {
    signal.throwIfAborted();
    const document =
      participantId === 'template'
        ? settings.document
        : ((await personalizationRepository.getParticipantView(settings.projectId, participantId))
            ?.viewDocument ?? settings.document);
    const participant =
      participantId === 'template' ? undefined : await database.participants.get(participantId);
    const prefix = participant
      ? safeName(
          participant.displayName ||
            [participant.lastName, participant.firstName, participant.middleName]
              .filter(Boolean)
              .join(' '),
        )
      : 'template';
    for (const group of settings.groups) {
      signal.throwIfAborted();
      onProgress?.({ completed, total, currentLabel: `${prefix} · ${group.title}` });
      const renderedPage = await renderPage({
        document,
        group,
        dpi: settings.dpi,
        spread: settings.spread,
      });
      rendered.push({
        label: `${prefix}/${safeName(group.title || 'page')}`,
        rendered: renderedPage,
      });
      completed += 1;
      onProgress?.({ completed, total, currentLabel: `${prefix} · ${group.title}` });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
  }

  return rendered;
}

async function imageBlob(page: RenderedPage, format: 'png' | 'jpeg'): Promise<Blob> {
  if (format === 'png') {
    page.pngBlob ??= await page.canvasToPng();
    return page.pngBlob;
  }
  page.jpegBlob ??= await page.canvasToJpeg();
  return page.jpegBlob;
}

export async function runExportJob(
  settings: ExportJobSettings,
  signal: AbortSignal,
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportResult> {
  if (!Number.isFinite(settings.dpi) || settings.dpi < 72 || settings.dpi > 1200) {
    throw new Error('DPI должен быть от 72 до 1200');
  }
  const rendered = await renderJobs(settings, signal, onProgress);
  if (rendered.length === 0) throw new Error('Нет страниц для экспорта');
  const basename = safeName(`${settings.projectId}-${settings.dpi}dpi`) || 'vakha-export';

  if (settings.format === 'pdf') {
    const blob = await createRasterPdf(rendered.map((item) => item.rendered));
    return { blob, filename: `${basename}.pdf`, pages: rendered.length, warnings: [] };
  }

  if (settings.format === 'png' || settings.format === 'jpeg') {
    if (rendered.length === 1) {
      const blob = await imageBlob(rendered[0]!.rendered, settings.format);
      return {
        blob,
        filename: `${basename}.${settings.format === 'jpeg' ? 'jpg' : 'png'}`,
        pages: 1,
        warnings: [],
      };
    }
  }

  const zip = new JSZip();
  const extension = settings.imageFormat === 'jpeg' ? 'jpg' : 'png';
  for (const item of rendered) {
    signal.throwIfAborted();
    zip.file(`${item.label}.${extension}`, await imageBlob(item.rendered, settings.imageFormat));
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, filename: `${basename}.zip`, pages: rendered.length, warnings: [] };
}

export async function saveExportHistory(
  projectId: string,
  status: 'completed' | 'cancelled' | 'failed',
  payload: Record<string, unknown>,
): Promise<void> {
  await database.exportHistory.put({
    id: `export-${crypto.randomUUID()}`,
    projectId,
    status,
    createdAt: new Date().toISOString(),
    payload,
  });
}
