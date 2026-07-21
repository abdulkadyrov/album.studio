import { Star, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import type { TextLayerUpdate } from '../../canvas/engine/CanvasController';
import type { CanvasLayerSnapshot, CanvasTextStyle } from '../../canvas/model/canvas-document';
import type { FontAsset } from '../../data/repositories/font-repository';
import { BUILTIN_FONTS } from '../../services/font-registry';

interface TextPropertiesPanelProps {
  layer: CanvasLayerSnapshot;
  fonts: FontAsset[];
  issue?: { overflow: boolean; missingFont: boolean };
  mode?: 'properties' | 'effects';
  fontError?: string;
  onUpdate: (patch: TextLayerUpdate) => void;
  onUploadFont: (file: File, family: string) => Promise<void>;
  onDeleteFont: (fontId: string) => Promise<void>;
  onToggleFavorite: (fontId: string, favorite: boolean) => Promise<void>;
}

function NumericField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

export function TextPropertiesPanel({
  layer,
  fonts,
  issue,
  mode = 'properties',
  fontError,
  onUpdate,
  onUploadFont,
  onDeleteFont,
  onToggleFavorite,
}: TextPropertiesPanelProps) {
  const text = layer.text!;
  const [draft, setDraft] = useState(text.content);
  const [fontSearch, setFontSearch] = useState('');
  const fontInputRef = useRef<HTMLInputElement>(null);
  const filteredFonts = useMemo(
    () =>
      fonts.filter((font) =>
        `${font.family} ${font.filename}`
          .toLocaleLowerCase('ru-RU')
          .includes(fontSearch.toLocaleLowerCase('ru-RU')),
      ),
    [fontSearch, fonts],
  );

  const chooseFont = (value: string) => {
    if (value.startsWith('asset:')) {
      const asset = fonts.find((font) => font.id === value.slice(6));
      if (asset) onUpdate({ text: { fontFamily: asset.family, fontAssetId: asset.id } });
    } else {
      onUpdate({ text: { fontFamily: value.slice(8), fontAssetId: undefined } });
    }
  };

  const effects = (
    <>
      <div className="text-properties__section">
        <h3>Обводка</h3>
        <div className="text-properties__grid">
          <label className="text-field text-field--color">
            <span>Цвет</span>
            <input
              type="color"
              value={layer.stroke === 'transparent' ? '#000000' : layer.stroke}
              onChange={(event) => onUpdate({ stroke: event.target.value })}
            />
          </label>
          <NumericField
            label="Толщина, мм"
            value={layer.strokeWidthMm}
            min={0}
            max={10}
            step={0.1}
            onChange={(value) => onUpdate({ strokeWidthMm: value })}
          />
        </div>
      </div>
      <div className="text-properties__section">
        <label className="text-check">
          <input
            type="checkbox"
            checked={text.shadow.enabled}
            onChange={(event) => onUpdate({ text: { shadow: { enabled: event.target.checked } } })}
          />
          <span>Тень</span>
        </label>
        <div className="text-properties__grid">
          <label className="text-field text-field--color">
            <span>Цвет тени</span>
            <input
              type="color"
              value={text.shadow.color}
              onChange={(event) => onUpdate({ text: { shadow: { color: event.target.value } } })}
            />
          </label>
          <NumericField
            label="Прозрачность"
            value={text.shadow.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => onUpdate({ text: { shadow: { opacity: value } } })}
          />
          <NumericField
            label="Размытие"
            value={text.shadow.blur}
            min={0}
            max={50}
            onChange={(value) => onUpdate({ text: { shadow: { blur: value } } })}
          />
          <NumericField
            label="X, мм"
            value={text.shadow.offsetXmm}
            min={-20}
            max={20}
            step={0.5}
            onChange={(value) => onUpdate({ text: { shadow: { offsetXmm: value } } })}
          />
          <NumericField
            label="Y, мм"
            value={text.shadow.offsetYmm}
            min={-20}
            max={20}
            step={0.5}
            onChange={(value) => onUpdate({ text: { shadow: { offsetYmm: value } } })}
          />
        </div>
      </div>
    </>
  );

  if (mode === 'effects') return <div className="text-properties">{effects}</div>;

  return (
    <div className="text-properties" data-testid="text-properties">
      {issue?.missingFont ? (
        <div className="text-issue text-issue--danger" role="alert">
          Шрифт «{text.fontFamily}» отсутствует. Исходное название сохранено — выберите замену или
          загрузите файл.
        </div>
      ) : null}
      {issue?.overflow ? (
        <div className="text-issue" role="status">
          Текст не помещается в заданную область или превышает лимит строк.
        </div>
      ) : null}
      {fontError ? <div className="text-issue text-issue--danger">{fontError}</div> : null}

      <div className="text-properties__section">
        <h3>Содержимое</h3>
        <textarea
          value={draft}
          rows={3}
          aria-label="Содержимое текста"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => draft !== text.content && onUpdate({ text: { content: draft } })}
        />
        <small>Двойной клик по тексту — редактирование прямо на холсте.</small>
      </div>

      <div className="text-properties__section">
        <h3>Шрифт</h3>
        <input
          className="text-properties__search"
          value={fontSearch}
          placeholder="Поиск шрифта"
          aria-label="Поиск шрифта"
          onChange={(event) => setFontSearch(event.target.value)}
        />
        <select
          aria-label="Семейство шрифта"
          value={text.fontAssetId ? `asset:${text.fontAssetId}` : `builtin:${text.fontFamily}`}
          onChange={(event) => chooseFont(event.target.value)}
        >
          <optgroup label="Встроенные">
            {BUILTIN_FONTS.map((font) => (
              <option key={font.id} value={`builtin:${font.family}`}>
                {font.label}
              </option>
            ))}
          </optgroup>
          {filteredFonts.length > 0 ? (
            <optgroup label="Пользовательские">
              {filteredFonts.map((font) => (
                <option key={font.id} value={`asset:${font.id}`}>
                  {font.favorite ? '★ ' : ''}
                  {font.family}
                </option>
              ))}
            </optgroup>
          ) : null}
          {issue?.missingFont ? (
            <option
              value={text.fontAssetId ? `asset:${text.fontAssetId}` : `builtin:${text.fontFamily}`}
              disabled
            >
              ⚠ {text.fontFamily}
            </option>
          ) : null}
        </select>
        <div className="font-actions">
          <button type="button" onClick={() => fontInputRef.current?.click()}>
            <Upload size={12} /> Загрузить
          </button>
          <input
            ref={fontInputRef}
            hidden
            type="file"
            aria-label="Файл шрифта"
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUploadFont(file, file.name.replace(/\.[^.]+$/, ''));
              event.currentTarget.value = '';
            }}
          />
        </div>
        {filteredFonts.map((font) => (
          <div key={font.id} className="font-row" style={{ fontFamily: font.family }}>
            <span>{font.family}</span>
            <button
              type="button"
              aria-label={`${font.favorite ? 'Убрать из избранного' : 'В избранное'} ${font.family}`}
              onClick={() => void onToggleFavorite(font.id, !font.favorite)}
            >
              <Star size={11} fill={font.favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              aria-label={`Удалить шрифт ${font.family}`}
              onClick={() =>
                window.confirm(`Удалить шрифт «${font.family}»?`) && void onDeleteFont(font.id)
              }
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      <div className="text-properties__section">
        <h3>Типографика</h3>
        <div className="text-properties__grid">
          <NumericField
            label="Размер, pt"
            value={text.fontSizePt}
            min={1}
            max={300}
            step={0.5}
            onChange={(value) => onUpdate({ text: { fontSizePt: value } })}
          />
          <NumericField
            label="Минимум, pt"
            value={text.minFontSizePt}
            min={1}
            max={text.fontSizePt}
            step={0.5}
            onChange={(value) => onUpdate({ text: { minFontSizePt: value } })}
          />
          <NumericField
            label="Межбуквенный"
            value={text.letterSpacingEm}
            min={-0.2}
            max={2}
            step={0.01}
            onChange={(value) => onUpdate({ text: { letterSpacingEm: value } })}
          />
          <NumericField
            label="Межстрочный"
            value={text.lineHeight}
            min={0.5}
            max={4}
            step={0.05}
            onChange={(value) => onUpdate({ text: { lineHeight: value } })}
          />
          <NumericField
            label="Отступ, мм"
            value={text.paddingMm}
            min={0}
            max={30}
            step={0.5}
            onChange={(value) => onUpdate({ text: { paddingMm: value } })}
          />
          <NumericField
            label="Прозрачность"
            value={layer.opacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) => onUpdate({ opacity: value })}
          />
        </div>
        <div className="text-toggle-row">
          <button
            type="button"
            className={text.fontWeight === 'bold' ? 'is-active' : ''}
            aria-label="Жирный"
            onClick={() =>
              onUpdate({ text: { fontWeight: text.fontWeight === 'bold' ? 'normal' : 'bold' } })
            }
          >
            B
          </button>
          <button
            type="button"
            className={text.fontStyle === 'italic' ? 'is-active' : ''}
            aria-label="Курсив"
            onClick={() =>
              onUpdate({ text: { fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' } })
            }
          >
            I
          </button>
          <button
            type="button"
            className={text.underline ? 'is-active' : ''}
            aria-label="Подчёркивание"
            onClick={() => onUpdate({ text: { underline: !text.underline } })}
          >
            U
          </button>
          <button
            type="button"
            className={text.linethrough ? 'is-active' : ''}
            aria-label="Зачёркивание"
            onClick={() => onUpdate({ text: { linethrough: !text.linethrough } })}
          >
            S
          </button>
          <label>
            <span>Цвет</span>
            <input
              type="color"
              value={layer.fill}
              onChange={(event) => onUpdate({ fill: event.target.value })}
            />
          </label>
        </div>
        <div className="text-properties__grid">
          <label className="text-field">
            <span>Выравнивание</span>
            <select
              value={text.textAlign}
              onChange={(event) =>
                onUpdate({
                  text: { textAlign: event.target.value as CanvasTextStyle['textAlign'] },
                })
              }
            >
              <option value="left">Слева</option>
              <option value="center">По центру</option>
              <option value="right">Справа</option>
              <option value="justify">По ширине</option>
            </select>
          </label>
          <label className="text-field">
            <span>По вертикали</span>
            <select
              value={text.verticalAlign}
              onChange={(event) =>
                onUpdate({
                  text: { verticalAlign: event.target.value as CanvasTextStyle['verticalAlign'] },
                })
              }
            >
              <option value="top">Сверху</option>
              <option value="middle">По центру</option>
              <option value="bottom">Снизу</option>
            </select>
          </label>
          <label className="text-field">
            <span>Регистр</span>
            <select
              value={text.textCase}
              onChange={(event) =>
                onUpdate({ text: { textCase: event.target.value as CanvasTextStyle['textCase'] } })
              }
            >
              <option value="original">Как введено</option>
              <option value="upper">ВЕРХНИЙ</option>
              <option value="lower">нижний</option>
              <option value="title">Каждое Слово</option>
              <option value="sentence">Только первая</option>
            </select>
          </label>
          <label className="text-field">
            <span>Направление</span>
            <select
              value={text.direction}
              onChange={(event) =>
                onUpdate({
                  text: { direction: event.target.value as CanvasTextStyle['direction'] },
                })
              }
            >
              <option value="ltr">Слева направо</option>
              <option value="rtl">Справа налево</option>
            </select>
          </label>
        </div>
      </div>

      <div className="text-properties__section">
        <h3>Текстовая область</h3>
        <div className="text-properties__grid">
          <label className="text-field">
            <span>Размер области</span>
            <select
              value={text.boxMode}
              onChange={(event) =>
                onUpdate({ text: { boxMode: event.target.value as CanvasTextStyle['boxMode'] } })
              }
            >
              <option value="auto">Автоматический</option>
              <option value="fixed">Фиксированный</option>
            </select>
          </label>
          <label className="text-field">
            <span>Переполнение</span>
            <select
              value={text.overflowMode}
              onChange={(event) =>
                onUpdate({
                  text: { overflowMode: event.target.value as CanvasTextStyle['overflowMode'] },
                })
              }
            >
              <option value="warn">Предупреждение</option>
              <option value="shrink">Автоуменьшение</option>
              <option value="clip">Обрезка</option>
              <option value="wrap">Перенос</option>
            </select>
          </label>
          <NumericField
            label="Макс. строк"
            value={text.maxLines ?? 4}
            min={1}
            max={100}
            onChange={(value) => onUpdate({ text: { maxLines: value } })}
          />
          <NumericField
            label="Высота, мм"
            value={layer.heightMm}
            min={5}
            max={300}
            step={1}
            onChange={(value) => onUpdate({ heightMm: value })}
          />
        </div>
      </div>
      {effects}
    </div>
  );
}
