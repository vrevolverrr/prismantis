export type Formula = { png: string; width: number; height: number } | { error: true }

declare module 'claude-code' {
  interface PluginState {
    prismantis: { formulas: Record<string, Formula>; copiedFormula: string | null }
  }
}
