import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppState, MockExamRun } from '../types'
import { buildMockSet, gradeMock, META, mockScore, QUESTION_BY_ID } from '../lib/exam'
import MockResults from './MockResults'
import QuestionCard from './QuestionCard'

interface MockExamPageProps {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
}

const QUESTIONS_PER_MOCK = 50

export default function MockExamPage({ state, setState }: MockExamPageProps) {
  const active = state.activeMock
  const [idx, setIdx] = useState(0)
  const [now, setNow] = useState(Date.now())
  // Set on submit, so the results take focus from the unmounted Submit button.
  const [justSubmitted, setJustSubmitted] = useState(false)

  useEffect(() => {
    if (!active || active.finishedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])

  const questions = useMemo(() => {
    if (!active) return []
    return active.questionIds.flatMap((id) => QUESTION_BY_ID.get(id) ?? [])
  }, [active])

  const startMock = () => {
    const set = buildMockSet(QUESTIONS_PER_MOCK)
    const run: MockExamRun = {
      startedAt: Date.now(),
      questionIds: set.map((q) => q.id),
      answers: {},
    }
    setIdx(0)
    setJustSubmitted(false)
    setState((prev) => ({ ...prev, activeMock: run }))
  }

  const abandonMock = () => {
    if (!confirm('Abandon this mock? It will not be saved as completed.')) return
    setState((prev) => ({ ...prev, activeMock: undefined }))
  }

  const submitAnswer = (qid: string, given: string) => {
    setState((prev) => {
      if (!prev.activeMock) return prev
      return {
        ...prev,
        activeMock: {
          ...prev.activeMock,
          answers: { ...prev.activeMock.answers, [qid]: given },
        },
      }
    })
  }

  const toggleFlag = (qid: string) => {
    setState((prev) => {
      if (!prev.activeMock) return prev
      const flagged = { ...prev.activeMock.flagged }
      if (flagged[qid]) delete flagged[qid]
      else flagged[qid] = true
      return { ...prev, activeMock: { ...prev.activeMock, flagged } }
    })
  }

  const finishMock = () => {
    if (!active) return
    const results = gradeMock(active)
    const byDomain: Record<number, { correct: number; total: number }> = {}
    for (const { question: q, correct: c } of results) {
      byDomain[q.domainId] = byDomain[q.domainId] ?? { correct: 0, total: 0 }
      byDomain[q.domainId].total += 1
      if (c) byDomain[q.domainId].correct += 1
    }
    const score = mockScore(results)
    const finished: MockExamRun = {
      ...active,
      finishedAt: Date.now(),
      score,
      byDomain,
    }
    setJustSubmitted(true)
    setState((prev) => ({
      ...prev,
      activeMock: undefined,
      mockRuns: [...prev.mockRuns, finished],
    }))
  }

  // Pre-mock screen
  if (!active) {
    const lastRun = state.mockRuns.slice(-1)[0]
    return (
      <div className="space-y-6 fade-up">
        <header>
          <div className="chip chip-accent mb-2">MOCK EXAM · SIMULATE THE REAL THING</div>
          <h1 className="text-3xl font-display font-semibold text-ink">
            {QUESTIONS_PER_MOCK} questions · 120 min · 700 / 1000 to pass
          </h1>
          <p className="text-ink-dim mt-1 max-w-2xl">
            Per-domain weights identical to the real exam. Timed. No explanations until you submit.
            When you finish you get the total score, a per-domain breakdown so you know where to
            drill next, and a review of every answer with its explanation.
          </p>
        </header>

        <div className="card p-6 border-accent/30">
          <h2 className="text-lg font-display font-semibold text-ink mb-3">
            Before you start, read this:
          </h2>
          <ul className="space-y-2 text-sm text-ink-dim leading-relaxed">
            <li>▸ Close Notion, Slack, WhatsApp. Run the mock like the real thing.</li>
            <li>▸ One attempt per day. Re-run it later with different questions (the bank rotates randomly each time).</li>
            <li>▸ If you finish early, do NOT review your answers — use the time to revisit the ones you flagged with ⚑.</li>
            <li>▸ After you submit you see what you missed with the explanation per error.</li>
          </ul>
          <div className="mt-5">
            <button onClick={startMock} className="btn btn-primary">
              Start the mock now
            </button>
          </div>
        </div>

        {lastRun?.finishedAt && <MockResults key={lastRun.startedAt} run={lastRun} focusOnMount={justSubmitted} />}
      </div>
    )
  }

  // Active mock
  const totalMs = META.duration_minutes * 60 * 1000
  const elapsed = now - active.startedAt
  const remaining = Math.max(0, totalMs - elapsed)
  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const isLast = idx === questions.length - 1
  const answered = Object.keys(active.answers).length
  const flaggedCount = Object.keys(active.flagged ?? {}).length

  if (remaining <= 0) {
    setTimeout(finishMock, 0)
  }

  const current = questions[idx]

  return (
    <div className="space-y-5 fade-up">
      <div className="card p-4 flex items-center justify-between sticky top-2 z-10 backdrop-blur bg-bg-1/80">
        <div>
          <div className="text-xs text-ink-mute font-mono">MOCK IN PROGRESS</div>
          <div className="text-sm text-ink">
            Question {idx + 1} / {questions.length} · Answered:{' '}
            <span className="text-good">{answered}</span>
          </div>
        </div>
        <div className={`text-2xl font-mono font-bold ${remaining < 10 * 60 * 1000 ? 'text-bad pulse' : 'text-ink'}`}>
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
        <button onClick={abandonMock} className="btn btn-danger text-xs">
          Abandon
        </button>
      </div>

      {current && (
        <QuestionCard
          key={current.id}
          question={current}
          index={idx}
          total={questions.length}
          mode="mock"
          initialAnswer={active.answers[current.id]}
          onAnswer={(qid, given) => submitAnswer(qid, given)}
          onFlag={toggleFlag}
          flagged={!!active.flagged?.[current.id]}
          onNext={() => setIdx((i) => Math.min(i + 1, questions.length - 1))}
          onPrev={() => setIdx((i) => Math.max(i - 1, 0))}
          canPrev={idx > 0}
        />
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="text-xs text-ink-mute">Jump:</div>
        {questions.map((q, i) => {
          const isAnswered = !!active.answers[q.id]
          const isFlagged = !!active.flagged?.[q.id]
          return (
            <button
              key={q.id}
              onClick={() => setIdx(i)}
              aria-label={`Question ${i + 1}${isAnswered ? ', answered' : ''}${isFlagged ? ', flagged' : ''}`}
              className={`relative w-8 h-8 rounded-md text-xs font-mono ${
                i === idx
                  ? 'bg-accent text-bg'
                  : isAnswered
                  ? 'bg-good/30 text-good border border-good/40'
                  : 'bg-bg-2 text-ink-dim border border-line'
              }`}
            >
              {i + 1}
              {isFlagged && (
                <span
                  aria-hidden
                  className="absolute -top-1.5 -right-1.5 grid place-items-center w-4 h-4 rounded-full bg-accent-2 text-[9px] text-white"
                >
                  ⚑
                </span>
              )}
            </button>
          )
        })}
      </div>

      {isLast && (
        <div className="card p-5 border-accent/40">
          <h2 className="font-display font-semibold text-ink">Ready to submit?</h2>
          <p className="text-sm text-ink-dim mt-1">
            You have answered {answered} of {questions.length}. Unanswered questions count as
            incorrect.{flaggedCount > 0 && ` You flagged ${flaggedCount} to revisit.`}
          </p>
          <button onClick={finishMock} className="btn btn-primary mt-3">
            Submit and see score
          </button>
        </div>
      )}
    </div>
  )
}
