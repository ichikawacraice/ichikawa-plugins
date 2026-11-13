# Composição de componentes

Padrões para componente que cresce sem virar um monte de props booleanas. Adaptado de vercel-labs/agent-skills, `vercel-composition-patterns` (MIT, © Vercel), e de affaan-m/ECC (MIT).

## 1. Não acrescente prop booleana para mudar comportamento

Cada `isThread`, `isEditing`, `showAttachments` dobra os estados possíveis e vira `if` dentro do componente. Quando a terceira boolean aparecer, componha.

```tsx
// ruim: um componente, cinco modos
<Composer isThread isEditing={false} showAttachments hideActions />

// bom: a variante é um componente, as partes são filhas
<ThreadComposer channelId="abc" />
<EditComposer messageId="xyz" />
```

Cada variante monta exatamente as partes de que precisa (`Composer.Frame`, `.Input`, `.Footer`, `.Submit`) sobre a mesma base. **Variante explícita** (`<ThreadComposer>`, `<EditComposer>`) em vez de modo por boolean.

## 2. Componente composto: o estado fica no Provider

Um componente complexo vira um conjunto de peças que compartilham contexto. Quem usa decide quais peças aparecem e em que ordem.

```tsx
<Tabs defaultValue="perfil">
  <Tabs.List>
    <Tabs.Trigger value="perfil">Perfil</Tabs.Trigger>
    <Tabs.Trigger value="config">Config</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="perfil"><Perfil /></Tabs.Panel>
</Tabs>
```

- O pai (Provider) é o único que sabe **como** o estado é guardado (`useState`, store, servidor). As peças só leem o contexto.
- Teclado, ARIA e foco ficam na camada "sem estilo" (headless): Radix, Base UI, React Aria. Não reescreva à mão.

## 3. Contrato do contexto: `state`, `actions`, `meta`

Defina uma interface genérica; qualquer Provider que a cumpra funciona com as mesmas peças de UI (formulário local num lugar, estado sincronizado em outro).

```tsx
interface ComposerContext {
  state: { texto: string; enviando: boolean };
  actions: { atualizar: (fn: (s: ComposerContext["state"]) => ComposerContext["state"]) => void; enviar: () => void };
  meta: { inputRef: React.RefObject<HTMLTextAreaElement | null> };
}
const ComposerCtx = createContext<ComposerContext | null>(null);

function useComposer() {
  const ctx = use(ComposerCtx); // React 19; use() pode ficar dentro de if
  if (!ctx) throw new Error("Composer.* fora do <Composer.Provider>");
  return ctx;
}
```

## 4. Suba o estado para o Provider quando irmãos precisam dele

Botão "Enviar" fora do `Composer.Frame` que precisa do texto? Não use ref nem efeito para passar dado: ponha o Provider acima dos dois. Quem está dentro do Provider lê o estado mesmo estando fora do quadro visual.

## 5. `children` no lugar de `renderX`

```tsx
// ruim: o componente decide o que cabe em cada slot
<Composer renderHeader={() => <Cabecalho />} renderFooter={() => <Rodape />} />

// bom
<Composer.Frame>
  <Cabecalho />
  <Composer.Input />
  <Rodape />
</Composer.Frame>
```

Render prop (função como filho) só quando o pai precisa passar **dado** ao filho (item de lista virtualizada). Para compartilhar lógica, um hook costuma ser mais limpo que render prop.

## 6. Slots nomeados

Layout com regiões fixas: `<Page header={<Nav />} sidebar={<Filtros />}>…</Page>`. Para mais de 3 regiões, passe a composto.

## Quando não compor

Componente de uma tela só, sem reuso à vista: props simples bastam. Composição custa arquivos e indireção; compre quando a segunda variante aparecer, não antes.

Fonte: adaptado de vercel-labs/agent-skills (MIT) e affaan-m/ECC (MIT)
