import { normalizeEditorLink } from '../../lib/editorLink';

/** Editor.js accepts b/i/u in pasted blocks, but drops common Word/web aliases. */
export function normalizePastedHtml(html: string): string {
  if (!/<(?:strong|em|span|a)\b/i.test(html)) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const original of template.content.querySelectorAll('strong, em')) {
    const replacement = document.createElement(original.localName === 'strong' ? 'b' : 'i');
    replacement.replaceChildren(...Array.from(original.childNodes));
    original.replaceWith(replacement);
  }
  for (const span of template.content.querySelectorAll<HTMLSpanElement>('span[style]')) {
    const weight = span.style.fontWeight;
    const bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
    const italic = span.style.fontStyle === 'italic' || span.style.fontStyle === 'oblique';
    const decoration = span.style.textDecorationLine || span.style.textDecoration;
    const fragment = document.createDocumentFragment();
    fragment.append(...Array.from(span.childNodes));
    let content: Node = fragment;
    for (const tag of [bold && 'b', italic && 'i', decoration.includes('underline') && 'u', decoration.includes('line-through') && 's']) {
      if (!tag) continue;
      const wrapper = document.createElement(tag);
      wrapper.append(content);
      content = wrapper;
    }
    span.replaceWith(content);
  }
  for (const anchor of template.content.querySelectorAll('a')) {
    const href = anchor.getAttribute('href') || '';
    const safeHref = normalizeEditorLink(href);
    if (!safeHref) {
      anchor.replaceWith(...Array.from(anchor.childNodes));
      continue;
    }
    const safeAnchor = document.createElement('a');
    safeAnchor.href = safeHref;
    safeAnchor.replaceChildren(...Array.from(anchor.childNodes));
    anchor.replaceWith(safeAnchor);
  }
  return template.innerHTML;
}
