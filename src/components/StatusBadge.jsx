import { STATUS_INFO } from '../lib/boleto-status.js'

/**
 * Badge de estatus de boleto.
 * @param {string}  status   - Valor de BD: 'Apartado' | 'Liquidado' | 'Vencido'
 * @param {boolean} showIcon - Mostrar icono lucide junto al label (default: false)
 * @param {object}  style    - Estilos inline adicionales
 */
export default function StatusBadge({ status, showIcon = false, style }) {
  const si = STATUS_INFO[status] ?? { label: status, cls: 'badge-abonado', icon: null }
  const Icon = showIcon ? si.icon : null
  return (
    <span
      className={`badge ${si.cls}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem', ...style }}
    >
      {Icon && <Icon size={11} />}
      {si.label}
    </span>
  )
}
