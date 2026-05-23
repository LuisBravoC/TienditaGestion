/**
 * rifas-queries.js — Capa de acceso a datos para el Sistema de Gestión de Rifas.
 *
 * Jerarquía: Campaña > Rifa (Sorteo) > Boleto > Historial de Pagos
 * Cada función es async y lanza error en caso de fallo de Supabase.
 */
import { supabase } from './supabase.js'
import { cutoffDate } from './boleto-expiry.js'
import { normalizePhone } from './formatters.js'

// ─── Utilidad interna ─────────────────────────────────────────────────────────
function check({ data, error }, label) {
  if (error) {
    console.error(`[rifas] ${label ?? ''}`, error)
    throw error
  }
  return data
}

// =============================================================================
// GRUPOS SOCIALES
// =============================================================================

export async function getGrupos() {
  return check(
    await supabase.from('grupos').select('*').order('nombre'),
    'getGrupos'
  )
}

export async function insertGrupo(data) {
  return check(
    await supabase.from('grupos').insert(data).select().single(),
    'insertGrupo'
  )
}

export async function updateGrupo(id, data) {
  return check(
    await supabase.from('grupos').update(data).eq('id', id).select().single(),
    'updateGrupo'
  )
}

export async function deleteGrupo(id) {
  return check(
    await supabase.from('grupos').delete().eq('id', id),
    'deleteGrupo'
  )
}

// =============================================================================
// CAMPAÑAS
// =============================================================================

export async function getCampanas() {
  return check(
    await supabase.from('campanas').select('*').order('nombre'),
    'getCampanas'
  )
}

export async function getCampana(id) {
  return check(
    await supabase.from('campanas').select('*').eq('id', id).single(),
    'getCampana'
  )
}

/**
 * Devuelve campañas con resumen financiero (meta, recaudado, boletos vendidos)
 * usando 3 queries paralelas en lugar de N+1.
 */
export async function getCampanasConResumen() {
  const [campanas, rifas, bolAgg] = await Promise.all([
    supabase.from('campanas').select('*').order('nombre'),
    supabase.from('rifas').select('id, campana_id, precio_boleto, cantidad_boletos'),
    supabase.from('vista_saldo_boletos').select('campana_id, estatus, total_pagado'),
  ])
  check(campanas, 'getCampanasConResumen:campanas')
  check(rifas,    'getCampanasConResumen:rifas')
  check(bolAgg,   'getCampanasConResumen:boletos')

  // Acumular meta y cuenta de rifas por campaña
  const resumenMap = {}
  for (const r of rifas.data) {
    const cid = r.campana_id
    if (!resumenMap[cid]) resumenMap[cid] = { rifas: 0, meta: 0, boletos: 0, liquidados: 0, recaudado: 0 }
    resumenMap[cid].rifas++
    resumenMap[cid].meta += Number(r.precio_boleto) * r.cantidad_boletos
  }

  // Acumular boletos y recaudado por campaña
  for (const b of bolAgg.data) {
    const cid = b.campana_id
    if (!cid) continue
    if (!resumenMap[cid]) resumenMap[cid] = { rifas: 0, meta: 0, boletos: 0, liquidados: 0, recaudado: 0 }
    resumenMap[cid].boletos++
    if (b.estatus === 'Liquidado') resumenMap[cid].liquidados++
    resumenMap[cid].recaudado += Number(b.total_pagado)
  }

  const EMPTY = { rifas: 0, meta: 0, boletos: 0, liquidados: 0, recaudado: 0 }
  return campanas.data.map(c => ({ ...c, resumen: resumenMap[c.id] ?? EMPTY }))
}

export async function insertCampana(data) {
  return check(
    await supabase.from('campanas').insert(data).select().single(),
    'insertCampana'
  )
}

export async function updateCampana(id, data) {
  return check(
    await supabase.from('campanas').update(data).eq('id', id).select().single(),
    'updateCampana'
  )
}

export async function deleteCampana(id) {
  return check(
    await supabase.from('campanas').delete().eq('id', id),
    'deleteCampana'
  )
}

// =============================================================================
// RIFAS (SORTEOS)
// =============================================================================

export async function getRifasByCampana(campanaId) {
  return check(
    await supabase.from('rifas').select('*').eq('campana_id', campanaId).order('created_at'),
    'getRifasByCampana'
  )
}

export async function getRifa(id) {
  return check(
    await supabase.from('rifas').select('*').eq('id', id).single(),
    'getRifa'
  )
}

/**
 * Devuelve rifas de una campaña con resumen de boletos (2 queries paralelas).
 */
export async function getRifasConResumen(campanaId) {
  const [rifasRes, bolRes] = await Promise.all([
    supabase.from('rifas').select('*').eq('campana_id', campanaId).order('created_at'),
    supabase.from('vista_saldo_boletos')
      .select('rifa_id, estatus, total_pagado')
      .eq('campana_id', campanaId),
  ])
  check(rifasRes, 'getRifasConResumen:rifas')
  check(bolRes,   'getRifasConResumen:boletos')

  const resumenMap = {}
  for (const b of bolRes.data) {
    if (!resumenMap[b.rifa_id]) {
      resumenMap[b.rifa_id] = { total: 0, disponible: 0, apartado: 0, liquidado: 0, vencido: 0, recaudado: 0 }
    }
    resumenMap[b.rifa_id].total++
    resumenMap[b.rifa_id][b.estatus.toLowerCase()]++
    resumenMap[b.rifa_id].recaudado += Number(b.total_pagado)
  }

  const EMPTY = { total: 0, disponible: 0, apartado: 0, liquidado: 0, vencido: 0, recaudado: 0 }
  return rifasRes.data.map(r => ({ ...r, resumen: resumenMap[r.id] ?? EMPTY }))
}

/**
 * Crea la rifa y genera automáticamente sus boletos en la BD.
 * Numeración siempre 1–N.
 */
export async function insertRifa(data) {
  const rifa = check(
    await supabase.from('rifas').insert({
      campana_id:       data.campana_id,
      nombre_premio:    data.nombre_premio,
      descripcion:      data.descripcion || null,
      precio_boleto:    Number(data.precio_boleto),
      cantidad_boletos: Number(data.cantidad_boletos),
      fecha_sorteo:     data.fecha_sorteo || null,
      estatus:          data.estatus || 'Activa',
      horas_expiracion: Number(data.horas_expiracion) || 24,
    }).select().single(),
    'insertRifa'
  )

  const n    = rifa.cantidad_boletos
  const rows = []
  for (let i = 1; i <= n; i++) {
    rows.push({ rifa_id: rifa.id, numero_asignado: i, estatus: 'Disponible' })
  }
  // Insertar en lotes de 1000 para respetar límites de Supabase
  for (let i = 0; i < rows.length; i += 1000) {
    check(
      await supabase.from('boletos').insert(rows.slice(i, i + 1000)),
      'insertRifa:boletos'
    )
  }
  return rifa
}

export async function updateRifa(id, data) {
  return check(
    await supabase.from('rifas').update(data).eq('id', id).select().single(),
    'updateRifa'
  )
}

export async function deleteRifa(id) {
  return check(
    await supabase.from('rifas').delete().eq('id', id),
    'deleteRifa'
  )
}

/**
 * Recalcula el estatus de los boletos asignados tras un cambio de precio.
 * - Apartado/Vencido cuyo total_pagado >= nuevoPrecio  → Liquidado
 * - Liquidado cuyo total_pagado < nuevoPrecio           → Apartado
 */
export async function recalcularEstatusPorPrecio(rifaId, nuevoPrecio) {
  if (!rifaId || !nuevoPrecio) return
  const precio = Number(nuevoPrecio)

  // Obtener todos los boletos asignados de la rifa con su total_pagado
  const { data: boletos, error } = await supabase
    .from('vista_saldo_boletos')
    .select('id, estatus, total_pagado')
    .eq('rifa_id', rifaId)
    .not('participante_id', 'is', null)
  if (error) throw error

  const aLiquidar = boletos.filter(b =>
    (b.estatus === 'Apartado' || b.estatus === 'Vencido') && Number(b.total_pagado) >= precio
  ).map(b => b.id)

  const aApartar = boletos.filter(b =>
    b.estatus === 'Liquidado' && Number(b.total_pagado) < precio
  ).map(b => b.id)

  await Promise.all([
    aLiquidar.length
      ? supabase.from('boletos').update({ estatus: 'Liquidado' }).in('id', aLiquidar)
      : Promise.resolve(),
    aApartar.length
      ? supabase.from('boletos').update({ estatus: 'Apartado' }).in('id', aApartar)
      : Promise.resolve(),
  ])
}

// =============================================================================
// BOLETOS
// =============================================================================

/**
 * Carga todos los boletos de una rifa desde la vista con saldo calculado.
 */
export async function getBoletosByRifa(rifaId) {
  return check(
    await supabase
      .from('vista_saldo_boletos')
      .select('*')
      .eq('rifa_id', rifaId)
      .order('numero_asignado'),
    'getBoletosByRifa'
  )
}

export async function getBoleto(id) {
  return check(
    await supabase.from('vista_saldo_boletos').select('*').eq('id', id).single(),
    'getBoleto'
  )
}

/**
 * Aparta un boleto asignando participante y registrando abono inicial (opcional).
 * Si montoInicial cubre el precio_boleto completo, el boleto queda Liquidado directamente.
 * nombreParticipante se desnormaliza en el boleto para preservarlo si el participante se elimina.
 */
export async function asignarBoleto(boletoId, participanteId, montoInicial, precioBoleto, nombreParticipante) {
  const monto  = Number(montoInicial) || 0
  const precio = Number(precioBoleto) || 0
  const nuevoEstatus = (precio > 0 && monto >= precio) ? 'Liquidado' : 'Apartado'

  check(
    await supabase.from('boletos').update({
      participante_id:     participanteId,
      nombre_participante: nombreParticipante ?? null,
      estatus:             nuevoEstatus,
      fecha_apartado:      new Date().toISOString(),
    }).eq('id', boletoId),
    'asignarBoleto'
  )
  if (monto > 0) {
    check(
      await supabase.from('historial_pagos_rifa').insert({
        boleto_id:   boletoId,
        monto,
        fecha:       new Date().toISOString().slice(0, 10),
        metodo_pago: 'Efectivo',
      }),
      'asignarBoleto:pago'
    )
  }
}

/**
 * Marca el boleto como Liquidado.
 * Si aún hay saldo pendiente, inserta automáticamente un pago por el monto restante
 * para que total_pagado = precio_boleto.
 */
export async function liquidarBoleto(boletoId, saldoPendiente = 0) {
  const saldo = Number(saldoPendiente)
  if (saldo > 0) {
    check(
      await supabase.from('historial_pagos_rifa').insert({
        boleto_id:   boletoId,
        monto:       saldo,
        fecha:       new Date().toISOString().slice(0, 10),
        metodo_pago: 'Liquidación directa',
      }),
      'liquidarBoleto:pago'
    )
  }
  check(
    await supabase.from('boletos').update({ estatus: 'Liquidado' }).eq('id', boletoId),
    'liquidarBoleto'
  )
}

export async function revertirApartado(boletoId) {
  return check(
    await supabase.from('boletos').update({
      estatus:        'Apartado',
      fecha_apartado: new Date().toISOString(), // reinicia el contador de caducidad
    }).eq('id', boletoId),
    'revertirApartado'
  )
}

/**
 * Reemplaza solo el participante asignado a un boleto, sin tocar pagos ni estatus.
 */
export async function reemplazarParticipante(boletoId, participanteId, nombreParticipante) {
  check(
    await supabase.from('boletos').update({
      participante_id:     participanteId,
      nombre_participante: nombreParticipante ?? null,
    }).eq('id', boletoId),
    'reemplazarParticipante'
  )
}

export async function liberarBoleto(boletoId) {
  check(
    await supabase.from('boletos').update({
      participante_id:     null,
      nombre_participante: null,
      estatus:             'Disponible',
      fecha_apartado:      null,
    }).eq('id', boletoId),
    'liberarBoleto'
  )
}

/**
 * Marca como "Vencido" los boletos apartados que superaron su tiempo de expiración.
 * Se ejecuta en el cliente al cargar la cuadrícula; en producción conviene
 * moverlo a un Edge Function de Supabase.
 */
export async function vencerBoletosExpirados(rifaId, horasExpiracion) {
  if (!rifaId || !horasExpiracion) return
  // cutoffDate viene del módulo puro boleto-expiry.js — sin acoplamiento a Supabase
  const expireDate = cutoffDate(horasExpiracion).toISOString()
  // Vencer Apartados que superaron el límite
  await supabase
    .from('boletos')
    .update({ estatus: 'Vencido' })
    .eq('rifa_id', rifaId)
    .eq('estatus', 'Apartado')
    .lt('fecha_apartado', expireDate)
  // Reactivar Vencidos que volvieron a quedar dentro del límite (ej: caducidad ampliada)
  await supabase
    .from('boletos')
    .update({ estatus: 'Apartado' })
    .eq('rifa_id', rifaId)
    .eq('estatus', 'Vencido')
    .gte('fecha_apartado', expireDate)
}

// =============================================================================
// PARTICIPANTES
// =============================================================================

/**
 * Lista todos los participantes con un resumen de boletos agregado.
 */
export async function getParticipantes() {
  const [partsRes, bolRes] = await Promise.all([
    supabase.from('participantes').select('*, grupo:grupos(id, nombre, color)').order('nombre_completo'),
    supabase
      .from('vista_saldo_boletos')
      .select('participante_id, estatus, total_pagado, saldo_pendiente')
      .not('participante_id', 'is', null),
  ])
  check(partsRes, 'getParticipantes:parts')
  check(bolRes,   'getParticipantes:boletos')

  const resMap = {}
  for (const b of bolRes.data) {
    const pid = b.participante_id
    if (!resMap[pid]) resMap[pid] = { total: 0, liquidados: 0, apartados: 0, vencidos: 0, pagado: 0, pendiente: 0 }
    resMap[pid].total++
    if (b.estatus === 'Liquidado') resMap[pid].liquidados++
    if (b.estatus === 'Apartado')  resMap[pid].apartados++
    if (b.estatus === 'Vencido')   resMap[pid].vencidos++
    resMap[pid].pagado    += Number(b.total_pagado)
    resMap[pid].pendiente += Math.max(0, Number(b.saldo_pendiente))
  }

  const EMPTY = { total: 0, liquidados: 0, apartados: 0, vencidos: 0, pagado: 0, pendiente: 0 }
  return partsRes.data.map(p => ({ ...p, resumen: resMap[p.id] ?? EMPTY }))
}

export async function getParticipante(id) {
  return check(
    await supabase.from('participantes').select('*, grupo:grupos(id, nombre, color)').eq('id', id).single(),
    'getParticipante'
  )
}

/**
 * Devuelve el participante + sus boletos activos agrupados por rifa.
 * Devuelve { participante: null, rifas: [] } si el participante no existe.
 */
export async function getParticipanteConBoletos(id) {
  const [partRes, bolRes] = await Promise.all([
    supabase.from('participantes').select('*, grupo:grupos(id, nombre, color)').eq('id', id).maybeSingle(),
    supabase
      .from('vista_saldo_boletos')
      .select('*')
      .eq('participante_id', id)
      .not('estatus', 'eq', 'Disponible')
      .order('numero_asignado'),
  ])
  check(partRes, 'getParticipanteConBoletos:part')
  check(bolRes,  'getParticipanteConBoletos:boletos')

  if (!partRes.data) return { participante: null, rifas: [] }

  // Agrupar boletos por rifa
  const rifaMap = {}
  for (const b of bolRes.data) {
    if (!rifaMap[b.rifa_id]) {
      rifaMap[b.rifa_id] = {
        rifa_id:          b.rifa_id,
        campana_id:       b.campana_id,
        nombre_premio:    b.nombre_premio,
        fecha_sorteo:     b.fecha_sorteo,
        precio_boleto:    b.precio_boleto,
        cantidad_boletos: b.cantidad_boletos,
        boletos:          [],
      }
    }
    rifaMap[b.rifa_id].boletos.push(b)
  }

  return { participante: partRes.data, rifas: Object.values(rifaMap) }
}

export async function insertParticipante(data) {
  return check(
    await supabase.from('participantes').insert(data).select().single(),
    'insertParticipante'
  )
}

export async function updateParticipante(id, data) {
  return check(
    await supabase.from('participantes').update(data).eq('id', id).select().single(),
    'updateParticipante'
  )
}

/**
 * Búsqueda por nombre o teléfono (mínimo 2 caracteres).
 */
export async function buscarParticipantes(query) {
  if (!query || query.trim().length < 2) return []
  const q = `%${query.trim()}%`
  const { data } = await supabase
    .from('participantes')
    .select('id, nombre_completo, telefono_whatsapp')
    .or(`nombre_completo.ilike.${q},telefono_whatsapp.ilike.${q}`)
    .limit(8)
  return data ?? []
}

/**
 * Elimina un participante.
 * Antes libera sus boletos Apartados (los pone Disponible) porque no hay pago real.
 * Los boletos Liquidados quedan con participante_id = NULL (el pago ya fue recibido).
 */
export async function deleteParticipante(id) {
  // Liberar boletos apartados (sin pago real) y borrar el nombre guardado
  await supabase
    .from('boletos')
    .update({ participante_id: null, nombre_participante: null, estatus: 'Disponible', fecha_apartado: null })
    .eq('participante_id', id)
    .eq('estatus', 'Apartado')
  return check(
    await supabase.from('participantes').delete().eq('id', id),
    'deleteParticipante'
  )
}

// =============================================================================
// PAGOS
// =============================================================================

export async function getPagosByBoleto(boletoId) {
  return check(
    await supabase
      .from('historial_pagos_rifa')
      .select('*')
      .eq('boleto_id', boletoId)
      .order('fecha', { ascending: false }),
    'getPagosByBoleto'
  )
}

// =============================================================================
// BITÁCORA DE MOVIMIENTOS
// =============================================================================

/**
 * Consulta la bitácora de movimientos de boletos con filtros y paginación.
 * @param {object} opts
 * @param {string|null} opts.campanaId     - Filtrar por campaña
 * @param {string|null} opts.rifaId        - Filtrar por rifa
 * @param {string|null} opts.estatusNuevo  - Filtrar por tipo de movimiento
 * @param {string|null} opts.grupoId       - Filtrar por grupo del participante
 * @param {string|null} opts.fechaDesde    - ISO date string (inclusive)
 * @param {string|null} opts.fechaHasta    - ISO date string (inclusive)
 * @param {string|null} opts.busqueda      - Texto libre en nombre_participante
 * @param {number}      opts.page          - Página (0-based)
 * @param {number}      opts.pageSize
 */
export async function getBitacora({
  campanaId    = null,
  rifaId       = null,
  estatusNuevo = null,
  grupoId      = null,
  fechaDesde   = null,
  fechaHasta   = null,
  busqueda     = null,
  page         = 0,
  pageSize     = 50,
} = {}) {
  let q = supabase
    .from('bitacora_boletos')
    .select(`
      id, created_at,
      boleto_id, rifa_id, campana_id, numero_asignado,
      estatus_anterior, estatus_nuevo, tipo_movimiento,
      nombre_participante, participante_id, grupo_id,
      rifa:rifas(id, nombre_premio),
      campana:campanas(id, nombre),
      grupo:grupos(id, nombre, color),
      participante:participantes(grupo:grupos(id, nombre, color))
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (campanaId)    q = q.eq('campana_id',   campanaId)
  if (rifaId)       q = q.eq('rifa_id',      rifaId)
  if (estatusNuevo) q = q.eq('estatus_nuevo', estatusNuevo)
  if (grupoId)      q = q.eq('grupo_id',     grupoId)
  if (fechaDesde)   q = q.gte('created_at',  fechaDesde)
  if (fechaHasta) {
    // Incluir todo el día hasta
    const hasta = new Date(fechaHasta)
    hasta.setDate(hasta.getDate() + 1)
    q = q.lt('created_at', hasta.toISOString())
  }
  if (busqueda?.trim()) {
    q = q.ilike('nombre_participante', `%${busqueda.trim()}%`)
  }

  const { data, error, count } = await q
  if (error) { console.error('[rifas] getBitacora', error); throw error }
  return { movimientos: data ?? [], total: count ?? 0 }
}

/**
 * Historial global de pagos con información del boleto, rifa, campaña y participante.
 * Soporta paginación y filtro por campana.
 */
export async function getHistorialGlobal({ campanaId = null, page = 0, pageSize = 50 } = {}) {
  let query = supabase
    .from('historial_pagos_rifa')
    .select(`
      id, monto, fecha, created_at, metodo_pago,
      boleto:boletos(
        id, numero_asignado, estatus,
        nombre_participante,
        participante_id,
        participantes(id, nombre_completo, telefono_whatsapp),
        rifa:rifas(id, nombre_premio, campana_id, precio_boleto,
          campana:campanas(id, nombre))
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (campanaId) {
    query = query.eq('boleto.rifa.campana_id', campanaId)
  }

  const { data, error, count } = await query
  if (error) { console.error('[rifas] getHistorialGlobal', error); throw error }
  return { pagos: data ?? [], total: count ?? 0 }
}

/**
 * Boletos pendientes de pago (Apartado o Vencido con participante asignado).
 * Devuelve datos enriquecidos desde vista_saldo_boletos.
 * Soporta filtro por campana, por rifa y por estatus.
 */
export async function getPendientes({ campanaId = null, rifaId = null, estatus = null } = {}) {
  let query = supabase
    .from('vista_saldo_boletos')
    .select('*')
    .not('participante_id', 'is', null)
    .gt('saldo_pendiente', 0)
    .order('fecha_apartado', { ascending: true })

  if (estatus)   query = query.eq('estatus', estatus)
  else           query = query.in('estatus', ['Apartado', 'Vencido'])

  if (rifaId)    query = query.eq('rifa_id', rifaId)
  if (campanaId) query = query.eq('campana_id', campanaId)

  return check(await query, 'getPendientes')
}

export async function insertPagoRifa(data) {
  return check(
    await supabase.from('historial_pagos_rifa').insert(data).select().single(),
    'insertPagoRifa'
  )
}

export async function deletePagoRifa(id) {
  return check(
    await supabase.from('historial_pagos_rifa').delete().eq('id', id),
    'deletePagoRifa'
  )
}

// =============================================================================
// SORTEO / GANADORES
// =============================================================================

/**
 * Persiste el array de ganadores en la columna ganadores de rifas.
 * SQL requerido: ALTER TABLE rifas ADD COLUMN IF NOT EXISTS ganadores jsonb DEFAULT '[]'::jsonb;
 */
export async function saveGanadores(rifaId, ganadores) {
  return check(
    await supabase.from('rifas').update({ ganadores }).eq('id', rifaId),
    'saveGanadores'
  )
}

/**
 * Elige un ganador aleatorio entre los boletos con estatus "Liquidado".
 * @param {string}   rifaId      - UUID de la rifa
 * @param {string[]} excluirIds  - UUIDs de boletos ya elegidos (para 2do, 3er lugar)
 */
export async function elegirGanador(rifaId, excluirIds = []) {
  let query = supabase
    .from('boletos')
    .select('id, numero_asignado, participante_id, nombre_participante, participantes(id, nombre_completo, telefono_whatsapp)')
    .eq('rifa_id', rifaId)
    .eq('estatus', 'Liquidado')

  if (excluirIds.length > 0) {
    query = query.not('id', 'in', `(${excluirIds.join(',')})`)
  }

  const { data } = await query
  if (!data || data.length === 0) return null
  return data[Math.floor(Math.random() * data.length)]
}

// =============================================================================
// PERFIL PÚBLICO (/mis-boletos)
// =============================================================================

/**
 * Permite a un comprador ver sus boletos ingresando su número de teléfono.
 * Accesible sin autenticación (requiere políticas RLS anon READ).
 */
export async function getMisBoletos(telefono) {
  if (!telefono?.trim()) return { participante: null, boletos: [] }

  const tel = normalizePhone(telefono) || telefono.trim()

  const { data: parts } = await supabase
    .from('participantes')
    .select('id, nombre_completo, email')
    .eq('telefono_whatsapp', tel)
    .limit(1)

  if (!parts?.length) return { participante: null, boletos: [] }
  const participante = parts[0]

  const { data: boletos } = await supabase
    .from('boletos')
    .select(`
      id, numero_asignado, estatus, fecha_apartado,
      rifa:rifas(id, nombre_premio, fecha_sorteo, precio_boleto, cantidad_boletos, ganadores),
      pagos:historial_pagos_rifa(monto, fecha, metodo_pago)
    `)
    .eq('participante_id', participante.id)
    .not('estatus', 'eq', 'Disponible')
    .order('numero_asignado')

  const enriched = (boletos ?? []).map(b => {
    const totalPagado = (b.pagos ?? []).reduce((s, p) => s + Number(p.monto), 0)
    const ganadoresRifa = b.rifa?.ganadores ?? []
    const posicionGanador = ganadoresRifa.findIndex(g => g.id === b.id)
    return {
      id:              b.id,
      numero_asignado: b.numero_asignado,
      estatus:         b.estatus,
      fecha_apartado:  b.fecha_apartado,
      rifa:            b.rifa,
      pagos:           b.pagos ?? [],
      total_pagado:    totalPagado,
      saldo_pendiente: Number(b.rifa?.precio_boleto ?? 0) - totalPagado,
      es_ganador:      posicionGanador >= 0,
      posicion_ganador: posicionGanador >= 0 ? posicionGanador + 1 : null,
    }
  })

  return { participante, boletos: enriched }
}

// =============================================================================
// IMPORTACIÓN CSV
// =============================================================================

/**
 * Importa boletos desde filas de CSV ya parseadas.
 * @param {string}   rifaId       - UUID de la rifa
 * @param {Array}    filas        - [{numero, nombre, contacto, pagado, fecha}]
 * @param {number}   precioBoleto - para registrar el pago si pagado===true
 */
export async function importarBoletos(rifaId, filas, precioBoleto) {
  const conNombre = filas.filter(f => f.nombre?.trim())
  if (conNombre.length === 0) return { importados: 0, saltados: 0 }

  const normalize = s => s.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // 1. Obtener todos los boletos de la rifa
  const { data: boletosList } = await supabase
    .from('boletos')
    .select('id, numero_asignado, estatus')
    .eq('rifa_id', rifaId)
  const boletoMap = Object.fromEntries(
    (boletosList ?? []).map(b => [b.numero_asignado, b])
  )

  // 2. Resolver grupos del CSV → crear los que no existan y construir mapa nombre→id
  const grupoNames = [...new Set(conNombre.map(f => f.grupo?.trim()).filter(Boolean))]
  const grupoMap = {}   // nombre_normalizado → grupo_id
  if (grupoNames.length > 0) {
    const { data: existingGrupos } = await supabase
      .from('grupos').select('id, nombre').in('nombre', grupoNames)
    for (const g of existingGrupos ?? []) grupoMap[normalize(g.nombre)] = g.id

    const missingGrupos = grupoNames.filter(n => !grupoMap[normalize(n)])
    if (missingGrupos.length > 0) {
      const { data: createdGrupos } = await supabase
        .from('grupos').insert(missingGrupos.map(nombre => ({ nombre }))).select('id, nombre')
      for (const g of createdGrupos ?? []) grupoMap[normalize(g.nombre)] = g.id
    }
  }

  // 3. Nombres únicos de participantes
  const uniqueNames = [...new Set(conNombre.map(f => f.nombre.trim()))]

  // 4. Buscar participantes existentes
  const { data: existing } = await supabase
    .from('participantes')
    .select('id, nombre_completo')
    .in('nombre_completo', uniqueNames)
  const partMap = {}
  for (const p of existing ?? []) partMap[normalize(p.nombre_completo)] = p.id

  // 5. Crear participantes faltantes (con grupo si viene en el CSV)
  const missing = uniqueNames.filter(n => !partMap[normalize(n)])
  if (missing.length > 0) {
    const toInsert = missing.map(nombre => {
      const fila = conNombre.find(f => f.nombre.trim() === nombre)
      const grupoNorm = normalize(fila?.grupo ?? '')
      return {
        nombre_completo:   nombre,
        telefono_whatsapp: fila?.contacto?.trim() || null,
        grupo_id:          grupoMap[grupoNorm] ?? null,
      }
    })
    const { data: created } = await supabase
      .from('participantes').insert(toInsert).select('id, nombre_completo')
    for (const p of created ?? []) partMap[normalize(p.nombre_completo)] = p.id
  }

  // 6. Para participantes YA existentes, actualizar grupo si viene en el CSV y aún no tienen
  for (const nombre of uniqueNames.filter(n => partMap[normalize(n)])) {
    const fila = conNombre.find(f => f.nombre.trim() === nombre)
    if (!fila?.grupo?.trim()) continue
    const grupoId = grupoMap[normalize(fila.grupo.trim())]
    if (grupoId) {
      await supabase.from('participantes')
        .update({ grupo_id: grupoId })
        .eq('id', partMap[normalize(nombre)])
        .is('grupo_id', null)   // solo si aún no tiene grupo asignado
    }
  }

  // 7. Actualizar boletos y recopilar pagos a insertar
  let importados = 0, saltados = 0
  const pagosInsert = []

  for (const fila of conNombre) {
    const boleto = boletoMap[fila.numero]
    if (!boleto || boleto.estatus !== 'Disponible') { saltados++; continue }
    const pid = partMap[normalize(fila.nombre.trim())]
    if (!pid) { saltados++; continue }

    const estatus = fila.pagado ? 'Liquidado' : 'Apartado'
    const fecha   = fila.fecha ?? new Date().toISOString().slice(0, 10)

    await supabase.from('boletos').update({
      participante_id: pid,
      estatus,
      fecha_apartado:  fecha,
    }).eq('id', boleto.id)

    if (fila.pagado && Number(precioBoleto) > 0) {
      pagosInsert.push({
        boleto_id:   boleto.id,
        monto:       Number(precioBoleto),
        fecha,
        metodo_pago: 'Importación CSV',
      })
    }
    importados++
  }

  // 6. Insertar todos los pagos en lote
  if (pagosInsert.length > 0) {
    await supabase.from('historial_pagos_rifa').insert(pagosInsert)
  }

  return { importados, saltados }
}

// =============================================================================
// GRÁFICAS / REPORTES
// =============================================================================

/**
 * Recaudación por mes (últimos 6 meses).
 * Para gráfica: LineChart con fechas y montos.
 */
export async function getRecaudacionPorDia({ desde, hasta } = {}) {
  const inicio = desde ?? (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d })();
  const fin    = hasta ?? new Date()

  const { data, error } = await supabase
    .from('historial_pagos_rifa')
    .select('created_at, monto')
    .gte('created_at', inicio instanceof Date ? inicio.toISOString() : inicio)
    .lte('created_at', fin instanceof Date ? fin.toISOString() : fin)
  check({ data, error }, 'getRecaudacionPorDia')

  const resumen = {}
  for (const p of data ?? []) {
    const key = new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    resumen[key] = (resumen[key] ?? 0) + Number(p.monto)
  }

  const result = []
  const cur = new Date(inicio)
  while (cur <= fin) {
    const key = cur.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    result.push({ dia: key, recaudado: resumen[key] ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

/**
 * Boletos apartados por día (últimos 30 días).
 * Fuente: bitacora_boletos donde estatus_nuevo = 'Apartado'.
 */
export async function getApartadosPorDia({ desde, hasta } = {}) {
  const inicio = desde ?? (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d })()
  const fin    = hasta ?? new Date()

  const { data, error } = await supabase
    .from('bitacora_boletos')
    .select('created_at')
    .eq('estatus_nuevo', 'Apartado')
    .gte('created_at', inicio instanceof Date ? inicio.toISOString() : inicio)
    .lte('created_at', fin instanceof Date ? fin.toISOString() : fin)
  check({ data, error }, 'getApartadosPorDia')

  const resumen = {}
  for (const b of data ?? []) {
    const key = new Date(b.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    resumen[key] = (resumen[key] ?? 0) + 1
  }

  const result = []
  const cur = new Date(inicio)
  while (cur <= fin) {
    const key = cur.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    result.push({ dia: key, apartados: resumen[key] ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

/**
 * Nuevos participantes por día (últimos 30 días).
 * Para gráfica: BarChart de adquisición.
 */
export async function getNuevosParticipantesPorDia({ desde, hasta } = {}) {
  const inicio = desde ?? (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d })()
  const fin    = hasta ?? new Date()

  const { data, error } = await supabase
    .from('participantes')
    .select('created_at')
    .gte('created_at', inicio instanceof Date ? inicio.toISOString() : inicio)
    .lte('created_at', fin instanceof Date ? fin.toISOString() : fin)
  check({ data, error }, 'getNuevosParticipantesPorDia')

  const resumen = {}
  for (const p of data ?? []) {
    const key = new Date(p.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    resumen[key] = (resumen[key] ?? 0) + 1
  }

  const result = []
  const cur = new Date(inicio)
  while (cur <= fin) {
    const key = cur.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
    result.push({ dia: key, participantes: resumen[key] ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

export async function getRecaudacionPorMes() {
  const hace6Meses = new Date()
  hace6Meses.setMonth(hace6Meses.getMonth() - 6)
  const fechaLimite = hace6Meses.toISOString()

  const { data, error } = await supabase
    .from('historial_pagos_rifa')
    .select('created_at, monto')
    .gte('created_at', fechaLimite)
  check({ data, error }, 'getRecaudacionPorMes')

  const resumenPorMes = {}
  for (const p of data) {
    const fecha = new Date(p.created_at)
    const mesAño = fecha.toLocaleString('es-MX', { month: 'short', year: 'numeric' })
    resumenPorMes[mesAño] = (resumenPorMes[mesAño] ?? 0) + Number(p.monto)
  }
  
  return Object.entries(resumenPorMes).map(([mes, monto]) => ({
    mes,
    recaudado: monto,
  }))
}

/**
 * Boletos por estatus en una rifa.
 * Para gráfica: PieChart.
 */
export async function getBoletosPorEstatus(rifaId) {
  const { data, error } = await supabase
    .from('boletos')
    .select('estatus')
    .eq('rifa_id', rifaId)
  check({ data, error }, 'getBoletosPorEstatus')
  
  const resumen = {}
  for (const b of data ?? []) {
    resumen[b.estatus] = (resumen[b.estatus] ?? 0) + 1
  }
  return Object.entries(resumen).map(([estatus, count]) => ({
    name: estatus,
    value: count,
  }))
}

/**
 * Boletos por estatus en TODAS las rifas de una campaña.
 * Para gráfica: PieChart agregado.
 */
export async function getBoletosPorEstatusCampana(campanaId) {
  // Primero obtenemos los IDs de todas las rifas de la campaña
  const { data: rifas, error: rifasError } = await supabase
    .from('rifas')
    .select('id')
    .eq('campana_id', campanaId)
  check({ data: rifas, error: rifasError }, 'getBoletosPorEstatusCampana - get rifas')
  
  if (!rifas || rifas.length === 0) return []
  
  const rifaIds = rifas.map(r => r.id)
  
  // Luego obtenemos todos los boletos de esas rifas
  const { data, error } = await supabase
    .from('boletos')
    .select('estatus')
    .in('rifa_id', rifaIds)
  check({ data, error }, 'getBoletosPorEstatusCampana')
  
  const resumen = {}
  for (const b of data ?? []) {
    resumen[b.estatus] = (resumen[b.estatus] ?? 0) + 1
  }
  return Object.entries(resumen).map(([estatus, count]) => ({
    name: estatus,
    value: count,
  }))
}

/**
 * Recaudación vs Meta para cada rifa de una campaña.
 * Para gráfica: BarChart comparativo.
 */
export async function getRecaudacionVsMeta(campanaId) {
  const { data, error } = await supabase
    .from('rifas')
    .select(`
      id, nombre_premio, precio_boleto, cantidad_boletos,
      boletos(
        id,
        historial_pagos_rifa(monto)
      )
    `)
    .eq('campana_id', campanaId)
  check({ data, error }, 'getRecaudacionVsMeta')

  return (data ?? []).map(r => ({
    nombre: r.nombre_premio.substring(0, 12),
    meta: Number(r.precio_boleto) * r.cantidad_boletos,
    recaudado: (r.boletos ?? []).reduce((s, b) => {
      return s + (b.historial_pagos_rifa ?? []).reduce((ps, p) => ps + Number(p.monto), 0)
    }, 0),
  }))
}

/**
 * Recaudación por método de pago (últimos 30 días).
 * Para gráfica: BarChart o PieChart.
 */
export async function getRecaudacionPorMetodoPago() {
  const hace30Dias = new Date()
  hace30Dias.setDate(hace30Dias.getDate() - 30)
  const fechaLimite = hace30Dias.toISOString()

  const { data, error } = await supabase
    .from('historial_pagos_rifa')
    .select('metodo_pago, monto')
    .gte('created_at', fechaLimite)
  check({ data, error }, 'getRecaudacionPorMetodoPago')

  const resumen = {}
  for (const p of data) {
    const metodo = p.metodo_pago || 'Sin especificar'
    resumen[metodo] = (resumen[metodo] ?? 0) + Number(p.monto)
  }
  return Object.entries(resumen).map(([metodo, monto]) => ({
    name: metodo,
    value: monto,
  }))
}

/**
 * Distribución de boletos (liquidados + apartados) por grupo social.
 * Para gráfica: PieChart.
 */
export async function getBoletosPorGrupo() {
  const { data, error } = await supabase
    .from('boletos')
    .select(`
      estatus,
      participantes(
        grupo_id,
        grupos(nombre, color)
      )
    `)
    .in('estatus', ['Liquidado', 'Apartado'])
  check({ data, error }, 'getBoletosPorGrupo')

  const resumen = {}
  for (const b of data ?? []) {
    const grupo = b.participantes?.grupos?.nombre ?? 'Sin grupo'
    const color = b.participantes?.grupos?.color ?? '#6366f1'
    if (!resumen[grupo]) resumen[grupo] = { name: grupo, value: 0, color }
    resumen[grupo].value++
  }
  return Object.values(resumen).sort((a, b) => b.value - a.value)
}

/**
 * Top 5 participantes con más boletos (liquidados + apartados).
 * Para gráfica: BarChart horizontal.
 */
export async function getTop5ParticipantesPorBoletos() {
  const { data, error } = await supabase
    .from('boletos')
    .select(`
      participante_id,
      participantes(nombre_completo)
    `)
    .in('estatus', ['Liquidado', 'Apartado'])
  check({ data, error }, 'getTop5ParticipantesPorBoletos')

  const resumen = {}
  for (const b of data ?? []) {
    if (!b.participante_id) continue
    const nombre = b.participantes?.nombre_completo ?? 'Desconocido'
    resumen[b.participante_id] = {
      name: nombre.split(' ').slice(0, 2).join(' '), // primeros 2 nombres
      value: (resumen[b.participante_id]?.value ?? 0) + 1,
    }
  }
  return Object.values(resumen)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
}
