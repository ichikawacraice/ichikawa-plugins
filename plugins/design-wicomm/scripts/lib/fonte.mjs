// Leitura de código-fonte sem compilador, para os scripts de medida do plugin.
// CÓPIA de `packages/guardas/lib/fonte.mjs` e de trechos de duas guardas
// (`o-movimento-tem-escape`, `os-tokens-pagam-o-piso`): o plugin é instalado
// sozinho, sem os pacotes do repositório. O teste de concordância
// (`scripts/tests/medidas.test.mjs`) compara as duas cópias e reprova se uma
// andar sem a outra.

/**
 * As literais de string do fonte (`"…"`, `'…'`, `` `…` ``), com a linha onde
 * começam. Comentário de linha inteira e de bloco ficam de fora; a literal com
 * `${}` entra inteira, com a expressão dentro, porque a classe pode morar num
 * ternário.
 */
export function literaisDoFonte(fonte) {
  const achadas = []
  let linha = 1
  let i = 0
  while (i < fonte.length) {
    const c = fonte[i]
    const dois = fonte.slice(i, i + 2)
    if (c === '\n') {
      linha++
      i++
    } else if (dois === '//' && fonte[i - 1] !== ':') {
      while (i < fonte.length && fonte[i] !== '\n') i++
    } else if (dois === '/*') {
      const fim = fonte.indexOf('*/', i + 2)
      const ate = fim === -1 ? fonte.length : fim + 2
      linha += (fonte.slice(i, ate).match(/\n/g) ?? []).length
      i = ate
    } else if (c === '"' || c === "'" || c === '`') {
      const inicio = linha
      let j = i + 1
      let texto = ''
      let fechou = false
      let linhasDentro = 0
      while (j < fonte.length) {
        const d = fonte[j]
        if (d === '\\') {
          texto += fonte.slice(j, j + 2)
          j += 2
          continue
        }
        if (d === c) {
          fechou = true
          break
        }
        if (d === '\n') {
          if (c !== '`') break
          linhasDentro++
        }
        texto += d
        j++
      }
      if (fechou) {
        achadas.push({ linha: inicio, texto })
        linha += linhasDentro
        i = j + 1
      } else {
        i++
      }
    } else {
      i++
    }
  }
  return achadas
}

/**
 * Separa as variantes da classe base: `dark:hover:!bg-x` → variantes
 * `['dark','hover']`, base `bg-x`. O `:` dentro de colchete (`data-[a=b]:`)
 * não separa.
 */
export function separaVariante(token) {
  const partes = []
  let atual = ''
  let fundo = 0
  for (const ch of token) {
    if (ch === '[') fundo++
    if (ch === ']') fundo--
    if (ch === ':' && fundo === 0) {
      partes.push(atual)
      atual = ''
    } else {
      atual += ch
    }
  }
  return { variantes: partes, base: atual.replace(/^[!-]+/, '') }
}

/**
 * As tags de abertura de um componente, inteiras: atravessa a seta do
 * `onClick={() => …}` contando chaves, e não confunde `<ButtonGroup>` com
 * `<Button>`.
 */
export function tagsDeAbertura(fonte, nome) {
  const tags = []
  const abre = new RegExp(`<${nome}(?=[\\s>/])`, 'g')
  for (let m = abre.exec(fonte); m; m = abre.exec(fonte)) {
    let chaves = 0
    let i = m.index + m[0].length
    for (; i < fonte.length; i++) {
      const c = fonte[i]
      if (c === '{') chaves++
      else if (c === '}') chaves--
      else if (c === '>' && chaves === 0) break
    }
    tags.push({ indice: m.index, tag: fonte.slice(m.index, i + 1) })
  }
  return tags
}

export const ANIMA = /^animate-(?!none$)/
export const TRANSICAO = /^transition(?:-all|-transform|-opacity|-\[.+\])?$/

/** As regras de CSS que declaram animação, com o seletor e se moram sob `prefers-reduced-motion: reduce`. */
export function regrasDeAnimacao(css) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const achadas = []
  const pilha = []
  let cabeca = ''
  const fecha = () => {
    const decl = cabeca.trim()
    cabeca = ''
    if (pilha.length === 0 || !decl) return
    let valor = null
    const m = /^animation(?:-name)?\s*:\s*(.+?)\s*$/.exec(decl)
    if (m) valor = m[1]
    const ap = /^@apply\s+(.+)$/.exec(decl)
    if (ap) {
      const animados = ap[1].split(/\s+/).filter((t) => /^animate-/.test(t))
      if (animados.length > 0) valor = animados.includes('animate-none') ? 'none' : animados[0]
    }
    if (valor === null) return
    const noEscape = pilha.some((h) => /^@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)$/.test(h))
    for (const seletor of pilha[pilha.length - 1].split(',').map((x) => x.trim()).filter(Boolean)) achadas.push({ seletor, valor, noEscape })
  }
  for (const ch of limpo) {
    if (ch === '{') {
      pilha.push(cabeca.trim())
      cabeca = ''
    } else if (ch === '}') {
      fecha()
      pilha.pop()
    } else if (ch === ';') fecha()
    else cabeca += ch
  }
  return achadas
}

export function animacoesSemEscape(css) {
  const regras = regrasDeAnimacao(css)
  const desligadas = new Set(regras.filter((r) => r.valor === 'none' && r.noEscape).map((r) => r.seletor))
  // `@keyframes` também abre bloco, mas o passo (`0%`, `to`) não é seletor de quem anima.
  return [...new Set(regras.filter((r) => r.valor !== 'none' && !r.noEscape && !desligadas.has(r.seletor)).map((r) => r.seletor))]
}

/**
 * As declarações de variável da folha, NA ORDEM, com o tema de cada uma:
 * `claro` (no seletor claro), `escuro` (no seletor escuro, ou no claro dentro
 * de `@media (prefers-color-scheme: dark)`). A ordem importa: os dois
 * seletores têm a mesma especificidade, e no escuro vence o último.
 */
export function declaracoes(css, { claro = ':root', escuro = '.dark' } = {}) {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  const saida = []
  const pilha = []
  let cabeca = ''
  const doSeletor = (h, sel) => h.split(',').map((x) => x.trim()).includes(sel)
  const fecha = () => {
    const decl = cabeca.trim()
    cabeca = ''
    const m = /^(--[\w-]+)\s*:\s*([\s\S]+)$/.exec(decl)
    if (!m || pilha.length === 0) return
    const topo = pilha[pilha.length - 1]
    const mediaEscura = pilha.some((h) => /^@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/.test(h))
    const tema = doSeletor(topo, escuro) || (mediaEscura && doSeletor(topo, claro)) ? 'escuro' : doSeletor(topo, claro) ? 'claro' : null
    if (tema) saida.push({ tema, nome: m[1], valor: m[2].trim() })
  }
  for (const ch of limpo) {
    if (ch === '{') {
      pilha.push(cabeca.trim())
      cabeca = ''
    } else if (ch === '}') {
      fecha()
      pilha.pop()
    } else if (ch === ';') fecha()
    else cabeca += ch
  }
  return saida
}

/** As variáveis que valem num tema: o claro lê só o claro; o escuro lê os dois, e vence o último. */
export function varsDoTema(declaradas, tema) {
  const vars = {}
  for (const d of declaradas) if (d.tema === 'claro' || d.tema === tema) vars[d.nome] = d.valor
  return vars
}
/** As classes de uma literal, sem a pontuação de template (`${`, `}`, aspas). */
export function tokensDaLiteral(texto) {
  return texto
    .split(/\s+/)
    .map((t) => t.replace(/^["'`{}()$]+/, '').replace(/["'`{}()$]+$/, ''))
    .filter(Boolean)
}

