import type { AppState } from '../types'

const KEY = 'gh600-cram-v1'

const defaultState: AppState = {
  planChecks: {},
  reviewed: {},
  questionAttempts: {},
  flagged: {},
  mockRuns: [],
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw) as Partial<AppState>
    // Match pairs were once self-graded ("self-correct"/"self-wrong"). Such an answer in an unfinished
    // mock is dropped, so the question is asked again instead of being graded wrong unseen.
    if (parsed.activeMock) {
      const answers = Object.entries(parsed.activeMock.answers ?? {})
      parsed.activeMock.answers = Object.fromEntries(
        answers.filter(([, given]) => given !== 'self-correct' && given !== 'self-wrong'),
      )
    }
    return { ...defaultState, ...parsed }
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* swallow quota errors */
  }
}

export function resetState(): void {
  localStorage.removeItem(KEY)
}
