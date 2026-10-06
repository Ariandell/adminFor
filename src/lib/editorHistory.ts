import type { OutputData } from '@editorjs/editorjs';

export type HistoryAction = 'undo' | 'redo';

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'isComposing'>;

/** Use physical keys too: Ctrl+Я is Ctrl+Z on a Ukrainian keyboard. */
export function editorHistoryShortcut(event: ShortcutEvent): HistoryAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return null;
  const key = event.key.toLowerCase();
  if (event.code === 'KeyZ' || key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if ((event.code === 'KeyY' || key === 'y') && !event.shiftKey) return 'redo';
  return null;
}

/** Restoring a block can regenerate its id; that alone is not an author edit. */
export function editorContentChanged(previous: OutputData['blocks'], current: OutputData['blocks']): boolean {
  const content = (blocks: OutputData['blocks']) => blocks.map(({ type, data, tunes }) => ({ type, data, tunes }));
  return JSON.stringify(content(previous)) !== JSON.stringify(content(current));
}

interface HistoryBackend {
  registerChange: () => void;
  editorDidUpdate: (blocks: OutputData['blocks']) => boolean;
  save: (blocks: OutputData['blocks']) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

/** Serialize history actions and flush typing that is still inside the plugin's debounce. */
export function createEditorHistory(
  saveEditor: () => Promise<OutputData>,
  backend: HistoryBackend,
  onError: (error: unknown) => void,
) {
  let disposed = false;
  let busy = false;
  let revision = 0;
  let queue = Promise.resolve();

  backend.registerChange = () => {
    if (disposed || busy) return;
    const captureRevision = ++revision;
    void saveEditor().then(data => {
      // An older asynchronous save must never put undone content back in history.
      if (disposed || busy || captureRevision !== revision) return;
      if (backend.editorDidUpdate(data.blocks)) backend.save(data.blocks);
    }).catch(onError);
  };

  return {
    run(action: HistoryAction): Promise<void> {
      queue = queue.then(async () => {
        if (disposed) return;
        busy = true;
        ++revision;
        try {
          const data = await saveEditor();
          if (disposed) return;
          if (backend.editorDidUpdate(data.blocks)) backend.save(data.blocks);
          await backend[action]();
        } finally {
          busy = false;
        }
      }).catch(onError);
      return queue;
    },
    dispose() {
      disposed = true;
      ++revision;
    },
  };
}
