import { supabase } from '../../supabaseClient';

interface AudioData {
  url?: string;
  title?: string;
  audioURL?: string;
}

export class CustomAudioTool {
  private data: AudioData;
  private wrapper: HTMLElement | null = null;

  static get toolbox() {
    return {
      title: 'Аудіо',
      icon: '🎵'
    };
  }

  constructor({ data }: { data: AudioData }) {
    const initialData = data || {};
    if (initialData.audioURL && !initialData.url) {
      this.data = {
        url: initialData.audioURL,
        title: initialData.title || 'Аудіо файл'
      };
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

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '🎵 Завантажити аудіо';
    button.style.cssText = `
      width: 100%;
      padding: 15px;
      border: 2px dashed #ccc;
      background: #f9f9f9;
      cursor: pointer;
      border-radius: 8px;
      font-size: 16px;
      transition: all 0.3s;
    `;

    button.addEventListener('mouseover', () => {
      button.style.borderColor = '#007bff';
      button.style.background = '#e3f2fd';
    });

    button.addEventListener('mouseout', () => {
      button.style.borderColor = '#ccc';
      button.style.background = '#f9f9f9';
    });

    button.addEventListener('click', () => input.click());

    input.addEventListener('change', async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        button.textContent = '⏳ Завантаження...';
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
          button.textContent = '❌ Помилка завантаження';
          setTimeout(() => {
            button.textContent = '🎵 Завантажити аудіо';
            button.disabled = false;
          }, 2000);
        }
      }
    });

    this.wrapper.appendChild(button);
    this.wrapper.appendChild(input);
  }

  private _createAudioElement(url: string, title?: string): void {
    if (!this.wrapper) return;
    const container = document.createElement('div');
    container.style.cssText = `border:1px solid #e1e5e9;border-radius:12px;padding:20px;background:linear-gradient(135deg,#f8f9fa 0%,#e9ecef 100%);margin:15px 0;box-shadow:0 2px 8px rgba(0,0,0,.1);`;

    const titleEl = document.createElement('div');
    titleEl.textContent = title || 'Аудіо файл';
    titleEl.style.cssText = `font-weight:600;margin-bottom:15px;color:#333;font-size:16px;`;

    const audio = document.createElement('audio');
    audio.src = url;
    audio.controls = true;
    audio.style.cssText = `width:100%;margin-bottom:15px;`;

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️ Видалити';
    deleteBtn.style.cssText = `padding:8px 16px;background:#dc3545;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;transition:background .3s;`;

    deleteBtn.addEventListener('mouseover', () => { deleteBtn.style.background = '#c82333'; });
    deleteBtn.addEventListener('mouseout', () => { deleteBtn.style.background = '#dc3545'; });

    deleteBtn.addEventListener('click', () => {
      this.data = {};
      if (this.wrapper) {
        this.wrapper.innerHTML = '';
        this._createUploader();
      }
    });

    container.appendChild(titleEl);
    container.appendChild(audio);
    container.appendChild(deleteBtn);
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
