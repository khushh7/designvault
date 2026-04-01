import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api'
import { getFocusableElements } from './useDialogA11y'

export default function ContextMenu({ x, y, file, onClose, onSelect, onDelete, onDuplicate, onMove, onRename, showToast }) {
  const ref = useRef()
  const [position, setPosition] = useState({ left: x, top: y })

  useEffect(() => {
    setPosition({ left: x, top: y })
  }, [x, y, file?.id])

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    const menu = ref.current
    if (!menu) return undefined

    const items = getFocusableElements(menu)
    items[0]?.focus()

    const handleKeyDown = (event) => {
      const focusable = getFocusableElements(menu)
      const currentIndex = focusable.indexOf(document.activeElement)

      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusable.length
        focusable[nextIndex]?.focus()
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
        focusable[nextIndex]?.focus()
      }

      if (event.key === 'Home') {
        event.preventDefault()
        focusable[0]?.focus()
      }

      if (event.key === 'End') {
        event.preventDefault()
        focusable[focusable.length - 1]?.focus()
      }
    }

    menu.addEventListener('keydown', handleKeyDown)
    return () => menu.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return

    const margin = 12
    const rect = menu.getBoundingClientRect()
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin)
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin)
    const nextLeft = Math.min(Math.max(margin, x), maxLeft)
    const nextTop = Math.min(Math.max(margin, y), maxTop)

    if (nextLeft !== position.left || nextTop !== position.top) {
      setPosition({ left: nextLeft, top: nextTop })
    }
  }, [x, y, position.left, position.top, file?.id])

  const copyCode = async () => {
    try {
      const res = await fetch(api.getFileContent(file.id, file.sourceRootDir))
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      showToast('Code copied to clipboard')
    } catch {
      showToast('Failed to copy')
    }
    onClose()
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      aria-label={`Actions for ${file.displayName || file.name}`}
      style={{ left: position.left, top: position.top }}
    >
      <button className="context-item" role="menuitem" onClick={() => { window.open(file.previewUrl || api.getFileContent(file.id, file.sourceRootDir), '_blank'); onClose() }}>
        ↗ {file.previewUrl ? 'Open live page' : 'Open in browser'}
      </button>
      <button className="context-item" role="menuitem" onClick={() => { onSelect(file); onClose() }}>
        Quick preview
      </button>
      <div className="context-separator" />
      {!file.routePath && (
        <button className="context-item" role="menuitem" onClick={() => onRename(file)}>
          Rename
        </button>
      )}
      <button className="context-item" role="menuitem" onClick={() => { onDuplicate(file); onClose() }}>
        Duplicate
      </button>
      <button className="context-item" role="menuitem" onClick={() => { onMove(file); onClose() }}>
        Move to...
      </button>
      <button className="context-item" role="menuitem" onClick={copyCode}>
        Copy code
      </button>
      <div className="context-separator" />
      <button className="context-item" role="menuitem" onClick={async () => { await api.revealInFinder(file.id, file.sourceRootDir); onClose() }}>
        Reveal in Finder
      </button>
      <button className="context-item" role="menuitem" onClick={async () => { await api.openInTerminal(file.id, file.sourceRootDir); onClose() }}>
        Open in terminal
      </button>
      <div className="context-separator" />
      <button className="context-item" role="menuitem" onClick={async () => { await api.openIn(file.id, 'claude-code', file.sourceRootDir); showToast('Opening in Claude Code'); onClose() }}>
        Open in Claude Code
      </button>
      <button className="context-item" role="menuitem" onClick={async () => { await api.openIn(file.id, 'codex', file.sourceRootDir); showToast('Opening in Codex'); onClose() }}>
        Open in Codex
      </button>
      <button className="context-item" role="menuitem" onClick={async () => { await api.openIn(file.id, 'cursor', file.sourceRootDir); showToast('Opening in Cursor'); onClose() }}>
        Open in Cursor
      </button>
      <div className="context-separator" />
      <button className="context-item danger" role="menuitem" onClick={() => { onDelete(file); onClose() }}>
        Delete
      </button>
    </div>
  )
}
