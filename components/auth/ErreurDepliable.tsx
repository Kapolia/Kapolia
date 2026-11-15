interface ErreurDepliableProps {
  message: string
}

export default function ErreurDepliable({ message }: ErreurDepliableProps) {
  const open = message.length > 0
  return (
    <div
      className={`auth-err-wrap${open ? ' auth-err-wrap--open' : ''}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="auth-err-inner" aria-hidden={open ? undefined : true}>
        <div className="auth-err-content">
          {message}
        </div>
      </div>
    </div>
  )
}
