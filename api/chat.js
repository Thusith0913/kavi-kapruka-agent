export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ status: "Kavi API is live" });
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Method not allowed" } });

  try {
    const body = req.body;

    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: { message: "Invalid request — messages array required" } });
    }

    const messages = body.messages.filter(m => m && m.content && String(m.content).trim().length > 0);
    if (!messages.length) {
      return res.status(200).json({ content: [{ type: "text", text: "Ayubowan! How can I help you today?" }] });
    }

    const system = body.system || "You are Kavi, a Sri Lankan shopping assistant for Kapruka.com.";

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, 4000) }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.9 }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      const errMsg = data?.error?.message || `Gemini error ${response.status}`;
      console.error("Gemini error:", errMsg);
      return res.status(200).json({
        content: [{ type: "text", text: "Aiyo machan, I'm having a small technical issue! Please try again in a moment." }]
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      || data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("")
      || "Aiyo, something went wrong! Try again machan.";

    res.status(200).json({ content: [{ type: "text", text }] });

  } catch (err) {
    console.error("Handler error:", err.message);
    res.status(200).json({
      content: [{ type: "text", text: "Aiyo machan, small technical glitch! Please try again." }]
    });
  }
}
