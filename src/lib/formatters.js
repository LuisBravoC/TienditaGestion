export const fmt = n => Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

export function fmtNum(n, total) {
  const digits = (total ?? 100) <= 100 ? 2 : String(total ?? 100).length
  return String(n).padStart(digits, '0')
}

export function fmtDate(d) {
  if (!d) return '—'
  const raw = typeof d === 'string' && d.length === 10 ? d + 'T12:00:00' : d
  return new Date(raw).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Normaliza un número de teléfono mexicano:
 * - Elimina espacios, guiones, paréntesis y cualquier carácter no numérico.
 * - Quita el código de país si está presente (+52 / 52 / 521).
 * - Devuelve los últimos 10 dígitos.
 */
export function normalizePhone(raw) {
  if (!raw) return ''
  let digits = String(raw).replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3)
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('1'))  digits = digits.slice(1)
  return digits.slice(-10)
}
