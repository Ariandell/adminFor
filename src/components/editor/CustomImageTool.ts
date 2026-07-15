import { supabase } from '../../supabaseClient';
import { icons, makeUploader, makeDeleteButton, makeCard } from './editorUi';

interface ImageData {
  url?: string;
  caption?: string;
  file?: {
    url: string;
    name: string;
    size?: number;
  };
}

export class CustomImageTool {
  private data: ImageData;
  private wrapper: HTMLElement | null = null;

  static get toolbox() {
    return { title: 'Зображення', icon: icons.image };
  }

  constructor({ data }: { data: ImageData }) {
    this.data = data || {};
  }

  render(): HTMLElement {
    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('image-tool');

    if (this.data.url || this.data.file?.url) {
      this._createImageElement();
    } else {
      this._createUploader();
    }
    return this.wrapper;
  }

  private _createUploader(): void {
    if (!this.wrapper) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    const button = makeUploader(icons.image, 'Завантажити зображення');
    button.addEventListener('click', () => input.click());

    input.addEventListener('change', async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      button.querySelector('span:last-child')!.textContent = 'Завантаження...';
      button.disabled = true;
      try {
        const url = await this._uploadFile(file);
        this.data = { url, file: { url, name: file.name, size: file.size }, caption: '' };
        if (this.wrapper) {
          this.wrapper.innerHTML = '';
          this._createImageElement();
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

  private _createImageElement(): void {
    if (!this.wrapper) return;

    const imageUrl = this.data.url || this.data.file?.url;
    if (!imageUrl) return;

    const container = makeCard();

    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = 'max-width:100%;height:auto;border-radius:8px;margin-bottom:12px;display:block;';
    img.alt = this.data.caption || '';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.placeholder = 'Підпис до зображення (необовʼязково)';
    captionInput.value = this.data.caption || '';
    captionInput.style.cssText = 'flex:1;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none;';
    captionInput.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.data.caption = target.value;
      img.alt = target.value;
    });

    const deleteBtn = makeDeleteButton();
    deleteBtn.addEventListener('click', () => {
      this.data = {};
      if (this.wrapper) { this.wrapper.innerHTML = ''; this._createUploader(); }
    });

    row.appendChild(captionInput);
    row.appendChild(deleteBtn);
    container.appendChild(img);
    container.appendChild(row);
    this.wrapper.appendChild(container);
  }

  private async _uploadFile(file: File): Promise<string> {
    const path = `images/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('course-images').upload(path, file);
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('course-images').getPublicUrl(path);
    return publicUrl;
  }

  save(): ImageData {
    return this.data;
  }

  static get isReadOnlySupported(): boolean {
    return true;
  }
}
