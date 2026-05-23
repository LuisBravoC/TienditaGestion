// ── CSV utilities ────────────────────────────────────────────────────────────

export function normalizeKey(h) {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function parseCSV(text) {
  const clean   = text.replace(/^\uFEFF/, '')
  const lines   = clean.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(normalizeKey)
  return lines.slice(1).map(line => {
    const fields = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"')              inQ = !inQ
      else if (line[i] === ',' && !inQ) { fields.push(cur); cur = '' }
      else                              cur += line[i]
    }
    fields.push(cur)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (fields[i] ?? '').trim() })
    return obj
  })
}

export function parseFechaCSV(str) {
  if (!str) return null
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  return null
}

export function csvEsc(v) {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

/**
 * Parsea un texto CSV y genera el array de preview para el modal de importación.
 * @param {string} csvText  - Contenido del archivo CSV
 * @param {Array}  boletos  - Boletos existentes de la rifa
 * @returns {Array} preview - Filas con _num y _status ('ok'|'vacio'|'no-existe'|'ocupado')
 */
export function buildImportPreview(csvText, boletos) {
  const rows = parseCSV(csvText)
  // Map por numero_asignado para lookup O(1) en lugar de O(n) por fila
  const boletoMap = new Map(boletos.map(b => [b.numero_asignado, b]))
  return rows.map(r => {
    const num    = Number(r['numero'] || r['n\u00famero'] || r['#'] || '')
    const nombre = (r['nombre'] ?? '').trim()
    const boleto = boletoMap.get(num)
    let status = 'ok'
    if (!nombre)                              status = 'vacio'
    else if (!boleto)                         status = 'no-existe'
    else if (boleto.estatus !== 'Disponible') status = 'ocupado'
    return { ...r, _num: num, _status: status }
  })
}

/**
 * Convierte las filas OK del preview al formato que espera importarBoletos().
 * @param {Array} preview - Array devuelto por buildImportPreview
 * @returns {Array} filas
 */
export function previewToFilas(preview) {
  return preview
    .filter(r => r._status === 'ok')
    .map(r => ({
      numero:   r._num,
      nombre:   (r['nombre'] ?? '').trim(),
      grupo:    (r['grupo'] ?? '').trim(),
      contacto: (r['contacto'] ?? '').trim(),
      pagado:   (r['pagado'] ?? '').toUpperCase() === 'TRUE',
      fecha:    parseFechaCSV(r['fecha'] ?? ''),
    }))
}

/**
 * Genera y descarga un CSV con los boletos de una rifa.
 * @param {Array}  boletos - Array de boletos
 * @param {object} rifa    - Datos de la rifa (nombre_premio)
 */
export function exportarBoletos(boletos, rifa) {
  const header = 'N\u00famero,Nombre,Grupo,Pagado,Contacto,Fecha'
  const rows = boletos.map(b => [
    b.numero_asignado,
    b.nombre_completo ?? '',
    b.grupo_nombre ?? '',
    b.estatus === 'Liquidado' ? 'TRUE' : 'FALSE',
    b.telefono_whatsapp ?? '',
    b.fecha_apartado ? b.fecha_apartado.slice(0, 10) : '',
  ].map(csvEsc).join(','))
  const csv  = '\uFEFF' + [header, ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `${rifa.nombre_premio ?? 'rifa'}.csv`; a.click()
  URL.revokeObjectURL(url)
}
