import type { OutputBlockData, OutputData } from '@editorjs/editorjs';

const isPageBoundary = (block: OutputBlockData) =>
  block.type === 'pageBreak' || block.type === 'delimiter';

/** Existing lessons may contain notebook page markers; the new editor is one sheet. */
export function lessonSheetBlocks(content: OutputData | undefined): OutputBlockData[] {
  return (content?.blocks ?? []).filter(block => !isPageBoundary(block));
}

export function contentWithLessonSheet(
  content: OutputData | undefined,
  blocks: OutputBlockData[],
): OutputData {
  return {
    ...content,
    time: Date.now(),
    version: content?.version ?? '2.31.6',
    blocks: blocks.filter(block => !isPageBoundary(block)),
  };
}
