import { useEffect, useRef } from 'react'
import { splitFences, splitInline } from '../lib/richText'

// Bank text with its markup rendered: a fenced snippet as a code block that keeps its lines and
// indentation and scrolls sideways inside itself, `inline` spans as inline code. Prose keeps its line
// breaks through the caller's whitespace-pre-line. Only phrasing elements, so it fits in a heading or a
// paragraph. An overflowing code block becomes a tab stop, so a fence does not belong inside a button:
// the bank's options and match pairs carry inline code only.
export default function RichText({ text }: { text: string }) {
  return splitFences(text).map((part, i) =>
    i % 2 ? (
      <CodeBlock key={i} code={part} />
    ) : (
      splitInline(part).map((bit, j) =>
        j % 2 ? (
          <code
            key={`${i}-${j}`}
            className="font-mono text-[0.875em] px-1 py-px rounded bg-bg-3 border border-line box-decoration-clone wrap-break-word"
          >
            {bit}
          </code>
        ) : (
          bit
        ),
      )
    ),
  )
}

function CodeBlock({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null)
  // A snippet wider than its box scrolls inside it; only then is it a tab stop, so the keyboard can scroll it.
  useEffect(() => {
    const block = ref.current
    if (!block || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (block.scrollWidth > block.clientWidth) block.setAttribute('tabindex', '0')
      else block.removeAttribute('tabindex')
    })
    observer.observe(block)
    return () => observer.disconnect()
  }, [])
  return (
    <code
      ref={ref}
      className="block my-2 font-mono font-normal text-[13px] leading-relaxed text-ink whitespace-pre overflow-x-auto scroll-thin bg-bg-3 border border-line rounded-lg p-3"
    >
      {code}
    </code>
  )
}
