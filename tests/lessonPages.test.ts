import assert from 'node:assert/strict';
import test from 'node:test';
import type { OutputData } from '@editorjs/editorjs';
import { contentWithLessonPages, lessonPagesFromContent } from '../src/lib/lessonPages.ts';

test('legacy delimiters become editable pages without losing blocks', () => {
  let counter = 0;
  const content = { blocks: [
    { id: 'intro', type: 'paragraph', data: { text: 'Hello' } },
    { type: 'delimiter', data: {} },
    { id: 'quiz', type: 'quiz', data: { questions: [] } },
  ] } as OutputData;

  const pages = lessonPagesFromContent(content, () => `page-${++counter}`);

  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map(page => page.blocks.map(block => block.id)), [['intro'], ['quiz']]);
});

test('saved pages have explicit boundaries, including a single-page lesson', () => {
  const single = contentWithLessonPages(undefined, [
    { id: 'one', blocks: [{ id: 'a', type: 'paragraph', data: { text: 'Hi' } }] },
  ]);
  assert.deepEqual(single.blocks.map(block => block.type), ['pageBreak', 'paragraph']);

  const pages = lessonPagesFromContent(single, () => 'fresh');
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks[0].id, 'a');
});
