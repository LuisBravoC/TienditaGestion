/**
 * GrupoBadge — chip de color para mostrar el grupo social de un participante.
 * Props:
 *   grupo  : { nombre, color } | null | undefined
 *   size   : 'sm' | 'md'  (default 'sm')
 *   style  : objeto de estilos extra
 */
export default function GrupoBadge({ grupo, size = 'sm', style }) {
  if (!grupo?.nombre) return null
  const fs   = size === 'md' ? '.82rem' : '.72rem'
  const pad  = size === 'md' ? '.2rem .65rem' : '.15rem .5rem'
  const color = grupo.color ?? '#6366f1'

  // Calcula si el texto debe ser claro u oscuro según el fondo
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const textColor = luminance > 0.55 ? '#1a1a1a' : '#ffffff'

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      padding:       pad,
      borderRadius:  '999px',
      fontSize:      fs,
      fontWeight:    600,
      background:    color,
      color:         textColor,
      whiteSpace:    'nowrap',
      letterSpacing: '.01em',
      ...style,
    }}>
      {grupo.nombre}
    </span>
  )
}
