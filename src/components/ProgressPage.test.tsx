import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { AppState } from '../types'
import { ALL_QUESTIONS } from '../lib/exam'
import { plainText } from '../lib/richText'
import ProgressPage from './ProgressPage'

afterEach(cleanup)

// Recent misses previews each question by its stem's first line.
const firstLine = (stem: string) => stem.split('\n')[0]
const withInlineCode = ALL_QUESTIONS.find((q) => /`[^`]+`/.test(firstLine(q.stem)))!
const withSnippet = ALL_QUESTIONS.find((q) => q.id === 'gpt-2')! // a fenced YAML snippet below its first line

function recentMisses(ids: string[]) {
  const state: AppState = {
    planChecks: {},
    reviewed: {},
    flagged: {},
    mockRuns: [],
    questionAttempts: Object.fromEntries(ids.map((id) => [id, [{ id, given: 'x', correct: false, ts: 0 }]])),
  }
  render(<ProgressPage state={state} setState={() => {}} />)
  return screen.getByRole('heading', { name: `Recent misses (${ids.length})` }).closest('section')!
}

describe('progress: recent misses', () => {
  it('shows inline code in a missed question as code, with no backticks', () => {
    const section = recentMisses([withInlineCode.id, withSnippet.id])
    const written = firstLine(withInlineCode.stem).match(/`[^`]+`/g)!.map((s) => s.slice(1, -1))
    expect([...section.querySelectorAll('code')].map((c) => c.textContent)).toEqual(written)
    expect(section.textContent).not.toContain('`')
    // A stem whose snippet sits below its first line previews by that line, with no fence in it.
    expect(within(section).getByText('You see this step in a workflow:')).toBeTruthy()
  })

  it.each(ALL_QUESTIONS.map((q) => [q.id, q] as const))('%s previews without markup left over', (_id, q) => {
    // A fence opening on the first line would be cut in half by the preview and show raw.
    expect(plainText(firstLine(q.stem))).not.toContain('`')
  })
})
