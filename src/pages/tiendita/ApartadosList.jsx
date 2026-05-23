import { useState, useMemo } from 'react'
import { useNavigate }        from 'react-router-dom'
import {
  Clock, DollarSign, Plus, CheckCircle, ArrowRight, AlertCircle,
} from 'lucide-react'
import { useQuery }       from '../../lib/useQuery.js'
import { useToast }       from '../../lib/toast.jsx'
import { fmt, fmtDate }   from '../../lib/formatters.js'
import * as qt            from '../../lib/tiendita-queries.js'
import Breadcrumbs        from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../../lib/useBreadcrumbs.js'
import { useAuth }        from '../../lib/AuthContext.jsx'
import LoadingSpinner, { ErrorMsg } from '../../components/LoadingSpinner.jsx'
import Drawer             from '../../components/Drawer.jsx'
import ErrorModal         from '../../components/ErrorModal.jsx'
import { parseError }     from '../../lib/parseError.js'

const today   = () => new Date().toISOString().slice(0, 10)
const METODOS = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro']

export default function ApartadosList() {
  const navigate    = useNavigate()
  const crumbs      = useBreadcrumbs()
  const toast       = useToast()
  const { isAdmin } = useAuth()

  const { data, loading, error, refetch } = useQuery(() => qt.getApartadosPendientes(), [])

  const [search,   setSearch]   = useState('')
  const [drawer,   setDrawer]   = useState(null)
  const [form,     setForm]     = useState({ monto: '', fecha: today(), metodo_pago: 'Efectivo', notas: '' })
  const [saving,   setSaving]   = useState(false)
  const [errModal, setErrModal] = useState(null)

  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const set     = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function openAbono(a) {
    setForm({ monto: '', fecha: today(), metodo_pago: 'Efectivo', notas: '' })
    setDrawer({ apartado: a })
  }

  async function handleSave() {
    const monto = parseFloat(form.monto)
    if (!monto || monto <= 0) { showErr('Ingresa un monto válido.'); return }
    const saldo = Number(drawer.apartado.saldo_pendiente ?? 0)
    if (monto > saldo + 0.01) { showErr(`El abono (${fmt(monto)}) supera el saldo pendiente (${fmt(saldo)}).`); return }
    setSaving(true)
    try {
      await qt.insertAbono({
        venta_id:    drawer.apartado.id,
        monto,
        fecha:       form.fecha,
        metodo_pago: form.metodo_pago,
        notas:       form.notas.trim() || null,
      })
      toast('Abono registrado')
      setDrawer(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  const list = useMemo(() => {
    if (!search.trim()) return data ?? []
    const s = search.toLowerCase()
    return (data ?? []).filter(a =>
      (a.nombre_cliente ?? '').toLowerCase().includes(s)
    )
  }, [data, search])

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando apartados…" /></>
  if (error)   return <ErrorMsg message={error} />

  const totalSaldo = (data ?? []).reduce((s, a) => s + Number(a.saldo_pendiente ?? 0), 0)

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <div>
            <h1 className="page-title" style={{ margin: 0 }}><Clock size={22} /> Apartados pendientes</h1>
            <p style={{ margin: '.2rem 0 0', fontSize: '.85rem', color: 'var(--text-muted)' }}>
              {(data ?? []).length} apartado{(data ?? []).length !== 1 ? 's' : ''} con saldo &nbsp;·&nbsp;
              <strong style={{ color: 'var(--deuda, #ef4444)' }}>{fmt(totalSaldo)}</strong> por cobrar
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input
            className="deuda-search"
            placeholder="Buscar por cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', maxWidth: 340 }}
          />
        </div>

        {list.length === 0 ? (
          <div className="empty">
            <CheckCircle size={40} style={{ opacity: .25 }} />
            <p style={{ marginTop: '.75rem' }}>
              {search ? 'Sin resultados.' : '¡Todo al corriente! No hay apartados pendientes.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', animation: 'fadeIn .2s ease' }}>
            {list.map(a => (
              <ApartadoRow
                key={a.id}
                apartado={a}
                isAdmin={isAdmin}
                onAbono={() => openAbono(a)}
                onVerCliente={() => a.participante_id && navigate(`/participantes/${a.participante_id}`)}
              />
            ))}
          </div>
        )}

        {drawer && (
          <Drawer
            title={`Abonar — ${drawer.apartado.nombre_cliente ?? 'cliente'}`}
            onClose={() => setDrawer(null)}
            onSave={handleSave}
            saving={saving}
            saveLabel="Registrar abono"
          >
            <div style={{ padding: '.75rem 1rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', marginBottom: '.75rem', fontSize: '.85rem' }}>
              <div>Saldo pendiente: <strong style={{ color: 'var(--deuda, #ef4444)', fontSize: '1rem' }}>{fmt(drawer.apartado.saldo_pendiente)}</strong></div>
              <div style={{ color: 'var(--text-muted)', fontSize: '.8rem', marginTop: '.2rem' }}>
                Total: {fmt(drawer.apartado.precio_total)} · Pagado: {fmt(Number(drawer.apartado.precio_total) - Number(drawer.apartado.saldo_pendiente))}
              </div>
            </div>
            <div className="field">
              <label>Monto del abono *</label>
              <input type="number" min="0.01" step="0.01" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
            </div>
            <div className="field">
              <label>Método de pago</label>
              <select value={form.metodo_pago} onChange={e => set('metodo_pago', e.target.value)}>
                {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Nota opcional del abono" />
            </div>
          </Drawer>
        )}

        {errModal && <ErrorModal title={errModal.title} body={errModal.body} onClose={() => setErrModal(null)} />}
      </div>
    </>
  )
}

// ── Fila de un apartado pendiente ─────────────────────────────────────────────

function ApartadoRow({ apartado: a, isAdmin, onAbono, onVerCliente }) {
  const total  = Number(a.precio_total ?? 0)
  const saldo  = Number(a.saldo_pendiente ?? 0)
  const pagado = total - saldo
  const pct    = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0
  const esVencido = a.fecha_limite && new Date(a.fecha_limite) < new Date()

  return (
    <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '.55rem', animation: 'fadeIn .18s ease' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '.95rem', marginBottom: '.15rem' }}>
            {a.nombre_cliente ?? 'Sin nombre'}
            {esVencido && (
              <span style={{ marginLeft: '.45rem', padding: '.08rem .4rem', borderRadius: '999px', fontSize: '.7rem', fontWeight: 700, background: '#ef444422', color: '#ef4444', verticalAlign: 'middle' }}>
                <AlertCircle size={9} style={{ verticalAlign: 'middle', marginRight: '.15rem' }} />Vencido
              </span>
            )}
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
            {fmtDate(a.fecha_venta)}
            {a.fecha_limite && <span> · Límite: {fmtDate(a.fecha_limite)}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--deuda, #ef4444)' }}>{fmt(saldo)}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>de {fmt(total)}</div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div>
        <div style={{ background: 'var(--border)', borderRadius: '999px', height: 6, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--liquidado, #10b981)', borderRadius: '999px', transition: 'width .3s' }} />
        </div>
        <div style={{ fontSize: '.73rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>{pct}% pagado</div>
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={onAbono}>
            <DollarSign size={13} /> Registrar abono
          </button>
        )}
        {a.participante_id && (
          <button className="btn btn-outline btn-sm" onClick={onVerCliente}>
            <ArrowRight size={13} /> Ver cliente
          </button>
        )}
      </div>
    </div>
  )
}
