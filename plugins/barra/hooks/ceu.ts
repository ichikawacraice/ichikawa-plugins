// O céu da barra, puro e testado direto. Dois temas pelo modo ausente: noite (ligado; a paleta do painel, #030014,
// estrelas e a lua) e dia (desligado; céu azul, sol e nuvens). Posições vêm de uma semente fixa: a barra não
// "pula" a cada desenho.
//
// O app não pinta `Svg` numa caixa `position="absolute"` (medido no ICH-F22): o desktop leva a cor lisa do céu
// atrás dos botões e a cena num `Svg` em fluxo, no espaço que sobra à direita.

export type Modo = 'noite' | 'dia'

export type Tema = {
  /** Fundo da barra, atrás dos botões. */
  fundo: string
  /** Relógio do cache e rótulos do terminal. */
  texto: string
  /** Relógio aos 20 min. */
  aviso: string
  /** Estrelas ou nuvens do terminal. */
  detalheTerminal: string
}

export const TEMAS: Record<Modo, Tema> = {
  noite: { fundo: '#030014', texto: '#d9d0ff', aviso: '#f5b84a', detalheTerminal: '#5b3fd6' },
  // Dia: a paleta da ICH-F21 (céu #74b6ef → #9ccdf4 → #d6ebfb, texto #0b1f3a, aviso no âmbar escuro #744700, AA no céu).
  dia: { fundo: '#74b6ef', texto: '#0b1f3a', aviso: '#744700', detalheTerminal: '#e3f1fd' },
}

/** O ausente ligado é a noite; desligado, ou ainda não lido, o dia. */
export const modoDoAusente = (ligado: boolean | undefined): Modo => (ligado ? 'noite' : 'dia')

/** Ícone de cada botão: um glifo antes do rótulo (o app desenha o botão nativo, só com texto). */
export const ICONES = { ausenteNoite: '☾', ausenteDia: '☀', gravando: '⋯', padrao: '✦' } as const

/** Uma estrela a cada tantas colunas, no terminal. */
const COLUNAS_POR_ESTRELA = 7
/** Uma nuvem a cada tantas colunas, no terminal de dia. */
const COLUNAS_POR_NUVEM = 23
/** Uma em cada tantas estrelas cintila. */
const CINTILA_A_CADA = 3
/** Quadros do ciclo da cintilação: um por segundo, a estrela acende em um deles. */
export const CICLO_CINTILA = 4

/** Gerador determinístico (mulberry32): a mesma semente desenha o mesmo céu. */
export function sorteador(semente: number): () => number {
  let a = semente >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const SEMENTE = 1503

export type EstrelaDeTexto = { coluna: number; cintila: boolean; desfase: number }

/** Onde ficam as estrelas numa linha de `colunas` células: uma por faixa, em posição sorteada dentro dela. */
export function estrelasDaLinha(colunas: number): EstrelaDeTexto[] {
  const sortear = sorteador(SEMENTE)
  const estrelas: EstrelaDeTexto[] = []
  for (let inicio = 0, i = 0; inicio < colunas; inicio += COLUNAS_POR_ESTRELA, i++) {
    const coluna = inicio + Math.floor(sortear() * COLUNAS_POR_ESTRELA)
    if (coluna >= colunas) break
    estrelas.push({ coluna, cintila: i % CINTILA_A_CADA === 1, desfase: Math.floor(sortear() * CICLO_CINTILA) })
  }

  return estrelas
}

/**
 * A linha de estrelas do terminal no quadro `fase`. Parada (`fase` `null`), toda estrela que cintila fica acesa
 * e nada muda entre desenhos.
 */
export function linhaDeEstrelas(colunas: number, fase: number | null): string {
  const celulas = Array.from({ length: Math.max(0, colunas) }, () => ' ')
  for (const e of estrelasDaLinha(colunas)) {
    if (!e.cintila) celulas[e.coluna] = '·'
    else celulas[e.coluna] = fase === null || (fase + e.desfase) % CICLO_CINTILA === 0 ? '✦' : '⋆'
  }

  return celulas.join('')
}

/** A linha do terminal de dia: nuvens espaçadas e o sol perto da ponta direita. Parada: o dia não cintila. */
export function linhaDeNuvens(colunas: number): string {
  const celulas = Array.from({ length: Math.max(0, colunas) }, () => ' ')
  const sortear = sorteador(SEMENTE)
  for (let inicio = 0; inicio < colunas; inicio += COLUNAS_POR_NUVEM) {
    const coluna = inicio + Math.floor(sortear() * COLUNAS_POR_NUVEM)
    if (coluna < colunas) celulas[coluna] = '☁'
  }
  if (colunas >= 4) celulas[colunas - 3] = '☀'

  return celulas.join('')
}

/** A linha do céu do terminal para o modo. */
export const linhaDoCeu = (modo: Modo, colunas: number, fase: number | null): string =>
  modo === 'noite' ? linhaDeEstrelas(colunas, fase) : linhaDeNuvens(colunas)

// ---- desktop: a cena em SVG ----

/** Altura da cena, em pixels CSS: um botão do app com folga em cima e embaixo, longe da moldura nativa da faixa. */
export const SVG_ALTURA = 40
/** Céu livre entre a borda do sol (ou da lua) e a ponta direita da cena, colada nos botões, em pixels. */
export const ESPACO_SOL_BOTOES = 18
/** Raio do brilho em volta do sol e da lua: some antes da borda da cena, para não aparecer corte. */
const RAIO_BRILHO = 28
const RAIO_SOL = 10
/** Largura mínima e máxima da cena; abaixo do mínimo a barra fica sem cena. */
export const CENA_MIN = 140
export const CENA_MAX = 480
/** Folga de cada botão nativo além do texto (padding e borda), em pixels. */
const PX_BOTAO_FOLGA = 28
const PX_VAO = 8
/** Pixels por coluna da fonte de código do app: só para dimensionar a cena pela largura da barra. */
export const PX_POR_COLUNA = 8

const CORES_ESTRELA = ['#ffffff', '#d9d0ff', '#c8a8ff', '#9fb4ff']
const PX_POR_ESTRELA = 14

const d1 = (n: number) => (Math.round(n * 10) / 10).toString()
const d3 = (n: number) => n.toFixed(3)

const ESTILO_NOITE =
  `@keyframes cintila{0%{opacity:1}25%{opacity:.35}50%{opacity:.85}75%{opacity:.2}100%{opacity:1}}` +
  `.c{animation:cintila ${CICLO_CINTILA}s steps(${CICLO_CINTILA},jump-none) infinite}` +
  Array.from({ length: CICLO_CINTILA - 1 }, (_, k) => `.c${k + 1}{animation-delay:-${k + 1}s}`).join('') +
  `@media (prefers-reduced-motion:reduce){.c{animation:none}}`

/** Noite: o fundo escurece para a direita, estrelas e a lua crescente na ponta direita, onde de dia fica o sol. */
function cenaDaNoite(l: number, parado: boolean): string {
  const a = SVG_ALTURA
  const sortear = sorteador(SEMENTE)
  const estrelas: string[] = []
  for (let i = 0; i < Math.round(l / PX_POR_ESTRELA); i++) {
    const x = d1(sortear() * l)
    const y = d1(2 + sortear() * (a - 4))
    const r = (0.45 + sortear() * 0.8).toFixed(2)
    const cor = CORES_ESTRELA[Math.floor(sortear() * CORES_ESTRELA.length)]
    const quadro = Math.floor(sortear() * CICLO_CINTILA)
    const classe = i % CINTILA_A_CADA === 1 ? ` class="c${quadro ? ` c${quadro}` : ''}"` : ''
    estrelas.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${cor}"${classe}/>`)
  }
  // A lua no lugar do sol: crescente com brilho suave, a 50 px do primeiro botão.
  const mx = l - ESPACO_SOL_BOTOES - RAIO_SOL
  const my = Math.round(a / 2)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${a}" viewBox="0 0 ${l} ${a}">` +
    (parado ? '' : `<style>${ESTILO_NOITE}</style>`) +
    `<defs><radialGradient id="luar" cx="${mx}" cy="${my}" r="${RAIO_BRILHO}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#e1d6ff" stop-opacity=".55"/><stop offset=".5" stop-color="#a78bfa" stop-opacity=".2"/>` +
    `<stop offset="1" stop-color="#8f7cff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="lua" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#ffffff"/>` +
    `<stop offset=".7" stop-color="#e9e3ff"/><stop offset="1" stop-color="#c8b8ff"/></radialGradient>` +
    `<mask id="crescente"><rect width="${l}" height="${a}" fill="#fff"/>` +
    `<circle cx="${mx + 5}" cy="${my - 3}" r="${RAIO_SOL}" fill="#000"/></mask></defs>` +
    `<rect width="${l}" height="${a}" fill="${TEMAS.noite.fundo}"/>` +
    estrelas.join('') +
    `<circle cx="${mx}" cy="${my}" r="${RAIO_BRILHO}" fill="url(#luar)"/>` +
    `<circle cx="${mx}" cy="${my}" r="${RAIO_SOL}" fill="url(#lua)" mask="url(#crescente)"/>` +
    `</svg>`
  )
}

function nuvem(x: number, y: number, escala: number, opacidade: number): string {
  return (
    `<g transform="translate(${d1(x)} ${d1(y)}) scale(${escala})" opacity="${opacidade}">` +
    `<ellipse cx="0" cy="6" rx="34" ry="5" fill="#b4cdeb" opacity=".22"/><g fill="url(#nuvem)">` +
    `<circle cx="-18" cy="0" r="9"/><circle cx="-4" cy="-6" r="13"/><circle cx="13" cy="-2" r="10"/>` +
    `<circle cx="25" cy="2" r="7"/><rect x="-27" y="0" width="58" height="8" rx="4"/></g></g>`
  )
}

/** Dia: o azul liso da barra, nuvens paradas ao fundo e o sol com brilho e raios na ponta direita, colado nos botões. */
function cenaDoDia(l: number): string {
  const a = SVG_ALTURA
  const sx = l - ESPACO_SOL_BOTOES - RAIO_SOL
  const sy = Math.round(a / 2)
  const raios = Array.from({ length: 12 }, (_, k) => {
    const ang = (k * Math.PI) / 6
    const p = (d: number) => `${d1(sx + Math.cos(ang + d) * 17)} ${d1(sy + Math.sin(ang + d) * 17)}`

    return `<path d="M${sx} ${sy} L${p(-0.16)} L${p(0.16)}Z"/>`
  }).join('')
  // Nuvens ao fundo, espalhadas pela cena toda e atrás do sol; mais apagadas quanto mais longe dele.
  const nuvens = [
    nuvem(l - 48, 27, 0.5, 0.9),
    nuvem(l - 120, 22, 0.6, 0.85),
    nuvem(l - 200, 28, 0.45, 0.7),
    nuvem(l - 280, 18, 0.5, 0.6),
    nuvem(l - 370, 26, 0.4, 0.5),
    nuvem(l - 450, 20, 0.35, 0.4),
  ].join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${a}" viewBox="0 0 ${l} ${a}">` +
    `<defs><radialGradient id="brilho" cx="${sx}" cy="${sy}" r="${RAIO_BRILHO}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#fff6d6" stop-opacity=".95"/><stop offset=".45" stop-color="#ffe7a0" stop-opacity=".45"/>` +
    `<stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="sol" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#fff3c8"/>` +
    `<stop offset=".6" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffb83f"/></radialGradient>` +
    `<linearGradient id="nuvem" x1="0" y1="-20" x2="0" y2="10" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3f1fd"/></linearGradient></defs>` +
    `<rect width="${l}" height="${a}" fill="${TEMAS.dia.fundo}"/>` +
    `<g class="nuvens">${nuvens}</g>` +
    `<circle cx="${sx}" cy="${sy}" r="${RAIO_BRILHO}" fill="url(#brilho)"/>` +
    `<g fill="#fff4c4" opacity=".7">${raios}</g><circle cx="${sx}" cy="${sy}" r="${RAIO_SOL}" fill="url(#sol)"/></svg>`
  )
}

/**
 * Quantos pixels sobram para a cena entre o relógio do cache e os botões: a largura da faixa menos o texto e os
 * botões estimados pela fonte. `null` quando não cabe uma cena digna (a barra fica no fundo liso).
 */
export function larguraDaCena(colunas: number, texto: string, rotulos: string[]): number | null {
  const ocupado =
    PX_POR_COLUNA * (2 + [...texto].length) +
    rotulos.reduce((t, r) => t + [...r].length * PX_POR_COLUNA + PX_BOTAO_FOLGA, 0) +
    PX_VAO * (rotulos.length + 1)
  const sobra = colunas * PX_POR_COLUNA - ocupado

  return sobra < CENA_MIN ? null : Math.min(CENA_MAX, sobra)
}

/**
 * A cena do desktop para o modo, com `largura` pixels: fica entre o relógio e os botões, com o sol (ou a lua) na
 * ponta direita, colado nos botões; o fundo é a cor lisa da barra, para emendar sem borda. A animação é CSS do próprio SVG (só as estrelas, em degraus de 1 s; o dia é parado); `prefers-reduced-motion` a para no app, e `parado` a tira do desenho.
 */
export function svgDaCena(modo: Modo, largura: number, parado: boolean): string {
  const l = Math.max(200, Math.round(largura))

  return modo === 'noite' ? cenaDaNoite(l, parado) : cenaDoDia(l)
}

/** Pede menos movimento: `BARRA_SEM_ANIMACAO` ligado, ou o "Reduzir movimento" do macOS (`defaults` imprime 1). */
export function pedeMenosMovimento(variavel: string | undefined, saidaDoDefaults: string | null): boolean {
  if (variavel && !['0', 'false', 'nao', 'não'].includes(variavel.trim().toLowerCase())) return true

  return saidaDoDefaults?.trim() === '1'
}
