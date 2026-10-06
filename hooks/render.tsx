import type { ElementTable, RenderElement } from 'claude-code'

import type { Block, Inline } from './markdown'
import { inlineText } from './markdown'
import type { Style } from './theme'

const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]|\p{Extended_Pictographic}/u
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter() : undefined

export const width = (s: string): number => {
  const graphemes = segmenter ? [...segmenter.segment(s)].map(g => g.segment) : [...s]
  return graphemes.reduce((w, g) => (/^\p{M}+$/u.test(g) ? w : w + (WIDE.test(g) ? 2 : 1)), 0)
}

const renderInline = (el: ElementTable, style: Style, nodes: Inline[], keyBase: string): RenderElement[] => {
  const { Text } = el
  const t = style.theme
  return nodes.map((n, i) => {
    const key = `${keyBase}.${i}`
    switch (n.kind) {
      case 'text':
        return <Text key={key}>{n.text}</Text>
      case 'strong':
        return <Text key={key} bold color={t.strong}>{renderInline(el, style, n.children, key)}</Text>
      case 'emphasis':
        return <Text key={key} italic color={t.emphasis}>{renderInline(el, style, n.children, key)}</Text>
      case 'strike':
        return <Text key={key} strikethrough dimColor>{renderInline(el, style, n.children, key)}</Text>
      case 'code':
        return <Text key={key} color={t.inlineCode}>{n.text}</Text>
      case 'link':
        return n.text === n.href
          ? <Text key={key} color={t.link} underline>{n.href}</Text>
          : <Text key={key}><Text color={t.link} underline>{n.text}</Text><Text dimColor> ({n.href})</Text></Text>
      case 'number':
        return <Text key={key} color={t.number}>{n.text}</Text>
      case 'path':
        return <Text key={key} color={t.path}>{n.text}</Text>
      case 'dim':
        return <Text key={key} dimColor>{n.text}</Text>
    }
  })
}

export const remember = <T,>(cache: Map<string, T>, key: string, make: () => T, limit = 200): T => {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const value = make()
  cache.set(key, value)
  if (cache.size > limit) cache.delete(cache.keys().next().value!)
  return value
}

const isShellLang = (lang: string) => lang === '' || /^(sh|bash|zsh|shell|console|fish|powershell|ps1)$/i.test(lang)

export const codeLine = (el: ElementTable, style: Style, line: string, lang: string, key: string): RenderElement => {
  const { Text } = el
  const t = style.theme
  const isShell = isShellLang(lang)
  if (/[\u2500-\u257F]/.test(line)) return <Text key={key} color={t.codeText}>{line}</Text>
  if (!isShell) return <Text key={key} color={t.codeText}>{line || ' '}</Text>
  if (/^\s*#/.test(line)) return <Text key={key} color={t.codeComment}>{line}</Text>
  const parts = line.split(/("[^"]*"|'[^']*'|\s+)/).filter(p => p !== '')
  let seenCommand = false
  return (
    <Text key={key} color={t.codeText}>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p)) return <Text key={`${key}.${i}`}>{p}</Text>
        if (/^["']/.test(p)) return <Text key={`${key}.${i}`} color={t.codeString}>{p}</Text>
        if (/^--?[\w-]/.test(p)) return <Text key={`${key}.${i}`} color={t.codeFlag}>{p}</Text>
        if (!seenCommand && !/^[$>|&;]+$/.test(p)) {
          seenCommand = true
          return <Text key={`${key}.${i}`} color={t.codeCommand}>{p}</Text>
        }
        if (/^(\||&&|;|\|\|)$/.test(p)) seenCommand = false
        return <Text key={`${key}.${i}`}>{p}</Text>
      })}
    </Text>
  )
}

const columnWidths = (natural: number[], available: number, gap: number): number[] => {
  const room = Math.max(natural.length, available - gap * (natural.length - 1))
  const total = natural.reduce((a, b) => a + b, 0)
  if (total <= room) return natural
  const widths = natural.map(w => Math.max(1, Math.floor((w * room) / total)))
  while (widths.reduce((a, b) => a + b, 0) > room) {
    const widest = widths.indexOf(Math.max(...widths))
    if (widths[widest]! <= 1) break
    widths[widest]!--
  }
  return widths
}

const displayText = (inline: Inline[]): string =>
  inline.map(n => (n.kind === 'link' && n.text !== n.href ? `${n.text} (${n.href})` : 'children' in n ? displayText(n.children) : n.text)).join('')

const ART_WIDTH = 100

export const tableArt = (block: Extract<Block, { kind: 'table' }>): string => {
  const cells = [block.header, ...block.rows].map(r => block.header.map((_, c) => displayText(r[c] ?? [])))
  const widths = columnWidths(block.header.map((_, c) => Math.max(...cells.map(r => width(r[c]!)))), ART_WIDTH - 4, 3)
  const wrap = (text: string, w: number): string[] => {
    const out: string[] = []
    let current = ''
    for (const word of text.split(/\s+/).filter(Boolean)) {
      let rest = word
      while (width(rest) > w) {
        if (current) {
          out.push(current)
          current = ''
        }
        let piece = ''
        for (const ch of rest) {
          if (width(piece + ch) > w) break
          piece += ch
        }
        piece ||= [...rest][0]!
        out.push(piece)
        rest = rest.slice(piece.length)
      }
      if (!rest) continue
      const joined = current ? `${current} ${rest}` : rest
      if (width(joined) > w) {
        out.push(current)
        current = rest
      } else current = joined
    }
    return [...out, ...(current || !out.length ? [current] : [])]
  }
  const pad = (text: string, c: number, align: 'left' | 'right' | 'center') => {
    const room = widths[c]! - width(text)
    const left = align === 'right' ? room : align === 'center' ? Math.floor(room / 2) : 0
    return ' '.repeat(left) + text + ' '.repeat(room - left)
  }
  const line = (l: string, m: string, r: string) => l + widths.map(w => '─'.repeat(w + 2)).join(m) + r
  const row = (r: string[], header: boolean) => {
    const lines = r.map((text, c) => wrap(text, widths[c]!))
    return Array.from({ length: Math.max(...lines.map(l => l.length)) }, (_, i) =>
      `│ ${lines.map((l, c) => pad(l[i] ?? '', c, header ? 'center' : block.align[c] ?? 'left')).join(' │ ')} │`)
  }
  const art = [line('┌', '┬', '┐'), ...row(cells[0]!, true), ...cells.slice(1).flatMap(r => [line('├', '┼', '┤'), ...row(r, false)]), line('└', '┴', '┘')]
  return ['```', ...art, '```'].join('\n')
}

const renderTable = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'table' }>, columns: number, key: string) => {
  const { Box, Text } = el
  const t = style.theme
  const box = style.tableStyle === 'box'
  const gap = box ? 0 : style.tableStyle === 'grid' ? 3 : 2
  const natural = block.header.map((h, c) =>
    Math.max(width(displayText(h)), ...block.rows.map(r => width(displayText(r[c] ?? [])))),
  )
  const widths = box ? columnWidths(natural, columns - 4, 3) : columnWidths(natural, columns, gap)
  const ruleChar = style.tableStyle === 'grid' ? '━' : '─'
  const justify = (c: number) =>
    block.align[c] === 'right' ? 'flex-end' : block.align[c] === 'center' ? 'center' : 'flex-start'

  const rule = (k: string, heavy: boolean) => (
    <Box key={k} flexDirection="row" columnGap={gap}>
      {widths.map((w, c) => (
        <Text key={`${k}.${c}`} color={t.tableRule} dimColor={!heavy && !t.tableRule}>
          {(heavy ? ruleChar : '─').repeat(w)}
        </Text>
      ))}
    </Box>
  )

  const bar = (k: string, text: string) => <Text key={k} color={t.tableRule} dimColor={!t.tableRule}>{text}</Text>
  const edge = (k: string, [left, fill, mid, right]: string) =>
    bar(k, left + widths.map(w => fill!.repeat(w + 2)).join(mid) + right)

  const row = (cells: Inline[][], k: string, isHeader: boolean) => (
    <Box key={k} flexDirection="row" columnGap={gap}>
      {box && bar(`${k}.l`, '│ ')}
      {widths.map((w, c) => {
        const content = cells[c] ?? []
        const cellBox = (
          <Box key={`${k}.${c}`} width={w} flexShrink={0} justifyContent={justify(c)}>
            {isHeader
              ? <Text bold color={t.tableHeader}>{inlineText(content)}</Text>
              : <Text>{renderInline(el, style, content, `${k}.${c}`)}</Text>}
          </Box>
        )
        return box && c > 0 ? [bar(`${k}.${c}s`, ' │ '), cellBox] : cellBox
      })}
      {box && bar(`${k}.r`, ' │')}
    </Box>
  )

  if (box) {
    const lines: RenderElement[] = [edge(`${key}.t`, '┌─┬┐'), row(block.header, `${key}.h`, true), edge(`${key}.hr`, '╞═╪╡')]
    block.rows.forEach((r, i) => {
      if (i > 0) lines.push(edge(`${key}.r${i}r`, '├─┼┤'))
      lines.push(row(r, `${key}.r${i}`, false))
    })
    lines.push(edge(`${key}.b`, '└─┴┘'))
    return <Box key={key} flexDirection="column">{lines}</Box>
  }

  const body: RenderElement[] = [row(block.header, `${key}.h`, true), rule(`${key}.hr`, true)]
  block.rows.forEach((r, i) => {
    body.push(row(r, `${key}.r${i}`, false))
    if (style.tableStyle !== 'minimal' && i < block.rows.length - 1) body.push(rule(`${key}.r${i}r`, false))
  })
  return <Box key={key} flexDirection="column">{body}</Box>
}

const renderHeading = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'heading' }>, key: string) => {
  const { Box, Text } = el
  const { inline } = block
  const t = style.theme
  const color = block.level <= 2 ? t.heading : t.accent ?? t.heading
  const label = inlineText(inline)
  switch (style.headingStyle) {
    case 'uppercase':
      return <Text key={key} bold color={color}>{block.level === 1 ? label.toUpperCase() : label}</Text>
    case 'underline':
      return <Text key={key} bold underline={block.level <= 2} color={color}>{label}</Text>
    case 'banner':
      if (block.level === 1) return <Box key={key} alignSelf="flex-start" borderStyle="bold" borderColor={color} paddingX={1}><Text bold color={color}>{renderInline(el, style, inline, key)}</Text></Box>
      return block.level === 2
        ? <Box key={key} flexDirection="column" alignSelf="flex-start"><Text bold color={color}>{renderInline(el, style, inline, key)}</Text><Text color={color}>{'━'.repeat(width(label))}</Text></Box>
        : <Text key={key} bold color={block.level === 3 ? color : t.strong}>{renderInline(el, style, inline, key)}</Text>
    default:
      return <Text key={key} bold color={color}>{renderInline(el, style, inline, key)}</Text>
  }
}

const ALERT_COLOR = { note: 'blue', tip: 'green', important: 'magenta', warning: 'yellow', caution: 'red' } as const

const renderParagraph = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'paragraph' }>, key: string) =>
  <el.Text key={key}>{renderInline(el, style, block.inline, key)}</el.Text>

const renderQuote = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'quote' }>, key: string) => {
  const { Box, Text } = el
  const t = style.theme
  return (
    <Box key={key} flexDirection="row">
      <Text color={t.accent}>│ </Text>
      <Text italic color={t.quote}>{renderInline(el, style, block.inline, key)}</Text>
    </Box>
  )
}

const renderAlert = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'alert' }>, key: string) => {
  const { Box, Text } = el
  const color = ALERT_COLOR[block.level]
  return (
    <Box key={key} flexDirection="column" alignSelf="flex-start" borderStyle="round" borderColor={color} paddingX={1}>
      <Text bold color={color}>{block.level[0]!.toUpperCase() + block.level.slice(1)}</Text>
      {block.inline.length ? <Text>{renderInline(el, style, block.inline, key)}</Text> : null}
    </Box>
  )
}

const TASK_GLYPHS = { checks: ['[ ]', '[✓]'], ticks: ['○', '✓'], box: ['□', '✓'], progress: ['○', '✓'] } as const

const renderList = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'list' }>, key: string) => {
  const { Box, Text } = el
  const t = style.theme
  const tasks = block.items.filter(item => item.task !== undefined)
  const done = tasks.filter(item => item.task).length
  const filled = tasks.length ? Math.round((done / tasks.length) * 20) : 0
  const strike = style.taskStyle === 'checks' || style.taskStyle === 'box'
  const tick = style.taskStyle === 'ticks' || style.taskStyle === 'progress'
  return (
    <Box key={key} flexDirection="column">
      {style.taskStyle === 'progress' && tasks.length > 0 && (
        <Text>
          <Text color={t.accent}>{'━'.repeat(filled)}</Text>
          <Text color={t.bullet} dimColor>{'─'.repeat(20 - filled)}</Text>
          <Text color={t.bullet}>{` ${done}/${tasks.length} done`}</Text>
        </Text>
      )}
      {block.items.map((item, i) => {
        const k = `${key}.${i}`
        const glyph = item.task !== undefined ? TASK_GLYPHS[style.taskStyle][item.task ? 1 : 0] : /\d/.test(item.marker) ? item.marker : item.depth ? '◦' : '•'
        const glyphColor = item.task && tick ? t.accent : t.bullet
        return (
          <Box key={k} flexDirection="row" paddingLeft={item.depth * 2}>
            <Text color={glyphColor}>{`${glyph} `}</Text>
            <Text dimColor={item.task === true} strikethrough={item.task === true && strike}>{renderInline(el, style, item.inline, k)}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export type CopyButton = (text: string | (() => string), key: string, label?: string) => RenderElement | null
export type Drawn = Map<number, { element: RenderElement; art?: string; copies?: true }>

const copySource = (block: Block): string | undefined =>
  block.kind === 'code' ? block.lines.join('\n') : block.kind === 'table' || block.kind === 'list' ? block.raw : block.kind === 'quote' || block.kind === 'alert' ? block.raw.split('\n').map(line => line.replace(/^\s*>\s?/, '')).join('\n') : undefined

export const renderBlocks = (el: ElementTable, style: Style, blocks: Block[], columns: number, drawn: Drawn = new Map(), copy?: CopyButton): RenderElement[] => {
  const { Box, Text } = el
  const t = style.theme
  const rendered = blocks.map((block, b) => {
    const key = `b${b}`
    switch (block.kind) {
      case 'heading':
        return renderHeading(el, style, block, key)
      case 'paragraph':
        return renderParagraph(el, style, block, key)
      case 'quote':
        return renderQuote(el, style, block, key)
      case 'alert':
        return renderAlert(el, style, block, key)
      case 'rule':
        return <Text key={key} color={t.rule} dimColor={!t.rule}>{'─'.repeat(Math.max(8, Math.min(columns, 80)))}</Text>
      case 'code':
        return drawn.get(b)?.element ?? <el.Markdown key={key} text={block.raw} />
      case 'list':
        return renderList(el, style, block, key)
      case 'table':
        return renderTable(el, style, block, columns, key)
    }
  })
  const copied = rendered.map((element, b) => {
    if (drawn.get(b)?.copies) return element
    const block = blocks[b]
    const text = block ? copySource(block) : undefined
    const art = drawn.get(b)?.art ?? (block?.kind === 'table' ? () => tableArt(block) : undefined)
    const first = text === undefined ? null : copy?.(text, `copy${b}`, art === undefined || block?.kind === 'table' ? undefined : '⧉ source')
    const second = first && art !== undefined ? copy?.(art, `art${b}`, '⧉ art') : null
    const button = second ? (
      <el.Box key={`copies${b}`} flexDirection="row" columnGap={1}>
        {first}
        {second}
      </el.Box>
    ) : first
    if (!button) return element
    const { Box } = el
    return block?.kind === 'quote' || block?.kind === 'alert' ? (
      <Box key={`c${b}`} flexDirection="row" columnGap={2}>
        {element}
        {button}
      </Box>
    ) : (
      <Box key={`c${b}`} flexDirection="column" alignSelf="flex-start">
        <Box justifyContent="flex-end">{button}</Box>
        {element}
      </Box>
    )
  })
  const isFigure = (b: number) => blocks[b]?.kind === 'table' || drawn.get(b)?.art !== undefined
  const out: RenderElement[] = []
  for (let b = 0; b < rendered.length; b++) {
    if (!isFigure(b) || !isFigure(b + 1)) {
      out.push(copied[b]!)
      continue
    }
    const start = b
    while (isFigure(b + 1)) b++
    out.push(
      <Box key={`row${start}`} flexDirection="row" flexWrap="wrap" columnGap={4} rowGap={1}>
        {copied.slice(start, b + 1).map((figure, i) => <Box key={`f${start + i}`} flexShrink={0}>{figure}</Box>)}
      </Box>,
    )
  }
  return out
}

export type ToolRow = { tool: string; input: unknown; isRunning: boolean; isErrored: boolean; isInterrupted: boolean }

const VERBS: Record<string, string> = {
  Bash: 'Ran', PowerShell: 'Ran', Read: 'Read', Write: 'Wrote', Edit: 'Edited', MultiEdit: 'Edited', NotebookEdit: 'Edited',
  Grep: 'Searched', Glob: 'Listed', WebFetch: 'Fetched', WebSearch: 'Searched the web for', Agent: 'Delegated', Task: 'Delegated',
}

const field = (input: unknown, ...keys: string[]): string | undefined => {
  if (input === null || typeof input !== 'object') return undefined
  for (const k of keys) {
    const v = (input as Record<string, unknown>)[k]
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return undefined
}

export const renderToolRow = (el: ElementTable, style: Style, row: ToolRow): RenderElement => {
  const { Box, Text } = el
  const t = style.theme
  const isShell = row.tool === 'Bash' || row.tool === 'PowerShell'
  const verb = VERBS[row.tool] ?? row.tool.replace(/^mcp__([^_]+)__/, '$1 ')
  const target = isShell
    ? field(row.input, 'command')?.split('\n')[0]
    : field(row.input, 'file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description')
  const dot = row.isErrored ? t.codeFlag : row.isInterrupted ? t.codeComment : row.isRunning ? t.accent : t.number
  const isPath = target !== undefined && /^(~|\.{0,2}\/|[A-Za-z]:\\)/.test(target)

  return (
    <Box marginTop={1} flexDirection="row">
      <Box width={2} flexShrink={0}>
        <Text color={dot}>{row.isRunning ? '◌' : '●'}</Text>
      </Box>
      <Text wrap="truncate-end">
        <Text bold>{verb}</Text>
        {target === undefined ? null : <Text> </Text>}
        {target === undefined ? null : isShell ? codeLine(el, style, target, 'bash', 'cmd') : <Text color={isPath ? t.path : t.inlineCode}>{target}</Text>}
        {row.isInterrupted ? <Text dimColor> interrupted</Text> : row.isErrored ? <Text color={t.codeFlag}> failed</Text> : null}
      </Text>
    </Box>
  )
}

const OUTPUT_LINES = 120

const lines = (value: unknown): string[] => (typeof value === 'string' && value !== '' ? value.replace(/\n$/, '').split('\n') : [])

export const renderExpandedShell = (el: ElementTable, style: Style, row: ToolRow & { output?: unknown }): RenderElement => {
  const { Box, Text } = el
  const t = style.theme
  const command = (field(row.input, 'command') ?? '').split('\n')
  const out = row.output !== null && typeof row.output === 'object' ? (row.output as Record<string, unknown>) : {}
  const stdout = lines(out.stdout)
  const stderr = lines(out.stderr)
  const shown = [...stdout.map(text => ({ text, color: undefined as string | undefined })), ...stderr.map(text => ({ text, color: t.codeFlag as string | undefined }))]
  const visible = shown.slice(0, OUTPUT_LINES)
  const dot = row.isErrored ? t.codeFlag : row.isInterrupted ? t.codeComment : row.isRunning ? t.accent : t.number
  return (
    <Box marginTop={1} flexDirection="column">
      <Box flexDirection="row">
        <Box width={2} flexShrink={0}>
          <Text color={dot}>{row.isRunning ? '◌' : '●'}</Text>
        </Box>
        <Box flexDirection="column">
          {command.map((line, i) => (
            <Text key={`c${i}`}>
              {i === 0 ? <Text bold>{`${row.tool}(`}</Text> : null}
              {codeLine(el, style, line, 'bash', `cmd${i}`)}
              {i === command.length - 1 ? <Text bold>)</Text> : null}
            </Text>
          ))}
        </Box>
      </Box>
      {row.isRunning ? null : (
        <Box paddingLeft={2}>
          <Box flexDirection="column" alignSelf="flex-start" borderStyle="round" borderColor={t.codeComment} paddingX={1}>
            {visible.length === 0 ? <Text dimColor>(No output)</Text> : visible.map((l, i) => <Text key={`o${i}`} color={l.color}>{l.text === '' ? ' ' : l.text}</Text>)}
            {shown.length > visible.length ? <Text dimColor>{`\u2026 +${shown.length - visible.length} lines`}</Text> : null}
          </Box>
        </Box>
      )}
    </Box>
  )
}

const GROUPS: [RegExp, string, string][] = [
  [/^(Bash|PowerShell)$/, 'ran', 'command'],
  [/^Read$/, 'read', 'file'],
  [/^(Write|Edit|MultiEdit|NotebookEdit)$/, 'edited', 'file'],
  [/^(Grep|Glob)$/, 'searched', 'pattern'],
  [/^(WebFetch|WebSearch)$/, 'fetched', 'page'],
  [/^(Agent|Task)$/, 'delegated', 'task'],
]

export const groupSummary = (calls: readonly { tool: string }[]): string => {
  const counts = new Map<string, number>()
  for (const call of calls) {
    const [, verb, noun] = GROUPS.find(([re]) => re.test(call.tool)) ?? [, 'used', call.tool.replace(/^mcp__([^_]+)__/, '$1 ')]
    const label = `${verb} ${noun}`
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const parts = [...counts].map(([label, n]) => {
    const [verb, ...noun] = label.split(' ')
    const name = noun.join(' ')
    return `${verb} ${n} ${n === 1 ? name : name.endsWith('h') ? `${name}es` : `${name}s`}`
  })
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const renderToolGroup = (el: ElementTable, style: Style, calls: readonly ToolRow[], isActive: boolean): RenderElement => {
  const { Box, Text } = el
  const t = style.theme
  const failed = calls.filter(c => c.isErrored).length
  const running = isActive && calls.some(c => c.isRunning)
  const dot = failed ? t.codeFlag : running ? t.accent : t.number
  const last = calls[calls.length - 1]
  const lastTarget = last ? field(last.input, 'command', 'file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description')?.split('\n')[0] : undefined
  return (
    <Box marginTop={1} flexDirection="row">
      <Box width={2} flexShrink={0}>
        <Text color={dot}>{running ? '◌' : '●'}</Text>
      </Box>
      <Text wrap="truncate-end">
        <Text bold>{groupSummary(calls)}</Text>
        {failed ? <Text color={t.codeFlag}>{` · ${failed} failed`}</Text> : null}
        {lastTarget ? <Text dimColor>{` · last: ${lastTarget}`}</Text> : null}
      </Text>
    </Box>
  )
}

export const formatDuration = (ms: number): string => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${Math.max(s, 0)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export const renderTurnDuration = ({ Box, Text }: ElementTable, style: Style, word: string, durationMs: number): RenderElement => (
  <Box marginTop={1}>
    <Text color={style.theme.codeComment}>
      {`✻ ${word} for `}
      <Text color={style.theme.number}>{formatDuration(durationMs)}</Text>
    </Text>
  </Box>
)
