// A mesma conversa aparece na lista de cada conta, e cada cópia ocupava disco de novo (1,2 GB de repetição em 7 contas).
// O enxugar re-clona a cópia a partir de uma só: os blocos passam a ser divididos e cada arquivo segue independente.
import assert from 'node:assert/strict';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, readdirSync, statSync, statfsSync, utimesSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { enxugar, hashDoArquivo, reclonar } from '../conversas.mjs';
import { CONTA_A, CONTA_B, ORG, entrada, montar } from './fabrica.mjs';

const ORG2 = 'org-0002';
/**
 * O que não pode mudar num arquivo que o enxugar reescreve: conteúdo, data e modo. O `ino` diz se ele foi reescrito.
 * A data em ms inteiros, que é como o espelho a compara (`Math.floor`); abaixo disso o relógio do sistema de arquivos
 * e o float não concordam no último nanossegundo.
 */
const selo = (p) => { const s = statSync(p); return { mtimeMs: Math.floor(s.mtimeMs), modo: s.mode & 0o777, texto: readFileSync(p, 'utf8') }; };
const ino = (p) => statSync(p).ino;
const datar = (p, ms) => utimesSync(p, new Date(ms), new Date(ms));

/**
 * Seis entradas: `x` em três contas/organizações, `z` em duas (nenhuma na referência) e `y` só numa.
 * Cada arquivo com a sua data, para o teste provar que a data não se perde na reescrita.
 */
function acervo() {
  const amb = montar();
  const p = {
    refX: entrada(amb.sessoes, CONTA_A, ORG, 'x'),
    bX: entrada(amb.sessoes, CONTA_B, ORG, 'x'),
    b2X: entrada(amb.sessoes, CONTA_B, ORG2, 'x'),
    bZ: entrada(amb.sessoes, CONTA_B, ORG, 'z'),
    b2Z: entrada(amb.sessoes, CONTA_B, ORG2, 'z'),
    bY: entrada(amb.sessoes, CONTA_B, ORG, 'y'),
  };
  let ms = 1_700_000_000_000;
  for (const caminho of Object.values(p)) datar(caminho, (ms += 60_000));
  // O cenário só mede o que deve: três cópias repetidas, duas delas idênticas à da referência.
  assert.equal(readFileSync(p.refX, 'utf8'), readFileSync(p.b2X, 'utf8'));
  assert.notEqual(readFileSync(p.bY, 'utf8'), readFileSync(p.bZ, 'utf8'));
  return { amb, p };
}

const tmpsSoltos = (dir) => readdirSync(dir, { recursive: true }).filter((n) => String(n).endsWith('.troca-tmp'));

describe('enxugar: conta o repetido', () => {
  it('a seco relata os grupos e não toca em arquivo nenhum', () => {
    const { amb, p } = acervo();
    const antes = Object.fromEntries(Object.entries(p).map(([k, c]) => [k, { ...selo(c), ino: ino(c) }]));
    const r = enxugar(amb.sessoes, { referencia: CONTA_A });
    assert.deepEqual(
      { arquivos: r.arquivos, unicos: r.unicos, grupos: r.grupos, copias: r.copias, reclonados: r.reclonados, pulados: r.pulados },
      { arquivos: 6, unicos: 3, grupos: 2, copias: 3, reclonados: 0, pulados: 0 },
    );
    assert.ok(r.bytes > 0, 'a repetição medida não pode ser zero');
    for (const [k, c] of Object.entries(p)) assert.deepEqual({ ...selo(c), ino: ino(c) }, antes[k], k);
    assert.deepEqual(tmpsSoltos(amb.sessoes), []);
  });
});

describe('enxugar: aplica', () => {
  it('re-clona a cópia sem mudar conteúdo, data nem modo, e não reescreve a referência', () => {
    const { amb, p } = acervo();
    const antes = Object.fromEntries(Object.entries(p).map(([k, c]) => [k, { ...selo(c), ino: ino(c) }]));
    const r = enxugar(amb.sessoes, { referencia: CONTA_A, aplicar: true });
    assert.deepEqual({ reclonados: r.reclonados, pulados: r.pulados, copias: r.copias }, { reclonados: 3, pulados: 0, copias: 3 });
    // O conteúdo e a data seguem os mesmos em todos os seis; a cópia reescrita fica 0600, que é como a troca grava.
    for (const [k, c] of Object.entries(p)) assert.deepEqual({ mtimeMs: selo(c).mtimeMs, texto: selo(c).texto }, { mtimeMs: antes[k].mtimeMs, texto: antes[k].texto }, k);
    for (const k of ['bX', 'b2X', 'b2Z']) assert.equal(selo(p[k]).modo, 0o600, k);
    for (const k of ['refX', 'bZ', 'bY']) assert.equal(selo(p[k]).modo, antes[k].modo, k);
    // A referência e o doador do grupo sem referência não são reescritos; o arquivo único também não.
    for (const k of ['refX', 'bZ', 'bY']) assert.equal(ino(p[k]), antes[k].ino, `${k} foi reescrito e não devia`);
    // As cópias são arquivos novos (o clone divide blocos, mas não é o mesmo arquivo).
    for (const k of ['bX', 'b2X', 'b2Z']) assert.notEqual(ino(p[k]), antes[k].ino, `${k} não foi reescrito`);
    assert.deepEqual(tmpsSoltos(amb.sessoes), []);
    // Rodar de novo não acha menos do que havia: o enxugar não muda o que se mede.
    const outra = enxugar(amb.sessoes, { referencia: CONTA_A });
    assert.deepEqual({ arquivos: outra.arquivos, unicos: outra.unicos, copias: outra.copias }, { arquivos: 6, unicos: 3, copias: 3 });
  });

  it('sem referência o doador é um do grupo e os outros se re-clonam dele', () => {
    const { amb, p } = acervo();
    const r = enxugar(amb.sessoes, { aplicar: true });
    assert.deepEqual({ reclonados: r.reclonados, pulados: r.pulados }, { reclonados: 3, pulados: 0 });
    // Um arquivo de cada grupo fica de doador: dos quatro de x e z, três se reescreveram.
    const texto = readFileSync(p.refX, 'utf8');
    for (const k of ['bX', 'b2X']) assert.equal(readFileSync(p[k], 'utf8'), texto, k);
  });

  it('conta que não existe como referência não impede o enxugo', () => {
    const { amb } = acervo();
    const r = enxugar(amb.sessoes, { referencia: 'cccccccc-3333-4333-8333-cccccccccccc', aplicar: true });
    assert.deepEqual({ reclonados: r.reclonados, pulados: r.pulados }, { reclonados: 3, pulados: 0 });
  });

  it('acervo sem repetição não reescreve nada', () => {
    const amb = montar();
    const a = entrada(amb.sessoes, CONTA_A, ORG, 'a');
    const b = entrada(amb.sessoes, CONTA_B, ORG, 'b');
    const inos = [ino(a), ino(b)];
    const r = enxugar(amb.sessoes, { referencia: CONTA_A, aplicar: true });
    assert.deepEqual({ arquivos: r.arquivos, unicos: r.unicos, grupos: r.grupos, copias: r.copias, reclonados: r.reclonados, bytes: r.bytes }, { arquivos: 2, unicos: 2, grupos: 0, copias: 0, reclonados: 0, bytes: 0 });
    assert.deepEqual([ino(a), ino(b)], inos);
  });
});

describe('reclonar: a guarda contra gravação alheia', () => {
  it('recusa quando o destino mudou desde a leitura e grava quando o selo bate', () => {
    const amb = montar();
    const src = entrada(amb.sessoes, CONTA_A, ORG, 'x');
    const dst = entrada(amb.sessoes, CONTA_B, ORG, 'x');
    const hash = hashDoArquivo(src);
    const tamanho = statSync(dst).size;
    const antes = { ...selo(dst), ino: ino(dst) };
    // Data que não é a do arquivo: alguém gravou nele entre a varredura e agora.
    assert.equal(reclonar(src, dst, { hash, mtimeMs: 1, tamanho }), false);
    assert.deepEqual({ ...selo(dst), ino: ino(dst) }, antes, 'o destino recusado foi mexido');
    // Tamanho que não é o do arquivo: a mesma recusa.
    assert.equal(reclonar(src, dst, { hash, mtimeMs: antes.mtimeMs, tamanho: tamanho + 1 }), false);
    assert.deepEqual({ ...selo(dst), ino: ino(dst) }, antes);
    assert.deepEqual(tmpsSoltos(amb.sessoes), []);
    // Selo certo: grava, mantendo a data do destino.
    assert.equal(reclonar(src, dst, { hash, mtimeMs: antes.mtimeMs, tamanho }), true);
    assert.deepEqual(selo(dst), { mtimeMs: antes.mtimeMs, modo: 0o600, texto: antes.texto });
    assert.notEqual(ino(dst), antes.ino);
  });

  it('recusa quando a fonte não é mais o conteúdo que se mediu', () => {
    const amb = montar();
    const src = entrada(amb.sessoes, CONTA_A, ORG, 'x');
    const dst = entrada(amb.sessoes, CONTA_B, ORG, 'x');
    const antes = { ...selo(dst), ino: ino(dst) };
    const hash = hashDoArquivo(src);
    writeFileSync(src, '{"outra":"coisa"}');
    assert.notEqual(hashDoArquivo(src), hash, 'a fonte tinha de ter mudado para o teste medir algo');
    assert.equal(reclonar(src, dst, { hash, mtimeMs: antes.mtimeMs, tamanho: antes.texto.length }), false);
    assert.deepEqual({ ...selo(dst), ino: ino(dst) }, antes, 'o destino levou o conteúdo errado');
    assert.equal(existsSync(`${dst}.troca-tmp`), false);
  });
});

describe('enxugar: a cópia repetida dentro da conta em uso', () => {
  it('conta à parte, não entra no que se promete devolver e fica como está', () => {
    const amb = montar();
    const a1 = entrada(amb.sessoes, CONTA_A, ORG, 'x');
    const a2 = entrada(amb.sessoes, CONTA_A, ORG2, 'x');
    assert.equal(readFileSync(a1, 'utf8'), readFileSync(a2, 'utf8'), 'o cenário só mede algo se as duas forem iguais');
    const inos = [ino(a1), ino(a2)];
    const r = enxugar(amb.sessoes, { referencia: CONTA_A, aplicar: true });
    assert.deepEqual(
      { grupos: r.grupos, copias: r.copias, bytes: r.bytes, naConta: r.naConta, reclonados: r.reclonados, pulados: r.pulados },
      { grupos: 1, copias: 0, bytes: 0, naConta: 1, reclonados: 0, pulados: 0 },
    );
    assert.ok(r.bytesNaConta > 0, 'a repetição dentro da conta medida não pode ser zero');
    assert.deepEqual([ino(a1), ino(a2)], inos, 'a pasta da conta em uso foi reescrita');
    // O que se oferece devolver é o que se devolve: `reclonados + pulados` fecha com `copias`.
    assert.equal(r.reclonados + r.pulados, r.copias);
  });
});

describe('enxugar: temporário de rodada interrompida', () => {
  it('a seco fica onde está; com --aplicar sai da frente', () => {
    const amb = montar();
    entrada(amb.sessoes, CONTA_A, ORG, 'x');
    const dst = entrada(amb.sessoes, CONTA_B, ORG, 'x');
    const tmp = join(amb.sessoes, CONTA_B, ORG, 'local_sumiu.json.troca-tmp');
    writeFileSync(tmp, 'metade de uma gravação interrompida');
    enxugar(amb.sessoes, { referencia: CONTA_A });
    assert.equal(existsSync(tmp), true, 'a medição a seco mexeu em arquivo');
    const r = enxugar(amb.sessoes, { referencia: CONTA_A, aplicar: true });
    assert.equal(r.reclonados, 1, 'o cenário tinha de re-clonar a cópia de x também');
    assert.equal(existsSync(dst), true);
    assert.equal(existsSync(tmp), false, 'o temporário órfão ficou ocupando disco para sempre');
    assert.deepEqual(tmpsSoltos(amb.sessoes), []);
  });
});

describe('enxugar: o disco que volta (medido no volume)', () => {
  // O teste que faltava: conteúdo igual e `ino` diferente também passariam numa cópia comum, que gasta o disco de novo.
  // Aqui o que se mede é o espaço livre do volume antes e depois.
  const gravar = (caminho, texto) => {
    const fd = openSync(caminho, 'w');
    try { writeSync(fd, texto); fsyncSync(fd); } finally { closeSync(fd); }
  };

  it('a cópia re-clonada devolve o espaço que a cópia comum gastou', (t) => {
    if (process.platform !== 'darwin') { t.skip('o clone de blocos é do APFS'); return; }
    const amb = montar();
    const grande = `{"t":"${'x'.repeat(24 * 1024 * 1024)}"}`;
    const a = entrada(amb.sessoes, CONTA_A, ORG, 'g');
    const b = entrada(amb.sessoes, CONTA_B, ORG, 'g');
    const livre = () => { const s = statfsSync(amb.sessoes); return s.bavail * s.bsize; };
    gravar(a, grande);
    const antesDaCopia = livre();
    gravar(b, grande); // cópia comum: o mesmo conteúdo gastando disco de novo
    const gasto = antesDaCopia - livre();
    if (gasto < 12 * 1024 * 1024) { t.skip(`o espaço livre do volume não mostra o gasto da cópia (${gasto} bytes): a medição não detectaria a economia`); return; }
    const depoisDaCopia = livre();
    const r = enxugar(amb.sessoes, { referencia: CONTA_A, aplicar: true });
    assert.deepEqual({ reclonados: r.reclonados, pulados: r.pulados }, { reclonados: 1, pulados: 0 });
    const devolvido = livre() - depoisDaCopia;
    assert.ok(devolvido > gasto / 2, `o enxugo devolveu ${devolvido} bytes dos ${gasto} que a cópia gastou: não clonou, só copiou de novo`);
    assert.equal(readFileSync(b, 'utf8'), grande, 'a cópia re-clonada perdeu o conteúdo');
  });
});
