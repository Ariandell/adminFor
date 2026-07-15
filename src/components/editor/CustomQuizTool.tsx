import ReactDOM from 'react-dom/client';
import React from 'react';
import type { API, BlockAPI } from '@editorjs/editorjs';
import { QuizBuilderForm, type QuizData } from './QuizBuilderForm';

export class CustomQuizTool {
  private data: QuizData;
  private api: API;
  private block: BlockAPI;
  private wrapper: HTMLElement;
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

    // Editor.js перехоплює Backspace/Enter/Tab/стрілки на рівні блоків,
    // через що у полях тесту не можна видаляти текст побуквенно.
    // Зупиняємо спливання подій клавіатури та буфера обміну з полів вводу.
    const stopBubbling = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        e.stopPropagation();
      }
    };
    (['keydown', 'keyup', 'keypress', 'paste', 'cut', 'copy'] as const).forEach(eventName => {
      this.wrapper.addEventListener(eventName, stopBubbling);
    });
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
