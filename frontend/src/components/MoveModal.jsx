import { useState } from 'react'

export default function MoveModal({ file, config, onClose, onMove }) {
  const [selected, setSelected] = useState('')
  const projects = config?.projectList || []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Move {file.filename}</h3>
        <p>Assign this file to a project:</p>
        <div className="folder-list">
          {projects.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No projects yet. Create one in the sidebar.
            </div>
          )}
          {projects.map((p) => (
            <div
              key={p.name}
              className={`folder-item ${selected === p.name ? 'selected' : ''}`}
              onClick={() => setSelected(p.name)}
            >
              <span className="dot" style={{ background: p.color, width: 8, height: 8, borderRadius: '50%' }} />
              {p.name}
            </div>
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
