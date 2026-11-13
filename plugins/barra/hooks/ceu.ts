// O céu da barra, puro e testado direto: a paleta do painel (fundo #030014, violeta e rosa), as estrelas do
// terminal em caracteres e o SVG do desktop. Posições vêm de uma semente fixa: a barra não "pula" a cada desenho.

export const COR_FUNDO = '#030014'
export const COR_TEXTO = '#f5f3ff'
export const COR_BOTAO_TERMINAL = '#d9d0ff'
export const COR_ESTRELA_TERMINAL = '#5b3fd6'
export const COR_BRILHO_TERMINAL = '#c8a8ff'

/** Uma estrela a cada tantas colunas, no terminal. */
const COLUNAS_POR_ESTRELA = 7
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

// ---- desktop: SVG ----

/** O tamanho do desenho, em pixels CSS; o que sobra da barra fica cortado (`slice`). */
export const SVG_ALTURA = 44
const SVG_ESTRELAS_POR_100PX = 4
/** Pixels por coluna da fonte de código do app: só para dimensionar o SVG pela largura da barra. */
export const PX_POR_COLUNA = 8

const CORES_ESTRELA = ['#ffffff', '#d9d0ff', '#c8a8ff', '#9fb4ff']

const doisDecimais = (n: number) => Math.round(n * 100) / 100

/**
 * O céu do desktop: fundo, um brilho de planeta à direita e estrelas. A cintilação é CSS em degraus de 1 s
 * (`steps`), então nada se repinta mais de uma vez por segundo; `prefers-reduced-motion` a para no próprio app,
 * e `parado` a tira do desenho.
 */
export function svgDoCeu(largura: number, parado: boolean): string {
  const l = Math.max(200, Math.round(largura))
  const a = SVG_ALTURA
  const sortear = sorteador(SEMENTE)
  const quantas = Math.round((l / 100) * SVG_ESTRELAS_POR_100PX)
  const estrelas: string[] = []
  for (let i = 0; i < quantas; i++) {
    const x = doisDecimais(sortear() * l)
    const y = doisDecimais(2 + sortear() * (a - 4))
    const r = doisDecimais(0.4 + sortear() * 0.8)
    const cor = CORES_ESTRELA[Math.floor(sortear() * CORES_ESTRELA.length)]
    const classe = i % CINTILA_A_CADA === 1 ? ` class="c${Math.floor(sortear() * CICLO_CINTILA)}"` : ''
    estrelas.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${cor}"${classe}/>`)
  }
  const animacao = parado
    ? ''
    : `<style>@keyframes cintila{0%{opacity:1}25%{opacity:.35}50%{opacity:.8}75%{opacity:.2}100%{opacity:1}}` +
      `circle[class]{animation:cintila ${CICLO_CINTILA}s steps(${CICLO_CINTILA},jump-none) infinite}` +
      Array.from({ length: CICLO_CINTILA }, (_, k) => `.c${k}{animation-delay:-${k}s}`).join('') +
      `@media (prefers-reduced-motion:reduce){circle[class]{animation:none}}</style>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${a}" viewBox="0 0 ${l} ${a}" preserveAspectRatio="xMinYMid slice">` +
    `<defs><radialGradient id="planeta" cx="50%" cy="50%" r="50%">` +
    `<stop offset="0%" stop-color="#c02a63" stop-opacity=".55"/><stop offset="45%" stop-color="#9a2fb8" stop-opacity=".3"/>` +
    `<stop offset="100%" stop-color="#5b3fd6" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="fundo" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${COR_FUNDO}"/>` +
    `<stop offset="100%" stop-color="#0b0420"/></linearGradient></defs>` +
    animacao +
    `<rect width="${l}" height="${a}" fill="url(#fundo)"/>` +
    `<ellipse cx="${l - 90}" cy="${a + 14}" rx="150" ry="46" fill="url(#planeta)"/>` +
    estrelas.join('') +
    `</svg>`
  )
}

/** Pede menos movimento: `BARRA_SEM_ANIMACAO` ligado, ou o "Reduzir movimento" do macOS (`defaults` imprime 1). */
export function pedeMenosMovimento(variavel: string | undefined, saidaDoDefaults: string | null): boolean {
  if (variavel && !['0', 'false', 'nao', 'não'].includes(variavel.trim().toLowerCase())) return true

  return saidaDoDefaults?.trim() === '1'
}
