import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, ArrowRight, Pencil, Trash2, Plus, LayoutGrid, List as ListIcon, AlertTriangle, PackageX } from 'lucide-react'
import { useQuery } from '../../lib/useQuery.js'
import { useToast } from '../../lib/toast.jsx'
import { fmt } from '../../lib/formatters.js'
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

const EMPTY = { nombre: '', descripcion: '', precio_venta: '', precio_costo: '', categoria_id: '', url_compra_original: '', notas: '' }
const SI_EMPTY = { activo: false, cantidad: '', notas: '' }

const selectStyle = {
  height: '2.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', padding: '0 .75rem',
  fontSize: '.875rem', flexShrink: 0,
}

function PriceCol({ label, value, color = 'var(--text)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
      <span style={{ fontSize: '.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: '.88rem', color }}>{value}</span>
    </div>
  )
}

function StockBadge({ stock }) {
  const n = Number(stock ?? 0)
  const color = n <= 0 ? '#ef4444' : n <= 2 ? '#f59e0b' : '#10b981'
  const label = n <= 0 ? 'Agotado' : `${n} uds`
  const icon  = n <= 0 ? <PackageX size={12} /> : n <= 2 ? <AlertTriangle size={12} /> : null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', padding: '.2rem .6rem', borderRadius: '999px', fontSize: '.8rem', fontWeight: 700, background: color + '33', color, flexShrink: 0 }}>
      {icon}
      {label}
    </span>
  )
}

export default function ProductosList() {
  const navigate  = useNavigate()
  const crumbs    = useBreadcrumbs()
  const { isAdmin } = useAuth()
  const toast     = useToast()

  const { data, loading, error, refetch } = useQuery(() => q.getProductos(), [])
  const { data: categorias }              = useQuery(() => q.getCategorias(), [])

  const [search,      setSearch]      = useState('')
  const [catFiltro,   setCatFiltro]   = useState('')
  const [stockFiltro, setStockFiltro] = useState('')
  const [viewMode,    setViewMode]    = useState('cards')
  const [drawer,    setDrawer]    = useState(null)
  const [form,      setForm]      = useState(EMPTY)
  const [si,        setSiState]   = useState(SI_EMPTY)   // stock inicial
  const [saving,    setSaving]    = useState(false)
  const [confirm,   setConfirm]   = useState(null)
  const [errModal,  setErrModal]  = useState(null)

  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setSi = (k, v) => setSiState(s => ({ ...s, [k]: v }))
  const done = msg  => { refetch(); setDrawer(null); if (msg) toast(msg) }

  function openCreate() { setForm(EMPTY); setSiState(SI_EMPTY); setDrawer({ mode: 'create' }) }
  function openEdit(p, e) {
    e.stopPropagation()
    setSiState(SI_EMPTY)
    setForm({
      nombre:              p.nombre,
      descripcion:         p.descripcion          ?? '',
      precio_venta:        p.precio_venta          ?? '',
      precio_costo:        p.precio_costo          ?? '',
      categoria_id:        p.categoria_id          ?? '',
      url_compra_original: p.url_compra_original   ?? '',
      notas:               p.notas                 ?? '',
    })
    setDrawer({ mode: 'edit', record: p })
  }

  async function handleSave() {
    if (!form.nombre.trim()) { showErr('El nombre del producto es obligatorio.'); return }
    const precio_venta = parseFloat(form.precio_venta)
    if (isNaN(precio_venta) || precio_venta < 0) { showErr('El precio de venta debe ser un número válido.'); return }
    if (drawer.mode === 'create' && si.activo) {
      const cant = parseInt(si.cantidad)
      if (!si.cantidad || isNaN(cant) || cant <= 0) { showErr('La cantidad de stock inicial debe ser un número mayor a 0.'); return }
    }
    setSaving(true)
    try {
      const payload = {
        nombre:              form.nombre.trim(),
        descripcion:         form.descripcion.trim()         || null,
        precio_venta,
        precio_costo:        form.precio_costo !== '' ? parseFloat(form.precio_costo) : null,
        categoria_id:        form.categoria_id               || null,
        url_compra_original: form.url_compra_original.trim() || null,
        notas:               form.notas.trim()               || null,
      }
      if (drawer.mode === 'create') {
        const nuevo = await q.insertProducto(payload)
        if (si.activo) {
          await q.insertAjusteStock({
            producto_id: nuevo.id,
            cantidad:    parseInt(si.cantidad),
            motivo:      'correccion',
            notas:       si.notas.trim() || 'Stock inicial',
          })
        }
        done(si.activo ? 'Producto registrado con stock inicial' : 'Producto registrado')
      } else {
        await q.updateProducto(drawer.record.id, payload)
        done('Producto actualizado')
      }
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await q.deleteProducto(confirm)
      toast('Producto eliminado')
      setConfirm(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  const list = useMemo(() => {
    return (data ?? []).filter(p => {
      if (catFiltro && p.categoria_id !== catFiltro) return false
      if (stockFiltro === 'ok')      { if (p.stock_actual <= 2)               return false }
      if (stockFiltro === 'bajo')    { if (p.stock_actual > 2 || p.stock_actual <= 0) return false }
      if (stockFiltro === 'agotado') { if (p.stock_actual > 0)                return false }
      if (!search.trim()) return true
      const s = search.toLowerCase()
      return p.nombre.toLowerCase().includes(s) || (p.descripcion ?? '').toLowerCase().includes(s)
    })
  }, [data, search, catFiltro, stockFiltro])

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando productos…" /></>
  if (error)   return <ErrorMsg message={error} />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><Package size={22} /> Productos</h1>
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <button className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('cards')} title="Vista tarjetas"><LayoutGrid size={14} /></button>
            <button className={`btn btn-sm ${viewMode === 'list'  ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('list')}  title="Vista lista"><ListIcon size={14} /></button>
            {isAdmin && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> Nuevo producto</button>}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="deuda-search"
            style={{ flex: '1 1 220px', minWidth: 0 }}
            placeholder="Buscar por nombre…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={selectStyle}>
            <option value="">Todas las categorías</option>
            {(categorias ?? []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={stockFiltro} onChange={e => setStockFiltro(e.target.value)} style={selectStyle}>
            <option value="">Todo el stock</option>
            <option value="ok">Stock OK (&gt;2)</option>
            <option value="bajo">Stock bajo (1–2)</option>
            <option value="agotado">Agotado (0)</option>
          </select>
        </div>

        {search.trim() && (
          <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            {list.length} {list.length === 1 ? 'resultado' : 'resultados'}
          </p>
        )}

        <div key={viewMode + '|' + catFiltro + '|' + stockFiltro} style={{ animation: 'fadeIn .2s ease' }}>
        {/* Vista cards */}
        {viewMode === 'cards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {list.map(p => (
              <div
                key={p.id}
                className="card"
                onClick={() => navigate(`/productos/${p.id}`)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '.5rem', animation: 'fadeIn .18s ease' }}
              >
                {/* Header: categoría + stock */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.4rem', minHeight: '1.5rem' }}>
                  {p.categoria_nombre
                    ? <GrupoBadge grupo={{ nombre: p.categoria_nombre, color: p.categoria_color }} />
                    : <span />}
                  <StockBadge stock={p.stock_actual} />
                </div>

                {/* Nombre */}
                <div style={{ fontWeight: 700, fontSize: '.95rem', lineHeight: 1.35 }}>{p.nombre}</div>

                {/* Precios */}
                {(() => {
                  const hasCosto = p.precio_costo != null
                  const margen   = hasCosto && p.precio_venta > 0
                    ? Math.round(((p.precio_venta - p.precio_costo) / p.precio_venta) * 100)
                    : null
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: hasCosto ? '1fr 1fr 1fr' : '1fr', gap: '.25rem', borderTop: '1px solid var(--border)', paddingTop: '.55rem', marginTop: '.1rem' }}>
                      <PriceCol label="Precio venta" value={fmt(p.precio_venta)} />
                      {hasCosto && <PriceCol label="Costo" value={fmt(p.precio_costo)} />}
                      {hasCosto && (
                        margen != null
                          ? <PriceCol label="Margen" value={`${margen}%`} color={margen >= 0 ? 'var(--liquidado)' : 'var(--deuda)'} />
                          : <PriceCol label="Margen" value="—" />
                      )}
                    </div>
                  )
                })()}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center', marginTop: '.1rem' }}>
                  {isAdmin && (
                    <>
                      <button className="btn btn-icon" onClick={e => openEdit(p, e)} title="Editar"><Pencil size={13} /></button>
                      <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); setConfirm(p.id) }} title="Eliminar"><Trash2 size={13} /></button>
                    </>
                  )}
                  <div style={{ flex: 1 }} />
                  <ArrowRight size={15} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
            {list.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Package size={36} style={{ opacity: .25, marginBottom: '.5rem' }} />
                <p>Sin productos{search || catFiltro || stockFiltro ? ' con esos filtros' : ' todavía'}.</p>
              </div>
            )}
          </div>
        )}

        {/* Vista lista */}
        {viewMode === 'list' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {list.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin productos.</div>
            ) : list.map((p, i) => (
              <div
                key={p.id}
                onClick={() => navigate(`/productos/${p.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1rem', borderBottom: i < list.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              >
                <Package size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{p.nombre}</span>
                {p.categoria_nombre && <GrupoBadge grupo={{ nombre: p.categoria_nombre, color: p.categoria_color }} />}
                <StockBadge stock={p.stock_actual} />
                <span style={{ fontSize: '.85rem', fontWeight: 600, minWidth: '60px', textAlign: 'right' }}>{fmt(p.precio_venta)}</span>
                {isAdmin && (
                  <>
                    <button className="btn btn-icon" onClick={e => openEdit(p, e)} title="Editar"><Pencil size={13} /></button>
                    <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); setConfirm(p.id) }} title="Eliminar"><Trash2 size={13} /></button>
                  </>
                )}
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Drawer crear/editar */}
        {drawer && (
          <Drawer
            title={drawer.mode === 'create' ? 'Nuevo producto' : 'Editar producto'}
            onClose={() => setDrawer(null)}
            onSave={handleSave}
            saving={saving}
          >
            <div className="field">
              <label>Nombre *</label>
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del producto" autoFocus />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea rows={2} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción opcional" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="field">
                <label>Precio de venta *</label>
                <input type="number" min="0" step="0.01" value={form.precio_venta} onChange={e => set('precio_venta', e.target.value)} placeholder="0.00" />
              </div>
              <div className="field">
                <label>Precio de costo</label>
                <input type="number" min="0" step="0.01" value={form.precio_costo} onChange={e => set('precio_costo', e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="field">
              <label>Categoría</label>
              <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
                <option value="">Sin categoría</option>
                {(categorias ?? []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="field">
              <label>URL de compra original</label>
              <input value={form.url_compra_original} onChange={e => set('url_compra_original', e.target.value)} placeholder="https://…" />
            </div>
            <div className="field">
              <label>Notas internas</label>
              <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Notas visibles solo para ti" />
            </div>

            {/* Stock inicial — solo al crear */}
            {drawer.mode === 'create' && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '.75rem', marginTop: '.1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.55rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={si.activo}
                    onChange={e => setSi('activo', e.target.checked)}
                    style={{ width: 'auto', accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '.875rem' }}>Añadir stock inicial</span>
                </label>
                {si.activo && (
                  <div style={{ marginTop: '.65rem', display: 'flex', flexDirection: 'column', gap: '.6rem', padding: '.75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius)' }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label>Cantidad *</label>
                      <input
                        type="number" min="1" step="1"
                        value={si.cantidad}
                        onChange={e => setSi('cantidad', e.target.value)}
                        placeholder="ej. 10"
                        autoFocus
                      />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label>Notas del ajuste</label>
                      <input
                        value={si.notas}
                        onChange={e => setSi('notas', e.target.value)}
                        placeholder="Stock inicial (por defecto)"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </Drawer>
        )}

        {confirm && (
          <ConfirmModal
            title="Eliminar producto"
            message="¿Seguro? No podrás eliminar un producto que tenga ventas o pedidos registrados."
            onConfirm={handleDelete}
            onCancel={() => setConfirm(null)}
          />
        )}
        {errModal && <ErrorModal title={errModal.title} body={errModal.body} onClose={() => setErrModal(null)} />}
      </div>
    </>
  )
}

