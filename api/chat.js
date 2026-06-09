// ─── Kapruka MCP Client ───────────────────────────────────────────────────────
async function mcpCall(tool, params) {
  try {
    const initRes = await fetch("https://mcp.kapruka.com/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, clientInfo: { name: "kavi", version: "3.0" } }
      })
    });
    const sessionId = initRes.headers.get("mcp-session-id") || initRes.headers.get("x-session-id") || null;
    const headers = { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const toolRes = await fetch("https://mcp.kapruka.com/mcp", {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: params } })
    });
    const raw = await toolRes.text();
    console.log("MCP raw:", raw.slice(0, 400));
    let parsed = null;
    if (raw.includes("data:")) {
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const json = line.replace(/^data:\s*/, "").trim();
        if (!json || json === "[DONE]") continue;
        try { const obj = JSON.parse(json); if (obj?.result) { parsed = obj; break; } } catch {}
      }
    } else {
      try { parsed = JSON.parse(raw); } catch {}
    }
    return parsed?.result?.content?.[0]?.text || null;
  } catch (e) { console.error("MCP:", e.message); return null; }
}

// ─── Parse products with correct Kapruka field names ─────────────────────────
function parseProducts(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed.products || parsed.items || parsed.results || parsed.data || [];
    return items.slice(0, 6).map(p => ({
      id: String(p.id || p.product_id || p.productId || Math.random()),
      name: p.name || p.title || p.product_name || "Product",
      price: p.price ? `LKR ${Number(String(p.price).replace(/[^0-9.]/g,'')).toLocaleString()}` : p.formatted_price || "See price",
      // Kapruka confirmed: image_url is the correct field
      image: p.image_url || p.imageUrl || p.image || p.thumbnail || p.photo || "",
      url: p.url || p.product_url || p.link || `https://www.kapruka.com/product/${p.id || ""}`,
      tag: p.in_stock === false ? "Out of stock ❌" : p.same_day_delivery ? "Same day 🚀" : "Free delivery 🚚"
    }));
  } catch {
    const products = [];
    let cur = null;
    for (const line of raw.split("\n").filter(l => l.trim())) {
      if (/^\d+\.|^###?\s|^-\s+\*\*/.test(line)) {
        if (cur?.name) products.push(cur);
        cur = { id: String(Date.now() + products.length), name: line.replace(/^\d+\.\s*|#{1,3}\s*|\*\*|-\s*/g,"").trim().slice(0,60), price: "", image: "", url: "https://www.kapruka.com", tag: "Free delivery 🚚" };
      } else if (cur) {
        const pm = line.match(/(?:LKR|Rs\.?)\s*([\d,]+)/i); if (pm) cur.price = `LKR ${pm[1]}`;
        const iu = line.match(/image_url["\s:]+([^\s"',]+)/i); if (iu) cur.image = iu[1];
        const um = line.match(/https?:\/\/[^\s"',)]+kapruka[^\s"',)]+/); if (um && !um[0].includes("image")) cur.url = um[0];
      }
    }
    if (cur?.name) products.push(cur);
    return products.slice(0, 6);
  }
}

// ─── Intent detection ─────────────────────────────────────────────────────────
function detectIntent(messages) {
  const last = messages.filter(m=>m.role==="user").pop()?.content?.toLowerCase()||"";
  if (/track|order number|my order|where.*order|order.*status/i.test(last)) return "track";
  if (/reorder|order again|same as last|usual order|order my usual/i.test(last)) return "reorder";
  if (/deliver.*to|can.*deliver|ship.*to|delivery.*city/i.test(last)) return "delivery";
  if (/checkout|place.*order|buy.*now|pay.*now|complete.*order|want.*order/i.test(last)) return "checkout";
  if (/categor|browse|what.*sell|what.*have|what.*types/i.test(last)) return "categories";
  if (/show|find|search|get|want|need|looking|gift|flower|cake|food|electronic|fashion|grocery|fruit|phone|laptop|shirt|dress|chocolate|sweet|rice|vegetable|toy|perfume|jewel|watch|avurudu|vesak|book|cake|wine|beer/i.test(last)) return "search";
  return "chat";
}

function extractQuery(text) {
  return text.replace(/show me|find me|search for|i need|i want|looking for|get me|can you find|please|could you/gi,"")
    .replace(/under lkr \d+|lkr \d+|\bfor\b|\bsome\b|\ba\b|\bthe\b/gi,"").trim().slice(0,80) || "gifts";
}

function extractCity(text) {
  const cities = ["colombo","kandy","galle","negombo","jaffna","matara","kurunegala","anuradhapura","ratnapura","badulla","trincomalee","batticaloa","nuwara eliya","kalutara","gampaha","hambantota","polonnaruwa","kegalle","puttalam","ampara","vavuniya"];
  for (const c of cities) if (text.toLowerCase().includes(c)) return c.charAt(0).toUpperCase()+c.slice(1);
  return null;
}

function extractOrder(text) {
  const m = text.match(/[A-Z]{2,4}[-\s]?\d{4,10}|\d{6,10}/i);
  return m?m[0]:null;
}

// ─── Gemini call ──────────────────────────────────────────────────────────────
async function callGemini(messages, sys, key) {
  const contents = [];
  let lastRole = null;
  for (const m of messages) {
    const role = m.role==="assistant"?"model":"user";
    const text = String(m.content||"").slice(0,2000);
    if (!text.trim()) continue;
    if (role===lastRole) contents[contents.length-1].parts[0].text+="\n"+text;
    else { contents.push({role,parts:[{text}]}); lastRole=role; }
  }
  if (!contents.length||contents[0].role==="model") contents.unshift({role:"user",parts:[{text:"Hello"}]});
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
    { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ system_instruction:{parts:[{text:sys}]}, contents, generationConfig:{maxOutputTokens:800,temperature:0.9} }) }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("")||"";
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS,GET");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method==="GET") return res.status(200).json({status:"Kavi v3 live 🛍️"});
  if (req.method!=="POST") return res.status(405).end();

  try {
    const {messages, system} = req.body||{};
    if (!messages||!Array.isArray(messages))
      return res.status(200).json({content:[{type:"text",text:"Ayubowan! 🙏 Kavi this side — how can I help you today?"}]});

    const intent = detectIntent(messages);
    const lastMsg = messages.filter(m=>m.role==="user").pop()?.content||"";
    let products=[], deliveryInfo=null, trackingInfo=null, categories=null;

    // ── MCP calls ─────────────────────────────────────────────────────────────
    if (intent==="search") {
      const q = extractQuery(lastMsg);
      console.log("MCP search:", q);
      const raw = await mcpCall("kapruka_search_products", { q, limit:6, in_stock_only:true, sort:"popular" });
      if (raw) products = parseProducts(raw);
    } else if (intent==="delivery") {
      const city = extractCity(lastMsg);
      if (city) {
        deliveryInfo = await mcpCall("kapruka_check_delivery", { city, delivery_date: new Date(Date.now()+86400000).toISOString().split("T")[0] });
      } else {
        deliveryInfo = await mcpCall("kapruka_list_delivery_cities", { limit:20 });
      }
    } else if (intent==="track") {
      const num = extractOrder(lastMsg);
      if (num) trackingInfo = await mcpCall("kapruka_track_order", { order_number:num });
    } else if (intent==="categories") {
      categories = await mcpCall("kapruka_list_categories", { depth:2 });
    }

    // ── Build context ─────────────────────────────────────────────────────────
    let dataCtx = "";

    if (products.length>0) {
      dataCtx += `\n\nREAL KAPRUKA PRODUCTS — use these exactly:\n${products.map((p,i)=>`${i+1}. ${p.name} | ${p.price} | image: ${p.image}`).join("\n")}

After your bold 1-2 sentence opener, output EXACTLY this block:
\`\`\`json:products
${JSON.stringify(products)}
\`\`\``;
    }

    if (deliveryInfo) {
      const city = extractCity(lastMsg)||"Your city";
      dataCtx += `\n\nDELIVERY INFO:\n${deliveryInfo.slice(0,400)}\n\nOutput after summary:\n\`\`\`json:delivery\n{"City":"${city}","Details":"${deliveryInfo.slice(0,150).replace(/"/g,"'")}","Available":"Yes ✅"}\n\`\`\``;
    }
    if (trackingInfo) dataCtx += `\n\nTRACKING: ${trackingInfo.slice(0,400)}\nTell user status warmly.`;
    // Fix #31: Always provide categories
    const catList = categories || "Flowers 🌸, Cakes 🎂, Chocolates 🍫, Gift Hampers 🎁, Groceries 🛒, Electronics 📱, Fashion & Jewellery 👗, Fruits 🍎, Soft Toys 🧸, Books 📚, Health & Wellness 💊, Home & Lifestyle 🏠, Wine & Spirits 🍷, Sports 🏋️, Mother & Baby 👶";
    if (intent==="categories") dataCtx += `\n\nKAPRUKA CATEGORIES: ${catList}\nList all categories warmly and enthusiastically.`;
    else if (categories) dataCtx += `\n\nCATEGORIES: ${categories.slice(0,400)}`;
    if (intent==="checkout") dataCtx += `\n\nCRITICAL: User wants to checkout NOW. You MUST end your response with [SHOW_DELIVERY_FORM] on its own line. No exceptions. Say something warm then put [SHOW_DELIVERY_FORM] on a new line.`;
    if (intent==="reorder") dataCtx += `\n\nUser wants to reorder. Ask what they want to reorder — their last order, usual groceries, or a specific item. Be enthusiastic about how easy reordering is with Kavi!`;

    // Fix #47: Build context summary for better memory
    const contextSummary = messages.length > 2
      ? messages.slice(0,-1).map(m=>`${m.role}: ${String(m.content).slice(0,80)}`).join("\n")
      : "";

    const sys = system || `You are Kavi — Sri Lanka's most beloved AI shopping companion for Kapruka.com. You are warm, bold, opinionated, emotionally intelligent, and deeply Sri Lankan.

LANGUAGE: Singlish always — "Aiyo!", "Machan", "Aney", "Chee!" naturally. Never stiff or corporate.

MEMORY: Always remember everything from earlier in this conversation. Names, cities, preferences, cart items — remember them all.\${contextSummary ? `\n\nCONVERSATION HISTORY:\n\${contextSummary}` : ""}

PERSONALITY — BE BOLD AND OPINIONATED:
- You are not a search box. You are a best friend who knows what to buy.
- Push back when needed. If someone says "I messed up at home, need to send flowers to my wife" — say "Aiyo machan, don't send flowers to her — I'll send them to YOU, go give it to her yourself! That lands better, trust Kavi." THEN help.
- If someone asks for something overpriced, suggest better value. If they panic, calm them first.
- Read emotions FIRST. Always.
  - Breakup: "Aiyo machan so sorry! 💔 Okay listen, flowers are good but a handwritten note WITH the flowers? Chef's kiss. Let Kavi sort both."
  - Birthday panic: "Aiyo don't stress, Kavi's got this! 🎂 We'll sort you out in 2 minutes flat, promise."
  - Self-shopping: Be an excited friend. "Oh machan this one is so good value, I'd get it myself!"
- UPSELL naturally: "Machan while we're at it, want to add a card? Only LKR 200 extra and it makes the whole thing 10x better."
- REORDERING is powerful: Make it feel effortless. "Same as last time? One word and Kavi handles it!"
- Know Sri Lanka DEEPLY: Avurudu April 13, Vesak full moon, Poya days, kavum, kokis, kiribath, oil lamps, Sinhala New Year customs.
- Most users shop for THEMSELVES. Groceries, electronics, fashion, daily needs — not just gifts.
- Goal: customer places order in under 2 minutes without ever going to the Kapruka website.
- After helping, always offer: "Anything else machan, or shall we go to checkout?"
- Keep responses SHORT — 1-2 sentences then products. Never ramble.${dataCtx}`;

    let text = "";
    try {
      text = await callGemini(messages, sys, process.env.GEMINI_API_KEY);
    } catch(e) {
      console.error("Gemini:", e.message);
      text = products.length>0 ? "Aiyo machan, check these out! 🛍️" : "Aiyo machan, small issue! Try again. 🙏";
    }

    // Guarantee blocks present
    if (products.length>0 && !text.includes("json:products"))
      text += `\n\n\`\`\`json:products\n${JSON.stringify(products)}\n\`\`\``;
    if (deliveryInfo && !text.includes("json:delivery")) {
      const city = extractCity(lastMsg)||"City";
      text += `\n\n\`\`\`json:delivery\n${JSON.stringify({City:city,Details:deliveryInfo.slice(0,200),Available:"Yes ✅"})}\n\`\`\``;
    }

    return res.status(200).json({content:[{type:"text",text}]});
  } catch(err) {
    console.error("Error:", err.message);
    return res.status(200).json({content:[{type:"text",text:"Aiyo machan, small glitch! Try again. 🙏"}]});
  }
}
