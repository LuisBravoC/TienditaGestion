import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook genérico para queries async.
 * queryFn: función async que devuelve los datos.
 * deps: array de dependencias (como useEffect).
 *
 * Solo muestra loading=true en la primera carga.
 * Los re-fetches (cuando los deps cambian o se llama refetch()) actualizan en
 * segundo plano, evitando desmontar componentes hijos con estado local.
 *
 * Retorna { data, loading, error, refetch }
 */
export function useQuery(queryFn, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tick,    setTick]    = useState(0)      // incrementar dispara el effect
  const hasDataRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    // Primera carga: mostrar spinner. Re-fetches: actualizar en segundo plano.
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    queryFn()
      .then(result => {
        if (!cancelled) {
          setData(result)
          hasDataRef.current = true
        }
      })
      .catch(err   => { if (!cancelled) setError(err.message ?? String(err)) })
      .finally(()  => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { data, loading, error, refetch }
}
