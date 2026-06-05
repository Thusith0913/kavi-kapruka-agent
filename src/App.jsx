import { useState, useRef, useEffect, useCallback } from "react";

// ─── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0f0c0a; --surface:#1a1612; --card:#231e19; --border:#2e271f;
    --saffron:#f5a623; --coral:#e8614a; --teal:#2ec4b6; --green:#4caf7d;
    --cream:#f7f0e6; --muted:#7a6e64; --text:#ede4d8; --glow:rgba(245,166,35,0.15);
    --red:#e85a4a;
  }
  html,body,#root{height:100%;width:100%;overflow:hidden;}
  body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;font-size:15px;line-height:1.6;}
  .app{display:flex;flex-direction:column;height:100vh;width:100vw;overflow:hidden;}
  .header{display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;z-index:20;}
  .header-logo{font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:var(--saffron);}
  .header-logo span{color:var(--coral);}
  .header-sub{font-size:11px;color:var(--muted);font-weight:300;}
  .header-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
  .cart-btn{display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:50px;padding:6px 14px;cursor:pointer;font-size:13px;color:var(--text);transition:all 0.2s;position:relative;}
  .cart-btn:hover{border-color:var(--saffron);color:var(--saffron);}
  .cart-count{background:var(--coral);color:#fff;font-size:10px;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;position:absolute;top:-6px;right:-6px;}
  .lang-toggle{display:flex;gap:4px;}
  .lang-btn{padding:4px 10px;border-radius:50px;border:1px solid var(--border);font-size:11px;cursor:pointer;background:transparent;color:var(--muted);transition:all 0.2s;}
  .lang-btn.active{border-color:var(--saffron);color:var(--saffron);background:var(--glow);}
  .main{display:flex;flex:1;overflow:hidden;}
  .chat-area{display:flex;flex-direction:column;flex:1;overflow:hidden;}
  .cart-panel{width:300px;border-left:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;flex-shrink:0;transition:width 0.3s;overflow:hidden;}
  .cart-panel.closed{width:0;}
  .cart-header{padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .cart-title{font-family:'Playfair Display',serif;font-size:16px;color:var(--cream);}
  .cart-close{background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:2px;}
  .cart-items{flex:1;overflow-y:auto;padding:12px;}
  .cart-items::-webkit-scrollbar{width:3px;}
  .cart-items::-webkit-scrollbar-thumb{background:var(--border);}
  .cart-empty{text-align:center;color:var(--muted);padding:40px 20px;font-size:14px;}
  .cart-item{display:flex;gap:10px;padding:10px;background:var(--card);border-radius:10px;margin-bottom:8px;border:1px solid var(--border);}
  .cart-item-img{width:48px;height:48px;object-fit:cover;border-radius:6px;background:#1a1612;flex-shrink:0;}
  .cart-item-info{flex:1;min-width:0;}
  .cart-item-name{font-size:12px;color:var(--text);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .cart-item-price{font-size:12px;color:var(--saffron);font-weight:600;margin-top:2px;}
  .cart-item-qty{display:flex;align-items:center;gap:6px;margin-top:4px;}
  .qty-btn{width:20px;height:20px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .qty-btn:hover{border-color:var(--saffron);color:var(--saffron);}
  .qty-num{font-size:12px;color:var(--muted);}
  .cart-footer{padding:16px;border-top:1px solid var(--border);flex-shrink:0;}
  .cart-total{display:flex;justify-content:space-between;margin-bottom:12px;font-size:14px;}
  .cart-total-label{color:var(--muted);}
  .cart-total-amount{color:var(--saffron);font-weight:700;font-size:16px;}
  .cart-checkout-btn{width:100%;padding:12px;background:linear-gradient(135deg,var(--saffron),var(--coral));color:#0f0c0a;border:none;border-radius:50px;font-weight:700;font-size:14px;cursor:pointer;transition:opacity 0.2s;}
  .cart-checkout-btn:hover{opacity:0.9;}
  .cart-checkout-btn:disabled{opacity:0.4;cursor:default;}
  .gift-note-area{margin-bottom:12px;}
  .gift-note-label{font-size:11px;color:var(--muted);margin-bottom:4px;display:flex;align-items:center;gap:4px;}
  .gift-note-input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:12px;resize:none;outline:none;transition:border-color 0.2s;}
  .gift-note-input:focus{border-color:var(--saffron);}
  .delivery-date-area{margin-bottom:12px;}
  .delivery-date-input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:12px;outline:none;transition:border-color 0.2s;color-scheme:dark;}
  .delivery-date-input:focus{border-color:var(--teal);}
  .messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:18px;scroll-behavior:smooth;}
  .messages::-webkit-scrollbar{width:4px;}
  .messages::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}
  .msg-row{display:flex;gap:10px;animation:fadeUp 0.3s ease both;}
  .msg-row.user{flex-direction:row-reverse;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .avatar{width:34px;height:34px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;}
  .avatar.agent{background:linear-gradient(135deg,var(--saffron),var(--coral));color:#0f0c0a;font-family:'Playfair Display',serif;}
  .avatar.user{background:var(--card);border:1px solid var(--border);color:var(--teal);font-size:12px;}
  .bubble{max-width:min(500px,78vw);padding:11px 15px;border-radius:16px;line-height:1.65;font-size:14px;}
  .bubble.agent{background:var(--card);border:1px solid var(--border);border-top-left-radius:4px;color:var(--text);}
  .bubble.user{background:linear-gradient(135deg,#2a1f10,#1e1610);border:1px solid var(--saffron);border-top-right-radius:4px;color:var(--cream);}
  .bubble p{margin-bottom:6px;} .bubble p:last-child{margin-bottom:0;}
  .bubble strong{color:var(--saffron);}
  .bubble em{color:var(--teal);font-style:normal;}
  .bubble a{color:var(--teal);text-decoration:none;} .bubble a:hover{text-decoration:underline;}
  .typing-dots{display:flex;gap:4px;padding:2px 0;align-items:center;}
  .typing-dots span{width:6px;height:6px;background:var(--muted);border-radius:50%;animation:bounce 1.2s infinite;}
  .typing-dots span:nth-child(2){animation-delay:.2s;} .typing-dots span:nth-child(3){animation-delay:.4s;}
  @keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4;}30%{transform:translateY(-4px);opacity:1;}}
  .products-carousel{display:flex;gap:10px;overflow-x:auto;padding:10px 0 6px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;max-width:520px;}
  .products-carousel::-webkit-scrollbar{height:3px;}
  .products-carousel::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
  .product-card{min-width:150px;max-width:150px;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform 0.2s,border-color 0.2s,box-shadow 0.2s;scroll-snap-align:start;flex-shrink:0;}
  .product-card:hover{transform:translateY(-2px);border-color:var(--saffron);box-shadow:0 6px 20px var(--glow);}
  .product-card img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#1a1612;}
  .product-card-body{padding:8px 10px;}
  .product-card-name{font-size:12px;font-weight:500;color:var(--text);line-height:1.3;margin-bottom:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
  .product-card-price{font-size:12px;font-weight:700;color:var(--saffron);}
  .product-card-tag{font-size:10px;color:var(--teal);margin-top:1px;}
  .add-to-cart-btn{width:100%;padding:5px;background:var(--surface);border:none;border-top:1px solid var(--border);color:var(--muted);font-size:11px;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;}
  .add-to-cart-btn:hover{background:var(--glow);color:var(--saffron);}
  .add-to-cart-btn.added{background:rgba(76,175,125,0.15);color:var(--green);}
  .delivery-card{background:linear-gradient(135deg,#0e1f1e,#0a1a19);border:1px solid var(--teal);border-radius:12px;padding:12px 14px;margin-top:8px;max-width:320px;}
  .delivery-card-title{font-size:11px;font-weight:600;color:var(--teal);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;}
  .delivery-row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid rgba(46,196,182,.1);}
  .delivery-row:last-child{border-bottom:none;}
  .delivery-row label{color:var(--muted);}
  .checkout-btn{display:inline-flex;align-items:center;gap:8px;margin-top:10px;padding:10px 20px;background:linear-gradient(135deg,var(--saffron),var(--coral));color:#0f0c0a;font-weight:700;font-size:13px;border-radius:50px;text-decoration:none;transition:opacity 0.2s,transform 0.2s;border:none;cursor:pointer;}
  .checkout-btn:hover{opacity:.9;transform:scale(1.02);}
  .suggestions{display:flex;flex-wrap:wrap;gap:7px;padding:0 20px 10px;flex-shrink:0;}
  .suggestion-chip{padding:6px 13px;border:1px solid var(--border);border-radius:50px;font-size:12px;color:var(--muted);cursor:pointer;background:var(--surface);transition:all 0.2s;white-space:nowrap;}
  .suggestion-chip:hover{border-color:var(--saffron);color:var(--saffron);background:var(--glow);}
  .input-bar{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0;align-items:flex-end;}
  .input-field{flex:1;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:10px 18px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;transition:border-color 0.2s;resize:none;max-height:100px;min-height:40px;line-height:1.5;}
  .input-field::placeholder{color:var(--muted);}
  .input-field:focus{border-color:var(--saffron);}
  .send-btn{width:42px;height:42px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--saffron),var(--coral));color:#0f0c0a;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.2s,transform 0.2s;}
  .send-btn:hover:not(:disabled){opacity:.9;transform:scale(1.05);}
  .send-btn:disabled{opacity:.4;cursor:default;}
  .welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 20px;flex:1;gap:14px;}
  .welcome-icon{font-size:48px;}
  .welcome h1{font-family:'Playfair Display',serif;font-size:clamp(24px,4.5vw,36px);font-weight:900;color:var(--cream);line-height:1.2;}
  .welcome h1 span{color:var(--saffron);}
  .welcome-sinhala{font-size:18px;color:var(--muted);font-weight:300;}
  .welcome p{color:var(--muted);max-width:380px;font-size:14px;font-weight:300;}
  .welcome-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px;max-width:480px;}
  .welcome-chip{padding:8px 16px;border:1px solid var(--border);border-radius:50px;font-size:13px;color:var(--text);cursor:pointer;background:var(--card);transition:all 0.2s;}
  .welcome-chip:hover{border-color:var(--saffron);color:var(--saffron);background:var(--glow);transform:translateY(-2px);}
  .error-bubble{background:rgba(232,97,74,.1);border:1px solid var(--coral);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--coral);margin-top:6px;max-width:380px;}
`;

function parseResponse(text) {
  const get = (tag) => {
    const m = text.match(new RegExp("```json:" + tag + "\\n([\\s\\S]*?)```"));
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
  };
  const prose = text.replace(/```json:\w+[\s\S]*?```/g, "").trim();
  return { prose, products: get("products"), delivery: get("delivery"), checkout: get("checkout") };
}

function renderProse(text) {
  return text.split("\n").filter(l => l.trim()).map((line, i) => {
    const html = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
  });
}

function useCart() {
  const [items, setItems] = useState([]);
  const add = (product) => setItems(prev => {
    const ex = prev.find(i => i.id === product.id);
    if (ex) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
    return [...prev, { ...product, qty: 1 }];
  });
  const remove = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const changeQty = (id, delta) => setItems(prev =>
    prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i).filter(i => i.qty > 0)
  );
  const total = items.reduce((sum, i) => {
    const n = parseFloat((i.price || "").replace(/[^0-9.]/g, "")) || 0;
    return sum + n * i.qty;
  }, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return { items, add, remove, changeQty, total, count };
}

const buildSystem = (lang) => `You are Kavi — Sri Lanka's most beloved AI shopping companion for Kapruka.com. You are warm, witty, emotionally intelligent, and deeply culturally aware.

${lang === "si" ? `LANGUAGE: Respond primarily in Sinhala mixed with English (Singlish). Use Sinhala script naturally. Example: "ආයුබෝවන්! 🙏 Machan, mokakda gift eka? Budget eka kiyannako!"` : `LANGUAGE: Respond in friendly Tanglish/Singlish — mix English with occasional Sinhala words naturally. Use "Aiyo!", "Machan", "Pako ne?", "Chee!", "Aney", "Boru ne?" where it fits. Not forced, just natural Sri Lankan warmth.`}

PERSONALITY:
- Read the emotional situation. Someone stressed? Calm them. Breakup? Sympathy first, then flowers. Birthday panic? "Don't worry, Kavi's got this!"
- Have opinions. Don't just list — recommend. "If I were you, I'd go with this one."
- Add local flavour: mention Avurudu, Vesak, Poya days, local customs when relevant.
- Remember: MOST users are shopping for THEMSELVES (groceries, electronics, fashion, daily needs) — not just gifting. Serve both modes equally well.

MCP TOOLS AVAILABLE:
- kapruka_search_products: search by keyword, category, price, stock, sort
- kapruka_get_product: full details by product ID
- kapruka_list_categories: browse categories
- kapruka_list_delivery_cities: find delivery cities
- kapruka_check_delivery: check delivery availability, cost, date
- kapruka_create_order: create guest checkout order with pay link (supports cart[], recipient, delivery, gift_message)
- kapruka_track_order: track by order number

FORMATTING — always embed structured data as JSON blocks:

For products:
\`\`\`json:products
[{"id":"123","name":"Product Name","price":"LKR 1,200","image":"https://...","url":"https://kapruka.com/...","tag":"Free delivery 🚚"}]
\`\`\`

For delivery info:
\`\`\`json:delivery
{"City":"Colombo","Date":"2026-06-10","Fee":"LKR 350","Available":"Yes ✅","Note":"Order before 2pm"}
\`\`\`

For checkout:
\`\`\`json:checkout
{"url":"https://kapruka.com/pay/...","label":"Pay & Complete Order 🛒"}
\`\`\`

Keep prose concise: 2-3 sentences, warm and human. Never make up product names or prices.`;

function ProductCarousel({ products, onAddToCart, cartItems }) {
  if (!products?.length) return null;
  return (
    <div className="products-carousel">
      {products.map(p => {
        const inCart = cartItems.some(i => i.id === p.id);
        return (
          <div key={p.id} className="product-card">
            {p.image && <img src={p.image} alt={p.name} loading="lazy" />}
            <div className="product-card-body">
              <div className="product-card-name">{p.name}</div>
              <div className="product-card-price">{p.price}</div>
              {p.tag && <div className="product-card-tag">{p.tag}</div>}
            </div>
            <button className={`add-to-cart-btn ${inCart ? "added" : ""}`} onClick={() => onAddToCart(p)}>
              {inCart ? "✓ Added" : "+ Add to cart"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DeliveryCard({ delivery }) {
  if (!delivery) return null;
  return (
    <div className="delivery-card">
      <div className="delivery-card-title">🚚 Delivery Info</div>
      {Object.entries(delivery).map(([k, v]) => (
        <div className="delivery-row" key={k}><label>{k}</label><span>{v}</span></div>
      ))}
    </div>
  );
}

function CartPanel({ cart, open, onClose, onCheckout, loading }) {
  const [giftNote, setGiftNote] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const today = new Date().toISOString().split("T")[0];
  return (
    <div className={`cart-panel ${open ? "" : "closed"}`}>
      <div className="cart-header">
        <div className="cart-title">🛒 Your Cart</div>
        <button className="cart-close" onClick={onClose}>✕</button>
      </div>
      <div className="cart-items">
        {cart.items.length === 0 ? (
          <div className="cart-empty">Your cart is empty.<br />Ask Kavi to find something! 🛍️</div>
        ) : cart.items.map(item => (
          <div key={item.id} className="cart-item">
            {item.image && <img className="cart-item-img" src={item.image} alt={item.name} />}
            <div className="cart-item-info">
              <div className="cart-item-name">{item.name}</div>
              <div className="cart-item-price">{item.price}</div>
              <div className="cart-item-qty">
                <button className="qty-btn" onClick={() => cart.changeQty(item.id, -1)}>−</button>
                <span className="qty-num">{item.qty}</span>
                <button className="qty-btn" onClick={() => cart.changeQty(item.id, 1)}>+</button>
                <button className="qty-btn" onClick={() => cart.remove(item.id)} style={{marginLeft:"auto",color:"var(--coral)"}}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {cart.items.length > 0 && (
        <div className="cart-footer">
          <div className="delivery-date-area">
            <div className="gift-note-label">📅 Delivery Date</div>
            <input type="date" className="delivery-date-input" min={today} value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
          <div className="gift-note-area">
            <div className="gift-note-label">💌 Gift Message <span style={{color:"var(--muted)"}}>(optional)</span></div>
            <textarea className="gift-note-input" rows={2} placeholder="Add a personal note..." value={giftNote} onChange={e => setGiftNote(e.target.value)} />
          </div>
          <div className="cart-total">
            <span className="cart-total-label">Total</span>
            <span className="cart-total-amount">LKR {cart.total.toLocaleString()}</span>
          </div>
          <button className="cart-checkout-btn" disabled={loading} onClick={() => onCheckout(giftNote, deliveryDate)}>
            {loading ? "Creating order..." : "Checkout →"}
          </button>
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="msg-row">
      <div className="avatar agent">K</div>
      <div className="bubble agent"><div className="typing-dots"><span/><span/><span/></div></div>
    </div>
  );
}

const WELCOME_CHIPS = [
  "💔 I just broke up with someone — flowers?",
  "🎂 Last-minute birthday gift under LKR 3,000",
  "🛒 I need groceries delivered today",
  "📱 Show me electronics deals",
  "🌸 Vesak dana items",
  "👗 Women's fashion under LKR 2,500",
  "📦 Track my order",
  "🎊 Avurudu gift basket ideas",
];

const CHAT_CHIPS = [
  "🛒 Add more items", "💰 Show cheaper options",
  "🚚 Check delivery", "💌 Add gift message",
  "📅 Change delivery date", "⭐ Show best sellers",
];

export default function KaprukaAgent() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const cart = useCart();

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const callAPI = useCallback(async (history) => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: buildSystem(lang),
        messages: history,
        mcp_servers: [{ type: "url", url: "https://mcp.kapruka.com/mcp", name: "kapruka" }],
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  }, [lang]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);
    try {
      const reply = await callAPI(newHistory);
      setMessages([...newHistory, { role: "assistant", content: reply || "Aiyo, something went wrong! Try again machan." }]);
    } catch (err) {
      setMessages([...newHistory, { role: "assistant", content: `__error__: ${err.message}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, loading, callAPI]);

  const handleCartCheckout = useCallback(async (giftNote, deliveryDate) => {
    if (!cart.items.length) return;
    setCheckoutLoading(true);
    const cartSummary = cart.items.map(i => `${i.qty}x ${i.name} (${i.price})`).join(", ");
    const prompt = `Please create a checkout order for my cart: ${cartSummary}.${deliveryDate ? ` Delivery date: ${deliveryDate}.` : ""}${giftNote ? ` Gift message: "${giftNote}".` : ""} Use kapruka_create_order and give me the pay link.`;
    await sendMessage(prompt);
    setCheckoutLoading(false);
    setCartOpen(false);
  }, [cart, sendMessage]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const isWelcome = messages.length === 0;

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="header-logo">Kavi<span>.</span></div>
          <div className="header-sub">Kapruka AI Shopping Agent</div>
        </div>
        <div className="header-right">
          <div className="lang-toggle">
            <button className={`lang-btn ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>EN</button>
            <button className={`lang-btn ${lang === "si" ? "active" : ""}`} onClick={() => setLang("si")}>සිං</button>
          </div>
          <button className="cart-btn" onClick={() => setCartOpen(o => !o)}>
            🛒 Cart
            {cart.count > 0 && <span className="cart-count">{cart.count}</span>}
          </button>
        </div>
      </div>
      <div className="main">
        <div className="chat-area">
          {isWelcome ? (
            <div className="welcome">
              <div className="welcome-icon">🛍️</div>
              <h1>Shop <span>Sri Lanka</span>,<br />the smart way.</h1>
              <div className="welcome-sinhala">ආයුබෝවන්! 🙏</div>
              <p>I'm Kavi — your warm, witty Kapruka companion. Gifts, groceries, electronics, fashion — I've got you, machan.</p>
              <div className="welcome-chips">
                {WELCOME_CHIPS.map(s => (
                  <button key={s} className="welcome-chip" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages">
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isError = msg.content?.startsWith("__error__:");
                if (isError) return (
                  <div key={i} className="msg-row">
                    <div className="avatar agent">K</div>
                    <div className="error-bubble">⚠️ {msg.content.replace("__error__: ", "")}</div>
                  </div>
                );
                if (isUser) return (
                  <div key={i} className="msg-row user">
                    <div className="avatar user">You</div>
                    <div className="bubble user">{msg.content}</div>
                  </div>
                );
                const { prose, products, delivery, checkout } = parseResponse(msg.content);
                return (
                  <div key={i} className="msg-row">
                    <div className="avatar agent">K</div>
                    <div>
                      {prose && <div className="bubble agent">{renderProse(prose)}</div>}
                      <ProductCarousel products={products} onAddToCart={(p) => { cart.add(p); setCartOpen(true); }} cartItems={cart.items} />
                      <DeliveryCard delivery={delivery} />
                      {checkout?.url && (
                        <a className="checkout-btn" href={checkout.url} target="_blank" rel="noopener noreferrer">
                          🛒 {checkout.label || "Complete Your Order"}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
          {!isWelcome && !loading && (
            <div className="suggestions">
              {CHAT_CHIPS.map(s => (
                <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          )}
          <div className="input-bar">
            <textarea
              ref={inputRef}
              className="input-field"
              placeholder={lang === "si" ? "Kavi kiyannam... (Type in Sinhala or English)" : "Ask Kavi anything — gifts, groceries, electronics, tracking..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              rows={1}
            />
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>➤</button>
          </div>
        </div>
        <CartPanel cart={cart} open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCartCheckout} loading={checkoutLoading} />
      </div>
    </div>
  );
}
