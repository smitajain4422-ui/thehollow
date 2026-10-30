// GET /api/start?uid=ROBLOX_USER_ID&tier=1|2 -> remembers which reward the player picked (quests already done are kept)
const { TIERS, load, save, fresh, summary, send, params, validUser } = require('../lib/rewards');

module.exports = async (req, res) => {
  const q = params(req);
  const uid = q.get('uid'), tier = Number(q.get('tier'));
  if (!validUser(uid) || !TIERS[tier]) return send(res, 400, { error: 'invalid' });
  try {
    const entry = (await load(uid)) || fresh();
    entry.tier = tier;
    await save(uid, entry);
    send(res, 200, summary(entry));
  } catch {
    send(res, 502, { error: 'store' });
  }
};
