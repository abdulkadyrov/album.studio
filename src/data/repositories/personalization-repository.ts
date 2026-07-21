import {
  resolveLayerBindings,
  type ParticipantBindingContext,
} from '../../features/personalization/binding-resolver';
import { database } from '../db/database';
import type { OverrideRecord, ParticipantRecord } from '../db/schema';
import type { CanvasDocument, CanvasLayerSnapshot } from '../../canvas/model/canvas-document';
import { canvasSceneRepository } from './canvas-scene-repository';

export interface PersonalizedDocumentResult {
  baseDocument: CanvasDocument;
  viewDocument: CanvasDocument;
  participant?: ParticipantRecord;
  overrideCount: number;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyPatch(
  layer: CanvasLayerSnapshot,
  patch: Record<string, unknown>,
): CanvasLayerSnapshot {
  const textPatch = patch.text;
  const imagePatch = patch.image;
  const nextLayer: CanvasLayerSnapshot = {
    ...layer,
    ...patch,
    text:
      layer.text || textPatch
        ? {
            ...layer.text!,
            ...(typeof textPatch === 'object' && textPatch ? textPatch : {}),
          }
        : undefined,
    image:
      layer.image || imagePatch
        ? {
            ...layer.image!,
            ...(typeof imagePatch === 'object' && imagePatch ? imagePatch : {}),
          }
        : undefined,
  };
  return nextLayer;
}

function layerDiff(
  base: CanvasLayerSnapshot,
  changed: CanvasLayerSnapshot,
): Record<string, unknown> | undefined {
  const patch: Record<string, unknown> = {};
  const keys = Object.keys(changed) as Array<keyof CanvasLayerSnapshot>;
  for (const key of keys) {
    if (key === 'id' || key === 'pageId' || key === 'parentId' || key === 'zIndex') continue;
    if (!deepEqual(base[key], changed[key])) patch[key] = changed[key];
  }
  return Object.keys(patch).length > 0 ? patch : undefined;
}

async function buildContext(
  projectId: string,
  participantId: string,
): Promise<ParticipantBindingContext> {
  const [project, participant, participantPhotos] = await Promise.all([
    database.projects.get(projectId),
    database.participants.get(participantId),
    database.participantPhotos.where('participantId').equals(participantId).toArray(),
  ]);
  const assets = await database.assets.bulkGet(participantPhotos.map((photo) => photo.assetId));
  return {
    project,
    participant,
    participantPhotos,
    assetsById: new Map(assets.flatMap((asset) => (asset ? [[asset.id, asset] as const] : []))),
  };
}

function applyOverrides(document: CanvasDocument, overrides: OverrideRecord[]): CanvasDocument {
  const layersById = new Map(document.layers.map((layer) => [layer.id, layer]));
  const layers = document.layers.flatMap((layer) => {
    const override = overrides.find((candidate) => candidate.layerId === layer.id);
    if (!override) return [layer];
    if (override.patch.hidden === true) return [];
    return [applyPatch(layer, override.patch)];
  });
  for (const override of overrides) {
    if (layersById.has(override.layerId)) continue;
    const overrideLayer = override.patch.__layer;
    if (typeof overrideLayer === 'object' && overrideLayer) {
      layers.push(overrideLayer as CanvasLayerSnapshot);
    }
  }
  return { ...document, layers };
}

export const personalizationRepository = {
  async getParticipantView(
    projectId: string,
    participantId: string,
  ): Promise<PersonalizedDocumentResult | undefined> {
    const baseDocument = await canvasSceneRepository.load(projectId);
    if (!baseDocument) return undefined;
    const [context, overrides] = await Promise.all([
      buildContext(projectId, participantId),
      database.overrides.where('participantId').equals(participantId).toArray(),
    ]);
    const resolved = resolveLayerBindings(baseDocument, context);
    return {
      baseDocument,
      viewDocument: applyOverrides(resolved, overrides),
      participant: context.participant,
      overrideCount: overrides.length,
    };
  },

  async saveParticipantView(
    projectId: string,
    participantId: string,
    baseDocument: CanvasDocument,
    viewDocument: CanvasDocument,
  ): Promise<void> {
    const context = await buildContext(projectId, participantId);
    const resolved = resolveLayerBindings(baseDocument, context);
    const baseLayers = new Map(resolved.layers.map((layer) => [layer.id, layer]));
    const viewLayers = new Map(viewDocument.layers.map((layer) => [layer.id, layer]));
    const nextOverrides: OverrideRecord[] = [];
    const now = new Date().toISOString();

    for (const [layerId, viewLayer] of viewLayers) {
      const baseLayer = baseLayers.get(layerId);
      const patch = baseLayer
        ? layerDiff(baseLayer, viewLayer)
        : ({ __layer: viewLayer } as Record<string, unknown>);
      if (!patch) continue;
      nextOverrides.push({
        id: `override-${participantId}-${layerId}`,
        projectId,
        participantId,
        pageId: viewLayer.pageId,
        layerId,
        patch: { ...patch, updatedAt: now },
      });
    }

    for (const [layerId, baseLayer] of baseLayers) {
      if (viewLayers.has(layerId)) continue;
      nextOverrides.push({
        id: `override-${participantId}-${layerId}`,
        projectId,
        participantId,
        pageId: baseLayer.pageId,
        layerId,
        patch: { hidden: true, updatedAt: now },
      });
    }

    await database.transaction('rw', database.overrides, async () => {
      const existing = await database.overrides
        .where('participantId')
        .equals(participantId)
        .toArray();
      const nextIds = new Set(nextOverrides.map((override) => override.id));
      const staleIds = existing
        .filter((override) => override.projectId === projectId && !nextIds.has(override.id))
        .map((override) => override.id);
      if (staleIds.length > 0) await database.overrides.bulkDelete(staleIds);
      if (nextOverrides.length > 0) await database.overrides.bulkPut(nextOverrides);
    });
  },
};
