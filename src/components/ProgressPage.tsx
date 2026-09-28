import type { Dispatch, SetStateAction } from 'react'
import type { AppState } from '../types'
import { ALL_QUESTIONS, DOMAINS, META, QUESTIONS_BY_DOMAIN } from '../lib/exam'
import { resetState } from '../lib/storage'
import RichText from './RichText'

interface ProgressPageProps {
  state: AppState
  setState: Dispatch<SetStateAction<AppState>>
}

export default function ProgressPage({ state, setState }: ProgressPageProps) {
  const totalQ = ALL_QUESTIONS.length
  const seen = Object.keys(state.questionAttempts).length
  const correctLast = Object.values(state.questionAttempts).filter(
    (atts) => atts[atts.length - 1]?.correct,
  ).length
  const flaggedCount = Object.keys(state.flagged).length
  const lastMock = state.mockRuns.slice(-1)[0]

  const byDomain = DOMAINS.map((d) => {
    const pool = QUESTIONS_BY_DOMAIN[d.domain_id] ?? []
    const seenIds = pool.filter((q) => state.questionAttempts[q.id]?.length)
    const correct = seenIds.filter(
      (q) => state.questionAttempts[q.id].slice(-1)[0].correct,
    )
    return {
      domain: d,
      total: pool.length,
      seen: seenIds.length,
      correct: correct.length,
      pct: seenIds.length ? Math.round((correct.length / seenIds.length) * 100) : 0,
    }
  })

  const wrongQuestions = ALL_QUESTIONS.filter((q) => {
    const last = state.questionAttempts[q.id]?.slice(-1)[0]
    return last && !last.correct
  })

  const reset = () => {
    if (!confirm('Erase ALL your progress? This cannot be undone.')) return
    resetState()
    setState({
      planChecks: {},
      reviewed: {},
      questionAttempts: {},
      flagged: {},
      mockRuns: [],
    })
  }

  return (
    <div className="space-y-6 fade-up">
      <header>
        <div className="chip chip-purple mb-2">MY PROGRESS</div>
        <h1 className="text-3xl font-display font-semibold text-ink">What you have nailed and what's left</h1>
        <p className="text-ink-dim mt-1 max-w-2xl">
          Where you are strong and where you are weak. Drill the weak spots.
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard kpi={`${seen}/${totalQ}`} label="Questions seen" />
        <KpiCard kpi={`${correctLast}`} label="Correct (last attempt)" />
        <KpiCard kpi={`${flaggedCount}`} label="Flagged to review" />
        <KpiCard
          kpi={lastMock?.score !== undefined ? `${lastMock.score}` : '—'}
          label="Latest mock score"
          subtle={
            lastMock?.score !== undefined
              ? lastMock.score >= META.passing_score
                ? 'WOULD PASS'
                : 'NOT YET'
              : 'no mock taken yet'
          }
        />
      </section>

      <section className="card p-5">
        <h2 className="font-display font-semibold text-ink mb-3">Performance by domain</h2>
        <div className="space-y-3">
          {byDomain.map((b) => {
            const pct = b.pct
            const barColor = pct >= 70 ? 'bg-good' : pct >= 50 ? 'bg-warn' : 'bg-bad'
            return (
              <div key={b.domain.domain_id}>
                <div className="flex justify-between text-xs text-ink-dim mb-1">
                  <span>
                    D{b.domain.domain_id}: {b.domain.title}{' '}
                    <span className="text-ink-mute">({b.domain.weight_pct})</span>
                  </span>
                  <span>
                    {b.correct} / {b.seen} seen · {b.total} total · {pct}%
                  </span>
                </div>
                <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {wrongQuestions.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display font-semibold text-ink mb-3">
            Recent misses ({wrongQuestions.length})
          </h2>
          <p className="text-sm text-ink-dim mb-3">
            These are the questions you missed on your latest attempt. Open <em>Practice</em> with
            the "Missed" mode to drill them.
          </p>
          <ul className="space-y-2 text-sm">
            {wrongQuestions.slice(0, 20).map((q) => (
              <li key={q.id} className="border border-bad/30 rounded-lg p-3 bg-bad/5">
                <div className="text-[11px] font-mono text-ink-mute">
                  D{q.domainId} · {q.objectiveId}
                </div>
                <div className="text-ink leading-snug">
                  <RichText text={q.stem.split('\n')[0]} />
                </div>
              </li>
            ))}
            {wrongQuestions.length > 20 && (
              <li className="text-xs text-ink-mute">
                …and {wrongQuestions.length - 20} more. Open <em>Practice</em> with the "Missed" mode.
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-display font-semibold text-ink mb-3">
          Mock history ({state.mockRuns.length})
        </h2>
        {state.mockRuns.length === 0 ? (
          <p className="text-sm text-ink-dim">No completed mock exams yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {state.mockRuns
              .slice()
              .reverse()
              .map((r, i) => (
                <li
                  key={r.startedAt}
                  className="border border-line rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-ink font-mono">
                      Mock #{state.mockRuns.length - i}
                    </div>
                    <div className="text-xs text-ink-mute">
                      {new Date(r.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div
                      className={`chip ${
                        (r.score ?? 0) >= META.passing_score ? 'chip-good' : 'chip-bad'
                      }`}
                    >
                      {r.score} / 1000
                    </div>
                    <div className="chip">
                      {(r.score ?? 0) >= META.passing_score ? 'WOULD PASS' : 'WOULD NOT PASS'}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="card p-5 border-bad/30">
        <h2 className="font-display font-semibold text-ink mb-1">Reset progress</h2>
        <p className="text-xs text-ink-mute mb-3">
          Erases all your answers, flags, and mock history. Cannot be undone.
        </p>
        <button onClick={reset} className="btn btn-danger text-xs">
          Erase all my progress
        </button>
      </section>
    </div>
  )
}

function KpiCard({
  kpi,
  label,
  subtle,
}: {
  kpi: string
  label: string
  subtle?: string
}) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-display font-bold text-ink">{kpi}</div>
      <div className="text-xs text-ink-dim">{label}</div>
      {subtle && <div className="text-[11px] text-ink-mute mt-0.5">{subtle}</div>}
    </div>
  )
}
