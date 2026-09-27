import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FlatQuestion } from '../types'
import QuestionCard from './QuestionCard'

afterEach(cleanup)

const base = {
  id: 'q1',
  domain: '1.1',
  domainId: 1,
  domainTitle: 'Domain',
  objectiveId: '1.1',
  objectiveTitle: 'Objective',
  explanation: 'Because reasons.',
}

const choice: FlatQuestion = {
  ...base,
  type: 'multiple_choice',
  stem: 'Pick one',
  options: ['A. alpha', 'B. beta'],
  correct: 'B',
}

const pairs: FlatQuestion = {
  ...base,
  type: 'match_pairs',
  stem: 'Match the CLI control to its purpose.',
  pairs: [
    { left: 'Shift+Tab', right: 'Toggle autopilot' },
    { left: '/yolo', right: 'Permit everything' },
    { left: 'Cancel', right: 'Reject the operation' },
  ],
  correct: 'see pairs',
}
const RIGHT_MATCH = { 'Shift+Tab': 'Toggle autopilot', '/yolo': 'Permit everything', Cancel: 'Reject the operation' }

const blank: FlatQuestion = { ...base, type: 'fill_blank', stem: 'Fill it', correct: 'answer' }

const order: FlatQuestion = {
  ...base,
  type: 'drag_drop_order',
  stem: 'Order it',
  options: ['one', 'two', 'three'],
  correct: 'one -> two -> three',
}

const MCP_STEPS = [
  'Open organization Settings',
  'Navigate to Copilot > Policies',
  'Enable MCP servers',
  'Enter the registry base URL',
  'Choose the allow list policy',
]
const steps: FlatQuestion = {
  ...base,
  type: 'drag_drop_order',
  stem: 'Configure an MCP registry',
  options: MCP_STEPS,
  correct: MCP_STEPS.join(' -> '),
}

const btn = (name: string | RegExp) => screen.getByRole('button', { name })
const pressed = (name: string | RegExp) => btn(name).getAttribute('aria-pressed')

// Match pairs: items are radios (which item the next answer goes to), answers are buttons.
const item = (left: string) => screen.getByRole('radio', { name: (name) => name.includes(`. ${left}, `) }) as HTMLInputElement
const itemName = (left: string) => item(left).getAttribute('aria-label')
const itemCard = (left: string) => within(item(left).closest('label')!)
const answer = (right: string) =>
  screen.getByRole('button', { name: (name) => name === right || name.startsWith(`${right}, matched with`) })
const answerOrder = () =>
  within(screen.getByRole('group', { name: /^Answers/ }))
    .getAllByRole('button')
    .map((b) => b.getAttribute('aria-label')!.split(', matched with')[0])
const announced = () => screen.getByRole('status').textContent

async function match(user: ReturnType<typeof userEvent.setup>, mapping: Record<string, string>) {
  for (const [left, right] of Object.entries(mapping)) {
    await user.click(item(left))
    await user.click(answer(right))
  }
}

function study(question: FlatQuestion, props: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onAnswer = vi.fn()
  const onNext = vi.fn()
  render(
    <QuestionCard question={question} index={0} total={3} mode="study" onAnswer={onAnswer} onNext={onNext} {...props} />,
  )
  return { onAnswer, onNext }
}

// Mirrors MockExamPage: the saved answer is fed back in as initialAnswer.
function MockHarness({ question, onAnswer, onNext }: { question: FlatQuestion; onAnswer: () => void; onNext: () => void }) {
  const [saved, setSaved] = useState<string>()
  return (
    <QuestionCard
      question={question}
      index={0}
      total={3}
      mode="mock"
      initialAnswer={saved}
      onAnswer={(_qid, given) => {
        setSaved(given)
        onAnswer()
      }}
      onNext={onNext}
    />
  )
}

describe('match pairs in practice', () => {
  it('shows every item and every answer at once, with nothing matched yet', () => {
    study(pairs)
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      '1. Shift+Tab, not matched yet',
      '2. /yolo, not matched yet',
      '3. Cancel, not matched yet',
    ])
    expect(item('Shift+Tab').checked).toBe(true)
    expect(itemCard('Shift+Tab').getByText('▸ Choosing')).toBeTruthy()
    expect(answerOrder().sort()).toEqual(Object.values(RIGHT_MATCH).sort())
    for (const right of Object.values(RIGHT_MATCH)) expect(answer(right).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Reveal answers' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'I got it' })).toBeNull()
    expect((btn('Check answer') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('0 of 3 matched')).toBeTruthy()
  })

  it('pairs an answer with the chosen item, shows the pair on both sides, and moves on', async () => {
    const user = userEvent.setup()
    study(pairs)
    await user.click(answer('Toggle autopilot'))

    expect(itemName('Shift+Tab')).toBe('1. Shift+Tab, matched with Toggle autopilot')
    expect(itemCard('Shift+Tab').getByText('→ Toggle autopilot')).toBeTruthy()
    expect(answer('Toggle autopilot').getAttribute('aria-label')).toBe('Toggle autopilot, matched with item 1')
    expect(within(answer('Toggle autopilot')).getByText('1')).toBeTruthy()
    expect(item('/yolo').checked).toBe(true)
    expect(announced()).toBe('Matched 1. Shift+Tab with Toggle autopilot. Now choosing for 2. /yolo.')
    expect(screen.getByText('1 of 3 matched')).toBeTruthy()
  })

  it('choosing another item makes it the target and shows its answer as selected', async () => {
    const user = userEvent.setup()
    study(pairs)
    await match(user, { 'Shift+Tab': 'Toggle autopilot' })
    expect(answer('Toggle autopilot').getAttribute('aria-pressed')).toBe('false')

    await user.click(item('Shift+Tab'))

    expect(answer('Toggle autopilot').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('group', { name: 'Answers, choosing for 1. Shift+Tab' })).toBeTruthy()
    // The radio announces the new target itself; an old pairing message must not linger.
    expect(announced()).toBe('')
  })

  it('changes an item to an unused answer and frees its old one', async () => {
    const user = userEvent.setup()
    study(pairs)
    await match(user, { 'Shift+Tab': 'Toggle autopilot' })
    await user.click(item('Shift+Tab'))
    await user.click(answer('Reject the operation'))

    expect(itemName('Shift+Tab')).toBe('1. Shift+Tab, matched with Reject the operation')
    expect(answer('Toggle autopilot').getAttribute('aria-label')).toBe('Toggle autopilot')
    expect(announced()).toBe(
      'Matched 1. Shift+Tab with Reject the operation. Toggle autopilot is free again. Now choosing for 2. /yolo.',
    )
  })

  it('moves on to the next unmatched item, wrapping round to the top', async () => {
    const user = userEvent.setup()
    study(pairs)
    await user.click(item('/yolo'))
    await user.click(answer('Permit everything'))
    expect(item('Cancel').checked).toBe(true)
    await user.click(answer('Reject the operation'))
    expect(item('Shift+Tab').checked).toBe(true)
    expect(announced()).toMatch(/ Now choosing for 1\. Shift\+Tab\.$/)
  })

  it('pairs once on a double-click or a held Enter, instead of moving the answer on', async () => {
    const user = userEvent.setup()
    study(pairs)
    await user.dblClick(answer('Toggle autopilot'))
    expect(itemName('Shift+Tab')).toBe('1. Shift+Tab, matched with Toggle autopilot')
    expect(itemName('/yolo')).toBe('2. /yolo, not matched yet')

    answer('Permit everything').focus()
    await user.keyboard('{Enter>3/}')
    expect(itemName('/yolo')).toBe('2. /yolo, matched with Permit everything')
    expect(itemName('Cancel')).toBe('3. Cancel, not matched yet')
  })

  it('moves an answer used by another item, which becomes unmatched and the next target', async () => {
    const user = userEvent.setup()
    study(pairs)
    await match(user, RIGHT_MATCH)
    expect((btn('Check answer') as HTMLButtonElement).disabled).toBe(false)

    await user.click(item('Shift+Tab'))
    await user.click(answer('Permit everything'))

    expect(itemName('Shift+Tab')).toBe('1. Shift+Tab, matched with Permit everything')
    expect(itemName('/yolo')).toBe('2. /yolo, not matched yet')
    expect(item('/yolo').checked).toBe(true)
    expect(answer('Toggle autopilot').getAttribute('aria-label')).toBe('Toggle autopilot')
    expect(announced()).toBe(
      'Moved Permit everything from item 2 to 1. Shift+Tab. Item 2 is now unmatched. Toggle autopilot is free again. Now choosing for 2. /yolo.',
    )
    expect((btn('Check answer') as HTMLButtonElement).disabled).toBe(true)
  })

  it("removes a pair when the item's own answer is chosen again", async () => {
    const user = userEvent.setup()
    study(pairs)
    await match(user, { 'Shift+Tab': 'Toggle autopilot' })
    await user.click(item('Shift+Tab'))
    await user.click(answer('Toggle autopilot'))

    expect(itemName('Shift+Tab')).toBe('1. Shift+Tab, not matched yet')
    expect(answer('Toggle autopilot').getAttribute('aria-pressed')).toBe('false')
    expect(item('Shift+Tab').checked).toBe(true)
    expect(announced()).toBe('Removed the match for 1. Shift+Tab.')
    expect(screen.getByText('0 of 3 matched')).toBeTruthy()
  })

  it('records a correct mapping once as correct and locks it', async () => {
    const user = userEvent.setup()
    const { onAnswer } = study(pairs)
    await match(user, RIGHT_MATCH)
    await user.click(btn('Check answer'))

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('q1', '0,1,2', true)
    expect(screen.getByText('✓ Correct · 3 of 3 pairs')).toBeTruthy()
    expect(screen.getByText('Because reasons.')).toBeTruthy()
    for (const left of Object.keys(RIGHT_MATCH)) {
      expect(item(left).disabled).toBe(true)
      expect(itemCard(left).getByText('✓ Matched correctly')).toBeTruthy()
    }
    // Each item now shows its match and the result, so the answer list has nothing left to add.
    expect(screen.queryByRole('group', { name: /^Answers/ })).toBeNull()
    expect(screen.queryByText('▸ Choosing')).toBeNull()
    // Checking is the only way to see the answers, and it cannot record a second attempt.
    expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull()
  })

  it('records a wrong mapping as incorrect and shows the right match for each miss', async () => {
    const user = userEvent.setup()
    const { onAnswer } = study(pairs)
    await match(user, { 'Shift+Tab': 'Permit everything', '/yolo': 'Toggle autopilot', Cancel: 'Reject the operation' })
    await user.click(btn('Check answer'))

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('q1', '1,0,2', false)
    expect(screen.getByText('✕ Incorrect · 1 of 3 pairs')).toBeTruthy()
    expect(itemCard('Shift+Tab').getByText(/Should be:/).textContent).toBe('✕ Should be: Toggle autopilot')
    expect(itemName('Shift+Tab')).toBe('1. Shift+Tab, matched with Permit everything, incorrect, should be Toggle autopilot')
    expect(itemCard('Cancel').getByText('✓ Matched correctly')).toBeTruthy()
    expect(itemName('Cancel')).toBe('3. Cancel, matched with Reject the operation, correct')
    expect(itemCard('Cancel').queryByText(/Should be:/)).toBeNull()
  })

  it('is operable from the keyboard', async () => {
    const user = userEvent.setup()
    const { onAnswer } = study(pairs)
    await user.tab()
    expect(document.activeElement).toBe(item('Shift+Tab'))
    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(item('/yolo'))
    expect(item('/yolo').checked).toBe(true)
    await user.keyboard('{ArrowUp}')
    expect(item('Shift+Tab').checked).toBe(true)

    // Each press pairs with the current item and keeps focus on the pressed answer.
    const answers = within(screen.getByRole('group', { name: /^Answers/ })).getAllByRole('button')
    for (const a of answers) {
      await user.tab()
      expect(document.activeElement).toBe(a)
      await user.keyboard(' ')
      expect(document.activeElement).toBe(a)
    }
    expect(screen.getByText('3 of 3 matched')).toBeTruthy()

    await user.tab()
    expect(document.activeElement).toBe(btn('Check answer'))
    await user.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(screen.getByText(/^(✓ Correct|✕ Incorrect)/))
  })

  it('keeps each question’s answer order across updates and visits, never in key order', async () => {
    const user = userEvent.setup()
    const fresh = { ...pairs, id: 'q-order' }
    // With random() pinned high the shuffle is the identity, which would put item n's match at position n.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    let first: string[]
    try {
      study(fresh)
      first = answerOrder()
      expect(first).not.toEqual(Object.values(RIGHT_MATCH))
    } finally {
      random.mockRestore()
    }
    await match(user, { 'Shift+Tab': 'Reject the operation', '/yolo': 'Toggle autopilot' })
    expect(answerOrder()).toEqual(first)

    cleanup()
    study(fresh)
    expect(answerOrder()).toEqual(first)
  })
})

describe('match pairs in mock mode', () => {
  it('saves the mapping without revealing anything, and advances', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const onNext = vi.fn()
    render(<MockHarness question={pairs} onAnswer={onAnswer} onNext={onNext} />)

    await match(user, { 'Shift+Tab': 'Permit everything', '/yolo': 'Toggle autopilot' })
    expect((btn('Save and continue') as HTMLButtonElement).disabled).toBe(true)
    await match(user, { Cancel: 'Reject the operation' })
    await user.click(btn('Save and continue'))

    expect(onAnswer).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
    expect(screen.getByText('✓ Saved')).toBeTruthy()
    expect((answer('Permit everything') as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByText(/Should be:|Matched correctly|Because reasons/)).toBeNull()
  })

  it('restores a saved mapping when revisited, stays editable, and drops the saved mark once changed', async () => {
    const user = userEvent.setup()
    render(<QuestionCard question={pairs} index={0} total={3} mode="mock" initialAnswer="1,0,2" />)
    expect(itemName('Shift+Tab')).toBe('1. Shift+Tab, matched with Permit everything')
    expect(itemName('/yolo')).toBe('2. /yolo, matched with Toggle autopilot')
    expect(itemName('Cancel')).toBe('3. Cancel, matched with Reject the operation')
    expect(screen.getByText('✓ Saved')).toBeTruthy()

    await user.click(item('Cancel'))
    await user.click(answer('Reject the operation'))
    expect(screen.queryByText('✓ Saved')).toBeNull()
    expect((btn('Save and continue') as HTMLButtonElement).disabled).toBe(true)

    await user.click(answer('Reject the operation'))
    expect(itemName('Cancel')).toBe('3. Cancel, matched with Reject the operation')
    expect(screen.getByText('✓ Saved')).toBeTruthy()
  })

  it.each([
    ['a self-grade saved by the old version', 'self-correct'],
    ['a mapping saved when the question had more pairs', '0,1,2,3'],
  ])('treats %s as unanswered', (_label, initialAnswer) => {
    render(<QuestionCard question={pairs} index={0} total={3} mode="mock" initialAnswer={initialAnswer} />)
    for (const left of Object.keys(RIGHT_MATCH)) expect(itemName(left)).toMatch(/, not matched yet$/)
    expect(screen.queryByText('✓ Saved')).toBeNull()
    expect((btn('Save and continue') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('mock mode', () => {
  it('saving keeps the choice selected, never shows the solution, and advances', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()
    const onNext = vi.fn()
    render(<MockHarness question={choice} onAnswer={onAnswer} onNext={onNext} />)

    await user.click(btn(/beta/))
    await user.click(btn('Save and continue'))

    expect(onAnswer).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
    expect(pressed(/beta/)).toBe('true')
    expect(screen.getByText('✓ Saved')).toBeTruthy()
    expect(screen.queryByText('Because reasons.')).toBeNull()
    expect(screen.queryByText(/Correct/)).toBeNull()
  })

  it('drops the saved mark once the answer is changed', async () => {
    const user = userEvent.setup()
    render(<QuestionCard question={choice} index={0} total={3} mode="mock" initialAnswer="A" />)
    expect(screen.getByText('✓ Saved')).toBeTruthy()
    await user.click(btn(/beta/))
    expect(screen.queryByText('✓ Saved')).toBeNull()
  })

  it('shows a previously saved answer as selected when revisiting', () => {
    render(<QuestionCard question={choice} index={0} total={3} mode="mock" initialAnswer="A" />)
    expect(pressed(/alpha/)).toBe('true')
    expect(pressed(/beta/)).toBe('false')
  })
})

describe('choice questions', () => {
  it('reflects the selection and locks the options after checking', async () => {
    const user = userEvent.setup()
    study(choice)
    await user.click(btn(/alpha/))
    expect(pressed(/alpha/)).toBe('true')
    await user.click(btn(/beta/))
    expect(pressed(/beta/)).toBe('true')
    expect(pressed(/alpha/)).toBe('false')

    await user.click(btn('Check answer'))
    expect((btn(/alpha/) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('✓ Correct')).toBeTruthy()
  })

  it('moves keyboard focus to the verdict when Check answer goes away', async () => {
    const user = userEvent.setup()
    study(choice)
    await user.click(btn(/beta/))
    btn('Check answer').focus()
    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(screen.getByText('✓ Correct'))
  })
})

describe('multi-select questions', () => {
  it('toggles each option independently and grades the whole set', async () => {
    const user = userEvent.setup()
    const multi: FlatQuestion = { ...choice, type: 'multi_select', options: ['A. alpha', 'B. beta', 'C. gamma'], correct: 'A,C' }
    const { onAnswer } = study(multi)
    await user.click(btn(/alpha/))
    await user.click(btn(/beta/))
    await user.click(btn(/gamma/))
    await user.click(btn(/beta/))
    expect([pressed(/alpha/), pressed(/beta/), pressed(/gamma/)]).toEqual(['true', 'false', 'true'])
    await user.click(btn('Check answer'))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('q1', 'A,C', true)
  })
})

describe('fill in the blank', () => {
  it('cannot be edited after checking, so the verdict matches what was recorded', async () => {
    const user = userEvent.setup()
    const { onAnswer } = study(blank)
    await user.type(screen.getByRole('textbox'), 'wrong')
    await user.click(btn('Check answer'))
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('q1', 'wrong', false)
    expect((screen.getByRole('textbox') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('✕ Incorrect')).toBeTruthy()
  })
})

describe('order the steps', () => {
  const [open, navigate, enable, url, policy] = MCP_STEPS
  // Each step has a native position picker named after it; the pickers run in displayed order.
  const position = (step: string) => screen.getByRole('combobox', { name: `Position of ${step}` }) as HTMLSelectElement
  const pickers = () => screen.getAllByRole('combobox') as HTMLSelectElement[]
  const shown = () => pickers().map((s) => s.getAttribute('aria-label')!.replace(/^Position of /, ''))
  const numbers = () => pickers().map((s) => s.value)
  const row = (step: string) => position(step).closest('li')!
  const handle = (step: string) => row(step).querySelector('[data-handle]')!
  const seeded = (shownOrder: string[]) => study(steps, { initialAnswer: shownOrder.join(' -> ') })

  // jsdom has no layout: give each row its place in the list (62px tall, 8px apart) and the box it is
  // drawn in on screen, which starts 100px down the window.
  const drawAt = (step: string, top: number) => {
    const box = { x: 0, y: top, left: 0, top, width: 600, height: 62, right: 600, bottom: top + 62 }
    vi.spyOn(row(step), 'getBoundingClientRect').mockReturnValue({ ...box, toJSON: () => box })
  }
  const layOut = () =>
    shown().forEach((step, i) => {
      Object.defineProperty(row(step), 'offsetTop', { configurable: true, value: i * 70 })
      Object.defineProperty(row(step), 'offsetHeight', { configurable: true, value: 62 })
      drawAt(step, 100 + i * 70)
    })
  const middle = (i: number) => 100 + i * 70 + 31
  const press = (target: Element, clientY: number, pointerType = 'mouse', more: PointerEventInit = {}) =>
    fireEvent.pointerDown(target, { pointerId: 1, pointerType, isPrimary: true, button: 0, buttons: 1, clientY, ...more })
  // Moves with the button (or finger) still down.
  const drag = (clientY: number) => fireEvent.pointerMove(window, { pointerId: 1, isPrimary: true, buttons: 1, clientY })
  const drop = (clientY: number) => fireEvent.pointerUp(window, { pointerId: 1, isPrimary: true, clientY })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('can be checked as displayed: the shown order is the answer', async () => {
    const user = userEvent.setup()
    const { onAnswer } = seeded([url, open, navigate, enable, policy])
    expect(shown()).toEqual([url, open, navigate, enable, policy])
    expect(numbers()).toEqual(['1', '2', '3', '4', '5'])
    await user.click(btn('Check answer'))
    expect(onAnswer).toHaveBeenCalledWith('q1', `${url} -> ${open} -> ${navigate} -> ${enable} -> ${policy}`, false)
  })

  it('never starts in the solved order', () => {
    for (let i = 0; i < 10; i++) {
      study(order)
      expect(shown()).not.toEqual(['one', 'two', 'three'])
      cleanup()
    }
  })

  it('moves the last step to the top in one choice, and that order is what gets checked', async () => {
    const user = userEvent.setup()
    const { onAnswer } = seeded([navigate, enable, url, policy, open])
    await user.selectOptions(position(open), '1')
    expect(shown()).toEqual([open, navigate, enable, url, policy])
    expect(numbers()).toEqual(['1', '2', '3', '4', '5'])
    await user.click(btn('Check answer'))
    expect(onAnswer).toHaveBeenCalledWith('q1', steps.correct, true)
  })

  it('inserts a step at its new position instead of swapping it', async () => {
    const user = userEvent.setup()
    seeded([open, navigate, enable, url, policy])
    await user.selectOptions(position(open), '3')
    expect(shown()).toEqual([navigate, enable, open, url, policy])
  })

  it('announces a move with the step, where it was, where it is now, and how many steps there are', async () => {
    const user = userEvent.setup()
    seeded([url, navigate, enable, open, policy])
    await user.selectOptions(position(open), '2')
    expect(announced()).toBe('Open organization Settings moved from position 4 to position 2 of 5.')
  })

  it('keeps keyboard focus on a moved step', async () => {
    const user = userEvent.setup()
    seeded([navigate, enable, url, policy, open])
    position(navigate).focus()
    await user.selectOptions(position(navigate), '4')
    expect(shown()[3]).toBe(navigate)
    expect(document.activeElement).toBe(position(navigate))
  })

  it('drags a step straight to a new place with the mouse', () => {
    seeded([url, navigate, enable, open, policy])
    layOut()
    press(row(open), middle(3))
    drag(middle(0) - 5)
    drop(middle(0) - 5)
    expect(shown()).toEqual([open, url, navigate, enable, policy])
    expect(announced()).toBe('Open organization Settings moved from position 4 to position 1 of 5.')
  })

  it('numbers the steps as they would land while one is being dragged', () => {
    seeded([url, navigate, enable, open, policy])
    layOut()
    press(row(open), middle(3))
    drag(middle(1) - 5)
    // Nothing moves in the list until the drop, but every number already shows where its step will be.
    expect(shown()).toEqual([url, navigate, enable, open, policy])
    expect(numbers()).toEqual(['1', '3', '4', '2', '5'])
    expect(within(row(open)).getByText('Moving')).toBeTruthy()
  })

  it('lands a drag where the pointer is, even while the rows are still sliding from the last move', () => {
    seeded([url, navigate, enable, open, policy])
    layOut()
    // Mid-slide, the first row is drawn 200px below its place in the list.
    drawAt(url, 300)
    press(row(open), middle(3))
    drag(middle(1) - 5)
    drop(middle(1) - 5)
    expect(shown()).toEqual([url, open, navigate, enable, policy])
  })

  it('drops a step dragged past the end of the list in last place', () => {
    seeded([open, url, navigate, enable, policy])
    layOut()
    press(row(url), middle(1))
    drag(700)
    drop(700)
    expect(shown()).toEqual([open, navigate, enable, policy, url])
  })

  it('treats a press that barely moves as a click, not a drag', () => {
    seeded([url, navigate, enable, open, policy])
    layOut()
    press(row(url), middle(0))
    drag(middle(0) + 3)
    drop(middle(0) + 3)
    expect(shown()).toEqual([url, navigate, enable, open, policy])
    expect(announced()).toBe('')
  })

  it('on touch, drags only from the handle, so the rest of the row still scrolls the page', () => {
    seeded([url, navigate, enable, open, policy])
    layOut()
    press(within(row(open)).getByText(open), middle(3), 'touch')
    drag(middle(0) - 5)
    drop(middle(0) - 5)
    expect(shown()).toEqual([url, navigate, enable, open, policy])

    press(handle(open), middle(3), 'touch')
    drag(middle(0) - 5)
    drop(middle(0) - 5)
    expect(shown()).toEqual([open, url, navigate, enable, policy])
  })

  it.each([
    ['Escape is pressed', () => fireEvent.keyDown(window, { key: 'Escape' })],
    ['the browser cancels the pointer', () => fireEvent.pointerCancel(window, { pointerId: 1, isPrimary: true })],
    ['the window loses focus', () => fireEvent.blur(window)],
    ['a context menu opens', () => fireEvent.contextMenu(window)],
    // The release was swallowed (by a context menu, say): the next move arrives with no button down.
    ['the button turns out to be up', () => fireEvent.pointerMove(window, { pointerId: 1, isPrimary: true, buttons: 0, clientY: 200 })],
  ])('puts a dragged step back when %s, and says so', (_when, cancel) => {
    seeded([url, navigate, enable, open, policy])
    layOut()
    press(row(open), middle(3))
    drag(middle(0) - 5)
    cancel()
    drop(middle(0) - 5)
    expect(shown()).toEqual([url, navigate, enable, open, policy])
    expect(numbers()).toEqual(['1', '2', '3', '4', '5'])
    expect(announced()).toBe('Move cancelled. Open organization Settings is back at position 4.')
  })

  it.each([
    ['the right mouse button', (step: string) => press(row(step), middle(3), 'mouse', { button: 2, buttons: 2 })],
    ['a second finger', (step: string) => press(handle(step), middle(3), 'touch', { isPrimary: false })],
    ['its position picker', (step: string) => press(position(step), middle(3))],
  ])('does not drag a step pressed with %s', (_with, pressWith) => {
    seeded([url, navigate, enable, open, policy])
    layOut()
    pressWith(open)
    drag(middle(0) - 5)
    drop(middle(0) - 5)
    expect(shown()).toEqual([url, navigate, enable, open, policy])
  })

  it.each([
    ['bottom', 'down', 760, 1],
    ['top', 'up', 10, -1],
  ])('scrolls the page while a step is held near the %s of the window', (_edge, _way, clientY, sign) => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const frames: FrameRequestCallback[] = []
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((frame) => frames.push(frame))
    seeded([url, navigate, enable, open, policy])
    layOut()
    press(row(enable), middle(2))
    drag(clientY)
    frames.shift()!(0)
    expect(Math.sign(scrollBy.mock.calls[0][1] as number)).toBe(sign)
    drop(clientY)
  })

  it.each([
    ['slides moved rows from their old places to their new ones', false],
    ['moves rows without sliding them when reduced motion is asked for', true],
  ])('%s', async (_what, reduce) => {
    const user = userEvent.setup()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)' }))
    seeded([navigate, enable, url, policy, open])
    // Each row is drawn wherever it currently sits in the list, 70px apart.
    const slides = new Map(
      shown().map((step) => {
        const li = row(step)
        vi.spyOn(li, 'getBoundingClientRect').mockImplementation(() => {
          const top = 100 + [...li.parentElement!.children].indexOf(li) * 70
          return { x: 0, y: top, left: 0, top, width: 600, height: 62, right: 600, bottom: top + 62, toJSON: () => ({}) }
        })
        const animate = vi.fn()
        li.animate = animate as unknown as Element['animate']
        return [step, animate]
      }),
    )
    await user.selectOptions(position(open), '1')
    expect(shown()).toEqual([open, navigate, enable, url, policy])
    if (reduce) for (const animate of slides.values()) expect(animate).not.toHaveBeenCalled()
    else {
      // From the bottom (380px) up to the top (100px); the others each drop one row.
      expect(slides.get(open)).toHaveBeenCalledWith([{ transform: 'translateY(280px)' }, { transform: 'none' }], expect.anything())
      expect(slides.get(navigate)).toHaveBeenCalledWith([{ transform: 'translateY(-70px)' }, { transform: 'none' }], expect.anything())
    }
  })

  it('ignores a drag still held when the answer gets checked', () => {
    const { onAnswer } = seeded([url, navigate, enable, open, policy])
    layOut()
    press(row(open), middle(3))
    drag(middle(0) - 5)
    // Checked from the keyboard while the mouse button is still down.
    fireEvent.click(btn('Check answer'))
    drop(middle(0) - 5)
    const yours = within(screen.getByRole('list', { name: 'Your order' })).getAllByRole('listitem')
    expect(yours.map((li) => MCP_STEPS.find((step) => li.textContent!.includes(step)))).toEqual([url, navigate, enable, open, policy])
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledWith('q1', `${url} -> ${navigate} -> ${enable} -> ${open} -> ${policy}`, false)
  })

  it('marks every step right or wrong in words once checked, and lists the correct order', async () => {
    const user = userEvent.setup()
    seeded([navigate, open, enable, url, policy])
    await user.click(btn('Check answer'))
    const yours = within(screen.getByRole('list', { name: 'Your order' })).getAllByRole('listitem')
    expect(yours.map((li) => li.textContent!.match(/✓ Correct position|✕ Belongs at position \d/)?.[0])).toEqual([
      '✕ Belongs at position 2',
      '✕ Belongs at position 1',
      '✓ Correct position',
      '✓ Correct position',
      '✓ Correct position',
    ])
    const correct = within(screen.getByRole('list', { name: 'Correct order' })).getAllByRole('listitem')
    expect(correct.map((li) => li.textContent)).toEqual(MCP_STEPS)
  })

  it('locks the order once checked, and records the attempt once', async () => {
    const user = userEvent.setup()
    const { onAnswer } = seeded([navigate, open, enable, url, policy])
    await user.click(btn('Check answer'))
    expect(screen.queryAllByRole('combobox')).toEqual([])
    const yours = () => within(screen.getByRole('list', { name: 'Your order' })).getAllByRole('listitem')
    expect(yours()[0].querySelector('[data-handle]')).toBeNull()
    press(yours()[0], middle(0))
    drag(700)
    drop(700)
    expect(yours()[0].textContent).toContain(navigate)
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})

describe('navigation', () => {
  // jsdom has no layout, so this pins the structure that keeps the pair together: one group, which
  // wraps onto a new line as a unit on a narrow card instead of leaving Next alone on a line.
  it.each(['study', 'mock'] as const)('keeps Previous and Next together in one navigation group (%s)', (mode) => {
    render(<QuestionCard question={choice} index={1} total={3} mode={mode} onNext={() => {}} onPrev={() => {}} canPrev />)
    const nav = screen.getByRole('navigation', { name: 'Question navigation' })
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['◂ Previous', 'Next ▸'])
  })

  it('does not offer Next on the last question', () => {
    render(<QuestionCard question={choice} index={2} total={3} mode="study" onNext={() => {}} />)
    expect((btn('Next ▸') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('code in question text', () => {
  const snippet: FlatQuestion = {
    ...base,
    id: 'q-code',
    type: 'multiple_choice',
    stem: 'Read this snippet:\n\n```yaml\nconcurrency:\n  group: ci\n  cancel-in-progress: true\n```\n\nWhat does `cancel-in-progress` do?',
    options: ['A. Cancels `older` runs in the group', 'B. Nothing'],
    correct: 'A',
    explanation: 'It cancels the run in `group` that is still going.',
  }
  const codeIn = (el: HTMLElement) => [...el.querySelectorAll('code')].map((c) => c.textContent)

  it('in practice, sets the snippet as indented code and inline code as code, with no backticks shown', async () => {
    const user = userEvent.setup()
    study(snippet)
    const heading = screen.getByRole('heading')
    expect(codeIn(heading)).toEqual(['concurrency:\n  group: ci\n  cancel-in-progress: true', 'cancel-in-progress'])
    const option = screen.getByRole('button', { name: /Cancels older runs in the group/ })
    expect(codeIn(option)).toEqual(['older'])
    expect(screen.getByRole('article').textContent).not.toContain('`')

    await user.click(option)
    await user.click(btn('Check answer'))
    const explanation = screen.getByText('Explanation').nextElementSibling as HTMLElement
    expect(explanation.textContent).toBe('It cancels the run in group that is still going.')
    expect(codeIn(explanation)).toEqual(['group'])
  })

  it('in a mock, renders the snippet the same way and still reveals nothing', () => {
    render(<QuestionCard question={snippet} index={0} total={3} mode="mock" />)
    expect(codeIn(screen.getByRole('heading'))[0]).toBe('concurrency:\n  group: ci\n  cancel-in-progress: true')
    expect(screen.getByRole('article').textContent).not.toMatch(/`|Explanation/)
  })

  it('names match-pairs items and answers without the backticks their code is written with', async () => {
    const user = userEvent.setup()
    const [shiftTab, , cancel] = pairs.pairs!
    study({ ...pairs, id: 'q-code-pairs', pairs: [shiftTab, { left: '`/yolo`', right: 'Permit `everything`' }, cancel] })
    await user.click(item('/yolo'))
    await user.click(answer('Permit everything'))
    expect(itemName('/yolo')).toBe('2. /yolo, matched with Permit everything')
    expect(announced()).toContain('Matched 2. /yolo with Permit everything.')
    expect(codeIn(itemCard('/yolo').getByText('/yolo').parentElement!)).toEqual(['/yolo'])
    expect(screen.getByRole('article').textContent).not.toContain('`')
  })
})
