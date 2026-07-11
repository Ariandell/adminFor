import ReactDOM from 'react-dom/client';
import React from 'react';
import { QuizBuilderForm, type QuizData } from './QuizBuilderForm';

export class CustomQuizTool {
  private data: QuizData;
  private wrapper: HTMLElement;
  private reactRoot: ReturnType<typeof ReactDOM.createRoot> | null;

  static get toolbox() {
    return { title: 'Тест', icon: '❓' };
  }

  constructor({ data }: { data: QuizData }) {
    this.data = data || {};
    this.wrapper = document.createElement('div');
    this.reactRoot = null;
  }

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
