import { expect, test } from 'claude-code/testing'

import { CICLO_CINTILA, estrelasDaLinha, linhaDeEstrelas, pedeMenosMovimento, svgDoCeu } from '../hooks/ceu'

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

test('svg do desktop: fundo do painel, planeta, cintilação em degraus de 1 s e parada por reduzir movimento', () => {
  const svg = svgDoCeu(960, false)
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).toMatch(/#030014/)
  expect(svg).toMatch(/radialGradient id="planeta"/)
  expect(svg).toMatch(new RegExp(`animation:cintila ${CICLO_CINTILA}s steps\\(${CICLO_CINTILA}`))
  expect(svg).toMatch(/prefers-reduced-motion:reduce/)
  expect(svg).not.toMatch(/<script|on[a-z]+=/i)
  expect(svgDoCeu(960, false)).toBe(svg)
  const parado = svgDoCeu(960, true)
  expect(parado).not.toMatch(/animation/)
  expect(parado).toMatch(/<circle/)
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
