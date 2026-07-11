import { useEffect, useRef, memo, useCallback } from 'react';
import EditorJS, { type OutputData } from '@editorjs/editorjs';
import Header from '@editorjs/header';
import Paragraph from '@editorjs/paragraph';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';
import Delimiter from '@editorjs/delimiter';
import Warning from '@editorjs/warning';
import YoutubeEmbed from 'editorjs-youtube-embed';
import { CustomAudioTool } from './editor/CustomAudioTool';
import { CustomImageTool } from './editor/CustomImageTool';
import { CustomQuizTool } from './editor/CustomQuizTool';

interface EditorProps {
  onChange: (data: OutputData) => void;
  initialData?: OutputData;
}

function EditorBlockInner({ onChange, initialData }: EditorProps) {
  const editorRef = useRef<EditorJS | null>(null);
  const isInitialized = useRef(false);
  const holderRef = useRef<HTMLDivElement>(null);

  const stableOnChange = useCallback(onChange, [onChange]);

  useEffect(() => {
    if (!isInitialized.current && holderRef.current) {
      const editor = new EditorJS({
        holder: holderRef.current,
        tools: {
          header: Header as unknown as Record<string, unknown>,
          paragraph: Paragraph as unknown as Record<string, unknown>,
          list: List as unknown as Record<string, unknown>,
          quote: Quote as unknown as Record<string, unknown>,
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
        isInitialized.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={holderRef}
      className="min-h-[400px] border border-gray-200 rounded-xl p-4 bg-white"
      style={{ fontSize: 16 }}
    />
  );
}

export default memo(EditorBlockInner);
