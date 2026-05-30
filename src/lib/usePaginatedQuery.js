import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook para queries paginadas que devuelven { data, count }.
 * queryFn: función async que devuelve { data: [], count: number }.
 * deps: array de dependencias (como useEffect).
 *
 * Retorna { data, count, loading, error, refetch }
 */
export function usePaginatedQuery(queryFn, deps = []) {
  const [data,    setData]    = useState([])
  const [count,   setCount]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tick,    setTick]    = useState(0)
  const hasDataRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (!hasDataRef.current) setLoading(true)
    setError(null)
    queryFn()
      .then(result => {
        if (!cancelled) {
          setData(result.data ?? [])
          setCount(result.count ?? 0)
          hasDataRef.current = true
        }
      })
      .catch(err => { if (!cancelled) setError(err.message ?? String(err)) })
      .finally(()  => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return { data, count, loading, error, refetch }
}
