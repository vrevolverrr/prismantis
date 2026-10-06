<h1 align="center"><img src="docs/brand/banner.png" alt="prismantis" width="640"></h1>

> Sees 16 colors. Your terminal only had 8.

Colorful, themeable replies for [Claude Code](https://claude.com/claude-code): tables, code, diagrams, charts, LaTeX math and tool calls, in 16 themes.

This is a fork of [NahumLitvin/prismantis](https://github.com/NahumLitvin/prismantis). What differs:

- [LaTeX math](#latex-math): `$$` formulas typeset as images in kitty and Ghostty, with a copy icon on each
- the [model note](#diagram-hints) arrives once at session start instead of on every prompt, and has no option
- [copy buttons](#copy-buttons) are off by default; Claude Code's `/copy` covers whole replies
- a `github-dark-minimal` [theme](#themes)
- no right-to-left (Hebrew, Arabic) layout

![prismantis on the default Catppuccin Mocha theme: a boxed title, a section heading, a table, a nested list, a flowchart, a sequence diagram, a bar chart with values and its tallest bar highlighted, a line chart, highlighted TypeScript and shell blocks, a tip alert and copy buttons](docs/screenshot.png)

## Features

| Feature | What you get |
| --- | --- |
| [Themes](#themes) | `/prismantis theme <name>` switches on the spot. 16 MIT palettes (Catppuccin, Dracula, Nord, Tokyo Night, Gruvbox, Rosé Pine, Everforest, GitHub, One Dark, Solarized) plus 21 color slots you can override |
| [Tables](#tables) | colored headers, rules, column alignment, colored numbers, sized to the terminal |
| [Code](#code) | a language header, Prism highlighting in 24 languages, shell lines colored like a prompt |
| [Diagrams and charts](#diagrams-and-charts) | flowcharts, sequence, state, class and ER diagrams, bar and line charts, one color per box, participant and bar |
| [LaTeX math](#latex-math) | `$$` and ` ```math ` formulas typeset as images in kitty and Ghostty by [RaTeX](https://github.com/erweixin/RaTeX), text everywhere else |
| [Layout](#layout) | back-to-back tables and diagrams sit side by side and wrap on narrow terminals |
| [Copy buttons](#copy-buttons) | off by default; on, `[ ⧉ copy ]` on code, tables, lists and quotes, plus `⧉ art` on tables and diagrams for pasting into Slack |
| [Tool rows](#tool-rows) | `Ran gh pr view 12`, `Read ~/src/app.ts`, groups summed up as `Ran 3 commands, read 2 files`, with status dots |
| [Turn footer](#turn-footer) | `✻ Baked for 6m 20s` with the duration in the number color |
| [Slash commands](#slash-commands) | command output (`/cost`, `/context`, plugin commands) gets the same tables and code styling |
| [Diagram hints](#diagram-hints) | a short model-only note at session start so Claude reaches for diagrams and charts when they help |
| [Text](#text) | bold, italic, strikethrough, inline code, links, versions, durations, percentages and paths in their own colors |
| [Headings, lists, quotes](#headings-lists-quotes) | 4 heading styles, nested lists, task lists, quotes with an accent bar |

Try it: ask Claude to print [docs/demo.md](docs/demo.md) verbatim as its whole reply. Every feature is in there.

## Install

Requires Claude Code **2.1.287** or later.

```
/plugin marketplace add vrevolverrr/prismantis
```

```
/plugin install prismantis@prismantis
```

To update, run `claude plugin marketplace update prismantis && claude plugin update prismantis@prismantis`, then `/reload` in every open session. A session keeps the version it loaded until it reloads.

For LaTeX math, also put RaTeX's renderer on your `PATH`; see [LaTeX math](#latex-math). Without it, formulas draw as text.

Tested in the terminal on macOS; CI runs the tests on macOS, Linux and Windows. The desktop app, VS Code and mobile should work through the same mod API but have not been checked by hand yet. Turn it off any time in `/plugin`, and Claude Code's own renderer comes back. Press ctrl+o on a reply to see the original.

It's a [Claude Code mod](https://claude.com/blog/claude-code-mods) in plain TypeScript. It bundles two MIT libraries, [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) for diagrams and [Prism](https://github.com/PrismJS/prism) for highlighting. It makes no network calls. It redraws text already on your screen and, while `mermaid` is on, hands the model a short note when a session starts. The one program it runs is the optional RaTeX renderer, for [LaTeX math](#latex-math), and only where it is installed and the terminal can show images; `latex: off` stops that too.

### Themes

Dark: `catppuccin-mocha` (default), `dracula`, `nord`, `tokyo-night`, `gruvbox-dark`, `rose-pine`, `everforest`, `github-dark`, `github-dark-minimal`, `one-dark`, `solarized-dark`.

Light: `catppuccin-latte`, `gruvbox-light`, `rose-pine-dawn`, `github-light`, `solarized-light`.

`github-dark-minimal` keeps GitHub's dark colors but draws plainly: white headings, green code and bullets, numbers and the reply marker in green, few other colors.

Switch on the spot with `/prismantis theme nord`, or run `/prismantis` for the help screen with every theme. `mono` uses no color, only bold and dim. Every palette is MIT licensed and credited in [THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).

### Tables

Header cells take the `tableHeader` color, and every cell sits in a box with a double line under the header (`tableStyle`: `box`, or `rules`, `grid` and `minimal` for lighter looks), and `:---:`/`---:` alignment is honored. Numbers inside cells are colored like everywhere else. Columns shrink to fit the terminal.

### Code

Code blocks get a header row with the language on the left (and a copy button on the right when `copyButtons` is on), and the code sits indented below with no frame, so selecting it with the mouse copies only the code.

- **Prism** highlights JavaScript, TypeScript, JSX/TSX, Python, Go, Rust, Java, Kotlin, Swift, C, C++, C#, Ruby, JSON, YAML, TOML, SQL, HTML, CSS, Dockerfile, HCL and diff: keywords, strings, numbers, comments, keys, functions and properties each get a theme color.
- **Shell** blocks (`bash`, `sh`, `zsh`, unlabeled) color the command word, `--flags`, quoted strings and `# comments`, and restart after `|`, `&&` and `;`.

### Diagrams and charts

Code blocks tagged `mermaid` draw as colored text art:

- flowcharts (`graph LR`, `graph TD`, decisions), sequence, state, class and ER diagrams
- bar and line charts with `xychart-beta`, sized to the terminal width
- each box and participant gets its own theme color, the same at both ends of a sequence diagram
- each bar gets its own color, gridlines stay dim, axis numbers use the number color

Diagrams too wide for the window, or over 80 lines, stay as code. `mermaidAscii` swaps box-drawing characters for `+ - |`. Pie charts are not supported.

### LaTeX math

Display math, `$$…$$` on lines of its own or a ` ```math ` block, draws as a typeset image in the formula color (`mathColor`, or the theme's text color), with a dim `◰` halfway down beside it that copies the formula's LaTeX, since selecting an image copies blank cells; it turns into a `✓` for a moment once copied. It needs [RaTeX](https://github.com/erweixin/RaTeX)'s PNG renderer, a single binary that typesets KaTeX syntax in a few milliseconds without TeX, a browser or Node:

```bash
gh release download -R erweixin/RaTeX -p 'ratex-cli-*-aarch64-apple-darwin.tar.gz'
tar -xzf ratex-cli-*.tar.gz
install ratex-cli-*/render ~/.local/bin/ratex-render
```

Pick the archive for your platform (`x86_64-apple-darwin`, `x86_64-unknown-linux-musl`, ...). Any directory on your `PATH` works; elsewhere, set `latexCommand` to the binary's path.

With `latex` on `auto` (the default), prismantis runs the renderer once at session start in kitty and Ghostty, outside tmux, and turns LaTeX on only if that test formula comes back. Anywhere else, without the renderer, or with `latex: off`, formulas draw as text in a `math` code block. So does a formula the renderer rejects, or one too wide for the terminal even at one row. `always` skips the terminal check. While LaTeX is on, the session-start note tells Claude that `$$` math renders. `latexScale` sets the size (2 doubles it) and `latexCellRatio` your font's cell width over height, so formulas keep their shape. Inline `$…$` stays text.

### Layout

When tables and diagrams follow each other, they share a row and wrap to the next line once the terminal runs out of width. A wide terminal shows a table, a flowchart and two charts side by side.

### Copy buttons

Off by default; `copyButtons: true` turns them on. Without them, selecting with the mouse copies what is on screen, and Claude Code's `/copy` copies a whole reply as Claude wrote it, tables as markdown and LaTeX as written (`/copy 2` for the one before; "Skip the /copy picker" in `/config` stops it asking about code blocks). Claude Code copies a selection itself, so a mod cannot change what it takes.

When on, `[ ⧉ copy ]`, drawn in Claude Code's accent color, sits on code blocks, tables, lists and quotes and puts the raw markdown on your clipboard. Quotes copy without their `> ` markers, ready to paste as a message. Diagrams get two: `⧉ source` copies the mermaid code and `⧉ art` copies the drawn art, ready to paste into a chat code block. Tables get `⧉ art` too: a plain boxed table that reads right in Slack, where pasted markdown does not. Replies end with `⧉ copy reply`, which copies the reply as Claude wrote it (a single-block reply, like one line of narration, gets none). Press `ctrl+x` then `tab` to move focus onto the buttons and Enter to copy; that works in every terminal. Clicking works where the terminal passes clicks through (fullscreen mode does); terminals with copy-on-select, such as Warp, may grab the word "copy" instead.

### Tool rows

Each tool call draws as one line: a bold verb and its target, `Ran` with a colored shell command, `Read` and `Edited` with the path. The dot is green when done, hollow while running and red on failure. Output still draws below. Collapsed groups draw one line too, `Ran 3 commands, read 2 files · last: npm test`, with a red count when any call failed. Expand a group (ctrl+o or `--verbose`) and its calls draw with Claude Code's own rows, inline output included.

### Turn footer

The line that closes a turn keeps Claude Code's word and colors the duration: `✻ Baked for 6m 20s`. Terminal only, since that's the only surface that draws it.

### Slash commands

Output from slash commands, built-in or from other plugins, is parsed as markdown and drawn like a reply, copy buttons too when they are on. Errors keep Claude Code's own red line.

### Diagram hints

Claude rarely writes a chart unless it knows the terminal can draw one. While `mermaid` is on, prismantis hands the model a short note when a session starts, and again after `/clear`, a resume or a compaction, never shown, saying markdown tables and mermaid diagrams (including `xychart-beta` charts) render here, and to prefer them over prose, bullet lists or ASCII art for comparisons, flows and numbers. With `copyButtons` on, it also asks for commands in fenced blocks, since only those get a copy button. It costs well under 100 tokens, once, not on every prompt. Claude Code doesn't let installed plugins edit the system prompt (its built-in `sec-default` policy keeps that for the organization), so the note arrives as `SessionStart` hook context instead.

### Text

**Bold**, *italic*, ~~strikethrough~~, `inline code`, links (with their URL dimmed beside them) and bare URLs. Numbers, versions (`v2.14.0`), durations (`250ms`, `3h`), sizes (`16Gi`) and percentages (`99.9%`) take the number color, and paths like `~/src/app.ts` the path color.

### Headings, lists, quotes

`headingStyle` picks `banner` (the default: a box around H1, a heavy rule under H2), `bold`, `underline` or `uppercase`. Terminals have one font size, so headings stand out through style and color. Lists keep their numbers and nest with `•` and `◦`. Quotes get an accent bar, and GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) draw as colored boxes. Single-series bar charts print each value above its bar and color the tallest one.

Task lists draw as `[ ]` and `[✓]`, with done items dimmed and struck through. `taskStyle` switches to `ticks` (`○` `✓`), `box` (`□` `✓`) or `progress`, which adds a done-count bar above each list.

![A task list with done items struck through](docs/task-lists.png)

## Configure

Open `/config` and look for the **prismantis** rows, or set values in `~/.claude/settings.json`:

```json
{
  "pluginConfigs": {
    "prismantis": {
      "theme": "tokyo-night",
      "tableStyle": "grid",
      "headingStyle": "banner",
      "tableHeaderColor": "#ffcc00",
      "numberColor": "cyan"
    }
  }
}
```

| Option | Values | Default |
| --- | --- | --- |
| `enabled` | `true`, `false` | `true` |
| `theme` | see [Themes](#themes) | `catppuccin-mocha` |
| `tableStyle` | `box`, `rules`, `grid`, `minimal` | `box` |
| `taskStyle` | `checks` (`[ ]` `[✓]`, done struck through), `ticks` (`○` `✓`), `box` (`□` `✓`), `progress` (ticks with a done-count bar) | `checks` |
| `headingStyle` | `banner`, `bold`, `underline`, `uppercase` | `banner` |
| `highlightNumbers` | `true`, `false` | `true` |
| `highlightPaths` | `true`, `false` | `true` |
| `toolRows` | `true`, `false` | `true` |
| `copyButtons` | `true`, `false` | `false` |
| `mermaid` | `true`, `false` | `true` |
| `mermaidAscii` | `true`, `false` | `false` |
| `latex` | `auto`, `always`, `off` | `auto` |
| `latexCommand` | a binary on your `PATH` or a full path | `ratex-render` |
| `latexScale` | `0.25` to `10` | `1` |
| `latexCellRatio` | `0.1` to `2` | `0.5` |
| `<token>Color` | any color, see below | theme |

A color is hex (`#a6e3a1`, `#fc0`), `rgb(166,227,161)`, `ansi256(114)` or a name (`green`, `cyanBright`). Values that don't parse are ignored. Every token has a `<token>Color` option and a row in `/config`:

| Token | Colors |
| --- | --- |
| `accent` | reply bullet, H3+ headings, quote bar, running tool dots |
| `heading` | H1 and H2 |
| `strong` | **bold** text |
| `emphasis` | *italic* text, variables, attribute names |
| `inlineCode` | `inline code` |
| `codeText` | code block text |
| `codeCommand` | shell commands, functions, class names, keys |
| `codeFlag` | `--flags`, keywords, failures |
| `codeString` | strings |
| `codeComment` | comments, the code block's language label |
| `link` | links, URLs, properties, tags |
| `path` | file paths, regexes |
| `number` | numbers, versions, durations, done dots |
| `quote` | quote text |
| `rule` | rules, chart gridlines |
| `tableHeader` | table header cells |
| `tableRule` | table rules |
| `bullet` | list bullets and numbers |
| `diagram` | diagram lines |
| `diagramText` | diagram labels |
| `math` | typeset LaTeX formulas |

## Limits

- The parser covers what Claude writes (headings, lists, tables, fences, quotes, emphasis, links). It's not full CommonMark: nested quotes and HTML draw as plain text.
- Widths count CJK and emoji as two columns. Terminals disagree on a few emoji, so those can still be off by one.
- Languages outside the 24 above draw in `codeText`.

## Roadmap

Upstream's planned features are on its [roadmap board](https://github.com/users/NahumLitvin/projects/2). This fork's own changes are in the [CHANGELOG](docs/CHANGELOG.md).

## Develop

```
git clone https://github.com/vrevolverrr/prismantis
claude --plugin-dir ./prismantis
```

Edits hot-reload in that session. Before a PR run `claude plugin validate .` and `claude plugin test .`, and print [docs/demo.md](docs/demo.md) to check the look. `npm --prefix scripts run bench` times a full render of the demo reply, so speed claims can be checked on any machine. CI also type-checks, rebuilds the vendored bundles byte for byte and installs from a clean config. See [CONTRIBUTING.md](.github/CONTRIBUTING.md).

## Author

Built by [Nahum Litvin](https://github.com/NahumLitvin), who writes about running untrusted code in production at [catchkill9.dev](https://www.catchkill9.dev/). This fork is maintained by [vrevolverrr](https://github.com/vrevolverrr).

## License

[MIT](LICENSE). Bundled third-party code is listed in [THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md).
