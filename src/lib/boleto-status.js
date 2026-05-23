import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

/**
 * Información de visualización por estatus de boleto.
 * - label : texto del badge
 * - cls   : clase CSS del badge
 * - icon  : componente lucide-react
 */
export const STATUS_INFO = {
  Apartado:  { label: '🟡 Apartado', cls: 'badge-abonado',   icon: Clock },
  Liquidado: { label: '🟢 Pagado',   cls: 'badge-liquidado', icon: CheckCircle2 },
  Vencido:   { label: '🔴 Vencido',  cls: 'badge-deuda',     icon: AlertCircle },
}
