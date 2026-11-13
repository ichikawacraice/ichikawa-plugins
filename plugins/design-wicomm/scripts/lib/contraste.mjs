// A aritmética de contraste da WCAG 2.1 e a leitura das cores que um token CSS
// pode ter. `luminancia`, `razao` e `sobre` são CÓPIA de
// `packages/tokens/lib/contraste.mjs` (o plugin é instalado sozinho); o teste
// de concordância compara as duas. O resto é deste plugin: ler `#hex`,
// `rgb()`, `hsl()`, os canais soltos do shadcn (`222 84% 5%`) e `oklch()`.

/** Luminância relativa (WCAG 2.1) de um hex de 6 dígitos. */
export function luminancia(hex) {
  const canais = hex.replace('#', '').match(/../g).map((c) => parseInt(c, 16) / 255)
  const lin = canais.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** A razão entre duas tintas, arredondada a duas casas. */
export function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)]
  return Number(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2))
}

/** Compõe `cor` a `alfa` sobre `fundo`. */
export function sobre(cor, alfa, fundo) {
  const p = (h) => h.replace('#', '').match(/../g).map((c) => parseInt(c, 16))
  const [f, b] = [p(cor), p(fundo)]
  return '#' + f.map((v, i) => Math.round(v * alfa + b[i] * (1 - alfa)).toString(16).padStart(2, '0')).join('')
}

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
const doRgb = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase()
const numero = (s, escala = 1) => (s.endsWith('%') ? (parseFloat(s) / 100) * escala : parseFloat(s))
const alfaDe = (s) => (s === undefined ? 1 : s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s))

function hslParaRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

function oklchParaRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return lin.map((c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055))
}

/** Os argumentos de uma função de cor, com o alfa à parte (`a b c / d` ou `a, b, c, d`). */
function argumentos(corpo) {
  const [cor, barra] = corpo.split('/')
  const partes = cor.trim().split(/[\s,]+/).filter(Boolean)
  return { partes: partes.slice(0, 3), alfa: barra?.trim() ?? partes[3] }
}

/**
 * A cor de um valor de token: `{ hex, alfa }`, ou `null` quando não é cor que se
 * mede (gradiente, `currentColor`…). `transparent` é alfa 0. `var(--x)` resolve
 * por `vars`, até 8 saltos.
 */
export function lerCor(valor, vars = {}, saltos = 0) {
  const v = String(valor ?? '').trim()
  if (!v) return null
  const ref = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(v)
  if (ref) return saltos > 8 ? null : lerCor(vars[ref[1]] ?? ref[2], vars, saltos + 1)
  if (/^transparent$/i.test(v)) return { hex: '#000000', alfa: 0 }
  if (/^white$/i.test(v)) return { hex: '#FFFFFF', alfa: 1 }
  if (/^black$/i.test(v)) return { hex: '#000000', alfa: 1 }
  let m = /^#([0-9a-f]{3,8})$/i.exec(v)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    return { hex: `#${h.slice(0, 6)}`.toUpperCase(), alfa: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 }
  }
  m = /^(rgba?|hsla?|oklch)\((.+)\)$/i.exec(v)
  const nua = !m && /^-?[\d.]+(?:deg)?\s+[\d.]+%\s+[\d.]+%(?:\s*\/\s*[\d.]+%?)?$/.test(v)
  if (!m && !nua) return null
  const fn = m ? m[1].toLowerCase() : 'hsl'
  const { partes, alfa } = argumentos(m ? m[2] : v)
  if (partes.length < 3) return null
  let rgb
  if (fn.startsWith('rgb')) rgb = partes.map((p) => numero(p, 255))
  else if (fn.startsWith('hsl')) rgb = hslParaRgb(parseFloat(partes[0]), numero(partes[1], 1) / (partes[1].endsWith('%') ? 1 : 100), numero(partes[2], 1) / (partes[2].endsWith('%') ? 1 : 100))
  else rgb = oklchParaRgb(numero(partes[0], 1), numero(partes[1], 0.4), parseFloat(partes[2]) || 0)
  if (rgb.some((n) => Number.isNaN(n))) return null
  return { hex: doRgb(...rgb), alfa: alfaDe(alfa) }
}

/** A cor que se vê: compõe o alfa sobre o fundo (opaco). */
export const opaca = (cor, fundo) => (cor.alfa >= 1 ? cor.hex : sobre(cor.hex, cor.alfa, fundo))
