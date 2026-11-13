---
name: tdd
description: Desenvolvimento guiado por teste — escrever o teste, vê-lo falhar pelo motivo certo, escrever o mínimo para passar, refatorar no verde. Use ao implementar qualquer feature, correção de bug, refatoração ou mudança de comportamento, ANTES de escrever o código de produção. Também ao revisar se um teste prova algo de fato.
---

# TDD

Escreva o teste primeiro. Veja falhar. Escreva o mínimo para passar.

**Princípio:** se você não viu o teste falhar, não sabe se ele testa a coisa certa.

```
NENHUM CÓDIGO DE PRODUÇÃO SEM UM TESTE QUE FALHOU ANTES
```

Escreveu o código antes do teste? Apague e recomece a partir do teste. Não guarde "como referência", não "adapte" enquanto escreve o teste: você vai adaptar, e isso é teste depois.

**Vale para:** feature nova, correção de bug, refatoração, mudança de comportamento.
**Exceções:** protótipo descartável, código gerado, arquivo de configuração. Fora dessas, a exceção é decisão de risco — siga sem TDD só marcando *assumida, a confirmar* e o motivo.

## Vermelho → verde → refatorar

### Vermelho: o teste que falha

Um teste mínimo, um comportamento, nome que diz o comportamento, código real (mock só quando inevitável).

```typescript
test('tenta de novo três vezes antes de desistir', async () => {
  let tentativas = 0;
  const operacao = async () => {
    tentativas++;
    if (tentativas < 3) throw new Error('falhou');
    return 'ok';
  };
  expect(await comNovaTentativa(operacao)).toBe('ok');
  expect(tentativas).toBe(3);
});
```

Ruim: `test('retry funciona')` com um `jest.fn()` encadeado que afirma quantas vezes o mock foi chamado — testa o mock, não o código.

### Ver falhar — obrigatório

Rode só o teste (o comando de testes afetados do projeto, com o arquivo). Confira:
- **falha**, não dá erro de import ou sintaxe;
- a mensagem é a esperada;
- falha porque a funcionalidade falta, não por erro de digitação.

**Passou de cara?** Você está testando o que já existe. Conserte o teste. **Deu erro?** Conserte o erro e rode até falhar do jeito certo.

### Verde: o mínimo

O código mais simples que passa. Sem opções, parâmetros ou "já que estou aqui" que o teste não pede (YAGNI).

### Ver passar — obrigatório

Rode de novo. Confira: o teste passa; os **testes afetados** pela mudança e o **typecheck** do projeto (os comandos do `CLAUDE.md`) continuam verdes; a saída está limpa, sem erro nem aviso. Teste falha → conserte o código, não o teste. Outro teste quebrou → conserte agora; falha que não foi você quem causou entra no relato pelo nome.

O gate completo não roda a cada ciclo: ele é do release. Durante o trabalho, afetados + typecheck.

### Refatorar — só no verde

Tire duplicação, melhore nomes, extraia funções. Continue verde. Não acrescente comportamento.

Próximo comportamento, próximo teste que falha.

## Teste bom

- **Mínimo:** uma coisa. "e" no nome? Divida.
- **Claro:** o nome descreve o comportamento (`'recusa e-mail vazio'`, não `'teste1'`).
- **Diz a intenção:** mostra a API que você queria ter.
- **Antes de escrever, nomeie a mudança de produção que o faria falhar.** Se nenhuma faria, o teste não prova nada.
- **Afirme comportamento real**, nunca o comportamento do mock.
- **Código só de teste mora nos utilitários de teste**, não em classe de produção.
- **Entenda os efeitos colaterais de uma dependência antes de simulá-la.**
- **Insumo antes da afirmação:** a lista que o teste percorre tem item; `toHaveLength(0)` sobre uma lista que nunca carregou passa sem medir nada.

## Bug: teste primeiro

Achou um bug? Escreva o teste que o reproduz, veja falhar, conserte, veja passar. O teste prova o conserto e impede a volta. Nunca conserte bug sem teste. A investigação da causa é `orquestracao:depurar`.

## Racionalizações que mudam o comportamento

| Desculpa | Realidade |
|---|---|
| "Simples demais para testar" | Código simples quebra. O teste leva 30 segundos. |
| "Testo depois" | Teste escrito depois passa de primeira — e isso não prova nada. Você confere os casos que lembrou, não os que descobriria. |
| "Já testei na mão" | Teste manual não fica registrado, não se repete quando o código muda. |
| "Apagar horas de trabalho é desperdício" | O tempo já foi. A escolha é reescrever com confiança ou manter código em que você não confia. |
| "Preciso explorar antes" | Explore. Depois jogue fora e comece pelo teste. |
| "Difícil de testar" | Difícil de testar = difícil de usar. Simplifique a interface; acoplamento demais pede injeção de dependência. |
| "O código existente não tem teste" | Você está mexendo nele. Acrescente teste para o que mexe. |

**Sinais de parar e recomeçar:** código antes do teste; teste que passou de cara; não sabe explicar por que falhou; "só desta vez"; "o espírito, não o ritual".

## Antes de dizer que terminou

- [ ] Toda função nova tem teste
- [ ] Viu cada teste falhar, pelo motivo esperado
- [ ] Escreveu o mínimo para passar
- [ ] Afetados e typecheck verdes, saída limpa — com a saída colada (`orquestracao:verificar-antes-de-concluir`)
- [ ] Casos de borda e erros cobertos
