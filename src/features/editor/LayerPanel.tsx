import {
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Folder,
  Group,
  Image as ImageIcon,
  Lock,
  Shapes,
  Trash2,
  Type,
  Ungroup,
  Unlock,
} from 'lucide-react';
import { useState, type MouseEvent } from 'react';

import type { CanvasLayerSnapshot } from '../../canvas/model/canvas-document';
import { IconButton } from '../../components/ui/IconButton';

interface LayerPanelProps {
  layers: CanvasLayerSnapshot[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onReorder: (id: string, targetId: string) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (id: string) => void;
}

export function LayerPanel({
  layers,
  selectedIds,
  onSelect,
  onRename,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  onDelete,
  onMove,
  onReorder,
  onGroup,
  onUngroup,
}: LayerPanelProps) {
  const [editingId, setEditingId] = useState<string>();
  const [editingName, setEditingName] = useState('');
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string>();
  const selectedLayer =
    selectedIds.length === 1 ? layers.find((layer) => layer.id === selectedIds[0]) : undefined;

  const select = (event: MouseEvent, layerId: string) => {
    if (event.metaKey || event.ctrlKey) {
      onSelect(
        selectedIds.includes(layerId)
          ? selectedIds.filter((id) => id !== layerId)
          : [...selectedIds, layerId],
      );
    } else {
      onSelect([layerId]);
    }
  };

  const startRename = (layer: CanvasLayerSnapshot) => {
    setEditingId(layer.id);
    setEditingName(layer.name);
  };

  const finishRename = () => {
    if (editingId) onRename(editingId, editingName);
    setEditingId(undefined);
  };

  const renderLayer = (layer: CanvasLayerSnapshot, depth = 0): React.ReactNode => {
    const children = layers
      .filter((candidate) => candidate.parentId === layer.id)
      .sort((left, right) => right.zIndex - left.zIndex);
    const isGroup = layer.kind === 'group';
    const isCollapsed = collapsedIds.includes(layer.id);
    return (
      <div key={layer.id} className="layer-tree-node">
        <div
          className={`layer-row ${selectedIds.includes(layer.id) ? 'is-selected' : ''}`}
          style={{ '--layer-depth': depth } as React.CSSProperties}
          draggable
          data-testid={`layer-row-${layer.id}`}
          onDragStart={() => setDraggedId(layer.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (draggedId && draggedId !== layer.id) onReorder(draggedId, layer.id);
            setDraggedId(undefined);
          }}
          onClick={(event) => select(event, layer.id)}
          onDoubleClick={() => startRename(layer)}
        >
          <button
            className="layer-row__tree-toggle"
            type="button"
            aria-label={isCollapsed ? 'Развернуть группу' : 'Свернуть группу'}
            disabled={!isGroup}
            onClick={(event) => {
              event.stopPropagation();
              setCollapsedIds((ids) =>
                ids.includes(layer.id) ? ids.filter((id) => id !== layer.id) : [...ids, layer.id],
              );
            }}
          >
            {isGroup ? (
              <ChevronDown className={isCollapsed ? 'is-collapsed' : ''} size={12} />
            ) : null}
          </button>
          <span className="layer-row__icon">
            {isGroup ? (
              <Folder size={13} />
            ) : layer.kind === 'text' ? (
              <Type size={12} />
            ) : layer.image ? (
              <ImageIcon size={12} />
            ) : layer.kind === 'circle' ? (
              <Circle size={12} />
            ) : (
              <Shapes size={13} />
            )}
          </span>
          {editingId === layer.id ? (
            <input
              autoFocus
              value={editingName}
              aria-label="Название слоя"
              onChange={(event) => setEditingName(event.target.value)}
              onBlur={finishRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') finishRename();
                if (event.key === 'Escape') setEditingId(undefined);
              }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <span className="layer-row__name">{layer.name}</span>
          )}
          <button
            type="button"
            aria-label={layer.visible ? `Скрыть ${layer.name}` : `Показать ${layer.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisibility(layer.id);
            }}
          >
            {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            type="button"
            aria-label={
              layer.locked ? `Разблокировать ${layer.name}` : `Заблокировать ${layer.name}`
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggleLock(layer.id);
            }}
          >
            {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </div>
        {isGroup && !isCollapsed ? children.map((child) => renderLayer(child, depth + 1)) : null}
      </div>
    );
  };

  const roots = layers
    .filter(
      (layer) => !layer.parentId || !layers.some((candidate) => candidate.id === layer.parentId),
    )
    .sort((left, right) => right.zIndex - left.zIndex);

  return (
    <div className="layer-panel" data-testid="layer-panel">
      <div className="layer-panel__toolbar">
        <IconButton
          label="Сгруппировать выбранные слои"
          icon={<Group size={13} />}
          disabled={selectedIds.length < 2}
          onClick={() => onGroup(selectedIds)}
        />
        <IconButton
          label="Разгруппировать"
          icon={<Ungroup size={13} />}
          disabled={selectedLayer?.kind !== 'group'}
          onClick={() => selectedLayer && onUngroup(selectedLayer.id)}
        />
        <IconButton
          label="Поднять слой"
          icon={<ChevronUp size={13} />}
          disabled={!selectedLayer}
          onClick={() => selectedLayer && onMove(selectedLayer.id, 1)}
        />
        <IconButton
          label="Опустить слой"
          icon={<ChevronDown size={13} />}
          disabled={!selectedLayer}
          onClick={() => selectedLayer && onMove(selectedLayer.id, -1)}
        />
        <IconButton
          label="Дублировать слой"
          icon={<Copy size={13} />}
          disabled={!selectedLayer}
          onClick={() => selectedLayer && onDuplicate(selectedLayer.id)}
        />
        <IconButton
          label="Удалить слой"
          icon={<Trash2 size={13} />}
          disabled={!selectedLayer}
          onClick={() => selectedLayer && onDelete(selectedLayer.id)}
        />
      </div>
      <div className="layer-tree">{roots.map((layer) => renderLayer(layer))}</div>
      {layers.length === 0 ? (
        <p className="layer-panel__empty">На этой странице пока нет слоёв.</p>
      ) : null}
    </div>
  );
}
