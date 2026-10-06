import type { Block } from './markdown'
import type { Style } from './theme'

export const LATEX_FONT_PX = 40
export const LATEX_DPR = 2
const PX_PER_ROW = LATEX_FONT_PX * LATEX_DPR

export const mathOf = (block: Block): string | null => {
  if (block.kind !== 'code' || block.lang.toLowerCase() !== 'math' || block.isOpen) return null
  const tex = block.lines.map(line => line.replace(/(^|[^\\])%.*$/, '$1')).join(' ').replace(/\s+/g, ' ').trim()
  return tex === '' || tex.startsWith('#') ? null : tex
}

export const pngSize = (base64: string): { width: number; height: number } | null => {
  const head = atob(base64.slice(0, 32))
  if (!head.startsWith('\x89PNG')) return null
  const word = (at: number) => [0, 1, 2, 3].reduce((n, i) => n * 256 + head.charCodeAt(at + i), 0)
  return { width: word(16), height: word(20) }
}

export const fitFormula = (size: { width: number; height: number }, style: Style, columns: number): { columns: number; rows: number } | null => {
  const aspect = size.width / size.height / style.latexCellRatio
  const room = Math.min(255, columns - 2)
  let rows = Math.min(255, Math.max(1, Math.round((size.height * style.latexScale) / PX_PER_ROW)))
  while (rows > 1 && Math.round(aspect * rows) > room) rows--
  const width = Math.max(1, Math.round(aspect * rows))
  return width <= room ? { columns: width, rows } : null
}

export const renderedOf = (stdout: string, count: number): boolean[] => {
  const rendered = new Set([...stdout.matchAll(/^OK\s+(\d+)\s/gm)].map(m => Number(m[1])))
  return Array.from({ length: count }, (_, i) => rendered.has(i + 1))
}
