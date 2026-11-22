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
