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

interface HistoryViewport {
  finish: () => Promise<void>;
  cancel: () => void;
}

/** Keep focus restoration from scrolling the sheet or any of its ancestors. */
export function preserveEditorScroll(holder: HTMLElement): HistoryViewport {
  const view = holder.ownerDocument.defaultView!;
  const positions: { element: HTMLElement; top: number; left: number }[] = [];
  for (let element: HTMLElement | null = holder; element; element = element.parentElement) {
    positions.push({ element, top: element.scrollTop, left: element.scrollLeft });
  }
  let active = true;
  let frame = 0;
  let timer = 0;
  let resolveFinish: (() => void) | undefined;
  const restore = () => {
    if (!active) return;
    for (const { element, top, left } of positions) {
      if (element.scrollTop !== top || element.scrollLeft !== left) {
        element.scrollTo({ top, left, behavior: 'instant' });
      }
    }
  };
  const tick = () => {
    restore();
    if (active) frame = view.requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (!active) return;
    active = false;
    view.cancelAnimationFrame(frame);
    view.clearTimeout(timer);
    view.removeEventListener('scroll', restore, true);
    for (const type of ['wheel', 'touchmove', 'pointerdown', 'keydown']) {
      view.removeEventListener(type, onInteraction, true);
    }
    resolveFinish?.();
  };
  const onInteraction = (event: Event) => {
    // Queued history shortcuts share the guard; deliberate navigation releases it.
    if (event instanceof view.KeyboardEvent && editorHistoryShortcut(event)) return;
    cancel();
  };
  view.addEventListener('scroll', restore, true);
  for (const type of ['wheel', 'touchmove', 'pointerdown', 'keydown']) {
    view.addEventListener(type, onInteraction, { capture: true, passive: true });
  }
  frame = view.requestAnimationFrame(tick);
  return {
    cancel,
    finish() {
      if (!active) return Promise.resolve();
      restore();
      return new Promise<void>(resolve => {
        resolveFinish = resolve;
        // editorjs-undo defers caret placement by 50 ms.
        // Include that focus change, then release the guard completely.
        timer = view.setTimeout(() => { restore(); cancel(); }, 100);
      });
    },
  };
}

/** Serialize history actions and flush typing that is still inside the plugin's debounce. */
export function createEditorHistory(
  saveEditor: () => Promise<OutputData>,
  backend: HistoryBackend,
  onError: (error: unknown) => void,
  preserveViewport?: () => HistoryViewport,
) {
  let disposed = false;
  let busy = false;
  let revision = 0;
  let queue = Promise.resolve();
  let viewport: HistoryViewport | undefined;

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
          viewport = preserveViewport?.();
          await backend[action]();
        } finally {
          await viewport?.finish();
          viewport = undefined;
          busy = false;
        }
      }).catch(onError);
      return queue;
    },
    dispose() {
      disposed = true;
      viewport?.cancel();
      ++revision;
    },
  };
}
