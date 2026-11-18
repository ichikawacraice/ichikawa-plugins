// A cena do dia: o céu claro da página do kit (orquestracao/lib/publico/ceu-dia.js), passado de canvas para SVG.
// Azul que clareia até o horizonte, os cantos de cima um tom mais fundo, nuvens que andam devagar e o sol enorme
// nascendo no rodapé, com o halo que respira e brilhos que sobem da borda. Mesma geometria do planeta da noite.

import { sorteio } from './fundo-noite'
import type { Efeitos } from './logica'

const L = 1600
const A = 1000

const NUVENS = 7
/** As nuvens ficam na metade de cima, longe do sol, e bem leves por cima do azul. */
const NUVEM_TOPO = 0.04
const NUVEM_FAIXA = 0.42
const NUVEM_ALFA_MIN = 0.35
const NUVEM_ALFA_VARIA = 0.3

// Sol (os números de ceu-dia.js numa tela de 1600 × 1000).
const ALTURA_SOL = 210
const RAIO = 1280
const HALO = 90
const BRILHOS = 24
const CX = L / 2
const TOPO = A - ALTURA_SOL
const CY = TOPO + RAIO

const n1 = (n: number) => (Math.round(n * 10) / 10).toString()
const n2 = (n: number) => (Math.round(n * 100) / 100).toString()

// Com menos movimento pedido, tudo para onde está (as nuvens ficam espalhadas, não empilhadas no começo do caminho).
const ESTILO =
  '@keyframes halo{0%,100%{opacity:.4}50%{opacity:1}}' +
  '.halo{animation:halo 14s ease-in-out infinite}' +
  '@keyframes sobe{0%{transform:translate(0,0);opacity:0}50%{opacity:.95}100%{transform:translate(0,var(--d));opacity:0}}' +
  '.br{opacity:0;animation:sobe linear infinite}' +
  '@keyframes anda{from{transform:translate(var(--de),0)}to{transform:translate(var(--ate),0)}}' +
  '.nv{animation:anda linear infinite}' +
  '@media (prefers-reduced-motion:reduce){.halo,.br,.nv{animation-play-state:paused}}'

/** Poucos: as nuvens andam em passinhos (alguns por segundo) e o halo e os brilhos param; nenhum: tudo para onde está. */
const PASSOS_POR_SEGUNDO = 2
const PARADO = '.halo,.br{animation-play-state:paused}'
const ESTILO_DO_NIVEL: Record<Efeitos, string> = {
  completo: '',
  poucos: PARADO,
  nenhum: `${PARADO}.nv{animation-play-state:paused}`,
}

function defs(): string {
  return (
    '<defs>' +
    '<linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#74b6ef"/><stop offset=".45" stop-color="#9ccdf4"/><stop offset=".78" stop-color="#d6ebfb"/><stop offset="1" stop-color="#ffeccb"/></linearGradient>' +
    '<radialGradient id="canto"><stop offset="0" stop-color="#2878d7" stop-opacity=".2"/><stop offset="1" stop-color="#2878d7" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="bolha" fx=".5" fy=".4"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".6" stop-color="#fafcff" stop-opacity=".75"/><stop offset="1" stop-color="#ebf4ff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="sombra-nuvem"><stop offset="0" stop-color="#b4cdeb" stop-opacity=".3"/><stop offset="1" stop-color="#b4cdeb" stop-opacity="0"/></radialGradient>' +
    `<radialGradient id="aura" gradientUnits="userSpaceOnUse" cx="${CX}" cy="${CY}" r="${RAIO + HALO * 2.6}" fr="${RAIO * 0.97}"><stop offset="0" stop-color="#ffc45c" stop-opacity=".42"/><stop offset=".2" stop-color="#ffd282" stop-opacity=".26"/><stop offset=".55" stop-color="#ffe4af" stop-opacity=".1"/><stop offset="1" stop-color="#ffecc8" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="${CX}" cy="${CY}" r="${RAIO + HALO}" fr="${RAIO * 0.995}"><stop offset="0" stop-color="#fff4c8" stop-opacity=".85"/><stop offset=".15" stop-color="#ffd678" stop-opacity=".45"/><stop offset=".5" stop-color="#ffd28c" stop-opacity=".12"/><stop offset="1" stop-color="#ffd28c" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="sol" gradientUnits="userSpaceOnUse" cx="${CX}" cy="${CY}" r="${RAIO}" fr="${RAIO * 0.55}"><stop offset="0" stop-color="#fffdf4"/><stop offset=".7" stop-color="#fff3c8"/><stop offset=".9" stop-color="#ffe08a"/><stop offset=".97" stop-color="#ffc95c"/><stop offset="1" stop-color="#ffb83f"/></radialGradient>` +
    '</defs>'
  )
}

function ceuFixo(): string {
  const m = Math.max(L, A) * 0.55

  return (
    `<rect width="${L}" height="${A}" fill="url(#ceu)"/>` +
    `<circle cx="0" cy="0" r="${m}" fill="url(#canto)"/><circle cx="${L}" cy="0" r="${m}" fill="url(#canto)"/>`
  )
}

/** Uma nuvem: bolhas brancas sobrepostas, a do meio mais alta, e uma sombra azulada achatada na base. */
function nuvem(r: () => number, largura: number): string {
  const alto = largura * 0.5
  const n = 5 + Math.floor(r() * 3)
  let bolhas = `<ellipse cx="${n1(largura / 2)}" cy="${n1(alto * 0.68)}" rx="${n1(largura * 0.42)}" ry="${n1(alto * 0.12)}" fill="url(#sombra-nuvem)"/>`
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const x = largura * (0.14 + t * 0.72)
    const meio = 1 - Math.abs(t - 0.5) * 1.4
    const raio = largura * (0.1 + meio * 0.12 + r() * 0.05)
    const y = alto * 0.68 - raio * (0.35 + meio * 0.4)
    bolhas += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(raio)}" fill="url(#bolha)"/>`
  }

  return bolhas
}

/** As nuvens atravessam da esquerda para a direita e voltam a entrar pela esquerda, cada uma no seu passo. */
function nuvens(efeitos: Efeitos): string {
  const r = sorteio(21)

  return Array.from({ length: NUVENS }, (_, i) => {
    const largura = Math.min(L * 0.55, 260) * (0.55 + r() * 0.6)
    const desenho = nuvem(r, largura)
    const inicio = r()
    const y = (NUVEM_TOPO + ((i + 0.3 + r() * 0.4) / NUVENS) * NUVEM_FAIXA) * A
    const vel = 1.5 + r() * 3.5
    const alfa = NUVEM_ALFA_MIN + r() * NUVEM_ALFA_VARIA
    const volta = (L + largura) / vel

    return (
      `<g transform="translate(0 ${n1(y)})" opacity="${n2(alfa)}">` +
      `<g class="nv" style="--de:-${n1(largura)}px;--ate:${L}px;animation-duration:${n1(volta)}s;animation-delay:-${n1(inicio * volta)}s${efeitos === 'poucos' ? `;animation-timing-function:steps(${Math.round(volta * PASSOS_POR_SEGUNDO)})` : ''}">${desenho}</g></g>`
    )
  }).join('')
}

function sol(): string {
  const r = sorteio(1234)
  const brilhos = Array.from({ length: BRILHOS }, () => {
    const x = r() * L
    const fase = r()
    const ritmo = 0.012 + r() * 0.02
    const subida = 30 + r() * 70
    const tam = r() < 0.25 ? 2 : 1.3
    const dx = x - CX
    const limbo = CY - Math.sqrt(RAIO * RAIO - dx * dx) - 4
    const ciclo = 1 / ritmo

    return `<rect class="br" x="${n1(x)}" y="${n1(limbo)}" width="${tam}" height="${tam}" fill="#fffceb" style="--d:-${n1(subida)}px;animation-duration:${n1(ciclo)}s;animation-delay:-${n1(fase * ciclo)}s"/>`
  }).join('')

  return (
    `<circle cx="${CX}" cy="${CY}" r="${RAIO + HALO * 2.6}" fill="url(#aura)"/>` +
    `<circle class="halo" cx="${CX}" cy="${CY}" r="${RAIO + HALO}" fill="url(#halo)"/>` +
    `<circle cx="${CX}" cy="${CY}" r="${RAIO}" fill="url(#sol)"/>` +
    `<circle cx="${CX}" cy="${CY}" r="${RAIO}" fill="none" stroke="#fffae1" stroke-opacity=".95" stroke-width="1.2"/>` +
    brilhos
  )
}

/** O SVG inteiro do dia. Determinístico. */
export function svgDoDia(efeitos: Efeitos = 'completo'): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${A}" preserveAspectRatio="xMidYMax slice">` +
    `<style>${ESTILO}${ESTILO_DO_NIVEL[efeitos]}</style>` +
    defs() +
    ceuFixo() +
    nuvens(efeitos) +
    sol() +
    '</svg>'
  )
}
