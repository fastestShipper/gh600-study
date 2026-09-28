import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MockExamRun } from '../types'
import { ALL_QUESTIONS, DOMAINS } from '../lib/exam'
import { plainText } from '../lib/richText'
import type { FlatQuestion } from '../types'
import MockResults from './MockResults'

afterEach(cleanup)

const byId = (id: string) => ALL_QUESTIONS.find((q) => q.id === id)!
const first = (type: string) => ALL_QUESTIONS.find((q) => q.type === type && !q.stem.startsWith('[Case study'))!

const single = byId('d1-1.1-1') // correct B
const multi = first('multi_select')
const order = first('drag_drop_order')
const fill = first('fill_blank')
const match = byId('d1-1.1-7')
const extra = byId('gpt-1') // correct B, answered right below
const orderKey = order.correct!.split(' -> ')
const multiKey = multi.correct!.split(',')

const RUN: MockExamRun = {
  startedAt: 0,
  finishedAt: 47 * 60000,
  questionIds: [single.id, multi.id, order.id, fill.id, match.id, extra.id],
  answers: {
    [single.id]: 'A',
    // one right option, one wrong one: the rest of the key is left unselected
    [multi.id]: [multiKey[0], ['A', 'B', 'C', 'D', 'E'].find((l) => !multiKey.includes(l))].sort().join(','),
    [order.id]: [orderKey[1], orderKey[0], ...orderKey.slice(2)].join(' -> '),
    [match.id]: '1,0,2,3',
    [extra.id]: 'B',
    // fill-in-the-blank left unanswered
  },
  flagged: { [extra.id]: true, [single.id]: true },
  score: 167,
}

const item = (n: number) => within(screen.getByRole('article', { name: `Question ${n}` }))
const review = () => screen.getByRole('region', { name: 'Review answers' })
const shownNumbers = () =>
  within(review())
    .queryAllByRole('article')
    .map((a) => a.getAttribute('aria-label'))

describe('mock results', () => {
  it('renders nothing for a mock still in progress', () => {
    const { container } = render(<MockResults run={{ ...RUN, finishedAt: undefined }} />)
    expect(container.innerHTML).toBe('')
  })

  it('summarizes the score and names every domain by number and title', () => {
    render(<MockResults run={RUN} />)
    expect(screen.getByRole('heading', { name: 'Score: 167 / 1000' })).toBeTruthy()
    expect(screen.getByText('WOULD NOT PASS')).toBeTruthy()
    expect(screen.getByText(/1 of 6 correct · 5 missed \(1 not answered\) · 2 flagged/)).toBeTruthy()

    const domains = within(screen.getByRole('region', { name: 'Results by domain' }))
    const d1 = DOMAINS.find((d) => d.domain_id === 1)!
    const summaries = domains.getAllByText(/^Domain \d · /)
    expect(summaries[0].textContent).toBe(`Domain 1 · ${d1.title}`)
    for (const s of summaries) expect(s.textContent).toMatch(/^Domain \d · \S/)
  })

  it('reviews missed questions by default, and filters to flagged or all', async () => {
    const user = userEvent.setup()
    render(<MockResults run={RUN} />)
    expect(within(review()).getByRole('button', { name: 'Missed (5)' }).getAttribute('aria-pressed')).toBe('true')
    expect(shownNumbers()).toEqual(['Question 1', 'Question 2', 'Question 3', 'Question 4', 'Question 5'])

    await user.click(within(review()).getByRole('button', { name: 'Flagged (2)' }))
    expect(shownNumbers()).toEqual(['Question 1', 'Question 6'])
    expect(item(6).getByText('✓ Correct')).toBeTruthy()
    expect(item(6).getByText('⚑ Flagged')).toBeTruthy()

    await user.click(within(review()).getByRole('button', { name: 'All (6)' }))
    expect(shownNumbers()).toHaveLength(6)

    await user.selectOptions(within(review()).getByRole('combobox', { name: 'Domain' }), String(extra.domainId))
    expect(shownNumbers()).toEqual(['Question 6'])
  })

  it('shows a single answer as option text, with the explanation, domain and objective', () => {
    render(<MockResults run={RUN} />)
    const q = item(1)
    expect(q.getByText('✕ Incorrect')).toBeTruthy()
    expect(q.getByText('Single answer')).toBeTruthy()
    expect(q.getByText(`Domain 1 · ${single.domainTitle}`)).toBeTruthy()
    expect(q.getByText(`Objective ${single.objectiveId} · ${single.objectiveTitle}`)).toBeTruthy()
    const yours = within(q.getByRole('heading', { name: 'Your answer' }).parentElement!)
    const key = within(q.getByRole('heading', { name: 'Correct answer' }).parentElement!)
    // Option text, without the letter prefix and with any `code` rendered, not the stored letter.
    expect(yours.getByRole('listitem').textContent).toBe(`A${plainText(single.options![0].slice(3))}✕incorrect`)
    expect(key.getByRole('listitem').textContent).toBe(`B${plainText(single.options![1].slice(3))}`)
    expect(key.getByText('npm run lint').tagName).toBe('CODE') // rendered, not left in backticks
    expect(key.queryByText('You did not select this')).toBeNull() // only said of multi-select
    const explanation = q.getByRole('heading', { name: 'Explanation' }).nextElementSibling!
    expect(explanation.textContent).toBe(plainText(single.explanation!))
    expect(within(explanation as HTMLElement).getByText('npm run lint').tagName).toBe('CODE')
  })

  it('compares a multi-select option by option', () => {
    render(<MockResults run={RUN} />)
    const q = item(2)
    const yours = within(q.getByRole('heading', { name: 'Your answer' }).parentElement!)
    const key = within(q.getByRole('heading', { name: `Correct answer · ${multiKey.length} options` }).parentElement!)
    expect(yours.getAllByRole('listitem')).toHaveLength(2)
    expect(yours.getAllByText('correct')).toHaveLength(1)
    expect(yours.getAllByText('incorrect')).toHaveLength(1)
    expect(key.getAllByRole('listitem')).toHaveLength(multiKey.length)
    expect(key.getAllByText('You did not select this')).toHaveLength(multiKey.length - 1)
  })

  it('shows your order against the correct order', () => {
    render(<MockResults run={RUN} />)
    const q = item(3)
    const yours = within(q.getByRole('heading', { name: 'Your order' }).parentElement!)
    const key = within(q.getByRole('heading', { name: 'Correct order' }).parentElement!)
    expect(yours.getAllByRole('listitem')[0].textContent).toContain(orderKey[1])
    expect(yours.getAllByText(/^Belongs at position [12]$/)).toHaveLength(2)
    expect(key.getAllByRole('listitem').map((li) => li.textContent)).toEqual(orderKey.map((s, i) => `${i + 1}${s}`))
  })

  it('shows an unanswered fill-in-the-blank with its accepted answer', () => {
    render(<MockResults run={RUN} />)
    const q = item(4)
    expect(q.getByText('✕ Not answered')).toBeTruthy()
    expect(within(q.getByRole('heading', { name: 'Your answer' }).parentElement!).getByText('Not answered')).toBeTruthy()
    expect(within(q.getByRole('heading', { name: 'Accepted answer' }).parentElement!).getByText(fill.correct!)).toBeTruthy()
  })

  it('shows each match-pairs item with your match and the correct one', () => {
    render(<MockResults run={RUN} />)
    const q = item(5)
    const pairs = match.pairs!
    expect(q.getByRole('heading', { name: `Your matches · ${pairs.length - 2} of ${pairs.length} correct` })).toBeTruthy()
    const rows = q.getAllByRole('listitem')
    expect(rows[0].textContent).toContain(`Your match: ${pairs[1].right}`)
    expect(rows[0].textContent).toContain(`Correct match: ${pairs[0].right}`)
    expect(rows[2].textContent).toContain(`Your match: ${pairs[2].right}`)
    expect(rows[2].textContent).not.toContain('Correct match')
  })

  it('opens a domain to its objectives and missed questions, each linking to its review', async () => {
    const user = userEvent.setup()
    render(<MockResults run={RUN} />)
    await user.click(within(review()).getByRole('button', { name: 'Flagged (2)' }))

    const domains = screen.getByRole('region', { name: 'Results by domain' })
    const d1 = domains.querySelector('details')!
    expect(d1.open).toBe(false)
    await user.click(within(d1).getByText(/^Domain 1 · /))
    expect(d1.open).toBe(true)
    expect(within(d1).getByText(single.objectiveTitle)).toBeTruthy()

    const missed = within(within(d1).getByRole('heading', { name: /^Missed/ }).parentElement!)
    await user.click(missed.getByRole('button', { name: /^Question 2, Incorrect: / }))
    // Back on the missed list, narrowed to this domain, with the question in focus.
    expect(within(review()).getByRole('button', { name: /^Missed/ }).getAttribute('aria-pressed')).toBe('true')
    expect((within(review()).getByRole('combobox', { name: 'Domain' }) as HTMLSelectElement).value).toBe('1')
    expect(document.activeElement).toBe(screen.getByRole('article', { name: 'Question 2' }))
  })

  it('"Review N missed questions" resets the filters and moves focus to the review', async () => {
    const user = userEvent.setup()
    render(<MockResults run={RUN} />)
    await user.click(within(review()).getByRole('button', { name: 'All (6)' }))
    await user.click(screen.getByRole('button', { name: 'Review 5 missed questions' }))
    expect(shownNumbers()).toHaveLength(5)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Review answers' }))
  })

  it('takes focus on the score when shown right after submitting', () => {
    render(<MockResults run={RUN} focusOnMount />)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Score: 167 / 1000' }))
  })
})

// Single-answer questions of one domain, outside case studies.
const singles = (domainId: number) =>
  ALL_QUESTIONS.filter((q) => q.type === 'multiple_choice' && q.domainId === domainId && !q.stem.startsWith('['))
const wrongLetter = (q: FlatQuestion) => ['A', 'B', 'C', 'D'].find((l) => l !== q.correct)!
// A finished run answering each question right or wrong as listed.
function runOf(answers: [FlatQuestion, boolean][], extra: Partial<MockExamRun> = {}): MockExamRun {
  return {
    startedAt: 0,
    finishedAt: 1,
    questionIds: answers.map(([q]) => q.id),
    answers: Object.fromEntries(answers.map(([q, right]) => [q.id, right ? q.correct! : wrongLetter(q)])),
    ...extra,
  }
}
const listUnder = (heading: RegExp) =>
  within(screen.getByRole('heading', { name: heading }).parentElement!)
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('mock results summary', () => {
  const caseStudy = byId('d4-4.3-60-sub0') // single answer inside a case study
  const snippet = byId('gpt-2') // stem carries a fenced YAML snippet
  const [a1, a2] = singles(1)
  const [b1, b2, b3, b4] = singles(2)
  const [c1] = singles(3)
  const [d1] = singles(4)
  // D1 2/2 and D3 1/1 (100%), D2 3/4 (75%), D4 1/2 (50%), D5 0/1 (0%)
  const RANKED = runOf([
    [a1, true], [a2, true], [b1, true], [b2, true], [b3, true], [b4, false],
    [c1, true], [d1, true], [caseStudy, false], [snippet, false],
  ])
  const name = (id: number) => `Domain ${id} · ${DOMAINS.find((d) => d.domain_id === id)!.title}`

  it('lists the two strongest domains, then the ones below 70% worst first, each opening its misses', async () => {
    const user = userEvent.setup()
    render(<MockResults run={RANKED} />)
    // Ties at 100% go to the domain with more questions; 75% is past the top two.
    expect(listUnder(/^Strongest/)).toEqual([`${name(1)}100%`, `${name(3)}100%`])
    expect(listUnder(/^Needs work/)).toEqual([`${name(5)}0% · review 1 ▸`, `${name(4)}50% · review 1 ▸`])

    await user.click(screen.getByRole('button', { name: `Review 1 missed question in ${name(4)}, 50% correct` }))
    expect(within(review()).getByRole('button', { name: /^Missed/ }).getAttribute('aria-pressed')).toBe('true')
    expect((within(review()).getByRole('combobox', { name: 'Domain' }) as HTMLSelectElement).value).toBe('4')
    expect(shownNumbers()).toEqual(['Question 9'])
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Review answers' }))
  })

  it('previews a question in one line, and reviews it in full with its snippet kept as code', async () => {
    const user = userEvent.setup()
    render(<MockResults run={RANKED} />)
    const [context, question] = [caseStudy.stem.split('\n\n')[0], caseStudy.stem.split('\n\n').at(-1)!]
    const d4 = screen.getByRole('region', { name: 'Results by domain' }).querySelectorAll('details')[3]
    await user.click(within(d4).getByText(/^Domain 4 · /))
    // The row names the question itself, not the shared case-study context before it.
    expect(within(d4).getByRole('button', { name: `Question 9, Incorrect: ${question}` })).toBeTruthy()
    const full = screen.getByRole('article', { name: 'Question 9' }).textContent
    expect(full).toContain(plainText(context)) // its `code` rendered, no backticks
    expect(full).toContain(plainText(question))

    const d5 = screen.getByRole('region', { name: 'Results by domain' }).querySelectorAll('details')[4]
    const preview = within(d5).getByRole('button', { name: /^Question 10, Incorrect: / }).textContent!
    expect(preview).toContain('- name: Set color id: color-selector')
    expect(preview).not.toContain('```')
    const code = item(10).getByText(/^- name: Set color/)
    expect(code.tagName).toBe('CODE')
    expect(code.textContent).toContain('\n  id: color-selector\n') // indentation kept
  })

  it('passes at exactly the pass mark, scored from the answers', () => {
    const qs = [...singles(1), ...singles(2)].slice(0, 10)
    render(<MockResults run={runOf(qs.map((q, i) => [q, i < 7]), { score: 0 })} />)
    expect(screen.getByRole('heading', { name: 'Score: 700 / 1000' })).toBeTruthy()
    expect(screen.getByText('WOULD PASS')).toBeTruthy()
  })

  it('scores a run saved by an older version from today\'s grading, so the numbers agree', () => {
    // Stored as 1000: its match pairs were self-graded, and its case-study parent was a question then.
    const legacy: MockExamRun = {
      startedAt: 0,
      finishedAt: 1,
      questionIds: [match.id, 'd4-4.3-59', single.id],
      answers: { [match.id]: 'self-correct', [single.id]: 'B' },
      score: 1000,
    }
    render(<MockResults run={legacy} />)
    expect(screen.getByRole('heading', { name: 'Score: 500 / 1000' })).toBeTruthy()
    expect(screen.getByText(/^1 of 2 correct · 1 missed ·/)).toBeTruthy()
    expect(item(1).getAllByText('Not matched')).toHaveLength(match.pairs!.length)
  })

  it('with nothing missed and nothing flagged, opens on all answers with nothing to chase', async () => {
    const user = userEvent.setup()
    const perfect = runOf([[a1, true], [b1, true], [c1, true]]) // saved without a flagged key
    render(<MockResults run={perfect} />)
    expect(screen.getByText(/^3 of 3 correct · 0 missed · pass mark/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Review \d+ missed/ })).toBeNull()
    expect(screen.getByText('Every domain is at 70% or better.')).toBeTruthy()
    expect(screen.getAllByText('Nothing missed')).toHaveLength(3)
    expect(within(review()).getByRole('button', { name: 'All (3)' }).getAttribute('aria-pressed')).toBe('true')
    expect(shownNumbers()).toHaveLength(3)

    await user.click(within(review()).getByRole('button', { name: 'Flagged (0)' }))
    await user.selectOptions(within(review()).getByRole('combobox', { name: 'Domain' }), '2')
    expect(shownNumbers()).toEqual([])
    expect(within(review()).getByRole('status').textContent).toBe(
      `No flagged questions in ${name(2)}. Use ⚐ Flag during a mock to mark questions to revisit.`,
    )
  })

  it('shows an unanswered match-pairs question with nothing matched', () => {
    render(<MockResults run={{ startedAt: 0, finishedAt: 1, questionIds: [match.id], answers: {} }} />)
    expect(item(1).getByText('✕ Not answered')).toBeTruthy()
    expect(item(1).getByRole('heading', { name: `Your matches · 0 of ${match.pairs!.length} correct` })).toBeTruthy()
    expect(item(1).getAllByText('Not matched')).toHaveLength(match.pairs!.length)
  })
})
