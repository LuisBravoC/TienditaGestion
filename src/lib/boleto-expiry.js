/**
 * boleto-expiry.js — Lógica de vencimiento de boletos.
 *
 * Módulo PURO: sin imports, sin dependencias de backend.
 * Puede reutilizarse con cualquier fuente de datos (Supabase, REST, local, etc.).
 *
 * El write-back a la BD es responsabilidad del adaptador (rifas-queries.js).
 * Reemplazar ese adaptador es suficiente para migrar de backend.
 */

/**
 * Fecha límite a partir de la cual un Apartado se considera Vencido.
 * @param {number} horasExpiracion
 * @returns {Date}
 */
export function cutoffDate(horasExpiracion) {
  return new Date(Date.now() - horasExpiracion * 3_600_000)
}

/**
 * Devuelve true si el boleto debería vencerse (Apartado → Vencido).
 */
export function shouldExpire(boleto, horasExpiracion) {
  if (!horasExpiracion || boleto.estatus !== 'Apartado' || !boleto.fecha_apartado) return false
  return new Date(boleto.fecha_apartado) < cutoffDate(horasExpiracion)
}

/**
 * Devuelve true si el boleto debería reactivarse (Vencido → Apartado).
 * Ocurre cuando se amplía el tiempo de caducidad de la rifa y el boleto
 * volvió a quedar dentro de la ventana válida.
 */
export function shouldReactivate(boleto, horasExpiracion) {
  if (!horasExpiracion || boleto.estatus !== 'Vencido' || !boleto.fecha_apartado) return false
  return new Date(boleto.fecha_apartado) >= cutoffDate(horasExpiracion)
}

/**
 * Aplica la lógica de caducidad EN MEMORIA sobre un array de boletos (bidireccional).
 * - Apartado cuya fecha_apartado superó el límite  → Vencido
 * - Vencido  cuya fecha_apartado sigue dentro del límite → Apartado
 *
 * No realiza ninguna llamada a BD.
 *
 * @param {Array}  boletos
 * @param {number} horasExpiracion
 * @returns {Array} nuevo array (inmutable)
 */
export function applyExpiry(boletos, horasExpiracion) {
  if (!horasExpiracion || !boletos?.length) return boletos ?? []
  return boletos.map(b => {
    if (shouldExpire(b, horasExpiracion))     return { ...b, estatus: 'Vencido' }
    if (shouldReactivate(b, horasExpiracion)) return { ...b, estatus: 'Apartado' }
    return b
  })
}
