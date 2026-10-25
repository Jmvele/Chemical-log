import test from 'node:test';
import assert from 'node:assert/strict';
import { USERS, FILMS, CHEMICALS, DEFAULT_FEET, parseFeet, validateEntry, prepareEntry, selectionText, fieldError } from '../js/form-rules.js';
const valid = { user: 'Jesus', film: FILMS[0], filmOther: '', chemical: CHEMICALS[0], chemicalOther: '', feet: '25.5' };

test('the agreed lists and initial Feet are preserved', () => {
  assert.deepEqual(USERS, ['Madi', 'Jesus']);
  assert.equal(FILMS.length, 6);
  assert.equal(CHEMICALS.length, 6);
  assert.equal(DEFAULT_FEET, '00.0');
});
test('decimal Feet supports phone keyboards', () => {
  for (const [text, value] of [['25.5', 25.5], ['0.5', .5], ['.5', .5], ['25,5', 25.5], [' 100 ', 100], ['00.1', .1]]) {
    assert.equal(parseFeet(text), value, text);
  }
});
test('zero, empty, negative, malformed and non-finite Feet cannot save', () => {
  for (const value of ['00.0', '0', '0.00', '', ' ', '-1', '+1', '1e3', 'Infinity', 'NaN', '1.2.3', '1,2,3', 'abc', '1'.repeat(400)]) {
    assert.equal(validateEntry({ ...valid, feet: value }), 'Feet', value);
  }
});
test('validation reports the first invalid field in form order', () => {
  assert.equal(validateEntry({ ...valid, user: '', chemical: '', feet: '00.0' }), 'User');
  assert.equal(validateEntry({ ...valid, film: '', chemical: '' }), 'Film');
  assert.equal(validateEntry({ ...valid, chemical: '', feet: '00.0' }), 'Chemical');
  assert.equal(validateEntry(valid), null);
});
test('both Other selections require actual text and trim it before saving', () => {
  for (const field of ['film', 'chemical']) {
    for (const custom of ['', ' ', '\t\n']) assert.equal(validateEntry({ ...valid, [field]: 'Other:', [`${field}Other`]: custom }), field === 'film' ? 'Film' : 'Chemical');
    const entry = prepareEntry({ ...valid, [field]: 'Other:', [`${field}Other`]: '  Custom stock  ' });
    assert.equal(entry[`${field}Other`], 'Custom stock');
    assert.equal(selectionText(entry, field), 'Custom stock');
  }
});
test('stale custom values are not saved for standard selections', () => {
  const entry = prepareEntry({ ...valid, filmOther: 'old', chemicalOther: 'old' });
  assert.equal(entry.filmOther, '');
  assert.equal(entry.chemicalOther, '');
  assert.equal(entry.feet, 25.5);
});
test('custom input has a bounded size; error copy matches Figma', () => {
  assert.equal(validateEntry({ ...valid, film: 'Other:', filmOther: 'a'.repeat(121) }), 'Film');
  assert.equal(fieldError('Chemical'), 'Error: Entry “Chemical” data.');
});
