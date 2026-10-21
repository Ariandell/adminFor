import React from 'react';
import ReactDOM from 'react-dom/client';
import type { API, BlockAPI } from '@editorjs/editorjs';
import { normalizeSpeakingTask, type SpeakingTaskData } from '../../lib/speakingTask';
import { protectNativeFields } from './nativeFieldEvents';
import { SpeakingTaskForm } from './SpeakingTaskForm';

export class SpeakingTool {
  private data: SpeakingTaskData;
  private api: API;
  private block: BlockAPI;
  private wrapper: HTMLElement;
  private revision = 0;
  private reactRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;

  static get toolbox() {
    return {
      title: 'Усне завдання',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>',
    };
  }

  static get sanitize() {
    // The normalizer removes tags; preserving plain strings here avoids HTML-encoding '<' and '&'.
    return { title: true, prompt: true, criteria: true, targetWords: true };
  }

  constructor({ data, api, block }: { data: unknown; api: API; block: BlockAPI }) {
    this.data = normalizeSpeakingTask(data);
    this.api = api;
    this.block = block;
    this.wrapper = document.createElement('div');
    protectNativeFields(this.wrapper);
    for (const eventName of ['click', 'keydown', 'keyup', 'keypress']) {
      this.wrapper.addEventListener(eventName, event => {
        if (event instanceof KeyboardEvent && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') return;
        if (event.target instanceof Element && event.target.closest('button')) event.stopPropagation();
      });
    }
  }

  private handleDelete = () => {
    if (!confirm('Видалити це усне завдання з уроку?')) return;
    const index = this.api.blocks.getBlockIndex(this.block.id);
    this.api.blocks.delete(index);
  };

  render(): HTMLElement {
    if (!this.reactRoot) this.reactRoot = ReactDOM.createRoot(this.wrapper);
    this.reactRoot.render(React.createElement(SpeakingTaskForm, {
      data: this.data,
      onChange: (data: SpeakingTaskData) => {
        this.data = normalizeSpeakingTask(data);
        // editorjs-undo observes this mutation for native input changes too.
        this.wrapper.dataset.editorRevision = String(++this.revision);
        this.block.dispatchChange();
      },
      onDelete: this.handleDelete,
    }));
    return this.wrapper;
  }

  save(): SpeakingTaskData {
    return normalizeSpeakingTask(this.data);
  }

  destroy() {
    const root = this.reactRoot;
    this.reactRoot = null;
    // Editor.js can destroy a block during another React root's render.
    queueMicrotask(() => root?.unmount());
  }
}
