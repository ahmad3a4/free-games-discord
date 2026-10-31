import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, normalizeGamerPower, normalizeEpic, dedupe } from '../src/sources.js';
import { detectStore, parseStores } from '../src/stores.js';
import { gamerpower, epic, NOW } from './fixtures.js';

test('cleans store tags out of titles', () => {
  assert.equal(cleanTitle('Hexologic (Steam) Giveaway'), 'Hexologic');
  assert.equal(cleanTitle('Dwarven Realms (Steam) Key'), 'Dwarven Realms');
  assert.equal(cleanTitle('Sleep Demon (Itchio) Giveaway'), 'Sleep Demon');
  assert.equal(cleanTitle('GigaBash (Stove) Giveaway'), 'GigaBash');
  assert.equal(cleanTitle('Some Game (2004) Giveaway'), 'Some Game (2004)', 'keeps parentheses that are part of the name');
});

test('detects the store from the title tag, then platforms', () => {
  assert.equal(detectStore('X (IndieGala) Giveaway', ['PC']), 'indiegala');
  assert.equal(detectStore('X Giveaway', ['PC', 'Steam']), 'steam');
  assert.equal(detectStore('X (Mobile) Giveaway', ['Android', 'iOS']), 'mobile');
  assert.equal(detectStore('X Giveaway', ['PC', 'DRM-Free']), 'other');
});

test('parses the stores option', () => {
  assert.ok(!parseStores('pc').has('mobile'));
  assert.ok(parseStores('all').has('mobile'));
  assert.deepEqual([...parseStores('Steam, epic')], ['steam', 'epic']);
  assert.throws(() => parseStores('steem'), /unknown store "steem"/);
  assert.throws(() => parseStores(''), /no stores/);
});

test('normalizes GamerPower giveaways and drops non-games', () => {
  const games = normalizeGamerPower(gamerpower);
  assert.equal(games.length, 5);
  const asleep = games[0];
  assert.equal(asleep.id, 'gamerpower:3836');
  assert.equal(asleep.title, 'Asleep: Act 1');
  assert.equal(asleep.store, 'steam');
  assert.equal(asleep.endsAt, '2026-11-02');
  assert.equal(games.find((g) => g.store === 'gog').endsAt, null, '"N/A" end date becomes null');
});

test('normalizes Epic: current and upcoming free games only', () => {
  const games = normalizeEpic(epic, NOW);
  assert.deepEqual(games.map((g) => [g.title, g.upcoming]), [["Sorry We're Closed", false], ['Flotsam', true]]);
  const sorry = games[0];
  assert.equal(sorry.url, 'https://store.epicgames.com/en-US/p/sorry-were-closed-724c86');
  assert.equal(sorry.image, 'https://img/wide.jpg');
  assert.equal(sorry.worth, '$24.99');
  assert.equal(sorry.endsAt, '2026-11-05T16:00:00.000Z');
});

test('drops an Epic offer once it has ended', () => {
  const later = new Date('2026-11-06T00:00:00Z');
  assert.ok(!normalizeEpic(epic, later).some((g) => g.title === "Sorry We're Closed"));
});

test("prefers Epic's own listing over GamerPower's copy", () => {
  const games = dedupe([...normalizeEpic(epic, NOW), ...normalizeGamerPower(gamerpower)]);
  const sorry = games.filter((g) => g.title === "Sorry We're Closed");
  assert.equal(sorry.length, 1);
  assert.equal(sorry[0].source, 'Epic Games Store');
});
