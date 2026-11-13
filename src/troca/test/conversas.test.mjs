import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { conversasEmAndamento, lerChavesDeCorte, limparMarca, organizacoesDa, sincronizar, tomarConversasCortadas, turnoAberto } from '../conversas.mjs';
import { CONTA_A, CONTA_B, ORG, entrada, lerJson, montar } from './fabrica.mjs';

const DESDE = 5_000_000;
/** Põe a data de modificação do arquivo (em ms) e devolve o caminho. */
const idade = (caminho, ms) => { utimesSync(caminho, ms / 1000, ms / 1000); return caminho; };
const mtime = (caminho) => Math.floor(statSync(caminho).mtimeMs);
const BASE = 1_700_000_000_000;

describe('conversas: sincronizar', () => {
  it('copia a entrada que falta e atualiza a mais velha, sem tocar na mais nova', () => {
    const m = montar();
    entrada(m.sessoes, CONTA_A, ORG, 'nova', { lastActivityAt: 10 });
    idade(entrada(m.sessoes, CONTA_A, ORG, 'velha', { lastActivityAt: 50, title: 'da A' }), BASE + 500);
    idade(entrada(m.sessoes, CONTA_A, ORG, 'maisnova', { lastActivityAt: 10, title: 'da A (velha)' }), BASE);
    idade(entrada(m.sessoes, CONTA_B, ORG, 'velha', { lastActivityAt: 20, title: 'da B (velha)' }), BASE);
    idade(entrada(m.sessoes, CONTA_B, ORG, 'maisnova', { lastActivityAt: 99, title: 'da B (nova)' }), BASE + 900);
    const { gravadas: n, removidas } = sincronizar(m.sessoes, CONTA_B, ORG);
    assert.equal(n, 2);
    assert.equal(removidas, 0);
    const dirB = join(m.sessoes, CONTA_B, ORG);
    assert.ok(existsSync(join(dirB, 'local_nova.json')), 'faltava e foi copiada');
    assert.equal(lerJson(join(dirB, 'local_velha.json')).title, 'da A', 'mais velha atualizada');
    assert.equal(lerJson(join(dirB, 'local_maisnova.json')).title, 'da B (nova)', 'a mais nova fica');
  });

  it('conversa apagada (deleted_<id>) não volta, nem pelo cliSessionId de outro alias', () => {
    const m = montar();
    entrada(m.sessoes, CONTA_A, ORG, 'x1', { cliSessionId: 'cli-igual' });
    entrada(m.sessoes, CONTA_A, ORG, 'apagada');
    entrada(m.sessoes, CONTA_B, ORG, 'outra');
    writeFileSync(join(m.sessoes, CONTA_B, ORG, 'deleted_apagada'), '');
    // alias local diferente da mesma conversa (mesmo cliSessionId) que o usuário apagou na B
    entrada(m.sessoes, CONTA_B, ORG, 'alias', { cliSessionId: 'cli-igual' });
    writeFileSync(join(m.sessoes, CONTA_B, ORG, 'deleted_alias'), '');
    const { gravadas: n } = sincronizar(m.sessoes, CONTA_B, ORG);
    const dirB = join(m.sessoes, CONTA_B, ORG);
    assert.equal(existsSync(join(dirB, 'local_apagada.json')), false);
    assert.equal(existsSync(join(dirB, 'local_x1.json')), false, 'o cliSessionId da apagada barra o outro alias');
    assert.equal(n, 0);
  });

  it('alias diferente da mesma conversa não sobrescreve o da conta de destino', () => {
    const m = montar();
    entrada(m.sessoes, CONTA_A, ORG, 'aliasA', { cliSessionId: 'cli-1', lastActivityAt: 90, title: 'da A' });
    entrada(m.sessoes, CONTA_B, ORG, 'aliasB', { cliSessionId: 'cli-1', lastActivityAt: 10, title: 'da B', pinned: true });
    idade(join(m.sessoes, CONTA_A, ORG, 'local_aliasA.json'), BASE);
    idade(join(m.sessoes, CONTA_B, ORG, 'local_aliasB.json'), BASE + 5000);
    assert.equal(sincronizar(m.sessoes, CONTA_B, ORG).gravadas, 0);
    const dirB = join(m.sessoes, CONTA_B, ORG);
    assert.deepEqual(readdirSync(dirB), ['local_aliasB.json']);
    assert.equal(lerJson(join(dirB, 'local_aliasB.json')).pinned, true);
  });

  it('o que só existe no destino fica, e a origem fica intacta', () => {
    const m = montar();
    const so = entrada(m.sessoes, CONTA_B, ORG, 'soB');
    const deA = entrada(m.sessoes, CONTA_A, ORG, 'deA');
    const antes = readFileSync(deA, 'utf8');
    sincronizar(m.sessoes, CONTA_B, ORG);
    assert.ok(existsSync(so));
    assert.equal(readFileSync(deA, 'utf8'), antes);
  });

  it('conta nova ganha as cópias; entrada ilegível no destino é protegida', () => {
    const m = montar();
    entrada(m.sessoes, CONTA_A, ORG, 'a1');
    entrada(m.sessoes, CONTA_A, ORG, 'a2', { lastActivityAt: 500 });
    mkdirSync(join(m.sessoes, CONTA_B, ORG), { recursive: true });
    writeFileSync(join(m.sessoes, CONTA_B, ORG, 'local_a2.json'), '{quebrado');
    const n = sincronizar(m.sessoes, CONTA_B, ORG).gravadas;
    assert.equal(n, 1, 'a1 entra, a2 não sobrescreve o ilegível');
    assert.equal(readFileSync(join(m.sessoes, CONTA_B, ORG, 'local_a2.json'), 'utf8'), '{quebrado');
  });

  it('organizacoesDa lista todas as pastas de organização da conta, e nenhuma sem pasta', () => {
    const m = montar();
    entrada(m.sessoes, CONTA_A, 'org-velha', 'v', { lastActivityAt: 1 });
    entrada(m.sessoes, CONTA_A, 'org-nova', 'n', { lastActivityAt: 9 });
    assert.deepEqual(organizacoesDa(m.sessoes, CONTA_A), ['org-nova', 'org-velha']);
    assert.deepEqual(organizacoesDa(m.sessoes, CONTA_B), []);
  });
});

describe('conversas: sincronizar como espelho (F559)', () => {
  const lista = (m, conta, org = ORG) => readdirSync(join(m.sessoes, conta, org)).filter((n) => n.startsWith('local_')).sort();
  const clis = (m, conta, org = ORG) => lista(m, conta, org).map((n) => lerJson(join(m.sessoes, conta, org, n)).cliSessionId).sort();

  it('ida e volta A→B→A→B não cria duplicata, nem com outro nome de arquivo para a mesma conversa', () => {
    const m = montar();
    for (const id of ['a1', 'a2', 'a3']) idade(entrada(m.sessoes, CONTA_A, ORG, id), BASE);
    idade(entrada(m.sessoes, CONTA_B, ORG, 'b1'), BASE);
    idade(entrada(m.sessoes, CONTA_B, ORG, 'aliasDeA1', { cliSessionId: 'cli-a1' }), BASE);
    for (let i = 0; i < 2; i++) {
      sincronizar(m.sessoes, CONTA_B, ORG);
      sincronizar(m.sessoes, CONTA_A, ORG);
    }
    for (const c of [CONTA_A, CONTA_B]) {
      const cs = clis(m, c);
      assert.ok(cs.length > 0);
      assert.equal(new Set(cs).size, cs.length, `${c} tem conversa duplicada`);
      assert.deepEqual(cs, ['cli-a1', 'cli-a2', 'cli-a3', 'cli-b1']);
    }
    assert.equal(sincronizar(m.sessoes, CONTA_B, ORG).gravadas, 0);
    assert.equal(sincronizar(m.sessoes, CONTA_A, ORG).gravadas, 0);
  });

  it('arquivar ou renomear na origem (mtime maior, lastActivityAt igual) chega ao destino', () => {
    const m = montar();
    const deA = idade(entrada(m.sessoes, CONTA_A, ORG, 'c1', { lastActivityAt: 70, title: 'velho' }), BASE);
    idade(entrada(m.sessoes, CONTA_B, ORG, 'c1', { lastActivityAt: 70, title: 'velho' }), BASE);
    writeFileSync(deA, JSON.stringify({ ...lerJson(deA), isArchived: true, title: 'renomeada' }, null, 2));
    idade(deA, BASE + 60_000);
    const r = sincronizar(m.sessoes, CONTA_B, ORG);
    assert.equal(r.gravadas, 1);
    const b = lerJson(join(m.sessoes, CONTA_B, ORG, 'local_c1.json'));
    assert.equal(b.isArchived, true);
    assert.equal(b.title, 'renomeada');
  });

  it('a origem mais velha pelo arquivo não sobrescreve, mesmo com lastActivityAt maior', () => {
    const m = montar();
    idade(entrada(m.sessoes, CONTA_A, ORG, 'c1', { lastActivityAt: 900, title: 'da A' }), BASE);
    idade(entrada(m.sessoes, CONTA_B, ORG, 'c1', { lastActivityAt: 10, title: 'da B' }), BASE + 1000);
    assert.equal(sincronizar(m.sessoes, CONTA_B, ORG).gravadas, 0);
    assert.equal(lerJson(join(m.sessoes, CONTA_B, ORG, 'local_c1.json')).title, 'da B');
  });

  it('a cópia não reescreve na volta: o mtime do destino fica igual ao da origem', () => {
    const m = montar();
    const origens = ['a1', 'a2'].map((id, i) => idade(entrada(m.sessoes, CONTA_A, ORG, id), BASE + i * 1000));
    assert.equal(sincronizar(m.sessoes, CONTA_B, ORG).gravadas, 2);
    origens.forEach((o, i) => {
      const d = join(m.sessoes, CONTA_B, ORG, o.slice(o.lastIndexOf('/') + 1));
      assert.equal(mtime(d), BASE + i * 1000);
    });
    assert.equal(sincronizar(m.sessoes, CONTA_A, ORG).gravadas, 0, 'a volta não reescreve');
    assert.equal(sincronizar(m.sessoes, CONTA_B, ORG).gravadas, 0, 'a ida de novo também não');
    assert.equal(mtime(origens[0]), BASE);
  });

  it('entre várias origens da mesma conversa vale a de mtime maior', () => {
    const m = montar();
    const C = 'cccccccc-3333-4333-8333-cccccccccccc';
    idade(entrada(m.sessoes, CONTA_A, ORG, 'c1', { lastActivityAt: 500, title: 'da A' }), BASE);
    idade(entrada(m.sessoes, C, ORG, 'c1', { lastActivityAt: 10, title: 'da C' }), BASE + 9000);
    sincronizar(m.sessoes, CONTA_B, ORG);
    assert.equal(lerJson(join(m.sessoes, CONTA_B, ORG, 'local_c1.json')).title, 'da C');
  });

  it('com outro nome de arquivo, atualiza o arquivo do destino mantendo o sessionId dele, sem criar um segundo', () => {
    const m = montar();
    idade(entrada(m.sessoes, CONTA_A, ORG, 'nomeA', { cliSessionId: 'cli-1', title: 'novo título', isArchived: true }), BASE + 5000);
    const dst = idade(entrada(m.sessoes, CONTA_B, ORG, 'nomeB', { cliSessionId: 'cli-1', title: 'antigo' }), BASE);
    const r = sincronizar(m.sessoes, CONTA_B, ORG);
    assert.equal(r.gravadas, 1);
    assert.deepEqual(lista(m, CONTA_B), ['local_nomeB.json']);
    const o = lerJson(dst);
    assert.equal(o.title, 'novo título');
    assert.equal(o.isArchived, true);
    assert.equal(o.sessionId, 'local_nomeB');
    assert.equal(mtime(dst), BASE + 5000);
    assert.equal(sincronizar(m.sessoes, CONTA_B, ORG).gravadas, 0, 'segunda vez não reescreve');
  });

  describe('a conversa apagada em outra conta', () => {
    const reservaDe = (m) => join(m.raiz, 'reserva');

    it('sai da lista do destino, vai para a reserva e o destino ganha a marca', () => {
      const m = montar();
      entrada(m.sessoes, CONTA_A, ORG, 'outra');
      writeFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_x'), '1789996893737');
      const x = entrada(m.sessoes, CONTA_B, ORG, 'x', { lastActivityAt: 1789996893000 });
      const antes = readFileSync(x, 'utf8');
      const r = sincronizar(m.sessoes, CONTA_B, ORG, { reserva: reservaDe(m) });
      assert.equal(r.removidas, 1);
      assert.equal(existsSync(x), false);
      const guardada = join(reservaDe(m), CONTA_B, ORG, 'local_x.json');
      assert.equal(readFileSync(guardada, 'utf8'), antes);
      assert.equal(readFileSync(join(m.sessoes, CONTA_B, ORG, 'deleted_x'), 'utf8'), '1789996893737');
      assert.ok(existsSync(join(m.sessoes, CONTA_B, ORG, 'local_outra.json')), 'o resto chega');
    });

    it('sai também pelo cliSessionId de um id apagado, e a marca nova leva o id do destino', () => {
      const m = montar();
      entrada(m.sessoes, CONTA_A, ORG, 'apagadaA', { cliSessionId: 'cli-z' });
      writeFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_apagadaA'), '5000');
      const dst = entrada(m.sessoes, CONTA_B, ORG, 'aliasB', { cliSessionId: 'cli-z', lastActivityAt: 10 });
      const r = sincronizar(m.sessoes, CONTA_B, ORG, { reserva: reservaDe(m) });
      assert.equal(r.removidas, 1);
      assert.equal(existsSync(dst), false);
      assert.equal(readFileSync(join(m.sessoes, CONTA_B, ORG, 'deleted_aliasB'), 'utf8'), '5000');
      assert.deepEqual(lista(m, CONTA_B), []);
    });

    it('marca vazia conta como agora e grava a hora atual em texto', () => {
      const m = montar();
      mkdirSync(join(m.sessoes, CONTA_A, ORG), { recursive: true });
      writeFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_x'), '');
      const x = entrada(m.sessoes, CONTA_B, ORG, 'x', { lastActivityAt: 10 });
      const antes = Date.now();
      const r = sincronizar(m.sessoes, CONTA_B, ORG, { reserva: reservaDe(m) });
      assert.equal(r.removidas, 1);
      assert.equal(existsSync(x), false);
      const marca = readFileSync(join(m.sessoes, CONTA_B, ORG, 'deleted_x'), 'utf8');
      assert.match(marca, /^\d+$/);
      assert.ok(Number(marca) >= antes);
    });

    it('a usada depois da marca fica', () => {
      const m = montar();
      mkdirSync(join(m.sessoes, CONTA_A, ORG), { recursive: true });
      writeFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_x'), '1000');
      const x = entrada(m.sessoes, CONTA_B, ORG, 'x', { lastActivityAt: 2000 });
      const r = sincronizar(m.sessoes, CONTA_B, ORG, { reserva: reservaDe(m) });
      assert.equal(r.removidas, 0);
      assert.ok(existsSync(x));
      assert.equal(existsSync(reservaDe(m)), false);
    });

    it('sem reserva, nada é removido: só conta e registra no log', () => {
      const m = montar();
      mkdirSync(join(m.sessoes, CONTA_A, ORG), { recursive: true });
      writeFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_x'), '9999');
      const x = entrada(m.sessoes, CONTA_B, ORG, 'x', { lastActivityAt: 10 });
      const logs = [];
      const r = sincronizar(m.sessoes, CONTA_B, ORG, { log: (t) => logs.push(t) });
      assert.ok(existsSync(x));
      assert.equal(existsSync(join(m.sessoes, CONTA_B, ORG, 'deleted_x')), false);
      assert.equal(r.removidas, 1);
      assert.ok(logs.some((t) => /local_x\.json/.test(t)), logs.join('|'));
    });

    it('nome já existente na reserva ganha sufixo, nunca é sobrescrito', () => {
      const m = montar();
      mkdirSync(join(m.sessoes, CONTA_A, ORG), { recursive: true });
      writeFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_x'), '9999');
      const pasta = join(reservaDe(m), CONTA_B, ORG);
      mkdirSync(pasta, { recursive: true });
      writeFileSync(join(pasta, 'local_x.json'), 'anterior');
      entrada(m.sessoes, CONTA_B, ORG, 'x', { lastActivityAt: 10 });
      sincronizar(m.sessoes, CONTA_B, ORG, { reserva: reservaDe(m) });
      assert.equal(readFileSync(join(pasta, 'local_x.json'), 'utf8'), 'anterior');
      assert.equal(readdirSync(pasta).length, 2);
    });
  });
});

const linha = (o) => JSON.stringify(o);
describe('conversas: turno aberto e em andamento', () => {
  it('lê a última mensagem: resposta final fecha o turno; prompt, resultado de ferramenta e tool_use deixam aberto', () => {
    assert.equal(turnoAberto(linha({ type: 'assistant', message: { stop_reason: 'end_turn' } })), false);
    assert.equal(turnoAberto(linha({ type: 'assistant', message: { stop_reason: 'tool_use' } })), true);
    assert.equal(turnoAberto(linha({ type: 'assistant', message: { stop_reason: null } })), true);
    assert.equal(turnoAberto(linha({ type: 'user', message: { content: 'oi' } })), true);
    assert.equal(turnoAberto(linha({ type: 'user', message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } })), false);
    assert.equal(turnoAberto(''), false);
  });

  it('ignora sidechain e linha cortada ao meio', () => {
    const t = [
      '{"type":"assistant","message":{"stop_reason":"end_turn"}}',
      linha({ type: 'assistant', isSidechain: true, message: { stop_reason: 'tool_use' } }),
      '{"type":"user","mess',
    ].join('\n');
    assert.equal(turnoAberto(t), false);
  });

  it('só conta transcrito mexido nos últimos 30 min', () => {
    const m = montar();
    const pasta = join(m.projetos, '-proj');
    mkdirSync(pasta);
    const agora = Date.now();
    const aberto = linha({ type: 'user', message: { content: 'faça' } });
    writeFileSync(join(pasta, 'recente.jsonl'), aberto);
    writeFileSync(join(pasta, 'fechado.jsonl'), linha({ type: 'assistant', message: { stop_reason: 'end_turn' } }));
    writeFileSync(join(pasta, 'antigo.jsonl'), aberto);
    const velho = new Date(agora - 31 * 60 * 1000);
    utimesSync(join(pasta, 'antigo.jsonl'), velho, velho);
    const r = conversasEmAndamento(m.projetos, agora);
    assert.deepEqual([...r], ['recente']);
    assert.equal(conversasEmAndamento(join(m.raiz, 'nao-existe'), agora).size, 0);
  });
});

describe('conversas: marca de corte', () => {
  it('conversa em andamento ganha a marca na conta de destino', () => {
    const m = montar();
    const alvo = entrada(m.sessoes, CONTA_B, ORG, 'c1');
    const cortadas = tomarConversasCortadas(m.sessoes, CONTA_B, ORG, DESDE, new Set(['cli-c1']));
    assert.equal(cortadas.length, 1);
    assert.equal(cortadas[0].titulo, 'conversa c1');
    const o = lerJson(alvo);
    assert.equal(o.interruptedByQuitAt, DESDE);
    assert.equal(o.interruptedAwaitingPerson, false);
  });

  it('marca que o app pôs na cópia de outra conta vai para o destino e sai de lá', () => {
    const m = montar();
    const deA = entrada(m.sessoes, CONTA_A, ORG, 'c2', { interruptedByQuitAt: DESDE + 5, interruptedUnseenResume: true, interruptedAwaitingPerson: false });
    const deB = entrada(m.sessoes, CONTA_B, ORG, 'c2');
    const cortadas = tomarConversasCortadas(m.sessoes, CONTA_B, ORG, DESDE);
    assert.equal(cortadas.length, 1);
    const b = lerJson(deB);
    assert.equal(b.interruptedByQuitAt, DESDE + 5);
    assert.equal(b.interruptedUnseenResume, true);
    const a = lerJson(deA);
    for (const k of ['interruptedByQuitAt', 'interruptedUnseenResume', 'interruptedAwaitingPerson']) assert.ok(!(k in a), `${k} saiu da cópia da A`);
  });

  it('conta de destino com duas organizações: as duas cópias ganham a marca, a da outra conta perde, e conta uma conversa só', () => {
    const m = montar();
    const deA = entrada(m.sessoes, CONTA_A, ORG, 'c4', { interruptedByQuitAt: DESDE + 7, interruptedUnseenResume: true });
    const b1 = entrada(m.sessoes, CONTA_B, ORG, 'c4');
    const b2 = entrada(m.sessoes, CONTA_B, 'org-2', 'c4');
    const cortadas = tomarConversasCortadas(m.sessoes, CONTA_B, [ORG, 'org-2'], DESDE);
    assert.equal(cortadas.length, 1);
    for (const p of [b1, b2]) {
      const o = lerJson(p);
      assert.equal(o.interruptedByQuitAt, DESDE + 7, p);
      assert.equal(o.interruptedUnseenResume, true, p);
    }
    assert.ok(!('interruptedByQuitAt' in lerJson(deA)));
  });

  it('marca antiga (antes do fechamento) e conversa que a conta não vê não entram', () => {
    const m = montar();
    entrada(m.sessoes, CONTA_B, ORG, 'velha', { interruptedByQuitAt: DESDE - 1 });
    const so = entrada(m.sessoes, CONTA_A, ORG, 'soA', { interruptedByQuitAt: DESDE + 1 });
    assert.deepEqual(tomarConversasCortadas(m.sessoes, CONTA_B, ORG, DESDE), []);
    assert.equal(lerJson(so).interruptedByQuitAt, DESDE + 1, 'a que a conta não vê mantém a marca');
  });

  it('limparMarca tira as 3 chaves e mantém o formato do arquivo', () => {
    const m = montar();
    const p = entrada(m.sessoes, CONTA_B, ORG, 'c3', { interruptedByQuitAt: 1, interruptedUnseenResume: true, interruptedAwaitingPerson: true });
    limparMarca(p);
    const o = lerJson(p);
    assert.ok(Object.keys(o).length > 0);
    assert.ok(!('interruptedByQuitAt' in o) && !('interruptedUnseenResume' in o) && !('interruptedAwaitingPerson' in o));
    assert.equal(readFileSync(p, 'utf8'), JSON.stringify(o, null, 2));
  });
});

describe('conversas: o que falta pelo nome e o resíduo', () => {
  it('conta a que falta, ignora a apagada em qualquer conta e devolve a pior pasta da conta', async () => {
    const { faltamPeloNome } = await import('../conversas.mjs');
    const m = montar();
    for (const id of ['a', 'b', 'c', 'apagada']) entrada(m.sessoes, CONTA_A, ORG, id);
    writeFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_apagada'), '1');
    entrada(m.sessoes, CONTA_B, ORG, 'a');
    entrada(m.sessoes, CONTA_B, 'org-2', 'a');
    entrada(m.sessoes, CONTA_B, 'org-2', 'b');
    entrada(m.sessoes, CONTA_B, 'org-2', 'c');
    const r = faltamPeloNome(m.sessoes, CONTA_B);
    assert.deepEqual(r.porPasta, { [ORG]: 2, 'org-2': 0 });
    assert.equal(r.faltam, 2, 'a pasta cheia não esconde a vazia');
  });

  it('conta sem pasta própria: falta a lista toda; pasta ilegível não derruba', async () => {
    const { faltamPeloNome } = await import('../conversas.mjs');
    const m = montar();
    entrada(m.sessoes, CONTA_A, ORG, 'a');
    entrada(m.sessoes, CONTA_A, ORG, 'b');
    assert.deepEqual(faltamPeloNome(m.sessoes, CONTA_B), { faltam: 2, porPasta: {} });
    assert.deepEqual(faltamPeloNome(join(m.raiz, 'nao-existe'), CONTA_B), { faltam: 0, porPasta: {} });
  });

  it('o resíduo grava e lê por conta; sem registro vale 0; arquivo estragado vale 0', async () => {
    const { gravarResiduo, lerResiduo } = await import('../conversas.mjs');
    const m = montar();
    assert.equal(lerResiduo(m.dados, CONTA_A), 0);
    gravarResiduo(m.dados, CONTA_A, 3, new Date('2026-11-09T21:00:00Z'));
    gravarResiduo(m.dados, CONTA_B, 1);
    assert.equal(lerResiduo(m.dados, CONTA_A), 3);
    assert.equal(lerResiduo(m.dados, CONTA_B), 1);
    assert.equal(lerJson(join(m.dados, 'lista.json'))[CONTA_A].em, '2026-11-09T21:00:00.000Z');
    writeFileSync(join(m.dados, 'lista.json'), '{estragado');
    assert.equal(lerResiduo(m.dados, CONTA_A), 0);
    gravarResiduo(m.dados, CONTA_A, 2);
    assert.equal(lerResiduo(m.dados, CONTA_A), 2, 'arquivo estragado é reescrito');
  });
});

describe('lerChavesDeCorte: a falha de leitura não passa por "não havia marca"', () => {
  it('devolve as chaves do arquivo e `null` quando não consegue ler', () => {
    const amb = montar();
    const com = entrada(amb.sessoes, CONTA_A, ORG, 'c', { interruptedByQuitAt: 7, interruptedAwaitingPerson: true });
    const sem = entrada(amb.sessoes, CONTA_A, ORG, 's');
    // A presença seria detectada: a entrada com marca devolve as chaves que estão nela.
    assert.deepEqual(lerChavesDeCorte(com), { interruptedByQuitAt: 7, interruptedAwaitingPerson: true });
    // Objeto vazio é "li e não havia marca" — diferente de não ter lido.
    assert.deepEqual(lerChavesDeCorte(sem), {});
    const avisos = [];
    assert.equal(lerChavesDeCorte(join(amb.sessoes, 'nao-existe.json'), (t) => avisos.push(t)), null);
    assert.equal(avisos.length, 1, 'a falha de leitura passou em silêncio');
    assert.match(avisos[0], /marca de corte não lida/);
  });
});
