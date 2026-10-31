import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

// Remembers which giveaways were already posted, so each game is posted once.
// Entries are forgotten after KEEP_DAYS, long after any giveaway has ended.

const KEEP_DAYS = 90;

/** Returns null when there is no state yet (first run). */
export function loadState(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  try {
    const data = JSON.parse(text);
    return { posted: data && typeof data.posted === 'object' && data.posted ? data.posted : {} };
  } catch {
    throw new Error(`the state file ${path} isn't valid JSON. Delete it to start over.`);
  }
}

export function saveState(path, state, now = new Date()) {
  const cutoff = now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const posted = Object.fromEntries(
    Object.entries(state.posted).filter(([, at]) => {
      const time = new Date(at).getTime();
      return !Number.isFinite(time) || time >= cutoff;
    }),
  );
  mkdirSync(dirname(path), { recursive: true });
  // Write to a temp file first, so a crash can't leave half a file behind.
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ version: 1, posted }, null, 2)}\n`);
  renameSync(temp, path);
}
