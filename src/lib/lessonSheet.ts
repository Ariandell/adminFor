import type { OutputBlockData, OutputData } from '@editorjs/editorjs';
import { normalizeDelimiterData } from './lessonDelimiter.ts';

/** Preserve visual pauses; old notebook markers become delimiters on author save. */
export function lessonSheetBlocks(content: OutputData | undefined): OutputBlockData[] {
  const result: OutputBlockData[] = [];
  let pending: OutputBlockData | undefined;
  for (const block of content?.blocks ?? []) {
    if (block.type === 'pageBreak') { pending = block; continue; }
    if (pending && result.length && result.at(-1)?.type !== 'delimiter' && block.type !== 'delimiter') {
      result.push({ ...pending, type: 'delimiter', data: normalizeDelimiterData() });
    }
    pending = undefined;
    result.push(block.type === 'delimiter' ? { ...block, data: normalizeDelimiterData(block.data) } : block);
  }
  return result;
}

export function contentWithLessonSheet(
  content: OutputData | undefined,
  blocks: OutputBlockData[],
): OutputData {
  return {
    ...content,
    time: Date.now(),
    version: content?.version ?? '2.31.6',
    blocks: lessonSheetBlocks({ blocks }),
  };
}
