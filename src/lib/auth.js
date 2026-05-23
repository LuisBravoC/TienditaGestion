/**
 * auth.js — Capa de abstracción de autenticación.
 *
 * Todas las llamadas al proveedor de auth pasan por aquí.
 * Si en el futuro se migra a otro backend, solo se modifica este archivo.
 */
import { supabase } from './supabase.js'

/** Inicia sesión con email y contraseña. Lanza error si falla. */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

/** Cierra la sesión actual. */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Devuelve la sesión activa o null. */
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

/**
 * Devuelve el perfil del usuario autenticado (nombre, rol) o null.
 * Lee de la tabla public.perfiles.
 */
export async function getProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('perfiles')
    .select('nombre, rol')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

/**
 * Suscribe un callback a cambios de sesión (login / logout / refresco de token).
 * Devuelve una función para cancelar la suscripción.
 */
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => subscription.unsubscribe()
}
