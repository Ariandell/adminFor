import ReactDOM from 'react-dom/client';
import React from 'react';
import type { API, BlockAPI } from '@editorjs/editorjs';
import { QuizBuilderForm, type QuizData } from './QuizBuilderForm';
import { protectNativeFields } from './nativeFieldEvents';

export class CustomQuizTool {
  private data: QuizData;
  private api: API;
  private block: BlockAPI;
  private wrapper: HTMLElement;
  private revision = 0;
  private reactRoot: ReturnType<typeof ReactDOM.createRoot> | null;

  static get toolbox() {
    return { title: 'Тест', icon: '❓' };
  }

  constructor({ data, api, block }: { data: QuizData; api: API; block: BlockAPI }) {
    this.data = data || {};
    this.api = api;
    this.block = block;
    this.wrapper = document.createElement('div');
    this.reactRoot = null;

    protectNativeFields(this.wrapper);
  }

  private handleDelete = () => {
    if (!confirm('Видалити цей тест з уроку?')) return;
    const index = this.api.blocks.getBlockIndex(this.block.id);
    this.api.blocks.delete(index);
  };

  render(): HTMLElement {
    if (!this.reactRoot) {
      this.reactRoot = ReactDOM.createRoot(this.wrapper);
    }
    this.reactRoot.render(
      React.createElement(QuizBuilderForm, {
        initialData: this.data,
        onChange: (newData: QuizData) => {
          this.data = newData;
          // editorjs-undo watches DOM mutations; input.value changes alone are invisible.
          this.wrapper.dataset.editorRevision = String(++this.revision);
          this.block.dispatchChange();
        },
        onDelete: this.handleDelete,
      })
    );
    return this.wrapper;
  }

  destroy() {
    if (this.reactRoot) {
      this.reactRoot.unmount();
    }
  }

  save(): QuizData {
    return this.data;
  }
}
