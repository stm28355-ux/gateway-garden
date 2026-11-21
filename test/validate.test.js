import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExpansion } from '../tools/validate-expansions.mjs';

const meta = { id: 'demo', name: 'お試し', version: '0.1.0' };
const card = (over = {}) => ({
  id: 'demo-001', name: '住人', element: 'red', cost: { red: 2 },
  stages: [{ effects: [] }, { effects: [] }, { effects: [] }], ...over,
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
