export default function Toast({ message, undoFn, onDismiss }) {
  return (
    <div className="toast">
      <span>{message}</span>
      {undoFn && (
        <button className="toast-undo" onClick={() => { undoFn(); onDismiss() }}>
          Undo
        </button>
      )}
    </div>
  )
}
