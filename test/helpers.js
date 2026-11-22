import { readFileSync } from 'node:fs';
import { buildCatalog } from '../src/core/game.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

export const baseCatalog = () => buildCatalog([{
  meta: read('../expansions/base/expansion.json'),
  cards: read('../expansions/base/cards.json'),
}]);

export const byName = (cat, name) => Object.values(cat.cards).find((c) => c.name === name).id;
