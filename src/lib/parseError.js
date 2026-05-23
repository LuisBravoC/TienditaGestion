/**
 * parseError.js — Convierte errores de Supabase/Postgres en mensajes legibles.
 *
 * Uso:
 *   import { parseError } from '../lib/parseError.js'
 *   const { title, body } = parseError(supabaseError)
 */

// ── Mapa de restricciones FK → mensaje legible ───────────────────────────────
const FK_MAP = {
  // paquetes ← alumnos
  alumnos_paquete_id_fkey: {
    title: 'Paquete en uso',
    body:  'Este paquete está asignado a uno o más alumnos. Reasigna o elimina esos alumnos antes de poder eliminar el paquete.',
  },
  // instituciones ← proyectos
  proyectos_institucion_id_fkey: {
    title: 'Institución con generaciones registradas',
    body:  'Esta institución tiene generaciones activas. Primero elimina todas sus generaciones, grupos y alumnos.',
  },
  // proyectos ← grupos
  grupos_proyecto_id_fkey: {
    title: 'Generación con grupos registrados',
    body:  'Esta generación tiene grupos activos. Primero elimina todos sus grupos y alumnos.',
  },
  // grupos ← alumnos
  alumnos_grupo_id_fkey: {
    title: 'Grupo con alumnos registrados',
    body:  'Este grupo tiene alumnos registrados. Elimina o reasigna a los alumnos antes de eliminar el grupo.',
  },
  // alumnos ← pagos
  pagos_alumno_id_fkey: {
    title: 'Alumno con pagos registrados',
    body:  'Este alumno tiene pagos en su historial. Elimina primero todos sus pagos.',
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
