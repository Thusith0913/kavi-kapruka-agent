export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { messages, system } = req.body;

    const contents = [];
    for (const m of messages) {
      contents.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system || "" }] },
          contents,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.9 }
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(JSON.stringify(err));
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Aiyo, something went wrong machan!";

    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (err) {
    console.error("Gemini error:", err.message);
    res.status(500).json({ error: { message: err.message } });
  }
}
