async function mcpCall(tool, params) {
  try {
    // Step 1: Initialize session
    const initRes = await fetch("https://mcp.kapruka.com/mcp", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          clientInfo: { name: "kavi", version: "2.0" }
        }
      })
    });

    // Extract session ID if present
    const sessionId = initRes.headers.get("mcp-session-id") || 
                      initRes.headers.get("x-session-id") || null;
    console.log("MCP session:", sessionId, "init status:", initRes.status);

    // Step 2: Call tool
    const headers = { 
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;

    const toolRes = await fetch("https://mcp.kapruka.com/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2,
        method: "tools/call",
        params: { name: tool, arguments: params }
      })
    });

    const raw = await toolRes.text();
    console.log("MCP raw response:", raw.slice(0, 300));

    // Parse SSE or plain JSON
    let parsed = null;
    if (raw.includes("data:")) {
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const json = line.replace(/^data:\s*/, "").trim();
        if (!json || json === "[DONE]") continue;
        try {
          const obj = JSON.parse(json);
          if (obj?.result) { parsed = obj; break; }
        } catch {}
      }
    } else {
      try { parsed = JSON.parse(raw); } catch {}
    }

    return parsed?.result?.content?.[0]?.text || null;
  } catch (e) {
    console.error("MCP error:", e.message);
    return null;
  }
}

// ─── Parse products using correct Kapruka MCP field names ────────────────────
function parseProducts(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed 
      : parsed.products || parsed.items || parsed.results || parsed.data || [];
    
    return items.slice(0, 6).map(p => ({
      id: String(p.id || p.product_id || p.productId || Math.random()),
      name: p.name || p.title || p.product_name || "Product",
      // Kapruka MCP uses image_url (confirmed in their FAQ email)
      price: p.price 
        ? `LKR ${Number(String(p.price).replace(/[^0-9.]/g,'')).toLocaleString()}` 
        : p.formatted_price || p.display_price || "See price",
      image: p.image_url || p.image || p.thumbnail || p.photo || p.img || "",
      url: p.url || p.product_url || p.link || `https://www.kapruka.com/product/${p.id}`,
      tag: p.in_stock === false ? "Out of stock ❌" 
        : p.same_day_delivery ? "Same day 🚀" 
        : "Free delivery 🚚"
    }));
  } catch {
    // Fallback: parse text format
    const products = [];
    let cur = null;
    for (const line of raw.split("\n").filter(l => l.trim())) {
      if (/^\d+\.|^###?\s|^-\s+\*\*/.test(line)) {
        if (cur?.name) products.push(cur);
        cur = { 
          id: String(Date.now() + products.length),
          name: line.replace(/^\d+\.\s*|#{1,3}\s*|\*\*|-\s*/g,"").trim().slice(0,60),
          price: "", image: "", url: "https://www.kapruka.com", tag: "Free delivery 🚚"
        };
      } else if (cur) {
        const pm = line.match(/(?:LKR|Rs\.?)\s*([\d,]+)/i); 
        if (pm) cur.price = `LKR ${pm[1]}`;
        // Look for image_url specifically (Kapruka's field)
        const iuMatch = line.match(/image_url["\s:]+([https?://][^\s"',]+)/i);
        if (iuMatch) cur.image = iuMatch[1];
        const um = line.match(/https?:\/\/[^\s"',)]+kapruka[^\s"',)]+/); 
        if (um && !um[0].includes("image")) cur.url = um[0];
      }
    }
    if (cur?.name) products.push(cur);
    return products.slice(0, 6);
  }
}

function detectIntent(messages) {
  const last = messages.filter(m=>m.role==="user").pop()?.content?.toLowerCase()||"";
  if (/track|order number|my order|where.*order/i.test(last)) return "track";
  if (/deliver.*to|can.*deliver|ship.*to|delivery.*city|deliver.*colombo|deliver.*kandy/i.test(last)) return "delivery";
  if (/checkout|place.*order|buy.*now|pay.*now|complete.*order|want.*order/i.test(last)) return "checkout";
  if (/categor|browse|what.*sell|what.*have|what.*types/i.test(last)) return "categories";
  if (/show|find|search|get|want|need|looking|gift|flower|cake|food|electronic|fashion|grocery|fruit|phone|laptop|shirt|dress|chocolate|sweet|rice|vegetable|toy|perfume|jewel|watch|avurudu|vesak|book/i.test(last)) return "search";
  return "chat";
}

function extractQuery(text) {
  return text
    .replace(/show me|find me|search for|i need|i want|looking for|get me|can you find|please|could you/gi,"")
    .replace(/under lkr \d+|lkr \d+|\bfor\b|\bsome\b|\ba\b|\bthe\b/gi,"")
    .trim().slice(0,80) || "gifts";
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
    {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        system_instruction:{parts:[{text:sys}]},
        contents,
        generationConfig:{maxOutputTokens:800,temperature:0.9}
      })
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("")||"";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS,GET");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method==="GET") return res.status(200).json({status:"Kavi live 🛍️",mcp:"kapruka connected"});
  if (req.method!=="POST") return res.status(405).end();

  try {
    const {messages, system} = req.body||{};
    if (!messages||!Array.isArray(messages))
      return res.status(200).json({content:[{type:"text",text:"Ayubowan! 🙏 How can I help?"}]});

    const intent = detectIntent(messages);
    const lastMsg = messages.filter(m=>m.role==="user").pop()?.content||"";
    let products=[], deliveryInfo=null, trackingInfo=null, categories=null;

    // ── Call Kapruka MCP ──────────────────────────────────────────────────────
    if (intent==="search") {
      const q = extractQuery(lastMsg);
      console.log("Searching Kapruka MCP:", q);
      const raw = await mcpCall("kapruka_search_products", { 
        q, limit:6, in_stock_only:true, sort:"popular" 
      });
      console.log("Products raw:", raw?.slice(0,200)||"null");
      if (raw) products = parseProducts(raw);
    } 
    else if (intent==="delivery") {
      const city = extractCity(lastMsg);
      if (city) {
        const tomorrow = new Date(Date.now()+86400000).toISOString().split("T")[0];
        const raw = await mcpCall("kapruka_check_delivery", {city, delivery_date:tomorrow});
        if (raw) deliveryInfo = raw;
      } else {
        const raw = await mcpCall("kapruka_list_delivery_cities", {limit:20});
        if (raw) deliveryInfo = raw;
      }
    }
    else if (intent==="track") {
      const num = extractOrder(lastMsg);
      if (num) {
        const raw = await mcpCall("kapruka_track_order", {order_number:num});
        if (raw) trackingInfo = raw;
      }
    }
    else if (intent==="categories") {
      const raw = await mcpCall("kapruka_list_categories", {depth:2});
      if (raw) categories = raw;
    }

    // ── Build prompt context ──────────────────────────────────────────────────
    let dataCtx = "";

    if (products.length>0) {
      dataCtx += `\n\nREAL KAPRUKA PRODUCTS (image_url field confirmed by Kapruka team):
${products.map((p,i)=>`${i+1}. ${p.name} | ${p.price} | img: ${p.image}`).join("\n")}

Write a warm 1-2 sentence intro then output EXACTLY:
\`\`\`json:products
${JSON.stringify(products)}
\`\`\``;
    }

    if (deliveryInfo) {
      const city = extractCity(lastMsg)||"Your city";
      dataCtx += `\n\nDELIVERY INFO FROM KAPRUKA:\n${deliveryInfo.slice(0,500)}\n\nSummarize warmly then output:\n\`\`\`json:delivery\n{"City":"${city}","Details":"${deliveryInfo.slice(0,200).replace(/"/g,"'")}","Available":"Yes ✅"}\n\`\`\``;
    }

    if (trackingInfo) {
      dataCtx += `\n\nORDER STATUS: ${trackingInfo.slice(0,400)}\nTell the user their order status warmly.`;
    }

    if (categories) {
      dataCtx += `\n\nKAPRUKA CATEGORIES: ${categories.slice(0,400)}\nDescribe what Kapruka sells in a friendly way.`;
    }

    if (intent==="checkout") {
      dataCtx += `\n\nUser wants to checkout. After your warm message, output on its own line:\n[SHOW_DELIVERY_FORM]`;
    }

    const sys = system || `You are Kavi — Sri Lanka's most beloved AI shopping companion for Kapruka.com. Warm, witty, emotionally intelligent, deeply culturally aware.

LANGUAGE: Always use Singlish — "Aiyo!", "Machan", "Pako ne?", "Aney", "Chee!" naturally mixed with English. Never be stiff or corporate.

PERSONALITY:
- Read emotions FIRST. 
  - Breakup: "Aiyo machan, so sorry! 💔 But flowers always say sorry better than words. Let Kavi help." THEN products.
  - Birthday panic: "Aiyo don't stress machan, Kavi's got this! 🎂 Quick-quick let's sort you out." THEN products.
  - Self-shopping: Be an enthusiastic knowledgeable friend who knows great deals.
- Recommend confidently: "Machan if I were you, definitely this one."
- Deep Sri Lankan culture: Avurudu (April 13), Vesak full moon, Poya days, kavum, kokis, kiribath, oil lamp traditions, New Year customs.
- Most users shop for THEMSELVES — groceries, electronics, fashion. Serve both gifting and self-shopping equally.
- 1-2 warm sentences then show products. Don't ramble.${dataCtx}`;

    // ── Get Gemini response ───────────────────────────────────────────────────
    let text = "";
    try {
      text = await callGemini(messages, sys, process.env.GEMINI_API_KEY);
    } catch(e) {
      console.error("Gemini error:", e.message);
      text = products.length>0 
        ? "Aiyo machan, check these out from Kapruka! 🛍️"
        : "Aiyo machan, small issue! Please try again. 🙏";
    }

    // Guarantee blocks are always present
    if (products.length>0 && !text.includes("json:products")) {
      text += `\n\n\`\`\`json:products\n${JSON.stringify(products)}\n\`\`\``;
    }
    if (deliveryInfo && !text.includes("json:delivery")) {
      const city = extractCity(lastMsg)||"Your city";
      text += `\n\n\`\`\`json:delivery\n${JSON.stringify({City:city,Details:deliveryInfo.slice(0,200),Available:"Yes ✅"})}\n\`\`\``;
    }

    return res.status(200).json({content:[{type:"text",text}]});

  } catch(err) {
    console.error("Handler error:", err.message);
    return res.status(200).json({content:[{type:"text",text:"Aiyo machan, small glitch! Try again. 🙏"}]});
  }
}
