// ============================================================
//  CATÁLOGO DE STICKERS
//  Cada sticker dice quién sale en él. Para añadir uno nuevo:
//  mete el .webp en /stickers y añade una línea aquí.
// ============================================================
const ALL = ['marisa', 'anab', 'anac', 'blanca', 'nuria'];

export const STICKERS = [
  { id: 's01', people: ['blanca'] },
  { id: 's02', people: ['blanca'] },
  { id: 's03', people: ['marisa', 'anab'] },
  { id: 's04', people: ['anac'] },
  { id: 's05', people: ['nuria'] },
  { id: 's06', people: ['blanca', 'marisa', 'nuria'] },
  { id: 's07', people: ['anac'] },
  { id: 's08', people: ['anab'] },
  { id: 's09', people: ['marisa', 'anac'] },
  { id: 's10', people: ALL },
  { id: 's11', people: ['blanca', 'nuria'] },
  { id: 's12', people: ['nuria'] },
  { id: 's13', people: ['marisa'] },
  { id: 's14', people: ['anac', 'blanca', 'nuria'] },
  { id: 's15', people: ['anab'] },
  { id: 's16', people: ['marisa'] },
  { id: 's17', people: ['anac', 'blanca'] },
  { id: 's18', people: ['blanca'] },
  { id: 's19', people: ['anac'] },
  { id: 's20', people: ['marisa', 'anab', 'anac', 'nuria'] },
].map((s) => ({ ...s, src: `stickers/${s.id}.webp` }));

export const faceOf = (personId) => `stickers/faces/${personId}.webp`;

// El sticker "oficial" de cada una (sale en la pantalla del PIN)
export const MAIN_STICKER = { marisa: 's13', anab: 's08', anac: 's04', blanca: 's18', nuria: 's05' };

export const getSticker = (id) => STICKERS.find((s) => s.id === id);

// Stickers donde sale una persona. `solo: true` → solo ella.
export function stickersOf(personId, { solo = false } = {}) {
  return STICKERS.filter((s) =>
    s.people.includes(personId) && (!solo || s.people.length === 1));
}

export const groupStickers = () => STICKERS.filter((s) => s.people.length > 1);

export function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
