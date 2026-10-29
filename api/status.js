// GET /api/status?uid=ROBLOX_USER_ID -> { tier, need, boxes, done, ready }; the quest screen asks every few seconds
const { load, summary, send, params, validUser } = require('../lib/rewards');

module.exports = async (req, res) => {
  const uid = params(req).get('uid');
  if (!validUser(uid)) return send(res, 400, { error: 'invalid' });
  try {
    send(res, 200, summary(await load(uid)));
  } catch {
    send(res, 502, { error: 'store' });
  }
};
