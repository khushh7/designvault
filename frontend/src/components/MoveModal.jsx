import { useRef, useState } from 'react'
import useDialogA11y from './useDialogA11y'

export default function MoveModal({ file, config, onClose, onMove }) {
  const [selected, setSelected] = useState('')
  const projects = config?.projectList || []
  const modalRef = useRef(null)
  useDialogA11y(modalRef, onClose, '.btn-secondary')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="move-modal-title">Move {file.filename}</h3>
        <p>Assign this file to a project:</p>
        <div className="folder-list">
          {projects.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No projects yet. Create one in the sidebar.
            </div>
          )}
          {projects.map((p) => (
            <button
              key={p.name}
              className={`folder-item ${selected === p.name ? 'selected' : ''}`}
              aria-pressed={selected === p.name}
              onClick={() => setSelected(p.name)}
            >
              <span className="dot" style={{ background: p.color, width: 8, height: 8, borderRadius: '50%' }} />
              {p.name}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!selected}
            onClick={() => onMove(selected)}
          >
            Move here
          </button>
        </div>
      </div>
    </div>
  )
}
