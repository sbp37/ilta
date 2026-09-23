import { useEffect } from 'react'

export function useModalFocus() {
  useEffect(() => {
    let active: HTMLElement | null = null
    let previous: HTMLElement | null = null
    let opener: HTMLElement | null = null
    const onPointer = (event: PointerEvent) => {
      if (active || !(event.target instanceof Element)) return
      // Safari does not focus buttons on pointer clicks; remember the invoking control explicitly.
      opener = event.target.closest<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')
    }
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
        if (!active) previous = opener ?? (document.activeElement as HTMLElement)
        opener = null
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
      if (!active) {
        opener = null
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        active.closest<HTMLElement>('.modal-backdrop')?.click()
      }
      if (event.key !== 'Tab') return
      const items = [
        ...active.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]',
        ),
      ].filter((e) => e.getClientRects().length > 0 && e.tabIndex >= 0)
      event.preventDefault()
      if (!items.length) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next =
        index < 0
          ? event.shiftKey
            ? items.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + items.length) % items.length
      items[next].focus()
    }
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer, true)
    sync()
    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [])
}
