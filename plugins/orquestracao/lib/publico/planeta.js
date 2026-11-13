// O planeta do rodapé: um globo escuro nascendo na borda de baixo, com a atmosfera violeta/rosa acesa no limbo.
// Corpo e atmosfera são pintados uma vez em camadas do tamanho da faixa de baixo; por quadro só respiram o halo e sobem umas poucas fagulhas.
// Roda dentro do laço do céu (ceu.js): mesmos 12 qps, mesma pausa com a aba oculta e com `prefers-reduced-motion`.

/** Quanto do planeta aparece acima da borda de baixo. O CSS reserva o mesmo espaço no pé (`--planeta`). */
const ALTURA_FRACAO = 0.24;
const ALTURA_MAX = 210;
const RAIO_FRACAO = 0.8;
const RAIO_MIN = 380;
const HALO = 70;
/** Espessura, em px, do anel aceso por dentro do limbo: o resto do globo fica escuro e o texto por cima, legível. */
const ATMOSFERA = 60;
const FAGULHAS = 28;

/** Geometria do planeta para uma tela de `w` × `h`. */
export function medirPlaneta(w, h) {
  const altura = Math.min(h * ALTURA_FRACAO, ALTURA_MAX);
  const r = Math.max(w * RAIO_FRACAO, RAIO_MIN);
  const topo = h - altura;
  return { cx: w / 2, cy: topo + r, r, topo, w, h };
}

/** Canvas do tamanho da faixa de baixo (do topo do brilho até a borda), desenhado em coordenadas da tela. */
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

/** Corpo e atmosfera (uma vez por redimensionar). Vai por cima das estrelas, que não aparecem através do globo. */
function pintarCorpo(ctx, p) {
  const { cx, cy, r } = p;

  // Brilho largo que a atmosfera joga no céu logo acima do limbo.
  const aura = ctx.createRadialGradient(cx, cy, r * 0.97, cx, cy, r + HALO * 2.2);
  aura.addColorStop(0, 'rgba(192, 42, 99, 0.24)');
  aura.addColorStop(0.18, 'rgba(154, 47, 184, 0.16)');
  aura.addColorStop(0.5, 'rgba(91, 63, 214, 0.08)');
  aura.addColorStop(1, 'rgba(91, 63, 214, 0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, p.topo - HALO * 2.4, p.w, p.h - p.topo + HALO * 2.4);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Corpo: quase preto, um tom de ameixa no alto, onde a luz bate.
  const corpo = ctx.createLinearGradient(0, p.topo, 0, p.h);
  corpo.addColorStop(0, '#120a26');
  corpo.addColorStop(0.35, '#090718');
  corpo.addColorStop(1, '#05050f');
  ctx.fillStyle = corpo;
  ctx.fillRect(0, p.topo, p.w, p.h - p.topo);

  // Atmosfera vista por dentro: o anel acende de roxo a rosa colado à borda.
  const atmosfera = ctx.createRadialGradient(cx, cy, r - ATMOSFERA, cx, cy, r);
  atmosfera.addColorStop(0, 'rgba(91, 63, 214, 0)');
  atmosfera.addColorStop(0.5, 'rgba(110, 60, 220, 0.10)');
  atmosfera.addColorStop(0.82, 'rgba(154, 47, 184, 0.30)');
  atmosfera.addColorStop(0.96, 'rgba(230, 110, 200, 0.62)');
  atmosfera.addColorStop(1, 'rgba(255, 200, 240, 0.9)');
  ctx.fillStyle = atmosfera;
  ctx.fillRect(0, p.topo, p.w, p.h - p.topo);

  // Sombra que desce do alto: o lado de baixo do globo apaga, como na noite do planeta.
  const noite = ctx.createLinearGradient(0, p.topo, 0, p.h);
  noite.addColorStop(0, 'rgba(5, 5, 15, 0)');
  noite.addColorStop(0.45, 'rgba(5, 5, 15, 0.35)');
  noite.addColorStop(1, 'rgba(5, 5, 15, 0.85)');
  ctx.fillStyle = noite;
  ctx.fillRect(0, p.topo, p.w, p.h - p.topo);
  ctx.restore();

  // O fio do limbo, fino e claro.
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255, 215, 245, 0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
  ctx.stroke();
}

/** O halo que respira, à parte, para variar só o seu alfa a cada quadro. */
function pintarHalo(ctx, p) {
  const halo = ctx.createRadialGradient(p.cx, p.cy, p.r * 0.995, p.cx, p.cy, p.r + HALO);
  halo.addColorStop(0, 'rgba(255, 160, 220, 0.55)');
  halo.addColorStop(0.12, 'rgba(220, 80, 200, 0.32)');
  halo.addColorStop(0.45, 'rgba(143, 124, 255, 0.10)');
  halo.addColorStop(1, 'rgba(143, 124, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, p.topo - HALO, p.w, p.h - p.topo + HALO);
}

/** Fagulhas que sobem devagar a partir do limbo. Posição fixa por semente: não pulam ao redimensionar. */
function montarFagulhas(p, sorteio) {
  const r = sorteio(1234);
  return Array.from({ length: FAGULHAS }, () => ({
    x: r() * p.w,
    fase: r(),
    ritmo: 0.012 + r() * 0.02,
    subida: 30 + r() * 70,
    tam: r() < 0.25 ? 1.7 : 1.1,
  }));
}

/** Prepara as camadas do planeta para uma tela de `w` × `h` (chamar a cada redimensionar). */
export function prepararPlaneta(w, h, dpr, sorteio) {
  const p = medirPlaneta(w, h);
  const corpo = faixa(p, dpr, HALO * 2.4);
  pintarCorpo(corpo.ctx, p);
  const halo = faixa(p, dpr, HALO);
  pintarHalo(halo.ctx, p);
  return { p, corpo, halo, fagulhas: montarFagulhas(p, sorteio) };
}

/** O que muda a cada quadro: o halo respira (ciclo de ~14 s) e as fagulhas sobem e somem. */
export function quadroPlaneta(ctx, { p, corpo, halo, fagulhas }, s) {
  // Halo antes do corpo: por dentro do raio inicial o gradiente radial repete a primeira cor, e o corpo cobre isso.
  ctx.save();
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(s * 0.45);
  ctx.drawImage(halo.canvas, 0, halo.y0, p.w, halo.alto);
  ctx.restore();
  ctx.drawImage(corpo.canvas, 0, corpo.y0, p.w, corpo.alto);

  for (const f of fagulhas) {
    const dx = f.x - p.cx;
    if (Math.abs(dx) >= p.r) continue;
    const limbo = p.cy - Math.sqrt(p.r * p.r - dx * dx);
    const t = (f.fase + s * f.ritmo) % 1;
    const y = limbo - 4 - t * f.subida;
    const a = Math.sin(t * Math.PI) * 0.9;
    ctx.fillStyle = `rgba(255, 210, 245, ${a.toFixed(3)})`;
    ctx.fillRect(f.x, y, f.tam, f.tam);
  }
}
