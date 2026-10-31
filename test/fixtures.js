// Small copies of real API responses (trimmed to the fields the code reads).

export const gamerpower = [
  {
    id: 3836,
    title: 'Asleep: Act 1 (Steam) Giveaway',
    worth: '$9.99',
    thumbnail: 'https://www.gamerpower.com/offers/1/6ae4ceb2e38bb.jpg',
    image: 'https://www.gamerpower.com/offers/1b/6ae4ceb2e38bb.jpg',
    description: 'Claim Asleep: Act 1 for free via Steam until 2 Nov!',
    open_giveaway_url: 'https://www.gamerpower.com/open/asleep-act-1-steam-giveaway',
    published_date: '2026-10-30 13:06:58',
    type: 'Game',
    platforms: 'PC, Steam',
    end_date: '2026-11-02 23:59:00',
    status: 'Active',
    gamerpower_url: 'https://www.gamerpower.com/asleep-act-1-steam-giveaway',
  },
  {
    id: 3835,
    title: 'A New Beginning: Final Cut (GOG) Giveaway',
    worth: '$9.99',
    image: 'https://www.gamerpower.com/offers/1b/6ae4af4cbf862.jpg',
    description: 'Score A New Beginning: Final Cut for free via GOG!',
    open_giveaway_url: 'https://www.gamerpower.com/open/a-new-beginning-gog',
    type: 'Game',
    platforms: 'PC, DRM-Free, GOG',
    end_date: 'N/A',
    status: 'Active',
  },
  {
    id: 3426,
    title: "Sorry We're Closed (Epic Games) Giveaway",
    worth: '$24.99',
    image: 'https://www.gamerpower.com/offers/1b/69481a230819b.jpg',
    description: 'Duplicate of the Epic listing.',
    open_giveaway_url: 'https://www.gamerpower.com/open/sorry-we-re-closed',
    type: 'Game',
    platforms: 'PC, Epic Games Store',
    end_date: '2026-11-05 23:59:00',
    status: 'Active',
  },
  {
    id: 3832,
    title: 'Galaxy Kart (Mobile) Giveaway',
    worth: '$4.99',
    image: null,
    description: 'Mobile game.',
    open_giveaway_url: 'https://www.gamerpower.com/open/galaxy-kart',
    type: 'Game',
    platforms: 'Android, iOS',
    end_date: '2026-11-05 23:59:00',
    status: 'Active',
  },
  {
    id: 3001,
    title: 'Old Thing (Steam) Giveaway',
    worth: '$1.99',
    open_giveaway_url: 'https://www.gamerpower.com/open/old-thing',
    type: 'Game',
    platforms: 'PC, Steam',
    end_date: '2026-10-01 23:59:00',
    status: 'Active',
  },
  {
    id: 3002,
    title: 'Some DLC (Steam) Giveaway',
    type: 'DLC',
    platforms: 'PC, Steam',
    end_date: 'N/A',
    status: 'Active',
  },
];

const epicGame = (overrides) => ({
  title: 'Game',
  id: 'id',
  description: 'A game',
  offerMappings: [{ pageSlug: 'game-slug' }],
  keyImages: [{ type: 'OfferImageTall', url: 'https://img/tall.jpg' }, { type: 'OfferImageWide', url: 'https://img/wide.jpg' }],
  price: { totalPrice: { originalPrice: 2499, fmtPrice: { originalPrice: '$24.99' } } },
  promotions: { promotionalOffers: [], upcomingPromotionalOffers: [] },
  ...overrides,
});

const free = (startDate, endDate) => [{ promotionalOffers: [{ startDate, endDate, discountSetting: { discountPercentage: 0 } }] }];

export const epic = {
  data: {
    Catalog: {
      searchStore: {
        elements: [
          epicGame({
            title: "Sorry We're Closed",
            id: 'sorry',
            offerMappings: [{ pageSlug: 'sorry-were-closed-724c86' }],
            promotions: { promotionalOffers: free('2026-10-29T15:00:00.000Z', '2026-11-05T16:00:00.000Z'), upcomingPromotionalOffers: [] },
          }),
          epicGame({
            title: 'Flotsam',
            id: 'flotsam',
            promotions: { promotionalOffers: [], upcomingPromotionalOffers: free('2026-11-05T16:00:00.000Z', '2026-11-12T16:00:00.000Z') },
          }),
          epicGame({
            title: 'Idle Champions',
            id: 'f2p',
            price: { totalPrice: { originalPrice: 0, fmtPrice: { originalPrice: '0' } } },
            promotions: { promotionalOffers: [], upcomingPromotionalOffers: free('2026-11-05T16:00:00.000Z', '2026-11-12T16:00:00.000Z') },
          }),
          epicGame({
            title: 'Just On Sale',
            id: 'sale',
            promotions: {
              promotionalOffers: [{ promotionalOffers: [{ startDate: '2026-10-19T15:00:00.000Z', endDate: '2026-11-02T16:00:00.000Z', discountSetting: { discountPercentage: 40 } }] }],
              upcomingPromotionalOffers: [],
            },
          }),
          epicGame({ title: 'No Promotions', id: 'none', promotions: null }),
        ],
      },
    },
  },
};

export const NOW = new Date('2026-10-31T12:00:00Z');

/** A fetch stand-in that serves the fixtures and records Discord posts. */
export function fakeFetch({ discord = () => ({ status: 204 }), gamerpowerDown = false } = {}) {
  const posts = [];
  const respond = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body ?? '')),
  });
  const fetchImpl = async (url, init = {}) => {
    if (url.includes('gamerpower.com')) return gamerpowerDown ? respond(503, 'down') : respond(200, gamerpower);
    if (url.includes('epicgames.com')) return respond(200, epic);
    if (url.includes('discord.com')) {
      posts.push({ url, body: JSON.parse(init.body) });
      const reply = discord(posts.length);
      return respond(reply.status, reply.body ?? '', reply.headers);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { fetchImpl, posts };
}
