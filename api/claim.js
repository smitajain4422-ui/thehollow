// POST /api/claim?uid=ROBLOX_USER_ID with header x-game-key: GAME_SECRET -> { boxes }
// Called by the Roblox game server when a player joins: hands over the boxes they're owed and zeroes them,
// so the same boxes can't be claimed twice.
const { load, save, send, params, validUser } = require('../lib/rewards');

module.exports = async (req, res) => {
  const secret = process.env.GAME_SECRET;
  if (!secret) return send(res, 500, { error: 'GAME_SECRET is not set' });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (req.headers['x-game-key'] !== secret) return send(res, 403, { error: 'bad key' });

  const uid = params(req).get('uid');
  if (!validUser(uid)) return send(res, 400, { error: 'invalid' });
  try {
    const entry = await load(uid);
    const boxes = entry ? entry.owed : 0;
    if (boxes > 0) {
      entry.owed = 0;
      entry.given += boxes;
      await save(uid, entry);
    }
    send(res, 200, { boxes });
  } catch {
    send(res, 502, { error: 'store' });
  }
};
