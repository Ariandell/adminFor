import { cardEnglish } from './courseVocabulary.ts';
import type { VocabularyCard } from './courseVocabulary.ts';

export type TaggedCard = VocabularyCard & {
  image_color_url?: string | null;
  lessons?: { title?: string | null; courses?: { title?: string | null } | null } | null;
};

export type TagWordLink = { cards: TaggedCard | TaggedCard[] | null };

export function tagWordLabel(card: TaggedCard): string {
  return cardEnglish(card) || 'Картка без слова';
}

/** Keep separate saved cards/lesson origins, but never render a joined id twice. */
export function wordsFromTagLinks(links: TagWordLink[]): TaggedCard[] {
  const cards = new Map<string, TaggedCard>();
  for (const link of links) {
    const linked = Array.isArray(link.cards) ? link.cards : [link.cards];
    for (const card of linked) {
      if (card?.id) cards.set(card.id, card);
    }
  }
  return [...cards.values()].sort((a, b) =>
    tagWordLabel(a).localeCompare(tagWordLabel(b), 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
}
