import { STORES } from './stores.js';
import { USER_AGENT } from './sources.js';

const WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/;

export function isWebhookUrl(url) {
  return WEBHOOK.test(String(url).trim());
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Discord shows <t:...> in each reader's own time zone. Date-only values stay plain text. */
function when(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  const unix = Math.floor(new Date(value).getTime() / 1000);
  return Number.isFinite(unix) ? `<t:${unix}:f> (<t:${unix}:R>)` : null;
}

/** Message content for the optional ping: "everyone", "here", or a role ID. */
export function mentionFor(mention) {
  const value = String(mention ?? '').trim().replace(/^@/, '');
  if (!value) return { content: '', allowed: { parse: [] } };
  if (value === 'everyone' || value === 'here') return { content: `@${value}`, allowed: { parse: ['everyone'] } };
  if (/^\d{5,25}$/.test(value)) return { content: `<@&${value}>`, allowed: { parse: [], roles: [value] } };
  throw new Error(`mention must be "everyone", "here" or a role ID, not "${mention}".`);
}

export function buildMessage(game, { mention } = {}) {
  const store = STORES[game.store] ?? STORES.other;
  const fields = [
    { name: 'Price', value: game.worth ? `~~${game.worth}~~ **Free**` : '**Free**', inline: true },
    { name: 'Store', value: store.name, inline: true },
  ];
  if (game.upcoming) {
    const starts = when(game.startsAt);
    if (starts) fields.push({ name: 'Free from', value: starts, inline: false });
  } else {
    const ends = when(game.endsAt);
    if (ends) fields.push({ name: 'Free until', value: ends, inline: false });
  }

  const embed = {
    title: truncate(game.upcoming ? `Coming soon: ${game.title}` : game.title, 256),
    url: game.url,
    color: store.color,
    fields,
    footer: { text: `via ${game.source}` },
  };
  const description = truncate(String(game.description ?? '').replace(/\s+/g, ' ').trim(), 300);
  if (description) embed.description = description;
  if (game.image) embed.image = { url: game.image };

  const ping = mentionFor(mention);
  return {
    content: ping.content || undefined,
    embeds: [embed],
    allowed_mentions: ping.allowed,
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Posts one message, waiting and retrying when Discord rate-limits us. */
export async function postMessage(webhookUrl, message, { fetchImpl = fetch, sleep = wait, attempts = 5 } = {}) {
  const url = `${webhookUrl.trim().replace(/\/$/, '')}?wait=true`;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify(message),
    });
    if (res.ok) return;

    const text = await res.text().catch(() => '');
    if (res.status === 429 && attempt < attempts) {
      let seconds = Number(res.headers.get('retry-after')) || 1;
      try {
        seconds = JSON.parse(text).retry_after ?? seconds;
      } catch {
        // keep the header value
      }
      await sleep(Math.ceil(seconds * 1000) + 250);
      continue;
    }
    if (res.status === 401 || res.status === 404) {
      throw new Error(`Discord rejected the webhook (HTTP ${res.status}). Check that the webhook URL is right and still exists.`);
    }
    throw new Error(`Discord returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  throw new Error('Discord kept rate-limiting the webhook. Try again later.');
}
