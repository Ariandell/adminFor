import { useLayoutEffect, useRef, useState } from 'react';
import type { OutputBlockData } from '@editorjs/editorjs';
import type { LessonDraftPage } from '../../lib/lessonPages';
import './lessonPagePreview.css';

type Props = {
  page: LessonDraftPage;
  pageNumber: number;
  totalPages: number;
};

const paperWidth = 402;
const paperHeight = 874;

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function text(value: unknown): string {
  if (typeof value !== 'string') return '';
  const document = new DOMParser().parseFromString(value, 'text/html');
  document.querySelectorAll('script,style,iframe,object,embed').forEach(node => node.remove());
  return document.body.textContent?.trim() ?? '';
}

function listItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => text(typeof item === 'string' ? item : asRecord(item).content));
}

function blockPreview(block: OutputBlockData, index: number) {
  const data = asRecord(block.data);
  const label = text(data.text);
  const key = block.id ?? `${block.type}-${index}`;
  switch (block.type) {
    case 'paragraph':
      return <p key={key} className="lesson-preview-paragraph">{label || 'Порожній абзац'}</p>;
    case 'header': {
      const level = Number(data.level) || 2;
      const size = level <= 1 ? 25 : level === 2 ? 22 : level === 3 ? 19 : 17;
      return <p key={key} className="lesson-preview-heading" style={{ fontSize: size }}>{label || 'Заголовок'}</p>;
    }
    case 'quote':
      return <div key={key} className="lesson-preview-callout">{label || 'Цитата'}{data.caption && <small>— {text(data.caption)}</small>}</div>;
    case 'warning':
      return <div key={key} className="lesson-preview-callout"><strong>{text(data.title)}</strong><p>{text(data.message)}</p></div>;
    case 'list':
    case 'checklist': {
      const items = listItems(data.items);
      return <ul key={key} className="lesson-preview-list">{items.map((item, i) => <li key={i}>{item || 'Пункт списку'}</li>)}</ul>;
    }
    case 'table': {
      const rows = Array.isArray(data.content) ? data.content as unknown[][] : [];
      return <table key={key} className="lesson-preview-table"><tbody>{rows.map((row, i) => <tr key={i}>{(Array.isArray(row) ? row : []).map((cell, j) => <td key={j}>{text(cell)}</td>)}</tr>)}</tbody></table>;
    }
    case 'image': {
      const url = data.url || asRecord(data.file).url;
      const safeUrl = typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
      return <div key={key} className="lesson-preview-media">{safeUrl ? <img src={safeUrl} alt="" /> : <div className="lesson-preview-media-placeholder">Зображення</div>}{data.caption && <small>{text(data.caption)}</small>}</div>;
    }
    case 'audio':
      return <div key={key} className="lesson-preview-audio">▶ &nbsp; Аудіоматеріал</div>;
    case 'youtubeEmbed':
    case 'embed':
      return <div key={key} className="lesson-preview-video">Відео</div>;
    case 'aiBlock':
      return <div key={key} className="lesson-preview-exercise"><b>Відкрита відповідь</b><p>{text(data.question) || 'Запитання'}</p><div className="lesson-preview-input" /></div>;
    case 'quiz': {
      const questions = Array.isArray(data.questions) ? data.questions : [];
      return <div key={key} className="lesson-preview-exercise">
        <b>{text(data.title) || 'Вправа'}</b>
        {questions.map((raw, i) => {
          const question = asRecord(raw);
          const choices = Array.isArray(question.answers) ? question.answers : Array.isArray(question.items) ? question.items : Array.isArray(question.pairs) ? question.pairs : [];
          return <div key={i} className="lesson-preview-question">
            <strong>{i + 1}. {text(question.text) || 'Запитання'}</strong>
            {question.type === 'text_input' ? <div className="lesson-preview-input" /> :
              <div className="lesson-preview-options">{choices.map((choice: unknown, j: number) => <div key={j}>{text(asRecord(choice).text ?? asRecord(choice).left ?? choice) || 'Варіант'}</div>)}</div>}
          </div>;
        })}
      </div>;
    }
    default:
      return <div key={key} className="lesson-preview-unknown">Блок «{block.type}» — перевірте в застосунку</div>;
  }
}

export default function LessonPagePreview({ page, pageNumber, totalPages }: Props) {
  const [compact, setCompact] = useState(false);
  const [used, setUsed] = useState(0);
  const [capacity, setCapacity] = useState(660);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport) return;
    const measure = () => {
      setUsed(content.scrollHeight);
      setCapacity(viewport.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [page]);

  const ratio = capacity > 0 ? used / capacity : 0;
  const status = ratio > 1 ? 'Не вміщається' : ratio > .9 ? 'Майже заповнено' : 'Поміщається';
  // The actual Flutter scene is a fixed 402×874 layout inside SafeArea and
  // FittedBox. A smaller phone scales the whole sheet, not its page breaks.
  const deviceWidth = compact ? 320 : 393;
  const deviceHeight = compact ? 690 : 852;
  const scale = Math.min(deviceWidth / paperWidth, (deviceHeight - 48) / paperHeight);

  return <aside className="min-w-0 rounded-2xl border border-lavender-200 bg-[#e9e5dc] p-4 xl:sticky xl:top-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-bold text-ink">Передперегляд аркуша {pageNumber}/{totalPages}</h3><p className="text-xs text-ink-600">Той самий макет, що масштабується на телефоні</p></div>
      <div className="inline-flex rounded-lg bg-white p-1 text-xs font-bold">
        <button type="button" onClick={() => setCompact(true)} aria-pressed={compact} className={`rounded px-2 py-1 ${compact ? 'bg-ink text-white' : 'text-ink-600'}`}>Компактний</button>
        <button type="button" onClick={() => setCompact(false)} aria-pressed={!compact} className={`rounded px-2 py-1 ${!compact ? 'bg-ink text-white' : 'text-ink-600'}`}>Звичайний</button>
      </div>
    </div>
    <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold ${ratio > 1 ? 'bg-rose-100 text-rose-800' : ratio > .9 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
      {status} · {Math.round(ratio * 100)}% висоти аркуша
    </div>
    <div className="overflow-x-auto">
      <div style={{ width: deviceWidth, height: deviceHeight, margin: '0 auto', position: 'relative', background: '#102330', borderRadius: 14, overflow: 'hidden' }}>
        <div className="lesson-preview-stage" style={{ left: (deviceWidth - paperWidth * scale) / 2, top: 24, transform: `scale(${scale})` }}>
          <div className="lesson-preview-paper">
            <div className="lesson-preview-spine" />
            <div className="lesson-preview-inner">
              <div className="lesson-preview-header"><span>До змісту</span><span>Завершити</span></div>
              <div className="lesson-preview-rule" />
              <div ref={viewportRef} className="lesson-preview-viewport">
                <div ref={contentRef} className="lesson-preview-flow">
                  {page.blocks.length === 0 ? <p className="lesson-preview-empty">Почніть наповнювати аркуш у редакторі.</p> : page.blocks.map(blockPreview)}
                </div>
              </div>
              <div className="lesson-preview-footer"><span>Попередня</span><span>{pageNumber} / {totalPages}</span><span>Далі</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>;
}
