import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { FlatQuestion, MatchPair } from '../types'
import { isCorrect, matchSelections, shuffle } from '../lib/exam'
import { plainText } from '../lib/richText'
import RichText from './RichText'
import StepOrder from './StepOrder'

interface QuestionCardProps {
  question: FlatQuestion
  index: number
  total: number
  mode: 'study' | 'mock'
  initialAnswer?: string
  showSolutionInitially?: boolean
  onAnswer?: (qid: string, given: string, correct: boolean) => void
  onNext?: () => void
  onPrev?: () => void
  onFlag?: (qid: string) => void
  flagged?: boolean
  canPrev?: boolean
}

const DIFF_LABEL: Record<string, string> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
}

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Single answer',
  multi_select: 'Multi-select (count is in the question)',
  drag_drop_order: 'Order the steps',
  fill_blank: 'Fill in the blank',
  match_pairs: 'Match pairs',
  case_study: 'Case study (check context above)',
}

// The answer an ordering question starts from: what the list shows is what gets checked,
// and it is never already solved.
function scrambledOrder(question: FlatQuestion): string {
  const order = shuffle(question.options ?? [])
  const joined = order.join(' -> ')
  if (order.length > 1 && isCorrect(question, joined)) return [...order.slice(1), order[0]].join(' -> ')
  return joined
}

// Next, Previous and a mock save remount the card (parents key it by question id), which drops
// keyboard focus on <body>. The outgoing card flags the handoff and the next card to mount clears
// it, taking focus only if focus really was lost, so a stray flag can never steal focus.
let focusIncomingCard = false
const focusLost = () => document.activeElement === document.body

export default function QuestionCard({
  question,
  index,
  total,
  mode,
  initialAnswer,
  showSolutionInitially,
  onAnswer,
  onNext,
  onPrev,
  onFlag,
  flagged,
  canPrev,
}: QuestionCardProps) {
  // Parents key this card by question id, so state starts fresh for every question.
  const [answer, setAnswer] = useState<string>(
    () => initialAnswer ?? (question.type === 'drag_drop_order' ? scrambledOrder(question) : ''),
  )
  // A match is answered once every item has a pick (so an old "self-correct" self-grade reads as
  // unanswered); the other types once there is any answer.
  const pairCount = question.pairs?.length ?? 0
  const picks = question.type === 'match_pairs' ? matchSelections(answer, pairCount) : []
  const answered = question.type === 'match_pairs' ? pairCount > 0 && !picks.includes(undefined) : !!answer
  // Graded in study mode. A mock never reveals: saving records the answer and moves on.
  const [revealed, setRevealed] = useState<boolean>(!!showSolutionInitially)
  const saved = mode === 'mock' && answered && answer === initialAnswer
  const headingRef = useRef<HTMLHeadingElement>(null)
  const verdictRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handoff = focusIncomingCard
    focusIncomingCard = false
    if (handoff && focusLost()) headingRef.current?.focus()
  }, [])

  // "Check answer" unmounts once graded; land focus on the verdict instead of <body>.
  useEffect(() => {
    if (revealed && focusLost()) verdictRef.current?.focus()
  }, [revealed])

  const navigate = (go?: () => void) => {
    if (!go) return
    focusIncomingCard = true
    go()
  }
  const isLast = index >= total - 1

  const correct = useMemo(
    () => (answer ? isCorrect(question, answer) : false),
    [answer, question],
  )

  const submit = () => {
    if (!answered) return
    onAnswer?.(question.id, answer, isCorrect(question, answer))
    if (mode === 'study') setRevealed(true)
    else if (!isLast) navigate(onNext)
  }

  let verdict = correct ? '✓ Correct' : '✕ Incorrect'
  if (question.type === 'match_pairs') {
    const hits = picks.filter((pick, item) => pick === item).length
    verdict += ` · ${hits} of ${pairCount} pairs`
  }

  const optionLetter = (i: number) => String.fromCharCode(65 + i)
  const isLetter = (raw: string, letter: string) => {
    if (question.type === 'multi_select') {
      const set = new Set(raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
      return set.has(letter)
    }
    return raw.trim().toUpperCase() === letter
  }

  const toggleLetter = (letter: string) => {
    if (revealed) return
    if (question.type === 'multi_select') {
      const set = new Set(answer.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
      if (set.has(letter)) set.delete(letter)
      else set.add(letter)
      setAnswer(Array.from(set).sort().join(','))
    } else {
      setAnswer(letter)
    }
  }

  const correctLetters = (question.correct || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())

  return (
    <article className="card p-6 fade-up">
      <header className="flex flex-wrap items-center gap-2 mb-4">
        <div className="chip chip-accent">
          {index + 1} / {total}
        </div>
        <div className="chip">D{question.domainId} · {question.objectiveId}</div>
        <div className="chip">{TYPE_LABEL[question.type] ?? question.type}</div>
        {question.difficulty && (
          <div
            className={`chip ${
              question.difficulty === 'easy'
                ? 'chip-good'
                : question.difficulty === 'medium'
                ? 'chip-warn'
                : 'chip-bad'
            }`}
          >
            {DIFF_LABEL[question.difficulty] ?? question.difficulty}
          </div>
        )}
        <div className="flex-1" />
        {onFlag && (
          <button
            onClick={() => onFlag(question.id)}
            className={`btn btn-ghost text-xs ${flagged ? 'text-accent' : ''}`}
            aria-pressed={!!flagged}
            title="Flag to review later"
          >
            {flagged ? '⚑ Flagged' : '⚐ Flag'}
          </button>
        )}
      </header>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-display text-ink leading-relaxed whitespace-pre-line mb-4 scroll-mt-28"
      >
        <RichText text={question.stem} />
      </h2>

      {/* Multiple choice & multi_select & case_study sub option list */}
      {(question.type === 'multiple_choice' ||
        question.type === 'multi_select' ||
        (question.type === 'case_study' && question.options)) && question.options && (
        <ul className="space-y-2">
          {question.options.map((opt, i) => {
            const letter = optionLetter(i)
            const labelMatch = opt.match(/^([A-Z])\.\s*/)
            const usedLetter = labelMatch ? labelMatch[1] : letter
            const isPicked = isLetter(answer, usedLetter)
            const isCorrectOpt = correctLetters.includes(usedLetter)
            const showState = revealed
            const tone = showState
              ? isCorrectOpt
                ? 'border-good/60 bg-good/10'
                : isPicked
                ? 'border-bad/60 bg-bad/10'
                : 'border-line'
              : isPicked
              ? 'border-accent bg-accent/10'
              : 'border-line hover:border-line-strong'
            return (
              <li key={i}>
                <button
                  onClick={() => toggleLetter(usedLetter)}
                  className={`w-full text-left border rounded-lg p-3 flex gap-3 transition enabled:cursor-pointer ${tone}`}
                  aria-pressed={isPicked}
                  disabled={revealed}
                >
                  <div
                    className={`shrink-0 w-7 h-7 rounded-md font-mono font-semibold grid place-items-center text-sm ${
                      isPicked
                        ? 'bg-accent text-bg'
                        : 'bg-bg-3 text-ink-dim border border-line-strong'
                    }`}
                  >
                    {usedLetter}
                  </div>
                  <div className="min-w-0 text-sm text-ink-dim leading-relaxed">
                    <RichText text={opt.replace(/^[A-Z]\.\s*/, '')} />
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {question.type === 'drag_drop_order' && question.options && (
        <StepOrder value={answer} graded={revealed} correct={question.correct} onChange={setAnswer} />
      )}

      {question.type === 'fill_blank' && (
        <div>
          <input
            type="text"
            placeholder="Type your answer…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={revealed}
            aria-label="Your answer"
            className="w-full font-mono"
          />
          {revealed && (
            <div className="mt-2 text-sm">
              <span className="text-ink-mute">Correct answer: </span>
              <code className="text-good">{question.correct}</code>
            </div>
          )}
        </div>
      )}

      {question.type === 'match_pairs' && question.pairs && (
        <MatchPairs
          questionId={question.id}
          pairs={question.pairs}
          value={answer}
          graded={revealed}
          onChange={setAnswer}
        />
      )}

      {/* Buttons are 44px tall on phone-sized screens, for touch. */}
      <footer className="mt-5 flex flex-wrap items-center gap-2">
        {!revealed && mode === 'study' && (
          <button onClick={submit} className="btn btn-primary max-sm:min-h-11" disabled={!answered}>
            Check answer
          </button>
        )}
        {mode === 'mock' && (
          <button onClick={submit} className="btn max-sm:min-h-11" disabled={!answered}>
            Save and continue
          </button>
        )}
        {question.type === 'match_pairs' && !revealed && (
          <span className="text-xs text-ink-mute">
            {picks.filter((pick) => pick !== undefined).length} of {pairCount} matched
          </span>
        )}
        {saved && <div className="chip chip-good">✓ Saved</div>}
        {revealed && mode === 'study' && (
          <div ref={verdictRef} tabIndex={-1} className={`chip ${correct ? 'chip-good' : 'chip-bad'}`}>
            {verdict}
          </div>
        )}
        {((canPrev && onPrev) || onNext) && (
          // One group, so on a narrow card Previous and Next move to a new line together instead of
          // Next wrapping on its own; the pair splits only if the card is narrower than both.
          <nav aria-label="Question navigation" className="flex flex-wrap gap-2">
            {canPrev && onPrev && (
              <button onClick={() => navigate(onPrev)} className="btn btn-ghost max-sm:min-h-11">
                ◂ Previous
              </button>
            )}
            {onNext && (
              <button onClick={() => navigate(onNext)} className="btn btn-ghost max-sm:min-h-11" disabled={isLast}>
                Next ▸
              </button>
            )}
          </nav>
        )}
      </footer>

      {revealed && question.explanation && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="text-xs uppercase tracking-wider text-ink-mute font-semibold mb-1">
            Explanation
          </div>
          <p className="text-sm text-ink-dim leading-relaxed whitespace-pre-line">
            <RichText text={question.explanation} />
          </p>
        </div>
      )}
    </article>
  )
}

// Each question's answer order for this page session: shuffled once, then the same on every visit,
// and never the key's own order (where item n's match would sit at position n).
const answerOrders = new Map<string, number[]>()
function answerOrder(questionId: string, size: number): number[] {
  let order = answerOrders.get(questionId)
  if (!order) {
    order = shuffle(Array.from({ length: size }, (_, choice) => choice))
    if (size > 1 && order.every((choice, i) => choice === i)) order = [...order.slice(1), order[0]]
    answerOrders.set(questionId, order)
  }
  return order
}

// Pick an item, then its answer. Items are a native radio group choosing which item the next answer
// goes to; answers are native buttons. A pair shows one number on both sides and the answer's text on
// its item, each control's accessible name states its pair, and every change is announced.
function MatchPairs({
  questionId,
  pairs,
  value,
  graded,
  onChange,
}: {
  questionId: string
  pairs: MatchPair[]
  value: string
  graded: boolean
  onChange: (value: string) => void
}) {
  const group = useId()
  const [order] = useState(() => answerOrder(questionId, pairs.length))
  const picks = matchSelections(value, pairs.length)
  // The item the next answer goes to: the first unmatched one to start with.
  const [active, setActive] = useState(() => Math.max(0, picks.indexOf(undefined)))
  const [announcement, setAnnouncement] = useState('')
  const itemName = (item: number) => `${item + 1}. ${plainText(pairs[item].left)}`
  const answerName = (choice: number) => plainText(pairs[choice].right)

  const choose = (choice: number) => {
    const next = [...picks]
    const owner = next.indexOf(choice)
    const previous = picks[active]
    let target = active
    let message: string
    if (owner === active) {
      next[active] = undefined
      message = `Removed the match for ${itemName(active)}.`
    } else {
      next[active] = choice
      if (owner === -1) {
        message = `Matched ${itemName(active)} with ${answerName(choice)}.`
        // On to the next unmatched item, wrapping; stay put once every item is matched.
        const after = next.map((_, k) => (active + 1 + k) % next.length)
        target = after.find((item) => next[item] === undefined) ?? active
      } else {
        // Answers are used once: taking one from another item leaves that item to fill next.
        next[owner] = undefined
        message = `Moved ${answerName(choice)} from item ${owner + 1} to ${itemName(active)}. Item ${owner + 1} is now unmatched.`
        target = owner
      }
      if (previous !== undefined) message += ` ${answerName(previous)} is free again.`
      if (target !== active) message += ` Now choosing for ${itemName(target)}.`
    }
    setActive(target)
    setAnnouncement(message)
    onChange(next.map((pick) => pick ?? '').join(','))
  }

  return (
    <div className="@container">
      {!graded && (
        <p className="text-xs text-ink-mute mb-3">Pick an item, then its answer. Each answer is used once.</p>
      )}
      {/* Once graded, each item shows its match and the result, so the answer list is dropped. */}
      <div className={`grid gap-5 ${graded ? '' : '@xl:grid-cols-2 @xl:gap-6'}`}>
        <fieldset>
          <legend className="text-xs uppercase tracking-wider text-ink-mute font-semibold mb-2">Items</legend>
          <div className="space-y-2">
            {pairs.map((p, item) => {
              const pick = picks[item]
              const hit = pick === item
              const choosing = !graded && active === item
              const tone = graded
                ? hit
                  ? 'border-good/60 bg-good/10'
                  : 'border-bad/60 bg-bad/10'
                : choosing
                ? 'border-accent ring-1 ring-accent bg-accent/5'
                : pick === undefined
                ? 'border-dashed border-line-strong hover:border-accent/60'
                : 'border-line hover:border-line-strong'
              const state = pick === undefined ? 'not matched yet' : `matched with ${answerName(pick)}`
              const result = graded ? (hit ? ', correct' : `, incorrect, should be ${answerName(item)}`) : ''
              return (
                <label
                  key={p.left}
                  className={`block rounded-lg border p-3 text-sm transition has-[:enabled]:cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${tone}`}
                >
                  <input
                    type="radio"
                    name={group}
                    className="sr-only"
                    checked={active === item}
                    disabled={graded}
                    onChange={() => {
                      setActive(item)
                      // The radio announces the new target itself; drop the last pairing message.
                      setAnnouncement('')
                    }}
                    aria-label={`${itemName(item)}, ${state}${result}`}
                  />
                  <span aria-hidden className="flex gap-3">
                    <PairBadge filled={pick !== undefined}>{item + 1}</PairBadge>
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink font-medium leading-snug">
                        <RichText text={p.left} />
                      </span>
                      <span className={`block mt-1 leading-snug ${pick === undefined ? 'text-ink-mute' : 'text-ink-dim'}`}>
                        {pick === undefined ? (
                          'Not matched yet'
                        ) : (
                          <>
                            → <RichText text={pairs[pick].right} />
                          </>
                        )}
                      </span>
                      {graded &&
                        (hit ? (
                          <span className="block mt-1 text-xs text-good">✓ Matched correctly</span>
                        ) : (
                          <span className="block mt-1 text-xs text-ink-dim">
                            <span className="text-bad">✕</span> Should be:{' '}
                            <span className="text-good">
                              <RichText text={p.right} />
                            </span>
                          </span>
                        ))}
                    </span>
                    {choosing && <span className="chip chip-accent shrink-0 self-start">▸ Choosing</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        {!graded && (
          <div role="group" aria-label={`Answers, choosing for ${itemName(active)}`}>
            <div aria-hidden className="text-xs uppercase tracking-wider text-ink-mute font-semibold mb-2">
              Answers · choosing for {active + 1}
            </div>
            {/* Stacked, the items can be off screen: name the target right above the answers. */}
            <p aria-hidden className="@xl:hidden -mt-1 mb-2 text-sm text-ink leading-snug">
              <RichText text={pairs[active].left} />
            </p>
            <div className="space-y-2">
              {order.map((choice) => {
                const owner = picks.indexOf(choice)
                const selected = owner === active
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={selected}
                    aria-label={owner === -1 ? answerName(choice) : `${answerName(choice)}, matched with item ${owner + 1}`}
                    // A double-click or a held Enter would otherwise pair the answer, then move it on to the
                    // next target: act on the first click (detail 0 from the keyboard, 1 from a pointer) only.
                    onClick={(e) => e.detail < 2 && choose(choice)}
                    onKeyDown={(e) => e.repeat && e.preventDefault()}
                    className={`w-full text-left flex gap-3 rounded-lg border p-3 text-sm transition cursor-pointer ${
                      selected ? 'border-accent bg-accent/10' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <PairBadge filled={owner !== -1}>{owner === -1 ? '' : owner + 1}</PairBadge>
                    <span className="min-w-0 text-ink-dim leading-snug">
                      <RichText text={pairs[choice].right} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}

// The number both halves of a pair share; an empty dashed ring while unmatched.
function PairBadge({ filled, children }: { filled: boolean; children: ReactNode }) {
  return (
    <span
      className={`grid place-items-center shrink-0 w-6 h-6 rounded-full text-xs font-mono font-semibold ${
        filled ? 'bg-accent text-bg' : 'border border-dashed border-line-strong text-ink-mute'
      }`}
    >
      {children}
    </span>
  )
}
