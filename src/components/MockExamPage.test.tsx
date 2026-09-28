import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { AppState } from '../types'
import { ALL_QUESTIONS } from '../lib/exam'
import MockExamPage from './MockExamPage'

afterEach(cleanup)

const EMPTY: AppState = { planChecks: {}, reviewed: {}, questionAttempts: {}, flagged: {}, mockRuns: [] }

function Harness() {
  const [state, setState] = useState<AppState>(EMPTY)
  return <MockExamPage state={state} setState={setState} />
}

// A mock already in progress, as loaded from storage.
function SeededHarness({ questionIds, answers = {} }: { questionIds: string[]; answers?: Record<string, string> }) {
  const [state, setState] = useState<AppState>(() => ({
    ...EMPTY,
    activeMock: { startedAt: Date.now(), questionIds, answers },
  }))
  return <MockExamPage state={state} setState={setState} />
}

const card = () => within(screen.getByRole('article'))
const position = () => card().getByText(/^\d+ \/ \d+$/).textContent
// A match-pairs card's items, each named with its current match.
const matchItems = () => card().queryAllByRole('radio').map((r) => r.getAttribute('aria-label'))
const answerButtons = () => {
  const answers = card().queryByRole('group', { name: /^Answers/ })
  return answers ? within(answers).getAllByRole('button') : []
}

// Gives whatever mock question is on screen an answer, the way a user would.
async function answerCurrent(user: UserEvent) {
  const answers = answerButtons()
  const input = card().queryByRole('textbox')
  const option = card().queryAllByRole('button').find((b) => b.closest('ul'))
  // Each answer goes to the current item, and the target then moves to the next unmatched one.
  if (answers.length) for (const a of answers) await user.click(a)
  else if (input) await user.type(input, 'x')
  else if (option) await user.click(option)
  // ordering questions already hold their displayed order as the answer
}

describe('mock exam', () => {
  it('saving advances to a fresh question, keeps focus, and the saved answer is there on return', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Start the mock now' }))
    expect(position()).toBe('1 / 50')

    await answerCurrent(user)
    // Options the answer selected (choice questions); a match question's answer is its pairs. (A pressed
    // match answer only marks the item being chosen for, which starts again at item 1 on return.)
    const chosenOptions = () =>
      card().queryAllByRole('button', { pressed: true }).filter((b) => b.closest('ul')).map((b) => b.textContent)
    const chosen = chosenOptions()
    const matched = matchItems()
    card().getByRole('button', { name: 'Save and continue' }).focus()
    await user.keyboard('{Enter}')

    expect(position()).toBe('2 / 50')
    expect(screen.getByText(/Answered:/).textContent).toContain('1')
    expect(document.activeElement).toBe(card().getByRole('heading'))
    // The new card must not inherit the previous question's selection.
    expect(card().queryAllByRole('button', { pressed: true }).filter((b) => !/Flag/.test(b.textContent!))).toEqual([])
    expect(matchItems().filter((name) => !name!.endsWith(', not matched yet'))).toEqual([])
    expect(card().queryByText('✓ Saved')).toBeNull()

    await user.click(card().getByRole('button', { name: '◂ Previous' }))
    expect(position()).toBe('1 / 50')
    expect(card().getByText('✓ Saved')).toBeTruthy()
    expect(chosenOptions()).toEqual(chosen)
    expect(matchItems()).toEqual(matched)
    expect(card().queryByText('Explanation')).toBeNull()
  })

  it('skips a case-study parent id left in a mock that was saved before the parents were dropped', async () => {
    const user = userEvent.setup()
    // d4-4.3-59 is the control-less parent that used to show only "Save and continue".
    render(<SeededHarness questionIds={['d1-1.1-1', 'd4-4.3-59', 'd4-4.3-60-sub0']} />)
    expect(position()).toBe('1 / 2')
    await user.click(card().getByRole('button', { name: 'Next ▸' }))
    expect(card().getByRole('heading').textContent).toContain('never runs the test command')
    expect(card().getAllByRole('button').filter((b) => b.closest('ul'))).toHaveLength(4)
  })

  it('keeps a saved match-pairs mapping when you move away and come back', async () => {
    const user = userEvent.setup()
    render(<SeededHarness questionIds={['d1-1.1-7', 'd1-1.1-1']} />)
    await answerCurrent(user)
    const matched = matchItems()
    expect(matched).toHaveLength(4)
    for (const m of matched) expect(m).toContain(', matched with ')
    await user.click(card().getByRole('button', { name: 'Save and continue' }))
    expect(position()).toBe('2 / 2')

    await user.click(card().getByRole('button', { name: '◂ Previous' }))

    expect(matchItems()).toEqual(matched)
    expect(card().getByText('✓ Saved')).toBeTruthy()
    expect(card().queryByText(/Should be:|Matched correctly|Explanation/)).toBeNull()
  })

  it.each([
    ['the true mapping', (n: number) => [...Array(n).keys()], 'Score: 1000 / 1000'],
    ['a swapped mapping', (n: number) => [1, 0, ...[...Array(n).keys()].slice(2)], 'Score: 0 / 1000'],
  ])('scores a match-pairs question from %s', async (_label, mapping, score) => {
    const user = userEvent.setup()
    const q = ALL_QUESTIONS.find((x) => x.id === 'd1-1.1-7')!
    render(<SeededHarness questionIds={[q.id]} />)
    const picks = mapping(q.pairs!.length)
    for (const [i, p] of q.pairs!.entries()) {
      const right = q.pairs![picks[i]].right
      await user.click(card().getByRole('radio', { name: (name) => name.includes(`. ${p.left}, `) }))
      await user.click(card().getByRole('button', { name: (name) => name.split(', matched with')[0] === right }))
    }
    await user.click(card().getByRole('button', { name: 'Save and continue' }))
    await user.click(screen.getByRole('button', { name: 'Submit and see score' }))
    expect(screen.getByText(score)).toBeTruthy()
  })
})

describe('mock exam: order the steps', () => {
  const question = ALL_QUESTIONS.find((q) => q.type === 'drag_drop_order' && q.objectiveId === '2.2')!
  const key = question.correct!.split(' -> ')
  // The steps as displayed, read from each step's position picker.
  const shown = () => card().queryAllByRole('combobox').map((s) => s.getAttribute('aria-label')!.replace(/^Position of /, ''))
  const place = (user: UserEvent, step: string, at: number) =>
    user.selectOptions(card().getByRole('combobox', { name: `Position of ${step}` }), String(at))

  it('keeps a saved order when you move away and come back, without grading it, and it can still be changed', async () => {
    const user = userEvent.setup()
    render(<SeededHarness questionIds={[question.id, 'd1-1.1-1']} />)
    const last = shown().at(-1)!
    await place(user, last, 1)
    const saved = shown()
    expect(saved[0]).toBe(last)
    await user.click(card().getByRole('button', { name: 'Save and continue' }))
    expect(position()).toBe('2 / 2')

    await user.click(card().getByRole('button', { name: '◂ Previous' }))

    expect(shown()).toEqual(saved)
    expect(card().getByText('✓ Saved')).toBeTruthy()
    expect(card().queryByText(/Correct position|Belongs at|Correct order|Explanation|✓ Correct|✕ Incorrect/)).toBeNull()
    await place(user, last, 2)
    expect(shown()[1]).toBe(last)
    expect(card().queryByText('✓ Saved')).toBeNull()
  })

  it('shows the order saved before a reload', () => {
    const saved = [...key].reverse()
    render(<SeededHarness questionIds={[question.id]} answers={{ [question.id]: saved.join(' -> ') }} />)
    expect(shown()).toEqual(saved)
    expect(card().getByText('✓ Saved')).toBeTruthy()
  })

  it.each([
    ['the correct order', (steps: string[]) => steps, 'Score: 1000 / 1000'],
    ['two steps swapped', (steps: string[]) => [steps[1], steps[0], ...steps.slice(2)], 'Score: 0 / 1000'],
  ])('scores %s as saved', async (_label, arrange, score) => {
    const user = userEvent.setup()
    render(<SeededHarness questionIds={[question.id]} />)
    const want = arrange(key)
    for (const [i, step] of want.entries()) await place(user, step, i + 1)
    expect(shown()).toEqual(want)
    await user.click(card().getByRole('button', { name: 'Save and continue' }))
    await user.click(screen.getByRole('button', { name: 'Submit and see score' }))
    expect(screen.getByText(score)).toBeTruthy()
  })
})

describe('mock exam: results', () => {
  it('reveals nothing while the mock runs, then reviews flagged and missed questions once submitted', async () => {
    const user = userEvent.setup()
    render(<SeededHarness questionIds={['d1-1.1-1', 'gpt-1']} />)
    await user.click(card().getByRole('button', { name: '⚐ Flag' }))
    expect(screen.getByRole('button', { name: 'Question 1, flagged' })).toBeTruthy()
    await answerCurrent(user) // option A; the key is B
    await user.click(card().getByRole('button', { name: 'Save and continue' }))
    expect(screen.getByRole('button', { name: 'Question 1, answered, flagged' })).toBeTruthy()
    expect(screen.getByText(/You flagged 1 to revisit\./)).toBeTruthy()
    // Nothing is graded or explained while the mock runs.
    expect(screen.queryByText(/Your answer|Correct answer|Explanation|✓ Correct|✕ Incorrect|Review answers/)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Submit and see score' }))

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Score: 0 / 1000' }))
    const review = within(screen.getByRole('region', { name: 'Review answers' }))
    expect(review.getAllByRole('article')).toHaveLength(2) // both missed; gpt-1 was never answered
    await user.click(review.getByRole('button', { name: 'Flagged (1)' }))
    const flagged = review.getByRole('article', { name: 'Question 1' })
    expect(within(flagged).getByText('⚑ Flagged')).toBeTruthy()
    expect(within(flagged).getByText('✕ Incorrect')).toBeTruthy()
  })
})
