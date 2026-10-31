#!/usr/bin/env node
import { readFileSync, appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { run } from '../src/run.js';
import { parseStores, STORES, STORE_KEYS } from '../src/stores.js';
import { isWebhookUrl, mentionFor } from '../src/discord.js';

const HELP = `
Usage: free-games-discord [options]

Posts free game giveaways (Steam, Epic, GOG, itch.io and more) to Discord.
Each game is posted once; already-posted games are remembered in a state file.

Options:
  --webhook <url>       Discord webhook URL (or set DISCORD_WEBHOOK_URL).
                        Separate several URLs with commas to post to more channels.
  --stores <list>       Which stores, comma-separated (default: pc)
                        pc = every store except mobile, all = everything,
                        or any of: ${STORE_KEYS.join(', ')}
  --upcoming            Also post Epic's free games for next week
  --mention <who>       Ping "everyone", "here", or a role ID with the first post
  --max-posts <n>       Most games to post in one run (default: 10)
  --first-run <mode>    With no state file yet: "post" current games or "skip" them (default: post)
  --state <file>        State file path (default: .free-games-state.json)
  --dry-run             List the giveaways without posting or saving anything
  --json                Print the result as JSON
  -v, --version         Show the version
  -h, --help            Show this help
`;

function fail(message) {
  console.error(`free-games-discord: ${message}`);
  process.exit(1);
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        webhook: { type: 'string' },
        stores: { type: 'string', default: 'pc' },
        upcoming: { type: 'boolean', default: false },
        mention: { type: 'string', default: '' },
        'max-posts': { type: 'string', default: '10' },
        'first-run': { type: 'string', default: 'post' },
        state: { type: 'string', default: '.free-games-state.json' },
        'dry-run': { type: 'boolean', default: false },
        json: { type: 'boolean', default: false },
        version: { type: 'boolean', short: 'v' },
        help: { type: 'boolean', short: 'h' },
      },
    }));
  } catch (err) {
    fail(`${err.message}\nRun with --help to see the options.`);
  }

  if (values.help) return console.log(HELP);
  if (values.version) {
    return console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
  }

  let stores;
  try {
    stores = parseStores(values.stores);
    mentionFor(values.mention);
  } catch (err) {
    fail(err.message);
  }
  const maxPosts = Number(values['max-posts']);
  if (!Number.isInteger(maxPosts) || maxPosts < 1) fail('--max-posts must be a whole number of 1 or more.');
  if (!['post', 'skip'].includes(values['first-run'])) fail('--first-run must be "post" or "skip".');

  const webhooks = String(values.webhook ?? process.env.DISCORD_WEBHOOK_URL ?? '')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!values['dry-run']) {
    if (!webhooks.length) fail('set a webhook with --webhook or DISCORD_WEBHOOK_URL, or use --dry-run to just list games.');
    // Never print the URL itself: it works like a password.
    if (!webhooks.every(isWebhookUrl)) fail("that doesn't look like a Discord webhook URL (https://discord.com/api/webhooks/...).");
  }

  const result = await run({
    webhooks,
    statePath: values.state,
    stores,
    includeUpcoming: values.upcoming,
    firstRun: values['first-run'],
    maxPosts,
    mention: values.mention,
    dryRun: values['dry-run'],
    log: values.json ? () => {} : (line) => console.log(line),
  });

  setOutput('posted-count', result.posted.length);

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (values['dry-run']) {
    console.log(`${result.games.length} free game${result.games.length === 1 ? '' : 's'} right now:\n`);
    for (const g of result.games) {
      const ends = g.upcoming ? `starts ${g.startsAt.slice(0, 10)}` : g.endsAt ? `until ${g.endsAt.slice(0, 10)}` : '';
      console.log(`  ${(STORES[g.store] ?? STORES.other).name.padEnd(17)} ${g.title}${g.worth ? ` (${g.worth})` : ''}  ${ends}`);
    }
  } else if (result.firstRun && result.skipped.length) {
    console.log(`First run: remembered ${result.skipped.length} current giveaways without posting. New ones will be posted from now on.`);
  } else {
    const waiting = result.waiting ? ` ${result.waiting} more will be posted next run.` : '';
    console.log(`Posted ${result.posted.length} new giveaway${result.posted.length === 1 ? '' : 's'}.${waiting}`);
  }
}

main().catch((err) => fail(err.message));
