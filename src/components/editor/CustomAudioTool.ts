import { supabase } from '../../supabaseClient';
import { icons, makeUploader, makeDeleteButton, makeCard } from './editorUi';

interface AudioData {
  url?: string;
  title?: string;
  audioURL?: string;
}

export class CustomAudioTool {
  private data: AudioData;
  private wrapper: HTMLElement | null = null;

  static get toolbox() {
    return { title: 'Аудіо', icon: icons.music };
  }

  constructor({ data }: { data: AudioData }) {
    const initialData = data || {};
    if (initialData.audioURL && !initialData.url) {
      this.data = { url: initialData.audioURL, title: initialData.title || 'Аудіо файл' };
    } else {
      this.data = initialData;
    }
  }

  render(): HTMLElement {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('audio-tool');

    if (this.data.url) {
      this._createAudioElement(this.data.url, this.data.title);
    } else {
      this._createUploader();
    }
    return this.wrapper;
  }

  private _createUploader(): void {
    if (!this.wrapper) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.style.display = 'none';

    const button = makeUploader(icons.music, 'Завантажити аудіо');
    button.addEventListener('click', () => input.click());

    input.addEventListener('change', async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      button.querySelector('span:last-child')!.textContent = 'Завантаження...';
      button.disabled = true;
      try {
        const url = await this._uploadFile(file);
        this.data = { url, title: file.name };
        if (this.wrapper) {
          this.wrapper.innerHTML = '';
          this._createAudioElement(url, file.name);
        }
      } catch (error) {
        console.error('Upload error:', error);
        button.querySelector('span:last-child')!.textContent = 'Помилка — спробуйте ще раз';
        button.disabled = false;
      }
    });

    this.wrapper.appendChild(button);
    this.wrapper.appendChild(input);
  }

  private _createAudioElement(url: string, title?: string): void {
    if (!this.wrapper) return;
    const container = makeCard();

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px;';

    const titleEl = document.createElement('div');
    titleEl.textContent = title || 'Аудіо файл';
    titleEl.style.cssText = 'font-weight:600;color:#374151;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const deleteBtn = makeDeleteButton();
    deleteBtn.addEventListener('click', () => {
      this.data = {};
      if (this.wrapper) { this.wrapper.innerHTML = ''; this._createUploader(); }
    });

    const audio = document.createElement('audio');
    audio.src = url;
    audio.controls = true;
    audio.style.cssText = 'width:100%;';

    head.appendChild(titleEl);
    head.appendChild(deleteBtn);
    container.appendChild(head);
    container.appendChild(audio);
    this.wrapper.appendChild(container);
  }

  private async _uploadFile(file: File): Promise<string> {
    const path = `audio/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('course-images').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(path);
    return publicUrl;
  }

  save(): AudioData {
    return this.data;
  }

  static get isReadOnlySupported(): boolean {
    return true;
  }
}
