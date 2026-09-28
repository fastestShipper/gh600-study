import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { EXAM_DATE } from '../config'
import Sidebar from './Sidebar'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// Local calendar dates relative to the configured exam, so the test follows config.ts.
const exam = new Date(EXAM_DATE)
const dayOffset = (days: number) =>
  new Date(exam.getFullYear(), exam.getMonth(), exam.getDate() + days, 12)

function renderAt(now: Date) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
  render(<Sidebar route="home" setRoute={() => {}} />)
}

describe('sidebar: exam countdown', () => {
  it('counts calendar days until the exam', () => {
    renderAt(dayOffset(-3))
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('days until exam')).toBeTruthy()
  })

  it('says "1 day" the day before the exam', () => {
    renderAt(dayOffset(-1))
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('day until exam')).toBeTruthy()
  })

  it('says the exam is today on the exam day, even before it starts', () => {
    renderAt(new Date(exam.getFullYear(), exam.getMonth(), exam.getDate(), 0, 1))
    expect(screen.getByText('Exam today')).toBeTruthy()
    expect(screen.queryByText(/until exam/)).toBeNull()
  })

  it('shows the passed exam date without a zero countdown', () => {
    renderAt(dayOffset(58))
    expect(screen.getByText('Exam date passed')).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByText(/until exam/)).toBeNull()
    const date = exam.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
    expect(screen.getByText(new RegExp(date))).toBeTruthy()
  })
})
