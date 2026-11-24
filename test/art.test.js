import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { baseArt } from '../src/art/base.js';
import { grid } from '../src/art/pixel.js';

const cards = JSON.parse(readFileSync(new URL('../expansions/base/cards.json', import.meta.url), 'utf8'));

test('基本セットの住人は全員に絵がある（32×32の SVG）', () => {
  for (const c of cards) {
    const svg = baseArt(c.name, 48);
    assert.ok(svg, `${c.name} の絵がない`);
    assert.match(svg, /viewBox="0 0 32 32"/);
    assert.ok((svg.match(/<rect/g) ?? []).length > 30, `${c.name} の絵が小さすぎる`);
  }
});

test('縁取りは、塗った所に接する空きマスだけに付く', () => {
  const g = grid(8).rect(3, 3, 4, 4, '#fff').outline('#000');
  assert.equal(g.px[3][3], '#fff');
  assert.equal(g.px[2][3], '#000');
  assert.equal(g.px[2][2], null, 'ななめは縁取りしない');
});

test('お題カードはどれも絵がある（工程7の判定 Y3）', async () => {
  const { goalArt } = await import('../src/art/goals.js');
  const { GOALS } = await import('../src/core/goals.js');
  for (const id of Object.keys(GOALS)) assert.match(goalArt(id, 32), /^<svg/, `お題「${GOALS[id].name}」の絵がない`);
});

test('拡張「号令の戦場」の住人はどれも絵がある（判定 AB1：本家の駒の絵）', async () => {
  const { cardArt } = await import('../src/art/index.js');
  const ab = JSON.parse(readFileSync(new URL('../expansions/auto-battler-1/cards.json', import.meta.url), 'utf8'));
  for (const c of ab) assert.match(cardArt({ ...c, origin: 'auto-battler-1' }, 32) ?? '', /^<svg/, `「${c.name}」の絵がない`);
  for (const c of cards) assert.match(cardArt({ ...c, origin: 'base' }, 32) ?? '', /^<svg/, `「${c.name}」の絵がない`);
});

test('拡張「魔導具の工房」の住人はどれも絵がある（本家 Aether Atelier の機械と素材の絵）', async () => {
  const { cardArt } = await import('../src/art/index.js');
  const aa = JSON.parse(readFileSync(new URL('../expansions/aether-atelier-1/cards.json', import.meta.url), 'utf8'));
  for (const c of aa) {
    const svg = cardArt({ ...c, origin: 'aether-atelier-1' }, 32) ?? '';
    assert.match(svg, /^<svg/, `「${c.name}」の絵がない`);
    assert.ok((svg.match(/<rect/g) ?? []).length > 10, `「${c.name}」の絵が小さすぎる`);
  }
});
