import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { AppState } from '../types'
import PracticePage from './PracticePage'

afterEach(cleanup)

const EMPTY: AppState = { planChecks: {}, reviewed: {}, questionAttempts: {}, flagged: {}, mockRuns: [] }

function Harness() {
  const [state, setState] = useState<AppState>(EMPTY)
  return <PracticePage state={state} setState={setState} />
}

const card = () => screen.getByRole('article')
// The verdict chip ("✓ Correct", "✕ Incorrect · 1 of 3 pairs"), not a per-step "✓ Correct position" mark.
const VERDICT = /^(✓ Correct|✕ Incorrect)( ·|$)/
const stem = () => within(card()).getByRole('heading').textContent

// Answers whatever question type is on screen, the way a user would.
async function answerCurrent(user: UserEvent) {
  const c = within(card())
  // Match pairs: each answer goes to the current item, and the target moves to the next unmatched one.
  const answers = c.queryByRole('group', { name: /^Answers/ })
  if (answers) for (const a of within(answers).getAllByRole('button')) await user.click(a)
  const input = c.queryByRole('textbox')
  if (input) await user.type(input, 'x')
  const options = c.queryAllByRole('button', { pressed: false }).filter((b) => b.closest('ul'))
  if (options.length) await user.click(options[0])
  await user.click(c.getByRole('button', { name: 'Check answer' }))
}

describe('practice session', () => {
  it.each(['Shuffle', 'Unseen'])('keeps the answered question on screen in %s mode', async (mode) => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: mode }))
    const before = stem()

    await answerCurrent(user)

    expect(stem()).toBe(before)
    expect(within(card()).getByText(VERDICT)).toBeTruthy()
  })

  it('keeps the question on screen when it is flagged in Shuffle mode', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Shuffle' }))
    const before = stem()
    await user.click(within(card()).getByRole('button', { name: /Flag/ }))
    expect(stem()).toBe(before)
    expect(within(card()).getByRole('button', { name: /Flagged/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('moves keyboard focus to the next question when Next is pressed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    within(card()).getByRole('button', { name: 'Next ▸' }).focus()
    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(within(card()).getByRole('heading'))
  })

  it('starts a match-pairs question fresh when you come back to it, with the answers in the same order', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const next = () => user.click(within(card()).getByRole('button', { name: 'Next ▸' }))
    const answers = () => within(within(card()).getByRole('group', { name: /^Answers/ })).getAllByRole('button')
    const order = () => answers().map((a) => a.getAttribute('aria-label')!.split(', matched with')[0])
    for (let i = 0; i < 5; i++) await next()
    expect(stem()).toBe('Match each anti-pattern to the GitHub control that mitigates it.')
    const before = order()
    await user.click(answers()[0])

    await next()
    expect(within(card()).queryAllByRole('radio')).toEqual([])
    await user.click(within(card()).getByRole('button', { name: '◂ Previous' }))

    const items = within(card()).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))
    expect(items.every((name) => name!.endsWith(', not matched yet'))).toBe(true)
    expect(order()).toEqual(before)
    expect((within(card()).getByRole('button', { name: 'Check answer' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('every question in the bank can be answered and graded', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const total = Number(screen.getByText(/\d+ \/ \d+/).textContent!.split('/')[1])
    for (let i = 0; i < total; i++) {
      await answerCurrent(user)
      expect(within(card()).getByText(VERDICT)).toBeTruthy()
      if (i < total - 1) await user.click(within(card()).getByRole('button', { name: 'Next ▸' }))
    }
  }, 60_000)
})
