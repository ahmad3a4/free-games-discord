import { detectStore, STORES } from './stores.js';

export const USER_AGENT = 'free-games-discord (+https://github.com/ahmad3a4/free-games-discord)';

const GAMERPOWER_URL = 'https://www.gamerpower.com/api/giveaways?type=game&sort-by=date';
const EPIC_URL =
  'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US';

/**
 * Every source returns games in this shape:
 * { id, title, store, url, image, worth, description, endsAt, startsAt, upcoming, source }
 * endsAt/startsAt are ISO strings when the time is known exactly, or 'YYYY-MM-DD' when only the date is.
 */

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Store/platform tags GamerPower puts in titles that aren't stores we list by name.
const OTHER_TAGS = /^(pc|drm-free|stove|rift|oculus|meta quest|vr|uplay|microsoft store|xbox.*|ps[45]|playstation.*|switch|keys?)$/i;

/** "Hexologic (Steam) Giveaway" -> "Hexologic", "Dwarven Realms (Steam) Key" -> "Dwarven Realms" */
export function cleanTitle(title) {
  let clean = title.replace(/\s+Giveaway\s*$/i, '').replace(/\s+Keys?\s*$/i, '').trim();
  const tag = clean.match(/\s*\(([^()]+)\)\s*$/);
  if (tag && (OTHER_TAGS.test(tag[1].trim()) || Object.values(STORES).some((s) => s.pattern?.test(tag[1])))) {
    clean = clean.slice(0, tag.index).trim();
  }
  return clean || title;
}

export function normalizeGamerPower(items) {
  return items
    .filter((g) => g.type === 'Game' && g.status === 'Active')
    .map((g) => {
      const platforms = String(g.platforms ?? '').split(',').map((p) => p.trim()).filter(Boolean);
      const date = /^\d{4}-\d{2}-\d{2}/.test(g.end_date ?? '') ? g.end_date.slice(0, 10) : null;
      return {
        id: `gamerpower:${g.id}`,
        title: cleanTitle(g.title),
        store: detectStore(g.title, platforms),
        url: g.open_giveaway_url || g.gamerpower_url,
        image: g.image || g.thumbnail || null,
        worth: g.worth && g.worth !== 'N/A' ? g.worth : null,
        description: g.description ?? '',
        endsAt: date,
        startsAt: null,
        upcoming: false,
        source: 'GamerPower',
      };
    });
}

function epicOffer(groups, now) {
  for (const group of groups ?? []) {
    for (const offer of group.promotionalOffers ?? []) {
      if (offer.discountSetting?.discountPercentage !== 0) continue;
      if (now && new Date(offer.endDate) <= now) continue;
      return offer;
    }
  }
  return null;
}

export function normalizeEpic(data, now = new Date()) {
  const games = [];
  for (const e of data?.data?.Catalog?.searchStore?.elements ?? []) {
    const current = epicOffer(e.promotions?.promotionalOffers, now);
    const next = current ? null : epicOffer(e.promotions?.upcomingPromotionalOffers, now);
    const offer = current ?? next;
    if (!offer) continue;
    if (current && new Date(current.startDate) > now) continue;

    const slug = e.offerMappings?.[0]?.pageSlug || e.catalogNs?.mappings?.[0]?.pageSlug || e.productSlug?.replace(/\/home$/, '');
    const image =
      e.keyImages?.find((k) => k.type === 'OfferImageWide')?.url ||
      e.keyImages?.find((k) => k.type === 'DieselStoreFrontWide')?.url ||
      e.keyImages?.[0]?.url ||
      null;
    const original = e.price?.totalPrice?.fmtPrice?.originalPrice;
    // Free-to-play games show up with 0% offers too (usually in-game item promos), skip them.
    if (e.price?.totalPrice?.originalPrice === 0) continue;

    games.push({
      id: `epic:${e.id}:${offer.startDate}`,
      title: e.title,
      store: 'epic',
      url: slug ? `https://store.epicgames.com/en-US/p/${slug}` : 'https://store.epicgames.com/en-US/free-games',
      image,
      worth: original && original !== '0' ? original : null,
      description: e.description && e.description !== e.title ? e.description : '',
      endsAt: offer.endDate,
      startsAt: offer.startDate,
      upcoming: !current,
      source: 'Epic Games Store',
    });
  }
  return games;
}

const comparable = (title) => title.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Epic's own listing wins over GamerPower's copy of the same Epic game. */
export function dedupe(games) {
  const epicTitles = new Set(games.filter((g) => g.source === 'Epic Games Store').map((g) => comparable(g.title)));
  const seen = new Set();
  return games.filter((g) => {
    if (g.source !== 'Epic Games Store' && g.store === 'epic' && epicTitles.has(comparable(g.title))) return false;
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

/** Fetches both sources. One failing is fine (it's reported); both failing throws. */
export async function fetchGames({ fetchImpl = fetch, now = new Date() } = {}) {
  const [gp, epic] = await Promise.allSettled([
    getJson(GAMERPOWER_URL, fetchImpl).then(normalizeGamerPower),
    getJson(EPIC_URL, fetchImpl).then((d) => normalizeEpic(d, now)),
  ]);
  const warnings = [];
  if (gp.status === 'rejected') warnings.push(`GamerPower is unavailable (${gp.reason.message}).`);
  if (epic.status === 'rejected') warnings.push(`Epic Games Store is unavailable (${epic.reason.message}).`);
  if (gp.status === 'rejected' && epic.status === 'rejected') {
    throw new Error(`couldn't load any giveaways. ${warnings.join(' ')}`);
  }
  const games = dedupe([...(epic.value ?? []), ...(gp.value ?? [])]);
  return { games, warnings };
}
