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
