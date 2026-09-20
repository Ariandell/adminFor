import type { OutputBlockData, OutputData } from '@editorjs/editorjs';

export type LessonDraftPage = {
  id: string;
  blocks: OutputBlockData[];
};

const isBoundary = (block: OutputBlockData) =>
  block.type === 'pageBreak' || block.type === 'delimiter';

export function lessonPagesFromContent(
  content: OutputData | undefined,
  makeId: () => string,
): LessonDraftPage[] {
  const pages: LessonDraftPage[] = [{ id: makeId(), blocks: [] }];
  for (const block of content?.blocks ?? []) {
    if (isBoundary(block)) {
      if (pages.at(-1)!.blocks.length > 0) {
        pages.push({ id: makeId(), blocks: [] });
      }
    } else {
      pages.at(-1)!.blocks.push(block);
    }
  }
  while (pages.length > 1 && pages.at(-1)!.blocks.length === 0) pages.pop();
  return pages;
}

export function contentWithLessonPages(
  content: OutputData | undefined,
  pages: LessonDraftPage[],
): OutputData {
  return {
    ...content,
    time: Date.now(),
    version: content?.version ?? '2.31.6',
    // A marker on page one distinguishes authored pages from legacy lessons.
    // The student app preserves every following boundary exactly.
    blocks: pages.flatMap((page) => [
      { id: `page-start-${page.id}`, type: 'pageBreak', data: {} },
      ...page.blocks,
    ]),
  };
}
