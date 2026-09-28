import type { API } from '@editorjs/editorjs';

type InlineTag = 'u' | 's' | 'mark';

export function toggleInlineTag(range: Range, tag: InlineTag): void {
  const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  const end = range.endContainer instanceof Element ? range.endContainer : range.endContainer.parentElement;
  const active = start?.closest(tag);
  if (active && active.contains(end)) {
    active.replaceWith(...Array.from(active.childNodes));
    return;
  }
  const wrapper = document.createElement(tag);
  wrapper.append(range.extractContents());
  range.insertNode(wrapper);
  const selection = window.getSelection();
  const selected = document.createRange();
  selected.selectNodeContents(wrapper);
  selection?.removeAllRanges();
  selection?.addRange(selected);
}

abstract class InlineFormatTool {
  protected api: API;
  protected abstract tag: InlineTag;
  protected abstract label: string;

  static get isInline() { return true; }
  constructor({ api }: { api: API }) { this.api = api; }

  render(): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ce-inline-tool';
    button.textContent = this.label;
    button.title = this.label;
    return button;
  }

  surround(range: Range | null): void {
    if (range && !range.collapsed) toggleInlineTag(range, this.tag);
  }

  checkState(): boolean { return Boolean(this.api.selection.findParentTag(this.tag.toUpperCase())); }
}

export class UnderlineTool extends InlineFormatTool {
  protected tag: InlineTag = 'u';
  protected label = 'U̲';
  static get sanitize() { return { u: true }; }
}

export class StrikeTool extends InlineFormatTool {
  protected tag: InlineTag = 's';
  protected label = 'S̶';
  static get sanitize() { return { s: true }; }
}

export class MarkerTool extends InlineFormatTool {
  protected tag: InlineTag = 'mark';
  protected label = 'М';
  static get sanitize() { return { mark: true }; }
}
