import { expect, test } from 'claude-code/testing'

import { haQuanto, idade, jsonDaFerramenta, lerItem, lerSessoes, linhasDoPainel, projetoDaPasta, relogioSP, statusDe } from '../hooks/sessoes'

const AGORA = Date.UTC(2026, 10, 13, 15, 0)
const ha = (min: number) => new Date(AGORA - min * 60_000).toISOString()

test('projetoDaPasta: worktree conta como o repositório; barra no fim e vazio', () => {
  expect(projetoDaPasta('/p/ichikawa-plugins/.claude/worktrees/x-1')).toBe('ichikawa-plugins')
  expect(projetoDaPasta('/p/Izanagi/')).toBe('Izanagi')
  expect(projetoDaPasta('')).toBe(null)
  expect(projetoDaPasta(undefined)).toBe(null)
})

test('lerSessoes: não confia na resposta; aceita objeto único (get_session) e lista', () => {
  expect(lerSessoes(null)).toEqual([])
  expect(lerSessoes([{ title: 'sem id' }, 3, { sessionId: 'local_a', isRunning: 'sim', prNumber: '2' }])).toEqual([
    { sessionId: 'local_a', title: undefined, cwd: undefined, originCwd: undefined, isArchived: false, isRunning: false, prNumber: undefined, prState: undefined, lastActivityAt: undefined, createdAt: undefined, link: undefined },
  ])
  expect(lerSessoes({ sessionId: 'local_eu' })[0]?.sessionId).toBe('local_eu')
  expect(jsonDaFerramenta({ text: 'não é json' })).toBe(null)
  expect(lerItem('{')).toBe(null)
})

test('statusDe: rodando vence pergunta; pergunta vence mergeado', () => {
  expect(statusDe({ sessionId: 'a', isRunning: true }, true)).toBe('trabalhando')
  expect(statusDe({ sessionId: 'a', prState: 'MERGED' }, true)).toBe('aguarda')
  expect(statusDe({ sessionId: 'a', prState: 'MERGED' }, false)).toBe('mergeado')
  expect(statusDe({ sessionId: 'a' }, false)).toBe('parada')
})

test('tempo: relativo, idade e relógio de São Paulo', () => {
  expect(haQuanto(ha(0), AGORA)).toBe('agora')
  expect(haQuanto(new Date(AGORA - 40_000).toISOString(), AGORA)).toBe('há 40 s')
  expect(haQuanto(ha(3), AGORA)).toBe('há 3 min')
  expect(haQuanto(ha(125), AGORA)).toBe('há 2 h')
  expect(haQuanto(ha(3 * 1440), AGORA)).toBe('há 3 d')
  expect(haQuanto('lixo', AGORA)).toBe('—')
  expect(idade(ha(65), AGORA)).toBe('1 h 05')
  expect(idade(undefined, AGORA)).toBe(null)
  expect(relogioSP(AGORA)).toBe('12:00')
})

test('linhasDoPainel: só o projeto, sem arquivadas; item, PR e pergunta aberta; ordem por status e atividade', () => {
  const linhas = linhasDoPainel(
    [
      { sessionId: 'local_eu', title: 'ICH-F8 · Painel', cwd: '/p/kit/.claude/worktrees/w', isRunning: true, lastActivityAt: ha(0), createdAt: ha(65) },
      { sessionId: 'local_f7', title: 'ICH-F7 · Entregues', cwd: '/p/kit/.claude/worktrees/v', lastActivityAt: ha(10) },
      { sessionId: 'local_f4', title: 'ICH-F4 · Limpeza', cwd: '/p/kit', prNumber: 8, prState: 'MERGED', lastActivityAt: ha(2) },
      { sessionId: 'local_f3', title: 'ICH-F3 · Velha', cwd: '/p/kit', lastActivityAt: ha(1) },
      { sessionId: 'local_arq', cwd: '/p/kit', isArchived: true },
      { sessionId: 'local_izn', cwd: '/p/Izanagi', isRunning: true },
    ],
    [
      { id: 'F8', etapa: 'execucao', sessao: 'local_eu' },
      { id: 'F7', etapa: 'pr', sessao: 'local_f7', pr: 9 },
    ],
    [
      { id: 'Q1', estado: 'aberta', item: 'F7' },
      { id: 'Q2', estado: 'respondida', sessao: 'local_f3' },
    ],
    'kit',
    'local_eu',
    AGORA,
  )
  expect(linhas.map(l => l.sessionId)).toEqual(['local_f7', 'local_eu', 'local_f3', 'local_f4'])
  expect(linhas[0]).toMatchObject({ status: 'aguarda', icone: '◐', detalhe: 'aguarda você · PR aberto · PR #9', tempo: 'há 10 min' })
  expect(linhas[1]).toMatchObject({ status: 'trabalhando', propria: true, detalhe: 'trabalhando · execução', tempo: 'agora · aberta há 1 h 05' })
  expect(linhas[3]).toMatchObject({ status: 'mergeado', icone: '✓', detalhe: 'PR mergeado · PR #8' })
})
