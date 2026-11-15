import { makeColors } from './make-colors.js'

/**
 * Uma paleta por céu, cada uma só com o seu modo (`only`): o app deve seguir o botão de tema do kit, não o modo do sistema.
 * Só os cinzas mudam; os papéis (destaque, erro, sucesso) e o git ficam os do app.
 */

/** Noite: quase preto, com um fio de roxo. */
export const CORES_NOITE = makeColors({
  label: 'Céu estrelado',
  only: 'dark',
  dark: {
    gray: {
      anchors: {
        'surface-0': '#09080e',
        'surface-1': '#0e0c14',
        'surface-2': '#13111a',
        'surface-3': '#191621',
        'text-primary': '#ecebf1',
        'text-secondary': '#c9c6d3',
        'text-muted': '#a3a0b0',
      },
    },
  },
})

/** Dia: quase branco, com um fio do azul do céu. No claro, `surface-2` e `surface-3` têm de ser iguais. */
export const CORES_DIA = makeColors({
  label: 'Céu de dia',
  only: 'light',
  light: {
    gray: {
      anchors: {
        'surface-0': '#edf2f8',
        'surface-1': '#f3f6fa',
        'surface-2': '#f9fbfd',
        'surface-3': '#f9fbfd',
        'text-primary': '#1f3a5f',
        'text-secondary': '#3a4d66',
        'text-muted': '#556579',
      },
    },
  },
})
