// O enxugar devolve o disco de verdade: mede o espaço livre do volume antes e depois. Fica fora do `*.test.mjs` porque
// qualquer outro teste gravando ao mesmo tempo mexe no espaço livre e dava falso vermelho; o `npm test` roda este
// arquivo sozinho, depois dos outros (`--test-concurrency=1`). Isso não segura outra cópia da suíte (outra sessão, outro
// worktree) medindo o mesmo volume na mesma hora: a trava abaixo é da máquina, não do processo.
import assert from 'node:assert/strict';
import { closeSync, fsyncSync, openSync, readFileSync, rmSync, statfsSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { enxugar } from '../conversas.mjs';
import { CONTA_A, CONTA_B, ORG, entrada, montar } from './fabrica.mjs';

const TRAVA = join(tmpdir(), 'contas-enxugar-disco.trava');
const ESPERA_DA_TRAVA_MS = 50;
const TENTATIVAS_DE_MEDIR = 3;
const GASTO_MINIMO = 12 * 1024 * 1024;

const vivo = (pid) => {
  try { process.kill(pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
};

/** Toma a trava da medição (a de um processo morto é tomada de volta); devolve quem a solta. */
function travarMedicao() {
  for (;;) {
    try {
      writeFileSync(TRAVA, String(process.pid), { flag: 'wx' });
      return () => rmSync(TRAVA, { force: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let dono = 0;
      try { dono = Number(readFileSync(TRAVA, 'utf8')); } catch { continue; }
      if (dono > 0 && !vivo(dono)) { rmSync(TRAVA, { force: true }); continue; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ESPERA_DA_TRAVA_MS);
    }
  }
}

describe('enxugar: o disco que volta (medido no volume)', () => {
  // O teste que faltava: conteúdo igual e `ino` diferente também passariam numa cópia comum, que gasta o disco de novo.
  // Aqui o que se mede é o espaço livre do volume antes e depois.
  const gravar = (caminho, texto) => {
    const fd = openSync(caminho, 'w');
    try { writeSync(fd, texto); fsyncSync(fd); } finally { closeSync(fd); }
  };

  it('a cópia re-clonada devolve o espaço que a cópia comum gastou', (t) => {
    if (process.platform !== 'darwin') { t.skip('o clone de blocos é do APFS'); return; }
    const soltar = travarMedicao();
    t.after(soltar);
    const amb = montar();
    const grande = `{"t":"${'x'.repeat(24 * 1024 * 1024)}"}`;
    const a = entrada(amb.sessoes, CONTA_A, ORG, 'g');
    const b = entrada(amb.sessoes, CONTA_B, ORG, 'g');
    const livre = () => { const s = statfsSync(amb.sessoes); return s.bavail * s.bsize; };
    gravar(a, grande);
    // O volume é da máquina: outro processo gravando ou apagando no meio entra na conta. O defeito (copiar em vez de
    // clonar) nunca devolve metade do gasto, então uma medição limpa em até três prova o clone sem dar falso vermelho.
    const medicoes = [];
    for (let tentativa = 1; tentativa <= TENTATIVAS_DE_MEDIR; tentativa++) {
      const antesDaCopia = livre();
      gravar(b, grande); // cópia comum: o mesmo conteúdo gastando disco de novo
      const gasto = antesDaCopia - livre();
      const depoisDaCopia = livre();
      const r = enxugar(amb.sessoes, { referencia: CONTA_A, aplicar: true });
      assert.deepEqual({ reclonados: r.reclonados, pulados: r.pulados }, { reclonados: 1, pulados: 0 });
      const devolvido = livre() - depoisDaCopia;
      medicoes.push({ gasto, devolvido });
      if (gasto >= GASTO_MINIMO && devolvido > gasto / 2) break;
    }
    const limpas = medicoes.filter((m) => m.gasto >= GASTO_MINIMO);
    if (limpas.length === 0) { t.skip(`o espaço livre do volume não mostra o gasto da cópia (${JSON.stringify(medicoes)}): a medição não detectaria a economia`); return; }
    assert.ok(limpas.some((m) => m.devolvido > m.gasto / 2), `o enxugo não devolveu metade do que a cópia gastou em nenhuma medição (${JSON.stringify(medicoes)}): não clonou, só copiou de novo`);
    assert.equal(readFileSync(b, 'utf8'), grande, 'a cópia re-clonada perdeu o conteúdo');
  });
});
