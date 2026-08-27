import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCardTextFields, cardOriginal, cardTranslation, normalizeCardWord, parseCardText } from '../src/lib/cardText.ts';

test('parses a compact word with pronunciation', () => {
  assert.deepEqual(parseCardText('car (кар)'), { word: 'car', bracketText: 'кар' });
  assert.equal(cardOriginal(' car   (кар) '), 'car (кар)');
  assert.equal(normalizeCardWord('Car (кар)'), 'car');
});

test('supports phrases and sentences', () => {
  assert.deepEqual(parseCardText('play basketball (плей баскетбол)'), {
    word: 'play basketball',
    bracketText: 'плей баскетбол',
  });
  assert.equal(
    cardOriginal('  I live near the station   (ай лів нір зе стейшн) '),
    'I live near the station (ай лів нір зе стейшн)',
  );
});

test('uses an explicit translation when it is provided', () => {
  assert.equal(cardTranslation('car (кар)', 'автомобіль'), 'автомобіль');
  assert.equal(cardTranslation('car (кар)', ''), 'кар');
});

test('preserves pronunciation for a standard card payload', () => {
  assert.deepEqual(buildCardTextFields({
    cardType: 'standard', originalWord: 'car (кар)', translation: 'автомобіль',
  }), {
    card_type: 'standard', original_word: 'car (кар)', translation: 'автомобіль',
    transcription: 'кар', example: null, infinitive: null, past_simple: null, past_participle: null,
  });
});

test('preserves pronunciation in all irregular verb forms', () => {
  assert.deepEqual(buildCardTextFields({
    cardType: 'irregular_verb', infinitive: 'go (ґоу)', pastSimple: 'went (вент)',
    pastParticiple: 'gone (ґон)', translation: 'йти',
  }), {
    card_type: 'irregular_verb', original_word: 'go (ґоу)', translation: 'йти',
    transcription: 'ґоу', example: null, infinitive: 'go (ґоу)',
    past_simple: 'went (вент)', past_participle: 'gone (ґон)',
  });
});
