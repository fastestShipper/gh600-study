import dataRaw from '../data.json'
import { EXTRA_QUESTIONS } from '../data/extra-questions'
import type { DataShape, Domain, FlatQuestion, MockExamRun, Question } from '../types'

export const data = dataRaw as unknown as DataShape

export const META = data.meta
export const DOMAINS: Domain[] = data.domains

export function flattenQuestions(domains: Domain[] = DOMAINS): FlatQuestion[] {
  const flat: FlatQuestion[] = []
  let counter = 0
  for (const dom of domains) {
    for (const obj of dom.objectives) {
      for (const q of obj.questions ?? []) {
        counter += 1
        // A case study has no controls of its own: its context is folded into each
        // sub-question below. It still takes a counter slot so persisted ids stay stable.
        if (q.type !== 'case_study') {
          flat.push({
            ...q,
            id: `d${dom.domain_id}-${obj.id}-${counter}`,
            domainId: dom.domain_id,
            domainTitle: dom.title,
            objectiveId: obj.id,
            objectiveTitle: obj.title,
          })
        }
        if (q.type === 'case_study' && q.sub_questions) {
          q.sub_questions.forEach((sq, idx) => {
            counter += 1
            flat.push({
              ...sq,
              id: `d${dom.domain_id}-${obj.id}-${counter}-sub${idx}`,
              domain: q.domain,
              stem: `[Case study context] ${q.stem}\n\n${sq.stem}`,
              domainId: dom.domain_id,
              domainTitle: dom.title,
              objectiveId: obj.id,
              objectiveTitle: obj.title,
            })
          })
        }
      }
    }
  }
  return flat
}

export const ALL_QUESTIONS: FlatQuestion[] = [...flattenQuestions(), ...EXTRA_QUESTIONS]

export const QUESTION_BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]))

export const QUESTIONS_BY_DOMAIN: Record<number, FlatQuestion[]> = ALL_QUESTIONS.reduce(
  (acc, q) => {
    ;(acc[q.domainId] ||= []).push(q)
    return acc
  },
  {} as Record<number, FlatQuestion[]>,
)

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildMockSet(count: number): FlatQuestion[] {
  // Roughly weight by domain weight midpoint so the exam feels real.
  const weights: Record<number, number> = {
    1: 0.175, // 15-20
    2: 0.225, // 20-25
    3: 0.125, // 10-15
    4: 0.175, // 15-20
    5: 0.175, // 15-20
    6: 0.125, // 10-15
  }
  const picks: FlatQuestion[] = []
  for (const dom of DOMAINS) {
    const target = Math.max(2, Math.round(count * (weights[dom.domain_id] ?? 0.17)))
    const pool = shuffle(QUESTIONS_BY_DOMAIN[dom.domain_id] ?? [])
    picks.push(...pool.slice(0, target))
  }
  return shuffle(picks).slice(0, count)
}

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

// A match-pairs answer lists, for each left-hand item in data order, the index in `pairs` of the
// right-hand value chosen for it ("2,0,,1" while one is still unchosen). Indices rather than text,
// since some right-hand values contain commas. Only that exact form counts, so a complete answer is
// graded correct exactly when every pick is its own index; anything else (a wrong part count, a
// repeated or out-of-range index, the "self-correct" self-grades of older versions) reads as unchosen.
export function matchSelections(given: string, size: number): (number | undefined)[] {
  const parts = given.split(',')
  if (parts.length !== size) return Array.from({ length: size }, () => undefined)
  const taken = new Set<number>()
  return parts.map((part) => {
    const pick = Number(part)
    if (String(pick) !== part || pick < 0 || pick >= size || taken.has(pick)) return undefined
    taken.add(pick)
    return pick
  })
}

export function isCorrect(q: Question, given: string): boolean {
  if (q.type === 'match_pairs') {
    // `pairs` is the key: every left item sits with its own right-hand value, so the answer is "0,1,2,…".
    return !!q.pairs?.length && given === q.pairs.map((_, i) => i).join(',')
  }
  if (!q.correct) return false
  if (q.type === 'multi_select') {
    const a = new Set(given.split(',').map((x) => x.trim().toUpperCase()))
    const b = new Set((q.correct ?? '').split(',').map((x) => x.trim().toUpperCase()))
    if (a.size !== b.size) return false
    for (const v of a) if (!b.has(v)) return false
    return true
  }
  if (q.type === 'fill_blank') {
    return normalizeAnswer(given) === normalizeAnswer(q.correct)
  }
  if (q.type === 'drag_drop_order') {
    return normalizeAnswer(given) === normalizeAnswer(q.correct)
  }
  return given.trim().toUpperCase() === (q.correct || '').trim().toUpperCase()
}

export interface MockResult {
  question: FlatQuestion
  number: number // 1-based position in the mock, as it was shown
  given?: string
  correct: boolean
  flagged: boolean
}

// Each question of a mock with its saved answer and grade, in the order the mock showed them. Ids no
// longer in the bank (case-study parents saved by older versions) are skipped, as the mock skips them.
export function gradeMock(run: MockExamRun): MockResult[] {
  const questions = run.questionIds.flatMap((id) => QUESTION_BY_ID.get(id) ?? [])
  return questions.map((question, i) => {
    const given = run.answers[question.id]
    return {
      question,
      number: i + 1,
      given,
      correct: !!given && isCorrect(question, given),
      flagged: !!run.flagged?.[question.id],
    }
  })
}

// Out of 1000, as the exam reports it; unanswered questions count as wrong.
export function mockScore(results: MockResult[]): number {
  if (!results.length) return 0
  return Math.round((results.filter((r) => r.correct).length / results.length) * 1000)
}

export function questionLetterOptions(q: Question): string[] {
  return q.options ?? []
}
