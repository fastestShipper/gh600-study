import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import RichText from './RichText'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const STEM = 'Read this snippet:\n\n```yaml\nconcurrency:\n  group: ci\n  cancel-in-progress: true\n```\n\nWhich `key` cancels older runs?'

describe('RichText', () => {
  it('sets a fenced snippet as a code block with its lines and indentation, and inline code inline', () => {
    const { container } = render(
      <h2>
        <RichText text={STEM} />
      </h2>,
    )
    const [block, inline] = container.querySelectorAll('code')
    expect(block.textContent).toBe('concurrency:\n  group: ci\n  cancel-in-progress: true')
    expect(block.className).toContain('whitespace-pre')
    expect(block.className).toContain('overflow-x-auto')
    expect(inline.textContent).toBe('key')
    expect(container.textContent).toBe('Read this snippet:concurrency:\n  group: ci\n  cancel-in-progress: trueWhich key cancels older runs?')
    // Only phrasing content, so it is valid inside the heading it sits in.
    expect(container.querySelector('h2 :is(div, p, pre)')).toBeNull()
  })

  it('makes a snippet a tab stop only while it is wider than its box, so the keyboard can scroll it', () => {
    const observers: (() => void)[] = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      function ResizeObserver(onResize: () => void) {
        return { observe: () => observers.push(onResize), disconnect }
      },
    )
    const { container, unmount } = render(<RichText text={'```\nsome code\n```'} />)
    const block = container.querySelector('code')!
    const size = (scrollWidth: number) => {
      Object.defineProperty(block, 'scrollWidth', { value: scrollWidth, configurable: true })
      Object.defineProperty(block, 'clientWidth', { value: 300, configurable: true })
      act(() => observers.forEach((resize) => resize()))
    }
    size(600)
    expect(block.getAttribute('tabindex')).toBe('0')
    size(300)
    expect(block.hasAttribute('tabindex')).toBe(false)
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('sets each of several snippets as its own block', () => {
    const { container } = render(<RichText text={'before\n```\na\n```\nmid\n```\nb\n```\nafter'} />)
    expect([...container.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['a', 'b'])
    expect(container.textContent).toBe('beforeamidbafter')
  })
})
