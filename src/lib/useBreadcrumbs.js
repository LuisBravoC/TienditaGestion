import { useLocation, useParams } from 'react-router-dom'

// Static path segments → display label.  null = hidden connector segment.
const SEGMENT_LABEL = {
  opciones:      'Opciones',
  // Rifas
  rifas:         'Rifas',
  sorteos:       null,
  participantes: 'Participantes',
  historial:     'Historial',
  pendientes:    'Pendientes',
  bitacora:      'Bitácora',
  // Tiendita
  productos:     'Productos',
  pedidos:       'Pedidos',
  ventas:        'Ventas',
  clientes:      'Clientes',
  dashboard:     null,
}

/**
 * Auto-generates breadcrumbs from the current URL.
 * Pass labels for dynamic param segments, keyed by param name.
 *
 * Example:
 *   useBreadcrumbs({ instId: inst.nombre, proyId: `Gen ${proy.año_ciclo}`,
 *                    grupoId: grupo.nombre_grupo, alumnoId: alumno.nombre_alumno })
 */
export function useBreadcrumbs(labels = {}) {
  const { pathname } = useLocation()
  const params = useParams()

  // Map actual param value (e.g. "42") → human-readable label
  const valueToLabel = {}
  for (const [key, label] of Object.entries(labels)) {
    if (params[key] != null && label != null) {
      valueToLabel[params[key]] = label
    }
  }

  const segments = pathname.split('/')
  const crumbs = [{ label: 'Inicio', to: '/' }]
  let path = ''

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue
    path += '/' + seg

    if (seg in SEGMENT_LABEL) {
      const label = SEGMENT_LABEL[seg]
      if (label === null) continue   // skip connector segment
      const isLast = i === segments.length - 1
      crumbs.push({ label, ...(isLast ? {} : { to: path }) })
    } else {
      // Dynamic param — resolve to human label
      const label = valueToLabel[seg]
      if (!label) continue
      const isLast = i === segments.length - 1
      crumbs.push({ label, ...(isLast ? {} : { to: path }) })
    }
  }

  return crumbs
}
