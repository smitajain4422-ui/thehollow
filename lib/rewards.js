// Shared by the api/ functions: who picked which reward, how many quests they've finished, and items owed to them.
// Stored in Upstash Redis (Vercel's KV integration sets KV_REST_API_URL + KV_REST_API_TOKEN). With no store set up
// (local testing) it falls back to a JSON file in the temp folder.
const fs = require('fs');
const os = require('os');
const path = require('path');

// tier -> which item, how many, and quests needed; the page's reward cards say the same thing.
// `item` is the id the Roblox script receives in giveReward()
const TIERS = {
  1: { item: 'demon_fatality', count: 1, quests: 2 },
  2: { item: 'prism_box', count: 3, quests: 2 },
};

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const key = (uid) => 'hollow:u:' + uid;

async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const raw = await r.text();
  let out;
  try { out = JSON.parse(raw); } catch { throw new Error('redis ' + r.status + ': ' + raw.slice(0, 120)); }
  if (!r.ok || out.error) throw new Error('redis ' + r.status + ': ' + (out.error || 'failed'));
  return out.result;
}

// local fallback: one JSON file, good enough for testing on your own machine (not for Vercel)
const FILE = path.join(os.tmpdir(), 'hollow-rewards.json');
const readFile = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const writeFile = (db) => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));

async function load(uid) {
  if (!URL_) return readFile()[key(uid)] || null;
  const raw = await redis('GET', key(uid));
  return raw ? JSON.parse(raw) : null;
}

async function save(uid, entry) {
  if (!URL_) { const db = readFile(); db[key(uid)] = entry; writeFile(db); return; }
  await redis('SET', key(uid), JSON.stringify(entry));
}

// true the first time a conversion id is seen, so a network retrying the same postback can't pay out twice
async function firstTime(id) {
  if (!URL_) {
    const db = readFile();
    if (db['hollow:tx:' + id]) return false;
    db['hollow:tx:' + id] = 1;
    writeFile(db);
    return true;
  }
  return (await redis('SET', 'hollow:tx:' + id, '1', 'NX', 'EX', 60 * 60 * 24 * 90)) === 'OK';
}

// owed / given are { item: count }; entries saved before items existed held a plain number of prism boxes
const fresh = () => ({ tier: 1, done: 0, offers: [], owed: {}, given: {} });
const items = (v) => (typeof v === 'number' ? (v ? { prism_box: v } : {}) : v || {});
const total = (bag) => Object.values(bag).reduce((a, b) => a + b, 0);

// one finished quest: count it, and once the tier's quests are all done, owe the player that tier's item
function credit(entry, tier) {
  const t = TIERS[tier] || TIERS[entry.tier] || TIERS[1];
  entry.owed = items(entry.owed);
  entry.done += 1;
  if (entry.done >= t.quests) {
    entry.done -= t.quests;
    entry.owed[t.item] = (entry.owed[t.item] || 0) + t.count;
  }
  return entry;
}

// what the page sees while it waits
const summary = (e) => {
  const t = TIERS[e.tier] || TIERS[1];
  const owed = items(e.owed), ready = total(owed) > 0;
  // offers = ids of quests this player already finished, so the page can mark them "done"
  return { tier: e.tier, done: ready ? t.quests : e.done, need: t.quests, ready, rewards: owed, offers: e.offers || [] };
};

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

const params = (req) => new URL(req.url, 'http://local').searchParams;
const validUser = (uid) => /^\d{1,20}$/.test(uid || '');

module.exports = { TIERS, load, save, firstTime, fresh, items, total, credit, summary, send, params, validUser };
