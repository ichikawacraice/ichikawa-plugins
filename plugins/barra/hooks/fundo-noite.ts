// A cena do fundo do app, à noite: o mesmo céu da página do kit (orquestracao/lib/publico/ceu.js e planeta.js), passado de canvas para SVG.
// Via láctea em diagonal, nebulosas, duas galáxias espirais, constelações e estrelas que cintilam, estrelas cadentes de vez em quando
// e o planeta nascendo no rodapé, com o halo que respira e as fagulhas que sobem do limbo. Só CSS: a cena não roda script.

/** Tamanho do desenho. A raiz usa `xMidYMax slice`: em janela larga corta o alto, e o planeta fica sempre colado no pé. */
const L = 1600
const A = 1000

const POEIRA_TENTATIVAS = 2400
const CINTILANTES = 45
const CONSTELACOES = 4
const FAGULHAS = 28

// Planeta (os mesmos números de planeta.js, numa tela de 1600 × 1000).
const ALTURA_PLANETA = 210
const RAIO = 1280
const HALO = 70
const ATMOSFERA = 60
const CX = L / 2
const TOPO = A - ALTURA_PLANETA
const CY = TOPO + RAIO

/** Estrelas cadentes: cada uma tem o próprio ciclo (sorteado entre 30 e 80 s) e anda por pontos sorteados do céu, então caem de lugares e em intervalos que não se repetem. Média: uma a cada ~9 s. */
const CADENTES = 6
const PONTOS_POR_CADENTE = 7
const CICLO_MIN = 30
const CICLO_VARIA = 50
/** Quanto dura a queda, em segundos. */
const QUEDA = 1.1

/** Estrelas que piscam como as da barra: em degraus de 1 s num ciclo de 4 s, uma em cada 3. */
const PISCANTES = 160
const CICLO_PISCA = 4
const PISCA_A_CADA = 3
const CORES_PISCA = ['#ffffff', '#d9d0ff', '#c8a8ff', '#9fb4ff']

/** Gerador determinístico (o mesmo de ceu.js): o céu é igual a cada carga. */
export function sorteio(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const n1 = (n: number) => (Math.round(n * 10) / 10).toString()
const n2 = (n: number) => (Math.round(n * 100) / 100).toString()

/** Distância (0 a 1) do ponto à faixa da via láctea, que cruza de baixo à esquerda ao alto à direita. */
function pertoDaFaixa(x: number, y: number): number {
  const d = Math.abs((x / L) * 0.9 + y / A - 1.05) / 1.35
  return Math.max(0, 1 - d * 3.2)
}

const ESTILO =
  '@keyframes tw{0%,100%{opacity:.25}50%{opacity:.85}}' +
  '.tw{animation:tw ease-in-out infinite}' +
  '@keyframes halo{0%,100%{opacity:.4}50%{opacity:1}}' +
  '.halo{animation:halo 14s ease-in-out infinite}' +
  '@keyframes sobe{0%{transform:translate(0,0);opacity:0}50%{opacity:.9}100%{transform:translate(0,var(--d));opacity:0}}' +
  '.fa{opacity:0;animation:sobe linear infinite}' +
  '.cad{opacity:0}' +
  '@keyframes pisca{0%{opacity:1}25%{opacity:.35}50%{opacity:.85}75%{opacity:.2}100%{opacity:1}}' +
  `.p{animation:pisca ${CICLO_PISCA}s steps(${CICLO_PISCA},jump-none) infinite}` +
  Array.from({ length: CICLO_PISCA - 1 }, (_, k) => `.p${k + 1}{animation-delay:-${k + 1}s}`).join('') +
  '@media (prefers-reduced-motion:reduce){.tw,.halo,.fa,.cad,.rota,.p{animation:none!important}.fa{opacity:.6}}'

function defs(): string {
  return (
    '<defs>' +
    '<linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#01000b"/><stop offset=".55" stop-color="#020110"/><stop offset="1" stop-color="#050218"/></linearGradient>' +
    '<radialGradient id="neb1"><stop offset="0" stop-color="#4c3cdc" stop-opacity=".045"/><stop offset="1" stop-color="#4c3cdc" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="neb2"><stop offset="0" stop-color="#8b46ff" stop-opacity=".055"/><stop offset="1" stop-color="#8b46ff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="neb3"><stop offset="0" stop-color="#6e46e6" stop-opacity=".025"/><stop offset="1" stop-color="#6e46e6" stop-opacity="0"/></radialGradient>' +
    `<linearGradient id="faixa" gradientUnits="userSpaceOnUse" x1="0" y1="${A}" x2="${L}" y2="0"><stop offset=".3" stop-color="#788cff" stop-opacity="0"/><stop offset=".52" stop-color="#967dff" stop-opacity=".09"/><stop offset=".75" stop-color="#788cff" stop-opacity="0"/></linearGradient>` +
    '<radialGradient id="brilho"><stop offset="0" stop-color="#ebeeff"/><stop offset=".25" stop-color="#aaa0ff" stop-opacity=".35"/><stop offset="1" stop-color="#786eff" stop-opacity="0"/></radialGradient>' +
    '<radialGradient id="nucleo"><stop offset="0" stop-color="#fff6ea" stop-opacity=".95"/><stop offset=".12" stop-color="#e6d2ff" stop-opacity=".55"/><stop offset=".45" stop-color="#8f7cff" stop-opacity=".14"/><stop offset="1" stop-color="#5b3fd6" stop-opacity="0"/></radialGradient>' +
    '<filter id="nevoa" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>' +
    '<linearGradient id="rastro" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="160" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#d9d0ff" stop-opacity=".6"/><stop offset="1" stop-color="#9fb4ff" stop-opacity="0"/></linearGradient>' +
    // Planeta
    `<radialGradient id="aura" gradientUnits="userSpaceOnUse" cx="${CX}" cy="${CY}" r="${RAIO + HALO * 2.2}" fr="${RAIO * 0.97}"><stop offset="0" stop-color="#a83cdc" stop-opacity=".24"/><stop offset=".18" stop-color="#8b46f0" stop-opacity=".16"/><stop offset=".5" stop-color="#5b3fd6" stop-opacity=".08"/><stop offset="1" stop-color="#5b3fd6" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="${CX}" cy="${CY}" r="${RAIO + HALO}" fr="${RAIO * 0.995}"><stop offset="0" stop-color="#e1b4ff" stop-opacity=".55"/><stop offset=".12" stop-color="#a855f7" stop-opacity=".32"/><stop offset=".45" stop-color="#8f7cff" stop-opacity=".1"/><stop offset="1" stop-color="#8f7cff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="corpo" gradientUnits="userSpaceOnUse" x1="0" y1="${TOPO}" x2="0" y2="${A}"><stop offset="0" stop-color="#120a26"/><stop offset=".35" stop-color="#090718"/><stop offset="1" stop-color="#05050f"/></linearGradient>` +
    `<radialGradient id="atmosfera" gradientUnits="userSpaceOnUse" cx="${CX}" cy="${CY}" r="${RAIO}" fr="${RAIO - ATMOSFERA}"><stop offset="0" stop-color="#5b3fd6" stop-opacity="0"/><stop offset=".5" stop-color="#6e3cdc" stop-opacity=".1"/><stop offset=".82" stop-color="#9346e6" stop-opacity=".3"/><stop offset=".96" stop-color="#c882fa" stop-opacity=".62"/><stop offset="1" stop-color="#f5e1ff" stop-opacity=".9"/></radialGradient>` +
    `<linearGradient id="sombra" gradientUnits="userSpaceOnUse" x1="0" y1="${TOPO}" x2="0" y2="${A}"><stop offset="0" stop-color="#05050f" stop-opacity="0"/><stop offset=".45" stop-color="#05050f" stop-opacity=".35"/><stop offset="1" stop-color="#05050f" stop-opacity=".85"/></linearGradient>` +
    '</defs>'
  )
}

function ceuFixo(): string {
  const m = Math.max(L, A)
  let s =
    `<rect width="${L}" height="${A}" fill="url(#fundo)"/>` +
    `<circle cx="${L * 0.15}" cy="${A * 0.85}" r="${m * 0.55}" fill="url(#neb1)"/>` +
    `<circle cx="${L * 0.85}" cy="${A * 0.12}" r="${m * 0.5}" fill="url(#neb2)"/>` +
    `<circle cx="${L * 0.5}" cy="${A * 0.5}" r="${m * 0.35}" fill="url(#neb3)"/>`

  // A poeira do braço da galáxia: estrelas minúsculas, mais densas perto da faixa. Duas cores, um <g> por cor.
  const r = sorteio(7)
  const grupos: [string[], string[]] = [[], []]
  for (let i = 0; i < POEIRA_TENTATIVAS; i++) {
    const x = r() * L
    const y = r() * A
    const perto = pertoDaFaixa(x, y)
    if (r() > 0.18 + perto * 0.82) continue
    const a = Math.min(1, 0.35 + r() * 0.6 * (0.4 + perto))
    const raio = r() < 0.05 ? 1.1 : 0.65
    grupos[r() < 0.5 ? 0 : 1].push(`<circle cx="${n1(x)}" cy="${n1(y)}" r="${raio}" opacity="${n2(a)}"/>`)
  }
  s += `<g fill="#c8d2ff">${grupos[0].join('')}</g><g fill="#dcc8ff">${grupos[1].join('')}</g>`
  s += `<rect width="${L}" height="${A}" fill="url(#faixa)"/>`

  return s + galaxia(1270, 230, 1, -28, 11) + galaxia(300, 360, 0.6, 34, 23)
}

/** Uma galáxia espiral distante: núcleo claro e dois braços enevoados, vista inclinada (achatada no eixo y). */
function galaxia(x: number, y: number, escala: number, giro: number, semente: number): string {
  const r = sorteio(semente)
  const bracos: string[] = []
  for (let b = 0; b < 2; b++) {
    const pts: string[] = []
    for (let k = 0; k <= 24; k++) {
      const t = k / 24
      const ang = b * Math.PI + t * Math.PI * 1.6
      const raio = 6 + t * 58
      pts.push(`${n1(Math.cos(ang) * raio)} ${n1(Math.sin(ang) * raio)}`)
    }
    bracos.push(`<path d="M${pts.join(' L')}" fill="none" stroke="#b9a8ff" stroke-width="${n1(9 - b)}" stroke-linecap="round" opacity=".22" filter="url(#nevoa)"/>`)
  }
  const pontos = Array.from({ length: 26 }, () => {
    const ang = r() * Math.PI * 2
    const d = 8 + r() * 58

    return `<circle cx="${n1(Math.cos(ang) * d)}" cy="${n1(Math.sin(ang) * d)}" r=".7" fill="#e8e0ff" opacity="${n2(0.3 + r() * 0.5)}"/>`
  }).join('')

  return (
    `<g transform="translate(${x} ${y}) rotate(${giro}) scale(${escala} ${n2(escala * 0.42)})">` +
    `<circle r="80" fill="url(#nucleo)" opacity=".55"/>${bracos.join('')}${pontos}<circle r="22" fill="url(#nucleo)"/></g>`
  )
}

/** Uma estrela com brilho que cintila: ciclo e fase próprios, como em ceu.js (ritmo de 0,4 a 1,3 rad/s). */
function cintilante(x: number, y: number, raio: number, ritmo: number, fase: number): string {
  const ciclo = (Math.PI * 2) / ritmo
  const atraso = (fase / (Math.PI * 2)) * ciclo

  return `<circle class="tw" cx="${n1(x)}" cy="${n1(y)}" r="${n1(raio * 4)}" fill="url(#brilho)" style="animation-duration:${n1(ciclo)}s;animation-delay:-${n1(atraso)}s"/>`
}

function estrelasVivas(): string {
  const r = sorteio(42)
  let s = ''
  for (let c = 0; c < CONSTELACOES; c++) {
    let x = (0.12 + r() * 0.76) * L
    let y = ((c + 0.5) / CONSTELACOES) * TOPO * 0.95 + (r() - 0.5) * A * 0.1
    const pts: Array<[number, number, number]> = []
    const n = 4 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      pts.push([x, y, r() * Math.PI * 2])
      x += (r() - 0.5) * 420 * 0.32
      y += (r() - 0.35) * 46
    }
    s += `<polyline points="${pts.map(p => `${n1(p[0])},${n1(p[1])}`).join(' ')}" fill="none" stroke="#a0aaff" stroke-opacity=".16" stroke-width=".6"/>`
    s += pts.map(p => cintilante(p[0], p[1], 1.3, 0.8, p[2])).join('')
  }
  const q = sorteio(99)
  for (let i = 0; i < CINTILANTES; i++) {
    const x = q() * L
    const y = q() * TOPO
    const fase = q() * Math.PI * 2
    const ritmo = 0.4 + q() * 0.9
    s += cintilante(x, y, 0.8 + q() * 1.1, ritmo, fase)
  }

  return s
}

/** Estrelas como as da barra: pontos nítidos de quatro cores; uma em cada 3 pisca em degraus, cada uma num quadro do ciclo. */
function piscantes(): string {
  const r = sorteio(77)
  let s = ''
  for (let i = 0; i < PISCANTES; i++) {
    const x = n1(r() * L)
    const y = n1(r() * TOPO)
    const raio = (0.6 + r() * 0.9).toFixed(2)
    const cor = CORES_PISCA[Math.floor(r() * CORES_PISCA.length)]
    const quadro = Math.floor(r() * CICLO_PISCA)
    const classe = i % PISCA_A_CADA === 1 ? ` class="p${quadro ? ` p${quadro}` : ''}"` : ''
    s += `<circle cx="${x}" cy="${y}" r="${raio}" fill="${cor}"${classe}/>`
  }

  return s
}

/**
 * Cada cadente: um grupo de fora que salta entre pontos sorteados (sem deslizar) e, dentro, a queda no seu ciclo.
 * O grupo de fora tem um período que não é múltiplo do ciclo, então cada queda sai de um ponto diferente.
 * `acaso` é `Math.random` na vida real: um céu novo a cada sessão.
 */
function cadentes(acaso: () => number): string {
  let estilo = ''
  let corpo = ''
  for (let i = 0; i < CADENTES; i++) {
    const ciclo = CICLO_MIN + acaso() * CICLO_VARIA
    const passeio = PONTOS_POR_CADENTE * ciclo * (1.21 + acaso() * 0.5)
    const pontos = Array.from({ length: PONTOS_POR_CADENTE }, (_, k) => {
      const x = 200 + acaso() * (L - 200)
      const y = 20 + acaso() * 520

      return `${n2((k / PONTOS_POR_CADENTE) * 100)}%{transform:translate(${n1(x)}px,${n1(y)}px)}`
    })
    const angulo = 15 + acaso() * 25
    const espelho = acaso() < 0.5 ? 'scale(-1 1) ' : ''
    const percurso = 380 + acaso() * 220
    const fim = n2((QUEDA / ciclo) * 100)
    estilo +=
      `@keyframes r${i}{${pontos.join('')}}` +
      `@keyframes c${i}{0%{transform:translate(0,0);opacity:0}${n2(Number(fim) * 0.12)}%{opacity:1}${fim}%{transform:translate(-${n1(percurso)}px,0);opacity:0}100%{transform:translate(-${n1(percurso)}px,0);opacity:0}}`
    corpo +=
      `<g class="rota" style="animation:r${i} ${n1(passeio)}s step-end infinite;animation-delay:-${n1(acaso() * passeio)}s">` +
      `<g transform="${espelho}rotate(-${n1(angulo)})">` +
      `<g class="cad" style="animation:c${i} ${n1(ciclo)}s linear infinite;animation-delay:${n1(2 + acaso() * ciclo)}s">` +
      '<path d="M0 0 L160 0" stroke="url(#rastro)" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle r="1.8" fill="#ffffff"/><circle r="6" fill="url(#brilho)"/></g></g></g>'
  }

  return `<style>${estilo}</style>${corpo}`
}

function planeta(): string {
  const r = sorteio(1234)
  const fagulhas = Array.from({ length: FAGULHAS }, () => {
    const x = r() * L
    const fase = r()
    const ritmo = 0.012 + r() * 0.02
    const subida = 30 + r() * 70
    const tam = r() < 0.25 ? 1.7 : 1.1
    const dx = x - CX
    const limbo = CY - Math.sqrt(RAIO * RAIO - dx * dx) - 4
    const ciclo = 1 / ritmo

    return `<rect class="fa" x="${n1(x)}" y="${n1(limbo)}" width="${tam}" height="${tam}" fill="#ebdcff" style="--d:-${n1(subida)}px;animation-duration:${n1(ciclo)}s;animation-delay:-${n1(fase * ciclo)}s"/>`
  }).join('')

  return (
    `<circle cx="${CX}" cy="${CY}" r="${RAIO + HALO * 2.2}" fill="url(#aura)"/>` +
    `<circle class="halo" cx="${CX}" cy="${CY}" r="${RAIO + HALO}" fill="url(#halo)"/>` +
    `<circle cx="${CX}" cy="${CY}" r="${RAIO}" fill="url(#corpo)"/>` +
    `<circle cx="${CX}" cy="${CY}" r="${RAIO}" fill="url(#atmosfera)"/>` +
    `<circle cx="${CX}" cy="${CY}" r="${RAIO}" fill="url(#sombra)"/>` +
    `<circle cx="${CX}" cy="${CY}" r="${RAIO}" fill="none" stroke="#f0e1ff" stroke-opacity=".85" stroke-width="1.2"/>` +
    fagulhas
  )
}

/** O SVG inteiro da cena. O céu é fixo; só as cadentes mudam com `acaso`. */
export function svgDoCeu(acaso: () => number = Math.random): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L} ${A}" preserveAspectRatio="xMidYMax slice">` +
    `<style>${ESTILO}</style>` +
    defs() +
    ceuFixo() +
    piscantes() +
    estrelasVivas() +
    cadentes(acaso) +
    planeta() +
    '</svg>'
  )
}
