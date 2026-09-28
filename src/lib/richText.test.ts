import { describe, expect, it } from 'vitest'
import { ALL_QUESTIONS } from './exam'
import { plainText, splitFences, splitInline } from './richText'

const STEM = 'You see this step in a workflow:\n\n```yaml\n- name: Set color\n  id: color-selector\n```\n\nWhich statement is correct?'

describe('rich text', () => {
  it('splits fenced snippets out with their indentation, dropping the fences and the language tag', () => {
    expect(splitFences(STEM)).toEqual([
      'You see this step in a workflow:',
      '- name: Set color\n  id: color-selector',
      'Which statement is correct?',
    ])
    expect(splitFences('```\n  a\n\n  b\n```')).toEqual(['', '  a\n\n  b', ''])
    expect(splitFences('run ```npm test``` first')).toEqual(['run ', 'npm test', ' first'])
    expect(splitFences('no code here')).toEqual(['no code here'])
    // Each fence closes at its own end, never at the last fence in the text.
    expect(splitFences('before\n```\na\n```\nmid\n```yaml\nb\n```\nafter')).toEqual(['before', 'a', 'mid', 'b', 'after'])
  })

  it('splits inline code out of prose', () => {
    expect(splitInline('Set `tools: [read]` and `name`.')).toEqual(['Set ', 'tools: [read]', ' and ', 'name', '.'])
    expect(splitInline('a lone ` stays')).toEqual(['a lone ` stays'])
  })

  it('reads as plain text without the markup', () => {
    expect(plainText(STEM)).toBe('You see this step in a workflow:\n- name: Set color\n  id: color-selector\nWhich statement is correct?')
    expect(plainText('Use `copilot-setup-steps`.')).toBe('Use copilot-setup-steps.')
  })

  // Every backtick in the bank is markup this parser consumes, so none is ever shown raw.
  it.each(ALL_QUESTIONS.map((q) => [q.id, q] as const))('%s has no markup left over', (_id, q) => {
    const texts = [q.stem, q.explanation, ...(q.options ?? []), ...(q.pairs ?? []).flatMap((p) => [p.left, p.right])]
    for (const text of texts) if (text) expect(plainText(text)).not.toContain('`')
  })
})
