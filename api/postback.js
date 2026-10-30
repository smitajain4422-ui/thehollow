// GET /api/postback?key=SECRET&s1=ROBLOX_USER_ID&s2=TIER&tx=CONVERSION_ID&offer=OFFER_ID&payout=PAYOUT
// The CPA network calls this when a player finishes a quest. Put this URL in the network's postback settings, with
// the network's own macros in place of the capitals (and your POSTBACK_SECRET as key). A few common parameter
// names are accepted so it fits whatever the network sends.
const { TIERS, load, save, firstTime, fresh, credit, params, validUser } = require('../lib/rewards');

const pick = (q, names) => { for (const n of names) { const v = q.get(n); if (v) return v.trim(); } return ''; };
const text = (res, code, body) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
};

module.exports = async (req, res) => {
  const q = params(req);
  const secret = process.env.POSTBACK_SECRET;
  if (!secret) return text(res, 500, 'POSTBACK_SECRET is not set');
  if (pick(q, ['key', 'secret']) !== secret) return text(res, 403, 'bad key');

  const uid = pick(q, ['s1', 'sub1', 'subid', 'aff_sub']);
  const tier = Number(pick(q, ['s2', 'sub2', 'aff_sub2']));
  const tx = pick(q, ['tx', 'txid', 'transaction_id', 'lead_id', 'conversion_id']);
  const offer = pick(q, ['offer', 'offer_id', 'offerid', 'oid', 'campaign_id']);
  const status = pick(q, ['status']).toLowerCase();
  const payout = Number(pick(q, ['payout', 'amount']) || 0);
  // no Roblox id (the network's "test" button, or a conversion from some other locker): say 200 so the network
  // doesn't keep retrying, but don't hand out anything
  if (!validUser(uid)) {
    const seen = [...q].filter(([k]) => k !== 'key' && k !== 'secret').map(([k, v]) => k + '=' + v).join('&');
    console.warn('postback without a Roblox id, ignored:', seen);
    return text(res, 200, 'ignored: no player');
  }

  // chargebacks / reversals don't hand out boxes
  if (payout < 0 || ['0', '-1', 'reversed', 'rejected', 'chargeback'].includes(status)) return text(res, 200, 'ignored');

  try {
    const id = tx || (offer && uid + ':' + offer);
    if (id && !(await firstTime(id))) return text(res, 200, 'duplicate');
    const entry = (await load(uid)) || fresh();
    if (TIERS[tier]) entry.tier = tier;
    if (offer) entry.offers = [...entry.offers, offer].slice(-50);
    credit(entry, entry.tier);
    await save(uid, entry);
    console.log('postback', { uid, tier: entry.tier, tx, offer, payout, done: entry.done, owed: entry.owed });
    text(res, 200, 'ok');
  } catch (e) {
    console.error('postback failed', e);
    text(res, 502, 'store error: ' + String(e.message || e).slice(0, 200)); // a non-200 makes most networks retry later
  }
};
