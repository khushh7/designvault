import { useEffect } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function getFocusableElements(container) {
  if (!container) return []
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
  })
}

export default function useDialogA11y(containerRef, onClose, initialFocusSelector) {
  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'

    const focusables = getFocusableElements(node)
    const preferredTarget = initialFocusSelector ? node.querySelector(initialFocusSelector) : null
    const initialTarget = preferredTarget || focusables[0] || node
    if (initialTarget && typeof initialTarget.focus === 'function') {
      initialTarget.focus()
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements(node)
      if (elements.length === 0) {
        event.preventDefault()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', handleKeyDown)

    return () => {
      node.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus()
      }
    }
  }, [containerRef, initialFocusSelector, onClose])
}
