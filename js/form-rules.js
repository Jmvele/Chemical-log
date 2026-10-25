// Edit dropdown options here. Keep firestore.rules in sync with these lists.
export const USERS = ['Madi', 'Jesus'];
export const FILMS = [
  'BW Negative 8837',
  'BW Negative Double-X 7222',
  'BW Reversal Tri-X 7266',
  'Colour Print 3383',
  'Colour Ektachrome 7294',
  'Other:'
];
export const CHEMICALS = ['D-76', 'D-19', 'D-96', 'C-41', 'E-6', 'Other:'];
export const OTHER = 'Other:';
export const DEFAULT_FEET = '00.0';
export const MAX_CUSTOM_LENGTH = 120;

// Accept ordinary decimal notation, including .5 and 25,5 on mobile keyboards.
// No zero, signs, exponent notation, or non-finite numbers.
export function parseFeet(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 && number < 1e15 ? number : null;
}

export function validateEntry(values) {
  if (!USERS.includes(values.user)) return 'User';
  if (!FILMS.includes(values.film) || !validOther(values.film, values.filmOther)) return 'Film';
  if (!CHEMICALS.includes(values.chemical) || !validOther(values.chemical, values.chemicalOther)) return 'Chemical';
  if (parseFeet(values.feet) === null) return 'Feet';
  return null;
}

function validOther(choice, value) {
  if (choice !== OTHER) return true;
  const text = String(value ?? '').trim();
  return text.length > 0 && text.length <= MAX_CUSTOM_LENGTH;
}

export function prepareEntry(values) {
  const invalidField = validateEntry(values);
  if (invalidField) throw new Error(`Invalid ${invalidField}`);
  return {
    user: values.user,
    film: values.film,
    filmOther: values.film === OTHER ? values.filmOther.trim() : '',
    chemical: values.chemical,
    chemicalOther: values.chemical === OTHER ? values.chemicalOther.trim() : '',
    feet: parseFeet(values.feet)
  };
}

export function selectionText(entry, field) {
  return entry[field] === OTHER ? entry[`${field}Other`] : entry[field];
}

export function fieldError(field) { return `Error: Entry “${field}” data.`; }
