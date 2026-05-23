import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Package, Pencil, Trash2, ExternalLink, ArrowLeft, Plus,
  ChevronDown, ShoppingCart, TrendingDown, TrendingUp, BarChart3,
  CheckCircle, Clock, Users,
} from 'lucide-react'
import { useQuery } from '../../lib/useQuery.js'
import { useToast } from '../../lib/toast.jsx'
import { fmt, fmtDate } from '../../lib/formatters.js'
import * as q from '../../lib/tiendita-queries.js'
import Breadcrumbs from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../../lib/useBreadcrumbs.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import LoadingSpinner, { ErrorMsg } from '../../components/LoadingSpinner.jsx'
import Drawer from '../../components/Drawer.jsx'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import ErrorModal from '../../components/ErrorModal.jsx'
import { parseError } from '../../lib/parseError.js'
import GrupoBadge from '../../components/GrupoBadge.jsx'

const MOTIVOS = ['merma', 'regalo', 'pérdida', 'devolución', 'corrección', 'otro']

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ flex: '1 1 130px', textAlign: 'center', padding: '1rem .75rem' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.15rem' }}>{label}</div>
    </div>
  )
}

export default function ProductoDetail() {
  const { productoId } = useParams()
  const navigate       = useNavigate()
  const { isAdmin }    = useAuth()
  const toast          = useToast()

  const { data: producto, loading, error, refetch }  = useQuery(() => q.getProducto(productoId), [productoId])
  const crumbs         = useBreadcrumbs({ productoId: producto?.nombre ?? 'Producto' })
  const { data: categorias }                         = useQuery(() => q.getCategorias(), [])
  const { data: movimientos, refetch: refetchMov }   = useQuery(() => q.getMovimientosStock(productoId), [productoId])
  const { data: ventasProd }                         = useQuery(() => q.getVentasDeProducto(productoId), [productoId])

  const [movOpen,    setMovOpen]    = useState(true)
  const [ventasOpen, setVentasOpen] = useState(true)
  const [ajuDrawer,  setAjuDrawer]  = useState(false)
  const [ajuForm,    setAjuForm]    = useState({ tipo: '+', cantidad: '', motivo: 'otro', notas: '' })
  const [ajuSaving,  setAjuSaving]  = useState(false)
  const [editDrawer, setEditDrawer] = useState(false)
  const [editForm,   setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [confirm,    setConfirm]    = useState(false)
  const [errModal,   setErrModal]   = useState(null)

  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const setAju  = (k, v) => setAjuForm(f => ({ ...f, [k]: v }))
  const setEdi  = (k, v) => setEditForm(f => ({ ...f, [k]: v }))

  function openEdit() {
    setEditForm({
      nombre:              producto.nombre,
      descripcion:         producto.descripcion          ?? '',
      precio_venta:        producto.precio_venta          ?? '',
      precio_costo:        producto.precio_costo          ?? '',
      categoria_id:        producto.categoria_id          ?? '',
      url_compra_original: producto.url_compra_original   ?? '',
      notas:               producto.notas                 ?? '',
    })
    setEditDrawer(true)
  }

  async function handleEditSave() {
    if (!editForm.nombre?.trim()) { showErr('El nombre es obligatorio.'); return }
    const precio_venta = parseFloat(editForm.precio_venta)
    if (isNaN(precio_venta) || precio_venta < 0) { showErr('Precio de venta inválido.'); return }
    setEditSaving(true)
    try {
      await q.updateProducto(productoId, {
        nombre:              editForm.nombre.trim(),
        descripcion:         editForm.descripcion.trim()         || null,
        precio_venta,
        precio_costo:        editForm.precio_costo !== '' ? parseFloat(editForm.precio_costo) : null,
        categoria_id:        editForm.categoria_id               || null,
        url_compra_original: editForm.url_compra_original.trim() || null,
        notas:               editForm.notas.trim()               || null,
      })
      toast('Producto actualizado')
      setEditDrawer(false)
      refetch()
    } catch (e) { showErr(e) }
    finally { setEditSaving(false) }
  }

  async function handleDelete() {
    try {
      await q.deleteProducto(productoId)
      toast('Producto eliminado')
      navigate('/productos')
    } catch (e) { showErr(e); setConfirm(false) }
  }

  async function handleAjuste() {
    const cant = parseInt(ajuForm.cantidad, 10)
    if (!cant || cant <= 0) { showErr('Ingresa una cantidad mayor a 0.'); return }
    setAjuSaving(true)
    try {
      await q.insertAjusteStock({
        producto_id: productoId,
        cantidad:    ajuForm.tipo === '+' ? cant : -cant,
        motivo:      ajuForm.motivo,
        notas:       ajuForm.notas.trim() || null,
      })
      toast('Ajuste registrado')
      setAjuDrawer(false)
      setAjuForm({ tipo: '+', cantidad: '', motivo: 'otro', notas: '' })
      refetch(); refetchMov()
    } catch (e) { showErr(e) }
    finally { setAjuSaving(false) }
  }

  const margen = useMemo(() => {
    if (!producto) return null
    const v = parseFloat(producto.precio_venta)
    const c = parseFloat(producto.precio_costo)
    if (!c || c <= 0) return null
    return (((v - c) / c) * 100).toFixed(1)
  }, [producto])

  const stockColor = useMemo(() => {
    if (!producto) return 'var(--text)'
    const n = Number(producto.stock_actual ?? 0)
    return n <= 0 ? '#ef4444' : n <= 2 ? '#f59e0b' : '#10b981'
  }, [producto])

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando producto…" /></>
  if (error)   return <ErrorMsg message={error} />
  if (!producto) return <ErrorMsg message="Producto no encontrado." />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-icon" onClick={() => navigate('/productos')} title="Volver"><ArrowLeft size={16} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{producto.nombre}</h1>
              {producto.categoria_nombre && (
                <GrupoBadge grupo={{ nombre: producto.categoria_nombre, color: producto.categoria_color }} />
              )}
            </div>
            {producto.descripcion && (
              <p style={{ margin: '.2rem 0 0', fontSize: '.85rem', color: 'var(--text-muted)' }}>{producto.descripcion}</p>
            )}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
              {producto.url_compra_original && (
                <a href={producto.url_compra_original} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                  <ExternalLink size={13} /> Fuente
                </a>
              )}
              <button className="btn btn-outline btn-sm" onClick={openEdit}><Pencil size={13} /> Editar</button>
              <button className="btn btn-sm" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }} onClick={() => setConfirm(true)}><Trash2 size={13} /></button>
            </div>
          )}
        </div>

        {/* Precios */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Precio venta</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>{fmt(producto.precio_venta)}</div>
          </div>
          {producto.precio_costo != null && (
            <>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Costo</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{fmt(producto.precio_costo)}</div>
              </div>
              {margen !== null && (
                <div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Margen</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: parseFloat(margen) >= 0 ? '#10b981' : '#ef4444' }}>{margen}%</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <StatCard label="Total comprado" value={`${producto.total_comprado ?? 0} uds`} />
          <StatCard label="Stock actual"   value={`${producto.stock_actual   ?? 0} uds`} color={stockColor} />
          <StatCard label="Total vendido"  value={`${producto.total_vendido  ?? 0} uds`} />
        </div>

        {/* Notas */}
        {producto.notas && (
          <div className="card" style={{ marginBottom: '1rem', padding: '.75rem 1rem', fontSize: '.85rem', color: 'var(--text-muted)', borderLeft: '3px solid var(--accent)' }}>
            <strong style={{ color: 'var(--text)' }}>Notas: </strong>{producto.notas}
          </div>
        )}

        {/* Movimientos */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setMovOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--text)', fontWeight: 700, fontSize: '.9rem', padding: 0 }}
            >
              <BarChart3 size={16} />
              Movimientos de inventario
              <ChevronDown size={14} style={{ transform: movOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setAjuDrawer(true)}>
                <Plus size={13} /> Ajuste
              </button>
            )}
          </div>

          <div className={`chart-collapse${movOpen ? ' open' : ''}`}>
            <div className="chart-collapse-inner">
              {(movimientos ?? []).length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.85rem' }}>
                  Sin movimientos registrados aún.
                </div>
              ) : (movimientos ?? []).map((m, i) => {
                const isPositivo = m.cantidad > 0
                const Icon = m.tipo === 'pedido' ? ShoppingCart : isPositivo ? TrendingUp : TrendingDown
                const color = isPositivo ? '#10b981' : '#ef4444'
                return (
                  <div key={`${m.tipo}-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem 1rem', borderBottom: i < (movimientos.length - 1) ? '1px solid var(--border)' : 'none' }}>
                    <Icon size={15} style={{ color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.tipo === 'pedido' ? (m.descripcion ?? 'Pedido de compra') : m.tipo === 'venta' ? (m.descripcion ?? 'Venta') : (m.motivo ?? 'Ajuste manual')}
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{fmtDate(m.fecha)}</div>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '.95rem', color, flexShrink: 0 }}>
                      {isPositivo ? '+' : ''}{m.cantidad}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Historial de ventas */}
        <div className="card" style={{ overflow: 'hidden', marginTop: '1rem' }}>
          <div style={{ padding: '.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setVentasOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--text)', fontWeight: 700, fontSize: '.9rem', padding: 0 }}
            >
              <Users size={16} />
              Ventas de este producto
              {(ventasProd ?? []).length > 0 && (
                <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '999px', padding: '.05rem .45rem', fontSize: '.72rem', fontWeight: 700 }}>
                  {ventasProd.length}
                </span>
              )}
              <ChevronDown size={14} style={{ transform: ventasOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
          </div>
          <div className={`chart-collapse${ventasOpen ? ' open' : ''}`}>
            <div className="chart-collapse-inner">
              {(ventasProd ?? []).length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.85rem' }}>Sin ventas registradas aún.</div>
              ) : (ventasProd ?? []).map((item, i) => {
                const cliente    = item.ventas?.participantes?.nombre_completo ?? item.ventas?.nombre_cliente ?? 'Sin nombre'
                const total      = Number(item.cantidad) * Number(item.precio_unitario_acordado)
                const entregado  = item.ventas?.estado_entrega === 'entregado'
                return (
                  <div key={item.venta_id + '-' + i} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.6rem 1rem', borderBottom: i < (ventasProd.length - 1) ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600, fontSize: '.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente}</div>
                      <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{fmtDate(item.ventas?.fecha_venta)}</div>
                    </div>
                    <span style={{ fontSize: '.82rem', color: 'var(--text-muted)', flexShrink: 0 }}>{item.cantidad} ud{item.cantidad !== 1 ? 's' : ''}</span>
                    <span style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--liquidado)', flexShrink: 0 }}>{fmt(total)}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem', padding: '.1rem .4rem', borderRadius: '999px', fontSize: '.7rem', fontWeight: 700, background: entregado ? '#10b98122' : '#f59e0b22', color: entregado ? '#10b981' : '#f59e0b', flexShrink: 0 }}>
                      {entregado ? <CheckCircle size={10} /> : <Clock size={10} />}
                      {entregado ? 'Entregado' : 'Pendiente'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Drawer ajuste */}
        {ajuDrawer && (
          <Drawer title="Ajuste de inventario" onClose={() => setAjuDrawer(false)} onSave={handleAjuste} saving={ajuSaving} saveLabel="Registrar">
            <div className="field">
              <label>Tipo de ajuste</label>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                {[{ v: '+', label: '+ Entrada' }, { v: '-', label: '− Salida' }].map(({ v, label }) => (
                  <button key={v} onClick={() => setAju('tipo', v)}
                    className={`btn btn-sm ${ajuForm.tipo === v ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1 }}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Cantidad *</label>
              <input type="number" min="1" step="1" value={ajuForm.cantidad} onChange={e => setAju('cantidad', e.target.value)} placeholder="1" autoFocus />
            </div>
            <div className="field">
              <label>Motivo</label>
              <select value={ajuForm.motivo} onChange={e => setAju('motivo', e.target.value)}>
                {MOTIVOS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={ajuForm.notas} onChange={e => setAju('notas', e.target.value)} placeholder="Descripción opcional del ajuste" />
            </div>
          </Drawer>
        )}

        {/* Drawer editar */}
        {editDrawer && (
          <Drawer title="Editar producto" onClose={() => setEditDrawer(false)} onSave={handleEditSave} saving={editSaving}>
            <div className="field">
              <label>Nombre *</label>
              <input value={editForm.nombre} onChange={e => setEdi('nombre', e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea rows={2} value={editForm.descripcion} onChange={e => setEdi('descripcion', e.target.value)} placeholder="Descripción opcional" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="field">
                <label>Precio de venta *</label>
                <input type="number" min="0" step="0.01" value={editForm.precio_venta} onChange={e => setEdi('precio_venta', e.target.value)} />
              </div>
              <div className="field">
                <label>Precio de costo</label>
                <input type="number" min="0" step="0.01" value={editForm.precio_costo} onChange={e => setEdi('precio_costo', e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="field">
              <label>Categoría</label>
              <select value={editForm.categoria_id} onChange={e => setEdi('categoria_id', e.target.value)}>
                <option value="">Sin categoría</option>
                {(categorias ?? []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>URL de compra original</label>
              <input value={editForm.url_compra_original} onChange={e => setEdi('url_compra_original', e.target.value)} placeholder="https://…" />
            </div>
            <div className="field">
              <label>Notas internas</label>
              <textarea rows={2} value={editForm.notas} onChange={e => setEdi('notas', e.target.value)} />
            </div>
          </Drawer>
        )}

        {confirm && (
          <ConfirmModal
            title="Eliminar producto"
            message="¿Seguro? No podrás eliminar un producto con ventas o pedidos asociados."
            onConfirm={handleDelete}
            onCancel={() => setConfirm(false)}
          />
        )}
        {errModal && <ErrorModal title={errModal.title} body={errModal.body} onClose={() => setErrModal(null)} />}
      </div>
    </>
  )
}

