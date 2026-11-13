// O enxugar devolve o disco de verdade: mede o espaço livre do volume antes e depois. Fica fora do `*.test.mjs` porque
// qualquer outro teste gravando ao mesmo tempo mexe no espaço livre e dava falso vermelho; o `npm test` roda este
// arquivo sozinho, depois dos outros (`--test-concurrency=1`).
import assert from 'node:assert/strict';
import { closeSync, fsyncSync, openSync, readFileSync, statfsSync, writeSync } from 'node:fs';
import { describe, it } from 'node:test';
import { enxugar } from '../conversas.mjs';
import { CONTA_A, CONTA_B, ORG, entrada, montar } from './fabrica.mjs';

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
