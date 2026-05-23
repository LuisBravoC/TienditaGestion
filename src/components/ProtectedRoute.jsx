import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import LoadingSpinner from './LoadingSpinner.jsx'

/**
 * Envuelve rutas que requieren sesión activa.
 * - Si loading: muestra spinner (evita parpadeo a /login en carga inicial)
 * - Si no hay sesión: redirige a /login guardando la ruta original
 * - Si hay sesión: renderiza el contenido
 */
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner text="Verificando sesión…" />

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
