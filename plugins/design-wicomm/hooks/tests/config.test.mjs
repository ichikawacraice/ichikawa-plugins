// A configuração do projeto: o arquivo nos dois nomes, as opções do plugin, o que é tela e o lembrete que só lembra.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OPCOES_DO_PLUGIN, arquivoDoProjeto, configDoProjeto, eCodigoDeTela, opcao, telasDoProjeto } from '../config.mjs';
import { decidir as lembrete } from '../lembrete-de-design.mjs';

const PLUGIN_JSON = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude-plugin', 'plugin.json');

const temporarias = [];
after(() => temporarias.forEach((d) => rmSync(d, { recursive: true, force: true })));
const pasta = () => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'design-wicomm-config-')));
  temporarias.push(d);
  return d;
};
const escrever = (raiz, rel, obj) => {
  mkdirSync(join(raiz, rel, '..'), { recursive: true });
  writeFileSync(join(raiz, rel), typeof obj === 'string' ? obj : JSON.stringify(obj));
};
/** Uma conta sem nada gravado, para o settings da máquina não vazar no teste. */
const conta = () => {
  const casa = pasta();
  return { casa, env: { CLAUDE_CONFIG_DIR: join(casa, '.claude') } };
};

describe('o arquivo do projeto, nos dois nomes', () => {
  it('sem arquivo, o nome é o novo (é o que se cria)', () => {
    const r = pasta();
    assert.equal(arquivoDoProjeto(r), join(r, 'design', 'design-system.json'));
  });

  it('com só o antigo, vale o antigo — o projeto que já o tem não precisa renomear', () => {
    const r = pasta();
    escrever(r, 'design/wicomm.json', { pasta: 'web', densidade: 'site' });
    assert.equal(arquivoDoProjeto(r), join(r, 'design', 'wicomm.json'));
    const c = configDoProjeto(r);
    assert.equal(c.pasta, 'web');
    assert.equal(c.temArquivo, true);
  });

  it('com os dois, vale o novo, e o antigo por baixo dele: o arquivo novo não apaga o que o antigo diz', () => {
    const r = pasta();
    escrever(r, 'design/wicomm.json', { pasta: 'velho', densidade: 'site', pecas: ['botao'] });
    escrever(r, 'design/design-system.json', { pasta: 'novo', pecas: ['botao', 'cartao'] });
    const c = configDoProjeto(r);
    assert.equal(c.pasta, 'novo');
    assert.equal(c.densidade, 'site');
    assert.deepEqual(c.pecas, ['botao', 'cartao']);
    assert.equal(arquivoDoProjeto(r), join(r, 'design', 'design-system.json'));
  });
});

describe('as opções do plugin', () => {
  it('a lista do código e o userConfig do plugin.json concordam', () => {
    const userConfig = JSON.parse(readFileSync(PLUGIN_JSON, 'utf-8')).userConfig ?? {};
    assert.deepEqual(Object.keys(userConfig).sort(), [...OPCOES_DO_PLUGIN].sort());
  });

  it('a variável do app vence o que está gravado no settings; sem nenhuma, undefined', () => {
    const { casa, env } = conta();
    escrever(casa, '.claude/settings.json', { pluginConfigs: { 'design-wicomm@ichikawa-plugins': { options: { largura: 1440 } } } });
    assert.equal(opcao('largura', { home: casa, env }), 1440);
    assert.equal(opcao('largura', { home: casa, env: { ...env, CLAUDE_PLUGIN_OPTION_LARGURA: '1600' } }), '1600');
    assert.equal(opcao('pasta_do_front', { home: casa, env }), undefined);
  });

  it('não lê .claude/kit.json: o plugin não depende do kit antigo', () => {
    const r = pasta();
    const { casa, env } = conta();
    escrever(r, '.claude/kit.json', { design: { pasta: 'web' } });
    assert.equal(telasDoProjeto(r, { home: casa, env }), null);
  });
});

describe('o que é tela', () => {
  it('sem visual, sai da pasta do front: telas por extensão, sem os testes', () => {
    const r = pasta();
    const { casa, env } = conta();
    escrever(r, 'design/design-system.json', { pasta: './web/' });
    const { visual } = telasDoProjeto(r, { home: casa, env });
    assert.equal(eCodigoDeTela(join(r, 'web/src/Tela.tsx'), visual), true);
    assert.equal(eCodigoDeTela('web/src/Tela.test.tsx', visual), false);
    assert.equal(eCodigoDeTela('docs/design/revisoes/x.md', visual), false);
  });

  it('a opção pasta_do_front vale quando o projeto não diz', () => {
    const r = pasta();
    const { casa, env } = conta();
    const t = telasDoProjeto(r, { home: casa, env: { ...env, CLAUDE_PLUGIN_OPTION_PASTA_DO_FRONT: 'app' } });
    assert.equal(eCodigoDeTela('app/a.css', t.visual), true);
  });

  it('visual explícito vence a pasta', () => {
    const r = pasta();
    const { casa, env } = conta();
    escrever(r, 'design/design-system.json', { pasta: 'web', visual: ['front/**/*.tsx'] });
    assert.deepEqual(telasDoProjeto(r, { home: casa, env }).visual, ['front/**/*.tsx']);
  });
});

describe('o lembrete de design só lembra', () => {
  const telas = (projeto) => ({ telas: () => ({ visual: ['web/**/*.tsx'], projeto }) });
  const ev = (prompt) => ({ hook_event_name: 'UserPromptSubmit', prompt, cwd: '/r' });

  it('pedido de design num projeto com front: contexto a mais, sem decisão de bloqueio', () => {
    const d = lembrete(ev('redesenha a tela de pedidos'), telas({ temArquivo: true }));
    assert.equal(d.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(d.hookSpecificOutput.additionalContext, /obrigatório na tela nova/);
    assert.match(d.hookSpecificOutput.additionalContext, /crítica é opcional/);
    assert.equal(d.decision, undefined);
  });

  it('calado: pedido que não é de design, projeto sem front, ou lembrete desligado', () => {
    assert.equal(lembrete(ev('corrige o teste do backend'), telas({})), null);
    assert.equal(lembrete(ev('muda o layout'), { telas: () => null }), null);
    assert.equal(lembrete(ev('muda o layout'), telas({ lembrete: false })), null);
  });
});
