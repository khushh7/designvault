import { useEffect, useRef } from 'react'
import { api } from '../api'

export default function ContextMenu({ x, y, file, onClose, onSelect, onDelete, onDuplicate, onMove, onRename, showToast }) {
  const ref = useRef()

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Clamp position so menu doesn't go off-screen
  const menuWidth = 220
  const menuHeight = 320
  const clampedX = Math.min(x, window.innerWidth - menuWidth)
  const clampedY = Math.min(y, window.innerHeight - menuHeight)

  const copyCode = async () => {
    try {
      const res = await fetch(api.getFileContent(file.id))
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      showToast('Code copied to clipboard')
    } catch {
      showToast('Failed to copy')
    }
    onClose()
  }

  return (
    <div ref={ref} className="context-menu" style={{ left: clampedX, top: clampedY }}>
      <button className="context-item" onClick={() => { window.open(file.previewUrl || api.getFileContent(file.id), '_blank'); onClose() }}>
        ↗ {file.previewUrl ? 'Open live page' : 'Open in browser'}
      </button>
      <button className="context-item" onClick={() => { onSelect(file); onClose() }}>
        Quick preview
      </button>
      <div className="context-separator" />
      {!file.routePath && (
        <button className="context-item" onClick={() => onRename(file)}>
          Rename
        </button>
      )}
      <button className="context-item" onClick={() => { onDuplicate(file); onClose() }}>
        Duplicate
      </button>
      <button className="context-item" onClick={() => { onMove(file); onClose() }}>
        Move to...
      </button>
      <button className="context-item" onClick={copyCode}>
        Copy code
      </button>
      <div className="context-separator" />
      <button className="context-item" onClick={() => { showToast(`Run: open "${file.relativePath}" in terminal`); onClose() }}>
        Reveal in Finder
      </button>
      <button className="context-item" onClick={() => { showToast(`Run: cd "${file.relativePath.replace(/\/[^/]+$/, '')}" in terminal`); onClose() }}>
        Open in terminal
      </button>
      <div className="context-separator" />
      <button className="context-item danger" onClick={() => { onDelete(file); onClose() }}>
        Delete
      </button>
    </div>
  )
}
