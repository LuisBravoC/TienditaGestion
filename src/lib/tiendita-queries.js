import { supabase } from './supabase.js'

// ── Helper de error (mismo patrón que rifas-queries.js) ──────────────────────
function check({ data, error }, label) {
  if (error) {
    console.error(`[tiendita] ${label ?? ''}`, error)
    throw error
  }
  return data
}

// ════════════════════════════════════════════════════════════════════════════════
// CATEGORÍAS DE PRODUCTO
// ════════════════════════════════════════════════════════════════════════════════

export async function getCategorias() {
  return check(
    await supabase.from('categorias_producto').select('*').order('nombre'),
    'getCategorias'
  )
}

export async function insertCategoria(payload) {
  return check(
    await supabase.from('categorias_producto').insert(payload).select().single(),
    'insertCategoria'
  )
}

export async function updateCategoria(id, payload) {
  return check(
    await supabase.from('categorias_producto').update(payload).eq('id', id).select().single(),
    'updateCategoria'
  )
}

export async function deleteCategoria(id) {
  return check(
    await supabase.from('categorias_producto').delete().eq('id', id),
    'deleteCategoria'
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// PRODUCTOS
// ════════════════════════════════════════════════════════════════════════════════

export async function getProductos() {
  return check(
    await supabase
      .from('vista_stock_productos')
      .select('*')
      .order('nombre'),
    'getProductos'
  )
}

export async function getProducto(id) {
  return check(
    await supabase
      .from('vista_stock_productos')
      .select('*')
      .eq('id', id)
      .single(),
    'getProducto'
  )
}

export async function insertProducto(payload) {
  return check(
    await supabase.from('productos').insert(payload).select().single(),
    'insertProducto'
  )
}

export async function updateProducto(id, payload) {
  return check(
    await supabase.from('productos').update(payload).eq('id', id).select().single(),
    'updateProducto'
  )
}

export async function deleteProducto(id) {
  return check(
    await supabase.from('productos').delete().eq('id', id),
    'deleteProducto'
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// MOVIMIENTOS DE STOCK (historial unificado para la ficha de producto)
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Devuelve todos los movimientos de stock de un producto en orden cronológico:
 * recepciones de pedidos, ventas y ajustes manuales.
 */
export async function getMovimientosStock(productoId) {
  const [pedidosRes, ventasRes, ajustesRes] = await Promise.all([
    // Entradas por pedidos recibidos
    supabase
      .from('pedido_items')
      .select('cantidad, created_at, pedido_id, pedidos_compra(estado, fecha_recibido)')
      .eq('producto_id', productoId)
      .eq('pedidos_compra.estado', 'recibido'),
    // Salidas por ventas
    supabase
      .from('venta_items')
      .select('cantidad, created_at, venta_id, ventas(fecha_venta, nombre_cliente, participante_id, participantes(nombre_completo))')
      .eq('producto_id', productoId),
    // Ajustes manuales
    supabase
      .from('ajustes_stock')
      .select('*')
      .eq('producto_id', productoId)
      .order('created_at', { ascending: false }),
  ])

  check(pedidosRes, 'getMovimientosStock:pedidos')
  check(ventasRes,  'getMovimientosStock:ventas')
  check(ajustesRes, 'getMovimientosStock:ajustes')

  const entradas = (pedidosRes.data ?? [])
    .filter(i => i.pedidos_compra?.estado === 'recibido')
    .map(i => ({
      tipo:      'pedido',
      cantidad:  +i.cantidad,
      fecha:     i.pedidos_compra?.fecha_recibido ?? i.created_at,
      label:     `Pedido recibido`,
      referencia: i.pedido_id,
    }))

  const salidas = (ventasRes.data ?? []).map(i => ({
    tipo:      'venta',
    cantidad:  -i.cantidad,
    fecha:     i.ventas?.fecha_venta ?? i.created_at,
    label:     `Venta a ${i.ventas?.participantes?.nombre_completo ?? i.ventas?.nombre_cliente ?? 'cliente'}`,
    referencia: i.venta_id,
  }))

  const manuales = (ajustesRes.data ?? []).map(i => ({
    tipo:      'ajuste',
    cantidad:  i.cantidad,
    fecha:     i.created_at,
    label:     i.motivo.charAt(0).toUpperCase() + i.motivo.slice(1),
    notas:     i.notas,
    referencia: i.id,
  }))

  return [...entradas, ...salidas, ...manuales].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// AJUSTES DE STOCK
// ════════════════════════════════════════════════════════════════════════════════

export async function insertAjusteStock(payload) {
  return check(
    await supabase.from('ajustes_stock').insert(payload).select().single(),
    'insertAjusteStock'
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// PEDIDOS DE COMPRA
// ════════════════════════════════════════════════════════════════════════════════

export async function getPedidos() {
  return check(
    await supabase
      .from('pedidos_compra')
      .select('*, pedido_items(id, cantidad, costo_real, producto_id, productos(nombre))')
      .order('fecha_compra', { ascending: false }),
    'getPedidos'
  )
}

export async function getPedido(id) {
  return check(
    await supabase
      .from('pedidos_compra')
      .select('*, pedido_items(*, productos(nombre, precio_venta))')
      .eq('id', id)
      .single(),
    'getPedido'
  )
}

export async function insertPedido(pedido, items) {
  // 1. Crear el pedido
  const pedidoCreado = check(
    await supabase.from('pedidos_compra').insert(pedido).select().single(),
    'insertPedido:pedido'
  )
  // 2. Insertar los items con el pedido_id
  if (items?.length) {
    check(
      await supabase.from('pedido_items').insert(
        items.map(i => ({ ...i, pedido_id: pedidoCreado.id }))
      ),
      'insertPedido:items'
    )
  }
  return pedidoCreado
}

export async function updatePedido(id, payload) {
  return check(
    await supabase.from('pedidos_compra').update(payload).eq('id', id).select().single(),
    'updatePedido'
  )
}

export async function updatePedidoConItems(id, pedidoPayload, items) {
  check(
    await supabase.from('pedidos_compra').update(pedidoPayload).eq('id', id),
    'updatePedidoConItems:header'
  )
  check(
    await supabase.from('pedido_items').delete().eq('pedido_id', id),
    'updatePedidoConItems:delete'
  )
  if (items?.length) {
    check(
      await supabase.from('pedido_items').insert(
        items.map(i => ({ ...i, pedido_id: id }))
      ),
      'updatePedidoConItems:items'
    )
  }
}

export async function deletePedido(id) {
  return check(
    await supabase.from('pedidos_compra').delete().eq('id', id),
    'deletePedido'
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// VENTAS
// ════════════════════════════════════════════════════════════════════════════════

export async function getVentas() {
  return check(
    await supabase
      .from('vista_ventas_completa')
      .select('*')
      .order('fecha_venta', { ascending: false }),
    'getVentas'
  )
}

export async function getVentasDeProducto(productoId) {
  return check(
    await supabase
      .from('venta_items')
      .select('cantidad, precio_unitario_acordado, created_at, venta_id, ventas(fecha_venta, estado_entrega, nombre_cliente, participante_id, participantes(nombre_completo))')
      .eq('producto_id', productoId)
      .order('created_at', { ascending: false }),
    'getVentasDeProducto'
  )
}

export async function getVentasDeCliente(participanteId) {
  return check(
    await supabase
      .from('vista_ventas_completa')
      .select('*')
      .eq('participante_id', participanteId)
      .order('fecha_venta', { ascending: false }),
    'getVentasDeCliente'
  )
}

export async function getApartadosPendientes() {
  return check(
    await supabase
      .from('vista_apartados_pendientes')
      .select('*')
      .order('fecha_venta', { ascending: false }),
    'getApartadosPendientes'
  )
}

/**
 * Crea una venta con sus ítems en una operación atómica.
 */
export async function insertVenta(venta, items) {
  const ventaCreada = check(
    await supabase.from('ventas').insert(venta).select().single(),
    'insertVenta:venta'
  )
  if (items?.length) {
    check(
      await supabase.from('venta_items').insert(
        items.map(i => ({ ...i, venta_id: ventaCreada.id }))
      ),
      'insertVenta:items'
    )
  }
  return ventaCreada
}

export async function updateVenta(id, payload) {
  return check(
    await supabase.from('ventas').update(payload).eq('id', id).select().single(),
    'updateVenta'
  )
}

export async function deleteVenta(id) {
  return check(
    await supabase.from('ventas').delete().eq('id', id),
    'deleteVenta'
  )
}

export async function getItemsDeVenta(ventaId) {
  return check(
    await supabase
      .from('venta_items')
      .select('*, productos(nombre, precio_venta)')
      .eq('venta_id', ventaId)
      .order('created_at'),
    'getItemsDeVenta'
  )
}

export async function updateVentaConItems(id, ventaPayload, items) {
  check(
    await supabase.from('ventas').update(ventaPayload).eq('id', id),
    'updateVentaConItems:header'
  )
  check(
    await supabase.from('venta_items').delete().eq('venta_id', id),
    'updateVentaConItems:delete'
  )
  if (items?.length) {
    check(
      await supabase.from('venta_items').insert(
        items.map(i => ({ ...i, venta_id: id }))
      ),
      'updateVentaConItems:items'
    )
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// ABONOS DE VENTA (apartados)
// ════════════════════════════════════════════════════════════════════════════════

export async function getAbonosDeVenta(ventaId) {
  return check(
    await supabase
      .from('historial_abonos_venta')
      .select('*')
      .eq('venta_id', ventaId)
      .order('fecha', { ascending: false }),
    'getAbonosDeVenta'
  )
}

export async function insertAbono(payload) {
  return check(
    await supabase.from('historial_abonos_venta').insert(payload).select().single(),
    'insertAbono'
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// CLIENTES (sobre la tabla participantes)
// ════════════════════════════════════════════════════════════════════════════════

export async function getClientes() {
  return check(
    await supabase
      .from('participantes')
      .select('id, nombre_completo, telefono_whatsapp, email, direccion, notas, grupo_id, created_at')
      .order('nombre_completo'),
    'getClientes'
  )
}

/** Lista de clientes con conteo y total de ventas — para la página de Clientes */
export async function getClientesConResumen() {
  return check(
    await supabase
      .from('participantes')
      .select('id, nombre_completo, telefono_whatsapp, email, direccion, notas, grupo_id, created_at, ventas(id, precio_total)')
      .order('nombre_completo'),
    'getClientesConResumen'
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD — métricas de resumen para la pantalla de inicio
// ════════════════════════════════════════════════════════════════════════════════

/** Datos para las gráficas del dashboard (mes actual + top productos) */
export async function getDashboardCharts() {
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [ventasRes, itemsRes] = await Promise.all([
    supabase.from('ventas').select('fecha_venta, precio_total, metodo_pago').gte('fecha_venta', inicioMes),
    supabase.from('venta_items').select('cantidad, productos(nombre)'),
  ])
  check(ventasRes, 'charts:ventas')
  check(itemsRes,  'charts:items')

  const ventas = ventasRes.data ?? []
  const items  = itemsRes.data  ?? []

  // Ventas por día del mes
  const diaMap = {}
  ventas.forEach(v => {
    const d = v.fecha_venta.slice(8, 10) // DD
    diaMap[d] = (diaMap[d] ?? 0) + Number(v.precio_total)
  })
  const ventasDia = Object.entries(diaMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([dia, total]) => ({ dia, total }))

  // Método de pago
  const metodosMap = {}
  ventas.forEach(v => {
    const m = v.metodo_pago ?? 'Otro'
    metodosMap[m] = (metodosMap[m] ?? 0) + Number(v.precio_total)
  })
  const metodoPago = Object.entries(metodosMap)
    .sort(([, a], [, b]) => b - a)
    .map(([metodo, total]) => ({ metodo, total }))

  // Top 5 productos por unidades vendidas
  const prodMap = {}
  items.forEach(it => {
    const n = it.productos?.nombre ?? 'Desconocido'
    prodMap[n] = (prodMap[n] ?? 0) + Number(it.cantidad)
  })
  const topProductos = Object.entries(prodMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))

  return { ventasDia, metodoPago, topProductos }
}

/** Últimas N ventas para preview rápido en el dashboard */
export async function getVentasRecientes(limit = 5) {
  return check(
    await supabase
      .from('vista_ventas_completa')
      .select('id, nombre_cliente, precio_total, saldo_pendiente, estado_entrega, tipo, fecha_venta')
      .order('fecha_venta', { ascending: false })
      .order('id',          { ascending: false })
      .limit(limit),
    'getVentasRecientes'
  )
}

export async function getDashboardTiendita() {
  const [ventasMes, apartados, stockBajo, pedidosTransito] = await Promise.all([
    // Total vendido en el mes actual
    supabase
      .from('ventas')
      .select('precio_total')
      .gte('fecha_venta', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
    // Apartados pendientes de cobro
    supabase.from('vista_apartados_pendientes').select('id, saldo_pendiente'),
    // Productos con stock bajo (≤ 2 unidades)
    supabase.from('vista_stock_productos').select('id, nombre, stock_actual').lte('stock_actual', 2).eq('activo', true),
    // Pedidos en tránsito
    supabase.from('pedidos_compra').select('id').eq('estado', 'en_transito'),
  ])

  check(ventasMes,       'dashboard:ventasMes')
  check(apartados,       'dashboard:apartados')
  check(stockBajo,       'dashboard:stockBajo')
  check(pedidosTransito, 'dashboard:pedidosTransito')

  return {
    ventasMes:         (ventasMes.data ?? []).reduce((s, v) => s + Number(v.precio_total), 0),
    apartadosPendientes: {
      count:  (apartados.data ?? []).length,
      monto:  (apartados.data ?? []).reduce((s, a) => s + Number(a.saldo_pendiente), 0),
    },
    productosStockBajo: stockBajo.data ?? [],
    pedidosEnTransito:  (pedidosTransito.data ?? []).length,
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// QUERIES PAGINADAS — con filtros server-side y .range()
// Devuelven { data, count } en lugar de solo data[].
// ════════════════════════════════════════════════════════════════════════════════

function checkPaged({ data, count, error }, label) {
  if (error) {
    console.error(`[tiendita] ${label ?? ''}`, error)
    throw error
  }
  return { data: data ?? [], count: count ?? 0 }
}

/** Productos con stock — para la página ProductosList */
export async function getProductosPaginado({
  search = '', categoria_id = '', stockFiltro = '', page = 0, pageSize = 30,
} = {}) {
  let q = supabase
    .from('vista_stock_productos')
    .select('*', { count: 'exact' })
    .order('nombre')
  if (search.trim())             q = q.ilike('nombre', `%${search.trim()}%`)
  if (categoria_id)              q = q.eq('categoria_id', categoria_id)
  if (stockFiltro === 'ok')      q = q.gt('stock_actual', 2)
  if (stockFiltro === 'bajo')    q = q.gt('stock_actual', 0).lte('stock_actual', 2)
  if (stockFiltro === 'agotado') q = q.lte('stock_actual', 0)
  q = q.range(page * pageSize, (page + 1) * pageSize - 1)
  return checkPaged(await q, 'getProductosPaginado')
}

/** Pedidos de compra — para la página PedidosList */
export async function getPedidosPaginado({
  estadoFiltro = '', page = 0, pageSize = 20,
} = {}) {
  let q = supabase
    .from('pedidos_compra')
    .select('*, pedido_items(id, cantidad, costo_real, producto_id, productos(nombre))', { count: 'exact' })
    .order('fecha_compra', { ascending: false })
  if (estadoFiltro) q = q.eq('estado', estadoFiltro)
  q = q.range(page * pageSize, (page + 1) * pageSize - 1)
  return checkPaged(await q, 'getPedidosPaginado')
}

/** Ventas — para la página VentasList */
export async function getVentasPaginado({
  tipoFiltro = '', entregaFiltro = '', search = '',
  fechaDesde = '', fechaHasta = '',
  page = 0, pageSize = 25,
} = {}) {
  let q = supabase
    .from('vista_ventas_completa')
    .select('*', { count: 'exact' })
    .order('fecha_venta', { ascending: false })
  if (tipoFiltro)    q = q.eq('tipo', tipoFiltro)
  if (entregaFiltro) q = q.eq('estado_entrega', entregaFiltro)
  if (search.trim()) q = q.ilike('nombre_cliente', `%${search.trim()}%`)
  if (fechaDesde)    q = q.gte('fecha_venta', fechaDesde)
  if (fechaHasta)    q = q.lte('fecha_venta', fechaHasta)
  q = q.range(page * pageSize, (page + 1) * pageSize - 1)
  return checkPaged(await q, 'getVentasPaginado')
}

/** Clientes con resumen de ventas — para la página ClientesList */
export async function getClientesPaginado({
  search = '', page = 0, pageSize = 30,
} = {}) {
  let q = supabase
    .from('participantes')
    .select(
      'id, nombre_completo, telefono_whatsapp, email, direccion, notas, grupo_id, created_at, ventas(id, precio_total)',
      { count: 'exact' },
    )
    .order('nombre_completo')
  if (search.trim())
    q = q.or(
      `nombre_completo.ilike.%${search.trim()}%,telefono_whatsapp.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`,
    )
  q = q.range(page * pageSize, (page + 1) * pageSize - 1)
  return checkPaged(await q, 'getClientesPaginado')
}

