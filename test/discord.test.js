import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, postMessage, isWebhookUrl, mentionFor } from '../src/discord.js';
import { fakeFetch } from './fixtures.js';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789/abc-DEF_123';

const game = {
  id: 'epic:1',
  title: 'Flotsam',
  store: 'epic',
  url: 'https://store.epicgames.com/en-US/p/flotsam',
  image: 'https://img/wide.jpg',
  worth: '$24.99',
  description: 'A  town-building\n\ngame. '.repeat(40),
  endsAt: '2026-11-05T16:00:00.000Z',
  startsAt: '2026-10-29T15:00:00.000Z',
  upcoming: false,
  source: 'Epic Games Store',
};

test('webhook URL check', () => {
  assert.ok(isWebhookUrl(WEBHOOK));
  assert.ok(isWebhookUrl('https://canary.discord.com/api/webhooks/1/x'));
  assert.ok(isWebhookUrl('https://discordapp.com/api/webhooks/1/x/'));
  assert.ok(!isWebhookUrl('https://evil.com/api/webhooks/1/x'));
  assert.ok(!isWebhookUrl('https://discord.com.evil.com/api/webhooks/1/x'));
  assert.ok(!isWebhookUrl('http://discord.com/api/webhooks/1/x'));
});

test('mentions are explicit and never parse other pings', () => {
  assert.deepEqual(mentionFor(''), { content: '', allowed: { parse: [] } });
  assert.deepEqual(mentionFor('@everyone'), { content: '@everyone', allowed: { parse: ['everyone'] } });
  assert.deepEqual(mentionFor('123456789012345678'), {
    content: '<@&123456789012345678>',
    allowed: { parse: [], roles: ['123456789012345678'] },
  });
  assert.throws(() => mentionFor('<@1>'), /role ID/);
});

test('builds an embed with price, store, end time and image', () => {
  const { embeds, content, allowed_mentions } = buildMessage(game);
  const [embed] = embeds;
  assert.equal(content, undefined);
  assert.deepEqual(allowed_mentions, { parse: [] });
  assert.equal(embed.title, 'Flotsam');
  assert.equal(embed.url, game.url);
  assert.equal(embed.image.url, game.image);
  assert.equal(embed.fields[0].value, '~~$24.99~~ **Free**');
  assert.equal(embed.fields[1].value, 'Epic Games Store');
  assert.match(embed.fields[2].value, /^<t:\d+:f> \(<t:\d+:R>\)$/);
  assert.ok(embed.description.length <= 300);
  assert.ok(!/\s\s/.test(embed.description), 'whitespace is collapsed');
});

test('upcoming games and date-only end dates', () => {
  const upcoming = buildMessage({ ...game, upcoming: true }).embeds[0];
  assert.equal(upcoming.title, 'Coming soon: Flotsam');
  assert.equal(upcoming.fields[2].name, 'Free from');

  const dateOnly = buildMessage({ ...game, endsAt: '2026-11-02', worth: null, image: null, description: '' }).embeds[0];
  assert.equal(dateOnly.fields[2].value, 'Nov 2');
  assert.equal(dateOnly.fields[0].value, '**Free**');
  assert.equal(dateOnly.image, undefined);
  assert.equal(dateOnly.description, undefined);
});

test('waits and retries when Discord rate-limits', async () => {
  const waits = [];
  const { fetchImpl, posts } = fakeFetch({
    discord: (n) => (n === 1 ? { status: 429, body: { retry_after: 1.5 } } : { status: 200, body: {} }),
  });
  await postMessage(WEBHOOK, buildMessage(game), { fetchImpl, sleep: async (ms) => waits.push(ms) });
  assert.equal(posts.length, 2);
  assert.deepEqual(waits, [1750]);
  assert.ok(posts[0].url.endsWith('?wait=true'));
});

test('a deleted webhook gives a clear error', async () => {
  const { fetchImpl } = fakeFetch({ discord: () => ({ status: 404, body: { message: 'Unknown Webhook' } }) });
  await assert.rejects(postMessage(WEBHOOK, buildMessage(game), { fetchImpl }), /webhook URL is right/);
});
