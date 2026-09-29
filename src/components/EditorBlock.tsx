import { useEffect, useRef, memo, useState, forwardRef, useImperativeHandle } from 'react';
import EditorJS, { type OutputData } from '@editorjs/editorjs';
import List from '@editorjs/list';
import Warning from '@editorjs/warning';
import Table from '@editorjs/table';
import Undo from 'editorjs-undo';
import {
  Undo2, Redo2, Type, Heading1, Heading2, Heading3, Bold, Italic, Underline,
  Strikethrough, Highlighter, List as ListIcon, ListOrdered, ListChecks, Table2, Link2,
  ImagePlus, Music2, Video, Quote as QuoteIcon, FileQuestion, ChevronDown, Sparkles,
} from 'lucide-react';
import { CustomAudioTool } from './editor/CustomAudioTool';
import { CustomImageTool } from './editor/CustomImageTool';
import { CustomQuizTool } from './editor/CustomQuizTool';
import { CustomAITool } from './editor/CustomAITool';
import { CustomYoutubeTool } from './editor/CustomYoutubeTool';
import { normalizeEditorLink } from '../lib/editorLink';
import { MarkerTool, StrikeTool, UnderlineTool, toggleInlineTag } from './editor/inlineFormats';
import { inlineMarks, RichHeader, RichParagraph, RichQuote } from './editor/richTextTools';
import { normalizePastedHtml } from './editor/normalizePastedHtml';

interface EditorProps {
  initialData?: OutputData;
  onDirty?: () => void;
}

export interface EditorBlockHandle {
  save: () => Promise<OutputData | null>;
}

type MenuName = 'blocks' | 'format' | 'lists' | 'media';

const EditorBlockInner = forwardRef<EditorBlockHandle, EditorProps>(function EditorBlockInner({ initialData, onDirty }, ref) {
  const editorRef = useRef<EditorJS | null>(null);
  const undoRef = useRef<any>(null);
  const isInitialized = useRef(false);
  const onDirtyRef = useRef(onDirty);
  onDirtyRef.current = onDirty;
  const holderRef = useRef<HTMLDivElement>(null);
  const [undoReady, setUndoReady] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const linkRangeRef = useRef<Range | null>(null);

  useImperativeHandle(ref, () => ({
    save: async () => {
      const editor = editorRef.current;
      if (!editor) return null;
      await editor.isReady;
      const mediaStatus = holderRef.current?.querySelector<HTMLElement>('[data-editor-media-status="pending"], [data-editor-media-status="empty"], [data-editor-media-status="error"]')?.dataset.editorMediaStatus;
      if (mediaStatus === 'pending') throw new Error('Дочекайтеся завершення завантаження медіафайлу.');
      if (mediaStatus === 'error') throw new Error('Медіафайл не завантажився. Спробуйте ще раз.');
      if (mediaStatus === 'empty') throw new Error('Додайте файл у порожній медіаблок або видаліть його.');
      return editor.saver.save();
    },
  }), []);

  useEffect(() => {
    const holder = holderRef.current;
    const normalizePaste = (event: ClipboardEvent) => {
      if (!holder || !(event.target instanceof Element) || event.target.closest('input, textarea, select')) return;
      const clipboard = event.clipboardData;
      const originalHtml = clipboard?.getData('text/html');
      if (!clipboard || !originalHtml) return;
      const normalizedHtml = normalizePastedHtml(originalHtml);
      if (normalizedHtml === originalHtml) return;
      const normalizedClipboard = new DataTransfer();
      normalizedClipboard.setData('text/html', normalizedHtml);
      normalizedClipboard.setData('text/plain', clipboard.getData('text/plain'));
      event.preventDefault();
      event.stopImmediatePropagation();
      event.target.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: normalizedClipboard,
      }));
    };
    holder?.addEventListener('paste', normalizePaste, true);
    if (!isInitialized.current && holderRef.current) {
      const editor = new EditorJS({
        holder: holderRef.current,
        sanitizer: inlineMarks,
        tools: {
          header: { class: RichHeader, inlineToolbar: true } as unknown as Record<string, unknown>,
          paragraph: { class: RichParagraph, inlineToolbar: true } as unknown as Record<string, unknown>,
          list: { class: List, inlineToolbar: true } as unknown as Record<string, unknown>,
          quote: { class: RichQuote, inlineToolbar: true } as unknown as Record<string, unknown>,
          youtubeEmbed: CustomYoutubeTool,
          audio: CustomAudioTool as unknown as Record<string, unknown>,
          image: CustomImageTool as unknown as Record<string, unknown>,
          warning: Warning,
          table: { class: Table, inlineToolbar: true } as unknown as Record<string, unknown>,
          underline: UnderlineTool,
          strike: StrikeTool,
          marker: MarkerTool,
          quiz: CustomQuizTool,
          aiBlock: CustomAITool,
        },
        data: initialData,
        onReady() {
          const undo = new Undo({ editor });
          // editorjs-undo cannot restore an empty block array; let it capture
          // Editor.js's own first paragraph for a new lesson instead.
          if (initialData?.blocks?.length) undo.initialize(initialData);
          undoRef.current = undo;
          setUndoReady(true);
        },
        onChange() {
          // Track edits without serializing the entire lesson on every keystroke.
          onDirtyRef.current?.();
        },
        placeholder: 'Почніть писати ваш урок тут...',
        minHeight: 300,
      });

      editorRef.current = editor;
      isInitialized.current = true;
    }

    return () => {
      holder?.removeEventListener('paste', normalizePaste, true);
      if (editorRef.current?.destroy) {
        editorRef.current.destroy();
        editorRef.current = null;
        undoRef.current = null;
        isInitialized.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toolbarBtn = 'inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-2 text-slate-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35';
  const menuItem = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-100 transition hover:bg-white/10';

  const editorSelection = () => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const holder = holderRef.current;
    const start = range?.startContainer instanceof Element ? range.startContainer : range?.startContainer.parentElement;
    const end = range?.endContainer instanceof Element ? range.endContainer : range?.endContainer.parentElement;
    return range && !range.collapsed && holder?.contains(range.startContainer) && holder.contains(range.endContainer) &&
      start?.closest('[contenteditable="true"]') === end?.closest('[contenteditable="true"]')
      ? range
      : null;
  };

  const format = (command: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'hiliteColor') => {
    const range = editorSelection();
    if (!range) return;
    if (command === 'underline') toggleInlineTag(range, 'u');
    else if (command === 'strikeThrough') toggleInlineTag(range, 's');
    else if (command === 'hiliteColor') toggleInlineTag(range, 'mark');
    else document.execCommand(command);
    onDirtyRef.current?.();
    setOpenMenu(null);
  };

  const insertBlock = async (type: string, data: Record<string, unknown> = {}) => {
    const editor = editorRef.current;
    if (!editor) return;
    await editor.isReady;
    editor.blocks.insert(type, data, undefined, undefined, true);
    onDirtyRef.current?.();
    setOpenMenu(null);
  };

  const openLink = () => {
    const range = editorSelection();
    if (!range) return;
    linkRangeRef.current = range.cloneRange();
    setLinkUrl('');
    setLinkError('');
    setOpenMenu(null);
    setLinkOpen(true);
  };

  const addLink = (event: React.FormEvent) => {
    event.preventDefault();
    const url = normalizeEditorLink(linkUrl);
    const range = linkRangeRef.current;
    if (!url) { setLinkError('Введіть коректне посилання https:// або email.'); return; }
    if (!range || !range.startContainer.isConnected || !holderRef.current?.contains(range.startContainer) || !holderRef.current.contains(range.endContainer)) {
      setLinkError('Виділення змінилося. Виділіть текст ще раз.');
      return;
    }
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('createLink', false, url);
    onDirtyRef.current?.();
    linkRangeRef.current = null;
    setLinkOpen(false);
  };

  useEffect(() => {
    const onLinkShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && editorSelection()) {
        event.preventDefault();
        openLink();
      }
    };
    window.addEventListener('keydown', onLinkShortcut, true);
    return () => window.removeEventListener('keydown', onLinkShortcut, true);
  });

  const historyAction = (action: 'undo' | 'redo') => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      document.execCommand(action);
      return;
    }
    undoRef.current?.[action]();
  };

  const toggleMenu = (menu: MenuName) => setOpenMenu(current => current === menu ? null : menu);

  return (
    <div className="overflow-visible rounded-2xl border border-lavender-100 bg-paper-200 shadow-cozy-sm">
      <div className="sticky top-3 z-20 mx-3 mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#273238]/95 px-2 py-1.5 shadow-xl backdrop-blur">
        <button type="button" disabled={!undoReady} onMouseDown={event => event.preventDefault()} onClick={() => historyAction('undo')} title="Скасувати (Ctrl+Z)" className={toolbarBtn}><Undo2 size={18} /></button>
        <button type="button" disabled={!undoReady} onMouseDown={event => event.preventDefault()} onClick={() => historyAction('redo')} title="Повторити (Ctrl+Y)" className={toolbarBtn}><Redo2 size={18} /></button>
        <div className="mx-1 h-5 w-px shrink-0 bg-white/15" />

        <div className="relative">
          <button type="button" onClick={() => toggleMenu('blocks')} className={toolbarBtn} title="Текст і блоки"><Type size={18} /><ChevronDown size={13} /></button>
          {openMenu === 'blocks' && <div className="absolute left-0 top-11 z-30 w-56 rounded-xl border border-white/10 bg-[#273238] p-1.5 shadow-2xl">
            <button type="button" className={menuItem} onClick={() => insertBlock('paragraph')}><Type size={17} /> Текст</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('header', { text: '', level: 1 })}><Heading1 size={17} /> Заголовок 1</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('header', { text: '', level: 2 })}><Heading2 size={17} /> Заголовок 2</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('header', { text: '', level: 3 })}><Heading3 size={17} /> Заголовок 3</button>
            <div className="my-1 border-t border-white/10" />
            <button type="button" className={menuItem} onClick={() => insertBlock('quote', { text: '', caption: '', alignment: 'left' })}><QuoteIcon size={17} /> Цитата</button>
          </div>}
        </div>

        <div className="relative">
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => toggleMenu('format')} className={toolbarBtn} title="Форматування"><Bold size={18} /><ChevronDown size={13} /></button>
          {openMenu === 'format' && <div className="absolute left-0 top-11 z-30 w-52 rounded-xl border border-white/10 bg-[#273238] p-1.5 shadow-2xl">
            <button type="button" onMouseDown={e => e.preventDefault()} className={menuItem} onClick={() => format('bold')}><Bold size={17} /> Жирний</button>
            <button type="button" onMouseDown={e => e.preventDefault()} className={menuItem} onClick={() => format('italic')}><Italic size={17} /> Курсив</button>
            <button type="button" onMouseDown={e => e.preventDefault()} className={menuItem} onClick={() => format('underline')}><Underline size={17} /> Підкреслення</button>
            <button type="button" onMouseDown={e => e.preventDefault()} className={menuItem} onClick={() => format('strikeThrough')}><Strikethrough size={17} /> Закреслення</button>
            <button type="button" onMouseDown={e => e.preventDefault()} className={menuItem} onClick={() => format('hiliteColor')}><Highlighter size={17} /> Виділити</button>
          </div>}
        </div>

        <div className="relative">
          <button type="button" onClick={() => toggleMenu('lists')} className={toolbarBtn} title="Списки"><ListIcon size={18} /><ChevronDown size={13} /></button>
          {openMenu === 'lists' && <div className="absolute left-0 top-11 z-30 w-52 rounded-xl border border-white/10 bg-[#273238] p-1.5 shadow-2xl">
            <button type="button" className={menuItem} onClick={() => insertBlock('list', { style: 'ordered', meta: {}, items: [{ content: '', meta: {}, items: [] }] })}><ListOrdered size={17} /> Нумерований</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('list', { style: 'unordered', meta: {}, items: [{ content: '', meta: {}, items: [] }] })}><ListIcon size={17} /> Маркований</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('list', { style: 'checklist', meta: {}, items: [{ content: '', meta: { checked: false }, items: [] }] })}><ListChecks size={17} /> Чекліст</button>
          </div>}
        </div>

        <button type="button" onClick={() => insertBlock('table', { withHeadings: true, content: [['', ''], ['', '']] })} className={toolbarBtn} title="Таблиця"><Table2 size={18} /></button>
        <div className="relative">
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={openLink} className={toolbarBtn} title="Посилання (виділіть текст)"><Link2 size={18} /></button>
          {linkOpen && <form onSubmit={addLink} className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-white/10 bg-[#273238] p-3 shadow-2xl">
            <label htmlFor="editor-link-url" className="mb-2 block text-xs font-semibold text-slate-100">Посилання для виділеного тексту</label>
            <input id="editor-link-url" autoFocus type="text" inputMode="url" value={linkUrl} onChange={event => { setLinkUrl(event.target.value); setLinkError(''); }} placeholder="https://example.com" className="w-full rounded-lg border border-white/20 bg-white px-3 py-2 text-sm text-slate-900" />
            {linkError && <p role="alert" className="mt-2 text-xs text-rose-200">{linkError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setLinkOpen(false); linkRangeRef.current = null; }} className="rounded-lg px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">Скасувати</button>
              <button type="submit" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900">Додати</button>
            </div>
          </form>}
        </div>

        <div className="relative">
          <button type="button" onClick={() => toggleMenu('media')} className={toolbarBtn} title="Матеріали"><ImagePlus size={18} /><ChevronDown size={13} /></button>
          {openMenu === 'media' && <div className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-white/10 bg-[#273238] p-1.5 shadow-2xl">
            <button type="button" className={menuItem} onClick={() => insertBlock('image')}><ImagePlus size={17} /> Зображення</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('audio')}><Music2 size={17} /> Аудіо</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('youtubeEmbed', { url: '' })}><Video size={17} /> Відео з YouTube</button>
          </div>}
        </div>
        <button type="button" onClick={() => insertBlock('quiz')} className={toolbarBtn} title="Додати вправу"><FileQuestion size={18} /></button>
        <button type="button" onClick={() => insertBlock('aiBlock')} className={toolbarBtn} title="Додати AI-блок"><Sparkles size={18} /></button>
      </div>

      <div className="p-4 pt-5 sm:p-8 sm:pt-9">
        <div ref={holderRef} className="word-sheet mx-auto min-h-[500px] max-w-4xl rounded-xl bg-white px-6 py-8 shadow-cozy-lg ring-1 ring-black/5 sm:px-10 sm:py-12" />
      </div>
    </div>
  );
});

export default memo(EditorBlockInner);
