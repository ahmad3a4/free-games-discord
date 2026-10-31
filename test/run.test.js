import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../src/run.js';
import { parseStores } from '../src/stores.js';
import { saveState, loadState } from '../src/state.js';
import { fakeFetch, NOW } from './fixtures.js';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789/token';
let statePath;

beforeEach(() => {
  statePath = join(mkdtempSync(join(tmpdir(), 'fgd-')), 'nested', 'state.json');
});

const options = (extra) => ({
  webhooks: [WEBHOOK],
  statePath,
  stores: parseStores('pc'),
  now: NOW,
  sleep: async () => {},
  ...extra,
});

test('first run posts current giveaways, second run posts nothing new', async () => {
  const first = fakeFetch();
  const result = await run(options({ fetchImpl: first.fetchImpl, mention: 'everyone' }));

  // Sorry We're Closed (Epic), Asleep (Steam), A New Beginning (GOG). Not: mobile, ended, DLC, upcoming, duplicate.
  assert.deepEqual(result.posted.map((g) => g.title).sort(), ["A New Beginning: Final Cut", 'Asleep: Act 1', "Sorry We're Closed"]);
  assert.equal(first.posts.length, 3);
  assert.equal(first.posts[0].body.content, '@everyone', 'first post pings');
  assert.equal(first.posts[1].body.content, undefined, 'later posts do not');
  assert.equal(Object.keys(loadState(statePath).posted).length, 3);

  const second = fakeFetch();
  const again = await run(options({ fetchImpl: second.fetchImpl }));
  assert.equal(again.posted.length, 0);
  assert.equal(second.posts.length, 0);
});

test('first-run skip remembers games without posting', async () => {
  const { fetchImpl, posts } = fakeFetch();
  const result = await run(options({ fetchImpl, firstRun: 'skip' }));
  assert.equal(posts.length, 0);
  assert.equal(result.skipped.length, 3);
  assert.equal(Object.keys(loadState(statePath).posted).length, 3);
});

test('max-posts leaves the rest for the next run', async () => {
  const first = fakeFetch();
  const result = await run(options({ fetchImpl: first.fetchImpl, maxPosts: 2 }));
  assert.equal(result.posted.length, 2);
  assert.equal(result.waiting, 1);

  const second = fakeFetch();
  const next = await run(options({ fetchImpl: second.fetchImpl, maxPosts: 2 }));
  assert.equal(next.posted.length, 1);
});

test('posts to every webhook', async () => {
  const { fetchImpl, posts } = fakeFetch();
  await run(options({ fetchImpl, webhooks: [WEBHOOK, 'https://discord.com/api/webhooks/2/other'], maxPosts: 1 }));
  assert.equal(posts.length, 2);
});

test('a failure partway keeps what was already posted', async () => {
  const { fetchImpl } = fakeFetch({ discord: (n) => (n === 2 ? { status: 500, body: 'oops' } : { status: 204 }) });
  await assert.rejects(run(options({ fetchImpl })), /HTTP 500/);
  assert.equal(Object.keys(loadState(statePath).posted).length, 1);
});

test('one source down still works; dry run writes nothing', async () => {
  const { fetchImpl, posts } = fakeFetch({ gamerpowerDown: true });
  const result = await run(options({ fetchImpl, dryRun: true }));
  assert.deepEqual(result.games.map((g) => g.title), ["Sorry We're Closed"]);
  assert.match(result.warnings[0], /GamerPower is unavailable/);
  assert.equal(posts.length, 0);
  assert.ok(!existsSync(statePath));
});

test('old state entries are pruned, broken state files are reported', () => {
  saveState(statePath, { posted: { old: '2026-01-01T00:00:00Z', recent: '2026-10-30T00:00:00Z' } }, NOW);
  assert.deepEqual(Object.keys(loadState(statePath).posted), ['recent']);
  assert.ok(!existsSync(`${statePath}.tmp`));

  writeFileSync(statePath, '{broken');
  assert.throws(() => loadState(statePath), /isn't valid JSON/);
  assert.match(readFileSync(statePath, 'utf8'), /broken/, 'never overwrites a file it could not read');
});
