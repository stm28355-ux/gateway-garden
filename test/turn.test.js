import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnServers, TURN_URL } from '../src/net/turn.js';

const dataUrl = (v) => `data:application/json,${encodeURIComponent(JSON.stringify(v))}`;

test('TURN の鍵がなければ null（今までどおり直接だけでつなぐ）', async () => {
  assert.equal(await turnServers(''), null);
  assert.equal(typeof TURN_URL, 'string');
});

test('TURN の並びから turn: と turns: だけを渡す（STUN は Trystero が持っている）', async () => {
  const list = [
    { urls: 'stun:stun.example.org:80' },
    { urls: 'turn:turn.example.org:80', username: 'u', credential: 'c' },
    { urls: ['turns:turn.example.org:443?transport=tcp', 'stun:x:1'], username: 'u', credential: 'c' },
  ];
  assert.deepEqual(await turnServers(dataUrl(list)), [
    { urls: ['turn:turn.example.org:80'], username: 'u', credential: 'c' },
    { urls: ['turns:turn.example.org:443?transport=tcp'], username: 'u', credential: 'c' },
  ]);
  assert.deepEqual(await turnServers(dataUrl({ iceServers: [list[1]] })), [{ urls: ['turn:turn.example.org:80'], username: 'u', credential: 'c' }]);
});

test('取れないときは null（つなぐのは止めない）', async () => {
  assert.equal(await turnServers(dataUrl([{ urls: 'stun:only' }])), null);
  assert.equal(await turnServers('data:application/json,not-json'), null);
});
