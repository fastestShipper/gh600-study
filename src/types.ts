export type QuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'drag_drop_order'
  | 'fill_blank'
  | 'match_pairs'
  | 'case_study'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface MatchPair {
  left: string
  right: string
}

export interface Question {
  type: QuestionType
  stem: string
  options?: string[]
  pairs?: MatchPair[]
  correct?: string
  explanation?: string
  domain: string
  difficulty?: Difficulty
  sub_questions?: Question[]
}

export interface Objective {
  id: string
  title: string
  subtopics?: string[]
  key_concepts?: string[]
  key_terminology?: string[]
  common_pitfalls?: string[]
  github_features_tested?: string[]
  questions?: Question[]
}

export interface Domain {
  domain_id: number
  title: string
  weight_pct: string
  objectives: Objective[]
}

export interface Meta {
  exam_code: string
  exam_title: string
  credential: string
  duration_minutes: number
  passing_score: number
  domains_count: number
  audience_profile: string
  core_responsibilities: string[]
  prerequisite_experience: string[]
  primary_sources: string[]
  question_style_notes: string[]
  glossary: Record<string, string>
  github_features_index: string[]
}

export interface DataShape {
  meta: Meta
  domains: Domain[]
}

export interface FlatQuestion extends Question {
  id: string
  domainId: number
  domainTitle: string
  objectiveId: string
  objectiveTitle: string
}

export interface AttemptAnswer {
  id: string
  given: string
  correct: boolean
  ts: number
}

export interface MockExamRun {
  startedAt: number
  finishedAt?: number
  questionIds: string[]
  answers: Record<string, string>
  // Questions marked to revisit during this mock; independent of Practice flags.
  flagged?: Record<string, true>
  score?: number
  byDomain?: Record<number, { correct: number; total: number }>
}

export interface AppState {
  planChecks: Record<string, boolean>
  reviewed: Record<string, boolean>
  questionAttempts: Record<string, AttemptAnswer[]>
  flagged: Record<string, true>
  mockRuns: MockExamRun[]
  activeMock?: MockExamRun
}
