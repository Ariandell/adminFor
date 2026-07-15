// Спільні DOM-хелпери для кастомних інструментів Editor.js (аудіо, зображення).
// Тримають єдиний стиль із рештою адмінки: акцент #2563eb (blue-600), нейтральні межі.

const svg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const icons = {
  image: svg('<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  music: svg('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'),
};

/** Кнопка-завантажувач: пунктирна рамка на всю ширину, наведення — акцентний колір. */
export function makeUploader(iconSvg: string, label: string, accent = '#2563eb'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = `<span style="display:inline-flex">${iconSvg}</span><span>${label}</span>`;
  button.style.cssText =
    'width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px;' +
    'border:2px dashed #d1d5db;background:#f9fafb;color:#6b7280;cursor:pointer;border-radius:12px;' +
    'font-size:15px;font-weight:500;transition:all .2s;';
  button.addEventListener('mouseover', () => {
    button.style.borderColor = accent;
    button.style.background = '#eff6ff';
    button.style.color = accent;
  });
  button.addEventListener('mouseout', () => {
    button.style.borderColor = '#d1d5db';
    button.style.background = '#f9fafb';
    button.style.color = '#6b7280';
  });
  return button;
}

/** Невелика іконкова кнопка видалення: сіра → червона при наведенні. */
export function makeDeleteButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Видалити';
  btn.innerHTML = icons.trash;
  btn.style.cssText =
    'display:inline-flex;align-items:center;justify-content:center;padding:8px;border:none;' +
    'background:transparent;color:#9ca3af;cursor:pointer;border-radius:8px;transition:all .2s;';
  btn.addEventListener('mouseover', () => { btn.style.color = '#ef4444'; btn.style.background = '#fef2f2'; });
  btn.addEventListener('mouseout', () => { btn.style.color = '#9ca3af'; btn.style.background = 'transparent'; });
  return btn;
}

/** Контейнер-картка для відрендереного медіа. */
export function makeCard(): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText =
    'border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#fff;margin:12px 0;';
  return container;
}
