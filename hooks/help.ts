export const showcaseText = (themes: readonly string[]): string => `
# prismantis

Colored markdown for Claude Code replies: **bold**, *italic*, ~~struck~~, \`inline code\`, a [link](https://github.com/NahumLitvin/prismantis), numbers like 99.9% and 250ms, paths like ~/src/app.ts.

## Commands

| Command | Does |
|---------|------|
| \`/prismantis\` | This screen |
| \`/prismantis theme <name>\` | Switch theme on the spot |
| \`/config\` | Edit any option |

> [!NOTE]
> ${themes.length} themes ship with it. \`mono\` uses no color, only bold and dim.

### Pick a theme

\`\`\`bash
/prismantis theme nord
/prismantis theme github-light
\`\`\`

1. Dark: ${themes.filter(t => !/latte|light|dawn/.test(t) && t !== 'mono').join(', ')}
2. Light: ${themes.filter(t => /latte|light|dawn/.test(t)).join(', ')}
3. Plain
   - mono

> [!TIP]
> Any color slot beats the theme. Set \`headingColor\` or \`numberColor\` to a hex value in \`/config\`.

## Everything it draws

### Alerts

> [!IMPORTANT]
> After updating the plugin, open sessions need \`/reload\`.

> [!WARNING]
> Selecting a typeset formula copies blank cells. Its ◰ copies the LaTeX.

> [!CAUTION]
> Claude Code refuses trees over 20000 nodes. A table past about 500 rows falls back to plain text.

### Task lists

- [x] Parse the reply
- [x] Draw it
  - [x] Tables and code
  - [ ] Diagrams on the desktop app
- [ ] Ship the next release

### Quotes and rules

> Quotes get an accent bar.

---

### Code

\`\`\`json
{ "theme": "dracula", "headingStyle": "banner", "mermaid": true }
\`\`\`

#### Math

$$
\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

#### Diagrams

\`\`\`mermaid
flowchart LR
    R[Reply] --> P[Parse]
    P --> D[Draw]
    D --> S[Screen]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    participant U as You
    participant C as Claude
    participant P as prismantis
    U->>C: prompt
    C->>P: markdown
    P-->>U: colored reply
\`\`\`

\`\`\`mermaid
xychart-beta
    title "Color options per group"
    x-axis [text, head, num, code, diag, math]
    y-axis "options" 0 --> 8
    bar [7, 3, 2, 6, 2, 1]
\`\`\`
`

export const helpText = (themes: readonly string[]): string => `
## Commands

| Command | Does |
|---------|------|
| \`/prismantis theme <name>\` | Switch theme on the spot |
| \`/prismantis demo\` | Full showcase, every element and diagram |

### ${themes.length} themes

- Dark: ${themes.filter(t => !/latte|light|dawn/.test(t) && t !== 'mono').join(', ')}
- Light: ${themes.filter(t => /latte|light|dawn/.test(t)).join(', ')}
- Plain: mono, no color, only bold and dim

> [!TIP]
> Any color slot beats the theme. Set \`headingColor\` or \`numberColor\` to a hex value in \`/config\`.

### Task lists

- [x] Tables, diagrams and charts drawn in the terminal
- [x] LaTeX math as images in kitty and Ghostty
- [ ] Pick a \`taskStyle\` in \`/config\`: checks, ticks, box or progress

\`\`\`mermaid
flowchart LR
    R[Reply] --> P[Parse]
    P --> D[Draw]
    D --> S[Screen]
\`\`\`

\`\`\`mermaid
xychart-beta
    title "Color options per group"
    x-axis [text, head, num, code, diag, math]
    y-axis "options" 0 --> 8
    bar [7, 3, 2, 6, 2, 1]
\`\`\`

> [!CAUTION]
> Claude Code refuses trees over 20000 nodes. A table past about 500 rows falls back to plain text.
`
