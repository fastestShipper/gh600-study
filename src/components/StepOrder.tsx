import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

// How an ordering answer is stored: the steps in the order shown, joined by this.
const SEP = ' -> '
// A press has to travel this far (px) before it becomes a drag, so a click never moves a step.
const DRAG_THRESHOLD = 4
// Within this distance (px) of the top or bottom of the window, a drag scrolls the page.
const SCROLL_EDGE = 48

interface Drag {
  from: number // the dragged step's place in the list
  to: number // where it lands if dropped now
  dy: number // how far the row has been dragged, kept within the list
  tops: number[] // each row's top when the drag began, from the top of the list
  heights: number[]
  gap: number
}

// The list with one item taken out and put back in at `to`, the rest closing up around it.
function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

// Lets an identifier such as subagent.completed or services/payments/* wrap after a dot or slash, so a
// narrow column breaks it there rather than mid-word.
function Wrappable({ text }: { text: string }) {
  return text.split(/(?<=[./])/).map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
    </Fragment>
  ))
}

// Put the steps in order by dragging a row (anywhere on it with a mouse, by its handle on touch) or
// by picking its position number. The number is a native select, so keyboard, screen reader and
// single-tap use need nothing custom; the handle is a pointer shortcut and hidden from them.
export default function StepOrder({
  value,
  graded,
  correct,
  onChange,
}: {
  value: string
  graded: boolean
  correct?: string
  onChange: (value: string) => void
}) {
  const order = value.split(SEP).map((s) => s.trim())
  const key = correct?.split(SEP).map((s) => s.trim()) ?? []
  const [drag, setDrag] = useState<Drag | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const correctLabel = useId()
  const rows = useRef(new Map<string, HTMLLIElement>())
  // Where each row was just before a reorder, so it can slide from there to its new place.
  const before = useRef<Map<string, number> | null>(null)
  // The picker that made the last move: moving its row in the page can drop focus in some browsers.
  const picker = useRef<HTMLSelectElement | null>(null)
  // Stops listening to the press or drag under way, if there is one.
  const release = useRef<(() => void) | null>(null)

  // Stop listening once the question is graded (a drag can still be held when it is) or goes away.
  useEffect(() => () => release.current?.(), [graded])

  useLayoutEffect(() => {
    if (picker.current && document.activeElement === document.body) picker.current.focus()
    picker.current = null
    const from = before.current
    before.current = null
    if (!from || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    for (const [step, top] of from) {
      const row = rows.current.get(step)!
      const delta = top - row.getBoundingClientRect().top
      // animate is missing outside real browsers (jsdom), where there is nothing to see anyway.
      if (delta) row.animate?.([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 150, easing: 'ease-out' })
    }
  })

  const notePositions = () => {
    before.current = new Map(order.map((step) => [step, rows.current.get(step)!.getBoundingClientRect().top]))
  }

  const move = (from: number, to: number) => {
    onChange(moveItem(order, from, to).join(SEP))
    setAnnouncement(`${order[from]} moved from position ${from + 1} to position ${to + 1} of ${order.length}.`)
  }

  const press = (e: ReactPointerEvent, from: number) => {
    const target = e.target as Element
    if (release.current || !e.isPrimary || e.button !== 0 || target.closest('select')) return
    // Touch and pen drag from the handle only, so a swipe anywhere else on the row scrolls the page.
    if (e.pointerType !== 'mouse' && !target.closest('[data-handle]')) return

    const els = order.map((step) => rows.current.get(step)!)
    // Layout positions: unlike drawn boxes, they ignore a slide still running from the last move.
    const tops = els.map((el) => el.offsetTop - els[0].offsetTop)
    const heights = els.map((el) => el.offsetHeight)
    const gap = els.length > 1 ? tops[1] - heights[0] : 0
    const middles = tops.map((top, i) => top + heights[i] / 2)
    const last = order.length - 1
    const { pointerId, clientY: startY } = e
    const startScroll = window.scrollY
    let pointerY = startY
    let dragging = false
    let lag = 0 // how far the row was drawn from its place when picked up
    let to = from
    let frame = 0

    const follow = () => {
      // Measured in the list's own coordinates, which scrolling the page does not change.
      const travel = pointerY - startY + window.scrollY - startScroll
      if (!dragging) {
        if (Math.abs(travel) < DRAG_THRESHOLD) return
        dragging = true
        // A slide still running from the last move would fight the drag, so settle every row, but pick
        // this one up where it was drawn: it stays under the pointer and lands where it is seen to.
        const drawn = els[from].getBoundingClientRect().top
        for (const el of els) el.getAnimations?.().forEach((slide) => slide.finish())
        lag = drawn - els[from].getBoundingClientRect().top
      }
      const moved = travel + lag
      // The landing place follows the pointer even past either end; the row itself stays on the list.
      to = middles.filter((middle, i) => i !== from && middle < middles[from] + moved).length
      const dy = Math.min(Math.max(moved, -tops[from]), tops[last] + heights[last] - tops[from] - heights[from])
      setDrag({ from, to, dy, tops, heights, gap })
    }
    // Negative near the top of the window, positive near the bottom, zero elsewhere.
    const edge = () =>
      Math.max(-SCROLL_EDGE, Math.min(SCROLL_EDGE, Math.min(0, pointerY - SCROLL_EDGE) + Math.max(0, pointerY - innerHeight + SCROLL_EDGE)))
    const scroll = () => {
      frame = 0
      if (!dragging || !edge()) return
      window.scrollBy(0, edge() / 4)
      follow()
      frame = requestAnimationFrame(scroll)
    }
    const end = (drop: boolean) => {
      stop()
      if (!dragging) return
      notePositions()
      setDrag(null)
      if (!drop) setAnnouncement(`Move cancelled. ${order[from]} is back at position ${from + 1}.`)
      else if (to !== from) move(from, to)
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      // No button down: the release went somewhere else (a context menu, say), so this press is over.
      if (!ev.buttons) return end(false)
      pointerY = ev.clientY
      follow()
      if (dragging && !frame && edge()) frame = requestAnimationFrame(scroll)
    }
    const onUp = (ev: PointerEvent) => ev.pointerId === pointerId && end(true)
    const onPointerCancel = (ev: PointerEvent) => ev.pointerId === pointerId && end(false)
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && end(false)
    const onCancel = () => end(false)
    const stop = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onCancel)
      window.removeEventListener('contextmenu', onCancel)
      release.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onCancel)
    window.addEventListener('contextmenu', onCancel)
    release.current = stop
  }

  if (graded) {
    return (
      <div>
        <ol aria-label="Your order" className="space-y-2">
          {order.map((step, i) => {
            const belongs = key.indexOf(step)
            const hit = belongs === i
            return (
              <li
                key={step}
                className={`flex gap-3 rounded-lg border p-3 text-sm ${
                  hit ? 'border-good/60 bg-good/10' : 'border-bad/60 bg-bad/10'
                }`}
              >
                <span className="grid place-items-center shrink-0 w-7 h-7 rounded-md bg-bg-3 border border-line text-xs font-mono">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 self-center">
                  <span className="block text-ink-dim leading-snug wrap-break-word">
                    <Wrappable text={step} />
                  </span>
                  <span className="block mt-1 text-xs">
                    {hit ? (
                      <span className="text-good">✓ Correct position</span>
                    ) : (
                      <>
                        <span className="text-bad">✕</span> <span className="text-ink-dim">Belongs at position {belongs + 1}</span>
                      </>
                    )}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
        {key.length > 0 && (
          <div className="mt-4">
            <div id={correctLabel} className="text-xs uppercase tracking-wider text-ink-mute font-semibold mb-1">
              Correct order
            </div>
            <ol
              aria-labelledby={correctLabel}
              className="list-decimal pl-7 space-y-1 text-sm text-ink-dim leading-snug wrap-break-word marker:font-mono marker:text-ink-mute"
            >
              {key.map((step) => (
                <li key={step}>
                  <Wrappable text={step} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    )
  }

  // While dragging, the numbers and the other rows already show the order a drop would give.
  const preview = drag ? moveItem(order, drag.from, drag.to) : order
  const slots = new Map<string, number>()
  if (drag) {
    let y = 0
    for (const step of preview) {
      slots.set(step, y)
      y += drag.heights[order.indexOf(step)] + drag.gap
    }
  }

  return (
    <div>
      <p className="text-xs text-ink-mute mb-3">Drag a step by its handle, or pick a new number for it.</p>
      <div className="relative">
        {drag && (
          // The slot the dragged step drops into.
          <div
            aria-hidden
            className="absolute inset-x-0 rounded-lg border-2 border-dashed border-accent/50"
            style={{ top: slots.get(order[drag.from]), height: drag.heights[drag.from] }}
          />
        )}
        <ol className="space-y-2">
          {order.map((step, i) => {
            const lifted = drag?.from === i
            const offset = !drag ? 0 : lifted ? drag.dy : slots.get(step)! - drag.tops[i]
            return (
              // Keyed by content, not position, so a moved step keeps its DOM node and keyboard focus.
              <li
                key={step}
                ref={(row) => {
                  if (row) rows.current.set(step, row)
                  return () => {
                    rows.current.delete(step)
                  }
                }}
                onPointerDown={(e) => press(e, i)}
                style={offset ? { transform: `translateY(${offset}px)` } : undefined}
                className={`relative flex rounded-lg border select-none cursor-grab ${
                  lifted
                    ? 'z-10 cursor-grabbing border-accent ring-1 ring-accent bg-bg-3 shadow-xl shadow-black/50'
                    : `border-line hover:border-line-strong ${drag ? 'motion-safe:transition-transform motion-safe:duration-150' : ''}`
                }`}
              >
                <span
                  data-handle
                  aria-hidden
                  className="grid w-11 shrink-0 place-items-center rounded-l-lg text-ink-mute hover:text-ink-dim active:bg-bg-3 touch-none"
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                    <circle cx="2" cy="2" r="1.6" />
                    <circle cx="8" cy="2" r="1.6" />
                    <circle cx="2" cy="8" r="1.6" />
                    <circle cx="8" cy="8" r="1.6" />
                    <circle cx="2" cy="14" r="1.6" />
                    <circle cx="8" cy="14" r="1.6" />
                  </svg>
                </span>
                <span className="relative shrink-0 self-center py-2">
                  <select
                    aria-label={`Position of ${step}`}
                    value={preview.indexOf(step) + 1}
                    onChange={(e) => {
                      notePositions()
                      picker.current = e.currentTarget
                      move(i, Number(e.target.value) - 1)
                    }}
                    // 16px text: iOS zooms the page into any smaller form control on focus.
                    className="h-11 w-12 appearance-none cursor-pointer rounded-md border-line-strong bg-bg-2 py-0 pl-3 pr-5 font-mono text-base font-semibold text-ink hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {order.map((_, k) => (
                      <option key={k} value={k + 1}>
                        {k + 1}
                      </option>
                    ))}
                  </select>
                  <svg
                    aria-hidden
                    width="8"
                    height="5"
                    viewBox="0 0 8 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-dim"
                  >
                    <path d="M1 1l3 3 3-3" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1 self-center py-3 pl-3 pr-3 text-sm text-ink-dim leading-snug wrap-break-word">
                  <Wrappable text={step} />
                </span>
                {lifted && (
                  <span aria-hidden className="chip chip-accent bg-bg-3 absolute -top-2.5 right-3">
                    Moving
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
