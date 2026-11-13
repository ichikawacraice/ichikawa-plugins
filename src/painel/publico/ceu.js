// O céu do fundo: uma via láctea em diagonal (pintada uma vez numa camada fixa) e poucas constelações que cintilam.
// Leve de propósito: o painel fica aberto o dia todo. Até 12 quadros por segundo, para quando a aba some e,
// com `prefers-reduced-motion`, desenha um quadro só.

const QUADRO_MS = 1000 / 12;
const DPR_MAX = 2;
const ESTRELAS_POR_PX2 = 1 / 1400;
const CINTILANTES = 40;
const CONSTELACOES = 4;

/** Gerador determinístico: o mesmo céu a cada redimensionar (sem estrelas pulando de lugar). */
function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distância (0 a 1) do ponto à faixa da via láctea, que cruza a tela de baixo à esquerda ao alto à direita. */
function pertoDaFaixa(x, y, w, h) {
  const d = Math.abs((x / w) * 0.9 + (y / h) - 1.05) / 1.35;
  return Math.max(0, 1 - d * 3.2);
}

function pintarFixo(ctx, w, h) {
  const fundo = ctx.createLinearGradient(0, 0, w, h);
  fundo.addColorStop(0, '#060818');
  fundo.addColorStop(0.55, '#0a0d2a');
  fundo.addColorStop(1, '#120a2e');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, w, h);

  // Nebulosas: manchas largas e bem apagadas, azul de um lado e roxo do outro.
  const nebulosas = [
    [w * 0.15, h * 0.85, Math.max(w, h) * 0.55, 'rgba(61, 91, 255, 0.16)'],
    [w * 0.85, h * 0.12, Math.max(w, h) * 0.5, 'rgba(150, 70, 255, 0.16)'],
    [w * 0.5, h * 0.5, Math.max(w, h) * 0.35, 'rgba(110, 80, 230, 0.10)'],
  ];
  for (const [x, y, r, cor] of nebulosas) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, cor);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // O braço da galáxia: poeira (muitas estrelas minúsculas) concentrada perto da faixa.
  const r = sorteio(7);
  const total = Math.round(w * h * ESTRELAS_POR_PX2);
  for (let i = 0; i < total * 3; i++) {
    const x = r() * w;
    const y = r() * h;
    const perto = pertoDaFaixa(x, y, w, h);
    if (r() > 0.18 + perto * 0.82) continue;
    const a = 0.2 + r() * 0.6 * (0.4 + perto);
    const tam = r() < 0.04 ? 1.3 : 0.6;
    ctx.fillStyle = r() < 0.5 ? `rgba(200, 210, 255, ${a})` : `rgba(220, 200, 255, ${a})`;
    ctx.fillRect(x, y, tam, tam);
  }
  const brilho = ctx.createLinearGradient(0, h, w, 0);
  brilho.addColorStop(0.3, 'rgba(120, 140, 255, 0)');
  brilho.addColorStop(0.52, 'rgba(140, 130, 255, 0.11)');
  brilho.addColorStop(0.75, 'rgba(120, 140, 255, 0)');
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 0, w, h);
}

function montarConstelacoes(w, h) {
  const r = sorteio(42);
  const lista = [];
  for (let c = 0; c < CONSTELACOES; c++) {
    const cx = (0.12 + r() * 0.76) * w;
    const cy = ((c + 0.5) / CONSTELACOES) * h + (r() - 0.5) * h * 0.12;
    const pontos = [];
    let x = cx;
    let y = cy;
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      pontos.push({ x, y, fase: r() * Math.PI * 2 });
      x += (r() - 0.5) * Math.min(w, 420) * 0.32;
      y += (r() - 0.35) * 46;
    }
    lista.push(pontos);
  }
  return lista;
}

function montarCintilantes(w, h) {
  const r = sorteio(99);
  return Array.from({ length: CINTILANTES }, () => ({ x: r() * w, y: r() * h, fase: r() * Math.PI * 2, ritmo: 0.4 + r() * 0.9, tam: 0.8 + r() * 1.1 }));
}

function estrela(ctx, x, y, raio, alfa) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, raio * 4);
  g.addColorStop(0, `rgba(235, 238, 255, ${alfa})`);
  g.addColorStop(0.25, `rgba(170, 160, 255, ${alfa * 0.35})`);
  g.addColorStop(1, 'rgba(120, 110, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - raio * 4, y - raio * 4, raio * 8, raio * 8);
}

/** Liga o céu num `<canvas>`. Devolve uma função que o desliga. */
export function iniciarCeu(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const calmo = window.matchMedia('(prefers-reduced-motion: reduce)');
  const camada = document.createElement('canvas');
  let w = 0;
  let h = 0;
  let constelacoes = [];
  let cintilantes = [];
  let pedido = 0;
  let ultimo = 0;

  const quadro = (t) => {
    ctx.drawImage(camada, 0, 0, w, h);
    const s = t / 1000;
    ctx.lineWidth = 0.6;
    for (const pontos of constelacoes) {
      ctx.strokeStyle = 'rgba(160, 170, 255, 0.16)';
      ctx.beginPath();
      pontos.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      for (const p of pontos) estrela(ctx, p.x, p.y, 1.3, 0.65 + 0.35 * Math.sin(s * 0.8 + p.fase));
    }
    for (const c of cintilantes) estrela(ctx, c.x, c.y, c.tam, 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(s * c.ritmo + c.fase)));
  };

  const medir = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    w = window.innerWidth;
    h = window.innerHeight;
    for (const c of [canvas, camada]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cctx = camada.getContext('2d');
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pintarFixo(cctx, w, h);
    constelacoes = montarConstelacoes(w, h);
    cintilantes = montarCintilantes(w, h);
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
