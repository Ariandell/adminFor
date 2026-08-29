import React from 'react';
import ReactDOM from 'react-dom/client';
import type { API, BlockAPI } from '@editorjs/editorjs';
import { AIBlockForm, type AIBlockData } from './AIBlockForm';

const emptyAIBlock: AIBlockData = {
  question: '',
  evaluationPrompt: '',
};

export class CustomAITool {
  private data: AIBlockData;
  private api: API;
  private block: BlockAPI;
  private wrapper: HTMLElement;
  private reactRoot: ReturnType<typeof ReactDOM.createRoot> | null;

  static get toolbox() {
    return { title: 'AI-блок', icon: '✨' };
  }

  constructor({ data, api, block }: { data: Partial<AIBlockData>; api: API; block: BlockAPI }) {
    this.data = { ...emptyAIBlock, ...data };
    this.api = api;
    this.block = block;
    this.wrapper = document.createElement('div');
    this.reactRoot = null;

    const stopBubbling = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        event.stopPropagation();
      }
    };

    (['keydown', 'keyup', 'keypress', 'paste', 'cut', 'copy'] as const).forEach(eventName => {
      this.wrapper.addEventListener(eventName, stopBubbling);
    });
  }

  private handleDelete = () => {
    if (!confirm('Видалити цей AI-блок з уроку?')) return;
    const index = this.api.blocks.getBlockIndex(this.block.id);
    this.api.blocks.delete(index);
  };

  render(): HTMLElement {
    if (!this.reactRoot) this.reactRoot = ReactDOM.createRoot(this.wrapper);

    this.reactRoot.render(
      React.createElement(AIBlockForm, {
        data: this.data,
        onChange: (data: AIBlockData) => {
          this.data = data;
        },
        onDelete: this.handleDelete,
      })
    );

    return this.wrapper;
  }

  save(): AIBlockData {
    return this.data;
  }

  validate(data: AIBlockData): boolean {
    return Boolean(data.question.trim() && data.evaluationPrompt.trim());
  }

  destroy() {
    this.reactRoot?.unmount();
  }
}
