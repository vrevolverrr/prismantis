import type { PluginOptions } from 'claude-code'

import { PRESETS } from './presets'

export const TOKENS = [
  'accent', 'heading', 'strong', 'emphasis', 'inlineCode', 'codeText', 'codeCommand', 'codeFlag', 'codeString', 'codeComment',
  'link', 'path', 'number', 'quote', 'rule', 'tableHeader', 'tableRule', 'bullet', 'diagram', 'diagramText', 'math',
] as const

export type Theme = Partial<Record<(typeof TOKENS)[number], string>>

export type Style = {
  theme: Theme
  headingStyle: 'bold' | 'underline' | 'uppercase' | 'banner'
  tableStyle: 'box' | 'rules' | 'grid' | 'minimal'
  taskStyle: 'checks' | 'ticks' | 'box' | 'progress'
  highlightNumbers: boolean
  highlightPaths: boolean
  mermaid: boolean
  mermaidAscii: boolean
  copyButtons: boolean
  latex: 'auto' | 'always' | 'off'
  latexCommand: string
  latexScale: number
  latexCellRatio: number
}

const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|ansi256\(\d{1,3}\)|(black|red|green|yellow|blue|magenta|cyan|white|gray|grey)(Bright)?)$/i

export const isColor = (value: unknown): value is string => typeof value === 'string' && COLOR.test(value.trim())

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const within = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export const resolveStyle = (options: PluginOptions): Style => {
  const base: Theme = (PRESETS as Record<string, Theme>)[String(options.theme)] ?? PRESETS['catppuccin-mocha']
  const fromFields = Object.fromEntries(
    TOKENS.filter(k => isColor(options[`${k}Color`])).map(k => [k, String(options[`${k}Color`]).trim()]),
  )

  return {
    theme: { ...base, ...fromFields },
    headingStyle: pick(options.headingStyle, ['bold', 'underline', 'uppercase', 'banner'] as const, 'banner'),
    tableStyle: pick(options.tableStyle, ['box', 'rules', 'grid', 'minimal'] as const, 'box'),
    taskStyle: pick(options.taskStyle, ['checks', 'ticks', 'box', 'progress'] as const, 'checks'),
    highlightNumbers: options.highlightNumbers !== false,
    highlightPaths: options.highlightPaths !== false,
    mermaid: options.mermaid !== false,
    mermaidAscii: options.mermaidAscii === true,
    copyButtons: options.copyButtons === true,
    latex: pick(options.latex, ['auto', 'always', 'off'] as const, 'auto'),
    latexCommand: typeof options.latexCommand === 'string' && options.latexCommand.trim() !== '' ? options.latexCommand.trim() : 'ratex-render',
    latexScale: within(options.latexScale, 1, 0.25, 10),
    latexCellRatio: within(options.latexCellRatio, 0.5, 0.1, 2),
  }
}
