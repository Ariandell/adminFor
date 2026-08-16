import { useEffect, useRef, memo, useCallback, useState } from 'react';
import EditorJS, { type OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import Paragraph from '@editorjs/paragraph';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Delimiter from '@editorjs/delimiter';
import Warning from '@editorjs/warning';
import Table from '@editorjs/table';
import YoutubeEmbed from 'editorjs-youtube-embed';
import Undo from 'editorjs-undo';
import {
  Undo2, Redo2, Type, Heading1, Heading2, Heading3, Bold, Italic, Underline,
  Strikethrough, Highlighter, List as ListIcon, ListOrdered, ListChecks, Table2, Link2,
  ImagePlus, Music2, Video, Quote as QuoteIcon, Minus, FileQuestion, ChevronDown,
} from 'lucide-react';
import { CustomAudioTool } from './editor/CustomAudioTool';
import { CustomImageTool } from './editor/CustomImageTool';
import { CustomQuizTool } from './editor/CustomQuizTool';

interface EditorProps {
  onChange: (data: OutputData) => void;
  initialData?: OutputData;
}

type MenuName = 'blocks' | 'format' | 'lists' | 'media';

function EditorBlockInner({ onChange, initialData }: EditorProps) {
  const editorRef = useRef<EditorJS | null>(null);
  const undoRef = useRef<any>(null);
  const isInitialized = useRef(false);
  const holderRef = useRef<HTMLDivElement>(null);
  const [undoReady, setUndoReady] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);

  const stableOnChange = useCallback(onChange, [onChange]);

  useEffect(() => {
    if (!isInitialized.current && holderRef.current) {
      const editor = new EditorJS({
        holder: holderRef.current,
        tools: {
          header: { class: Header, inlineToolbar: true } as unknown as Record<string, unknown>,
          paragraph: { class: Paragraph, inlineToolbar: true } as unknown as Record<string, unknown>,
          list: { class: List, inlineToolbar: true } as unknown as Record<string, unknown>,
          quote: { class: Quote, inlineToolbar: true } as unknown as Record<string, unknown>,
          youtubeEmbed: YoutubeEmbed as unknown as Record<string, unknown>,
          audio: CustomAudioTool as unknown as Record<string, unknown>,
          image: CustomImageTool as unknown as Record<string, unknown>,
          delimiter: Delimiter,
          warning: Warning,
          table: { class: Table, inlineToolbar: true } as unknown as Record<string, unknown>,
          quiz: CustomQuizTool,
        },
        data: initialData,
        async onChange(api) {
          const data = await api.saver.save();
          stableOnChange(data);
        },
        onReady() {
          const undo = new Undo({ editor });
          if (initialData) undo.initialize(initialData);
          undoRef.current = undo;
          setUndoReady(true);
        },
        placeholder: 'Почніть писати ваш урок тут...',
        minHeight: 300,
      });

      editorRef.current = editor;
      isInitialized.current = true;
    }

    return () => {
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

  const format = (command: 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'hiliteColor') => {
    if (command === 'hiliteColor') document.execCommand(command, false, '#C9F4E8');
    else document.execCommand(command);
  };

  const insertBlock = async (type: string, data: Record<string, unknown> = {}) => {
    const editor = editorRef.current;
    if (!editor) return;
    await editor.isReady;
    editor.blocks.insert(type, data, undefined, undefined, true);
    setOpenMenu(null);
  };

  const addLink = () => {
    const url = window.prompt('Вставте посилання');
    if (url) document.execCommand('createLink', false, url);
  };

  const toggleMenu = (menu: MenuName) => setOpenMenu(current => current === menu ? null : menu);

  return (
    <div className="overflow-visible rounded-2xl border border-lavender-100 bg-paper-200 shadow-cozy-sm">
      <div className="sticky top-3 z-20 mx-3 mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#273238]/95 px-2 py-1.5 shadow-xl backdrop-blur">
        <button type="button" disabled={!undoReady} onClick={() => undoRef.current?.undo()} title="Скасувати (Ctrl+Z)" className={toolbarBtn}><Undo2 size={18} /></button>
        <button type="button" disabled={!undoReady} onClick={() => undoRef.current?.redo()} title="Повторити (Ctrl+Y)" className={toolbarBtn}><Redo2 size={18} /></button>
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
            <button type="button" className={menuItem} onClick={() => insertBlock('delimiter')}><Minus size={17} /> Розділювач</button>
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
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={addLink} className={toolbarBtn} title="Посилання"><Link2 size={18} /></button>

        <div className="relative">
          <button type="button" onClick={() => toggleMenu('media')} className={toolbarBtn} title="Матеріали"><ImagePlus size={18} /><ChevronDown size={13} /></button>
          {openMenu === 'media' && <div className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-white/10 bg-[#273238] p-1.5 shadow-2xl">
            <button type="button" className={menuItem} onClick={() => insertBlock('image')}><ImagePlus size={17} /> Зображення</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('audio')}><Music2 size={17} /> Аудіо</button>
            <button type="button" className={menuItem} onClick={() => insertBlock('youtubeEmbed', { url: '' })}><Video size={17} /> Відео з YouTube</button>
          </div>}
        </div>
        <button type="button" onClick={() => insertBlock('quiz')} className={toolbarBtn} title="Додати вправу"><FileQuestion size={18} /></button>
      </div>

      <div className="max-h-[70vh] overflow-auto p-4 pt-5 sm:p-8 sm:pt-9">
        <div ref={holderRef} className="word-sheet mx-auto min-h-[500px] rounded-xl bg-white px-6 py-8 shadow-cozy-lg ring-1 ring-black/5 sm:px-10 sm:py-12" />
      </div>
    </div>
  );
}

export default memo(EditorBlockInner);
