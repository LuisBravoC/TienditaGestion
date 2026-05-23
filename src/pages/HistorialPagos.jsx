import { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { fmt, fmtDate, fmtDateTime } from '../lib/formatters.js'
import { getHistorialGlobal, getCampanas } from '../lib/rifas-queries.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import LoadingSpinner, { ErrorMsg } from '../components/LoadingSpinner.jsx'

const PAGE_SIZE = 50


export default function HistorialPagos() {
  const [campanaId, setCampanaId] = useState('')
  const [page,      setPage]      = useState(0)

  const campanasQ  = useQuery(() => getCampanas(), [])
  const historialQ = useQuery(
    () => getHistorialGlobal({ campanaId: campanaId || null, page, pageSize: PAGE_SIZE }),
    [campanaId, page]
  )

  const crumbs = [{ label: 'Historial de pagos' }]

  const { pagos = [], total = 0 } = historialQ.data ?? {}
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Clave que solo se actualiza cuando los datos nuevos ya llegaron
  // Clave que solo se actualiza cuando los datos nuevos ya llegaron
  const filterKey = `${campanaId}|${page}`
  const [committedKey, setCommittedKey] = useState(filterKey)
  const filterKeyRef = useRef(filterKey)
  filterKeyRef.current = filterKey
  useEffect(() => { setCommittedKey(filterKeyRef.current) }, [historialQ.data])
  const isFetching = filterKey !== committedKey

  // Totales de la página actual
  const totalPagina = useMemo(() => pagos.reduce((s, p) => s + Number(p.monto), 0), [pagos])

  function handleCampana(e) {
    setCampanaId(e.target.value)
    setPage(0)
  }

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title"><CreditCard size={20} /> Historial de pagos</h1>
        </div>

        {/* Filtro por campaña */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <select
            value={campanaId}
            onChange={handleCampana}
            style={{ minWidth: '14rem', height: '2.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 .75rem', fontSize: '.875rem' }}
          >
            <option value="">Todas las campañas</option>
            {(campanasQ.data ?? []).map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {!historialQ.loading && (
            <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
              {total} pago{total !== 1 ? 's' : ''} · Total página: <strong style={{ color: 'var(--liquidado)' }}>{fmt(totalPagina)}</strong>
            </span>
          )}
        </div>

        {historialQ.loading && !historialQ.data ? (
          <LoadingSpinner text="Cargando historial…" />
        ) : historialQ.error ? (
          <ErrorMsg message={historialQ.error} />
        ) : pagos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>Sin pagos registrados.</p>
        ) : (
          <div key={committedKey} style={{ animation: 'boleto-view-in .22s ease both', opacity: isFetching ? 0.45 : 1, transition: 'opacity .18s ease' }}>
            <div className="card historial-table-wrap" style={{ overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-muted, var(--bg))', borderBottom: '1px solid var(--border)' }}>
                    {['Fecha y hora', 'Participante', 'Rifa', 'Boleto', 'Método', 'Monto'].map(h => (
                      <th key={h} style={{ padding: '.6rem .9rem', textAlign: 'left', fontWeight: 600, fontSize: '.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(p => {
                    const boleto = p.boleto
                    const part   = boleto?.participantes
                    const rifa   = boleto?.rifa
                    const nombre = part?.nombre_completo ?? boleto?.nombre_participante ?? '—'
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '.55rem .9rem', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '.8rem', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDateTime(p.created_at)}
                        </td>
                        <td style={{ padding: '.55rem .9rem' }}>
                          {part?.id ? (
                            <Link
                              to={`/participantes/${part.id}`}
                              style={{ color: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', gap: '.2rem', textDecoration: 'none' }}
                            >
                              {nombre} <ArrowRight size={11} />
                            </Link>
                          ) : nombre}
                        </td>
                        <td style={{ padding: '.55rem .9rem', color: 'var(--text-muted)', fontSize: '.8rem' }}>
                          {rifa ? (
                            <Link
                              to={`/rifas/${rifa.campana_id}/sorteos/${rifa.id}`}
                              style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border)' }}
                            >
                              {rifa.nombre_premio}
                            </Link>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '.55rem .9rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                          {boleto?.numero_asignado ?? '—'}
                        </td>
                        <td style={{ padding: '.55rem .9rem', color: 'var(--text-muted)', fontSize: '.8rem' }}>
                          {p.metodo_pago}
                        </td>
                        <td style={{ padding: '.55rem .9rem', fontWeight: 600, color: 'var(--liquidado)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {fmt(p.monto)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list (≤640px) */}
            <div className="historial-mobile-list">
              {pagos.map(p => {
                const boleto = p.boleto
                const part   = boleto?.participantes
                const rifa   = boleto?.rifa
                const nombre = part?.nombre_completo ?? boleto?.nombre_participante ?? '—'
                return (
                  <div key={p.id} className="historial-mobile-row">
                    <div className="historial-mobile-main">
                      <span className="historial-mobile-nombre">
                        {part?.id ? (
                          <Link
                            to={`/participantes/${part.id}`}
                            style={{ color: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', gap: '.2rem', textDecoration: 'none' }}
                          >
                            {nombre} <ArrowRight size={10} />
                          </Link>
                        ) : nombre}
                      </span>
                      <span className="historial-mobile-monto">{fmt(p.monto)}</span>
                    </div>
                    <div className="historial-mobile-meta">
                      <span>{fmtDateTime(p.created_at)}</span>
                      {boleto?.numero_asignado != null && <span>#{boleto.numero_asignado}</span>}
                      {p.metodo_pago && <span>{p.metodo_pago}</span>}
                      {rifa && (
                        <span>
                          <Link
                            to={`/rifas/${rifa.campana_id}/sorteos/${rifa.id}`}
                            style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border)' }}
                          >
                            {rifa.nombre_premio}
                          </Link>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.75rem', marginTop: '1.25rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
