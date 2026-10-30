// GET /api/status?uid=ROBLOX_USER_ID -> { tier, done, need, ready, boxes }; the quest page asks this every few seconds
const { load, fresh, summary, send, params, validUser } = require('../lib/rewards');

module.exports = async (req, res) => {
  const uid = params(req).get('uid');
  if (!validUser(uid)) return send(res, 400, { error: 'invalid' });
  try {
    send(res, 200, summary((await load(uid)) || fresh()));
  } catch {
    send(res, 502, { error: 'store' });
  }
};
