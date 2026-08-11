import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

interface FileDropzoneProps {
  label: string;
  file: File | null;
  currentUrl?: string | null;
  onChange: (file: File | null) => void;
  hint?: string;
}

export default function FileDropzone({ label, file, currentUrl, onChange, hint }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayUrl = previewUrl ?? currentUrl ?? null;

  return (
    <div>
      <label className="block text-sm font-semibold text-ink-600 mb-1.5">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-lavender-200 bg-lavender-50/40 hover:bg-lavender-50 hover:border-lavender-300 cursor-pointer transition"
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-white border border-lavender-100 shrink-0 flex items-center justify-center text-lavender-300">
          {displayUrl ? <img src={displayUrl} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">
            {file ? file.name : displayUrl ? 'Поточне фото · натисніть, щоб змінити' : 'Натисніть, щоб обрати файл'}
          </p>
          {hint && <p className="text-xs text-ink-400 truncate">{hint}</p>}
        </div>
        {file && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onChange(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="p-1.5 rounded-lg text-ink-400 hover:text-blush-600 hover:bg-blush-50 shrink-0"
            title="Скасувати вибір"
          >
            <X size={16} />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => onChange(e.target.files?.[0] || null)}
        />
      </div>
    </div>
  );
}
