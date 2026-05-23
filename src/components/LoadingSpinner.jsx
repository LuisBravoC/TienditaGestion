import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ text = 'Cargando…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', gap: '1rem' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: '.9rem' }}>{text}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function ErrorMsg({ message }) {
  return (
    <div style={{ margin: '2rem 1.5rem', padding: '1rem', background: 'rgba(239,68,68,.1)', border: '1px solid var(--deuda)', borderRadius: 'var(--radius)', color: 'var(--deuda)', fontSize: '.88rem' }}>
      ⚠️ Error al conectar con la base de datos: {message}
    </div>
  )
}
