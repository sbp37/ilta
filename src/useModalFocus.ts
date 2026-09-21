import { useEffect } from 'react'

export function useModalFocus() {
  useEffect(() => {
    let active: HTMLElement | null = null
    let previous: HTMLElement | null = null
    const sync = () => {
      const layers = document.querySelectorAll<HTMLElement>('.modal-backdrop')
      const layer = layers[layers.length - 1]
      const next = layer?.querySelector<HTMLElement>('.modal') ?? null
      if (next === active) return
      if (active && !next) {
        if (previous?.isConnected) previous.focus()
        previous = null
      }
      if (next) {
        if (!active) previous = document.activeElement as HTMLElement
        next.setAttribute('role', 'dialog')
        next.setAttribute('aria-modal', 'true')
        next.setAttribute(
          'aria-label',
          next.querySelector('.modal-title, .reveal-title, .encounter-alert')?.textContent ?? '일타',
        )
        next.tabIndex = -1
        if (!next.contains(document.activeElement)) next.focus()
      }
      active = next
    }
    const onKey = (event: KeyboardEvent) => {
      if (!active) return
      if (event.key === 'Escape') {
        event.preventDefault()
        active.closest<HTMLElement>('.modal-backdrop')?.click()
      }
      if (event.key !== 'Tab') return
      const items = [
        ...active.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]',
        ),
      ].filter((e) => e.getClientRects().length > 0)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first) {
        event.preventDefault()
        return
      }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === active)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === active)) {
        event.preventDefault()
        first.focus()
      }
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('keydown', onKey)
    sync()
    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', onKey)
    }
  }, [])
}
