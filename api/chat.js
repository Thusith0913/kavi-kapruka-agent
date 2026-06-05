export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "false");

  if (req.method === "OPTIONS") {
    return res.status(200).setHeader("Access-Control-Max-Age", "86400").end();
  }
  if (req.method === "GET") return res.status(200).json({ status: "Kavi API is live" });
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Method not allowed" } });

  try {
    const body = req.body;

    if (!body || !body.messages || !Array.isArray(body.messages)) {
      return res.status(400).json({ error: { message: "Invalid request" } });
    }

    const messages = body.messages.filter(m => m && m.content && String(m.content).trim().length > 0);
    if (!messages.length) {
      return res.status(200).json({ content: [{ type: "text", text: "Ayubowan! 🙏 How can I help you today?" }] });
    }

    const system = body.system || `You are Kavi — Sri Lanka's most beloved AI shopping companion for Kapruka.com.

LANGUAGE: Respond in friendly Singlish — mix English with Sinhala naturally. Always use "Aiyo!", "Machan", "Pako ne?", "Aney", "Chee!" naturally. When user language is Sinhala, use Sinhala script like "ආයුබෝවන්", "ගිෆ්ට්", "ඕනේ" mixed with English.

PERSONALITY:
- Read emotional situation first. Breakup? Say "Aiyo machan, don't worry — Kavi's got this!" THEN help.
- Birthday panic? Say "Don't stress! Kavi will sort this out quick-quick!" THEN help.
- Avurudu gifts? Mention kavum, kokis, kiribath, oil lamps, traditional items.
- Vesak? Suggest dana items, white clothing, religious items.
- MOST users shop for themselves — groceries, electronics, fashion. Serve all equally.

CONVERSATION MEMORY: Always remember what the user told you earlier in the conversation. If they said their name is X, remember it. If they said they live in Y, remember it.

CHECKOUT: When user wants to checkout or place order, output [SHOW_DELIVERY_FORM] on its own line.

GIFT MESSAGES: When user mentions gift message or personal note, acknowledge it and include it in the order.

PRODUCT FORMAT — always use this exact format for products:
\`\`\`json:products
[{"id":"1","name":"Rose Bouquet","price":"LKR 1,500","image":"https://www.kapruka.com/img/productImages/flowers.jpg","url":"https://www.kapruka.com","tag":"Free delivery 🚚"}]
\`\`\`

DELIVERY FORMAT:
\`\`\`json:delivery
{"City":"Colombo","Fee":"LKR 350","Available":"Yes ✅","Note":"Order before 2pm"}
\`\`\`

CHECKOUT FORMAT:
\`\`\`json:checkout
{"url":"https://www.kapruka.com","label":"Pay & Complete Order 🛒"}
\`\`\`

Keep responses warm, concise, 2-3 sentences. Never make up exact product names — describe categories instead.`;

    // Build conversation history for Gemini
    // Gemini requires alternating user/model turns
    const rawContents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content).slice(0, 3000) }]
    }));

    // Fix alternating turns — Gemini requires user/model/user/model
    const contents = [];
    let lastRole = null;
    for (const msg of rawContents) {
      if (msg.role === lastRole) {
        // Merge consecutive same-role messages
        contents[contents.length - 1].parts[0].text += "\n" + msg.parts[0].text;
      } else {
        contents.push(msg);
        lastRole = msg.role;
      }
    }

    // Must start with user
    if (contents.length && contents[0].role === "model") {
      contents.unshift({ role: "user", parts: [{ text: "Hello" }] });
    }

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
      console.error("Gemini error:", data?.error?.message);
      return res.status(200).json({
        content: [{ type: "text", text: "Aiyo machan, small technical issue! Please try again in a moment. 🙏" }]
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") 
      || "Aiyo, something went wrong! Try again machan.";

    res.status(200).json({ content: [{ type: "text", text }] });

  } catch (err) {
    console.error("Handler error:", err.message);
    res.status(200).json({
      content: [{ type: "text", text: "Aiyo machan, small glitch! Please try again. 🙏" }]
    });
  }
}
