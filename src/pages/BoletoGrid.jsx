import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Trophy, Search, Plus, X, CheckCircle2, Trash2,
  Calendar, DollarSign, Zap, Clock, UserPlus,
  LayoutGrid, List as ListIcon, RotateCcw, ArrowRight,
  Upload, Download, FileText, Scissors,
} from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { useToast } from '../lib/toast.jsx'
import { fmt, fmtNum, fmtDate, today } from '../lib/formatters.js'
import { applyExpiry } from '../lib/boleto-expiry.js'
import * as q from '../lib/rifas-queries.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../lib/useBreadcrumbs.js'
import { useGanadores } from '../lib/useGanadores.js'
import { useAuth } from '../lib/AuthContext.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import LoadingSpinner, { ErrorMsg } from '../components/LoadingSpinner.jsx'
import ErrorModal from '../components/ErrorModal.jsx'
import { parseError } from '../lib/parseError.js'
import BoletoPanel from '../components/BoletoPanel.jsx'
import TombolaModal from '../components/TombolaModal.jsx'
import ImportModal from '../components/ImportModal.jsx'
import { parseCSV, parseFechaCSV, csvEsc, exportarBoletos, buildImportPreview, previewToFilas } from '../lib/csv-utils.js'
import { generarRifaPDF, generarPapelitosPDF } from '../lib/rifaPdf.js'
import StatusBadge from '../components/StatusBadge.jsx'
import GrupoBadge from '../components/GrupoBadge.jsx'

// ── Componente principal ─────────────────────────────────────────────────────

export default function BoletoGrid() {
  const { campanaId, rifaId } = useParams()
  const [panel, setPanel] = useState(null)
  const { isAdmin } = useAuth()
  const toast = useToast()

  const campanaQ = useQuery(() => q.getCampana(campanaId), [campanaId])
  const rifaQ    = useQuery(() => q.getRifa(rifaId), [rifaId])
  const boletosQ = useQuery(() => q.getBoletosByRifa(rifaId), [rifaId])

  const [errModal, setErrModal] = useState(null)
  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))

  // ── Panel ──────────────────────────────────────────────────────────────────
  function openBoleto(boleto) { setPanel(boleto) }
  function closePanel()       { setPanel(null) }

  // ── Ganadores ──────────────────────────────────────────────────────────────
  const { ganadores, tombola, handleTombolaClose, ultimoGanador, handleElegirGanador, handleRemoveGanador, handleResetSorteo } = useGanadores(rifaId, rifaQ.data, showErr)
  const [menuPrint, setMenuPrint] = useState(false)
  const [menuCSV,   setMenuCSV]   = useState(false)
  const [viewMode,     setViewMode]     = useState('grid')  // 'grid' | 'list'
  const [filterStatus, setFilterStatus] = useState(null)    // null = Todos
  const [filterGrupo,  setFilterGrupo]  = useState('')      // '' = Todos
  const [searchNum,    setSearchNum]    = useState('')
  const [pdfFechaMode, setPdfFechaMode] = useState('fecha') // 'fecha' | 'agotarse'
  const fileInputRef    = useRef(null)
  const [importModal,   setImportModal]   = useState(null) // {preview, importing}
  const navigate = useNavigate()

  // ── Acción: Elegir ganador ─────────────────────────────────────────────────
  // ── Generar PDF ──────────────────────────────────────────────────────────
  function handlePDF() {
    generarRifaPDF(rifa, boletos, stats, total, { fechaMode: pdfFechaMode })
  }

  function handlePapelitos() {
    generarPapelitosPDF(rifa, boletos, total)
  }

  // ── Exportar CSV ───────────────────────────────────────────────────────────
  function handleExport() {
    exportarBoletos(boletos, rifa)
  }

  // ── Importar CSV (preview) ─────────────────────────────────────────────────
  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setImportModal({ preview: buildImportPreview(ev.target.result, boletos), importing: false })
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  // ── Confirmar importación ──────────────────────────────────────────────────
  async function handleConfirmImport() {
    setImportModal(m => ({ ...m, importing: true }))
    try {
      const filas = previewToFilas(importModal.preview)
      const { importados, saltados } = await q.importarBoletos(
        rifaId, filas, rifa.precio_boleto
      )
      setImportModal(null)
      boletosQ.refetch()
      toast(`Importación completada: ${importados} boleto${importados !== 1 ? 's' : ''} importados${saltados ? `, ${saltados} omitidos` : ''}`)
    } catch (e) { showErr(e); setImportModal(m => ({ ...m, importing: false })) }
  }

  // ── Breadcrumbs ────────────────────────────────────────────────────────────
  const campana = campanaQ.data
  const rifa    = rifaQ.data
  const crumbs  = useBreadcrumbs({ campanaId: campana?.nombre, rifaId: rifa?.nombre_premio })

  // Los hooks deben ir ANTES de cualquier early return (Reglas de Hooks)
  // applyExpiry calcula el estatus en memoria — sin llamada a BD
  const boletos = useMemo(
    () => applyExpiry(boletosQ.data ?? [], rifa?.horas_expiracion),
    [boletosQ.data, rifa?.horas_expiracion]
  )

  useEffect(() => {
    if (rifa?.estatus === 'Activa' && rifa?.horas_expiracion) {
      q.vencerBoletosExpirados(rifaId, rifa.horas_expiracion).catch(() => {})
    }
  }, [rifaId, rifa?.estatus, rifa?.horas_expiracion])

  // Estadísticas memoizadas — solo se recalculan cuando cambia el array de boletos
  const stats = useMemo(() => boletos.reduce(
    (acc, b) => {
      acc[b.estatus] = (acc[b.estatus] || 0) + 1
      acc.recaudado  += Number(b.total_pagado)
      return acc
    },
    { Disponible: 0, Apartado: 0, Liquidado: 0, Vencido: 0, recaudado: 0 }
  ), [boletos])

  // Mapa boletoId → participante_id memoizado
  const boletoPartMap = useMemo(
    () => Object.fromEntries(boletos.map(b => [b.id, b.participante_id])),
    [boletos]
  )

  const { data: grupos } = useQuery(() => q.getGrupos(), [])

  // Boletos filtrados por estatus y búsqueda de número
  const boletosVisible = useMemo(() => {
    let list = boletos
    if (filterStatus)  list = list.filter(b => b.estatus === filterStatus)
    if (filterGrupo)   list = list.filter(b => b.grupo_id === filterGrupo)
    const qs = searchNum.trim()
    if (qs)            list = list.filter(b => String(b.numero_asignado).includes(qs))
    return list
  }, [boletos, filterStatus, filterGrupo, searchNum])

  if (campanaQ.loading || rifaQ.loading || boletosQ.loading)
    return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando cuadrícula…" /></>
  if (!rifa) return <ErrorMsg message="Rifa no encontrada" />

  const total          = rifa.cantidad_boletos
  const meta           = Number(rifa.precio_boleto) * total
  const boletosLiqDisp = stats.Liquidado - ganadores.length

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">

        {/* ── Cabecera ── */}
        <div className="page-title-row">
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              <Trophy size={20} style={{ color: 'var(--abonado)' }} /> {rifa.nombre_premio}
            </h1>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '.82rem', color: 'var(--text-muted)', marginTop: '.3rem', flexWrap: 'wrap' }}>
              <span><DollarSign size={12} /> {fmt(rifa.precio_boleto)} / boleto</span>
              {rifa.fecha_sorteo && <span><Calendar size={12} /> Sorteo: {fmtDate(rifa.fecha_sorteo)}</span>}
              <span
                className={`badge badge-${
                  rifa.estatus === 'Activa' ? 'liquidado' : rifa.estatus === 'Cancelada' ? 'deuda' : 'abonado'
                }`}
                style={{ fontSize: '.72rem' }}
              >
                {rifa.estatus}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>

            {/* ── Dropdown Imprimir ── */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-outline"
                onClick={() => { setMenuPrint(v => !v); setMenuCSV(false) }}
              >
                <FileText size={15} /> Imprimir ▾
              </button>
              {menuPrint && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuPrint(false)} />
                  <div className="toolbar-dd toolbar-dd-l" style={{ minWidth: '220px', zIndex: 10 }}>
                    {/* Toggle modo fecha */}
                    <div style={{ padding: '.5rem .75rem .65rem', marginBottom: '.25rem', borderBottom: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: '.45rem', marginTop: 0 }}>Fecha en PDF</p>
                      <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <button
                          className={`btn btn-sm ${pdfFechaMode === 'fecha' ? 'btn-primary' : 'btn-outline'}`}
                          style={{ flex: 1, borderRadius: 0, border: 'none' }}
                          onClick={() => setPdfFechaMode('fecha')}
                        >
                          <Calendar size={11} /> Fecha sorteo
                        </button>
                        <button
                          className={`btn btn-sm ${pdfFechaMode === 'agotarse' ? 'btn-primary' : 'btn-outline'}`}
                          style={{ flex: 1, borderRadius: 0, border: 'none', borderLeft: '1px solid var(--border)' }}
                          onClick={() => setPdfFechaMode('agotarse')}
                        >
                          Hasta agotar
                        </button>
                      </div>
                    </div>
                    <button className="toolbar-dd-item" onClick={() => { handlePDF(); setMenuPrint(false) }}>
                      <FileText size={14} /> Resumen de la rifa
                    </button>
                    <button className="toolbar-dd-item" onClick={() => { handlePapelitos(); setMenuPrint(false) }}>
                      <Scissors size={14} /> Papelitos para tómbola
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── Dropdown CSV ── */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-outline"
                onClick={() => { setMenuCSV(v => !v); setMenuPrint(false) }}
              >
                <Download size={15} /> CSV ▾
              </button>
              {menuCSV && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuCSV(false)} />
                  <div className="toolbar-dd toolbar-dd-r" style={{ minWidth: '180px', zIndex: 10 }}>
                    <button className="toolbar-dd-item" onClick={() => { handleExport(); setMenuCSV(false) }}>
                      <Download size={14} /> Exportar boletos
                    </button>
                    {isAdmin && (
                      <button className="toolbar-dd-item" onClick={() => { fileInputRef.current?.click(); setMenuCSV(false) }}>
                        <Upload size={14} /> Importar CSV
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {isAdmin && stats.Liquidado > 0 && (
              <button className="btn btn-primary" onClick={handleElegirGanador}>
                <Trophy size={15} /> {ganadores.length > 0 ? 'Otro ganador' : 'Elegir ganador'}
              </button>
            )}
          </div>
        </div>

        {/* ── Resumen financiero ── */}
        <div className="grid grid-stats" style={{ marginBottom: '1.25rem' }}>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{stats.Disponible}</div>
            <div className="stat-label">Disponibles</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--abonado)' }}>{stats.Apartado}</div>
            <div className="stat-label">Apartados</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--liquidado)' }}>{stats.Liquidado}</div>
            <div className="stat-label">Pagados</div>
          </div>
          <div className="card stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{fmt(stats.recaudado)}</div>
            <div className="stat-label">Recaudado / {fmt(meta)}</div>
          </div>
        </div>

        <ProgressBar value={stats.recaudado} max={meta} />

        {/* ── Leyenda ── */}
        <div className="boleto-leyenda" style={{ margin: '.85rem 0 .5rem' }}>
          <span className="boleto-leyenda-item"><span className="dot dot-disponible" />Libre</span>
          <span className="boleto-leyenda-item"><span className="dot dot-apartado" />Apartado</span>
          <span className="boleto-leyenda-item"><span className="dot dot-liquidado" />Pagado</span>
          {stats.Vencido > 0 && (
            <span className="boleto-leyenda-item"><span className="dot dot-vencido" />Vencido ({stats.Vencido})</span>
          )}
        </div>

        {/* ── Filtros + búsqueda + toggle de vista ── */}
        <div className="boleto-filtros-bar">
          {/* Fila 1: chips de estatus (toda la fila en móvil) */}
          <div className="boleto-filtros-chips">
            {[null, 'Disponible', 'Apartado', 'Liquidado', 'Vencido'].map(s => {
              const active = filterStatus === s
              const count  = s ? (stats[s] ?? 0) : boletos.length
              if (s === 'Vencido' && stats.Vencido === 0) return null
              return (
                <button
                  key={s ?? 'todos'}
                  className={`btn btn-sm boleto-chip ${active ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setFilterStatus(active ? null : s)}
                >
                  {s ?? 'Todos'} <span style={{ opacity: .65 }}>({count})</span>
                </button>
              )
            })}
          </div>

          {/* Fila 2: grupo + búsqueda + toggle vista */}
          <div className="boleto-filtros-tools">
            {(grupos ?? []).length > 0 && (
              <select value={filterGrupo} onChange={e => setFilterGrupo(e.target.value)}
                style={{ height: '2.1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 .65rem', fontSize: '.82rem' }}>
                <option value="">Todos los grupos</option>
                {(grupos ?? []).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <Search size={14} style={{ position: 'absolute', left: '.6rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Buscar Nº"
                value={searchNum}
                onChange={e => setSearchNum(e.target.value)}
                className="input-search-num"
                style={{ paddingLeft: '2rem', paddingRight: searchNum ? '1.8rem' : '.75rem', height: '2.1rem', width: '100%', fontSize: '.875rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
              {searchNum && (
                <button onClick={() => setSearchNum('')}
                  style={{ position: 'absolute', right: '.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, display: 'flex' }}
                ><X size={13} /></button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '.3rem', flexShrink: 0 }}>
              <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('grid')} title="Vista cuadrícula"><LayoutGrid size={13} /></button>
              <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('list')} title="Vista lista"><ListIcon size={13} /></button>
            </div>
          </div>
        </div>

        {/* ── Vista cuadrícula o lista ── */}
        <div
          key={`${viewMode}|${filterStatus ?? ''}|${filterGrupo}|${searchNum}`}
          style={{ animation: 'boleto-view-in .22s ease both' }}
        >
        {viewMode === 'grid' ? (
          <div className="boleto-grid">
            {boletosVisible.map(b => {
              const esGanador = ganadores.some(g => g.id === b.id)
              return (
                <button
                  key={b.id}
                  className={[
                    'boleto-cell',
                    `boleto-${b.estatus.toLowerCase()}`,
                    esGanador ? 'boleto-ganador' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => openBoleto(b)}
                  title={b.nombre_completo ? `${b.nombre_completo} · ${b.estatus}` : b.estatus}
                >
                  <span className="boleto-num">{fmtNum(b.numero_asignado, total)}</span>
                  {b.nombre_completo && (
                    <span className="boleto-initials">{b.nombre_completo.charAt(0).toUpperCase()}</span>
                  )}
                  {esGanador && <span className="boleto-star">★</span>}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="boleto-list">
            {/* Cabecera */}
            <div className="boleto-list-header">
              <span>#</span>
              <span>Participante</span>
              <span>Grupo</span>
              <span>Estado</span>
              <span style={{ textAlign: 'right' }}>Monto</span>
            </div>

            {boletosVisible.map(b => {
              const esGanador = ganadores.some(g => g.id === b.id)

              // Punto de color + etiqueta para estado
              const estadoConfig = {
                Liquidado:  { color: 'var(--liquidado)', label: 'Liquidado' },
                Apartado:   { color: 'var(--abonado)',   label: 'Apartado'  },
                Vencido:    { color: 'var(--deuda)',     label: 'Vencido'   },
                Disponible: { color: 'var(--border)',    label: 'Disponible'},
              }
              const ec = estadoConfig[b.estatus] ?? estadoConfig.Disponible

              return (
                <div
                  key={b.id}
                  className={[
                    'boleto-list-row',
                    `boleto-list-${b.estatus.toLowerCase()}`,
                    esGanador ? 'boleto-list-ganador' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => openBoleto(b)}
                >
                  {/* #  */}
                  <span className="boleto-list-num">{fmtNum(b.numero_asignado, total)}</span>

                  {/* Nombre */}
                  <span className="boleto-list-nombre">
                    {b.nombre_completo ?? <em style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>Disponible</em>}
                  </span>

                  {/* Grupo */}
                  <span className="boleto-list-col-grupo">
                    {b.grupo_nombre && (
                      <span style={{ fontSize: '.68rem', padding: '.1rem .45rem', borderRadius: '999px', background: b.grupo_color ?? '#6366f1', color: '#fff', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                        {b.grupo_nombre}
                      </span>
                    )}
                  </span>

                  {/* Estado */}
                  <span className="boleto-list-col-estatus">
                    {esGanador ? (
                      <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '.85rem', textShadow: '0 0 10px rgba(251,191,36,.7), 0 0 20px rgba(251,191,36,.35)' }}>★ Ganador</span>
                    ) : b.estatus !== 'Disponible' ? (
                      <><span className="bl-dot" style={{ background: ec.color }} />{ec.label}</>
                    ) : null}
                  </span>

                  {/* Monto */}
                  <span className="boleto-list-col-monto">
                    {esGanador ? null
                      : b.estatus === 'Liquidado'
                        ? <span style={{ color: 'var(--liquidado)' }}>{fmt(b.total_pagado)}</span>
                        : Number(b.saldo_pendiente) > 0
                          ? <span style={{ color: 'var(--abonado)' }}>{fmt(b.saldo_pendiente)}</span>
                          : null}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        </div>
        {ganadores.length > 0 && (
          <div className="ganadores-list">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 .5rem', flexWrap: 'wrap', gap: '.5rem' }}>
              <p className="section-heading" style={{ margin: 0 }}>Ganadores del sorteo</p>
              <button
                className="btn btn-sm"
                style={{ color: 'var(--deuda)', border: '1px solid var(--deuda)', background: 'none' }}
                onClick={handleResetSorteo}
                title="Reiniciar sorteo — elimina todos los ganadores guardados"
              >
                <RotateCcw size={13} /> Reiniciar sorteo
              </button>
            </div>
            {ganadores.map((g, i) => {
              const partId = boletoPartMap[g.id] ?? g.participante_id ?? g.participantes?.id
              return (
              <div key={g.id} className="ganador-row">
                <span className="ganador-lugar">{(['1er','2do','3er'][i] ?? `${i+1}to`)} lugar</span>
                <span className="ganador-num">#{fmtNum(g.numero_asignado, total)}</span>
                <span className="ganador-nombre">
                  {g.participantes?.nombre_completo
                    ? partId
                      ? <Link to={`/participantes/${partId}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border)' }}>{g.participantes.nombre_completo}</Link>
                      : g.participantes.nombre_completo
                    : g.nombre_participante ?? '—'}
                </span>
                {g.participantes?.telefono_whatsapp && (
                  <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                    {g.participantes.telefono_whatsapp}
                  </span>
                )}
                <button
                  className="btn btn-icon btn-danger-icon"
                  style={{ marginLeft: 'auto', flexShrink: 0 }}
                  onClick={() => handleRemoveGanador(g.id)}
                  title="Eliminar este ganador"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )})}
            {boletosLiqDisp > 0 && (
              <button className="btn btn-outline" style={{ marginTop: '.75rem' }} onClick={handleElegirGanador}>
                <Trophy size={14} /> Elegir {ganadores.length + 1}er lugar ({boletosLiqDisp} disponibles)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ Panel lateral ══════════════════════════════════════════════════════ */}
      {panel && (
        <BoletoPanel
          boleto={panel}
          rifa={rifa}
          total={total}
          isAdmin={isAdmin}
          onClose={closePanel}
          onDone={({ noClose } = {}) => { if (!noClose) closePanel(); boletosQ.refetch() }}
          onError={setErrModal}
          toast={toast}
        />
      )}

      {/* ══ Import CSV ════════════════════════════════════════════════════════ */}
      <input
        type="file" accept=".csv" ref={fileInputRef}
        style={{ display: 'none' }} onChange={handleImportFile}
      />
      {importModal && (
        <ImportModal
          preview={importModal.preview}
          importing={importModal.importing}
          onConfirm={handleConfirmImport}
          onClose={() => setImportModal(null)}
        />
      )}

      {/* ══ Tómbola y ganador ══════════════════════════════════════════════════ */}
      {tombola && ultimoGanador && (
        <TombolaModal
          ganador={ultimoGanador}
          lugar={ganadores.length + 1}
          total={total}
          onClose={handleTombolaClose}
        />
      )}

      {errModal && <ErrorModal {...errModal} onClose={() => setErrModal(null)} />}
    </>
  )
}
