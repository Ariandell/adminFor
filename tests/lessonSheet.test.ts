import assert from 'node:assert/strict';
import test from 'node:test';
import type { OutputData } from '@editorjs/editorjs';
import { contentWithLessonSheet, lessonSheetBlocks } from '../src/lib/lessonSheet.ts';

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
  assert.deepEqual(blocks.map(block => block.id), ['intro', 'quiz']);

  const saved = contentWithLessonSheet(content, blocks);
  assert.deepEqual(saved.blocks.map(block => block.id), ['intro', 'quiz']);
  assert.deepEqual((saved as OutputData & { introduction: unknown }).introduction, { story: 'Story' });
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
