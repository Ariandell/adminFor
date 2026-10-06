import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorHistory, editorContentChanged, editorHistoryShortcut } from '../src/lib/editorHistory.ts';

const shortcut = (values = {}) => ({
  key: 'z', code: 'KeyZ', ctrlKey: true, metaKey: false,
  shiftKey: false, altKey: false, isComposing: false, ...values,
});
const documentWith = (text: string) => ({ blocks: [{ id: 'paragraph', type: 'paragraph', data: { text } }] });

test('restored block ids do not create phantom edits, while content, order and tunes do', () => {
  const original = documentWith('text').blocks;
  assert.equal(editorContentChanged(original, [{ ...original[0], id: 'restored-id' }]), false);
  assert.equal(editorContentChanged(original, documentWith('').blocks), true);
  assert.equal(editorContentChanged(original, [{ ...original[0], tunes: { alignment: 'right' } }]), true);
  const blocks = [...original, { id: 'divider', type: 'delimiter', data: {} }];
  assert.equal(editorContentChanged(blocks, [...blocks].reverse()), true);
});

test('undo and redo work on Ukrainian and English keyboards and with Command', () => {
  assert.equal(editorHistoryShortcut(shortcut()), 'undo');
  assert.equal(editorHistoryShortcut(shortcut({ key: 'я' })), 'undo');
  assert.equal(editorHistoryShortcut(shortcut({ key: 'Я', shiftKey: true })), 'redo');
  assert.equal(editorHistoryShortcut(shortcut({ key: 'н', code: 'KeyY' })), 'redo');
  assert.equal(editorHistoryShortcut(shortcut({ ctrlKey: false, metaKey: true })), 'undo');
  assert.equal(editorHistoryShortcut(shortcut({ code: '', key: 'Z' })), 'undo');
  for (const values of [{ ctrlKey: false }, { altKey: true }, { isComposing: true }, { key: 'a', code: 'KeyA' }]) {
    assert.equal(editorHistoryShortcut(shortcut(values)), null);
  }
});

function fixture() {
  let current = documentWith('original');
  const stack = [current];
  let position = 0;
  const errors: unknown[] = [];
  const backend = {
    registerChange() {},
    editorDidUpdate(blocks: typeof current.blocks) { return JSON.stringify(blocks) !== JSON.stringify(stack[position].blocks); },
    save(blocks: typeof current.blocks) {
      stack.splice(position + 1);
      stack.push({ blocks });
      ++position;
    },
    async undo() { if (position > 0) current = stack[--position]; },
    async redo() { if (position < stack.length - 1) current = stack[++position]; },
  };
  return {
    backend, errors, stack,
    read: async () => current,
    edit: (text: string) => { current = documentWith(text); },
    text: () => current.blocks[0].data.text,
  };
}

test('immediate undo flushes a pending edit, and redo restores it', async () => {
  const f = fixture();
  const history = createEditorHistory(f.read, f.backend, error => f.errors.push(error));
  f.edit('just typed, before debounce');
  await history.run('undo');
  assert.equal(f.text(), 'original');
  await history.run('redo');
  assert.equal(f.text(), 'just typed, before debounce');
  assert.deepEqual(f.errors, []);
});

test('a stale asynchronous snapshot cannot overwrite undo or consume redo', async () => {
  const f = fixture();
  let finishOldSave!: (data: ReturnType<typeof documentWith>) => void;
  let first = true;
  const history = createEditorHistory(() => {
    if (first) {
      first = false;
      return new Promise(resolve => { finishOldSave = resolve; });
    }
    return f.read();
  }, f.backend, error => f.errors.push(error));
  f.edit('edited');
  f.backend.registerChange();
  await history.run('undo');
  finishOldSave(documentWith('edited'));
  await Promise.resolve();
  f.backend.registerChange(); // DOM changes from restoring the block are not a new edit.
  await Promise.resolve();
  await history.run('redo');
  assert.equal(f.text(), 'edited');
  assert.equal(f.stack.length, 2);
});

test('rapid undo/redo commands execute in order; a new edit replaces the redo branch', async () => {
  const f = fixture();
  const history = createEditorHistory(f.read, f.backend, error => f.errors.push(error));
  f.edit('first');
  f.backend.registerChange();
  await Promise.resolve();
  f.edit('second');
  await Promise.all([history.run('undo'), history.run('undo'), history.run('redo')]);
  assert.equal(f.text(), 'first');
  f.edit('replacement');
  await history.run('redo');
  assert.equal(f.text(), 'replacement');
  await history.run('undo');
  assert.equal(f.text(), 'first');
});

test('disposal cancels pending saves and actions from the previous lesson', async () => {
  const f = fixture();
  let finishSave!: (data: ReturnType<typeof documentWith>) => void;
  const history = createEditorHistory(() => new Promise(resolve => { finishSave = resolve; }), f.backend, error => f.errors.push(error));
  f.backend.registerChange();
  history.dispose();
  finishSave(documentWith('late result'));
  await Promise.resolve();
  await history.run('undo');
  assert.equal(f.stack.length, 1);
  assert.equal(f.text(), 'original');
});

test('a failed snapshot leaves content intact and does not block the next undo', async () => {
  const f = fixture();
  let fail = true;
  const history = createEditorHistory(() => {
    if (fail) { fail = false; return Promise.reject(new Error('save failed')); }
    return f.read();
  }, f.backend, error => f.errors.push(error));
  f.edit('edited');
  await history.run('undo');
  assert.equal(f.text(), 'edited');
  assert.equal(f.errors.length, 1);
  await history.run('undo');
  assert.equal(f.text(), 'original');
});
