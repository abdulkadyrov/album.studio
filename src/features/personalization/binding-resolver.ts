import type {
  CanvasDocument,
  CanvasImageStyle,
  CanvasLayerSnapshot,
  LayerBinding,
} from '../../canvas/model/canvas-document';
import type {
  AssetRecord,
  ParticipantPhotoRecord,
  ParticipantRecord,
  ProjectRecord,
} from '../../data/db/schema';

export interface BindingCatalogEntry {
  source: LayerBinding['source'];
  field: string;
  label: string;
  target: 'text' | 'image';
}

export const bindingCatalog: BindingCatalogEntry[] = [
  { source: 'project', field: 'name', label: 'Название проекта', target: 'text' },
  { source: 'class', field: 'schoolName', label: 'Школа', target: 'text' },
  { source: 'class', field: 'className', label: 'Класс', target: 'text' },
  { source: 'class', field: 'academicYear', label: 'Учебный год', target: 'text' },
  { source: 'participant', field: 'fullName', label: 'ФИО участника', target: 'text' },
  { source: 'participant', field: 'firstName', label: 'Имя участника', target: 'text' },
  { source: 'participant', field: 'lastName', label: 'Фамилия участника', target: 'text' },
  { source: 'participant', field: 'role', label: 'Роль участника', target: 'text' },
  {
    source: 'participant',
    field: 'photoAssetId',
    label: 'Главное фото участника',
    target: 'image',
  },
  { source: 'teacher', field: 'fullName', label: 'ФИО учителя', target: 'text' },
  { source: 'teacher', field: 'photoAssetId', label: 'Главное фото учителя', target: 'image' },
];

export interface ParticipantBindingContext {
  project?: ProjectRecord;
  participant?: ParticipantRecord;
  participantPhotos: ParticipantPhotoRecord[];
  assetsById: Map<string, AssetRecord>;
}

function fullName(person?: ParticipantRecord): string {
  if (!person) return '';
  return (
    person.displayName ||
    [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ')
  );
}

function initials(person?: ParticipantRecord): string {
  if (!person) return '';
  return [person.firstName, person.middleName]
    .flatMap((part) => (part ? [`${part[0]}.`] : []))
    .join(' ');
}

function primaryPhoto(context: ParticipantBindingContext): AssetRecord | undefined {
  const photo =
    context.participantPhotos.find((candidate) => candidate.role === 'main') ??
    context.participantPhotos[0];
  return photo ? context.assetsById.get(photo.assetId) : undefined;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function imageFromAsset(base: CanvasImageStyle, asset: AssetRecord): CanvasImageStyle {
  return {
    ...base,
    assetId: asset.id,
    thumbnailAssetId:
      typeof asset.metadata?.thumbnailAssetId === 'string'
        ? asset.metadata.thumbnailAssetId
        : undefined,
    filename: asset.filename,
    mimeType: asset.mimeType,
    naturalWidthPx: numberValue(asset.metadata?.widthPx, base.naturalWidthPx),
    naturalHeightPx: numberValue(asset.metadata?.heightPx, base.naturalHeightPx),
  };
}

function resolveText(
  binding: LayerBinding,
  context: ParticipantBindingContext,
): string | undefined {
  const person = context.participant;
  const project = context.project;
  const classFields: Record<string, string | undefined> = {
    schoolName: project?.schoolName,
    className: project?.className,
    academicYear: project?.academicYear,
  };
  const participantFields: Record<string, string | undefined> = {
    firstName: person?.firstName,
    lastName: person?.lastName,
    middleName: person?.middleName,
    displayName: person?.displayName,
    fullName: fullName(person),
    initials: initials(person),
    role: person?.role ?? (person?.type === 'teacher' ? 'Учитель' : 'Ученик'),
    email: person?.email,
    phone: person?.phone,
    notes: person?.notes,
    status: person?.status,
  };
  const value =
    binding.source === 'project'
      ? project?.[binding.field as keyof ProjectRecord]
      : binding.source === 'class'
        ? classFields[binding.field]
        : participantFields[binding.field];
  return typeof value === 'string' && value.trim() ? value : binding.fallback;
}

export function resolveLayerBindings(
  document: CanvasDocument,
  context: ParticipantBindingContext,
): CanvasDocument {
  return {
    ...document,
    layers: document.layers.map((layer): CanvasLayerSnapshot => {
      if (!layer.binding) return layer;
      if (layer.text) {
        const content = resolveText(layer.binding, context);
        return content ? { ...layer, text: { ...layer.text, content } } : layer;
      }
      if (layer.image && layer.binding.field === 'photoAssetId') {
        const asset = primaryPhoto(context);
        return asset ? { ...layer, image: imageFromAsset(layer.image, asset) } : layer;
      }
      return layer;
    }),
  };
}
