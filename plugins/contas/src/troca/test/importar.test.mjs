import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { haParaImportar, importar } from '../importar.mjs';
import { principal } from '../cli.mjs';
import { CONTA_A, CONTA_B, configDe, controleFalso, montar, textoDeConfig } from './fabrica.mjs';

/** Uma pasta do kit com A e B guardadas. */
function kitCom(m) {
  const origem = join(m.raiz, 'kit');
  for (const c of [CONTA_A, CONTA_B]) {
    mkdirSync(join(origem, 'contas', c), { recursive: true });
    writeFileSync(join(origem, 'contas', c, 'config.json'), textoDeConfig(configDe(c)));
    writeFileSync(join(origem, 'contas', c, 'Cookies'), `SENTINELA-COOKIE-${c === CONTA_A ? 'A' : 'B'}`);
  }
  writeFileSync(join(origem, 'estado.json'), JSON.stringify({ contas: { [CONTA_A]: { nome: 'Pessoal', salvoEm: '2026-11-01T10:00:00.000Z' }, [CONTA_B]: { nome: 'Trabalho', salvoEm: '2026-11-02T10:00:00.000Z' } } }));
  writeFileSync(join(origem, 'uso.json'), JSON.stringify({ [CONTA_A]: { sessao: 12, semana: 40 } }));
  writeFileSync(join(origem, 'troca.lock'), '123');
  return origem;
}

describe('importar do kit', () => {
  it('copia logins, nomes e uso; não traz a trava; a origem fica igual', () => {
    const m = montar();
    const origem = kitCom(m);
    const destino = join(m.raiz, 'novo');
    assert.equal(haParaImportar({ origem, destino }), true);
    chmodSync(join(origem, 'contas'), 0o755);
    chmodSync(join(origem, 'estado.json'), 0o644);
    const r = importar({ origem, destino });
    assert.equal(statSync(join(destino, 'contas')).mode & 0o777, 0o700);
    assert.equal(statSync(join(destino, 'contas', CONTA_B, 'Cookies')).mode & 0o777, 0o600);
    assert.equal(statSync(join(destino, 'estado.json')).mode & 0o777, 0o600);
    assert.deepEqual(r.copiados, ['contas', 'uso.json', 'estado.json']);
    assert.equal(readFileSync(join(destino, 'contas', CONTA_B, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-B');
    assert.equal(JSON.parse(readFileSync(join(destino, 'estado.json'), 'utf8')).contas[CONTA_B].nome, 'Trabalho');
    assert.equal(existsSync(join(origem, 'troca.lock')), true, 'a prova de ausência vale: a trava existe na origem');
    assert.equal(existsSync(join(destino, 'troca.lock')), false);
    assert.equal(existsSync(join(origem, 'contas', CONTA_A, 'config.json')), true);
    assert.equal(haParaImportar({ origem, destino }), false);
  });

  it('recusa sem origem e com destino que já tem contas, sem gravar nada', () => {
    const m = montar();
    assert.throws(() => importar({ origem: join(m.raiz, 'nada'), destino: join(m.raiz, 'novo') }), (e) => e.codigo === 'semOrigem');
    assert.equal(existsSync(join(m.raiz, 'novo')), false);
    const origem = kitCom(m);
    writeFileSync(join(m.dados, 'estado.json'), JSON.stringify({ contas: {} }));
    assert.throws(() => importar({ origem, destino: m.dados }), (e) => e.codigo === 'jaTem');
    assert.equal(existsSync(join(m.dados, 'contas')), false);
  });

  it('destino com uso.json do painel ou cópia que parou no meio: a importação termina', () => {
    const m = montar();
    const origem = kitCom(m);
    const destino = join(m.raiz, 'novo');
    mkdirSync(join(destino, 'contas', CONTA_A), { recursive: true });
    writeFileSync(join(destino, 'contas', CONTA_A, 'config.json'), 'meio copiado');
    writeFileSync(join(destino, 'uso.json'), JSON.stringify({ [CONTA_A]: { sessao: 99 } }));
    assert.equal(haParaImportar({ origem, destino }), true);
    importar({ origem, destino });
    assert.equal(readFileSync(join(destino, 'contas', CONTA_A, 'config.json'), 'utf8'), textoDeConfig(configDe(CONTA_A)));
    assert.equal(JSON.parse(readFileSync(join(destino, 'uso.json'), 'utf8'))[CONTA_A].sessao, 12);
    assert.equal(existsSync(join(destino, 'estado.json')), true);
  });

  it('pelo CLI: a lista vazia aponta a importação e o comando lista as contas trazidas', async () => {
    const m = montar();
    const origem = kitCom(m);
    const env = { ...m.env, TROCA_IMPORTAR_DE: origem };
    const saida = [];
    const erro = [];
    const op = { env, saida: (t) => saida.push(t), erro: (t) => erro.push(t), controle: controleFalso() };
    assert.equal(await principal({ ...op, argv: [] }), 0);
    assert.match(saida.at(-1), /importar-do-kit/);
    assert.equal(await principal({ ...op, argv: ['importar-do-kit'] }), 0);
    assert.ok(saida.some((l) => l.includes('Trabalho') && l.includes(CONTA_B)));
    assert.equal(await principal({ ...op, argv: ['importar-do-kit'] }), 1);
    assert.match(erro.at(-1), /já tem contas guardadas/);
  });
});
