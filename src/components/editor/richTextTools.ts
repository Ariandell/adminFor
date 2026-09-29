import Header from '@editorjs/header';
import Paragraph from '@editorjs/paragraph';
import Quote from '@editorjs/quote';
import { normalizeEditorLink } from '../../lib/editorLink';

/** Keep the inline marks that the lesson reader can render after a rich paste. */
export const inlineMarks = {
  br: true,
  b: true,
  strong: true,
  i: true,
  em: true,
  u: true,
  s: true,
  strike: true,
  del: true,
  mark: true,
  code: true,
  a: (element: Element) => normalizeEditorLink(element.getAttribute('href') || '') ? { href: true } : false,
};

export class RichParagraph extends Paragraph {
  static get sanitize() { return { text: inlineMarks }; }
}

export class RichHeader extends Header {
  static get sanitize() { return { level: false, text: inlineMarks }; }
}

export class RichQuote extends Quote {
  static get sanitize() { return { text: inlineMarks, caption: inlineMarks, alignment: {} }; }
}
