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

// ════════════════════════════════════════════════════════════════════════════════
// DASHBOARD — métricas de resumen para la pantalla de inicio
// ════════════════════════════════════════════════════════════════════════════════

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
