import { useState, useMemo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ChevronLeft, ChevronRight, ArrowRight, X, UserRoundCog } from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { fmt, fmtDate, fmtDateTime } from '../lib/formatters.js'
import { getBitacora, getCampanas, getRifasConResumen, getGrupos } from '../lib/rifas-queries.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import LoadingSpinner, { ErrorMsg } from '../components/LoadingSpinner.jsx'
import GrupoBadge from '../components/GrupoBadge.jsx'

const PAGE_SIZE = 60

const ESTATUS_OPTS = [
  { value: '',           label: 'Todos los movimientos' },
  { value: 'Apartado',   label: 'Apartado' },
  { value: 'Liquidado',  label: 'Pagado / Liquidado' },
  { value: 'Disponible', label: 'Liberado / Disponible' },
  { value: 'Vencido',    label: 'Vencido' },
]

const ESTATUS_META = {
  Apartado:   { label: 'Apartado',   color: 'var(--abonado)',   bg: 'color-mix(in srgb, var(--abonado) 12%, transparent)' },
  Liquidado:  { label: 'Pagado',     color: 'var(--liquidado)', bg: 'color-mix(in srgb, var(--liquidado) 12%, transparent)' },
  Disponible: { label: 'Libre',     color: 'var(--text-muted)', bg: 'color-mix(in srgb, var(--text-muted) 8%, transparent)' },
  Vencido:    { label: 'Vencido',    color: 'var(--deuda)',     bg: 'color-mix(in srgb, var(--deuda) 12%, transparent)' },
}

function EstatusBadge({ value }) {
  const meta = ESTATUS_META[value] ?? { label: value, color: 'var(--text-muted)', bg: 'transparent' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '.15rem .55rem',
      borderRadius: '99px',
      fontSize: '.72rem',
      fontWeight: 700,
      color: meta.color,
      background: meta.bg,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

function ReasignadoBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '.3rem',
      padding: '.15rem .55rem',
      borderRadius: '99px',
      fontSize: '.72rem',
      fontWeight: 700,
      color: 'var(--accent-light)',
      background: 'color-mix(in srgb, var(--accent-light) 12%, transparent)',
      whiteSpace: 'nowrap',
    }}>
      <UserRoundCog size={11} /> Reasignado
    </span>
  )
}

const SELECT_STYLE = {
  height: '2.2rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  padding: '0 .75rem',
  fontSize: '.875rem',
  width: '100%',
}

const INPUT_STYLE = {
  ...SELECT_STYLE,
}

const LABEL_STYLE = {
  fontSize: '.72rem',
  color: 'var(--text-muted)',
  fontWeight: 600,
}

const FILTER_FIELD = {
  display: 'flex',
  flexDirection: 'column',
  gap: '.25rem',
}

export default function Bitacora() {
  const [campanaId,    setCampanaId]    = useState('')
  const [rifaId,       setRifaId]       = useState('')
  const [estatusNuevo, setEstatusNuevo] = useState('')
  const [grupoId,      setGrupoId]      = useState('')
  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')
  const [busqueda,     setBusqueda]     = useState('')
  const [page,         setPage]         = useState(0)

  const campanasQ = useQuery(() => getCampanas(), [])
  const gruposQ   = useQuery(() => getGrupos(),   [])
  const rifasQ    = useQuery(
    () => campanaId ? getRifasConResumen(campanaId) : Promise.resolve([]),
    [campanaId]
  )

  const bitacoraQ = useQuery(
    () => getBitacora({
      campanaId:    campanaId    || null,
      rifaId:       rifaId       || null,
      estatusNuevo: estatusNuevo || null,
      grupoId:      grupoId      || null,
      fechaDesde:   fechaDesde   || null,
      fechaHasta:   fechaHasta   || null,
      busqueda:     busqueda     || null,
      page,
      pageSize: PAGE_SIZE,
    }),
    [campanaId, rifaId, estatusNuevo, grupoId, fechaDesde, fechaHasta, busqueda, page]
  )

  const { movimientos = [], total = 0 } = bitacoraQ.data ?? {}
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const crumbs = [{ label: 'Bitácora de movimientos' }]

  const hayFiltros = campanaId || rifaId || estatusNuevo || grupoId || fechaDesde || fechaHasta || busqueda

  const filterKey = `${campanaId}|${rifaId}|${estatusNuevo}|${grupoId}|${fechaDesde}|${fechaHasta}|${busqueda}|${page}`
  const [committedKey, setCommittedKey] = useState(filterKey)
  const filterKeyRef = useRef(filterKey)
  filterKeyRef.current = filterKey
  useEffect(() => { setCommittedKey(filterKeyRef.current) }, [bitacoraQ.data])
  const isFetching = filterKey !== committedKey

  function resetFiltros() {
    setCampanaId(''); setRifaId(''); setEstatusNuevo(''); setGrupoId('')
    setFechaDesde(''); setFechaHasta(''); setBusqueda(''); setPage(0)
  }

  function handleCampana(v) { setCampanaId(v); setRifaId(''); setPage(0) }

  const TH = ({ children, right }) => (
    <th style={{ padding: '.6rem .9rem', textAlign: right ? 'right' : 'left', fontWeight: 600, fontSize: '.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title"><ClipboardList size={20} /> Bitácora de movimientos</h1>
        </div>

        {/* ── Filtros ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(10.5rem, 1fr))',
          gap: '.65rem',
          marginBottom: '1.25rem',
          alignItems: 'end',
        }}>
          {/* Campaña */}
          <div style={FILTER_FIELD}>
            <label style={LABEL_STYLE}>Campaña</label>
            <select value={campanaId} onChange={e => handleCampana(e.target.value)} style={SELECT_STYLE}>
              <option value="">Todas las campañas</option>
              {(campanasQ.data ?? []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Rifa — solo si hay campaña seleccionada */}
          {campanaId && (
            <div style={FILTER_FIELD}>
              <label style={LABEL_STYLE}>Rifa</label>
              <select value={rifaId} onChange={e => { setRifaId(e.target.value); setPage(0) }} style={SELECT_STYLE}>
                <option value="">Todas las rifas</option>
                {(rifasQ.data ?? []).map(r => <option key={r.id} value={r.id}>{r.nombre_premio}</option>)}
              </select>
            </div>
          )}

          {/* Movimiento */}
          <div style={FILTER_FIELD}>
            <label style={LABEL_STYLE}>Movimiento</label>
            <select value={estatusNuevo} onChange={e => { setEstatusNuevo(e.target.value); setPage(0) }} style={SELECT_STYLE}>
              {ESTATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Grupo */}
          <div style={FILTER_FIELD}>
            <label style={LABEL_STYLE}>Grupo</label>
            <select value={grupoId} onChange={e => { setGrupoId(e.target.value); setPage(0) }} style={SELECT_STYLE}>
              <option value="">Todos los grupos</option>
              {(gruposQ.data ?? []).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>

          {/* Fecha desde */}
          <div style={FILTER_FIELD}>
            <label style={LABEL_STYLE}>Desde</label>
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(0) }} style={INPUT_STYLE} />
          </div>

          {/* Fecha hasta */}
          <div style={FILTER_FIELD}>
            <label style={LABEL_STYLE}>Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(0) }} style={INPUT_STYLE} />
          </div>

          {/* Búsqueda nombre */}
          <div style={FILTER_FIELD}>
            <label style={LABEL_STYLE}>Participante</label>
            <input
              type="search"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPage(0) }}
              placeholder="Buscar nombre…"
              style={INPUT_STYLE}
            />
          </div>

          {/* Limpiar — label invisible para alinear altura con los demás */}
          {hayFiltros && (
            <div style={FILTER_FIELD}>
              <label style={{ ...LABEL_STYLE, visibility: 'hidden' }}>—</label>
              <button
                className="btn btn-outline"
                onClick={resetFiltros}
                style={{ height: '2.2rem', width: '100%', gap: '.3rem', justifyContent: 'center' }}
                title="Limpiar filtros"
              >
                <X size={13} /> Limpiar
              </button>
            </div>
          )}
        </div>

        {/* Contador */}
        {!bitacoraQ.loading && (
          <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            {total} movimiento{total !== 1 ? 's' : ''}
            {hayFiltros && ' con los filtros actuales'}
          </div>
        )}

        {/* ── Contenido ── */}
        {bitacoraQ.loading && !bitacoraQ.data ? (
          <LoadingSpinner text="Cargando bitácora…" />
        ) : bitacoraQ.error ? (
          <ErrorMsg message={bitacoraQ.error} />
        ) : movimientos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>
            Sin movimientos registrados{hayFiltros ? ' para los filtros seleccionados' : ''}.<br />
            <span style={{ fontSize: '.8rem' }}>Los movimientos se registran automáticamente desde que se activa el trigger en la base de datos.</span>
          </p>
        ) : (
          <div style={{ opacity: isFetching ? 0.45 : 1, transition: 'opacity .18s ease' }}>
            {/* Tabla desktop */}
            <div className="card historial-table-wrap" key={committedKey} style={{ overflow: 'hidden', padding: 0, animation: 'boleto-view-in .22s ease both' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-muted, var(--bg))', borderBottom: '1px solid var(--border)' }}>
                      <TH>Fecha y hora</TH>
                      <TH>Boleto</TH>
                      <TH>Antes</TH>
                      <th style={{ padding: '0', width: '1.2rem' }} />
                      <TH>Movimiento</TH>
                      <TH>Participante</TH>
                      <TH>Grupo</TH>
                      <TH>Rifa</TH>
                      <TH>Campaña</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '.5rem .9rem', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '.8rem', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDateTime(m.created_at)}
                        </td>
                        <td style={{ padding: '.5rem .9rem', textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                          #{m.numero_asignado}
                        </td>
                        <td style={{ padding: '.5rem .5rem .5rem .9rem', textAlign: 'left' }}>
                          {m.tipo_movimiento === 'reasignacion'
                            ? <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>—</span>
                            : m.estatus_anterior
                              ? <EstatusBadge value={m.estatus_anterior} />
                              : <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '0', textAlign: 'center', width: '1.2rem', color: 'var(--text-muted)' }}>
                          {m.tipo_movimiento !== 'reasignacion' && m.estatus_anterior && <ArrowRight size={11} />}
                        </td>
                        <td style={{ padding: '.5rem .9rem .5rem .5rem' }}>
                          {m.tipo_movimiento === 'reasignacion'
                            ? <ReasignadoBadge />
                            : <EstatusBadge value={m.estatus_nuevo} />
                          }
                        </td>
                        <td style={{ padding: '.5rem .9rem' }}>
                          {m.participante_id ? (
                            <Link
                              to={`/participantes/${m.participante_id}`}
                              style={{ color: 'var(--accent-light)', display: 'inline-flex', alignItems: 'center', gap: '.2rem', textDecoration: 'none', fontSize: '.85rem' }}
                            >
                              {m.nombre_participante ?? '—'} <ArrowRight size={11} />
                            </Link>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>
                              {m.nombre_participante ?? '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '.5rem .9rem' }}>
                          {(() => {
                            const grupo = m.grupo ?? m.participante?.grupo ?? null
                            return grupo?.nombre
                              ? <GrupoBadge grupo={grupo} />
                              : <span style={{ color: 'var(--text-muted)', fontSize: '.75rem' }}>—</span>
                          })()}
                        </td>
                        <td style={{ padding: '.5rem .9rem', fontSize: '.8rem', color: 'var(--text-muted)' }}>
                          {m.rifa?.id ? (
                            <Link
                              to={`/rifas/${m.campana_id}/sorteos/${m.rifa.id}`}
                              style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border)' }}
                            >
                              {m.rifa.nombre_premio}
                            </Link>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '.5rem .9rem', fontSize: '.8rem', color: 'var(--text-muted)' }}>
                          {m.campana?.nombre ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile list */}
            <div className="historial-mobile-list">
              {movimientos.map(m => (
                <div key={m.id} className="historial-mobile-row">
                  <div className="historial-mobile-main">
                    <span style={{ fontWeight: 700 }}>#{m.numero_asignado}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}>
                      {m.tipo_movimiento === 'reasignacion' ? (
                        <ReasignadoBadge />
                      ) : (
                        <>
                          {m.estatus_anterior && (
                            <>
                              <EstatusBadge value={m.estatus_anterior} />
                              <ArrowRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </>
                          )}
                          <EstatusBadge value={m.estatus_nuevo} />
                        </>
                      )}
                    </span>
                  </div>
                  <div className="historial-mobile-meta">
                    <span>{fmtDateTime(m.created_at)}</span>
                  </div>
                  <div className="historial-mobile-meta" style={{ marginTop: '.25rem' }}>
                    {m.participante_id ? (
                      <Link to={`/participantes/${m.participante_id}`} style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>
                        {m.nombre_participante ?? '—'}
                      </Link>
                    ) : <span>{m.nombre_participante ?? '—'}</span>}
                    {(() => { const g = m.grupo ?? m.participante?.grupo ?? null; return g?.nombre ? <GrupoBadge grupo={g} /> : null })()}
                  </div>
                  <div className="historial-mobile-meta" style={{ marginTop: '.15rem', fontSize: '.75rem' }}>
                    {m.rifa?.nombre_premio ?? '—'} · {m.campana?.nombre ?? '—'}
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.25rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                  Pág. {page + 1} / {totalPages}
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
