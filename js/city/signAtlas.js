/* =====================================================================
   Neon sign atlas
   All sign text is rendered once, in code, into a single 2048px texture.
     R channel = crisp glyph core (the hot glass tube)
     G channel = soft halo around the glyphs
     B channel = per-character id (so single letters can fail, like
                 the broken "LOVE H" sign in the references)
   Japanese words carry meaning for those who can read them:
     静寂 silence · 再接続 reconnection · 残光 afterglow · ひとり alone ...
   ===================================================================== */
window.AG = window.AG || {};

AG.SignAtlas = (function () {
  const W = 2048, H = 1792;
  const HCELL = { w: 512, h: 128 }, VCELL = { w: 128, h: 512 };

  const horizontal = [
    'LOVE', 'STILL HERE', 'OPEN 24H', 'AFTERGLOW', 'NO SIGNAL', 'HOTEL', 'RAMEN',
    'NIGHT CAFE', 'PULSE', 'ECHO', 'BAR 99', 'GLOW', 'HOLD ON', 'LOST', 'DATA',
    '残光', '眠らない街', 'KONBINI', 'SYNC', 'VOID', 'ネオン', 'カラオケ', 'TAXI', 'DREAM'
  ];
  const vertical = [
    '静寂', '再接続', '残光', '雨', '心', '光', '夜', '希望', '孤独', '記憶', '街', '眠らない',
    '愛', '夢', 'ひとり', '大丈夫', '酒', '電脳', '未来', '生きる', '待つ', '朝', '星', '声',
    'ホテル', '薬局', '回線', '東京', '夜景', '居酒屋', '残響', '新生'
  ];

  let graphics = null, image = null;
  const entries = {};

  function fontStack(px) {
    return `700 ${px}px "Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Noto Sans JP","Noto Sans CJK JP","Meiryo","Helvetica Neue",Arial,sans-serif`;
  }

  function drawEntry(ctx, text, x, y, w, h, vert) {
    const chars = Array.from(text);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalCompositeOperation = 'lighter';
    const layout = [];
    if (!vert) {
      let px = Math.min(92, (w - 40) / (chars.length * 0.68));
      const isCJK = /[぀-ヿ一-鿿]/.test(text);
      if (isCJK) px = Math.min(88, (w - 40) / (chars.length * 1.02));
      ctx.font = fontStack(px);
      const widths = chars.map((c) => ctx.measureText(c).width + px * 0.06);
      const total = widths.reduce((a, b) => a + b, 0);
      let cx = x + w / 2 - total / 2;
      chars.forEach((c, i) => { layout.push({ c, x: cx + widths[i] / 2, y: y + h / 2 + 4, cw: widths[i], ch: px }); cx += widths[i]; });
    } else {
      const px = Math.min(96, (h - 30) / (chars.length * 1.04));
      ctx.font = fontStack(px);
      const step = px * 1.04, total = step * chars.length;
      chars.forEach((c, i) => layout.push({ c, x: x + w / 2, y: y + h / 2 - total / 2 + step * (i + 0.5), cw: px, ch: step }));
    }
    // B: character id blocks (id 1..n -> value id*20)
    layout.forEach((L, i) => {
      ctx.fillStyle = `rgb(0,0,${Math.min(255, (i + 1) * 20)})`;
      ctx.fillRect(L.x - L.cw / 2, L.y - L.ch / 2 - 6, L.cw, L.ch + 12);
    });
    // G: halo
    ctx.shadowColor = 'rgb(0,255,0)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = 'rgb(0,150,0)';
    layout.forEach((L) => ctx.fillText(L.c, L.x, L.y));
    ctx.shadowBlur = 10;
    layout.forEach((L) => ctx.fillText(L.c, L.x, L.y));
    ctx.shadowBlur = 0;
    // R: core (thin tube = stroke inside fill)
    ctx.fillStyle = 'rgb(255,0,0)';
    layout.forEach((L) => ctx.fillText(L.c, L.x, L.y));
    ctx.restore();
    return chars.length;
  }

  function build(p) {
    if (graphics) return graphics;
    graphics = p.createGraphics(W, H);
    image = null;
    graphics.pixelDensity(1);
    const ctx = graphics.drawingContext;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    horizontal.forEach((t, i) => {
      const cx = (i % 4) * HCELL.w, cy = Math.floor(i / 4) * HCELL.h;
      const n = drawEntry(ctx, t, cx, cy, HCELL.w, HCELL.h, false);
      entries[t + '|h'] = { u0: cx / W, v0: cy / H, u1: (cx + HCELL.w) / W, v1: (cy + HCELL.h) / H, vertical: false, chars: n };
    });
    const vy = 6 * HCELL.h;
    vertical.forEach((t, i) => {
      const cx = (i % 16) * VCELL.w, cy = vy + Math.floor(i / 16) * VCELL.h;
      const n = drawEntry(ctx, t, cx, cy, VCELL.w, VCELL.h, true);
      entries[t + '|v'] = { u0: cx / W, v0: cy / H, u1: (cx + VCELL.w) / W, v1: (cy + VCELL.h) / H, vertical: true, chars: n };
    });
    // a p5.Image is uploaded to the GPU once; a p5.Graphics is re-uploaded on every bind
    image = graphics.get();
    return graphics;
  }

  return {
    build,
    get texture() { return image || graphics; },
    horizontal, vertical,
    get(text, vert) { return entries[text + (vert ? '|v' : '|h')]; },
    aspectH: HCELL.w / HCELL.h,
    aspectV: VCELL.h / VCELL.w
  };
})();
