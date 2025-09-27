
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.BOT_TOKEN;
  const channelId = String(process.env.CHANNEL_ID || "");
  const username = process.env.CHANNEL_USERNAME || "";

  try {
    if (!token || !channelId) {
      return res.status(500).json({
        error: "Missing BOT_TOKEN or CHANNEL_ID env var",
      });
    }

    // Test token validity
    const me = await fetch(
      `https://api.telegram.org/bot${token}/getMe`
    ).then((r) => r.json());
    if (!me.ok) {
      return res.status(401).json({
        error: "Invalid BOT_TOKEN",
        details: me,
      });
    }

    // Try fetching channel posts
    const updatesUrl = `https://api.telegram.org/bot${token}/getUpdates?allowed_updates=${encodeURIComponent(
      '["channel_post"]'
    )}`;
    let updates = await fetch(updatesUrl).then((r) => r.json());

    // Webhook conflict → clear webhook once and retry
    if (!updates.ok && updates.error_code === 409) {
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
      updates = await fetch(updatesUrl).then((r) => r.json());
    }

    if (!updates.ok) {
      return res.status(500).json({
        error: "Telegram getUpdates failed",
        details: updates,
      });
    }

    const items = (updates.result || [])
      .map((u) => u.channel_post)
      .filter((p) => p && String(p.chat?.id) === channelId)
      .map((p) => ({
        id: p.message_id,
        text: p.text || p.caption || "",
        date: new Date((p.date || 0) * 1000).toISOString(),
        link: username ? `https://t.me/${username}/${p.message_id}` : "",
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 50);

    if (!items.length) {
      return res.status(200).json({
        items: [],
        hint: "No posts found. Ensure bot is Admin, post a NEW message after that, and verify CHANNEL_ID starts with -100.",
      });
    }

    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({
      error: e.message || "fetch_failed",
    });
  }
}

