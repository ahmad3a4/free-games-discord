// Stores a giveaway can come from. `pc` in the stores option means every store except mobile.

export const STORES = {
  steam: { name: 'Steam', color: 0x1b2838, pattern: /\bsteam\b/i },
  epic: { name: 'Epic Games Store', color: 0x313131, pattern: /\bepic\b/i },
  gog: { name: 'GOG', color: 0x86328a, pattern: /\bgog\b/i },
  itch: { name: 'itch.io', color: 0xfa5c5c, pattern: /\bitch(\.?io)?\b/i },
  indiegala: { name: 'IndieGala', color: 0xe0313b, pattern: /\bindiegala\b/i },
  prime: { name: 'Prime Gaming', color: 0x9146ff, pattern: /\bprime gaming\b|\bamazon\b/i },
  ubisoft: { name: 'Ubisoft', color: 0x0070ff, pattern: /\bubisoft\b/i },
  ea: { name: 'EA app', color: 0xff4747, pattern: /\bea app\b|\borigin\b/i },
  battlenet: { name: 'Battle.net', color: 0x148eff, pattern: /\bbattle\.net\b/i },
  mobile: { name: 'Mobile', color: 0x3ddc84, pattern: /\bmobile\b|\bandroid\b|\bios\b/i },
  other: { name: 'Other', color: 0x5865f2, pattern: null },
};

export const STORE_KEYS = Object.keys(STORES);

/** Store key for a giveaway, from its title "(Steam)" first, then its platform list. */
export function detectStore(title = '', platforms = []) {
  const tag = title.match(/\(([^()]+)\)\s*(?:Giveaway)?\s*$/i)?.[1] ?? '';
  for (const text of [tag, ...platforms]) {
    for (const [key, store] of Object.entries(STORES)) {
      if (store.pattern?.test(text)) return key;
    }
  }
  return 'other';
}

/**
 * Turns "steam, epic" / "pc" / "all" into a set of store keys.
 * Throws on unknown names so typos don't silently filter everything out.
 */
export function parseStores(value = 'pc') {
  const wanted = new Set();
  for (const raw of String(value).split(/[\s,]+/).filter(Boolean)) {
    const name = raw.toLowerCase();
    if (name === 'all') STORE_KEYS.forEach((k) => wanted.add(k));
    else if (name === 'pc') STORE_KEYS.filter((k) => k !== 'mobile').forEach((k) => wanted.add(k));
    else if (STORES[name]) wanted.add(name);
    else throw new Error(`unknown store "${raw}". Use any of: pc, all, ${STORE_KEYS.join(', ')}.`);
  }
  if (!wanted.size) throw new Error('no stores selected.');
  return wanted;
}
