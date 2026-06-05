async function mcpCall(tool, params) {
  try {
    const res = await fetch("https://mcp.kapruka.com/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: tool, arguments: params } })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.content?.[0]?.text || null;
  } catch (e) { console.error("MCP:", e.message); return null; }
}

function parseProducts(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed.products || parsed.items || [];
    return items.slice(0, 6).map(p => ({
      id: String(p.id || p.product_id || Math.random()),
      name: p.name || p.title || "Product",
      price: p.price ? `LKR ${Number(p.price).toLocaleString()}` : p.formatted_price || "See price",
      image: p.image || p.image_url || p.thumbnail || "",
      url: p.url || p.product_url || "https://www.kapruka.com",
      tag: p.in_stock === false ? "Out of stock" : "Free delivery 🚚"
    }));
  } catch {
    const products = [];
    const lines = raw.split("\n").filter(l => l.trim());
    let cur = null;
    for (const line of lines) {
      if (line.match(/^\d+\.|^##|^\*\*/)) {
        if (cur && cur.name) products.push(cur);
        cur = { id: String(Date.now() + products.length), name: line.replace(/^\d+\.\s*|#{1,3}\s*|\*\*/g,"").trim().slice(0,60), price: "", image: "", url: "https://www.kapruka.com", tag: "Free delivery 🚚" };
      } else if (cur) {
        const pm = line.match(/LKR[\s]*([\d,]+)/i); if (pm) cur.price = `LKR ${pm[1]}`;
        const um = line.match(/https?:\/\/[^\s)\]]+kapruka[^\s)\]]+/); if (um) cur.url = um[0];
        const im = line.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/); if (im) cur.image = im[1];
      }
    }
    if (cur && cur.name) products.push(cur);
    return products.slice(0, 6);
  }
}

function detectIntent(messages) {
  const last = messages.filter(m => m.role === "user").pop()?.content?.toLowerCase() || "";
  if (/track|order number|where.*order|order.*status/i.test(last)) return "track";
  if (/deliver.*to|can.*deliver|delivery.*city|ship.*to/i.test(last)) return "delivery";
  if (/checkout|place.*order|buy.*now|pay.*now|complete.*order/i.test(last)) return "checkout";
  if (/categor|browse|what.*sell|what.*have/i.test(last)) return "categories";
  if (/show|find|search|get|want|need|looking|gift|flower|cake|food|electronic|fashion|grocery|fruit|phone|laptop|shirt|dress|chocolate|sweet|rice|vegetable/i.test(last)) return "search";
  return "chat";
}

function extractQuery(text) {
  return text.replace(/show me|find|search for|i need|i want|looking for|get me|can you find|please show/gi,"").replace(/please|under lkr \d+|lkr \d+|\bfor\b|\bsome\b|\ba\b|\bthe\b/gi,"").trim().slice(0,80) || "gifts";
}

function extractCity(text) {
  const cities = ["colombo","kandy","galle","negombo","jaffna","matara","kurunegala","anuradhapura","ratnapura","badulla","trincomalee","batticaloa","nuwara eliya","kalutara","gampaha","hambantota","polonnaruwa","kegalle","puttalam","ampara"];
  for (const c of cities) { if (text.toLowerCase().includes(c)) return c.charAt(0).toUpperCase()+c.slice(1); }
  return null;
}

function extractOrder(text) { const m = text.match(/[A-Z]{2,4}[-\s]?\d{4,10}|\d{6,10}/i); return m?m[0]:null; }

async function callGemini(messages, sys, key) {
  const contents = [];
  let last = null;
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    const text = String(m.content||"").slice(0,2000);
    if (!text.trim()) continue;
    if (role === last) contents[contents.length-1].parts[0].text += "\n"+text;
    else { contents.push({role, parts:[{text}]}); last = role; }
  }
  if (!contents.length || contents[0].role === "model") contents.unshift({role:"user",parts:[{text:"Hello"}]});
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ system_instruction:{parts:[{text:sys}]}, contents, generationConfig:{maxOutputTokens:800,temperature:0.9} })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("") || "";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS,GET");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method==="GET") return res.status(200).json({status:"Kavi live",mcp:"connected"});
  if (req.method!=="POST") return res.status(405).end();

  try {
    const {messages, system} = req.body||{};
    if (!messages||!Array.isArray(messages)) return res.status(200).json({content:[{type:"text",text:"Ayubowan! 🙏 How can I help?"}]});

    const intent = detectIntent(messages);
    const lastMsg = messages.filter(m=>m.role==="user").pop()?.content||"";
    let products=[], deliveryInfo=null, trackingInfo=null, categories=null;

    if (intent==="search") {
      const q = extractQuery(lastMsg);
      console.log("Search:", q);
      const raw = await mcpCall("kapruka_search_products", {q, limit:6, in_stock_only:true});
      if (raw) products = parseProducts(raw);
    } else if (intent==="delivery") {
      const city = extractCity(lastMsg);
      if (city) {
        deliveryInfo = await mcpCall("kapruka_check_delivery", {city, delivery_date: new Date(Date.now()+86400000).toISOString().split("T")[0]});
      } else {
        deliveryInfo = await mcpCall("kapruka_list_delivery_cities", {query:lastMsg.slice(0,30),limit:10});
      }
    } else if (intent==="track") {
      const num = extractOrder(lastMsg);
      if (num) trackingInfo = await mcpCall("kapruka_track_order", {order_number:num});
    } else if (intent==="categories") {
      categories = await mcpCall("kapruka_list_categories", {depth:1});
    }

    let dataCtx = "";
    if (products.length>0) {
      dataCtx += `\n\nREAL KAPRUKA PRODUCTS (use these exact details):\n${products.map((p,i)=>`${i+1}. ${p.name} | ${p.price}`).join("\n")}\n\nAfter your 1-2 sentence intro, output EXACTLY:\n\`\`\`json:products\n${JSON.stringify(products)}\n\`\`\``;
    }
    if (deliveryInfo) {
      dataCtx += `\n\nDELIVERY INFO FROM KAPRUKA:\n${deliveryInfo.slice(0,400)}\n\nSummarize warmly then output:\n\`\`\`json:delivery\n{"Details":"${deliveryInfo.slice(0,150).replace(/"/g,"'")}","City":"${extractCity(lastMsg)||"Your city"}"}\n\`\`\``;
    }
    if (trackingInfo) dataCtx += `\n\nTRACKING RESULT:\n${trackingInfo.slice(0,400)}\nTell user their order status warmly.`;
    if (categories) dataCtx += `\n\nCATEGORIES:\n${categories.slice(0,300)}\nTell user what Kapruka sells.`;
    if (intent==="checkout") dataCtx += `\n\nUser wants to checkout. After your message output: [SHOW_DELIVERY_FORM]`;

    const sys = system||`You are Kavi — Sri Lanka's most beloved AI shopping companion for Kapruka.com. Warm, witty, emotionally intelligent.

LANGUAGE: Always use Singlish — "Aiyo!", "Machan", "Pako ne?", "Aney", "Chee!" naturally mixed with English.

PERSONALITY: Read emotions first. Breakup? Sympathy then flowers. Panic? "Don't stress machan, Kavi's got this!" then help. Know Avurudu, Vesak, kavum, kokis. Most users shop for themselves.

Keep responses 2-3 sentences warm and concise.${dataCtx}`;

    let text = "";
    try {
      text = await callGemini(messages, sys, process.env.GEMINI_API_KEY);
    } catch(e) {
      console.error("Gemini:", e.message);
      text = products.length>0 ? "Aiyo machan, check these out from Kapruka! 🛍️" : "Aiyo machan, small issue! Try again. 🙏";
    }

    if (products.length>0 && !text.includes("json:products")) text += `\n\n\`\`\`json:products\n${JSON.stringify(products)}\n\`\`\``;
    if (deliveryInfo && !text.includes("json:delivery")) text += `\n\n\`\`\`json:delivery\n${JSON.stringify({City:extractCity(lastMsg)||"City",Details:deliveryInfo.slice(0,200)})}\n\`\`\``;

    res.status(200).json({content:[{type:"text",text}]});
  } catch(err) {
    console.error("Error:", err.message);
    res.status(200).json({content:[{type:"text",text:"Aiyo machan, small glitch! Try again. 🙏"}]});
  }
}
