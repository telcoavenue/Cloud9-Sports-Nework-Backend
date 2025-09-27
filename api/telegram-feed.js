export default async function handler(req, res) {
  // CORS for GitHub Pages
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.BOT_TOKEN;               // set in Vercel
  const channelId = String(process.env.CHANNEL_ID);  // set in Vercel (e.g. -1002965563236)
  const channelUsername = process.env.CHANNEL_USERNAME || ''; // e.g. Cloud9 (no @)

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates?allowed_updates=["channel_post"]`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data.ok) throw new Error(JSON.stringify(data));

    const items = (data.result || [])
      .map(u => u.channel_post)
      .filter(p => p && String(p.chat?.id) === channelId)
      .map(p => ({
        id: p.message_id,
        text: p.text || p.caption || '',
        date: new Date((p.date || 0) * 1000).toISOString(),
        link: channelUsername ? `https://t.me/${channelUsername}/${p.message_id}` : ''
      }))
      .sort((a,b)=> new Date(b.date) - new Date(a.date))
      .slice(0, 50);

    res.status(200).json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message || 'fetch_failed' });
  }
}
