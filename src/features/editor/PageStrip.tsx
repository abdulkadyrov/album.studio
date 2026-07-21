import { ChevronLeft, ChevronRight, Copy, FilePlus2, PanelsTopLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { CanvasLayerSnapshot, CanvasPageGroup } from '../../canvas/model/canvas-document';

interface PageStripProps {
  groups: CanvasPageGroup[];
  activeGroupId: string;
  layerCountByPage: Record<string, number>;
  layersByPage: Record<string, CanvasLayerSnapshot[]>;
  onSelect: (groupId: string) => void;
  onAddPage: () => void;
  onAddSpread: () => void;
  onDuplicate: (groupId: string) => void;
  onDelete: (groupId: string) => void;
  onMove: (groupId: string, direction: -1 | 1) => void;
}

export function PageStrip({
  groups,
  activeGroupId,
  layerCountByPage,
  layersByPage,
  onSelect,
  onAddPage,
  onAddSpread,
  onDuplicate,
  onDelete,
  onMove,
}: PageStripProps) {
  const [draggedGroupId, setDraggedGroupId] = useState<string>();

  return (
    <footer className="page-strip" aria-label="Страницы альбома" data-testid="page-strip">
      <div className="page-strip__scroll">
        {groups.map((group, index) => {
          const isSpread = group.pages.length === 2;
          const layerCount = group.pages.reduce(
            (total, page) => total + (layerCountByPage[page.id] ?? 0),
            0,
          );
          return (
            <article
              key={group.id}
              className={`page-thumbnail ${group.id === activeGroupId ? 'is-active' : ''}`}
              draggable
              data-testid={`page-group-${group.id}`}
              onDragStart={() => setDraggedGroupId(group.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedGroupId && draggedGroupId !== group.id) {
                  const sourceIndex = groups.findIndex(
                    (candidate) => candidate.id === draggedGroupId,
                  );
                  onMove(draggedGroupId, sourceIndex < index ? 1 : -1);
                }
                setDraggedGroupId(undefined);
              }}
            >
              <button
                className="page-thumbnail__preview"
                type="button"
                onClick={() => onSelect(group.id)}
              >
                <span className={`page-miniature ${isSpread ? 'is-spread' : ''}`}>
                  {group.pages.map((page) => (
                    <i key={page.id}>
                      <b>{page.order + 1}</b>
                      {(layersByPage[page.id] ?? [])
                        .filter((layer) => layer.visible)
                        .slice(0, 8)
                        .map((layer) => (
                          <em
                            key={layer.id}
                            style={{
                              left: `${(layer.xMm / page.widthMm) * 100}%`,
                              top: `${(layer.yMm / page.heightMm) * 100}%`,
                              width: `${Math.min(100, (layer.widthMm / page.widthMm) * 100)}%`,
                              height: `${Math.min(100, (layer.heightMm / page.heightMm) * 100)}%`,
                              background: layer.fill,
                              borderRadius: layer.kind === 'circle' ? '50%' : '1px',
                              opacity: layer.opacity,
                            }}
                          />
                        ))}
                      <small>{layerCountByPage[page.id] ?? 0}</small>
                    </i>
                  ))}
                </span>
                <small>{isSpread ? `Разворот ${index + 1}` : group.pages[0]!.title}</small>
              </button>
              <div className="page-thumbnail__actions">
                <button
                  type="button"
                  aria-label="Переместить страницу влево"
                  disabled={index === 0}
                  onClick={() => onMove(group.id, -1)}
                >
                  <ChevronLeft size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Дублировать страницу"
                  onClick={() => onDuplicate(group.id)}
                >
                  <Copy size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Удалить страницу"
                  disabled={groups.length === 1}
                  onClick={() => onDelete(group.id)}
                >
                  <Trash2 size={11} />
                </button>
                <button
                  type="button"
                  aria-label="Переместить страницу вправо"
                  disabled={index === groups.length - 1}
                  onClick={() => onMove(group.id, 1)}
                >
                  <ChevronRight size={11} />
                </button>
              </div>
              <span className="page-thumbnail__meta">{layerCount} сл.</span>
            </article>
          );
        })}
      </div>
      <div className="page-strip__create">
        <button type="button" onClick={onAddPage}>
          <FilePlus2 size={14} />
          <span>Страница</span>
        </button>
        <button type="button" onClick={onAddSpread}>
          <PanelsTopLeft size={14} />
          <span>Разворот</span>
        </button>
      </div>
    </footer>
  );
}
