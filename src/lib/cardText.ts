export type ParsedCardText = {
  word: string;
  bracketText: string;
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

export function cardTranslation(value: string, explicitTranslation: string): string {
  return explicitTranslation.trim() || parseCardText(value).bracketText;
}
