import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, X, CheckCircle2, Trash2,
  MessageCircle, Zap, Clock, UserPlus, ArrowRight, RotateCcw, UserRoundCog,
} from 'lucide-react'
import { fmt, fmtNum, fmtDate, today } from '../lib/formatters.js'
import * as q from '../lib/rifas-queries.js'
import { useQuery } from '../lib/useQuery.js'
import ProgressBar from './ProgressBar.jsx'
import { parseError } from '../lib/parseError.js'
import WhatsAppBtn from './WhatsAppBtn.jsx'


// ── Componente ────────────────────────────────────────────────────────────────

function resolveGrupoId(grupoIdSeleccionado, grupos) {
  if (grupoIdSeleccionado) return grupoIdSeleccionado
  return (grupos ?? []).find(g => g.nombre.toLowerCase() === 'otros')?.id ?? null
}

/**
 * Panel lateral para apartar o gestionar un boleto.
 *
 * Props:
 *   boleto   – boleto seleccionado (con estatus, nombre_completo, etc.)
 *   rifa     – datos de la rifa (precio_boleto, cantidad_boletos)
 *   total    – rifa.cantidad_boletos (número)
 *   isAdmin  – booleano
 *   onClose  – cierra el panel sin refrescar
 *   onDone   – cierra el panel Y dispara un refresco de boletos en el padre
 *   onError  – muestra un ErrorModal en el padre ({ title, body })
 *   toast    – función toast del padre
 */
export default function BoletoPanel({ boleto: boletoInicial, rifa, total, isAdmin, onClose, onDone, onError, toast }) {
  const navigate = useNavigate()

  // ── Estado modo "asignar" ─────────────────────────────────────────────────
  const [mode, setMode]                         = useState(boletoInicial.estatus === 'Disponible' ? 'asignar' : 'gestionar')
  const [boleto, setBoleto]                     = useState(boletoInicial)
  const [partSearch, setPartSearch]             = useState('')
  const [partResults, setPartResults]           = useState([])
  const [partSeleccionado, setPartSeleccionado] = useState(null)
  const [showNewForm, setShowNewForm]           = useState(false)
  const [nuevoPart, setNuevoPart]               = useState({ nombre_completo: '', telefono_whatsapp: '', grupo_id: '' })
  const [montoAbono, setMontoAbono]             = useState('')

  const { data: grupos } = useQuery(() => q.getGrupos(), [])

  // ── Estado modo "gestionar" ───────────────────────────────────────────────
  const [pagos, setPagos]                 = useState([])
  const [loadingPagos, setLoadingPagos]   = useState(mode === 'gestionar')
  const [formPago, setFormPago]           = useState({ monto: '', fecha: today(), metodo_pago: 'Efectivo' })
  const [showAddPago, setShowAddPago]     = useState(false)
  const [confirmLib, setConfirmLib]       = useState(false)
  const [saving, setSaving]               = useState(false)
  const [reasigSearch, setReasigSearch]   = useState('')
  const [reasigResults, setReasigResults] = useState([])
  const [reasigPart, setReasigPart]       = useState(null)
  const [showReasigNew, setShowReasigNew] = useState(false)
  const [reasigNuevo, setReasigNuevo]     = useState({ nombre_completo: '', telefono_whatsapp: '', grupo_id: '' })

  const showErr = e => onError(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))

  // Cargar pagos al abrir en modo gestionar
  const pagosLoadedRef = useRef(false)
  if (mode === 'gestionar' && !pagosLoadedRef.current) {
    pagosLoadedRef.current = true
    q.getPagosByBoleto(boleto.id)
      .then(setPagos)
      .catch(showErr)
      .finally(() => setLoadingPagos(false))
  }

  // ── Búsqueda de participante (debounced) ──────────────────────────────────
  const searchRef = useRef(null)
  const handlePartSearch = useCallback(async (v) => {
    setPartSearch(v)
    clearTimeout(searchRef.current)
    if (!v.trim() || v.trim().length < 2) { setPartResults([]); return }
    searchRef.current = setTimeout(async () => {
      const r = await q.buscarParticipantes(v)
      setPartResults(r)
    }, 300)
  }, [])

  // ── Búsqueda de participante para reasignar (debounced) ───────────────────
  const reasigRef = useRef(null)
  const handleReasigSearch = useCallback(async (v) => {
    setReasigSearch(v)
    clearTimeout(reasigRef.current)
    if (!v.trim() || v.trim().length < 2) { setReasigResults([]); return }
    reasigRef.current = setTimeout(async () => {
      const r = await q.buscarParticipantes(v)
      setReasigResults(r)
    }, 300)
  }, [])

  async function handleReasignar() {
    if (!reasigPart && !showReasigNew) { showErr('Selecciona o crea un participante.'); return }
    if (showReasigNew && !reasigNuevo.nombre_completo.trim()) { showErr('El nombre del participante es obligatorio.'); return }
    setSaving(true)
    try {
      let pid = reasigPart?.id
      let nombre = reasigPart?.nombre_completo
      if (!pid) {
        const p = await q.insertParticipante({ ...reasigNuevo, grupo_id: resolveGrupoId(reasigNuevo.grupo_id, grupos) })
        pid    = p.id
        nombre = reasigNuevo.nombre_completo
      }
      await q.reemplazarParticipante(boleto.id, pid, nombre)
      setBoleto(await q.getBoleto(boleto.id))
      toast(`Boleto #${fmtNum(boleto.numero_asignado, total)} reasignado a ${nombre}`)
      setMode('gestionar')
      onDone({ noClose: true })
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── Acciones: asignar ─────────────────────────────────────────────────────
  async function handleAsignar() {
    if (!partSeleccionado && !showNewForm) { showErr('Selecciona o crea un participante.'); return }
    if (showNewForm && !nuevoPart.nombre_completo.trim()) { showErr('El nombre del participante es obligatorio.'); return }
    setSaving(true)
    try {
      let pid = partSeleccionado?.id
      let nombre = partSeleccionado?.nombre_completo
      if (!pid) {
        // Si no se escogió grupo, asignar automáticamente "Otros"
        const p = await q.insertParticipante({ ...nuevoPart, grupo_id: resolveGrupoId(nuevoPart.grupo_id, grupos) })
        pid    = p.id
        nombre = nuevoPart.nombre_completo
      }
      await q.asignarBoleto(boleto.id, pid, montoAbono, boleto.precio_boleto, nombre)
      const fueCompleto = Number(montoAbono) >= Number(boleto.precio_boleto)
      toast(fueCompleto
        ? `Boleto #${fmtNum(boleto.numero_asignado, total)} pagado y liquidado 🎉`
        : `Boleto #${fmtNum(boleto.numero_asignado, total)} apartado`)
      onDone()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── Acciones: gestionar ───────────────────────────────────────────────────
  async function handleAddPago() {
    if (!formPago.monto || Number(formPago.monto) <= 0) { showErr('Ingresa un monto válido.'); return }
    setSaving(true)
    try {
      await q.insertPagoRifa({ boleto_id: boleto.id, ...formPago, monto: Number(formPago.monto) })
      const [nuevosPagos, boletoActualizado] = await Promise.all([
        q.getPagosByBoleto(boleto.id),
        q.getBoleto(boleto.id),
      ])
      // Auto-liquidar si el saldo quedó en cero
      if (Number(boletoActualizado.saldo_pendiente) <= 0 && boletoActualizado.estatus !== 'Liquidado') {
        await q.liquidarBoleto(boleto.id, 0)
        setBoleto(await q.getBoleto(boleto.id))
        toast(`Boleto #${fmtNum(boleto.numero_asignado, total)} liquidado 🎉`)
      } else {
        setBoleto(boletoActualizado)
        toast('Pago registrado')
      }
      setPagos(nuevosPagos)
      setFormPago({ monto: '', fecha: today(), metodo_pago: 'Efectivo' })
      setShowAddPago(false)
      onDone({ noClose: true })
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleDeletePago(pagoId) {
    setSaving(true)
    try {
      await q.deletePagoRifa(pagoId)
      toast('Pago eliminado')
      const [nuevosPagos, boletoActualizado] = await Promise.all([
        q.getPagosByBoleto(boleto.id),
        q.getBoleto(boleto.id),
      ])
      // Revertir a Apartado si el saldo pendiente > 0 (aplica a Liquidado y Vencido)
      if ((boletoActualizado.estatus === 'Liquidado' || boletoActualizado.estatus === 'Vencido') && Number(boletoActualizado.saldo_pendiente) > 0) {
        await q.revertirApartado(boleto.id)
        setBoleto(await q.getBoleto(boleto.id))
      } else {
        setBoleto(boletoActualizado)
      }
      setPagos(nuevosPagos)
      onDone({ noClose: true })
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleLiquidar() {
    setSaving(true)
    try {
      await q.liquidarBoleto(boleto.id, boleto.saldo_pendiente)
      toast(`Boleto #${fmtNum(boleto.numero_asignado, total)} liquidado 🎉`)
      onDone()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleLiberar() {
    setSaving(true)
    try {
      await q.liberarBoleto(boleto.id)
      toast('Boleto liberado y disponible nuevamente')
      onDone()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleReactivar() {
    setSaving(true)
    try {
      const nuevaFecha = new Date().toISOString()
      await q.revertirApartado(boleto.id)
      // Actualizar estado local directamente — sin segundo round-trip a BD
      setBoleto(prev => ({ ...prev, estatus: 'Apartado', fecha_apartado: nuevaFecha }))
      toast('Boleto reactivado como Apartado')
      onDone({ noClose: true })
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Derivar totales desde pagos (siempre en sync con la lista local)
  const totalPagado    = loadingPagos ? Number(boleto.total_pagado) : pagos.reduce((s, p) => s + Number(p.monto), 0)
  const saldoPendiente = Math.max(0, Number(rifa.precio_boleto) - totalPagado)

  // Estatus efectivo: si los pagos cubren el precio, mostrar Liquidado sin esperar round-trip a BD
  const estatusEfectivo = (!loadingPagos && saldoPendiente === 0 && pagos.length > 0)
    ? 'Liquidado'
    : boleto.estatus

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer boleto-panel" role="dialog" aria-modal="true">

        {/* Cabecera */}
        <div className="drawer-header">
          <h3 className="drawer-title">
            {mode === 'asignar'
              ? `Apartar boleto #${fmtNum(boleto.numero_asignado, total)}`
              : `Boleto #${fmtNum(boleto.numero_asignado, total)}`}
            {mode === 'gestionar' && (
              <span
                className={`badge badge-${
                  estatusEfectivo === 'Liquidado' ? 'liquidado'
                    : estatusEfectivo === 'Apartado' ? 'abonado'
                    : 'deuda'
                }`}
                style={{ fontSize: '.72rem', marginLeft: '.5rem' }}
              >
                {estatusEfectivo}
              </span>
            )}
          </h3>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Cuerpo */}
        <div className="drawer-body">

          {/* ── MODO: ASIGNAR ── */}
          {mode === 'asignar' && (
            <>
              <div className="boleto-panel-info-row">
                <span>Precio del boleto</span>
                <strong>{fmt(rifa.precio_boleto)}</strong>
              </div>

              <p className="field-section-label">Participante</p>

              {/* Búsqueda existente */}
              {!showNewForm && (
                <div className="field" style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      value={partSearch}
                      onChange={e => handlePartSearch(e.target.value)}
                      placeholder="Buscar por nombre o telefono"
                      autoFocus
                      style={{ paddingLeft: '2.2rem' }}
                    />
                  </div>
                  {partResults.length > 0 && (
                    <div className="search-dropdown" style={{ position: 'static', marginTop: '.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {partResults.map(p => (
                        <button
                          key={p.id}
                          className="search-item"
                          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => { setPartSeleccionado(p); setPartSearch(p.nombre_completo); setPartResults([]) }}
                        >
                          <span className="search-item-name">{p.nombre_completo}</span>
                          <span className="search-item-meta">{p.telefono_whatsapp}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {partSeleccionado && (
                    <div className="boleto-part-selected">
                      <span>{partSeleccionado.nombre_completo}</span>
                      <button className="btn btn-icon" onClick={() => { setPartSeleccionado(null); setPartSearch('') }}>
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Formulario nuevo participante */}
              {showNewForm ? (
                <div>
                  <div className="field">
                    <label>Nombre completo *</label>
                    <input
                      value={nuevoPart.nombre_completo}
                      onChange={e => setNuevoPart(f => ({ ...f, nombre_completo: e.target.value }))}
                      placeholder="Nombre del comprador"
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Teléfono WhatsApp</label>
                    <input
                      value={nuevoPart.telefono_whatsapp}
                      onChange={e => setNuevoPart(f => ({ ...f, telefono_whatsapp: e.target.value }))}
                      placeholder="ej. 6671234567"
                      type="tel"
                    />
                  </div>
                  <div className="field">
                    <label>Grupo social</label>
                    <select
                      value={nuevoPart.grupo_id}
                      onChange={e => setNuevoPart(f => ({ ...f, grupo_id: e.target.value }))}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.45rem .75rem', color: 'var(--text)', fontSize: '.875rem', width: '100%' }}
                    >
                      <option value="">— Sin grupo (Otros por defecto) —</option>
                      {(grupos ?? []).map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn btn-sm btn-outline"
                    style={{ marginBottom: '.75rem' }}
                    onClick={() => { setShowNewForm(false); setNuevoPart({ nombre_completo: '', telefono_whatsapp: '', grupo_id: '' }) }}
                  >
                    <X size={13} /> Cancelar
                  </button>
                </div>
              ) : (
                !partSeleccionado && (
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%', marginBottom: '.75rem' }}
                    onClick={() => { setShowNewForm(true); setPartSearch(''); setPartResults([]) }}
                  >
                    <UserPlus size={14} /> Nuevo participante
                  </button>
                )
              )}

              {/* Abono inicial */}
              <p className="field-section-label">Abono inicial <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(opcional)</span></p>
              <div className="field">
                <input
                  type="number"
                  min="0"
                  value={montoAbono}
                  onChange={e => setMontoAbono(e.target.value)}
                  placeholder={`0 — ${fmt(rifa.precio_boleto)}`}
                />
              </div>
            </>
          )}

          {/* ── MODO: GESTIONAR ── */}
          {mode === 'gestionar' && (
            <>
              {/* Info del participante */}
              <div
                className="boleto-participante-card"
                style={{ cursor: boleto.participante_id ? 'pointer' : 'default' }}
                onClick={() => boleto.participante_id && navigate(`/participantes/${boleto.participante_id}`)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '.15rem' }}>{boleto.nombre_completo ?? '—'}</div>
                  <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>{boleto.telefono_whatsapp ?? 'Sin teléfono'}</div>
                  {boleto.fecha_apartado && (
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>
                      <Clock size={11} /> Apartado: {fmtDate(boleto.fecha_apartado)}
                    </div>
                  )}
                  {boleto.participante_id && (
                    <div style={{ fontSize: '.73rem', color: 'var(--accent-light)', marginTop: '.3rem', display: 'flex', alignItems: 'center', gap: '.2rem' }}>
                      Ver perfil <ArrowRight size={11} />
                    </div>
                  )}
                </div>
                <div onClick={e => e.stopPropagation()}>
                  {boleto.telefono_whatsapp && saldoPendiente > 0 && (
                    <WhatsAppBtn nombre={boleto.nombre_completo} telefono={boleto.telefono_whatsapp} saldo={saldoPendiente} />
                  )}
                </div>
              </div>

              {/* Resumen de pagos */}
              <div className="boleto-panel-info-row">
                <span>Precio boleto</span>
                <strong>{fmt(rifa.precio_boleto)}</strong>
              </div>
              <div className="boleto-panel-info-row">
                <span>Total abonado</span>
                <strong style={{ color: 'var(--liquidado)' }}>{fmt(totalPagado)}</strong>
              </div>
              <div className="boleto-panel-info-row" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '.5rem', marginBottom: '.75rem' }}>
                <span>Saldo pendiente</span>
                <strong style={{ color: saldoPendiente > 0 ? 'var(--abonado)' : 'var(--liquidado)' }}>
                  {fmt(saldoPendiente)}
                </strong>
              </div>
              <ProgressBar value={totalPagado} max={Number(rifa.precio_boleto)} />

              {/* Historial de pagos */}
              <p className="field-section-label" style={{ marginTop: '1rem' }}>Historial de pagos</p>
              {loadingPagos ? (
                <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Cargando...</p>
              ) : pagos.length === 0 ? (
                <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>Sin pagos registrados.</p>
              ) : (
                <div className="pagos-list">
                  {pagos.map(p => (
                    <div key={p.id} className="pago-row">
                      <div>
                        <span className="pago-monto">{fmt(p.monto)}</span>
                        <span className="pago-meta">{fmtDate(p.fecha)} · {p.metodo_pago}</span>
                      </div>
                      {isAdmin && (
                        <button className="btn btn-icon btn-danger-icon" onClick={() => handleDeletePago(p.id)} disabled={saving} title="Eliminar pago">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar pago */}
              {isAdmin && estatusEfectivo !== 'Liquidado' && (
                <>
                  {showAddPago ? (
                    <div style={{ marginTop: '.75rem' }}>
                      <p className="field-section-label">Nuevo pago</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                        <div className="field">
                          <label>Monto</label>
                          <input type="number" min="1" value={formPago.monto} onChange={e => setFormPago(f => ({ ...f, monto: e.target.value }))} placeholder="$" autoFocus />
                        </div>
                        <div className="field">
                          <label>Fecha</label>
                          <input type="date" value={formPago.fecha} onChange={e => setFormPago(f => ({ ...f, fecha: e.target.value }))} />
                        </div>
                      </div>
                      <div className="field">
                        <label>Método</label>
                        <select value={formPago.metodo_pago} onChange={e => setFormPago(f => ({ ...f, metodo_pago: e.target.value }))}>
                          {['Efectivo', 'Transferencia', 'Tarjeta', 'Otro'].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '.5rem' }}>
                        <button className="btn btn-primary btn-sm" onClick={handleAddPago} disabled={saving}>
                          {saving ? 'Guardando…' : 'Guardar pago'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setShowAddPago(false)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-outline" style={{ width: '100%', marginTop: '.75rem' }} onClick={() => setShowAddPago(true)}>
                      <Plus size={14} /> Registrar pago
                    </button>
                  )}
                </>
              )}

              {/* Acciones admin */}
              {isAdmin && (
                <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {(estatusEfectivo === 'Apartado' || estatusEfectivo === 'Vencido') && (
                    <button className="btn btn-primary" onClick={handleLiquidar} disabled={saving}>
                      <CheckCircle2 size={15} /> Marcar como liquidado
                    </button>
                  )}
                  {estatusEfectivo === 'Vencido' && (
                    <button className="btn btn-outline" onClick={handleReactivar} disabled={saving}>
                      <RotateCcw size={14} /> Reactivar boleto
                    </button>
                  )}
                  {(estatusEfectivo === 'Apartado' || estatusEfectivo === 'Vencido') && (
                    <button className="btn btn-outline" onClick={() => setMode('reasignar')} disabled={saving}>
                      <UserRoundCog size={14} /> Cambiar participante
                    </button>
                  )}
                  {!confirmLib ? (
                    <button className="btn btn-outline" style={{ color: 'var(--deuda)', borderColor: 'var(--deuda)' }} onClick={() => setConfirmLib(true)} disabled={saving}>
                      <Zap size={14} /> Liberar boleto
                    </button>
                  ) : (
                    <div className="inline-confirm">
                      <p>¿Liberar este boleto? Se volverá disponible y perderá su participante.</p>
                      <div style={{ display: 'flex', gap: '.5rem' }}>
                        <button className="btn btn-danger btn-sm" onClick={handleLiberar} disabled={saving}>
                          {saving ? '…' : 'Sí, liberar'}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmLib(false)}>No</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* ── MODO: REASIGNAR ── */}
          {mode === 'reasignar' && (
            <>
              <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
                El boleto mantendrá su estatus y pagos. Solo se cambia el participante asignado.
              </p>
              <p className="field-section-label">Nuevo participante</p>
              {!showReasigNew && (
                <div className="field" style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input
                      value={reasigSearch}
                      onChange={e => handleReasigSearch(e.target.value)}
                      placeholder="Buscar por nombre o teléfono"
                      autoFocus
                      style={{ paddingLeft: '2.2rem' }}
                    />
                  </div>
                  {reasigResults.length > 0 && (
                    <div className="search-dropdown" style={{ position: 'static', marginTop: '.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {reasigResults.map(p => (
                        <button
                          key={p.id}
                          className="search-item"
                          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => { setReasigPart(p); setReasigSearch(p.nombre_completo); setReasigResults([]) }}
                        >
                          <span className="search-item-name">{p.nombre_completo}</span>
                          <span className="search-item-meta">{p.telefono_whatsapp}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {reasigPart && (
                    <div className="boleto-part-selected">
                      <span>{reasigPart.nombre_completo}</span>
                      <button className="btn btn-icon" onClick={() => { setReasigPart(null); setReasigSearch('') }}>
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {showReasigNew ? (
                <div>
                  <div className="field">
                    <label>Nombre completo *</label>
                    <input
                      value={reasigNuevo.nombre_completo}
                      onChange={e => setReasigNuevo(f => ({ ...f, nombre_completo: e.target.value }))}
                      placeholder="Nombre del comprador"
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Teléfono WhatsApp</label>
                    <input
                      value={reasigNuevo.telefono_whatsapp}
                      onChange={e => setReasigNuevo(f => ({ ...f, telefono_whatsapp: e.target.value }))}
                      placeholder="ej. 6671234567"
                      type="tel"
                    />
                  </div>
                  <div className="field">
                    <label>Grupo social</label>
                    <select
                      value={reasigNuevo.grupo_id}
                      onChange={e => setReasigNuevo(f => ({ ...f, grupo_id: e.target.value }))}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.45rem .75rem', color: 'var(--text)', fontSize: '.875rem', width: '100%' }}
                    >
                      <option value="">— Sin grupo (Otros por defecto) —</option>
                      {(grupos ?? []).map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn btn-sm btn-outline"
                    style={{ marginBottom: '.75rem' }}
                    onClick={() => { setShowReasigNew(false); setReasigNuevo({ nombre_completo: '', telefono_whatsapp: '', grupo_id: '' }) }}
                  >
                    <X size={13} /> Cancelar
                  </button>
                </div>
              ) : (
                !reasigPart && (
                  <button
                    className="btn btn-outline"
                    style={{ width: '100%', marginBottom: '.75rem' }}
                    onClick={() => { setShowReasigNew(true); setReasigSearch(''); setReasigResults([]) }}
                  >
                    <UserPlus size={14} /> Nuevo participante
                  </button>
                )
              )}
            </>
          )}
        </div>

        {/* Pie */}
        <div className="drawer-footer">
          {mode === 'asignar' ? (
            <>
              <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAsignar} disabled={saving}>
                {saving ? 'Guardando…' : 'Apartar'}
              </button>
            </>
          ) : mode === 'reasignar' ? (
            <>
              <button className="btn btn-outline" onClick={() => setMode('gestionar')} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleReasignar} disabled={saving}>
                {saving ? 'Guardando…' : 'Reasignar'}
              </button>
            </>
          ) : (
            <button className="btn btn-outline" onClick={onClose} style={{ width: '100%' }}>Cerrar</button>
          )}
        </div>
      </div>
    </>
  )
}
