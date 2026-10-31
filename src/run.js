import { fetchGames } from './sources.js';
import { buildMessage, postMessage } from './discord.js';
import { loadState, saveState } from './state.js';

/** Picks the giveaways to show: chosen stores, still running, upcoming only if asked. */
export function selectGames(games, { stores, includeUpcoming = false, now = new Date() }) {
  return games.filter((g) => {
    if (!stores.has(g.store)) return false;
    if (g.upcoming && !includeUpcoming) return false;
    if (!g.upcoming && g.endsAt) {
      // Date-only end dates count until the end of that day.
      const end = g.endsAt.length === 10 ? new Date(`${g.endsAt}T23:59:59Z`) : new Date(g.endsAt);
      if (end < now) return false;
    }
    return true;
  });
}

/**
 * One full run: fetch, skip what's already posted, post the rest, save state.
 * Returns a summary of what happened.
 */
export async function run(options) {
  const {
    webhooks = [],
    statePath,
    stores,
    includeUpcoming = false,
    firstRun = 'post',
    maxPosts = 10,
    mention,
    dryRun = false,
    fetchImpl = fetch,
    sleep,
    now = new Date(),
    log = () => {},
  } = options;

  const { games: all, warnings } = await fetchGames({ fetchImpl, now });
  warnings.forEach((w) => log(`warning: ${w}`));
  const games = selectGames(all, { stores, includeUpcoming, now });

  if (dryRun) return { games, posted: [], skipped: [], firstRun: false, warnings };

  const saved = loadState(statePath);
  const isFirstRun = saved === null;
  const state = saved ?? { posted: {} };
  const fresh = games.filter((g) => !state.posted[g.id]);
  const stamp = now.toISOString();

  // Write the state file right away so it exists even if posting fails.
  saveState(statePath, state, now);

  if (isFirstRun && firstRun === 'skip') {
    fresh.forEach((g) => (state.posted[g.id] = stamp));
    saveState(statePath, state, now);
    return { games, posted: [], skipped: fresh, firstRun: true, warnings };
  }

  const toPost = fresh.slice(0, maxPosts);
  const posted = [];
  try {
    for (const game of toPost) {
      const message = buildMessage(game, { mention: posted.length === 0 ? mention : undefined });
      for (const webhook of webhooks) await postMessage(webhook, message, { fetchImpl, sleep });
      state.posted[game.id] = stamp;
      posted.push(game);
      log(`posted: ${game.title}`);
    }
  } finally {
    saveState(statePath, state, now);
  }

  return { games, posted, skipped: [], waiting: fresh.length - toPost.length, firstRun: isFirstRun, warnings };
}
