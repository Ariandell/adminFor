import { useEffect, useRef, memo, useCallback, useState } from 'react';
import EditorJS, { type OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import Paragraph from '@editorjs/paragraph';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Delimiter from '@editorjs/delimiter';
import Warning from '@editorjs/warning';
import YoutubeEmbed from 'editorjs-youtube-embed';
import Undo from 'editorjs-undo';
import { Undo2, Redo2, Bold, Italic, Underline } from 'lucide-react';
import { CustomAudioTool } from './editor/CustomAudioTool';
import { CustomImageTool } from './editor/CustomImageTool';
import { CustomQuizTool } from './editor/CustomQuizTool';

interface EditorProps {
  onChange: (data: OutputData) => void;
  initialData?: OutputData;
}

function EditorBlockInner({ onChange, initialData }: EditorProps) {
  const editorRef = useRef<EditorJS | null>(null);
  const undoRef = useRef<any>(null);
  const isInitialized = useRef(false);
  const holderRef = useRef<HTMLDivElement>(null);
  const [undoReady, setUndoReady] = useState(false);

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
          quiz: CustomQuizTool,
        },
        data: initialData,
        async onChange(api) {
          const data = await api.saver.save();
          stableOnChange(data);
        },
        onReady() {
          const undo = new Undo({ editor });
          if (initialData) {
            undo.initialize(initialData);
          }
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

  const toolbarBtn = 'p-2 rounded-md text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:shadow-none transition';

  // Інлайн-форматування виділеного тексту, як у Word (Ctrl+B / Ctrl+I / Ctrl+U теж працюють)
  const format = (command: 'bold' | 'italic' | 'underline') => {
    document.execCommand(command);
  };

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
      {/* Панель-стрічка у стилі Word — липка при прокрутці */}
      <div className="sticky top-0 z-10 flex items-center gap-1 px-3 py-2 bg-gray-50/95 backdrop-blur border-b border-gray-200">
        <button type="button" disabled={!undoReady} onClick={() => undoRef.current?.undo()}
          title="Скасувати (Ctrl+Z)" className={toolbarBtn}>
          <Undo2 size={17} />
        </button>
        <button type="button" disabled={!undoReady} onClick={() => undoRef.current?.redo()}
          title="Повторити (Ctrl+Y)" className={toolbarBtn}>
          <Redo2 size={17} />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1.5" />
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => format('bold')}
          title="Жирний (Ctrl+B)" className={toolbarBtn}>
          <Bold size={17} />
        </button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => format('italic')}
          title="Курсив (Ctrl+I)" className={toolbarBtn}>
          <Italic size={17} />
        </button>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => format('underline')}
          title="Підкреслений (Ctrl+U)" className={toolbarBtn}>
          <Underline size={17} />
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1.5" />
        <span className="text-xs text-gray-400 select-none">Натисніть «+» ліворуч, щоб додати блок</span>
      </div>

      {/* «Стіл» із білим «аркушем», як документ Word */}
      <div className="p-6 sm:p-8 overflow-auto max-h-[70vh]">
        <div
          ref={holderRef}
          className="word-sheet mx-auto bg-white rounded-sm shadow-md ring-1 ring-black/5 min-h-[500px] px-10 py-12"
        />
      </div>
    </div>
  );
}

export default memo(EditorBlockInner);
