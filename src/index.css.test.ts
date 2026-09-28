import { describe, expect, it } from 'vitest'
import css from './index.css?raw'

// Top-level statements of a stylesheet, with comments stripped.
function topLevel(source: string): string[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      out.push(text.slice(start, i + 1).trim())
      start = i + 1
    } else if (ch === ';' && depth === 0) {
      out.push(text.slice(start, i + 1).trim())
      start = i + 1
    }
  }
  return out.filter(Boolean)
}

describe('index.css', () => {
  it('declares every style rule inside a cascade layer', () => {
    // Tailwind v4 utilities live in @layer utilities. Unlayered rules beat every layer, so an
    // unlayered .btn would silently discard utilities such as text-xs or text-accent on it.
    const unlayered = topLevel(css)
      .filter((s) => !/^@(import|theme|layer|keyframes)\b/.test(s))
      .map((s) => s.slice(0, s.indexOf('{')).trim())
    expect(unlayered).toEqual([])
  })

  it('gives buttons disabled and keyboard-focus styles', () => {
    expect(css).toMatch(/\.btn:disabled\s*\{/)
    expect(css).toMatch(/:focus-visible\s*\{/)
    expect(css).toMatch(/\.btn\[aria-pressed="true"\]\s*\{/)
    expect(css).toMatch(/\.btn\[aria-disabled="true"\]/)
  })
})
