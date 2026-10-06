import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { parse } from '../hooks/markdown'

const PNG_60x30 = 'iVBORw0KGgoAAAANSUhEUgAAADwAAAAeCAYAAABwmH1PAAAAHUlEQVR42u3BAQ0AAADCoPdP7ewBFAAAAAAAAMANHD4AAbcl5D8AAAAASUVORK5CYII='
const KITTY = { TERM: 'xterm-kitty', TMPDIR: '/tmp/' }
const REPLY = 'The integral:\n\n$$\n\\int_0^1 x^2\\,dx\n$$\n\nDone.'

type Run = { argv: readonly string[]; formulas: string[] }

const ok = (formulas: string[]) => formulas.map((f, i) => `OK     ${i + 1} ${f}`).join('\n')

const ratex = (on: On, answer: (formulas: string[]) => string = ok) => {
  const runs: Run[] = []
  on('session.surfaces', () => ({ value: ['terminal'] as const }))
  on('process.run', (_, e) => {
    const formulas = (e.init?.stdin ?? '').split('\n').filter(line => line !== '')
    runs.push({ argv: e.argv, formulas })
    return { value: { exitCode: 0, stdout: answer(formulas), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.read', () => ({ value: { base64: PNG_60x30 } }))
  return runs
}

const reply = (text: string, columns = 120) => ({
  plugin: 'prismantis',
  component: 'AssistantMessage' as const,
  props: { text, isFirstOfReply: true },
  viewport: { columns, rows: 40 },
  surface: 'terminal' as const,
})

const parsed = (text: string) => parse(text, { numbers: false, paths: false })

const sizeOf = (image: { props: Record<string, unknown> } | undefined) => ({ columns: Number(image?.props.columns), rows: Number(image?.props.rows) })

test('$$ display math on its own lines parses as a math block', async () => {
  const blocks = parsed('Before\n\n$$\n\\frac{a}{b}\n$$\n\nAfter')

  expect(blocks.map(b => b.kind)).toEqual(['paragraph', 'code', 'paragraph'])
  expect(blocks[1]).toMatchObject({ kind: 'code', lang: 'math', lines: ['\\frac{a}{b}'] })
})

test('$$ math on one line parses as a math block', async () => {
  const [block] = parsed('$$E = mc^2$$')

  expect(block).toMatchObject({ kind: 'code', lang: 'math', lines: ['E = mc^2'] })
})

test('an unclosed $$ stays paragraph text', async () => {
  const blocks = parsed('$$\n\\frac{a}{b}')

  expect(blocks.map(b => b.kind)).toEqual(['paragraph'])
})

test('display math draws as an image that keeps the formula aspect', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  const runs = ratex(on)

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()

  const image = await ui.find({ type: 'Image' })
  expect(image?.props.alt).toBe('\\int_0^1 x^2\\,dx')
  const { columns, rows } = sizeOf(image)
  expect(columns / rows).toBe(4)
  expect(runs.at(-1)?.formulas).toEqual(['\\int_0^1 x^2\\,dx'])
  await ui.unmount()
})

test('a math fence draws as an image too', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)

  const ui = await $.ui.mount(reply('```math\na^2 + b^2 = c^2\n```'))
  await clock.settle()

  expect((await ui.find({ type: 'Image' }))?.props.alt).toBe('a^2 + b^2 = c^2')
  await ui.unmount()
})

test('a formula the renderer rejects falls back to its text', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on, formulas => formulas.map((f, i) => (f === 'x^2' ? `OK     ${i + 1} ${f}` : `ERR    ${i + 1} ${f} — Parse error: Undefined control sequence`)).join('\n'))

  const ui = await $.ui.mount(reply('$$\n\\badcommand{x}\n$$'))
  await clock.settle()

  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^\\badcommand\{x\}$/ })).toBeDefined()
  await ui.unmount()
})

test('without the renderer installed, math stays text and no LaTeX hint is sent', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  on('session.surfaces', () => ({ value: ['terminal'] as const }))
  on('process.run', () => ({ deny: 'spawn ratex-render ENOENT' }))
  on('classic.SessionStart', () => ({}))

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()
  const started = await $.classic.SessionStart({ source: 'startup' })

  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^\\int_0\^1 x\^2\\,dx$/ })).toBeDefined()
  expect((started.additionalContext ?? []).some(c => c.includes('$$'))).toBe(false)
  await ui.unmount()
})

test('the session start hint says display math renders when the renderer works', async ($, on) => {
  mock.env(on, KITTY)
  ratex(on)
  on('classic.SessionStart', () => ({}))

  const started = await $.classic.SessionStart({ source: 'startup' })

  expect(started.additionalContext?.some(c => c.includes('$$') && c.includes('LaTeX'))).toBe(true)
})

test('latex off never runs the renderer', { options: { latex: 'off' } }, async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  const runs = ratex(on)

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()

  expect(runs.length).toBe(0)
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  await ui.unmount()
})

for (const [name, env] of [['a terminal without kitty graphics', { TERM_PROGRAM: 'Apple_Terminal' }], ['tmux', { ...KITTY, TMUX: '/tmp/tmux-501/default,1,0' }]] as const) {
  test(`auto skips the renderer in ${name}`, async ($, on) => {
    mock.env(on, env)
    const clock = mock.clock(on)
    const runs = ratex(on)

    const ui = await $.ui.mount(reply(REPLY))
    await clock.settle()

    expect(runs.length).toBe(0)
    await ui.unmount()
  })
}

test('latex always renders in any terminal', { options: { latex: 'always' } }, async ($, on) => {
  mock.env(on, { TERM_PROGRAM: 'Apple_Terminal' })
  const clock = mock.clock(on)
  ratex(on)

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()

  expect(await ui.find({ type: 'Image' })).toBeDefined()
  await ui.unmount()
})

test('latexCommand and mathColor reach the renderer', { options: { latexCommand: '/opt/ratex/render', mathColor: '#ff0000' } }, async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  const runs = ratex(on)

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()

  expect(runs.length > 0).toBe(true)
  expect(runs.every(r => r.argv[0] === '/opt/ratex/render')).toBe(true)
  expect(runs.at(-1)?.argv.join(' ')).toContain('--color #ff0000')
  await ui.unmount()
})

test('latexScale makes formulas taller and latexCellRatio keeps the aspect', { options: { latexScale: 6, latexCellRatio: 1 } }, async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()

  const { columns, rows } = sizeOf(await ui.find({ type: 'Image' }))
  expect(rows > 1).toBe(true)
  expect(columns / rows).toBe(2)
  await ui.unmount()
})

test('a multi-line formula reaches the renderer as one line without its % comments', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  const runs = ratex(on)

  const ui = await $.ui.mount(reply('$$\na + b % the sum\n= c \\% d\n$$'))
  await clock.settle()

  expect(runs.at(-1)?.formulas).toEqual(['a + b = c \\% d'])
  await ui.unmount()
})

test('a formula renders once however often the reply redraws', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  const runs = ratex(on)

  for (let i = 0; i < 3; i++) {
    const ui = await $.ui.mount(reply(REPLY))
    await clock.settle()
    await ui.unmount()
  }

  expect(runs.filter(r => r.formulas.includes('\\int_0^1 x^2\\,dx')).length).toBe(1)
})

test('an unclosed math fence does not run the renderer while it streams', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  const runs = ratex(on)

  const ui = await $.ui.mount(reply('```math\na^2 + b^2'))
  await clock.settle()

  expect(runs.some(r => r.formulas.includes('a^2 + b^2'))).toBe(false)
  await ui.unmount()
})

test('a formula wider than the terminal shrinks to fit', { options: { latexScale: 10, latexCellRatio: 0.25 } }, async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)

  const ui = await $.ui.mount(reply(REPLY, 20))
  await clock.settle()

  const { columns, rows } = sizeOf(await ui.find({ type: 'Image' }))
  expect(columns <= 18).toBe(true)
  expect(columns / rows).toBe(8)
  await ui.unmount()
})

test('a formula that cannot fit the terminal falls back to its text', { options: { latexCellRatio: 0.1 } }, async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)

  const ui = await $.ui.mount(reply(REPLY, 20))
  await clock.settle()

  expect(await ui.find({ type: 'Image' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^\\int_0\^1 x\^2\\,dx$/ })).toBeDefined()
  await ui.unmount()
})

const icons = <B extends { props: Record<string, unknown> }>(buttons: B[]) => buttons.filter(b => b.props.label === '⧉')

const stubClipboard = (on: On) => {
  const copied: string[] = []
  on('ui.copy', (_, e) => {
    copied.push(e.text)
    return { value: { isCopied: true as const } }
  })
  return copied
}

test('a typeset formula has a copy icon that copies its LaTeX', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)
  const copied = stubClipboard(on)

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()
  const icon = (await ui.findAll({ type: 'Button' })).find(b => b.props.label === '⧉')
  await ui.press({ key: String(icon?.key) })

  expect(copied).toEqual(['\\int_0^1 x^2\\,dx'])
  await ui.unmount()
})

test('with copy buttons on, a typeset formula still has one copy control', { options: { copyButtons: true } }, async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)

  const ui = await $.ui.mount(reply('$$\nE = mc^2\n$$'))
  await clock.settle()

  const labels = (await ui.findAll({ type: 'Button' })).map(b => b.props.label)
  expect(labels).toEqual(['⧉'])
  await ui.unmount()
})

test('pressing the copy icon shows a tick for a moment, then the icon again', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)
  stubClipboard(on)

  const ui = await $.ui.mount(reply(REPLY))
  await clock.settle()
  const [icon] = icons(await ui.findAll({ type: 'Button' }))
  await ui.press({ key: String(icon?.key) })
  await clock.settle()

  expect(await ui.find({ type: 'Text', text: /^✓$/ })).toBeDefined()
  expect(icons(await ui.findAll({ type: 'Button' }))).toHaveLength(0)
  await clock.advance(1500)
  expect(await ui.find({ type: 'Text', text: /^✓$/ })).toBeUndefined()
  expect(icons(await ui.findAll({ type: 'Button' }))).toHaveLength(1)
  await ui.unmount()
})

test('a reply that starts with a formula leaves a blank row above it', async ($, on) => {
  mock.env(on, KITTY)
  const clock = mock.clock(on)
  ratex(on)

  const leading = await $.ui.mount(reply('$$\nE = mc^2\n$$\n\nEnergy.'))
  const trailing = await $.ui.mount(reply('Energy:\n\n$$\nE = mc^2\n$$'))
  await clock.settle()

  expect((await leading.findAll({ type: 'Box' }))[0]?.props.paddingTop).toBe(1)
  expect((await trailing.findAll({ type: 'Box' }))[0]?.props.paddingTop).toBe(0)
  await leading.unmount()
  await trailing.unmount()
})
