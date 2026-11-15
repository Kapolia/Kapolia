import { C } from '@/lib/colors'

interface AuthSpinnerProps {
  label?: string
}

export default function AuthSpinner({ label }: AuthSpinnerProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 0',
      gap: '20px',
    }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `3px solid ${C.sable}`,
        borderTopColor: C.orange,
        animation: 'kapolia-spin 0.8s linear infinite',
      }} />
      {label && (
        <p style={{ margin: 0, fontSize: '14px', color: C.grey }}>{label}</p>
      )}
    </div>
  )
}
