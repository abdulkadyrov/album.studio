export const referenceStatusLabels = {
  active: 'Активный',
  archived: 'Архив',
} as const;

export const referenceSourceLabels = {
  image: 'Изображение',
  site: 'Сайт',
  text: 'Текст',
  other: 'Другое',
} as const;

export const ideaStatusLabels = {
  draft: 'Черновик',
  selected: 'В работу',
  archived: 'Архив',
} as const;

export const ideaPriorityLabels = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
} as const;

export const annotationStatusLabels = {
  open: 'Открыта',
  resolved: 'Решена',
  archived: 'Архив',
} as const;

export const annotationKindLabels = {
  point: 'Точка',
  area: 'Область',
  layer: 'Слой',
  participant: 'Участник',
} as const;
