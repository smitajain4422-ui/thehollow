// POST /api/claim?uid=ROBLOX_USER_ID with header x-game-key: GAME_SECRET -> { rewards: { prism_box: 3, demon_fatality: 1 } }
// Called by the Roblox game server when a player joins: hands over the items they're owed and zeroes them,
// so the same items can't be claimed twice.
const { load, save, items, total, send, params, validUser } = require('../lib/rewards');

module.exports = async (req, res) => {
  const secret = process.env.GAME_SECRET;
  if (!secret) return send(res, 500, { error: 'GAME_SECRET is not set' });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (req.headers['x-game-key'] !== secret) return send(res, 403, { error: 'bad key' });

  const uid = params(req).get('uid');
  if (!validUser(uid)) return send(res, 400, { error: 'invalid' });
  try {
    const entry = await load(uid);
    const rewards = entry ? items(entry.owed) : {};
    if (total(rewards) > 0) {
      const given = items(entry.given);
      for (const k in rewards) given[k] = (given[k] || 0) + rewards[k];
      entry.given = given;
      entry.owed = {};
      await save(uid, entry);
    }
    send(res, 200, { rewards });
  } catch (e) {
    console.error('store failed', e);
    send(res, 502, { error: 'store', detail: String(e.message || e).slice(0, 200) });
  }
};
