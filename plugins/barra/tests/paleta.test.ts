import { expect, test } from 'claude-code/testing'
import { CORES_DIA, CORES_NOITE } from '../hooks/paleta'

const claro = (CORES_DIA.theme as unknown as { inputs: { light: Record<string, string> } }).inputs.light

test('o destaque do dia é o azul bebê das páginas, com o texto marinho por cima (ICH-F35)', () => {
  expect(claro['role-accent-fill']).toBe('#b8dcf7')
  expect(claro['role-accent-fill-hover']).toBe('#a6d2f4')
  expect(claro['role-accent-on']).toBe('#1f3a5f')
})

test('as duas paletas pintam no desktop (nenhum problema que o app recusa)', () => {
  for (const p of [CORES_DIA, CORES_NOITE]) expect(p.problems.filter((l) => /won't paint/.test(l))).toEqual([])
})
