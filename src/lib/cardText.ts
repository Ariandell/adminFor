export type ParsedCardText = {
  word: string;
  bracketText: string;
};

export type CardType = 'standard' | 'irregular_verb';

type CardTextDraft = {
  cardType: CardType;
  originalWord?: string;
  translation?: string;
  transcription?: string;
  example?: string;
  infinitive?: string;
  pastSimple?: string;
  pastParticiple?: string;
};

/** Supports the compact authoring format: `word (translation or transcription)`. */
export function parseCardText(value: string): ParsedCardText {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
  if (!match) return { word: trimmed, bracketText: '' };
  return { word: match[1].trim(), bracketText: match[2].trim() };
}

export function normalizeCardWord(value: string): string {
  return parseCardText(value).word.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

/** Keeps the author-entered pronunciation in parentheses while normalizing whitespace. */
export function cardOriginal(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function cardTranslation(value: string, explicitTranslation: string): string {
  return explicitTranslation.trim() || parseCardText(value).bracketText;
}

/** Produces the text fields shared by both card editors. */
export function buildCardTextFields(draft: CardTextDraft) {
  const source = draft.cardType === 'irregular_verb' ? draft.infinitive || '' : draft.originalWord || '';
  return {
    card_type: draft.cardType,
    original_word: cardOriginal(source),
    translation: cardTranslation(source, draft.translation || ''),
    transcription: (draft.transcription || '').trim() || parseCardText(source).bracketText || null,
    example: (draft.example || '').trim() || null,
    infinitive: draft.cardType === 'irregular_verb' ? cardOriginal(draft.infinitive || '') : null,
    past_simple: draft.cardType === 'irregular_verb' ? cardOriginal(draft.pastSimple || '') : null,
    past_participle: draft.cardType === 'irregular_verb' ? cardOriginal(draft.pastParticiple || '') : null,
  };
}
