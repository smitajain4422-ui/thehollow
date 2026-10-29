// Shared by the /api functions: reward tiers and the "HollowRewards" data store in the Roblox game.
// The site writes here through Roblox Open Cloud; the game reads the same data store when the player joins
// and hands out the boxes (ServerScriptService.HollowRewards).
// Vercel environment variables:
//   ROBLOX_API_KEY      Open Cloud API key with DataStore read + write for the game's universe
//   ROBLOX_UNIVERSE_ID  10772692448
//   POSTBACK_KEY        any long random text; the CPA network's postback URL must carry it as ?key=
// Without ROBLOX_API_KEY everything is kept in memory (local testing only).
const crypto = require('node:crypto');

const TIERS = { 1: { need: 1, boxes: 1 }, 2: { need: 1, boxes: 3 } };
const STORE = 'HollowRewards';
const mem = new Map();

function entryUrl(extra = '') {
  const u = process.env.ROBLOX_UNIVERSE_ID;
  return `https://apis.roblox.com/datastores/v1/universes/${u}/standard-datastores/datastore/entries/entry?datastoreName=${STORE}${extra}`;
}

async function load(userId) {
  const key = process.env.ROBLOX_API_KEY;
  if (!key) return mem.get(String(userId)) || null;
  const r = await fetch(entryUrl(`&entryKey=${userId}`), { headers: { 'x-api-key': key } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`data store read ${r.status}`);
  return r.json();
}

async function save(userId, value) {
  const key = process.env.ROBLOX_API_KEY;
  if (!key) { mem.set(String(userId), value); return; }
  const body = JSON.stringify(value);
  const r = await fetch(entryUrl(`&entryKey=${userId}`), {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json', 'content-md5': crypto.createHash('md5').update(body).digest('base64') },
    body,
  });
  if (!r.ok) throw new Error(`data store write ${r.status}`);
}

// { tier, done, offers } -> what the page shows
function summary(entry) {
  const tier = TIERS[entry && entry.tier] ? entry.tier : 1;
  const t = TIERS[tier];
  const done = Math.max(0, (entry && entry.done) || 0);
  return { tier, need: t.need, boxes: t.boxes, done: Math.min(done, t.need), ready: done >= t.need };
}

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

const params = (req) => new URL(req.url, 'http://local').searchParams;
const validUser = (s) => /^\d{1,15}$/.test(s || '');

module.exports = { TIERS, load, save, summary, send, params, validUser };
