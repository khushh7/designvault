import { api } from '../api'

export default function CompareView({ versions, rootDir }) {
  if (!versions || versions.length < 2) return null

  const sorted = [...versions].sort((a, b) => new Date(a.modifiedAt) - new Date(b.modifiedAt))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  return (
    <div className="compare-view">
      <div className="compare-pane">
        <div className="compare-pane-label">{first.label} — {first.filename}</div>
        <iframe
          src={api.getFileContent(first.id, rootDir)}
          sandbox="allow-same-origin"
          title={first.filename}
        />
      </div>
      <div className="compare-pane">
        <div className="compare-pane-label">{last.label} — {last.filename}</div>
        <iframe
          src={api.getFileContent(last.id, rootDir)}
          sandbox="allow-same-origin"
          title={last.filename}
        />
      </div>
    </div>
  )
}
