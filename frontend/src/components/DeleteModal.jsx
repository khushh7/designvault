import { useRef } from 'react'
import { api } from '../api'
import useDialogA11y from './useDialogA11y'

export default function DeleteModal({ file, onClose, onConfirm }) {
  const modalRef = useRef(null)
  useDialogA11y(modalRef, onClose, '.btn-secondary')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="delete-modal-title">Delete {file.filename}?</h3>
        <div className="modal-preview">
          {file.extension === 'svg' ? (
            <img src={api.getFileContent(file.id, file.sourceRootDir)} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12 }} />
          ) : (
            <iframe
              src={api.getFileContent(file.id, file.sourceRootDir)}
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
