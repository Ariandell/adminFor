import React from 'react';
import ReactDOM from 'react-dom/client';
import type { API, BlockAPI } from '@editorjs/editorjs';
import { normalizePronunciationTask, type PronunciationTaskData } from '../../lib/pronunciationTask';
import { protectNativeFields } from './nativeFieldEvents';
import { PronunciationTaskForm } from './PronunciationTaskForm';

export class PronunciationTool {
  private data: PronunciationTaskData;
  private api: API;
  private block: BlockAPI;
  private wrapper: HTMLElement;
  private revision = 0;
  private reactRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;

  static get toolbox() {
    return {
      title: 'Вимова',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 10v4m4-7v10m4-14v18m4-14v10m4-12v14m4-9v4"/></svg>',
    };
  }

  static get sanitize() {
    // Plain text is normalized separately; do not HTML-encode '<' and '&'.
    return { title: true, prompt: true, referenceText: true, referenceAudioUrl: true };
  }

  constructor({ data, api, block }: { data: unknown; api: API; block: BlockAPI }) {
    this.data = normalizePronunciationTask(data);
    this.api = api;
    this.block = block;
    this.wrapper = document.createElement('div');
    this.wrapper.dataset.editorMediaStatus = 'ready';
    protectNativeFields(this.wrapper);
    for (const eventName of ['click', 'keydown', 'keyup', 'keypress']) {
      this.wrapper.addEventListener(eventName, event => {
        if (event instanceof KeyboardEvent && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') return;
        if (event.target instanceof Element && event.target.closest('button')) event.stopPropagation();
      });
    }
  }

  private handleDelete = () => {
    if (!confirm('Видалити це завдання з вимови з уроку?')) return;
    this.api.blocks.delete(this.api.blocks.getBlockIndex(this.block.id));
  };

  render(): HTMLElement {
    if (!this.reactRoot) this.reactRoot = ReactDOM.createRoot(this.wrapper);
    this.reactRoot.render(React.createElement(PronunciationTaskForm, {
      data: this.data,
      onChange: (data: PronunciationTaskData) => {
        this.data = normalizePronunciationTask(data);
        this.wrapper.dataset.editorRevision = String(++this.revision);
        this.block.dispatchChange();
      },
      onUploadingChange: (uploading: boolean) => {
        this.wrapper.dataset.editorMediaStatus = uploading ? 'pending' : 'ready';
      },
      onDelete: this.handleDelete,
    }));
    return this.wrapper;
  }

  save(): PronunciationTaskData {
    // History snapshots must retain inactive text; the lesson save canonicalizes it.
    return normalizePronunciationTask(this.data);
  }

  destroy() {
    const root = this.reactRoot;
    this.reactRoot = null;
    queueMicrotask(() => root?.unmount());
  }
}
