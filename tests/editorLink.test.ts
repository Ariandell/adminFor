import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEditorLink } from '../src/lib/editorLink.ts';

test('normalizes a pasted domain and accepts web and email links', () => {
  assert.equal(normalizeEditorLink('example.com'), 'https://example.com/');
  assert.equal(normalizeEditorLink(' https://example.com/path '), 'https://example.com/path');
  assert.equal(normalizeEditorLink('mailto:teacher@example.com'), 'mailto:teacher@example.com');
});

test('rejects unsafe or malformed links', () => {
  for (const value of ['', 'javascript:alert(1)', 'data:text/html,hello', 'file:///secret', '//example.com', 'bad url', 'mailto:']) {
    assert.equal(normalizeEditorLink(value), null, value);
  }
});
