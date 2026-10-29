// The CPA network calls this when someone completes an offer:
//   https://thehollow.gifts/api/postback?key=POSTBACK_KEY&s1={s1}&offer={offer_id}
// s1 = the Roblox user id the page put on the offer link. Each offer counts once per player.
// Also accepts sub1 / subid / aff_sub for s1 and offer_id / oid / campaign_id for offer, whatever the network calls them.
const { load, save, send, params, validUser } = require('../lib/rewards');

module.exports = async (req, res) => {
  const q = params(req);
  const pick = (...names) => names.map((n) => q.get(n)).find((v) => v);
  if (!process.env.POSTBACK_KEY || q.get('key') !== process.env.POSTBACK_KEY) return send(res, 403, { error: 'key' });
  const uid = pick('s1', 'sub1', 'subid', 'aff_sub');
  const offer = pick('offer', 'offer_id', 'oid', 'campaign_id') || `t${Date.now()}`;
  if (!validUser(uid)) return send(res, 400, { error: 'invalid' });
  try {
    const entry = (await load(uid)) || { tier: 1, done: 0, offers: [] };
    entry.offers = entry.offers || [];
    if (!entry.offers.includes(offer)) {
      entry.offers.push(offer);
      entry.done = (entry.done || 0) + 1;
      await save(uid, entry);
    }
    send(res, 200, { ok: true });
  } catch {
    send(res, 502, { error: 'store' });
  }
};
