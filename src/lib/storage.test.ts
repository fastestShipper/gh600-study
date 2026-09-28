import { afterEach, describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { loadState } from './storage'

afterEach(() => localStorage.clear())

describe('loadState', () => {
  it('drops self-grades that an old version saved for match pairs in an unfinished mock', () => {
    const attempt = { id: 'd1-1.1-7', given: 'self-correct', correct: true, ts: 1 }
    const finished = { startedAt: 1, finishedAt: 2, questionIds: ['d1-1.1-7'], answers: { 'd1-1.1-7': 'self-correct' }, score: 1000 }
    const saved: AppState = {
      planChecks: {},
      reviewed: {},
      questionAttempts: { 'd1-1.1-7': [attempt] },
      flagged: {},
      mockRuns: [finished],
      activeMock: {
        startedAt: 3,
        questionIds: ['d1-1.1-7', 'd1-1.3-18', 'd1-1.1-1'],
        answers: { 'd1-1.1-7': 'self-correct', 'd1-1.3-18': 'self-wrong', 'd1-1.1-1': 'B' },
      },
    }
    localStorage.setItem('gh600-cram-v1', JSON.stringify(saved))

    const state = loadState()

    // Asked again rather than silently graded wrong; other answers are untouched.
    expect(state.activeMock?.answers).toEqual({ 'd1-1.1-1': 'B' })
    // Finished results and practice history are records of what happened, so they stay.
    expect(state.mockRuns).toEqual([finished])
    expect(state.questionAttempts).toEqual({ 'd1-1.1-7': [attempt] })
  })

  it('keeps the rest of the saved progress when an unfinished mock has no answers yet', () => {
    const attempt = { id: 'd1-1.1-1', given: 'B', correct: true, ts: 1 }
    const saved = { questionAttempts: { 'd1-1.1-1': [attempt] }, activeMock: { startedAt: 3, questionIds: ['d1-1.1-1'] } }
    localStorage.setItem('gh600-cram-v1', JSON.stringify(saved))

    const state = loadState()

    expect(state.questionAttempts).toEqual({ 'd1-1.1-1': [attempt] })
    expect(state.activeMock?.answers).toEqual({})
  })
})
