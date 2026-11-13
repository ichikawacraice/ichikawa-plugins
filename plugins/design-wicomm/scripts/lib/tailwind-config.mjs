// O `tailwind.config.*` de um projeto, lido como TEXTO: o script de medida não
// executa código do projeto auditado (o config faz `require` de plugins que
// podem nem estar instalados). Lê o literal de objeto do `theme` com um parser
// tolerante: chave, string, objeto, lista; o resto vira o texto cru.

/** O índice do `}`/`]` que fecha o bloco aberto em `inicio`, pulando strings e comentários. */
function fimDoBloco(texto, inicio) {
  const abre = texto[inicio]
  const fecha = abre === '{' ? '}' : ']'
  let nivel = 0
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < texto.length && texto[i] !== c; i++) if (texto[i] === '\\') i++
    } else if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i++
    } else if (c === '/' && texto[i + 1] === '*') {
      i = texto.indexOf('*/', i + 2)
      if (i < 0) return texto.length - 1
      i++
    } else if (c === abre) nivel++
    else if (c === fecha && --nivel === 0) return i
  }
  return texto.length - 1
}

/** Um literal de objeto (o texto de `{` a `}`) em objeto JS: folha é string (sem aspas) ou o texto cru. */
export function lerObjeto(texto) {
  const obj = {}
  let i = 1
  const fim = texto.length - 1
  const pular = () => {
    for (;;) {
      while (i < fim && /[\s,]/.test(texto[i])) i++
      if (texto.startsWith('//', i)) while (i < fim && texto[i] !== '\n') i++
      else if (texto.startsWith('/*', i)) i = texto.indexOf('*/', i) + 2
      else return
    }
  }
  while (i < fim) {
    pular()
    if (i >= fim) break
    let chave
    const q = texto[i]
    if (q === '"' || q === "'") {
      const f = texto.indexOf(q, i + 1)
      chave = texto.slice(i + 1, f)
      i = f + 1
    } else if (q === '[') {
      const f = fimDoBloco(texto, i)
      chave = texto.slice(i + 1, f).replace(/^["'`]|["'`]$/g, '')
      i = f + 1
    } else if (texto.startsWith('...', i)) {
      while (i < fim && !/[,\n}]/.test(texto[i])) i++
      continue
    } else {
      const m = /^[\w$-]+/.exec(texto.slice(i))
      if (!m) {
        i++
        continue
      }
      chave = m[0]
      i += chave.length
    }
    while (i < fim && /\s/.test(texto[i])) i++
    if (texto[i] !== ':') {
      obj[chave] = chave // abreviação `{ a }`
      continue
    }
    i++
    while (i < fim && /\s/.test(texto[i])) i++
    const c = texto[i]
    if (c === '{') {
      const f = fimDoBloco(texto, i)
      obj[chave] = lerObjeto(texto.slice(i, f + 1))
      i = f + 1
    } else if (c === '"' || c === "'" || c === '`') {
      let f = i + 1
      while (f < fim && texto[f] !== c) f += texto[f] === '\\' ? 2 : 1
      obj[chave] = texto.slice(i + 1, f)
      i = f + 1
    } else {
      // lista ou expressão: o texto cru até a vírgula do nível de cima
      const ini = i
      let nivel = 0
      for (; i < fim; i++) {
        const d = texto[i]
        if (d === '[' || d === '(' || d === '{') nivel++
        else if (d === ']' || d === ')' || d === '}') nivel--
        else if ((d === ',' || d === '\n') && nivel === 0) break
        else if (d === '"' || d === "'" || d === '`') for (i++; i < fim && texto[i] !== d; i++) if (texto[i] === '\\') i++
      }
      obj[chave] = texto.slice(ini, i).trim()
    }
  }
  return obj
}

/** O objeto da primeira chave `nome:` que abre um bloco, dentro de `texto`. */
export function blocoDe(texto, nome) {
  const re = new RegExp(`(?<![\\w$-])["']?${nome}["']?\\s*:\\s*\\{`, 'g')
  const m = re.exec(texto)
  if (!m) return null
  const ini = m.index + m[0].length - 1
  return lerObjeto(texto.slice(ini, fimDoBloco(texto, ini) + 1))
}

/** As folhas de um objeto aninhado, com o nome do Tailwind (`primary.DEFAULT` → `primary`). */
export function achatar(obj, prefixo = '') {
  const saida = {}
  for (const [k, v] of Object.entries(obj ?? {})) {
    const nome = k === 'DEFAULT' ? prefixo : prefixo ? `${prefixo}-${k}` : k
    if (v && typeof v === 'object') Object.assign(saida, achatar(v, nome))
    else saida[nome] = v
  }
  return saida
}

/** O que o config declara e a medida usa: cores, raios, fontes, movimento, modo escuro, plugins. */
export function lerConfigTailwind(texto) {
  const theme = blocoDe(texto, 'theme') ?? {}
  const extend = theme.extend ?? {}
  const juntar = (chave) => ({ ...achatar(theme[chave]), ...achatar(extend[chave]) })
  const cores = juntar('colors')
  // Cor de tema em `var(--x)` sem `<alpha-value>`: no v3, `bg-x/10` não gera CSS nenhum.
  const semAlfa = Object.entries(cores)
    .filter(([, v]) => typeof v === 'string' && /var\(--/.test(v) && !v.includes('<alpha-value>'))
    .map(([k]) => k)
  const movimento = []
  for (const chave of ['animation', 'transitionDuration', 'transitionTimingFunction', 'transitionDelay']) {
    for (const [nome, valor] of Object.entries(juntar(chave))) {
      for (const m of String(valor).matchAll(/(?<![\w-])(\d*\.?\d+m?s)(?![\w-])/g)) movimento.push({ onde: `${chave}.${nome}`, tipo: 'duração', valor: m[1] })
      for (const m of String(valor).matchAll(/(?<![\w-])(ease-in-out|ease-in|ease-out|ease|linear|cubic-bezier\([^)]*\))(?![\w-])/g)) movimento.push({ onde: `${chave}.${nome}`, tipo: 'curva', valor: m[1] })
    }
  }
  const darkMode = /darkMode\s*:\s*(\[[^\]]*\]|["'][^"']*["'])/.exec(texto)?.[1]?.replace(/\s+/g, '') ?? null
  return {
    cores,
    semAlfa,
    raios: juntar('borderRadius'),
    fontes: juntar('fontFamily'),
    movimento,
    darkMode,
    plugins: [...texto.matchAll(/require\(\s*["']([^"']+)["']\s*\)|import\s+\w+\s+from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? m[2]).filter((p) => p !== 'tailwindcss'),
  }
}
