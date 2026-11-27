import { expect, test } from 'claude-code/testing'

import { aindaFresco, idsProcurados, jsonDaFerramenta, juntarSessoes, lerSessoes, textoDoArquivo } from '../hooks/sessoes'

const AGORA = Date.UTC(2026, 10, 13, 15, 0)
const em = (msAtras: number) => JSON.stringify({ lidoEm: new Date(AGORA - msAtras).toISOString() })

test('lerSessoes: não confia na resposta; aceita objeto único (get_session) e lista; descarta campos que a página não usa', () => {
  expect(lerSessoes(null)).toEqual([])
  expect(lerSessoes([{ title: 'sem id' }, 3, { sessionId: 'local_a', isRunning: 'sim', prNumber: '2', group: 'g' }])).toEqual([
    { sessionId: 'local_a', title: undefined, cwd: undefined, originCwd: undefined, isArchived: false, isRunning: false, prNumber: undefined, prState: undefined, lastActivityAt: undefined, link: undefined },
  ])
  expect(lerSessoes({ sessionId: 'local_eu' })[0]?.sessionId).toBe('local_eu')
  expect(jsonDaFerramenta({ text: 'não é json' })).toBe(null)
})

test('idsProcurados: só id do app, sem repetir, até 20; ausente ou ilegível é nenhum (ICH-F52)', () => {
  const id = (n: number) => `local_${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`
  expect(idsProcurados(null)).toEqual([])
  expect(idsProcurados('{')).toEqual([])
  expect(idsProcurados('{"sessoes": "local_x"}')).toEqual([])
  expect(idsProcurados(JSON.stringify({ sessoes: [id(1), id(1), 'local_curto', 'b82d761a-df18-4096-9c8a-362d942e037a', 7] }))).toEqual([id(1)])
  expect(idsProcurados(JSON.stringify({ sessoes: Array.from({ length: 25 }, (_, n) => id(n)) }))).toHaveLength(20)
})

test('aindaFresco: menos de 50 s é fresco; ausente, ilegível, velho ou do futuro não', () => {
  expect(aindaFresco(em(20_000), AGORA)).toBe(true)
  expect(aindaFresco(em(50_000), AGORA)).toBe(false)
  expect(aindaFresco(em(-5_000), AGORA)).toBe(false)
  expect(aindaFresco(null, AGORA)).toBe(false)
  expect(aindaFresco('{', AGORA)).toBe(false)
  expect(aindaFresco('{}', AGORA)).toBe(false)
})

test('juntarSessoes e textoDoArquivo: a própria primeiro, sem repetir; lidoEm em ISO e quem gravou', () => {
  const juntas = juntarSessoes([{ sessionId: 'eu' }], [{ sessionId: 'a' }, { sessionId: 'eu', title: 'repetida' }])
  expect(juntas.map(s => s.sessionId)).toEqual(['eu', 'a'])
  expect(JSON.parse(textoDoArquivo(juntas, AGORA, 'eu'))).toEqual({ lidoEm: new Date(AGORA).toISOString(), por: 'eu', sessoes: juntas })
})
