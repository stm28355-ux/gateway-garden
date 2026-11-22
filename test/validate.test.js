import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExpansion } from '../src/core/schema.js';

const meta = { id: 'demo', name: 'お試し', version: '0.1.0' };
const card = (over = {}) => ({
  id: 'demo-001', name: '住人', element: 'red', role: 'generate', growth: 'flat', cost: { red: 2 },
  stages: [
    { effects: [{ when: 'activate', do: 'gain', color: 'self', amount: 1 }] },
    { effects: [{ when: 'activate', do: 'gain', color: 'self', amount: 2 }] },
    { points: 1, effects: [{ when: 'activate', do: 'gain', color: 'red', amount: 1,
      per: { area: 'adjacent', filter: { element: 'red' } } }] },
  ],
  ...over,
});
const guide = (stage1Effects, stage2Effects) => card({
  id: 'demo-010', role: 'guide',
  stages: [{ effects: stage1Effects }, { effects: stage2Effects }, { points: 1, effects: [] }],
});

test('正しい札は誤りなし', () => {
  assert.deepEqual(validateExpansion('demo', meta, [card()]), []);
});

test('id の頭・重なり・属性・段階の数を見つける', () => {
  const errors = validateExpansion('demo', meta, [
    card({ id: 'other-001' }),
    card({ id: 'demo-002', element: 'purple' }),
    card({ id: 'demo-002', stages: [] }),
  ]);
  assert.equal(errors.length, 4);
});

test('値段の合計は1〜4、段階3は1点以上', () => {
  const errors = validateExpansion('demo', meta, [
    card({ cost: { red: 3, blue: 2 } }),
    card({ id: 'demo-002', stages: [{ effects: [] }, { effects: [] }, { effects: [] }] }),
  ]);
  assert.equal(errors.length, 2);
});

test('拾い方を曲げるのは導きの札の段階2から（D12）', () => {
  const bend = { when: 'pick', do: 'bend', kind: 'swap' };
  assert.deepEqual(validateExpansion('demo', meta, [guide([], [bend])]), []);
  assert.equal(validateExpansion('demo', meta, [guide([bend], [])]).length, 1);
  const notGuide = card({ stages: [{ effects: [] }, { effects: [bend] }, { points: 1, effects: [] }] });
  assert.equal(validateExpansion('demo', meta, [notGuide]).length, 1);
});

test('値段を下げる・上限は「常に」だけ、段階1の「その段階になったとき」は誤り', () => {
  const bad = card({ stages: [
    { effects: [{ when: 'grow', do: 'gain', color: 'red', amount: 1 }] },
    { effects: [{ when: 'activate', do: 'discount', amount: 1, area: 'adjacent' }] },
    { points: 1, effects: [{ when: 'always', do: 'limit', amount: 2 }] },
  ] });
  assert.equal(validateExpansion('demo', meta, [bad]).length, 2);
});

test('好きなときに使う効果（再配置）が書ける', () => {
  const mover = card({ stages: [
    { effects: [{ when: 'use', do: 'move', area: 'garden' }] },
    { effects: [] }, { points: 1, effects: [] },
  ] });
  assert.deepEqual(validateExpansion('demo', meta, [mover]), []);
});

test('知らない部品・項目・範囲を見つける', () => {
  const bad = card({ stages: [
    { effects: [{ when: 'activate', do: 'fly', amount: 1 }] },
    { effects: [{ when: 'activate', do: 'gain', color: 'red', amount: 1, power: 9 }] },
    { points: 1, effects: [{ when: 'grow', do: 'stageUp', amount: 1, area: 'diagonal' }] },
  ] });
  assert.equal(validateExpansion('demo', meta, [bad]).length, 3);
});
