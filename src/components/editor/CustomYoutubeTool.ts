import { youtubeVideoId } from '../../lib/youtubeVideo';
import { protectNativeFields } from './nativeFieldEvents';
import type { BlockAPI } from '@editorjs/editorjs';

interface YoutubeData { url?: string }

export class CustomYoutubeTool {
  private data: YoutubeData;
  private block: BlockAPI;

  static get toolbox() { return { title: 'Відео з YouTube', icon: '▶' }; }

  constructor({ data, block }: { data: YoutubeData; block: BlockAPI }) { this.data = data || {}; this.block = block; }

  render(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'rounded-xl border border-lavender-200 bg-white p-4';
    protectNativeFields(wrapper);

    const label = document.createElement('label');
    label.className = 'mb-2 block text-sm font-semibold text-ink';
    label.textContent = 'Посилання на YouTube';

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'url';
    input.placeholder = 'https://www.youtube.com/watch?v=…';
    input.value = this.data.url || '';
    input.className = 'w-full rounded-lg border border-lavender-200 bg-white px-3 py-2 text-sm';
    label.appendChild(input);

    const preview = document.createElement('div');
    preview.className = 'mt-3 text-sm text-ink-600';
    const updatePreview = () => {
      preview.replaceChildren();
      const id = youtubeVideoId(input.value);
      if (!id) {
        preview.textContent = input.value ? 'Перевірте адресу відео.' : 'Вставте адресу відео, щоб побачити обкладинку.';
        return;
      }
      const image = document.createElement('img');
      image.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      image.alt = 'Обкладинка відео';
      image.className = 'max-h-48 rounded-lg';
      preview.appendChild(image);
    };
    input.addEventListener('input', () => { this.data.url = input.value.trim(); updatePreview(); this.block.dispatchChange(); });
    updatePreview();
    wrapper.append(label, preview);
    return wrapper;
  }

  save(): YoutubeData { return this.data; }
  static get isReadOnlySupported(): boolean { return true; }
}
