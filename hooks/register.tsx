import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, RenderSurface } from 'claude-code'

import type { Formula } from '../types'
import { LATEX_DPR, LATEX_FONT_PX, fitFormula, mathOf, pngSize, renderedOf } from './latex'
import { parse } from './markdown'
import { boxArt, mermaidText } from './mermaid'
import type { Drawn } from './render'
import { remember, renderBlocks, renderExpandedShell, renderToolGroup, renderToolRow, renderTurnDuration, width } from './render'
import { helpText, showcaseText } from './help'
import { PRESET_NAMES } from './presets'
import type { Style } from './theme'
import { resolveStyle } from './theme'

const HINT = 'This terminal renders markdown tables and ```mermaid diagrams (including xychart-beta bar and line charts) as graphics. When content is a comparison, a flow or a series of numbers, prefer a table or diagram over prose, bullet lists or ASCII art.'

const COPY_HINT = 'Put any command or snippet the user may run or copy in a fenced block with a language tag, never inline code: fenced blocks get a copy button, inline code does not.'

const LATEX_HINT = 'This terminal typesets LaTeX math: a formula in $$…$$ on lines of its own, or in a ```math block, renders as an image (KaTeX syntax). Inline $…$ does not render, so write inline math as plain text or Unicode.'

const expandedCalls = new Set<string>()

const formulas = atom({ plugin: 'prismantis', key: 'formulas' } as const, {})
const copiedFormula = atom({ plugin: 'prismantis', key: 'copiedFormula' } as const, null)

const tick = async ($: EngineInterface, key: string): Promise<void> => {
  await update($, copiedFormula, () => key)
  $.clock.after(1500, () => {
    void update($, copiedFormula, current => (current === key ? null : current))
  })
}

type Typeset = { tex: string; png: string; width: number; height: number }

const showsImages = async ($: EngineInterface): Promise<boolean> => {
  if (await $.env.get('TMUX')) return false
  const term = await $.env.get('TERM')
  return term === 'xterm-kitty' || term === 'xterm-ghostty' || Boolean(await $.env.get('KITTY_WINDOW_ID')) || (await $.env.get('TERM_PROGRAM')) === 'ghostty'
}

type Latex = { command: string; dir: string }
type LatexSession = { style: Style; color: string; pending: Set<string>; engine?: Promise<Latex | null>; queue: Promise<void>; failures: number }

const formulaKey = (latex: LatexSession, tex: string) => `${latex.color}\0${tex}`

const typeset = async ($: EngineInterface, latex: LatexSession, engine: Latex, texs: string[]): Promise<Formula[]> => {
  const { stdout } = await $.process.run(
    [engine.command, '--output-dir', engine.dir, '--color', latex.color, '--background-color', 'transparent', '--font-size', String(LATEX_FONT_PX), '--dpr', String(LATEX_DPR)],
    { stdin: `${texs.join('\n')}\n`, timeoutMs: 2000 },
  )
  return Promise.all(renderedOf(stdout, texs.length).map(async (isRendered, i): Promise<Formula> => {
    if (!isRendered) return { error: true }
    const png = await $.fs.read(`${engine.dir}/${String(i + 1).padStart(4, '0')}.png`, { as: 'bytes' }).then(r => r.base64, () => '')
    const size = png ? pngSize(png) : null
    return size ? { png, ...size } : { error: true }
  }))
}

const startLatex = async ($: EngineInterface, latex: LatexSession): Promise<Latex | null> => {
  if (latex.style.latex === 'off' || !(await $.session.surfaces()).includes('terminal')) return null
  if (latex.style.latex === 'auto' && !(await showsImages($))) return null
  const tmp = (await $.env.get('TMPDIR')) ?? (await $.env.get('TEMP')) ?? '/tmp'
  const engine = { command: latex.style.latexCommand, dir: `${tmp.replace(/[\\/]+$/, '')}/prismantis-latex-${crypto.randomUUID()}` }
  const [probe] = await typeset($, latex, engine, ['x^2'])
  return probe && 'png' in probe ? engine : null
}

const latexEngine = ($: EngineInterface, latex: LatexSession): Promise<Latex | null> => (latex.engine ??= startLatex($, latex).catch(() => null))

const typesetLater = async ($: EngineInterface, latex: LatexSession, texs: string[]): Promise<void> => {
  const engine = await latexEngine($, latex)
  if (!engine) return
  const results = await typeset($, latex, engine, texs).then(
    done => {
      latex.failures = 0
      return done
    },
    (): Formula[] => {
      if (++latex.failures >= 3) latex.engine = Promise.resolve(null)
      return texs.map(() => ({ error: true }))
    },
  )
  await update($, formulas, store => Object.fromEntries([...Object.entries(store), ...texs.map((tex, i) => [formulaKey(latex, tex), results[i]!] as const)].slice(-200)))
  for (const tex of texs) latex.pending.delete(formulaKey(latex, tex))
}

const mathOfBlocks = async ($: EngineInterface, latex: LatexSession, blocks: ReturnType<typeof parse>): Promise<Map<number, Typeset>> => {
  const maths = [...blocks.entries()].flatMap(([i, block]) => {
    const tex = mathOf(block)
    return tex === null ? [] : [[i, tex] as const]
  })
  if (maths.length === 0 || !(await latexEngine($, latex))) return new Map()
  const store = await read($, formulas)
  const missing = [...new Set(maths.map(([, tex]) => tex))].filter(tex => !store[formulaKey(latex, tex)] && !latex.pending.has(formulaKey(latex, tex)))
  if (missing.length) {
    for (const tex of missing) latex.pending.add(formulaKey(latex, tex))
    $.clock.after(0, () => {
      latex.queue = latex.queue.then(() => typesetLater($, latex, missing))
    })
  }
  return new Map(maths.flatMap(([i, tex]) => {
    const formula = store[formulaKey(latex, tex)]
    return formula && 'png' in formula ? [[i, { tex, ...formula }] as const] : []
  }))
}

const drawMarkdown = ($: EngineInterface, el: ReturnType<EngineInterface['ui']['resolve']>, style: Style, blocks: ReturnType<typeof parse>, columns: number, math: Map<number, Typeset>, scope: string, copied: string | null, reply?: string): RenderElement[] => {
  const { Box, Button, Text } = el
  const copyText = (text: string, surface?: RenderSurface): Promise<boolean> =>
    $.ui.copy({ text, surface }).then(
      r => {
        if (!r.isCopied) void $.ui.toast(`Copy failed: ${r.reason}`)
        return r.isCopied
      },
      () => {
        void $.ui.toast('Copy failed')
        return false
      },
    )
  const copy = (text: string | (() => string), key: string, label = '⧉ copy') =>
    style.copyButtons ? <Button key={key} variant="primary" label={label} onPress={press => void copyText(typeof text === 'function' ? text() : text, press.surface).then(isCopied => {
      if (isCopied) void $.ui.toast('Copied')
    })} /> : null
  const drawn: Drawn = new Map()
  if (style.mermaid) {
    for (const [i, block] of blocks.entries()) {
      if (block.kind !== 'code' || block.lang.toLowerCase() !== 'mermaid') continue
      const art = mermaidText(block.lines.join('\n'), style.mermaidAscii, columns)
      if (art !== null && art.split('\n').every(l => width(l) <= columns - 2)) drawn.set(i, { element: boxArt(el, style, art, `b${i}`), art })
    }
  }
  const Image = 'Image' in el ? el.Image : null
  for (const [i, typeset] of Image ? math : []) {
    const fit = fitFormula(typeset, style, columns)
    const block = blocks[i]
    if (!Image || !fit || block?.kind !== 'code') continue
    drawn.set(i, {
      element: (
        <Box key={`b${i}`} flexDirection="row" columnGap={1}>
          <Image key={`m${i}`} source={{ png: typeset.png }} columns={fit.columns} rows={fit.rows} alt={typeset.tex} />
          <Box key={`slot${i}`} width={1} marginTop={Math.floor((fit.rows - 1) / 2)}>
            {copied === `${scope}/${i}` ? (
              <Text key={`copy${i}`} color={style.theme.number}>✓</Text>
            ) : (
              <Button key={`copy${i}`} plain dimColor label="◰" onPress={press => void copyText(block.lines.join('\n'), press.surface).then(isCopied => {
                if (isCopied) void tick($, `${scope}/${i}`)
              })} />
            )}
          </Box>
        </Box>
      ),
      copies: true,
    })
  }
  const elements = renderBlocks(el, style, blocks, columns, drawn, copy)
  const button = reply === undefined ? null : copy(reply, 'reply', '⧉ copy reply')
  return button ? [...elements, <Box key="reply" alignSelf="flex-end">{button}</Box>] : elements
}

export const register: Register = (on, options) => {
  if (options.enabled === false) return
  const style = resolveStyle(options)
  const parsed = new Map<string, ReturnType<typeof parse>>()
  const parseCached = (text: string) => remember(parsed, text, () => parse(text, { numbers: style.highlightNumbers, paths: style.highlightPaths }))

  const latex: LatexSession = { style, color: style.theme.math ?? style.theme.diagramText ?? style.theme.codeText ?? '#808080', pending: new Set(), queue: Promise.resolve(), failures: 0 }

  if (options.toolRows !== false) {
    on('ui.render', { component: 'ToolGroup' }, ($, e, next) => {
      if (e.props.isExpanded) {
        for (const call of e.props.calls) if (call.tool_use_id) expandedCalls.add(call.tool_use_id)
        return next(e)
      }
      return renderToolGroup($.ui.resolve(e), style, e.props.calls, e.props.isActive)
    })
    on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
      if (!expandedCalls.has(e.props.tool_use_id)) return renderToolRow($.ui.resolve(e), style, e.props)
      return e.props.tool === 'Bash' || e.props.tool === 'PowerShell' ? renderExpandedShell($.ui.resolve(e), style, e.props) : next(e)
    })
  }

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command
      .register({ name: 'prismantis', description: 'Switch the prismantis theme, or list themes', argumentHint: '[theme <name>]' })
      .catch(() => undefined)
    return started
  })

  on('command.run', { command: 'prismantis' }, async ($, e) => {
    const [sub, name] = e.args.trim().split(/\s+/)
    if (sub === 'demo') return { text: showcaseText(PRESET_NAMES) }
    if (sub !== 'theme' || !name) return { text: helpText(PRESET_NAMES) }
    if (!(PRESET_NAMES as readonly string[]).includes(name)) return { text: `Unknown theme "${name}". Themes: ${PRESET_NAMES.join(', ')}` }
    const result = await $.config.set({ key: `${$.plugin.name}.theme`, value: name })
    return { text: result.deny ? `Could not switch theme: ${result.deny}` : `Theme set to ${name}.` }
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e) => renderTurnDuration($.ui.resolve(e), style, e.props.word, e.props.durationMs))

  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    const hints = [...(style.mermaid ? [HINT] : []), ...(style.copyButtons ? [COPY_HINT] : []), ...((await latexEngine($, latex)) ? [LATEX_HINT] : [])]
    return hints.length ? { ...result, additionalContext: [...(result.additionalContext ?? []), ...hints] } : result
  })

  on('ui.render', { component: 'CommandOutput' }, async ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const blocks = parseCached(e.props.text)
    if (blocks.length === 0) return next(e)
    const el = $.ui.resolve(e)
    const { Box } = el
    const columns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    const math = e.surface === 'terminal' ? await mathOfBlocks($, latex, blocks) : new Map<number, Typeset>()
    const copied = math.size ? await read($, copiedFormula) : null
    return (
      <Box flexDirection="column" rowGap={1}>
        {drawMarkdown($, el, style, blocks, columns, math, e.requestId, copied)}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const blocks = parseCached(e.props.text)
    if (blocks.length === 0) return next(e)
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const columns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    const math = e.surface === 'terminal' ? await mathOfBlocks($, latex, blocks) : new Map<number, Typeset>()
    const copied = math.size ? await read($, copiedFormula) : null
    return (
      <Box flexDirection="row" marginTop={1}>
        <Box width={2} flexShrink={0}>
          <Text color={style.theme.accent}>{e.props.isFirstOfReply ? '●' : ' '}</Text>
        </Box>
        <Box flexDirection="column" rowGap={1} flexGrow={1}>
          {drawMarkdown($, el, style, blocks, columns, math, e.requestId, copied, blocks.length > 1 ? e.props.text : undefined)}
        </Box>
      </Box>
    )
  })
}
