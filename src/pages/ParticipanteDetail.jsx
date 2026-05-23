import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Users, Phone, Mail, Pencil, Trash2, CheckCircle2,
  Clock, AlertCircle, Trophy, Calendar, ArrowRight, ExternalLink, DollarSign,
  CreditCard, ShoppingBag, MapPin, CheckCircle, Banknote, Smartphone,
  ChevronDown, Package,
} from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { useToast } from '../lib/toast.jsx'
import { fmt, fmtNum, fmtDate, today } from '../lib/formatters.js'
import { supabase } from '../lib/supabase.js'
import * as q  from '../lib/rifas-queries.js'
import * as qt from '../lib/tiendita-queries.js'
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
  const [tab, setTab] = useState('compras')
  const { data: ventas, loading: ventasLoading } = useQuery(() => qt.getVentasDeCliente(partId), [partId])
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
    setForm({ nombre_completo: p.nombre_completo, telefono_whatsapp: p.telefono_whatsapp ?? '', email: p.email ?? '', grupo_id: p.grupo_id ?? '', direccion: p.direccion ?? '', notas: p.notas ?? '' })
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
                {p.direccion && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <MapPin size={13} /> {p.direccion}
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

        {/* ── Pestañas ── */}
        <div style={{ display: 'flex', gap: '.35rem', marginBottom: '1.25rem' }}>
          {[
            { id: 'compras', icon: ShoppingBag, label: 'Compras', count: (ventas ?? []).length },
            { id: 'rifas',   icon: Trophy,      label: 'Rifas',   count: rifas.length },
          ].map(t => (
            <button
              key={t.id}
              className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}
            >
              <t.icon size={13} />
              {t.label}
              {t.count > 0 && (
                <span style={{ background: tab === t.id ? 'rgba(255,255,255,.25)' : 'var(--accent-light)', color: tab === t.id ? '#fff' : 'var(--accent)', borderRadius: '999px', padding: '.05rem .4rem', fontSize: '.7rem', fontWeight: 700 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Rifas ── */}
        {tab === 'rifas' && (
          <>
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
          </>
        )}

        {/* ── Tab: Compras y Apartados ── */}
        {tab === 'compras' && (
          <div>
            {ventasLoading ? (
              <LoadingSpinner text="Cargando compras…" />
            ) : (ventas ?? []).length === 0 ? (
              <div className="empty">
                <ShoppingBag size={40} style={{ opacity: .25 }} />
                <p style={{ marginTop: '.75rem' }}>Sin compras ni apartados registrados.</p>
              </div>
            ) : (() => {
              const totalComprado  = ventas.reduce((s, v) => s + Number(v.precio_total ?? 0), 0)
              const totalPendiente = ventas.reduce((s, v) => s + Number(v.saldo_pendiente ?? 0), 0)
              const totalPagado    = totalComprado - totalPendiente
              const apartados      = ventas.filter(v => v.tipo === 'apartado').length
              return (
                <>
                  {/* Resumen */}
                  <div className="part-stats-grid" style={{ marginBottom: '1.25rem' }}>
                    <div className="card stat-card">
                      <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{ventas.length}</div>
                      <div className="stat-label">Compra{ventas.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="card stat-card">
                      <div className="stat-value cobrado">{fmt(totalComprado)}</div>
                      <div className="stat-label">Total comprado</div>
                    </div>
                    <div className="card stat-card">
                      <div className="stat-value" style={{ color: 'var(--liquidado)' }}>{fmt(totalPagado)}</div>
                      <div className="stat-label">Total pagado</div>
                    </div>
                    {totalPendiente > 0 && (
                      <div className="card stat-card">
                        <div className="stat-value por-cobrar">{fmt(totalPendiente)}</div>
                        <div className="stat-label">Saldo pendiente</div>
                      </div>
                    )}
                  </div>
                  {/* Lista */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                    {ventas.map(v => <VentaCompraRow key={v.id} venta={v} />)}
                  </div>
                </>
              )
            })()}
          </div>
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
          <div className="field">
            <label>Dirección</label>
            <input value={form.direccion ?? ''} onChange={e => set('direccion', e.target.value)} placeholder="Colonia, calle, número…" />
          </div>
          <div className="field">
            <label>Notas</label>
            <textarea rows={2} value={form.notas ?? ''} onChange={e => set('notas', e.target.value)} placeholder="Notas internas del contacto" />
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

// ── Fila de venta/compra (tab Compras) ──────────────────────────────────────────

const METODO_CFG = {
  'Efectivo':      { Icon: Banknote,   color: '#10b981' },
  'Transferencia': { Icon: Smartphone, color: '#3b82f6' },
  'Tarjeta':       { Icon: CreditCard, color: '#8b5cf6' },
}

function VentaCompraRow({ venta: v }) {
  const [open, setOpen] = useState(false)
  const [exp,  setExp]  = useState(null)  // null | { items, abonos, loading }

  const saldo      = Number(v.saldo_pendiente ?? 0)
  const total      = Number(v.precio_total    ?? 0)
  const pagado     = total - saldo
  const pct        = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 100
  const esApartado = v.tipo === 'apartado'

  const tipoCfg   = esApartado
    ? { color: '#8b5cf6', bg: '#8b5cf622', label: 'Apartado' }
    : { color: 'var(--accent)', bg: 'var(--accent-light)', label: 'Directa' }
  const entCfg    = v.estado_entrega === 'entregado'
    ? { color: '#10b981', bg: '#10b98122', label: 'Entregado', Icon: CheckCircle }
    : { color: '#f59e0b', bg: '#f59e0b22', label: 'Pendiente', Icon: Clock }
  const metodoCfg = METODO_CFG[v.metodo_pago] ?? { Icon: DollarSign, color: 'var(--text-muted)' }

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !exp) {
      setExp({ items: [], abonos: [], loading: true })
      try {
        const [items, abonos] = await Promise.all([
          qt.getItemsDeVenta(v.id),
          esApartado ? qt.getAbonosDeVenta(v.id) : Promise.resolve([]),
        ])
        setExp({ items: items ?? [], abonos: abonos ?? [], loading: false })
      } catch (e) {
        setExp({ items: [], abonos: [], loading: false })
      }
    }
  }

  return (
    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
      {/* Fila 1: tipo + fecha + total */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <span style={{ padding: '.12rem .5rem', borderRadius: '999px', fontSize: '.72rem', fontWeight: 700, background: tipoCfg.bg, color: tipoCfg.color, flexShrink: 0 }}>
          {tipoCfg.label}
        </span>
        <span style={{ flex: 1, fontSize: '.83rem', color: 'var(--text-muted)' }}>{fmtDate(v.fecha_venta)}</span>
        <strong style={{ fontSize: '1rem', color: saldo > 0 ? 'var(--text)' : 'var(--liquidado)' }}>{fmt(total)}</strong>
      </div>

      {/* Barra de progreso para apartados */}
      {esApartado && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
          <div style={{ background: 'var(--border)', borderRadius: '999px', height: 5, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: saldo > 0 ? '#f59e0b' : '#10b981', borderRadius: '999px', transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', color: 'var(--text-muted)' }}>
            <span>Pagado: <strong style={{ color: 'var(--liquidado)' }}>{fmt(pagado)}</strong></span>
            {saldo > 0
              ? <span style={{ color: 'var(--deuda)' }}>Pendiente: <strong>{fmt(saldo)}</strong></span>
              : <span style={{ color: '#10b981', fontWeight: 700 }}>Liquidado ✓</span>
            }
          </div>
        </div>
      )}

      {/* Fila 3: entrega + método */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem', padding: '.1rem .45rem', borderRadius: '999px', fontSize: '.72rem', fontWeight: 700, background: entCfg.bg, color: entCfg.color }}>
          <entCfg.Icon size={10} /> {entCfg.label}
        </span>
        {v.metodo_pago && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem', fontSize: '.78rem', color: metodoCfg.color }}>
            <metodoCfg.Icon size={12} /> {v.metodo_pago}
          </span>
        )}
        {v.notas && (
          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontStyle: 'italic', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.notas}
          </span>
        )}
      </div>

      {/* Toggle de productos */}
      <button
        onClick={toggle}
        style={{
          background: open ? 'var(--accent-light)' : 'var(--bg-muted)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '.4rem',
          fontSize: '.78rem',
          fontWeight: 600,
          color: open ? 'var(--accent)' : 'var(--text-muted)',
          padding: '.35rem .65rem',
          width: '100%',
          transition: 'background .15s, color .15s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          <Package size={12} />
          {open ? 'Ocultar productos' : 'Ver productos'}
          {exp && !exp.loading && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({exp.items.length})</span>}
        </span>
        <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
      </button>

      {/* Sección expandida */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.5rem', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {exp?.loading ? (
            <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', padding: '.25rem 0' }}>Cargando…</div>
          ) : (
            <>
              {/* Items del pedido */}
              {(exp?.items ?? []).length === 0 ? (
                <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', padding: '.25rem 0' }}>Sin productos registrados.</div>
              ) : (exp?.items ?? []).map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.35rem 0', borderBottom: i < exp.items.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '.83rem' }}>
                  <Package size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.productos?.nombre ?? 'Producto eliminado'}</span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>×{item.cantidad}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '.78rem', flexShrink: 0 }}>{fmt(item.precio_unitario_acordado)}/u</span>
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>{fmt(item.precio_unitario_acordado * item.cantidad)}</span>
                </div>
              ))}

              {/* Historial de pagos para apartados */}
              {esApartado && (
                <div style={{ marginTop: '.5rem', paddingTop: '.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', padding: '.6rem .75rem' }}>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>Historial de pagos</div>
                  {Number(v.anticipo_pagado) > 0 && (
                    <div style={{ display: 'flex', gap: '.5rem', fontSize: '.8rem', padding: '.2rem 0' }}>
                      <span style={{ flex: 1, color: 'var(--text-muted)' }}>Anticipo · {fmtDate(v.fecha_venta)}</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>+{fmt(v.anticipo_pagado)}</span>
                    </div>
                  )}
                  {(exp?.abonos ?? []).map(a => (
                    <div key={a.id} style={{ display: 'flex', gap: '.5rem', fontSize: '.8rem', padding: '.2rem 0', borderTop: '1px solid var(--border)' }}>
                      <span style={{ flex: 1, color: 'var(--text-muted)' }}>{a.metodo_pago} · {fmtDate(a.fecha)}{a.notas ? ` · ${a.notas}` : ''}</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>+{fmt(a.monto)}</span>
                    </div>
                  ))}
                  {!(exp?.abonos ?? []).length && !Number(v.anticipo_pagado) && (
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Sin pagos registrados aún.</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '.35rem', marginTop: '.2rem', fontSize: '.8rem', fontWeight: 700 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Saldo pendiente</span>
                    <span style={{ color: saldo > 0 ? '#f59e0b' : '#10b981' }}>{fmt(saldo)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
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
