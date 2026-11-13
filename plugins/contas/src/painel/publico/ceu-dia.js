// O céu de dia: azul que clareia até o horizonte, umas nuvens que andam devagar e um sol enorme nascendo no rodapé,
// cortado pela borda como o planeta da noite (mesma geometria: planeta.js).
// Mesmo ritmo do céu noturno: até 12 quadros por segundo, para com a aba oculta e com `prefers-reduced-motion`.
// O fundo é claro de propósito: o texto escuro por cima fica legível em qualquer ponto (nuvem e sol só clareiam).

const QUADRO_MS = 1000 / 12;
const DPR_MAX = 2;
const NUVENS = 7;
/** Geometria igual à do planeta: quanto aparece acima da borda e o raio, grande o bastante para virar um arco. */
const ALTURA_FRACAO = 0.24;
const ALTURA_MAX = 210;
const RAIO_FRACAO = 0.8;
const RAIO_MIN = 380;
const HALO = 90;
const BRILHOS = 24;

function sorteioDia(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function medirSol(w, h) {
  const altura = Math.min(h * ALTURA_FRACAO, ALTURA_MAX);
  const r = Math.max(w * RAIO_FRACAO, RAIO_MIN);
  const topo = h - altura;
  return { cx: w / 2, cy: topo + r, r, topo, w, h };
}

function pintarFixoDia(ctx, w, h) {
  const ceu = ctx.createLinearGradient(0, 0, 0, h);
  ceu.addColorStop(0, '#74b6ef');
  ceu.addColorStop(0.45, '#9ccdf4');
  ceu.addColorStop(0.78, '#d6ebfb');
  ceu.addColorStop(1, '#ffeccb');
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, w, h);

  // Os cantos de cima um tom mais fundo: dá profundidade sem escurecer o meio, onde fica o texto.
  for (const x of [0, w]) {
    const g = ctx.createRadialGradient(x, 0, 0, x, 0, Math.max(w, h) * 0.55);
    g.addColorStop(0, 'rgba(40, 120, 215, 0.2)');
    g.addColorStop(1, 'rgba(40, 120, 215, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Camada do tamanho da faixa de baixo, desenhada em coordenadas da tela (como em planeta.js). */
function faixa(p, dpr, margem) {
  const canvas = document.createElement('canvas');
  const y0 = Math.max(0, p.topo - margem);
  const alto = p.h - y0;
  canvas.width = Math.max(1, Math.round(p.w * dpr));
  canvas.height = Math.max(1, Math.round(alto * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, -y0 * dpr);
  return { canvas, ctx, y0, alto };
}

/** Corpo do sol: o arco enorme, branco-dourado no miolo e ouro na borda, com a luz que ele joga no céu acima. */
function pintarCorpo(ctx, p) {
  const { cx, cy, r } = p;
  const aura = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r + HALO * 2.6);
  aura.addColorStop(0, 'rgba(255, 196, 92, 0.42)');
  aura.addColorStop(0.2, 'rgba(255, 210, 130, 0.26)');
  aura.addColorStop(0.55, 'rgba(255, 228, 175, 0.1)');
  aura.addColorStop(1, 'rgba(255, 236, 200, 0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, p.topo - HALO * 2.8, p.w, p.h - p.topo + HALO * 2.8);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // Por dentro: quase branco no meio, esquentando até o ouro colado à borda (o limbo do sol é mais quente).
  const corpo = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  corpo.addColorStop(0, '#fffdf4');
  corpo.addColorStop(0.7, '#fff3c8');
  corpo.addColorStop(0.9, '#ffe08a');
  corpo.addColorStop(0.97, '#ffc95c');
  corpo.addColorStop(1, '#ffb83f');
  ctx.fillStyle = corpo;
  ctx.fillRect(0, p.topo, p.w, p.h - p.topo);
  ctx.restore();

  // O fio da borda, fino e claro, como o limbo do planeta.
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255, 250, 225, 0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
  ctx.stroke();
}

/** O halo que respira, à parte, para variar só o seu alfa a cada quadro. */
function pintarHalo(ctx, p) {
  const halo = ctx.createRadialGradient(p.cx, p.cy, p.r * 0.995, p.cx, p.cy, p.r + HALO);
  halo.addColorStop(0, 'rgba(255, 244, 200, 0.85)');
  halo.addColorStop(0.15, 'rgba(255, 214, 120, 0.45)');
  halo.addColorStop(0.5, 'rgba(255, 210, 140, 0.12)');
  halo.addColorStop(1, 'rgba(255, 210, 140, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, p.topo - HALO, p.w, p.h - p.topo + HALO);
}

function prepararSol(w, h, dpr) {
  const p = medirSol(w, h);
  const corpo = faixa(p, dpr, HALO * 2.8);
  pintarCorpo(corpo.ctx, p);
  const halo = faixa(p, dpr, HALO);
  pintarHalo(halo.ctx, p);
  const r = sorteioDia(1234);
  const brilhos = Array.from({ length: BRILHOS }, () => ({ x: r() * p.w, fase: r(), ritmo: 0.012 + r() * 0.02, subida: 30 + r() * 70, tam: r() < 0.25 ? 2 : 1.3 }));
  return { p, corpo, halo, brilhos };
}

/** Por quadro: o halo respira (~14 s) e uns poucos brilhos sobem da borda e somem, como as fagulhas do planeta. */
function quadroSol(ctx, { p, corpo, halo, brilhos }, s) {
  ctx.save();
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(s * 0.45);
  ctx.drawImage(halo.canvas, 0, halo.y0, p.w, halo.alto);
  ctx.restore();
  ctx.drawImage(corpo.canvas, 0, corpo.y0, p.w, corpo.alto);
  for (const b of brilhos) {
    const dx = b.x - p.cx;
    if (Math.abs(dx) >= p.r) continue;
    const limbo = p.cy - Math.sqrt(p.r * p.r - dx * dx);
    const t = (b.fase + s * b.ritmo) % 1;
    const y = limbo - 4 - t * b.subida;
    const a = Math.sin(t * Math.PI) * 0.95;
    ctx.fillStyle = `rgba(255, 252, 235, ${a.toFixed(3)})`;
    ctx.fillRect(b.x, y, b.tam, b.tam);
  }
}

/** Uma nuvem pintada uma vez numa camada própria: bolhas brancas sobrepostas, base mais reta e levemente azulada. */
function pintarNuvem(r, largura, dpr) {
  const alto = largura * 0.5;
  const c = document.createElement('canvas');
  c.width = Math.round(largura * dpr);
  c.height = Math.round(alto * dpr);
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = largura * (0.14 + t * 0.72);
    const meio = 1 - Math.abs(t - 0.5) * 1.4;
    const raio = largura * (0.1 + meio * 0.12 + r() * 0.05);
    const y = alto * 0.68 - raio * (0.35 + meio * 0.4);
    const g = ctx.createRadialGradient(x, y - raio * 0.2, 0, x, y, raio);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    g.addColorStop(0.6, 'rgba(250, 252, 255, 0.75)');
    g.addColorStop(1, 'rgba(235, 244, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, largura, alto);
  }
  const base = ctx.createLinearGradient(0, alto * 0.45, 0, alto * 0.75);
  base.addColorStop(0, 'rgba(180, 205, 235, 0)');
  base.addColorStop(1, 'rgba(180, 205, 235, 0.22)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, largura, alto);
  return { canvas: c, largura, alto };
}

function montarNuvens(w, h, dpr) {
  const r = sorteioDia(21);
  return Array.from({ length: NUVENS }, (_, i) => {
    const largura = Math.min(w * 0.55, 260) * (0.55 + r() * 0.6);
    const nuvem = pintarNuvem(r, largura, dpr);
    return {
      ...nuvem,
      x0: r() * (w + largura) - largura,
      y: ((i + 0.3 + r() * 0.4) / NUVENS) * h * 0.72,
      vel: 1.5 + r() * 3.5,
      alfa: 0.55 + r() * 0.4,
    };
  });
}

/** Liga o céu de dia num `<canvas>`. `medida` devolve { w, h } (a janela, na página; o quadro, no artefato). */
export function iniciarCeuDia(canvas, medida = () => ({ w: window.innerWidth, h: window.innerHeight })) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const calmo = window.matchMedia('(prefers-reduced-motion: reduce)');
  const camada = document.createElement('canvas');
  let w = 0;
  let h = 0;
  let sol = null;
  let nuvens = [];
  let pedido = 0;
  let ultimo = 0;

  const quadro = (t) => {
    if (!camada.width || !camada.height) return;
    const s = t / 1000;
    ctx.drawImage(camada, 0, 0, w, h);
    for (const n of nuvens) {
      const volta = w + n.largura;
      const x = ((((n.x0 + n.largura + s * n.vel) % volta) + volta) % volta) - n.largura;
      ctx.globalAlpha = n.alfa;
      ctx.drawImage(n.canvas, x, n.y, n.largura, n.alto);
    }
    ctx.globalAlpha = 1;
    if (sol) quadroSol(ctx, sol, s);
  };

  const medir = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    ({ w, h } = medida());
    for (const c of [canvas, camada]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cctx = camada.getContext('2d');
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pintarFixoDia(cctx, w, h);
    nuvens = montarNuvens(w, h, dpr);
    sol = prepararSol(w, h, dpr);
    quadro(performance.now());
  };

  const laco = (t) => {
    pedido = requestAnimationFrame(laco);
    if (t - ultimo < QUADRO_MS) return;
    ultimo = t;
    quadro(t);
  };
  const parar = () => { cancelAnimationFrame(pedido); pedido = 0; };
  const andar = () => {
    parar();
    if (document.hidden || calmo.matches) { quadro(performance.now()); return; }
    pedido = requestAnimationFrame(laco);
  };

  let espera = 0;
  const aoRedimensionar = () => { clearTimeout(espera); espera = setTimeout(medir, 150); };
  window.addEventListener('resize', aoRedimensionar);
  document.addEventListener('visibilitychange', andar);
  calmo.addEventListener('change', andar);
  medir();
  andar();
  return () => {
    parar();
    window.removeEventListener('resize', aoRedimensionar);
    document.removeEventListener('visibilitychange', andar);
    calmo.removeEventListener('change', andar);
  };
}
