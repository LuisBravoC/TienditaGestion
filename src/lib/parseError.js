/**
 * parseError.js — Convierte errores de Supabase/Postgres en mensajes legibles.
 *
 * Uso:
 *   import { parseError } from '../lib/parseError.js'
 *   const { title, body } = parseError(supabaseError)
 */

// ── Mapa de restricciones FK → mensaje legible ───────────────────────────────
const FK_MAP = {
  // ── Tiendita ────────────────────────────────────────────────────────────────
  // productos ← pedido_items (RESTRICT: no se puede borrar un producto con compras)
  pedido_items_producto_id_fkey: {
    title: 'Producto con pedidos registrados',
    body:  'Este producto aparece en uno o más pedidos de compra. No se puede eliminar mientras tenga movimientos de entrada.',
  },
  // productos ← venta_items (RESTRICT: no se puede borrar un producto con ventas)
  venta_items_producto_id_fkey: {
    title: 'Producto con ventas registradas',
    body:  'Este producto aparece en una o más ventas. No se puede eliminar mientras tenga historial de ventas.',
  },
  // ── Rifas ───────────────────────────────────────────────────────────────────
  // campanas ← boletos
  boletos_campana_id_fkey: {
    title: 'Campaña con boletos asignados',
    body:  'Esta campaña tiene boletos registrados. Elimina primero todos los boletos antes de eliminar la campaña.',
  },
  // rifas ← boletos
  boletos_rifa_id_fkey: {
    title: 'Rifa con boletos asignados',
    body:  'Esta rifa tiene boletos registrados. Elimina primero todos los boletos.',
  },
}

// ── Mensajes por código de error Postgres ─────────────────────────────────────
export function parseError(e) {
  // 23503 — Violación de llave foránea
  if (e?.code === '23503') {
    const match      = e.message?.match(/constraint "([^"]+)"/)
    const constraint = match?.[1]
    if (constraint && FK_MAP[constraint]) return FK_MAP[constraint]
    return {
      title: 'Operación no permitida',
      body:  'Este registro está siendo referenciado en otra parte del sistema. Elimina primero los registros relacionados.',
    }
  }

  // 23505 — Valor duplicado (UNIQUE violation)
  if (e?.code === '23505') {
    return {
      title: 'Registro duplicado',
      body:  'Ya existe un registro con esos datos. Verifica que no estés creando un duplicado.',
    }
  }

  // 23502 — Campo NOT NULL vacío
  if (e?.code === '23502') {
    return {
      title: 'Campo obligatorio faltante',
      body:  'Falta un campo requerido. Revisa que todos los campos del formulario estén llenos.',
    }
  }

  // 42501 — Permiso denegado (RLS)
  if (e?.code === '42501') {
    return {
      title: 'Sin permisos',
      body:  'No tienes permisos para realizar esta acción. Contacta al administrador.',
    }
  }

  // Error de red / desconocido
  return {
    title: 'Error inesperado',
    body:  e?.message ?? 'Ocurrió un error desconocido. Intenta de nuevo o recarga la página.',
  }
}
