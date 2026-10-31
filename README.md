# free-games-discord

Get free game giveaways posted to your Discord server: Steam, Epic Games Store, GOG, itch.io, IndieGala, Prime Gaming and more.

Runs on GitHub Actions for free, so there's no bot to host and no server to keep running. Each game is posted once, with its cover image, original price, store, and when the offer ends.

## Set it up in 3 steps

**1. Make a Discord webhook.** In your server: **Server Settings → Integrations → Webhooks → New Webhook**. Pick the channel, then **Copy Webhook URL**.

**2. Save it as a secret.** In any GitHub repository you own (a new empty one is fine): **Settings → Secrets and variables → Actions → New repository secret**. Name it `DISCORD_WEBHOOK_URL` and paste the URL.

**3. Add the workflow.** Create `.github/workflows/free-games.yml` in that repository:

```yaml
name: Free games

on:
  schedule:
    - cron: '17 */3 * * *'   # every 3 hours
  workflow_dispatch:          # adds a "Run workflow" button

jobs:
  post:
    runs-on: ubuntu-latest
    steps:
      - uses: ahmad3a4/free-games-discord@v1
        with:
          webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
```

That's it. To try it right away, open the **Actions** tab, pick **Free games**, and click **Run workflow**.

## Options

| Input | Default | What it does |
| --- | --- | --- |
| `webhook-url` | | Your Discord webhook URL. Use a secret. Separate several with commas to post to more channels. |
| `stores` | `pc` | Which stores to include. `pc` is every store except mobile, `all` includes mobile, or list them: `steam, epic, gog`. |
| `upcoming` | `false` | Also post the Epic Games Store's free games for next week. |
| `mention` | | Ping with the first new post: `everyone`, `here`, or a role ID. |
| `max-posts` | `10` | Most games to post in one run. The rest wait for the next run, so a busy week doesn't flood the channel. |
| `first-run` | `post` | On the very first run, `post` the giveaways running now, or `skip` them and only post new ones. |
| `dry-run` | `false` | Only list the giveaways in the log. |
| `state-key` | `free-games-discord` | Change this to run more than one feed (say, one per channel) in the same repository. |

Store names for `stores`: `steam`, `epic`, `gog`, `itch`, `indiegala`, `prime`, `ubisoft`, `ea`, `battlenet`, `mobile`, `other`.

To get a role ID, turn on **Developer Mode** in Discord (Settings → Advanced), then right-click the role and **Copy Role ID**.

Example with everything:

```yaml
      - uses: ahmad3a4/free-games-discord@v1
        with:
          webhook-url: ${{ secrets.DISCORD_WEBHOOK_URL }}
          stores: steam, epic, gog
          upcoming: true
          mention: '123456789012345678'
          max-posts: 5
```

## How it remembers what it posted

The list of posted games is kept in the GitHub Actions cache of your repository, so nothing gets committed and the repository stays clean. Games are forgotten 90 days after posting, long after any giveaway has ended.

If the cache is ever cleared (GitHub removes caches that go unused for 7 days), the next run treats itself as a first run. Running every few hours keeps the cache alive.

## Run it on your own computer

Needs [Node.js](https://nodejs.org) 18.11 or newer. There are no dependencies to install.

```sh
# See what's free right now
npx github:ahmad3a4/free-games-discord --dry-run

# Post to Discord (remembers posted games in .free-games-state.json)
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." npx github:ahmad3a4/free-games-discord
```

Run `--help` to see every option. They match the inputs above (`--stores`, `--upcoming`, `--mention`, `--max-posts`, `--first-run`, `--state`, `--json`).

You can also run it from cron, a Raspberry Pi, or anything else that runs Node.

## Where the games come from

- [GamerPower](https://www.gamerpower.com) lists giveaways from every major store. Thanks to them for the free API.
- The [Epic Games Store](https://store.epicgames.com/free-games) free games feed, used for Epic's weekly games because it has exact start and end times and next week's games.

When both list the same Epic game, it's posted once.

## Notes

- Your webhook URL works like a password: anyone who has it can post in that channel. Keep it in a secret, never in the workflow file. The tool never prints it.
- GitHub pauses scheduled workflows in repositories with no activity for 60 days. If posts stop, open the Actions tab and re-enable the workflow.
- Scheduled runs on GitHub can start a few minutes late. That's normal.

## Development

```sh
npm test
```

`src/sources.js` fetches and cleans up the giveaways, `src/stores.js` knows the stores, `src/discord.js` builds and sends the messages, `src/state.js` remembers what was posted, and `src/run.js` ties it together.

## License

[MIT](LICENSE)
