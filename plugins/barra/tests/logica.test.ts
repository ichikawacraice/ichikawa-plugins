import { expect, test } from 'claude-code/testing'

import {
  argvDesacoplado,
  instalacaoAqui,
  isoSaoPaulo,
  lerAusente,
  lerBarraJson,
  lerContador,
  lerPedido,
  mesclarLigados,
  nivelDoCache,
  ordenarBotoes,
  pluginsLigados,
  relogio,
  rotuloComSelo,
  textoDoAusente,
  trocarRaiz,
} from '../hooks/logica.js'

const RAIZ = '/cache/ichikawa/orquestracao/1.0.0'
const PLUGIN = { id: 'orquestracao@ichikawa', raiz: RAIZ }

test('mesclarLigados: a fonte de maior precedência vence chave a chave; valor não booleano é ignorado', () => {
  const user = { 'a@m': true, 'b@m': true, 'c@m': false }
  const project = { 'b@m': false, 'c@m': 'sim' }
  const local = { 'c@m': true }
  expect(mesclarLigados([user, project, local, undefined, null])).toEqual({ 'a@m': true, 'b@m': false, 'c@m': true })
  expect(mesclarLigados([local, user]), 'a ordem é a precedência').toEqual({ 'a@m': true, 'b@m': true, 'c@m': false })
  expect(mesclarLigados([[], 'x', 3])).toEqual({})
})

test('instalacaoAqui: local e project só do próprio projeto; senão user; senão managed', () => {
  const entradas = [
    { scope: 'user', installPath: '/c/u' },
    { scope: 'project', projectPath: '/p/outro', installPath: '/c/outro' },
    { scope: 'project', projectPath: '/p/este', installPath: '/c/proj' },
    { scope: 'local', projectPath: '/p/este/', installPath: '/c/local/' },
  ]
  expect(instalacaoAqui(entradas, '/p/este')).toBe('/c/local')
  expect(instalacaoAqui(entradas.slice(0, 3), '/p/este')).toBe('/c/proj')
  expect(instalacaoAqui(entradas.slice(0, 2), '/p/este'), 'a de outro projeto não vale').toBe('/c/u')
  expect(instalacaoAqui([entradas[1]], '/p/este')).toBeNull()
  expect(instalacaoAqui([{ scope: 'managed', installPath: '/c/m' }], null)).toBe('/c/m')
  expect(instalacaoAqui('lixo', '/p')).toBeNull()
})

test('pluginsLigados: só o instalado e ligado; desligado ou sem instalação aqui fica de fora', () => {
  const instalados = {
    version: 2,
    plugins: {
      'contas@ichikawa': [{ scope: 'user', installPath: '/c/contas' }],
      'orquestracao@ichikawa': [{ scope: 'user', installPath: RAIZ }],
      'desligado@ichikawa': [{ scope: 'user', installPath: '/c/d' }],
      'outro-projeto@ichikawa': [{ scope: 'project', projectPath: '/p/x', installPath: '/c/x' }],
    },
  }
  const ligados = { 'contas@ichikawa': true, 'orquestracao@ichikawa': true, 'desligado@ichikawa': false, 'outro-projeto@ichikawa': true, 'nao-instalado@ichikawa': true }
  expect(pluginsLigados(instalados, ligados, '/p/este')).toEqual([
    { id: 'contas@ichikawa', raiz: '/c/contas' },
    { id: 'orquestracao@ichikawa', raiz: RAIZ },
  ])
  expect(pluginsLigados(null, ligados, '/p')).toEqual([])
})

test('trocarRaiz: troca toda ocorrência, em cada argumento, e nada mais', () => {
  expect(trocarRaiz(['node', '${CLAUDE_PLUGIN_ROOT}/bin/a.mjs', '--x=${CLAUDE_PLUGIN_ROOT}:${CLAUDE_PLUGIN_ROOT}', '$HOME', '`id`'], '/r')).toEqual([
    'node',
    '/r/bin/a.mjs',
    '--x=/r:/r',
    '$HOME',
    '`id`',
  ])
})

test('lerBarraJson: botões válidos com a raiz trocada; os inválidos viram erro e não derrubam os outros', () => {
  const texto = JSON.stringify({
    botoes: [
      { id: 'perguntas', rotulo: 'Perguntas', dica: 'Abre a página', comando: ['node', '${CLAUDE_PLUGIN_ROOT}/bin/p.mjs', 'pagina'], contador: ['node', '${CLAUDE_PLUGIN_ROOT}/bin/p.mjs', 'contar'], ordem: 20 },
      { id: 'sem-comando', rotulo: 'X' },
      { id: 'perguntas', rotulo: 'Repetido', comando: ['true'] },
      { id: 'a b', rotulo: 'id ruim', comando: ['true'] },
      { id: 'shell', rotulo: 'Shell', comando: 'node x' },
      { id: 'simples', rotulo: '  Simples  ', comando: ['open', '.'] },
      { id: 'pagina', rotulo: 'Página', comando: ['true'], url: 'http://127.0.0.1:4747' },
      { id: 'fora', rotulo: 'Fora', comando: ['true'], url: 'https://evil.test' },
    ],
  })
  const { botoes, erros } = lerBarraJson(texto, PLUGIN)
  expect(botoes.map(b => b.chave)).toEqual(['orquestracao@ichikawa/perguntas', 'orquestracao@ichikawa/simples', 'orquestracao@ichikawa/pagina'])
  expect(botoes[2]?.url).toBe('http://127.0.0.1:4747')
  expect(botoes[0]?.url, 'sem url: nada').toBeUndefined()
  expect(botoes[0]?.comando).toEqual(['node', `${RAIZ}/bin/p.mjs`, 'pagina'])
  expect(botoes[0]?.contador).toEqual(['node', `${RAIZ}/bin/p.mjs`, 'contar'])
  expect(botoes[1]?.rotulo).toBe('Simples')
  expect(botoes[1]?.ordem, 'sem ordem: 100').toBe(100)
  expect(erros.length).toBe(5)
  expect(erros.some(e => /"url" não é página local/.test(e))).toBe(true)
  expect(lerBarraJson('{', PLUGIN).erros[0]).toMatch(/não é JSON/)
  expect(lerBarraJson('{}', PLUGIN).erros[0]).toMatch(/sem a lista/)
})

test('ordenarBotoes: menor ordem à esquerda; empate pela chave', () => {
  const b = (chave: string, ordem: number) => ({ chave, plugin: 'p', raiz: '/', rotulo: chave, comando: ['x'], ordem })
  expect(ordenarBotoes([b('z/contas', 30), b('b/x', 20), b('a/y', 20)]).map(x => x.chave)).toEqual(['a/y', 'b/x', 'z/contas'])
})

test('lerContador e rotuloComSelo: inteiro sozinho vira selo; zero, falha ou texto, sem selo', () => {
  expect(lerContador({ exitCode: 0, stdout: ' 3\n' })).toBe(3)
  expect(lerContador({ exitCode: 1, stdout: '3' })).toBeNull()
  expect(lerContador({ exitCode: 0, stdout: '3 perguntas' })).toBeNull()
  expect(lerContador({ exitCode: 0, stdout: '1.5' })).toBeNull()
  expect(lerContador({ exitCode: 0, stdout: '' })).toBeNull()
  expect(rotuloComSelo('Perguntas', 3)).toBe('Perguntas · 3')
  expect(rotuloComSelo('Perguntas', 0)).toBe('Perguntas')
  expect(rotuloComSelo('Perguntas', null)).toBe('Perguntas')
})

test('argvDesacoplado: o comando vai como "$@", sem ser interpretado pelo shell', () => {
  const argv = argvDesacoplado(['node', '/r/a b.mjs', '; rm -rf /'])
  expect(argv.slice(0, 4)).toEqual(['/bin/sh', '-c', 'nohup "$@" </dev/null >/dev/null 2>&1 &', 'barra'])
  expect(argv.slice(4)).toEqual(['node', '/r/a b.mjs', '; rm -rf /'])
})

test('cache: relógio mm:ss, moldura aos 20 e 10 min, nenhuma com o turno rodando', () => {
  expect(relogio(3600)).toBe('60:00')
  expect(relogio(59)).toBe('00:59')
  expect(relogio(0)).toBe('venceu')
  expect(relogio(null)).toBe('—')
  expect(nivelDoCache(1201, false)).toBeNull()
  expect(nivelDoCache(1200, false)).toBe('aviso')
  expect(nivelDoCache(600, false)).toBe('alerta')
  expect(nivelDoCache(0, false)).toBe('venceu')
  expect(nivelDoCache(0, true)).toBeNull()
})

test('ausente: sem arquivo ou ligado != true é presente; o texto gravado segue o contrato, em horário de SP', () => {
  expect(lerAusente(null)).toEqual({ ligado: false })
  expect(lerAusente('{"ligado": false}')).toEqual({ ligado: false })
  expect(lerAusente('{"ligado": "sim"}')).toEqual({ ligado: false })
  expect(lerAusente('{"ligado": true, "desde": "x"}')).toEqual({ ligado: true, desde: 'x' })
  expect(() => lerAusente('{')).toThrow()
  expect(() => lerAusente('[]')).toThrow()
  const agora = Date.UTC(2026, 10, 14, 0, 15)
  expect(isoSaoPaulo(agora)).toBe('2026-11-13T21:15:00-03:00')
  expect(JSON.parse(textoDoAusente(true, agora))).toEqual({ ligado: true, desde: '2026-11-13T21:15:00-03:00', por: 'barra' })
})

test('lerPedido: tipos, sessão, texto e o prazo de 30 min', () => {
  const agora = Date.UTC(2026, 10, 14, 0, 0)
  const criadoEm = new Date(agora - 60_000).toISOString()
  const ok = { tipo: 'responder', sessao: 'local_abc-123', texto: 'sim', criadoEm }
  expect(lerPedido(JSON.stringify(ok), agora)).toEqual({ pedido: ok })
  expect(lerPedido(JSON.stringify({ tipo: 'abrir-sessao', sessao: 'local_a', criadoEm, texto: 'ignorado' }), agora)).toEqual({ pedido: { tipo: 'abrir-sessao', sessao: 'local_a', criadoEm } })
  expect(lerPedido(JSON.stringify({ ...ok, texto: ' ' }), agora)).toEqual({ motivo: 'responder sem texto' })
  expect(lerPedido(JSON.stringify({ ...ok, sessao: '../x' }), agora)).toEqual({ motivo: 'sessao inválida' })
  expect(lerPedido(JSON.stringify({ ...ok, tipo: 'apagar' }), agora)).toEqual({ motivo: 'tipo desconhecido: apagar' })
  expect(lerPedido(JSON.stringify({ ...ok, criadoEm: new Date(agora - 31 * 60_000).toISOString() }), agora)).toEqual({ motivo: 'vencido (mais de 30 min)' })
  expect(lerPedido('{', agora)).toEqual({ motivo: 'não é JSON' })
})
