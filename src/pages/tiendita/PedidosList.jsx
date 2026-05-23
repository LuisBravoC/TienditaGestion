import { useState, useMemo } from 'react'
import {
  ShoppingCart, Plus, Pencil, Trash2, ChevronDown, Package,
  CheckCircle, Truck, ExternalLink, AlertTriangle,
} from 'lucide-react'
import { useQuery }        from '../../lib/useQuery.js'
import { useToast }        from '../../lib/toast.jsx'
import { fmt, fmtDate, today } from '../../lib/formatters.js'
import * as q              from '../../lib/tiendita-queries.js'
import Breadcrumbs         from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs }  from '../../lib/useBreadcrumbs.js'
import { useAuth }         from '../../lib/AuthContext.jsx'
import LoadingSpinner, { ErrorMsg } from '../../components/LoadingSpinner.jsx'
import Drawer              from '../../components/Drawer.jsx'
import ConfirmModal        from '../../components/ConfirmModal.jsx'
import ErrorModal          from '../../components/ErrorModal.jsx'
import { parseError }      from '../../lib/parseError.js'

// ── Constantes ───────────────────────────────────────────────────────────────
const PLATAFORMAS = ['Aliexpress', 'Amazon', 'Temu', 'Mercado Libre', 'Shein', 'Otro']

const EMPTY_HEADER = {
  proveedor: '', plataforma: 'Aliexpress', fecha_compra: today(),
  numero_guia: '', url_seguimiento: '', monto_envio: '', notas: '',
}
const EMPTY_ITEM = { producto_id: '', cantidad: 1, costo_unitario_base: 0 }

// ── Badges ───────────────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = estado === 'recibido'
    ? { color: '#10b981', bg: '#10b98122', Icon: CheckCircle, label: 'Recibido' }
    : { color: '#f59e0b', bg: '#f59e0b22', Icon: Truck,       label: 'En tránsito' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', padding: '.2rem .55rem', borderRadius: '999px', fontSize: '.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
      <cfg.Icon size={11} /> {cfg.label}
    </span>
  )
}

function PlataformaBadge({ plataforma }) {
  const COLORS = { Aliexpress: '#ff6a00', Amazon: '#ff9900', Temu: '#ff4637', 'Mercado Libre': '#ffe600', Shein: '#ee3297', Otro: '#6b7280' }
  const c = COLORS[plataforma] ?? '#6b7280'
  return (
    <span style={{ padding: '.15rem .45rem', borderRadius: 4, fontSize: '.72rem', fontWeight: 700, background: c + '22', color: c, flexShrink: 0 }}>
      {plataforma}
    </span>
  )
}

// ── Item row en el drawer ────────────────────────────────────────────────────
function ItemRow({ item, idx, productos, onChange, onRemove }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px auto', gap: '.4rem', alignItems: 'center', marginBottom: '.4rem' }}>
      <select
        value={item.producto_id}
        onChange={e => {
          const prod = (productos ?? []).find(p => p.id === e.target.value)
          onChange(idx, { producto_id: e.target.value, costo_unitario_base: prod?.precio_costo ?? 0 })
        }}
        style={{ height: '2.1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 .5rem', fontSize: '.82rem' }}
      >
        <option value="">— Producto —</option>
        {(productos ?? []).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>
      <input
        type="number" min="1" step="1" value={item.cantidad}
        onChange={e => onChange(idx, 'cantidad', e.target.value)}
        placeholder="Cant."
        style={{ height: '2.1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 .4rem', fontSize: '.82rem', textAlign: 'center' }}
      />
      <input
        type="number" min="0" step="0.01" value={item.costo_unitario_base}
        onChange={e => onChange(idx, 'costo_unitario_base', e.target.value)}
        placeholder="$/u"
        style={{ height: '2.1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 .4rem', fontSize: '.82rem', textAlign: 'right' }}
      />
      <button
        type="button" onClick={() => onRemove(idx)}
        style={{ height: '2.1rem', width: '2.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: '#ef444415', color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}
      >×</button>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function PedidosList() {
  const crumbs     = useBreadcrumbs()
  const { isAdmin } = useAuth()
  const toast      = useToast()

  const { data, loading, error, refetch } = useQuery(() => q.getPedidos(), [])
  const { data: productos }               = useQuery(() => q.getProductos(), [])

  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [expanded,     setExpanded]     = useState(null)

  const [drawer,      setDrawer]      = useState(null)
  const [headerForm,  setHeaderForm]  = useState(EMPTY_HEADER)
  const [items,       setItems]       = useState([{ ...EMPTY_ITEM }])
  const [saving,      setSaving]      = useState(false)

  const [confirm,      setConfirm]      = useState(null)   // pedido id para eliminar
  const [recibirConfirm, setRecibirConfirm] = useState(null) // pedido obj para marcar recibido
  const [errModal,     setErrModal]     = useState(null)

  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const setH    = (k, v) => setHeaderForm(f => ({ ...f, [k]: v }))

  // ── item helpers ──
  function addItem()             { setItems(its => [...its, { ...EMPTY_ITEM }]) }
  function removeItem(i)         { setItems(its => its.filter((_, idx) => idx !== i)) }
  function changeItem(i, kOrObj, v) {
    setItems(its => its.map((it, idx) =>
      idx === i ? { ...it, ...(typeof kOrObj === 'object' ? kOrObj : { [kOrObj]: v }) } : it
    ))
  }

  // ── calcular resumen del envío prorrateado ──
  const resumen = useMemo(() => {
    const totalUds  = items.reduce((s, i) => s + (parseInt(i.cantidad) || 0), 0)
    const envio     = parseFloat(headerForm.monto_envio) || 0
    const prorrateo = totalUds > 0 ? envio / totalUds : 0
    const total     = items.reduce((s, i) => {
      const cant  = parseInt(i.cantidad) || 0
      const costo = parseFloat(i.costo_unitario_base) || 0
      return s + cant * (costo + prorrateo)
    }, 0)
    return { totalUds, prorrateo, total }
  }, [items, headerForm.monto_envio])

  // ── abrir drawers ──
  function openCreate() {
    setHeaderForm({ ...EMPTY_HEADER, fecha_compra: today() })
    setItems([{ ...EMPTY_ITEM }])
    setDrawer({ mode: 'create' })
  }

  function openEdit(p, e) {
    e.stopPropagation()
    setHeaderForm({
      proveedor:       p.proveedor       ?? '',
      plataforma:      p.plataforma      ?? 'Otro',
      fecha_compra:    p.fecha_compra    ?? today(),
      numero_guia:     p.numero_guia     ?? '',
      url_seguimiento: p.url_seguimiento ?? '',
      monto_envio:     p.monto_envio     ?? '',
      notas:           p.notas           ?? '',
    })
    // Cargar items existentes
    const existingItems = (p.pedido_items ?? []).map(i => ({
      producto_id:        i.producto_id,
      cantidad:           i.cantidad,
      costo_unitario_base: i.costo_unitario_base ?? 0,
    }))
    setItems(existingItems.length ? existingItems : [{ ...EMPTY_ITEM }])
    setDrawer({ mode: 'edit', record: p })
  }

  // ── guardar ──
  async function handleSave() {
    if (items.length === 0 || items.every(i => !i.producto_id)) {
      showErr('Agrega al menos un producto al pedido.'); return
    }
    const itemsValidos = items.filter(i => i.producto_id)
    if (itemsValidos.some(i => !(parseInt(i.cantidad) > 0))) {
      showErr('Todos los productos deben tener cantidad mayor a 0.'); return
    }

    const { totalUds, prorrateo } = resumen
    const itemsPayload = itemsValidos.map(i => {
      const cant  = parseInt(i.cantidad)
      const base  = parseFloat(i.costo_unitario_base) || 0
      return {
        producto_id:             i.producto_id,
        cantidad:                cant,
        costo_unitario_base:     base,
        costo_envio_prorrateado: prorrateo,
        costo_real:              base + prorrateo,
      }
    })
    const montoTotal = itemsPayload.reduce((s, i) => s + i.costo_real * i.cantidad, 0)

    const pedidoPayload = {
      proveedor:       headerForm.proveedor.trim()       || null,
      plataforma:      headerForm.plataforma,
      fecha_compra:    headerForm.fecha_compra           || today(),
      numero_guia:     headerForm.numero_guia.trim()     || null,
      url_seguimiento: headerForm.url_seguimiento.trim() || null,
      monto_envio:     parseFloat(headerForm.monto_envio) || 0,
      monto_total:     montoTotal,
      notas:           headerForm.notas.trim()           || null,
    }

    setSaving(true)
    try {
      if (drawer.mode === 'create') {
        await q.insertPedido(pedidoPayload, itemsPayload)
        toast('Pedido registrado')
      } else {
        await q.updatePedidoConItems(drawer.record.id, pedidoPayload, itemsPayload)
        toast('Pedido actualizado')
      }
      setDrawer(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── marcar recibido ──
  async function handleMarcarRecibido() {
    if (!recibirConfirm) return
    setSaving(true)
    try {
      await q.updatePedido(recibirConfirm.id, { estado: 'recibido', fecha_recibido: today() })
      toast('Pedido marcado como recibido — stock actualizado')
      setRecibirConfirm(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── eliminar ──
  async function handleDelete() {
    setSaving(true)
    try {
      await q.deletePedido(confirm)
      toast('Pedido eliminado')
      setConfirm(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── lista filtrada ──
  const list = useMemo(() => {
    return (data ?? []).filter(p => !estadoFiltro || p.estado === estadoFiltro)
  }, [data, estadoFiltro])

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando pedidos…" /></>
  if (error)   return <ErrorMsg message={error} />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">

        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><ShoppingCart size={22} /> Pedidos de compra</h1>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={estadoFiltro}
              onChange={e => setEstadoFiltro(e.target.value)}
              style={{ height: '2.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 .75rem', fontSize: '.875rem' }}
            >
              <option value="">Todos los estados</option>
              <option value="en_transito">En tránsito</option>
              <option value="recibido">Recibidos</option>
            </select>
            {isAdmin && (
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={15} /> Nuevo pedido
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <ShoppingCart size={36} style={{ opacity: .25, marginBottom: '.5rem' }} />
            <p>Sin pedidos{estadoFiltro ? ' con ese estado' : ' todavía'}.</p>
            {isAdmin && !estadoFiltro && (
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={openCreate}>
                <Plus size={15} /> Registrar primer pedido
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {list.map(pedido => {
              const isExpanded = expanded === pedido.id
              const totalItems = (pedido.pedido_items ?? []).reduce((s, i) => s + (i.cantidad ?? 0), 0)
              return (
                <div key={pedido.id} className="card" style={{ overflow: 'hidden' }}>
                  {/* Cabecera del pedido */}
                  <div style={{ padding: '.9rem 1rem', display: 'flex', gap: '.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.25rem' }}>
                        <PlataformaBadge plataforma={pedido.plataforma} />
                        <span style={{ fontWeight: 700, fontSize: '.95rem' }}>
                          {pedido.proveedor || pedido.plataforma}
                        </span>
                        <EstadoBadge estado={pedido.estado} />
                      </div>
                      <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                        <span>{fmtDate(pedido.fecha_compra)}</span>
                        {pedido.numero_guia && <span>Guía: <strong style={{ color: 'var(--text)' }}>{pedido.numero_guia}</strong></span>}
                        {pedido.fecha_recibido && <span>Recibido: {fmtDate(pedido.fecha_recibido)}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>{fmt(pedido.monto_total)}</div>
                      <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{totalItems} {totalItems === 1 ? 'unidad' : 'unidades'}</div>
                    </div>
                  </div>

                  {/* Barra de acciones */}
                  <div style={{ padding: '.5rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap', background: 'var(--bg-muted)' }}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : pedido.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.3rem', color: 'var(--text-muted)', fontSize: '.8rem', padding: '.2rem .1rem' }}
                    >
                      <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                      {(pedido.pedido_items ?? []).length} producto{(pedido.pedido_items ?? []).length !== 1 ? 's' : ''}
                    </button>
                    {pedido.url_seguimiento && (
                      <a href={pedido.url_seguimiento} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginLeft: '.25rem' }}>
                        <ExternalLink size={12} /> Seguimiento
                      </a>
                    )}
                    <div style={{ flex: 1 }} />
                    {isAdmin && pedido.estado === 'en_transito' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                        onClick={() => setRecibirConfirm(pedido)}
                      >
                        <CheckCircle size={13} /> Marcar recibido
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button className="btn btn-icon" onClick={e => openEdit(pedido, e)} title="Editar"><Pencil size={13} /></button>
                        <button className="btn btn-icon btn-danger-icon" onClick={() => setConfirm(pedido.id)} title="Eliminar"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>

                  {/* Items expandidos */}
                  {isExpanded && (pedido.pedido_items ?? []).length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {(pedido.pedido_items ?? []).map((item, i) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.5rem 1rem', borderBottom: i < pedido.pedido_items.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '.85rem' }}>
                          <Package size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontWeight: 500 }}>{item.productos?.nombre ?? 'Producto eliminado'}</span>
                          <span style={{ color: 'var(--text-muted)' }}>×{item.cantidad}</span>
                          {item.costo_real > 0 && (
                            <span style={{ fontWeight: 600 }}>{fmt(item.costo_real)}/u</span>
                          )}
                          <span style={{ fontWeight: 700, minWidth: '70px', textAlign: 'right' }}>
                            {fmt(item.costo_real * item.cantidad)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded && (pedido.pedido_items ?? []).length === 0 && (
                    <div style={{ padding: '.75rem 1rem', fontSize: '.82rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                      Sin productos registrados.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Drawer crear/editar */}
        {drawer && (
          <Drawer
            title={drawer.mode === 'create' ? 'Nuevo pedido' : 'Editar pedido'}
            onClose={() => setDrawer(null)}
            onSave={handleSave}
            saving={saving}
          >
            {/* Cabecera del pedido */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="field">
                <label>Plataforma</label>
                <select value={headerForm.plataforma} onChange={e => setH('plataforma', e.target.value)}>
                  {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Fecha de compra</label>
                <input type="date" value={headerForm.fecha_compra} onChange={e => setH('fecha_compra', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Proveedor / Tienda</label>
              <input value={headerForm.proveedor} onChange={e => setH('proveedor', e.target.value)} placeholder="Ej. Vendor oficial AliExpress" autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="field">
                <label>Número de guía</label>
                <input value={headerForm.numero_guia} onChange={e => setH('numero_guia', e.target.value)} placeholder="LP000000000CN" />
              </div>
              <div className="field">
                <label>Costo de envío</label>
                <input type="number" min="0" step="0.01" value={headerForm.monto_envio} onChange={e => setH('monto_envio', e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="field">
              <label>URL de seguimiento</label>
              <input value={headerForm.url_seguimiento} onChange={e => setH('url_seguimiento', e.target.value)} placeholder="https://…" />
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={headerForm.notas} onChange={e => setH('notas', e.target.value)} placeholder="Comentarios opcionales del pedido" />
            </div>

            {/* Items */}
            <div style={{ marginTop: '.5rem' }}>
              <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: '.5rem' }}>
                Productos del pedido
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px auto', gap: '.4rem', marginBottom: '.3rem' }}>
                <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', paddingLeft: '.2rem' }}>Producto</span>
                <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>Cant.</span>
                <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>Costo/u</span>
                <span />
              </div>
              {items.map((item, i) => (
                <ItemRow
                  key={i}
                  idx={i}
                  item={item}
                  productos={productos}
                  onChange={changeItem}
                  onRemove={removeItem}
                />
              ))}
              <button type="button" className="btn btn-outline btn-sm" onClick={addItem} style={{ marginTop: '.25rem', width: '100%' }}>
                <Plus size={13} /> Agregar producto
              </button>

              {/* Resumen de prorrateo */}
              {resumen.totalUds > 0 && (
                <div style={{ marginTop: '.75rem', padding: '.6rem .75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total unidades</span>
                    <strong style={{ color: 'var(--text)' }}>{resumen.totalUds}</strong>
                  </div>
                  {parseFloat(headerForm.monto_envio) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Envío prorrateado</span>
                      <strong style={{ color: 'var(--text)' }}>{fmt(resumen.prorrateo)}/u</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '.25rem', marginTop: '.1rem' }}>
                    <span>Total estimado del pedido</span>
                    <strong style={{ color: 'var(--accent)', fontSize: '.9rem' }}>{fmt(resumen.total)}</strong>
                  </div>
                </div>
              )}
            </div>
          </Drawer>
        )}

        {/* Modal marcar recibido */}
        {recibirConfirm && (
          <ConfirmModal
            message={`¿Confirmas que recibiste el pedido de ${recibirConfirm.proveedor || recibirConfirm.plataforma}? El stock de los productos se actualizará automáticamente.`}
            onConfirm={handleMarcarRecibido}
            onCancel={() => setRecibirConfirm(null)}
            loading={saving}
            confirmLabel="Confirmar"
            loadingLabel="Guardando…"
            confirmClassName="btn-primary"
          />
        )}

        {confirm && (
          <ConfirmModal
            title="Eliminar pedido"
            message="¿Eliminar este pedido y todos sus productos? Esta acción no se puede deshacer."
            onConfirm={handleDelete}
            onCancel={() => setConfirm(null)}
            confirmLabel="Eliminar"
            loadingLabel="Eliminando…"
            confirmClassName="btn-danger"
          />
        )}
        {errModal && <ErrorModal title={errModal.title} body={errModal.body} onClose={() => setErrModal(null)} />}
      </div>
    </>
  )
}

