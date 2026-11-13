import { expect, test } from 'claude-code/testing'

import { CENA_MAX, CICLO_CINTILA, ESPACO_SOL_BOTOES, SVG_ALTURA, TEMAS, estrelasDaLinha, larguraDaCena, linhaDeEstrelas, linhaDeNuvens, linhaDoCeu, modoDoAusente, pedeMenosMovimento, svgDaCena } from '../hooks/ceu'

test('estrelas do terminal: a linha tem a largura pedida, o mesmo céu a cada desenho e só estrela onde há', () => {
  const linha = linhaDeEstrelas(80, 0)
  expect([...linha]).toHaveLength(80)
  expect(linhaDeEstrelas(80, 0)).toBe(linha)
  expect(linha.replace(/[ ·✦⋆]/g, '')).toBe('')
  expect(estrelasDaLinha(80).length).toBeGreaterThan(5)
  expect(linhaDeEstrelas(0, 0)).toBe('')
})

test('estrelas do terminal: cintilam pelo quadro e, paradas, ficam acesas e iguais', () => {
  const quadros = Array.from({ length: CICLO_CINTILA }, (_, f) => linhaDeEstrelas(120, f))
  expect(new Set(quadros).size).toBeGreaterThan(1)
  expect(linhaDeEstrelas(120, CICLO_CINTILA)).toBe(quadros[0])
  const parada = linhaDeEstrelas(120, null)
  expect(parada).toBe(linhaDeEstrelas(120, null))
  expect(parada).not.toMatch(/⋆/)
})

test('cena da noite: começa no fundo do painel, planeta com limbo, cintilação em degraus de 1 s e parada', () => {
  const svg = svgDaCena('noite', 960, false)
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).toMatch(new RegExp(`stop-color="${TEMAS.noite.fundo}"`))
  expect(svg).toMatch(/radialGradient id="atmosfera"/)
  expect(svg).toMatch(new RegExp(`animation:cintila ${CICLO_CINTILA}s steps\\(${CICLO_CINTILA}`))
  expect(svg).toMatch(/prefers-reduced-motion:reduce/)
  expect(svg).not.toMatch(/<script|on[a-z]+=/i)
  expect(svgDaCena('noite', 960, false)).toBe(svg)
  const parado = svgDaCena('noite', 960, true)
  expect(parado).not.toMatch(/animation/)
  expect(parado).toMatch(/<circle/)
})

test('cena do dia: começa no azul do fundo, sol com raios, nuvens que derivam e param', () => {
  const svg = svgDaCena('dia', 960, false)
  expect(svg).toMatch(new RegExp(`stop-color="${TEMAS.dia.fundo}"`))
  expect(svg).toMatch(/radialGradient id="sol"/)
  expect(svg).toMatch(/class="nuvens"/)
  expect(svg).toMatch(/animation:deriva/)
  expect(svg).not.toMatch(/<script|on[a-z]+=/i)
  expect(svgDaCena('dia', 960, true)).not.toMatch(/animation/)
  expect(svgDaCena('dia', 50, false)).toMatch(/width="200"/)
})

test('modo: ausente ligado é noite; desligado ou não lido, dia', () => {
  expect(modoDoAusente(true)).toBe('noite')
  expect(modoDoAusente(false)).toBe('dia')
  expect(modoDoAusente(undefined)).toBe('dia')
})

test('terminal de dia: nuvens e o sol perto da ponta, largura certa e sem cintilar', () => {
  const linha = linhaDeNuvens(80)
  expect([...linha]).toHaveLength(80)
  expect(linha.replace(/[ ☁☀]/g, '')).toBe('')
  expect([...linha][77]).toBe('☀')
  expect(linhaDoCeu('dia', 80, 0)).toBe(linhaDoCeu('dia', 80, 1))
  expect(linhaDoCeu('noite', 80, 0)).toBe(linhaDeEstrelas(80, 0))
  expect(linhaDeNuvens(0)).toBe('')
})

test('menos movimento: a variável liga (0/false desligam), e o macOS com 1', () => {
  expect(pedeMenosMovimento(undefined, null)).toBe(false)
  expect(pedeMenosMovimento('1', null)).toBe(true)
  expect(pedeMenosMovimento('sim', '0')).toBe(true)
  expect(pedeMenosMovimento('0', null)).toBe(false)
  expect(pedeMenosMovimento('false', '1\n')).toBe(true)
  expect(pedeMenosMovimento(undefined, '1\n')).toBe(true)
  expect(pedeMenosMovimento(undefined, '0\n')).toBe(false)
})

test('cena do dia: o sol na ponta direita, com 50 px de céu antes dos botões, e a cena da altura da barra', () => {
  const svg = svgDaCena('dia', 300, true)
  expect(svg).toContain(`height="${SVG_ALTURA}"`)
  expect(svg).toContain(`<circle cx="${300 - ESPACO_SOL_BOTOES - 10}" cy="${SVG_ALTURA / 2}" r="10" fill="url(#sol)"/>`)
})

test('largura da cena: o que sobra entre o relógio e os botões, com teto, e nada quando não cabe', () => {
  const rotulos = ['☀ Ficar ausente', '◫ Painel', '◉ Contas']
  expect(larguraDaCena(200, '⧗ 59:00', rotulos)).toBe(CENA_MAX)
  const media = larguraDaCena(80, '⧗ 59:00', rotulos)
  expect(media !== null && media < CENA_MAX && media >= 140).toBe(true)
  expect(larguraDaCena(50, '⧗ 59:00', rotulos)).toBe(null)
})
