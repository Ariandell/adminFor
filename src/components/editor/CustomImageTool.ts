import { supabase } from '../../supabaseClient';

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
    return {
      title: 'Зображення',
      icon: '🖼️'
    };
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

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '🖼️ Завантажити зображення';
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
      button.style.borderColor = '#28a745';
      button.style.background = '#e8f5e8';
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
          this.data = {
            url,
            file: { url, name: file.name, size: file.size },
            caption: ''
          };
          if (this.wrapper) {
            this.wrapper.innerHTML = '';
            this._createImageElement();
          }
        } catch (error) {
          console.error('Upload error:', error);
          button.textContent = '❌ Помилка завантаження';
          setTimeout(() => {
            button.textContent = '🖼️ Завантажити зображення';
            button.disabled = false;
          }, 2000);
        }
      }
    });

    this.wrapper.appendChild(button);
    this.wrapper.appendChild(input);
  }

  private _createImageElement(): void {
    if (!this.wrapper) return;

    const imageUrl = this.data.url || this.data.file?.url;
    if (!imageUrl) return;

    const container = document.createElement('div');
    container.style.cssText = `border:1px solid #e1e5e9;border-radius:12px;padding:20px;background:#fff;margin:15px 0;box-shadow:0 2px 8px rgba(0,0,0,.1);`;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = `max-width:100%;height:auto;border-radius:8px;margin-bottom:15px;display:block;`;
    img.alt = this.data.caption || '';

    const captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.placeholder = 'Додайте підпис до зображення...';
    captionInput.value = this.data.caption || '';
    captionInput.style.cssText = `width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin-bottom:15px;font-size:14px;`;

    captionInput.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.data.caption = target.value;
      img.alt = target.value;
    });

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

    container.appendChild(img);
    container.appendChild(captionInput);
    container.appendChild(deleteBtn);
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
