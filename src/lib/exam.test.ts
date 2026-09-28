import { describe, expect, it } from 'vitest'
import type { Domain } from '../types'
import { ALL_QUESTIONS, DOMAINS, flattenQuestions, gradeMock, isCorrect, matchSelections, mockScore } from './exam'

const SEP = ' -> '

describe('question bank', () => {
  it('ids are unique', () => {
    const ids = ALL_QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(ALL_QUESTIONS.map((q) => [q.id, q] as const))('%s is answerable', (_id, q) => {
    switch (q.type) {
      case 'multiple_choice':
      case 'multi_select': {
        expect(q.options?.length).toBeGreaterThan(1)
        const letters = q.options!.map((o, i) => o.match(/^([A-Z])\./)?.[1] ?? String.fromCharCode(65 + i))
        for (const c of q.correct!.split(',')) expect(letters).toContain(c.trim().toUpperCase())
        break
      }
      case 'drag_drop_order':
        // The answer is serialized with SEP, so options must not contain it.
        for (const o of q.options!) expect(o).not.toContain(SEP)
        expect(new Set(q.options).size).toBe(q.options!.length) // steps are React keys
        expect([...q.correct!.split(SEP)].sort()).toEqual([...q.options!].sort())
        break
      case 'fill_blank':
        expect(q.correct?.trim()).toBeTruthy()
        break
      case 'match_pairs': {
        // `pairs` is the key: each left item sits with its own right-hand value, and every right-hand
        // value is one choice in each item's picker, so both sides must be distinct and non-empty.
        const n = q.pairs?.length ?? 0
        expect(n).toBeGreaterThan(1)
        const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
        expect(new Set(q.pairs!.map((p) => norm(p.left))).size).toBe(n) // left sides are React keys and labels
        expect(new Set(q.pairs!.map((p) => norm(p.right))).size).toBe(n)
        for (const p of q.pairs!) expect(p.left.trim() && p.right.trim()).toBeTruthy()
        const key = q.pairs!.map((_, i) => i)
        expect(isCorrect(q, key.join(','))).toBe(true)
        expect(isCorrect(q, [...key.slice(1), key[0]].join(','))).toBe(false)
        break
      }
      default:
        // case_study parents carry no controls; their context is folded into each sub-question.
        throw new Error(`unanswerable question type in the bank: ${q.type}`)
    }
  })
})

describe('question metadata', () => {
  // Results group and label questions by these; one bank entry spelling a title differently shows twice.
  it.each(ALL_QUESTIONS.map((q) => [q.id, q] as const))('%s names its domain and objective as the bank does', (_id, q) => {
    const domain = DOMAINS.find((d) => d.domain_id === q.domainId)!
    expect(q.domainTitle).toBe(domain.title)
    expect(q.objectiveTitle).toBe(domain.objectives.find((o) => o.id === q.objectiveId)?.title)
  })
})

describe('flattenQuestions', () => {
  it('serves the D4 4.3 "never runs the test command" case study only through its sub-question', () => {
    const ids = ALL_QUESTIONS.filter((q) => q.stem.includes('never runs the test command')).map((q) => q.id)
    expect(ids).toEqual(['d4-4.3-60-sub0']) // not the control-less parent d4-4.3-59
    const sub = ALL_QUESTIONS.find((q) => q.id === 'd4-4.3-60-sub0')!
    expect(sub.type).toBe('multiple_choice')
    expect(sub.options).toHaveLength(4)
    expect(sub.stem).toMatch(/^\[Case study context\] After three failed runs/)
  })

  it('keeps the ids already stored in users\' progress', () => {
    const byStem = (s: string) => ALL_QUESTIONS.find((q) => q.stem.startsWith(s))?.id
    expect(byStem('Match the CLI control to its purpose.')).toBe('d6-6.1-71')
  })

  it('folds case studies into their sub-questions and keeps ids stable', () => {
    const mc = { type: 'multiple_choice' as const, stem: 'q', domain: '1.1', options: ['A. a', 'B. b'], correct: 'A' }
    const domains: Domain[] = [
      {
        domain_id: 1,
        title: 'D',
        weight_pct: '10',
        objectives: [
          {
            id: '1.1',
            title: 'O',
            questions: [
              mc,
              { type: 'case_study', stem: 'Context', domain: '1.1', sub_questions: [mc, mc] },
              mc,
            ],
          },
        ],
      },
    ]
    const flat = flattenQuestions(domains)
    // Ids are persisted in localStorage progress; the case-study parent still consumes a slot.
    expect(flat.map((q) => q.id)).toEqual(['d1-1.1-1', 'd1-1.1-3-sub0', 'd1-1.1-4-sub1', 'd1-1.1-5'])
    expect(flat[1].stem).toContain('Context')
  })
})

describe('match pairs', () => {
  const q = ALL_QUESTIONS.find((x) => x.id === 'd1-1.1-7')!

  it('are all in the bank, including the one inside a case study', () => {
    const ids = ALL_QUESTIONS.filter((x) => x.type === 'match_pairs').map((x) => x.id)
    expect(ids).toContain('d6-6.2-78-sub0')
    expect(q.type).toBe('match_pairs')
  })

  it('are graded from the stored mapping, not a self-grade', () => {
    expect(isCorrect(q, '0,1,2,3')).toBe(true)
    expect(isCorrect(q, '1,0,2,3')).toBe(false)
    expect(isCorrect(q, '0,1,2,')).toBe(false)
    expect(isCorrect(q, 'self-correct')).toBe(false)
  })

  it('read a stored answer per left item, and anything not a fresh in-range choice as unchosen', () => {
    expect(matchSelections('2,0,,1', 4)).toEqual([2, 0, undefined, 1])
    expect(matchSelections('', 3)).toEqual([undefined, undefined, undefined])
    expect(matchSelections('self-correct', 2)).toEqual([undefined, undefined])
    expect(matchSelections('1,1,5,-1,x', 5)).toEqual([1, undefined, undefined, undefined, undefined])
    // Only the exact form the pickers write counts, so "answered" and "graded correct" read alike.
    expect(matchSelections(' 1,0', 2)).toEqual([undefined, 0])
    expect(matchSelections('1.0,01', 2)).toEqual([undefined, undefined])
    expect(matchSelections('0,1,2,3,4', 4)).toEqual([undefined, undefined, undefined, undefined])
  })
})

describe('gradeMock', () => {
  it('grades each saved answer in mock order, numbering past ids no longer in the bank', () => {
    const run = {
      startedAt: 0,
      finishedAt: 1,
      // d4-4.3-59 is a case-study parent an older version saved; the mock skips it.
      questionIds: ['d1-1.1-7', 'd4-4.3-59', 'd1-1.1-1', 'gpt-1'],
      answers: { 'd1-1.1-7': '1,0,2,3', 'd1-1.1-1': 'B' },
      flagged: { 'gpt-1': true as const },
    }
    const results = gradeMock(run)
    expect(results.map((r) => [r.question.id, r.number, r.given, r.correct, r.flagged])).toEqual([
      ['d1-1.1-7', 1, '1,0,2,3', false, false],
      ['d1-1.1-1', 2, 'B', true, false],
      ['gpt-1', 3, undefined, false, true], // unanswered counts as missed
    ])
    expect(mockScore(results)).toBe(333)
  })

  it('reads a run saved before mocks could be flagged', () => {
    const results = gradeMock({ startedAt: 0, questionIds: ['d1-1.1-1'], answers: { 'd1-1.1-1': 'B' } })
    expect(results.map((r) => [r.correct, r.flagged])).toEqual([[true, false]])
    expect(mockScore(results)).toBe(1000)
    expect(mockScore([])).toBe(0)
  })
})
