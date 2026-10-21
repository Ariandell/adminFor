import test from 'node:test';
import assert from 'node:assert/strict';
import { tagWordLabel, wordsFromTagLinks } from '../src/lib/tagWords.ts';

test('tag list keeps every distinct saved card and ignores missing joins or repeated ids', () => {
  const first = { id: 'one', original_word: 'Book', translation: 'книга' };
  const second = { id: 'two', original_word: 'book', translation: 'бронювати', lessons: { title: 'Travel' } };
  const cards = wordsFromTagLinks([
    { cards: null }, { cards: first }, { cards: [second] }, { cards: first },
  ]);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map(card => card.translation), ['книга', 'бронювати']);
  assert.equal(cards[1].lessons?.title, 'Travel');
});

test('irregular forms are visible even without original_word and sort alongside standard words', () => {
  const cards = wordsFromTagLinks([
    { cards: { id: 'go', card_type: 'irregular_verb', infinitive: 'go', past_simple: 'went', past_participle: 'gone' } },
    { cards: { id: 'apple', original_word: 'apple' } },
    { cards: { id: 'blank', original_word: null } },
  ]);
  assert.equal(cards[0].id, 'apple');
  assert.equal(tagWordLabel(cards.find(card => card.id === 'go')!), 'go – went – gone');
  assert.equal(tagWordLabel(cards.find(card => card.id === 'blank')!), 'Картка без слова');
});
