// Vercel serverless function: GET /api/roblox?username=NAME -> { id, name, displayName, avatar }
// Roblox's APIs can't be called straight from a browser (no CORS), so the page asks this instead.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async (req, res) => {
  const send = (code, body) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', code === 200 ? 's-maxage=300' : 'no-store');
    res.end(JSON.stringify(body));
  };
  const username = (new URL(req.url, 'http://local').searchParams.get('username') || '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return send(400, { error: 'invalid' });

  try {
    const u = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    });
    if (!u.ok) return send(502, { error: 'roblox' });
    const user = ((await u.json()).data || [])[0];
    if (!user) return send(404, { error: 'not_found' });

    // a full-body avatar render; Roblox may still be drawing it the first time ("Pending"), so ask up to 3 times
    let avatar = null;
    for (let i = 0; i < 3 && !avatar; i++) {
      if (i) await wait(700);
      const t = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${user.id}&size=420x420&format=Png&isCircular=false`);
      const thumb = t.ok ? ((await t.json()).data || [])[0] : null;
      if (thumb && thumb.state === 'Completed') avatar = thumb.imageUrl;
    }
    send(200, { id: user.id, name: user.name, displayName: user.displayName, avatar });
  } catch {
    send(502, { error: 'roblox' });
  }
};
