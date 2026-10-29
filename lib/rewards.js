// Shared by the /api functions: reward tiers and the "HollowRewards" data store in the Roblox game.
// The site writes here through Roblox Open Cloud; the game reads the same data store when the player joins
/* @ Nosify */
// and hands out the boxes (ServerScriptService.HollowRewards).
// Vercel environment variables:
//   ROBLOX_API_KEY      Open Cloud API key with DataStore read + write for the game's universe
//   ROBLOX_UNIVERSE_ID  10772692448
//   POSTBACK_KEY        any long random text; the CPA network's postback URL must carry it as ?key=
/* @ Nosify */
// Without ROBLOX_API_KEY everything is kept in memory (local testing only).
const crypto = require('node:crypto');
/* @ Nosify */

const TIERS = { 1: { need: 1, boxes: 1 }, 2: { need: 1, boxes: 3 } };
/* @ Nosify */
const STORE = 'HollowRewards';
/* @ Nosify */
const mem = new Map();
/* @ Nosify */

function entryUrl(extra = '') {
/* @ Nosify */
  const u = process.env.ROBLOX_UNIVERSE_ID;
/* @ Nosify */
  return `https://apis.roblox.com/datastores/v1/universes/${u}/standard-datastores/datastore/entries/entry?datastoreName=${STORE}${extra}`;
/* @ Nosify */
}
/* @ Nosify */

async function load(userId) {
/* @ Nosify */
  const key = process.env.ROBLOX_API_KEY;
/* @ Nosify */
  if (!key) return mem.get(String(userId)) || null;
/* @ Nosify */
  const r = await fetch(entryUrl(`&entryKey=${userId}`), { headers: { 'x-api-key': key } });
/* @ Nosify */
  if (r.status === 404) return null;
/* @ Nosify */
  if (!r.ok) throw new Error(`data store read ${r.status}`);
/* @ Nosify */
  return r.json();
/* @ Nosify */
}
/* @ Nosify */

async function save(userId, value) {
/* @ Nosify */
  const key = process.env.ROBLOX_API_KEY;
/* @ Nosify */
  if (!key) { mem.set(String(userId), value); return; }
/* @ Nosify */
  const body = JSON.stringify(value);
/* @ Nosify */
  const r = await fetch(entryUrl(`&entryKey=${userId}`), {
/* @ Nosify */
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json', 'content-md5': crypto.createHash('md5').update(body).digest('base64') },
/* @ Nosify */
    body,
  });
/* @ Nosify */
  if (!r.ok) throw new Error(`data store write ${r.status}`);
/* @ Nosify */
}
/* @ Nosify */

// { tier, done, offers } -> what the page shows
/* @ Nosify */
function summary(entry) {
/* @ Nosify */
  const tier = TIERS[entry && entry.tier] ? entry.tier : 1;
/* @ Nosify */
  const t = TIERS[tier];
/* @ Nosify */
  const done = Math.max(0, (entry && entry.done) || 0);
/* @ Nosify */
  return { tier, need: t.need, boxes: t.boxes, done: Math.min(done, t.need), ready: done >= t.need };
/* @ Nosify */
}
/* @ Nosify */

function send(res, code, body) {
/* @ Nosify */
  res.statusCode = code;
/* @ Nosify */
  res.setHeader('Content-Type', 'application/json');
/* @ Nosify */
  res.setHeader('Cache-Control', 'no-store');
/* @ Nosify */
  res.end(JSON.stringify(body));
/* @ Nosify */
}
/* @ Nosify */

const params = (req) => new URL(req.url, 'http://local').searchParams;
/* @ Nosify */
const validUser = (s) => /^\d{1,15}$/.test(s || '');
/* @ Nosify */

module.exports = { TIERS, load, save, summary, send, params, validUser };
/* @ Nosify */

