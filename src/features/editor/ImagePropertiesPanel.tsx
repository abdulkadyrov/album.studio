import { RotateCcw, Upload } from 'lucide-react';

import type { ImageLayerUpdate } from '../../canvas/engine/CanvasController';
import type { CanvasLayerSnapshot } from '../../canvas/model/canvas-document';

interface ImagePropertiesPanelProps {
  layer: CanvasLayerSnapshot;
  issue?: { effectiveDpi: number; lowQuality: boolean; missing: boolean; missingMask: boolean };
  error?: string;
  mode?: 'properties' | 'effects';
  onUpdate: (patch: ImageLayerUpdate) => void;
  onReplace: (file: File) => Promise<void>;
  onUploadMask: (file: File) => Promise<void>;
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="image-range">
      <span>{label}</span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{Math.round(value * 100)}</output>
    </label>
  );
}

export function ImagePropertiesPanel({
  layer,
  issue,
  error,
  mode = 'properties',
  onUpdate,
  onReplace,
  onUploadMask,
}: ImagePropertiesPanelProps) {
  const image = layer.image!;
  const resetCrop = () =>
    onUpdate({
      image: {
        cropX: 0.5,
        cropY: 0.5,
        zoom: 1,
        imageRotationDeg: 0,
        flipX: false,
        flipY: false,
      },
    });

  if (mode === 'effects') {
    return (
      <div className="image-properties">
        <div className="image-effects-grid">
          {(
            [
              ['Яркость', 'brightness'],
              ['Контраст', 'contrast'],
              ['Насыщенность', 'saturation'],
              ['Экспозиция', 'exposure'],
              ['Оттенок', 'hue'],
              ['Размытие', 'blur'],
            ] as const
          ).map(([label, key]) => (
            <RangeField
              key={key}
              label={label}
              value={image.effects[key]}
              min={key === 'blur' ? 0 : -1}
              max={1}
              step={0.01}
              onChange={(value) => onUpdate({ image: { effects: { [key]: value } } })}
            />
          ))}
        </div>
        <div className="text-toggle-row">
          <label>
            <input
              type="checkbox"
              checked={image.effects.grayscale}
              onChange={(event) =>
                onUpdate({ image: { effects: { grayscale: event.target.checked } } })
              }
            />{' '}
            Ч/б
          </label>
          <label>
            <input
              type="checkbox"
              checked={image.effects.sepia}
              onChange={(event) =>
                onUpdate({ image: { effects: { sepia: event.target.checked } } })
              }
            />{' '}
            Сепия
          </label>
          <label>
            <input
              aria-label="Тень изображения"
              type="checkbox"
              checked={image.shadow.enabled}
              onChange={(event) =>
                onUpdate({ image: { shadow: { enabled: event.target.checked } } })
              }
            />{' '}
            Тень
          </label>
        </div>
        {image.shadow.enabled ? (
          <div className="text-field-grid text-field-grid--three">
            <label>
              Цвет
              <input
                aria-label="Цвет тени изображения"
                type="color"
                value={image.shadow.color}
                onChange={(event) => onUpdate({ image: { shadow: { color: event.target.value } } })}
              />
            </label>
            <label>
              Размытие
              <input
                aria-label="Размытие тени изображения"
                type="number"
                min="0"
                value={image.shadow.blur}
                onChange={(event) =>
                  onUpdate({ image: { shadow: { blur: Number(event.target.value) } } })
                }
              />
            </label>
            <label>
              Прозр.
              <input
                aria-label="Прозрачность тени изображения"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={image.shadow.opacity}
                onChange={(event) =>
                  onUpdate({ image: { shadow: { opacity: Number(event.target.value) } } })
                }
              />
            </label>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="image-properties">
      {error ? (
        <div className="text-warning" role="alert">
          {error}
        </div>
      ) : null}
      {issue?.missing ? (
        <div className="text-warning" role="alert">
          Оригинал изображения отсутствует. Слой и параметры сохранены.
        </div>
      ) : null}
      {issue?.missingMask ? (
        <div className="text-warning" role="alert">
          Пользовательская SVG-маска отсутствует. Выберите файл маски повторно.
        </div>
      ) : null}
      {issue?.lowQuality ? (
        <div className="text-warning" role="alert">
          Низкое качество для печати: около {issue.effectiveDpi} DPI
        </div>
      ) : null}
      <div className="image-info">
        <strong>{image.filename}</strong>
        <span>
          {image.naturalWidthPx} × {image.naturalHeightPx} px
        </span>
        <span>{issue ? `Эффективно: ${issue.effectiveDpi} DPI` : 'Расчёт DPI…'}</span>
      </div>
      <label className="button button--ghost image-upload-button">
        <Upload size={14} /> Заменить оригинал
        <input
          aria-label="Заменить изображение"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onReplace(file);
            event.target.value = '';
          }}
        />
      </label>
      <label className="button button--ghost image-upload-button">
        <Upload size={14} /> Пользовательская SVG-маска
        <input
          aria-label="Загрузить SVG-маску"
          type="file"
          accept="image/svg+xml,.svg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUploadMask(file);
            event.target.value = '';
          }}
        />
      </label>
      <div className="text-field-grid text-field-grid--two">
        <label>
          Режим
          <select
            aria-label="Режим вписывания"
            value={image.fit}
            onChange={(event) =>
              onUpdate({ image: { fit: event.target.value as 'cover' | 'contain' } })
            }
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label>
          Маска
          <select
            aria-label="Форма фоторамки"
            value={image.frameShape}
            onChange={(event) =>
              onUpdate({ image: { frameShape: event.target.value as typeof image.frameShape } })
            }
          >
            <option value="rectangle">Прямоугольник</option>
            <option value="rounded">Скруглённая</option>
            <option value="circle">Круг</option>
            <option value="oval">Овал</option>
            <option value="polygon">Многоугольник</option>
            <option value="svg">SVG-маска</option>
          </select>
        </label>
        <label>
          Ширина, мм
          <input
            aria-label="Ширина изображения"
            type="number"
            min="1"
            value={layer.widthMm}
            onChange={(event) => onUpdate({ widthMm: Number(event.target.value) })}
          />
        </label>
        <label>
          Высота, мм
          <input
            aria-label="Высота изображения"
            type="number"
            min="1"
            value={layer.heightMm}
            onChange={(event) => onUpdate({ heightMm: Number(event.target.value) })}
          />
        </label>
      </div>
      <RangeField
        label="Фокус по X"
        value={image.cropX}
        min={0}
        max={1}
        step={0.01}
        onChange={(value) => onUpdate({ image: { cropX: value } })}
      />
      <RangeField
        label="Фокус по Y"
        value={image.cropY}
        min={0}
        max={1}
        step={0.01}
        onChange={(value) => onUpdate({ image: { cropY: value } })}
      />
      <RangeField
        label="Масштаб кадра"
        value={image.zoom}
        min={0.1}
        max={5}
        step={0.05}
        onChange={(value) => onUpdate({ image: { zoom: value } })}
      />
      <div className="text-toggle-row">
        <button
          type="button"
          className={image.flipX ? 'is-active' : ''}
          onClick={() => onUpdate({ image: { flipX: !image.flipX } })}
        >
          ↔ Отразить
        </button>
        <button
          type="button"
          className={image.flipY ? 'is-active' : ''}
          onClick={() => onUpdate({ image: { flipY: !image.flipY } })}
        >
          ↕ Отразить
        </button>
        <button type="button" onClick={resetCrop}>
          <RotateCcw size={13} /> Сбросить
        </button>
      </div>
      <div className="text-field-grid text-field-grid--three">
        <label>
          Прозрачность
          <input
            aria-label="Прозрачность изображения"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={layer.opacity}
            onChange={(event) => onUpdate({ opacity: Number(event.target.value) })}
          />
        </label>
        <label>
          Рамка
          <input
            aria-label="Толщина рамки изображения"
            type="number"
            min="0"
            step="0.1"
            value={layer.strokeWidthMm}
            onChange={(event) => onUpdate({ strokeWidthMm: Number(event.target.value) })}
          />
        </label>
        <label>
          Цвет
          <input
            aria-label="Цвет рамки изображения"
            type="color"
            value={layer.stroke === 'transparent' ? '#ffffff' : layer.stroke}
            onChange={(event) => onUpdate({ stroke: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
