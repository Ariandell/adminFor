import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

interface ImageDropZoneProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Existing image URL to show when no new file is selected */
  currentUrl?: string | null;
  /** Compact variant for tight grids */
  compact?: boolean;
}

export default function ImageDropZone({ label, file, onChange, currentUrl, compact }: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped && dropped.type.startsWith('image/')) {
        onChange(dropped);
      }
    },
    [onChange]
  );

  const shownImage = preview || currentUrl || null;

  return (
    <div>
      <span className="block text-[13px] font-medium text-muted-foreground mb-1.5">{label}</span>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${label}: натисніть або перетягніть зображення сюди`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed cursor-pointer select-none transition-all duration-200 overflow-hidden ${
          compact ? 'h-28' : 'h-36'
        } ${
          dragOver
            ? 'border-accent bg-accent-soft'
            : shownImage
              ? 'border-border bg-muted/30 hover:border-muted-foreground/40'
              : 'border-border bg-muted/40 hover:border-muted-foreground/40 hover:bg-muted/70'
        }`}
      >
        {shownImage ? (
          <>
            <img src={shownImage || "/placeholder.svg"} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-colors flex items-center justify-center group">
              <span className="opacity-0 group-hover:opacity-100 text-white text-[13px] font-medium transition-opacity drop-shadow">
                Замінити
              </span>
            </div>
            <button
              type="button"
              aria-label="Прибрати зображення"
              onClick={e => {
                e.stopPropagation();
                onChange(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <ImagePlus size={17} className="text-muted-foreground" />
            </div>
            <span className="text-[13px] text-muted-foreground text-center px-3 leading-snug">
              {dragOver ? 'Відпустіть, щоб додати' : compact ? 'Додати фото' : 'Натисніть або перетягніть фото'}
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={e => onChange(e.target.files?.[0] || null)}
        />
      </div>
    </div>
  );
}
