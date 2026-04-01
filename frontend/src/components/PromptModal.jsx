import { useState, useEffect, useRef } from 'react'

export default function PromptModal({ title, label, defaultValue, onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue || '')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <>
      <div className="prompt-overlay" onClick={onCancel} />
      <div className="prompt-modal">
        <h3 className="prompt-title">{title}</h3>
        {label && <p className="prompt-label">{label}</p>}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="prompt-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <div className="prompt-actions">
            <button type="button" className="prompt-btn secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="prompt-btn primary" disabled={!value.trim()}>Add project</button>
          </div>
        </form>
      </div>
    </>
  )
}
