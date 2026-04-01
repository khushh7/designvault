export default function Toast({ message, undoFn, onDismiss }) {
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      {undoFn && (
        <button className="toast-undo" aria-label="Undo last action" onClick={() => { undoFn(); onDismiss() }}>
          Undo
        </button>
      )}
    </div>
  )
}
