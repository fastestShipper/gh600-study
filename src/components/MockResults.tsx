import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { FlatQuestion, MatchPair, MockExamRun } from '../types'
import { DOMAINS, gradeMock, matchSelections, META, mockScore } from '../lib/exam'
import type { MockResult } from '../lib/exam'
import { plainText } from '../lib/richText'
import RichText from './RichText'

type Show = 'missed' | 'flagged' | 'all'

interface DomainResult {
  id: number
  title: string
  results: MockResult[]
  correct: number
  pct: number
}

// A domain at or above this share correct reads as strong: the same line as the 700 / 1000 pass mark
// and the green bars elsewhere in the app.
const STRONG_PCT = 70

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Single answer',
  multi_select: 'Multi-select',
  drag_drop_order: 'Order the steps',
  fill_blank: 'Fill in the blank',
  match_pairs: 'Match pairs',
}

const SEP = ' -> '
const LABEL = 'text-xs uppercase tracking-wider text-ink-mute font-semibold'
const HIT = 'border-good/50 bg-good/10'
const MISS = 'border-bad/50 bg-bad/10'

const domainName = (d: { id: number; title: string }) => `Domain ${d.id} · ${d.title}`
const tone = (pct: number) => (pct >= STRONG_PCT ? 'good' : pct >= 50 ? 'warn' : 'bad')
const BAR = { good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad' }
const TEXT = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' }
const reviewId = (questionId: string) => `review-${questionId}`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Score, per-domain breakdown and an answer-by-answer review of a submitted mock. Renders nothing for
// a mock still in progress: answers are only revealed once it is submitted.
export default function MockResults({ run, focusOnMount }: { run: MockExamRun; focusOnMount?: boolean }) {
  const results = gradeMock(run)
  const missed = results.filter((r) => !r.correct)
  const domains: DomainResult[] = DOMAINS.flatMap((d) => {
    const inDomain = results.filter((r) => r.question.domainId === d.domain_id)
    if (!inDomain.length) return []
    const correct = inDomain.filter((r) => r.correct).length
    return [{ id: d.domain_id, title: d.title, results: inDomain, correct, pct: Math.round((correct / inDomain.length) * 100) }]
  })

  const [show, setShow] = useState<Show>(() => (missed.length ? 'missed' : 'all'))
  const [domainFilter, setDomainFilter] = useState<number | 'all'>('all')
  const summaryRef = useRef<HTMLElement>(null)
  const scoreRef = useRef<HTMLHeadingElement>(null)
  const reviewRef = useRef<HTMLHeadingElement>(null)

  // Submitting unmounts the button that had focus: land on the score instead of <body>.
  useEffect(() => {
    if (!focusOnMount) return
    summaryRef.current?.scrollIntoView?.({ block: 'start' })
    scoreRef.current?.focus({ preventScroll: true })
  }, [focusOnMount])

  if (!run.finishedAt) return null

  const correctCount = results.length - missed.length
  const unanswered = missed.filter((r) => !r.given).length
  const flaggedCount = results.filter((r) => r.flagged).length
  // Scored like every count on this page, from today's grading: a run saved by an older version
  // (self-graded match pairs, case-study parents) still adds up, even if its stored score differs.
  const score = mockScore(results)
  const passed = score >= META.passing_score
  const minutes = Math.min(META.duration_minutes, Math.round((run.finishedAt - run.startedAt) / 60000))
  const byPct = [...domains].sort((a, b) => b.pct - a.pct || b.results.length - a.results.length)
  const strongest = byPct.filter((d) => d.pct >= STRONG_PCT).slice(0, 2)
  const weaker = byPct.filter((d) => d.pct < STRONG_PCT).reverse()

  const inDomain = domainFilter === 'all' ? results : results.filter((r) => r.question.domainId === domainFilter)
  const pools: Record<Show, MockResult[]> = {
    missed: inDomain.filter((r) => !r.correct),
    flagged: inDomain.filter((r) => r.flagged),
    all: inDomain,
  }
  const shown = pools[show]
  const filtered = domains.find((d) => d.id === domainFilter)
  const where = filtered ? ` in ${domainName(filtered)}` : ''
  const emptyMessage: Record<Show, string> = {
    missed: `Nothing missed${where}.`,
    flagged: `No flagged questions${where}. Use ⚐ Flag during a mock to mark questions to revisit.`,
    all: `No questions${where}.`,
  }

  // Filter the review, then take the reader there: to the review heading, or to one question.
  const openReview = (nextShow: Show, domain: number | 'all', questionId?: string) => {
    flushSync(() => {
      setShow(nextShow)
      setDomainFilter(domain)
    })
    const target = questionId ? document.getElementById(reviewId(questionId)) : reviewRef.current
    target?.scrollIntoView?.({ block: 'start' })
    target?.focus({ preventScroll: true })
  }

  return (
    <div className="space-y-6">
      <section ref={summaryRef} aria-labelledby="mock-score" className="card p-5 sm:p-6 scroll-mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-ink-mute font-mono">
              LATEST MOCK · {new Date(run.finishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
              {minutes} min
            </div>
            <h2 id="mock-score" ref={scoreRef} tabIndex={-1} className="text-2xl font-display font-bold text-ink mt-1">
              Score: {score} / 1000
            </h2>
            <p className="text-sm text-ink-dim mt-1">
              {correctCount} of {results.length} correct · {missed.length} missed
              {unanswered > 0 && ` (${unanswered} not answered)`}
              {flaggedCount > 0 && ` · ${flaggedCount} flagged`} · pass mark {META.passing_score}
            </p>
          </div>
          <div className={`chip ${passed ? 'chip-good' : 'chip-bad'}`}>{passed ? 'WOULD PASS' : 'WOULD NOT PASS'}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mt-5">
          <div>
            <h3 className={`${LABEL} mb-2`}>Strongest</h3>
            {strongest.length ? (
              <ul className="space-y-1.5">
                {strongest.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap sm:flex-nowrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg bg-bg-3/40 px-3 py-2 text-sm"
                  >
                    <span className="text-ink-dim">{domainName(d)}</span>
                    <span className="shrink-0 font-mono text-good">{d.pct}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-dim">No domain reached {STRONG_PCT}% this time.</p>
            )}
          </div>
          <div>
            <h3 className={`${LABEL} mb-2`}>Needs work · below {STRONG_PCT}%</h3>
            {weaker.length ? (
              <ul className="space-y-1.5">
                {weaker.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => openReview('missed', d.id)}
                      aria-label={`Review ${plural(d.results.length - d.correct, 'missed question')} in ${domainName(d)}, ${d.pct}% correct`}
                      className="w-full text-left flex flex-wrap sm:flex-nowrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-line px-3 py-2 text-sm transition hover:border-line-strong hover:bg-bg-3 cursor-pointer"
                    >
                      <span className="text-ink-dim">{domainName(d)}</span>
                      <span className={`shrink-0 font-mono ${TEXT[tone(d.pct)]}`}>
                        {d.pct}% · review {d.results.length - d.correct} ▸
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-dim">Every domain is at {STRONG_PCT}% or better.</p>
            )}
          </div>
        </div>

        {missed.length > 0 && (
          <button onClick={() => openReview('missed', 'all')} className="btn btn-primary mt-5 max-sm:min-h-11">
            Review {plural(missed.length, 'missed question')}
          </button>
        )}
      </section>

      <section aria-labelledby="mock-domains" className="space-y-2">
        <h2 id="mock-domains" className="font-display font-semibold text-ink">
          Results by domain
        </h2>
        <p className="text-xs text-ink-mute">Open a domain for its objectives and the questions you missed.</p>
        {domains.map((d) => (
          <DomainCard key={d.id} domain={d} onOpen={(questionId, list) => openReview(list, d.id, questionId)} />
        ))}
      </section>

      <section aria-labelledby="mock-review" className="space-y-3">
        <h2 id="mock-review" ref={reviewRef} tabIndex={-1} className="font-display font-semibold text-ink scroll-mt-4">
          Review answers
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Show questions" className="flex flex-wrap gap-2">
            {(
              [
                ['missed', 'Missed'],
                ['flagged', 'Flagged'],
                ['all', 'All'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setShow(key)}
                aria-pressed={show === key}
                className="btn text-xs max-sm:min-h-11"
              >
                {label} ({pools[key].length})
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-mute w-full sm:w-auto sm:ml-auto">
            Domain
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="text-sm min-w-0 flex-1 sm:flex-none sm:max-w-md max-sm:min-h-11"
            >
              <option value="all">All domains</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {domainName(d)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p role="status" className="text-xs text-ink-mute">
          {shown.length ? `Showing ${shown.length} of ${results.length} questions.` : emptyMessage[show]}
        </p>
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.question.id}>
              <ReviewItem result={r} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function DomainCard({
  domain: d,
  onOpen,
}: {
  domain: DomainResult
  onOpen: (questionId: string, list: Show) => void
}) {
  const missed = d.results.filter((r) => !r.correct)
  const flagged = d.results.filter((r) => r.flagged)
  const objectives = new Map<string, { title: string; correct: number; total: number }>()
  for (const r of d.results) {
    const o = objectives.get(r.question.objectiveId) ?? { title: r.question.objectiveTitle, correct: 0, total: 0 }
    o.total += 1
    if (r.correct) o.correct += 1
    objectives.set(r.question.objectiveId, o)
  }
  const byId = [...objectives].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))

  return (
    <details className="card card-hover group">
      <summary className="flex gap-3 p-4 cursor-pointer list-none rounded-[14px] transition-colors hover:bg-bg-3/40 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="grid place-items-center shrink-0 self-start w-3 h-5 text-ink-dim transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          ▸
        </span>
        <span className="min-w-0 flex-1">
          {/* The {' '} separators keep the summary's accessible name from running words together. */}
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-ink">{domainName(d)}</span>{' '}
            <span className="text-sm font-mono text-ink-dim">
              {d.correct} of {d.results.length} correct · {d.pct}%
            </span>
          </span>{' '}
          <span aria-hidden className="block h-1.5 bg-bg-3 rounded-full mt-2 overflow-hidden">
            <span className={`block h-full ${BAR[tone(d.pct)]}`} style={{ width: `${d.pct}%` }} />
          </span>
          <span className="block text-xs text-ink-mute mt-1.5">
            {missed.length ? `${missed.length} missed` : 'Nothing missed'}
            {flagged.length > 0 && ` · ${flagged.length} flagged`}
          </span>
        </span>
      </summary>
      <div className="mx-4 sm:ml-10 mb-4 pt-4 border-t border-line space-y-4">
        <div>
          <h3 className={`${LABEL} mb-2`}>Objectives in this mock</h3>
          <ul className="space-y-1 text-sm">
            {byId.map(([id, o]) => (
              <li key={id} className="flex items-baseline justify-between gap-3">
                <span className="text-ink-dim">
                  <span className="font-mono text-ink-mute">{id}</span> {o.title}
                </span>
                <span className={`shrink-0 font-mono ${TEXT[tone(Math.round((o.correct / o.total) * 100))]}`}>
                  {o.correct} of {o.total}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <QuestionLinks title="Missed" results={missed} onOpen={(id) => onOpen(id, 'missed')} />
        {flagged.length > 0 && <QuestionLinks title="Flagged" results={flagged} onOpen={(id) => onOpen(id, 'flagged')} />}
      </div>
    </details>
  )
}

// One line of the question for a list: a case-study sub-question without the shared context before it,
// and the markup dropped, so a stem that introduces a snippet still shows the snippet.
function stemPreview(q: FlatQuestion) {
  const stem = q.stem.startsWith('[Case study context]') ? q.stem.split('\n\n').at(-1)! : q.stem
  return plainText(stem).replace(/\s+/g, ' ').trim()
}

function QuestionLinks({
  title,
  results,
  onOpen,
}: {
  title: string
  results: MockResult[]
  onOpen: (questionId: string) => void
}) {
  return (
    <div>
      <h3 className={`${LABEL} mb-2`}>
        {title} ({results.length})
      </h3>
      {results.length === 0 ? (
        <p className="text-sm text-ink-dim">Nothing missed in this domain.</p>
      ) : (
        <ul className="space-y-1.5">
          {results.map((r) => (
            <li key={r.question.id}>
              <button
                onClick={() => onOpen(r.question.id)}
                aria-label={`Question ${r.number}, ${verdictText(r)}: ${stemPreview(r.question)}`}
                className="w-full text-left flex items-start gap-3 rounded-lg border border-line p-2.5 text-sm transition hover:border-line-strong hover:bg-bg-3 cursor-pointer"
              >
                <span className="chip chip-accent shrink-0 font-mono">Q{r.number}</span>
                <span className="min-w-0 flex-1 text-ink-dim leading-snug line-clamp-2">{stemPreview(r.question)}</span>
                <Verdict result={r} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const verdictText = (r: MockResult) => (r.correct ? 'Correct' : r.given ? 'Incorrect' : 'Not answered')

function Verdict({ result }: { result: MockResult }) {
  return (
    <span className={`chip shrink-0 ${result.correct ? 'chip-good' : 'chip-bad'}`}>
      {result.correct ? '✓' : '✕'} {verdictText(result)}
    </span>
  )
}

function ReviewItem({ result }: { result: MockResult }) {
  const q = result.question
  return (
    <article
      id={reviewId(q.id)}
      tabIndex={-1}
      aria-label={`Question ${result.number}`}
      className={`card p-5 scroll-mt-4 ${result.correct ? '' : 'border-bad/40'}`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="chip chip-accent font-mono">Q{result.number}</span>
        <Verdict result={result} />
        {result.flagged && <span className="chip chip-purple">⚑ Flagged</span>}
        <span className="chip">{TYPE_LABEL[q.type] ?? q.type}</span>
      </header>
      <p className="mt-3 text-xs text-ink-mute leading-relaxed">
        <span className="block">{domainName({ id: q.domainId, title: q.domainTitle })}</span>
        <span className="block">
          Objective {q.objectiveId} · {q.objectiveTitle}
        </span>
      </p>
      <div className="mt-2 text-base text-ink leading-relaxed whitespace-pre-line wrap-break-word">
        <RichText text={q.stem} />
      </div>
      <div className="mt-4">
        <AnswerComparison result={result} />
      </div>
      {q.explanation && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className={`${LABEL} mb-1`}>Explanation</h3>
          <p className="text-sm text-ink-dim leading-relaxed whitespace-pre-line">
            <RichText text={q.explanation} />
          </p>
        </div>
      )}
    </article>
  )
}

function AnswerComparison({ result: { question: q, given, correct } }: { result: MockResult }) {
  if (q.type === 'match_pairs' && q.pairs) return <PairsComparison pairs={q.pairs} given={given} />

  if (q.type === 'drag_drop_order') {
    const key = (q.correct ?? '').split(SEP).map((s) => s.trim())
    const yours = given ? given.split(SEP).map((s) => s.trim()) : []
    return (
      <Columns>
        <AnswerBlock label="Your order">
          {yours.length ? (
            <ol className="space-y-1.5">
              {yours.map((step, i) => {
                const at = key.indexOf(step)
                return (
                  <Row key={step} tone={at === i ? HIT : MISS} badge={i + 1} mark={at === i}>
                    {step}
                    {at !== i && <span className="block mt-0.5 text-xs text-ink-mute">Belongs at position {at + 1}</span>}
                  </Row>
                )
              })}
            </ol>
          ) : (
            <NotAnswered />
          )}
        </AnswerBlock>
        <AnswerBlock label="Correct order">
          <ol className="space-y-1.5">
            {key.map((step, i) => (
              <Row key={step} tone="border-line" badge={i + 1}>
                {step}
              </Row>
            ))}
          </ol>
        </AnswerBlock>
      </Columns>
    )
  }

  if (q.type === 'fill_blank') {
    return (
      <Columns>
        <AnswerBlock label="Your answer">
          {given ? (
            <ul>
              <Row tone={correct ? HIT : MISS} mark={correct}>
                <code className="text-ink">{given}</code>
              </Row>
            </ul>
          ) : (
            <NotAnswered />
          )}
        </AnswerBlock>
        <AnswerBlock label="Accepted answer">
          <ul>
            <Row tone={HIT}>
              <code className="text-ink">{q.correct}</code>
            </Row>
          </ul>
          <p className="mt-1 text-xs text-ink-mute">Case and extra spaces are ignored.</p>
        </AnswerBlock>
      </Columns>
    )
  }

  // Single answer and multi-select: stored as letters ("B", "A,C,D"); show each option's text.
  const picked = letters(given)
  const key = letters(q.correct)
  return (
    <Columns>
      <AnswerBlock label="Your answer">
        {picked.length ? (
          <ul className="space-y-1.5">
            {picked.map((l) => (
              <Row key={l} tone={key.includes(l) ? HIT : MISS} badge={l} mark={key.includes(l)}>
                <RichText text={optionText(q, l)} />
              </Row>
            ))}
          </ul>
        ) : (
          <NotAnswered />
        )}
      </AnswerBlock>
      <AnswerBlock label={key.length > 1 ? `Correct answer · ${key.length} options` : 'Correct answer'}>
        <ul className="space-y-1.5">
          {key.map((l) => (
            <Row key={l} tone={HIT} badge={l}>
              <RichText text={optionText(q, l)} />
              {q.type === 'multi_select' && picked.length > 0 && !picked.includes(l) && (
                <span className="block mt-0.5 text-xs text-warn">You did not select this</span>
              )}
            </Row>
          ))}
        </ul>
      </AnswerBlock>
    </Columns>
  )
}

function PairsComparison({ pairs, given }: { pairs: MatchPair[]; given?: string }) {
  const picks = matchSelections(given ?? '', pairs.length)
  const hits = picks.filter((pick, item) => pick === item).length
  return (
    <div className="@container">
      <h3 className={`${LABEL} mb-1.5`}>
        Your matches · {hits} of {pairs.length} correct
      </h3>
      <ul className="space-y-1.5">
        {pairs.map((p, item) => {
          const pick = picks[item]
          const hit = pick === item
          return (
            <li key={p.left} className={`rounded-lg border p-3 text-sm ${hit ? HIT : MISS}`}>
              <div className="text-ink font-medium leading-snug wrap-break-word">
                <RichText text={p.left} />
              </div>
              <div className="grid gap-x-4 gap-y-1 mt-1.5 @xl:grid-cols-2">
                <div className="leading-snug wrap-break-word">
                  <span className="text-xs text-ink-mute">Your match: </span>
                  <span className="text-ink-dim">
                    {pick === undefined ? 'Not matched' : <RichText text={pairs[pick].right} />}
                  </span>{' '}
                  <Mark ok={hit} />
                </div>
                {!hit && (
                  <div className="leading-snug wrap-break-word">
                    <span className="text-xs text-ink-mute">Correct match: </span>
                    <span className="text-good">
                      <RichText text={p.right} />
                    </span>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const letters = (s = '') =>
  s
    .split(',')
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean)

// Options read "B. text"; one without a letter prefix takes its position's letter.
function optionText(q: FlatQuestion, letter: string) {
  const options = q.options ?? []
  const i = options.findIndex((o, idx) => (o.match(/^([A-Z])\.\s*/)?.[1] ?? String.fromCharCode(65 + idx)) === letter)
  return i === -1 ? letter : options[i].replace(/^[A-Z]\.\s*/, '')
}

function Columns({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-4 @xl:grid-cols-2">{children}</div>
    </div>
  )
}

function AnswerBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className={`${LABEL} mb-1.5`}>{label}</h3>
      {children}
    </div>
  )
}

function Row({
  tone,
  badge,
  mark,
  children,
}: {
  tone: string
  badge?: ReactNode
  mark?: boolean
  children: ReactNode
}) {
  return (
    <li className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-sm ${tone}`}>
      {badge !== undefined && (
        <span className="grid place-items-center shrink-0 w-6 h-6 rounded-md bg-bg-3 border border-line text-xs font-mono text-ink-dim">
          {badge}
        </span>
      )}
      <span className="min-w-0 flex-1 self-center text-ink-dim leading-snug wrap-break-word">{children}</span>
      {mark !== undefined && <Mark ok={mark} />}
    </li>
  )
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <span className={`shrink-0 self-center text-sm ${ok ? 'text-good' : 'text-bad'}`}>
      <span aria-hidden>{ok ? '✓' : '✕'}</span>
      <span className="sr-only">{ok ? 'correct' : 'incorrect'}</span>
    </span>
  )
}

function NotAnswered() {
  return <p className="text-sm text-ink-mute italic">Not answered</p>
}
