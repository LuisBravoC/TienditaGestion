import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Users, Phone, Mail, Pencil, Trash2, CheckCircle2,
  Clock, AlertCircle, Trophy, Calendar, ArrowRight, ExternalLink, DollarSign,
  CreditCard,
} from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { useToast } from '../lib/toast.jsx'
import { fmt, fmtNum, fmtDate, today } from '../lib/formatters.js'
import { supabase } from '../lib/supabase.js'
import * as q from '../lib/rifas-queries.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../lib/useBreadcrumbs.js'
import { useAuth } from '../lib/AuthContext.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import LoadingSpinner, { ErrorMsg } from '../components/LoadingSpinner.jsx'
import Drawer from '../components/Drawer.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import ErrorModal from '../components/ErrorModal.jsx'
import { parseError } from '../lib/parseError.js'
import StatusBadge from '../components/StatusBadge.jsx'
import GrupoBadge from '../components/GrupoBadge.jsx'

// ── Componente principal ──────────────────────────────────────────────────────

export default function ParticipanteDetail() {
  const navigate = useNavigate()
  const { partId } = useParams()
  const { isAdmin } = useAuth()
  const toast = useToast()

  const { data, loading, error, refetch } = useQuery(
    () => q.getParticipanteConBoletos(partId),
    [partId]
  )

  const { data: grupos } = useQuery(() => q.getGrupos(), [])
  const [drawerEdit, setDrawerEdit] = useState(false)
  const [form,       setForm]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [errModal,   setErrModal]   = useState(null)

  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Estado para pago rápido / liquidar desde el perfil
  const [drawerPago, setDrawerPago] = useState(null)  // { boleto }
  const [formPago,   setFormPago]   = useState({ monto: '', fecha: today(), metodo_pago: 'Efectivo' })
  const [confirmLiq, setConfirmLiq] = useState(null)  // { boleto }

  function openEdit() {
    const p = data.participante
    setForm({ nombre_completo: p.nombre_completo, telefono_whatsapp: p.telefono_whatsapp ?? '', email: p.email ?? '', grupo_id: p.grupo_id ?? '' })
    setDrawerEdit(true)
  }

  async function handleSave() {
    if (!form.nombre_completo.trim()) { showErr('El nombre es obligatorio.'); return }
    setSaving(true)
    try {
      let grupo_id = form.grupo_id || null
      if (!grupo_id) {
        const otros = (grupos ?? []).find(g => g.nombre.toLowerCase() === 'otros')
        grupo_id = otros?.id ?? null
      }
      await q.updateParticipante(partId, { ...form, grupo_id })
      toast('Datos actualizados')
      setDrawerEdit(false)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const { error: err } = await supabase.from('participantes').delete().eq('id', partId)
      if (err) throw err
      toast('Participante eliminado')
      navigate('/participantes', { replace: true })
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleSavePago() {
    const monto = Number(formPago.monto)
    if (!monto || monto <= 0) { showErr('Ingresa un monto válido.'); return }
    setSaving(true)
    try {
      const b = drawerPago.boleto
      await q.insertPagoRifa({ boleto_id: b.id, ...formPago, monto })
      // Verificar el saldo actualizado desde la BD (más fiable que comparar montos)
      const boletoActualizado = await q.getBoleto(b.id)
      if (Number(boletoActualizado.saldo_pendiente) <= 0 && boletoActualizado.estatus !== 'Liquidado') {
        await q.liquidarBoleto(b.id, 0)
        toast(`Boleto #${fmtNum(b.numero_asignado, b.cantidad_boletos)} liquidado 🎉`)
      } else {
        toast('Pago registrado')
      }
      setDrawerPago(null)
      setFormPago({ monto: '', fecha: today(), metodo_pago: 'Efectivo' })
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleLiquidarBoleto() {
    if (!confirmLiq) return
    setSaving(true)
    try {
      const b = confirmLiq.boleto
      await q.liquidarBoleto(b.id, b.saldo_pendiente)
      toast(`Boleto #${fmtNum(b.numero_asignado, b.cantidad_boletos)} liquidado 🎉`)
      setConfirmLiq(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  const crumbs = useBreadcrumbs({ partId: data?.participante?.nombre_completo })

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando perfil…" /></>
  if (error)   return <ErrorMsg message={error} />
  if (!data?.participante) return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="empty" style={{ marginTop: '3rem' }}>
          <Users size={48} style={{ opacity: .2 }} />
          <p style={{ marginTop: '1rem', fontWeight: 700 }}>Participante no encontrado</p>
          <p style={{ fontSize: '.88rem', color: 'var(--text-muted)', marginTop: '.35rem' }}>
            Es posible que haya sido eliminado del sistema.
          </p>
        </div>
      </div>
    </>
  )

  const { participante: p, rifas } = data

  // Totales globales
  const globalStats = rifas.reduce(
    (acc, rifa) => {
      for (const b of rifa.boletos) {
        acc.total++
        if (b.estatus === 'Liquidado') acc.liquidados++
        if (b.estatus === 'Apartado')  acc.apartados++
        acc.pagado    += Number(b.total_pagado)
        acc.pendiente += Math.max(0, Number(b.saldo_pendiente))
      }
      return acc
    },
    { total: 0, liquidados: 0, apartados: 0, pagado: 0, pendiente: 0 }
  )

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">

        {/* ── Cabecera del participante ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="part-avatar part-avatar-lg">
              {p.nombre_completo.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '.25rem' }}>{p.nombre_completo}</h2>
              <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', fontSize: '.88rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                {p.grupo && <GrupoBadge grupo={p.grupo} size="md" />}
                {p.telefono_whatsapp && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <Phone size={13} /> {p.telefono_whatsapp}
                  </span>
                )}
                {p.email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <Mail size={13} /> {p.email}
                  </span>
                )}
              </div>
            </div>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '.4rem', flexShrink: 0 }}>
                <button className="btn btn-outline btn-sm" onClick={openEdit}>
                  <Pencil size={13} /> Editar
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'none', border: '1px solid var(--deuda)', color: 'var(--deuda)' }}
                  onClick={() => setConfirmDel(true)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Resumen global de pagos ── */}
        {globalStats.total > 0 && (
          <div className="part-stats-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{globalStats.total}</div>
              <div className="stat-label">Boletos totales</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: 'var(--liquidado)' }}>{globalStats.liquidados}</div>
              <div className="stat-label">Pagados</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value cobrado">{fmt(globalStats.pagado)}</div>
              <div className="stat-label">Total pagado</div>
            </div>
            {globalStats.pendiente > 0 && (
              <div className="card stat-card">
                <div className="stat-value por-cobrar">{fmt(globalStats.pendiente)}</div>
                <div className="stat-label">Saldo pendiente</div>
              </div>
            )}
          </div>
        )}

        {/* ── Boletos por rifa ── */}
        {rifas.length === 0 ? (
          <div className="empty">
            <Trophy size={40} style={{ opacity: .25 }} />
            <p style={{ marginTop: '.75rem' }}>Este participante no tiene boletos activos.</p>
          </div>
        ) : (
          <>
            <p className="section-heading">
              Boletos por sorteo ({rifas.length} {rifas.length === 1 ? 'rifa' : 'rifas'})
            </p>
            {rifas.map(rifa => (
              <RifaSection
                key={rifa.rifa_id}
                rifa={rifa}
                isAdmin={isAdmin}
                onPagar={b => {
                  setFormPago({ monto: '', fecha: today(), metodo_pago: 'Efectivo' })
                  setDrawerPago({ boleto: b })
                }}
                onLiquidar={b => setConfirmLiq({ boleto: b })}
              />
            ))}
          </>
        )}
      </div>

      {/* Drawer editar participante */}
      {drawerEdit && (
        <Drawer
          title="Editar participante"
          onClose={() => setDrawerEdit(false)}
          onSave={handleSave}
          saving={saving}
        >
          <div className="field">
            <label>Nombre completo *</label>
            <input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label>Teléfono WhatsApp</label>
            <input type="tel" value={form.telefono_whatsapp} onChange={e => set('telefono_whatsapp', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Grupo social</label>
            <select value={form.grupo_id ?? ''} onChange={e => set('grupo_id', e.target.value || null)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.45rem .75rem', color: 'var(--text)', fontSize: '.875rem', width: '100%' }}>
              <option value="">Sin grupo</option>
              {(grupos ?? []).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
        </Drawer>
      )}

      {confirmDel && (
        <ConfirmModal
          message={`¿Eliminar a ${p.nombre_completo}? Sus boletos quedarán disponibles nuevamente.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDel(false)}
          loading={saving}
        />
      )}

      {/* Drawer pago rápido */}
      {drawerPago && (
        <Drawer
          title={`Pago — Boleto #${fmtNum(drawerPago.boleto.numero_asignado, drawerPago.boleto.cantidad_boletos)}`}
          onClose={() => setDrawerPago(null)}
          onSave={handleSavePago}
          saving={saving}
        >
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Saldo pendiente:{' '}
            <strong style={{ color: 'var(--abonado)' }}>
              {fmt(Math.max(0, Number(drawerPago.boleto.saldo_pendiente)))}
            </strong>
          </p>
          <div className="field">
            <label>Monto *</label>
            <input
              type="number" min="0.01" step="0.01"
              value={formPago.monto}
              onChange={e => setFormPago(f => ({ ...f, monto: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Fecha</label>
            <input
              type="date"
              value={formPago.fecha}
              onChange={e => setFormPago(f => ({ ...f, fecha: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Método de pago</label>
            <select
              value={formPago.metodo_pago}
              onChange={e => setFormPago(f => ({ ...f, metodo_pago: e.target.value }))}
            >
              <option>Efectivo</option>
              <option>Transferencia</option>
              <option>Tarjeta</option>
              <option>Otro</option>
            </select>
          </div>
        </Drawer>
      )}

      {/* Confirm liquidar */}
      {confirmLiq && (
        <ConfirmModal
          message={`¿Liquidar boleto #${fmtNum(confirmLiq.boleto.numero_asignado, confirmLiq.boleto.cantidad_boletos)}? ${
            Number(confirmLiq.boleto.saldo_pendiente) > 0
              ? `Se marcará ${fmt(Number(confirmLiq.boleto.saldo_pendiente))} como pagado.`
              : 'El boleto ya está completamente pagado.'
          }`}
          onConfirm={handleLiquidarBoleto}
          onCancel={() => setConfirmLiq(null)}
          loading={saving}
          confirmLabel="Liquidar"
          loadingLabel="Liquidando…"
          confirmClassName="btn-primary"
        />
      )}

      {errModal && <ErrorModal {...errModal} onClose={() => setErrModal(null)} />}
    </>
  )
}

// ── Sección de una rifa con sus boletos ────────────────────────────────────────

function RifaSection({ rifa, isAdmin, onPagar, onLiquidar }) {
  const boletos = rifa.boletos ?? []
  const total   = rifa.cantidad_boletos
  const meta    = Number(rifa.precio_boleto) * boletos.length
  const pagado  = boletos.reduce((s, b) => s + Number(b.total_pagado), 0)
  const pendiente = boletos.reduce((s, b) => s + Math.max(0, Number(b.saldo_pendiente)), 0)

  const gridUrl = rifa.campana_id
    ? `/rifas/${rifa.campana_id}/sorteos/${rifa.rifa_id}`
    : null

  return (
    <div className="part-rifa-section">
      {/* Cabecera de la rifa */}
      <div className="part-rifa-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
            <Trophy size={15} style={{ color: 'var(--abonado)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{rifa.nombre_premio}</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '.25rem', fontSize: '.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span><DollarSign size={11} /> {fmt(rifa.precio_boleto)} / boleto</span>
            {rifa.fecha_sorteo && (
              <span><Calendar size={11} /> Sorteo: {fmtDate(rifa.fecha_sorteo)}</span>
            )}
            <span>
              {boletos.length} {boletos.length === 1 ? 'boleto' : 'boletos'} en esta rifa
            </span>
          </div>
        </div>
        {gridUrl && (
          <Link
            to={gridUrl}
            className="btn btn-outline btn-sm"
            style={{ flexShrink: 0 }}
            title="Ver cuadrícula de la rifa"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={13} /> Ver cuadrícula
          </Link>
        )}
      </div>

      {/* Barra de progreso de pago */}
      {meta > 0 && (
        <div style={{ margin: '.5rem 0 .75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--text-muted)', marginBottom: '.25rem' }}>
            <span>Pagado: <strong style={{ color: 'var(--liquidado)' }}>{fmt(pagado)}</strong></span>
            {pendiente > 0
              ? <span>Falta: <strong style={{ color: 'var(--abonado)' }}>{fmt(pendiente)}</strong></span>
              : <span style={{ color: 'var(--liquidado)' }}>✓ Todo pagado</span>
            }
          </div>
          <ProgressBar value={pagado} max={meta} />
        </div>
      )}

      {/* Lista de boletos */}
      <div className="part-boletos-list">
        {boletos.map(b => (
          <BoletoRow key={b.id} boleto={b} total={total} isAdmin={isAdmin} onPagar={onPagar} onLiquidar={onLiquidar} />
        ))}
      </div>
    </div>
  )
}

// ── Fila individual de boleto ──────────────────────────────────────────────────

function BoletoRow({ boleto: b, total, isAdmin, onPagar, onLiquidar }) {
  const saldo = Math.max(0, Number(b.saldo_pendiente))

  return (
    <div className={`part-boleto-row part-boleto-${b.estatus.toLowerCase()}`}>
      {/* Número */}
      <div className="part-boleto-num">#{fmtNum(b.numero_asignado, total)}</div>

      {/* Badge estatus */}
      <StatusBadge status={b.estatus} style={{ fontSize: '.72rem', flexShrink: 0 }} />

      {/* Pagos */}
      <div className="part-boleto-pagos">
        <span>
          Pagado: <strong style={{ color: 'var(--liquidado)' }}>{fmt(b.total_pagado)}</strong>
        </span>
        {saldo > 0 ? (
          <span style={{ color: 'var(--abonado)' }}>
            Falta: <strong>{fmt(saldo)}</strong>
          </span>
        ) : b.estatus !== 'Vencido' ? (
          <span style={{ color: 'var(--liquidado)' }}>✓ Completo</span>
        ) : null}
      </div>

      {/* Fecha apartado */}
      {b.fecha_apartado && (
        <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          <Clock size={10} /> {new Date(b.fecha_apartado).toLocaleDateString('es-MX')}
        </span>
      )}

      {/* Acciones rápidas — solo en boletos Apartados para admins */}
      {isAdmin && b.estatus === 'Apartado' && (
        <div style={{ display: 'flex', gap: '.35rem', marginLeft: 'auto', flexShrink: 0 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ padding: '.25rem .6rem', fontSize: '.75rem' }}
            onClick={() => onPagar?.(b)}
            title="Registrar pago"
          >
            <CreditCard size={12} /> Pagar
          </button>
          <button
            className="btn btn-sm"
            style={{ padding: '.25rem .6rem', fontSize: '.75rem', background: 'var(--liquidado)', color: '#fff', border: 'none' }}
            onClick={() => onLiquidar?.(b)}
            title="Liquidar boleto"
          >
            <CheckCircle2 size={12} /> Liquidar
          </button>
        </div>
      )}
    </div>
  )
}
