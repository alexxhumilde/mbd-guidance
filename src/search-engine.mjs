import { DEFAULT_GUIDES_DIR, loadCatalog } from './catalog.mjs';

const DISCORD_SYNONYMS = {
  embed: ['components', 'v2', 'container', 'textdisplay'],
  embeds: ['components', 'v2', 'container'],
  'components-v2': ['containerbuilder', 'sectionbuilder', 'iscomponentsv2'],
  ephemeral: ['messageflags', 'defer', 'flags'],
  defer: ['deferreply', 'deferupdate', '3s', '10062', 'timeout'],
  slash: ['slashcommandbuilder', 'chatinputcommandinteraction', 'applicationcommands'],
  worker: ['ed25519', 'serverless', 'http', 'interactions', 'cloudflare'],
  cloudflare: ['ed25519', 'serverless', 'http', 'interactions', 'waituntil'],
  nextjs: ['ed25519', 'serverless', 'http', 'interactions', 'dashboard', 'oauth2', 'rest'],
  serverless: ['ed25519', 'http', 'interactions', 'crypto'],
  signature: ['ed25519', 'x-signature-ed25519', 'verify'],
  pagination: ['custom_id', 'stateful', 'buttons', 'collector'],
  button: ['custom_id', 'actionrowbuilder', 'buttonbuilder'],
  buttons: ['custom_id', 'actionrowbuilder', 'buttonbuilder'],
  modal: ['modalbuilder', 'textinputbuilder', 'showmodal'],
  autocomplete: ['isautocomplete', 'respond', 'choices'],
  v13: ['v14', 'migration', 'modernization', 'messageembed'],
  v12: ['v14', 'migration', 'modernization'],
  prefix: ['messagecontent', 'slash', 'migration', 'interactions'],
  mention: ['allowedmentions', 'everyone', 'here', 'ping'],
  mentions: ['allowedmentions', 'everyone', 'here', 'ping'],
  permission: ['permissionflagsbits', 'hierarchy', 'setdefaultmemberpermissions'],
  permissions: ['permissionflagsbits', 'hierarchy', 'setdefaultmemberpermissions'],
  shard: ['sharding', 'shardingmanager', 'ws', 'gateway'],
  sharding: ['shardingmanager', 'ws', 'gateway', 'cache'],
  memory: ['cache', 'sweepers', 'makecache', 'limits'],
  cache: ['sweepers', 'makecache', 'sharding'],
  dashboard: ['oauth2', 'nextjs', 'web', 'guilds', 'manageguild', 'idor'],
  web: ['dashboard', 'oauth2', 'nextjs', 'sync', 'rest'],
  oauth: ['oauth2', 'dashboard', 'guilds', 'identify', 'manageguild'],
  oauth2: ['dashboard', 'guilds', 'identify', 'manageguild', 'idor'],
  idor: ['oauth2', 'dashboard', 'manageguild', 'security'],
  sync: ['ipc', 'redis', 'pubsub', 'dashboard', 'webhook'],
  ipc: ['sync', 'redis', 'pubsub', 'sharding', 'dashboard'],
  redis: ['sync', 'ipc', 'pubsub', 'cache', 'sharding'],
  fileupload: ['modal', 'labelbuilder', 'fileuploadbuilder', 'getuploadedfiles'],
  labelbuilder: ['modal', 'addlabelcomponents', 'textinputbuilder', 'fileuploadbuilder'],
  fetchpinned: ['fetchpins', 'pins', 'v14', 'migration'],
  fetchpins: ['fetchpinned', 'pins', 'v14', 'migration'],
  pins: ['fetchpins', 'fetchpinned', 'migration'],
};

/**
 * Tokenize text into normalized lowercase ASCII search terms.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, ' ')
    .split(/\s+/)
    .flatMap((token) => (token.includes('-') || token.includes('_') ? [token, ...token.split(/[-_]+/)] : [token]))
    .filter((token) => token.length >= 2);
}

/**
 * Expand query tokens with Discord-specific synonyms without diluting original terms.
 * @param {string} query
 * @returns {{ primary: string[], expanded: string[] }}
 */
function expandQuery(query) {
  const primary = Array.from(new Set(tokenize(query)));
  const expandedSet = new Set();

  for (const token of primary) {
    const synonyms = DISCORD_SYNONYMS[token];
    if (synonyms) {
      for (const syn of synonyms) {
        if (!primary.includes(syn)) {
          expandedSet.add(syn);
        }
      }
    }
  }

  return { primary, expanded: Array.from(expandedSet) };
}

/**
 * Count term frequencies in a token list.
 * @param {string[]} tokens
 * @returns {Map<string, number>}
 */
function buildTermFreqMap(tokens) {
  const freq = new Map();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

/**
 * Search guides using a weighted field BM25 ranking algorithm.
 * @param {string} query
 * @param {{ limit?: number, category?: string, guidesDir?: string }} [options]
 * @returns {Array<{
 *   id: string,
 *   category: string,
 *   title: string,
 *   description: string,
 *   ecosystems: string[],
 *   score: number
 * }>}
 */
export function searchGuides(query, options = {}) {
  const { limit = 10, category, guidesDir = DEFAULT_GUIDES_DIR } = options;
  const { primary, expanded } = expandQuery(query);

  if (primary.length === 0) {
    return [];
  }

  const catalog = loadCatalog(guidesDir).filter(
    (guide) => !category || guide.category.toLowerCase() === category.trim().toLowerCase()
  );

  if (catalog.length === 0) {
    return [];
  }

  const FIELD_WEIGHTS = {
    id: 5.0,
    title: 4.0,
    tags: 4.0,
    description: 3.0,
    body: 1.0,
  };

  const indexedDocs = catalog.map((guide) => {
    const fields = {
      id: tokenize(guide.id),
      title: tokenize(guide.title),
      tags: tokenize(guide.tags.join(' ')),
      description: tokenize(guide.description),
      body: tokenize(guide.body),
    };

    const weightedTf = new Map();
    let docLength = 0;

    for (const [fieldName, tokens] of Object.entries(fields)) {
      const weight = FIELD_WEIGHTS[fieldName];
      docLength += tokens.length;
      const fieldFreq = buildTermFreqMap(tokens);
      for (const [term, count] of fieldFreq.entries()) {
        weightedTf.set(term, (weightedTf.get(term) || 0) + count * weight);
      }
    }

    return {
      guide,
      weightedTf,
      docLength: Math.max(docLength, 1),
    };
  });

  const avgDocLength =
    indexedDocs.reduce((acc, doc) => acc + doc.docLength, 0) / indexedDocs.length;

  const docFreq = new Map();
  for (const doc of indexedDocs) {
    for (const term of doc.weightedTf.keys()) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

  const k1 = 1.5;
  const b = 0.75;
  const N = indexedDocs.length;

  const scoreTerm = (doc, term, termWeight) => {
    const tf = doc.weightedTf.get(term) || 0;
    if (tf === 0) {
      return 0;
    }
    const df = docFreq.get(term) || 0;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    const norm = 1 - b + b * (doc.docLength / avgDocLength);
    const tfComponent = (tf * (k1 + 1)) / (tf + k1 * norm);
    return idf * tfComponent * termWeight;
  };

  const normalizedQuery = query.trim().toLowerCase();

  const scored = indexedDocs
    .map((doc) => {
      let score = 0;
      for (const term of primary) {
        score += scoreTerm(doc, term, 1.0);
      }
      for (const term of expanded) {
        score += scoreTerm(doc, term, 0.35);
      }

      if (doc.guide.id.toLowerCase() === normalizedQuery) {
        score += 10;
      } else if (doc.guide.title.toLowerCase().includes(normalizedQuery)) {
        score += 3;
      }

      return {
        id: doc.guide.id,
        category: doc.guide.category,
        title: doc.guide.title,
        description: doc.guide.description,
        ecosystems: doc.guide.ecosystems,
        score: Number(score.toFixed(4)),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return scored.slice(0, limit);
}
