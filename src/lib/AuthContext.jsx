import { createContext, useContext, useEffect, useState } from 'react'
import { getSession, onAuthChange, getProfile } from './auth.js'

const AuthContext = createContext(null)

/**
 * Provee { session, user, rol, isAdmin, loading } a toda la app.
 * - session:  objeto de sesión de Supabase o null
 * - user:     datos del usuario autenticado o null
 * - rol:      'admin' | 'viewer' | null
 * - isAdmin:  true si rol === 'admin'
 * - loading:  true mientras se verifica la sesión inicial
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [rol,     setRol]     = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadSessionAndProfile(s) {
    setSession(s)
    if (s?.user?.id) {
      const perfil = await getProfile(s.user.id)
      setRol(perfil?.rol ?? null)
    } else {
      setRol(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    // Carga la sesión existente al iniciar
    getSession().then(loadSessionAndProfile)

    // Escucha cambios (login, logout, refresco de token)
    const unsubscribe = onAuthChange(loadSessionAndProfile)

    return unsubscribe
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    rol,
    isAdmin: rol === 'admin',
    loading,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/** Hook para consumir el contexto de auth en cualquier componente. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
