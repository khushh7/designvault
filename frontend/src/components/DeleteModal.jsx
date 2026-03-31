import { api } from '../api'

export default function DeleteModal({ file, onClose, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Delete {file.filename}?</h3>
        <div className="modal-preview">
          {file.extension === 'svg' ? (
            <img src={api.getFileContent(file.id)} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} />
          ) : (
            <iframe
              src={api.getFileContent(file.id)}
              sandbox="allow-same-origin"
              title={file.name}
            />
          )}
        </div>
        <p>This will move the file to .designvault/trash. You can undo within 5 seconds.</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}
