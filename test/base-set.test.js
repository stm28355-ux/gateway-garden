import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ELEMENTS, ROLES } from '../src/core/schema.js';

const cards = JSON.parse(readFileSync(new URL('../expansions/base/cards.json', import.meta.url), 'utf8'));

test('基本セットは5色×6役目が1種類ずつ（E1）', () => {
  assert.equal(cards.length, 30);
  for (const el of ELEMENTS) {
    for (const role of ROLES) {
      assert.equal(cards.filter((c) => c.element === el && c.role === role).length, 1, `${el}×${role}`);
    }
  }
});

test('基本セットの拾い方の曲げは足す・入れ替えるだけ（D12）', () => {
  const kinds = new Set(cards.flatMap((c) => c.stages.flatMap((s) => s.effects)).filter((e) => e.do === 'bend').map((e) => e.kind));
  assert.deepEqual([...kinds].sort(), ['add', 'swap']);
});
