import { api } from '../api'

export default function VersionTimeline({ versions, rootDir, showToast }) {
  const sorted = [...versions].sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))

  const copyCode = async (id) => {
    try {
      const res = await fetch(api.getFileContent(id, rootDir))
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      showToast('Code copied to clipboard')
    } catch {
      showToast('Failed to copy')
    }
  }

  return (
    <div className="version-list">
      {sorted.map((v) => (
        <div key={v.id} className="version-item">
          <div className={`version-dot ${v.current ? 'current' : ''}`} />
          <div className="version-item-info">
            <span className="version-label">{v.label}</span>
            <span className="version-filename"> {v.filename}</span>
          </div>
          <span className="version-time">
            {new Date(v.modifiedAt).toLocaleDateString()}
          </span>
          {v.current && <span className="current-badge">current</span>}
          <button
            className="detail-action-btn mini"
            aria-label={`Open ${v.filename} in browser`}
            onClick={() => window.open(api.getFileContent(v.id, rootDir), '_blank')}
          >
            Open
          </button>
          <button
            className="detail-action-btn mini"
            aria-label={`Copy code from ${v.filename}`}
            onClick={() => copyCode(v.id)}
          >
            Copy
          </button>
        </div>
      ))}
    </div>
  )
}
