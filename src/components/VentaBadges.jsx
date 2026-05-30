import { CheckCircle, Clock } from 'lucide-react'

/**
 * Badge de tipo de venta: "Directa" o "Apartado".
 * Fuente única de verdad para colores y estilos.
 */
export function TipoBadge({ tipo }) {
  const cfg = tipo === 'apartado'
    ? { color: '#8b5cf6', bg: '#8b5cf622', label: 'Apartado' }
    : { color: '#0ea5e9', bg: '#0ea5e922', label: 'Directa'  }
  return (
    <span style={{
      padding: '.15rem .5rem', borderRadius: '999px', fontSize: '.72rem',
      fontWeight: 700, background: cfg.bg, color: cfg.color, flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  )
}

/**
 * Badge de estado de entrega: "Entregado" o "Pendiente".
 */
export function EntregaBadge({ estado }) {
  const cfg = estado === 'entregado'
    ? { color: '#10b981', bg: '#10b98122', Icon: CheckCircle, label: 'Entregado' }
    : { color: '#f59e0b', bg: '#f59e0b22', Icon: Clock,       label: 'Pendiente' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '.25rem',
      padding: '.15rem .5rem', borderRadius: '999px', fontSize: '.72rem',
      fontWeight: 700, background: cfg.bg, color: cfg.color, flexShrink: 0,
    }}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  )
}
