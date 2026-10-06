import assert from 'node:assert/strict';
import test from 'node:test';
import type { OutputData } from '@editorjs/editorjs';
import { contentWithLessonSheet, lessonSheetBlocks } from '../src/lib/lessonSheet.ts';
import { normalizeDelimiterData } from '../src/lib/lessonDelimiter.ts';

test('old page markers flatten into one sheet without reordering lesson blocks', () => {
  const content = {
    blocks: [
      { id: 'page-one', type: 'pageBreak', data: {} },
      { id: 'intro', type: 'paragraph', data: { text: 'Hello' } },
      { type: 'delimiter', data: {} },
      { id: 'page-two', type: 'pageBreak', data: {} },
      { id: 'quiz', type: 'quiz', data: { questions: [{ text: 'Question' }] } },
    ],
    introduction: { story: 'Story' },
  } as OutputData;

  const blocks = lessonSheetBlocks(content);
  assert.deepEqual(blocks.map(block => block.type), ['paragraph', 'delimiter', 'quiz']);

  const saved = contentWithLessonSheet(content, blocks);
  assert.deepEqual(saved.blocks, blocks);
  assert.deepEqual((saved as OutputData & { introduction: unknown }).introduction, { story: 'Story' });
});

test('interior legacy boundaries become watercolor dividers; leading and trailing markers disappear', () => {
  const blocks = lessonSheetBlocks({ blocks: [
    { id: 'leading', type: 'pageBreak', data: {} },
    { id: 'a', type: 'paragraph', data: { text: 'One' } },
    { id: 'pause', type: 'pageBreak', data: {} },
    { id: 'b', type: 'paragraph', data: { text: 'Two' } },
    { id: 'trailing', type: 'pageBreak', data: {} },
  ] });
  assert.deepEqual(blocks.map(block => block.id), ['a', 'pause', 'b']);
  assert.equal(blocks[1].type, 'delimiter');
  assert.deepEqual(contentWithLessonSheet(undefined, blocks).blocks, blocks);
});

test('plain divider survives saves without labels or appearance options', () => {
  const divider = { id: 'd', type: 'delimiter', data: { style: 'butterfly', tone: 'mint', label: '  Тепер практика  ' } };
  const saved = contentWithLessonSheet(undefined, [divider]);
  assert.deepEqual(saved.blocks[0].data, {});
  assert.deepEqual(contentWithLessonSheet(saved, saved.blocks).blocks, saved.blocks);
  assert.deepEqual(normalizeDelimiterData({ style: 'unknown', tone: 'unknown' }), {});
});

test('new lessons save as one continuous block stream without page markers', () => {
  const saved = contentWithLessonSheet(undefined, [
    { id: 'heading', type: 'header', data: { text: 'Lesson' } },
    { id: 'exercise', type: 'quiz', data: { questions: [] } },
  ]);

  assert.deepEqual(saved.blocks.map(block => block.type), ['header', 'quiz']);
  assert.equal(typeof saved.time, 'number');
  assert.ok(saved.version);
});
