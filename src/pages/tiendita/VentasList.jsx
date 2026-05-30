import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  ShoppingBag, Plus, Pencil, Trash2, ChevronDown, Package,
  CheckCircle, Clock, AlertTriangle, Wallet, X, Search,
} from 'lucide-react'
import { useQuery }         from '../../lib/useQuery.js'
import { useToast }         from '../../lib/toast.jsx'
import { fmt, fmtDate, today } from '../../lib/formatters.js'
import * as q               from '../../lib/tiendita-queries.js'
import { buscarParticipantes } from '../../lib/rifas-queries.js'
import Breadcrumbs          from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../../lib/useBreadcrumbs.js'
import { useAuth }        from '../../lib/AuthContext.jsx'
import LoadingSpinner, { ErrorMsg } from '../../components/LoadingSpinner.jsx'
import Drawer             from '../../components/Drawer.jsx'
import ConfirmModal       from '../../components/ConfirmModal.jsx'
import ErrorModal         from '../../components/ErrorModal.jsx'
import Pagination         from '../../components/Pagination.jsx'
import { TipoBadge, EntregaBadge } from '../../components/VentaBadges.jsx'
import { usePaginatedQuery } from '../../lib/usePaginatedQuery.js'
import { parseError }     from '../../lib/parseError.js'

// ── Constantes ───────────────────────────────────────────────────────────────
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Otro']

const EMPTY_HEADER = {
  participante_id: '', nombre_cliente: '', tipo: 'directa',
  fecha_venta: today(), metodo_pago: 'Efectivo', anticipo_pagado: '', notas: '',
}
const EMPTY_ITEM = { producto_id: '', cantidad: 1, precio_unitario_acordado: 0 }

const selectStyle = {
  height: '2.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', padding: '0 .75rem', fontSize: '.875rem',
}

// ── ClienteSearch: buscador con autocomplete ────────────────────────────────
function ClienteSearch({ displayName, participanteId, onChange }) {
  const [query,   setQuery]   = useState(displayName ?? '')
  const [results, setResults] = useState([])
  const [open,    setOpen]    = useState(false)
  const timerRef = useRef(null)
  const wrapRef  = useRef(null)

  useEffect(() => { setQuery(displayName ?? '') }, [displayName])

  useEffect(() => {
    function onOut(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  const doSearch = useCallback(async (q) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return }
    try {
      const r = await buscarParticipantes(q)
      setResults(r ?? [])
      setOpen((r ?? []).length > 0)
    } catch (e) { console.error(e) }
  }, [])

  function handleChange(e) {
    const q = e.target.value
    setQuery(q)
    onChange({ participante_id: '', nombre_cliente: q })
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(q), 300)
  }

  function handleSelect(r) {
    setQuery(r.nombre_completo)
    setResults([]); setOpen(false)
    onChange({ participante_id: r.id, nombre_cliente: r.nombre_completo })
  }

  function handleClear() {
    setQuery(''); setResults([]); setOpen(false)
    onChange({ participante_id: '', nombre_cliente: '' })
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: '.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={handleChange}
          placeholder="Buscar cliente o escribir nombre…"
          autoComplete="off"
          style={{ paddingLeft: '1.75rem', paddingRight: query ? '1.75rem' : undefined }}
        />
        {query && (
          <button type="button" onClick={handleClear} style={{ position: 'absolute', right: '.45rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>
      {participanteId && (
        <div style={{ fontSize: '.75rem', color: 'var(--accent)', marginTop: '.2rem', display: 'flex', alignItems: 'center', gap: '.25rem' }}>
          <CheckCircle size={11} /> Cliente registrado vinculado
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 16px rgba(0,0,0,.25)', zIndex: 400, overflow: 'hidden', marginTop: '.2rem', maxHeight: '180px', overflowY: 'auto' }}>
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelect(r)}
              style={{ display: 'flex', flexDirection: 'column', gap: '.1rem', width: '100%', padding: '.5rem .75rem', textAlign: 'left', background: 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-muted)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              <span style={{ fontWeight: 600, fontSize: '.88rem' }}>{r.nombre_completo}</span>
              {r.telefono_whatsapp && <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{r.telefono_whatsapp}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Badges — importados desde components/VentaBadges.jsx ──────────────────

// ── Item row del carrito ─────────────────────────────────────────────────────
function ItemRow({ item, idx, productos, onChange, onRemove }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px auto', gap: '.4rem', alignItems: 'center', marginBottom: '.4rem' }}>
      <select
        value={item.producto_id}
        onChange={e => {
          const prod = (productos ?? []).find(p => p.id === e.target.value)
          onChange(idx, { producto_id: e.target.value, precio_unitario_acordado: prod?.precio_venta ?? 0 })
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
        type="number" min="0" step="0.01" value={item.precio_unitario_acordado}
        onChange={e => onChange(idx, 'precio_unitario_acordado', e.target.value)}
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
export default function VentasList() {
  const crumbs      = useBreadcrumbs()
  const { isAdmin } = useAuth()
  const toast       = useToast()

  const { data: productos } = useQuery(() => q.getProductos(), [])
  const { data: clientes }  = useQuery(() => q.getClientes(), [])

  // Filtros
  const [tipoFiltro,    setTipoFiltro]    = useState('')
  const [entregaFiltro, setEntregaFiltro] = useState('')
  const [search,        setSearch]        = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fechaDesde,    setFechaDesde]    = useState('')
  const [fechaHasta,    setFechaHasta]    = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [search])

  function handleTipoChange(v)    { setTipoFiltro(v);    setPage(0) }
  function handleEntregaChange(v) { setEntregaFiltro(v); setPage(0) }
  function handleFechaDesde(v)    { setFechaDesde(v);    setPage(0) }
  function handleFechaHasta(v)    { setFechaHasta(v);    setPage(0) }

  const { data, count, loading, error, refetch } = usePaginatedQuery(
    () => q.getVentasPaginado({ tipoFiltro, entregaFiltro, search: debouncedSearch, fechaDesde, fechaHasta, page, pageSize: PAGE_SIZE }),
    [tipoFiltro, entregaFiltro, debouncedSearch, fechaDesde, fechaHasta, page],
  )

  // Expand lazy-load
  const [expanded,     setExpanded]     = useState(null)
  const [expandedData, setExpandedData] = useState({})  // { [id]: { items, abonos, loading } }

  // Drawer venta
  const [drawer,             setDrawer]             = useState(null)
  const [headerForm,         setHeaderForm]         = useState(EMPTY_HEADER)
  const [items,              setItems]              = useState([{ ...EMPTY_ITEM }])
  const [saving,             setSaving]             = useState(false)
  const [drawerItemsLoading, setDrawerItemsLoading] = useState(false)

  // Drawer abono
  const [abonoVenta,  setAbonoVenta]  = useState(null)
  const [abonoForm,   setAbonoForm]   = useState({ monto: '', fecha: today(), metodo_pago: 'Efectivo', notas: '' })
  const [abonoSaving, setAbonoSaving] = useState(false)

  // Modales
  const [entregarConfirm, setEntregarConfirm] = useState(null)
  const [confirm,         setConfirm]         = useState(null)
  const [errModal,        setErrModal]        = useState(null)

  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const setH    = (k, v) => setHeaderForm(f => ({ ...f, [k]: v }))
  const setAbo  = (k, v) => setAbonoForm(f => ({ ...f, [k]: v }))

  // ── item helpers ──
  function addItem()  { setItems(its => [...its, { ...EMPTY_ITEM }]) }
  function removeItem(i) { setItems(its => its.filter((_, idx) => idx !== i)) }
  function changeItem(i, kOrObj, v) {
    setItems(its => its.map((it, idx) =>
      idx === i ? { ...it, ...(typeof kOrObj === 'object' ? kOrObj : { [kOrObj]: v }) } : it
    ))
  }

  // ── resumen carrito en tiempo real ──
  const resumen = useMemo(() => {
    const total    = items.reduce((s, i) => s + (parseInt(i.cantidad) || 0) * (parseFloat(i.precio_unitario_acordado) || 0), 0)
    const anticipo = headerForm.tipo === 'directa' ? total : (parseFloat(headerForm.anticipo_pagado) || 0)
    return { total, anticipo, saldo: total - anticipo }
  }, [items, headerForm.tipo, headerForm.anticipo_pagado])

  // ── expand con carga perezosa ──
  async function toggleExpand(ventaId) {
    if (expanded === ventaId) { setExpanded(null); return }
    setExpanded(ventaId)
    if (expandedData[ventaId]) return
    setExpandedData(d => ({ ...d, [ventaId]: { items: [], abonos: [], loading: true } }))
    try {
      const venta = (data ?? []).find(v => v.id === ventaId)
      const [ventaItems, abonos] = await Promise.all([
        q.getItemsDeVenta(ventaId),
        venta?.tipo === 'apartado' ? q.getAbonosDeVenta(ventaId) : Promise.resolve([]),
      ])
      setExpandedData(d => ({ ...d, [ventaId]: { items: ventaItems, abonos, loading: false } }))
    } catch {
      setExpandedData(d => ({ ...d, [ventaId]: { items: [], abonos: [], loading: false } }))
    }
  }

  // ── abrir crear ──
  function openCreate() {
    setHeaderForm({ ...EMPTY_HEADER, fecha_venta: today() })
    setItems([{ ...EMPTY_ITEM }])
    setDrawer({ mode: 'create' })
  }

  // ── abrir editar (fetch items frescos) ──
  async function openEdit(venta, e) {
    e.stopPropagation()
    setHeaderForm({
      participante_id: venta.participante_id ?? '',
      nombre_cliente:  venta.nombre_cliente  ?? '',
      tipo:            venta.tipo,
      fecha_venta:     venta.fecha_venta,
      metodo_pago:     venta.metodo_pago,
      anticipo_pagado: venta.anticipo_pagado ?? '',
      notas:           venta.notas           ?? '',
    })
    setItems([{ ...EMPTY_ITEM }])
    setDrawer({ mode: 'edit', record: venta })
    setDrawerItemsLoading(true)
    try {
      const existing = await q.getItemsDeVenta(venta.id)
      setItems(existing.length ? existing.map(i => ({
        producto_id:              i.producto_id,
        cantidad:                 i.cantidad,
        precio_unitario_acordado: i.precio_unitario_acordado,
      })) : [{ ...EMPTY_ITEM }])
    } catch { /* mantener vacío */ }
    finally { setDrawerItemsLoading(false) }
  }

  // ── guardar venta ──
  async function handleSave() {
    const itemsValidos = items.filter(i => i.producto_id)
    if (!itemsValidos.length) { showErr('Agrega al menos un producto a la venta.'); return }
    if (itemsValidos.some(i => !(parseInt(i.cantidad) > 0))) { showErr('Todos los productos deben tener cantidad mayor a 0.'); return }

    const itemsPayload = itemsValidos.map(i => ({
      producto_id:              i.producto_id,
      cantidad:                 parseInt(i.cantidad),
      precio_unitario_acordado: parseFloat(i.precio_unitario_acordado) || 0,
    }))
    const ventaPayload = {
      participante_id: headerForm.participante_id || null,
      nombre_cliente:  headerForm.nombre_cliente.trim() || null,
      tipo:            headerForm.tipo,
      precio_total:    resumen.total,
      anticipo_pagado: resumen.anticipo,
      metodo_pago:     headerForm.metodo_pago,
      estado_entrega:  drawer.mode === 'edit' ? drawer.record.estado_entrega : 'pendiente',
      notas:           headerForm.notas.trim() || null,
      fecha_venta:     headerForm.fecha_venta || today(),
    }

    setSaving(true)
    try {
      if (drawer.mode === 'create') {
        await q.insertVenta(ventaPayload, itemsPayload)
        toast('Venta registrada')
      } else {
        await q.updateVentaConItems(drawer.record.id, ventaPayload, itemsPayload)
        toast('Venta actualizada')
        setExpandedData(d => { const n = { ...d }; delete n[drawer.record.id]; return n })
      }
      setDrawer(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── abonar ──
  async function handleAbonoSave() {
    const monto = parseFloat(abonoForm.monto)
    if (!monto || monto <= 0) { showErr('El monto debe ser mayor a 0.'); return }
    setAbonoSaving(true)
    try {
      const ventaId = abonoVenta.id
      const newAbono = await q.insertAbono({
        venta_id:    ventaId,
        monto,
        fecha:       abonoForm.fecha,
        metodo_pago: abonoForm.metodo_pago,
        notas:       abonoForm.notas.trim() || null,
      })
      toast('Abono registrado')
      // Inyectar el nuevo abono directo en el cache sin borrar los anteriores
      setExpandedData(d => d[ventaId]
        ? { ...d, [ventaId]: { ...d[ventaId], abonos: [newAbono, ...(d[ventaId].abonos ?? [])] } }
        : d
      )
      setAbonoVenta(null)
      setAbonoForm({ monto: '', fecha: today(), metodo_pago: 'Efectivo', notas: '' })
      refetch()  // actualiza saldo_pendiente en la cabecera
    } catch (e) { showErr(e) }
    finally { setAbonoSaving(false) }
  }

  // ── marcar entregado ──
  async function handleEntregar() {
    setSaving(true)
    try {
      await q.updateVenta(entregarConfirm.id, { estado_entrega: 'entregado' })
      toast('Venta marcada como entregada')
      setEntregarConfirm(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── eliminar ──
  async function handleDelete() {
    setSaving(true)
    try {
      await q.deleteVenta(confirm)
      toast('Venta eliminada')
      setConfirm(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // ── lista filtrada ──
  // data ya viene filtrado del servidor
  const list = data

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando ventas…" /></>
  if (error)   return <ErrorMsg message={error} />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">

        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><ShoppingBag size={22} /> Ventas</h1>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={tipoFiltro}    onChange={e => handleTipoChange(e.target.value)}    style={selectStyle}>
              <option value="">Todos los tipos</option>
              <option value="directa">Directas</option>
              <option value="apartado">Apartados</option>
            </select>
            <select value={entregaFiltro} onChange={e => handleEntregaChange(e.target.value)} style={selectStyle}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente de entrega</option>
              <option value="entregado">Entregado</option>
            </select>
            {isAdmin && (
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={15} /> Nueva venta
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="deuda-search"
            style={{ flex: '1 1 200px', minWidth: '160px' }}
            placeholder="Buscar por cliente…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.83rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Desde
            <input
              type="date"
              value={fechaDesde}
              onChange={e => handleFechaDesde(e.target.value)}
              style={{ ...selectStyle, padding: '0 .5rem' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.35rem', fontSize: '.83rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Hasta
            <input
              type="date"
              value={fechaHasta}
              onChange={e => handleFechaHasta(e.target.value)}
              style={{ ...selectStyle, padding: '0 .5rem' }}
            />
          </label>
          {(fechaDesde || fechaHasta) && (
            <button
              type="button"
              onClick={() => { handleFechaDesde(''); handleFechaHasta('') }}
              style={{ height: '2.2rem', padding: '0 .6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '.25rem' }}
            >
              <X size={13} /> Fechas
            </button>
          )}
        </div>

        {/* Lista */}
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <ShoppingBag size={36} style={{ opacity: .25, marginBottom: '.5rem' }} />
            <p>Sin ventas{tipoFiltro || entregaFiltro || search || fechaDesde || fechaHasta ? ' con esos filtros' : ' todavía'}.</p>
            {isAdmin && !tipoFiltro && !entregaFiltro && !search && !fechaDesde && !fechaHasta && (
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={openCreate}>
                <Plus size={15} /> Registrar primera venta
              </button>
            )}
          </div>
        ) : (
          <div key={tipoFiltro + '|' + entregaFiltro} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', animation: 'fadeIn .2s ease' }}>
            {list.map(venta => {
              const isExpanded = expanded === venta.id
              const exp  = expandedData[venta.id]
              const saldo = Number(venta.saldo_pendiente ?? 0)
              return (
                <div key={venta.id} className="card" style={{ overflow: 'hidden', animation: 'fadeIn .18s ease' }}>

                  {/* Cabecera */}
                  <div style={{ padding: '.9rem 1rem', display: 'flex', gap: '.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.25rem' }}>
                        <TipoBadge tipo={venta.tipo} />
                        <span style={{ fontWeight: 700, fontSize: '.95rem' }}>
                          {venta.nombre_cliente || 'Sin nombre'}
                        </span>
                        <EntregaBadge estado={venta.estado_entrega} />
                      </div>
                      <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                        <span>{fmtDate(venta.fecha_venta)}</span>
                        <span>{venta.metodo_pago}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem' }}>{fmt(venta.precio_total)}</div>
                      {venta.tipo === 'apartado' && (
                        <div style={{ fontSize: '.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '.2rem', color: saldo > 0 ? '#f59e0b' : '#10b981' }}>
                          {saldo > 0 ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
                          Saldo: {fmt(saldo)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Barra de acciones */}
                  <div style={{ padding: '.5rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '.4rem', flexWrap: 'wrap', background: 'var(--bg-muted)' }}>
                    <button
                      onClick={() => toggleExpand(venta.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.3rem', color: 'var(--text-muted)', fontSize: '.8rem', padding: '.2rem .1rem' }}
                    >
                      <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                      {exp?.loading ? 'Cargando…' : 'Productos'}
                    </button>
                    <div style={{ flex: 1 }} />
                    {isAdmin && venta.tipo === 'apartado' && saldo > 0 && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf640', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                        onClick={() => { setAbonoVenta(venta); setAbonoForm({ monto: '', fecha: today(), metodo_pago: 'Efectivo', notas: '' }) }}
                      >
                        <Wallet size={13} /> Abonar
                      </button>
                    )}
                    {isAdmin && venta.estado_entrega === 'pendiente' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#10b98120', color: '#10b981', border: '1px solid #10b98140', display: 'inline-flex', alignItems: 'center', gap: '.3rem' }}
                        onClick={() => setEntregarConfirm(venta)}
                      >
                        <CheckCircle size={13} /> Entregar
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button className="btn btn-icon" onClick={e => openEdit(venta, e)} title="Editar"><Pencil size={13} /></button>
                        <button className="btn btn-icon btn-danger-icon" onClick={() => setConfirm(venta.id)} title="Eliminar"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>

                  {/* Vista expandida */}
                  <div className={`chart-collapse${isExpanded ? ' open' : ''}`}>
                    <div className="chart-collapse-inner">
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {exp?.loading ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>Cargando…</div>
                      ) : (
                        <>
                          {/* Items */}
                          {(exp?.items ?? []).length === 0 ? (
                            <div style={{ padding: '.75rem 1rem', fontSize: '.82rem', color: 'var(--text-muted)' }}>Sin productos registrados.</div>
                          ) : (exp?.items ?? []).map((item, i) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.5rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '.85rem' }}>
                              <Package size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                              <span style={{ flex: 1, fontWeight: 500 }}>{item.productos?.nombre ?? 'Producto eliminado'}</span>
                              <span style={{ color: 'var(--text-muted)' }}>×{item.cantidad}</span>
                              <span style={{ fontWeight: 600 }}>{fmt(item.precio_unitario_acordado)}/u</span>
                              <span style={{ fontWeight: 700, minWidth: '70px', textAlign: 'right' }}>{fmt(item.precio_unitario_acordado * item.cantidad)}</span>
                            </div>
                          ))}

                          {/* Abonos (solo apartados) */}
                          {venta.tipo === 'apartado' && (
                            <div style={{ padding: '.6rem 1rem', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)' }}>
                              <div style={{ fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: '.4rem' }}>
                                Historial de pagos
                              </div>
                              {Number(venta.anticipo_pagado) > 0 && (
                                <div style={{ display: 'flex', gap: '.5rem', fontSize: '.82rem', padding: '.25rem 0' }}>
                                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>Anticipo · {fmtDate(venta.fecha_venta)}</span>
                                  <span style={{ fontWeight: 700, color: '#10b981' }}>+{fmt(venta.anticipo_pagado)}</span>
                                </div>
                              )}
                              {(exp?.abonos ?? []).map(a => (
                                <div key={a.id} style={{ display: 'flex', gap: '.5rem', fontSize: '.82rem', padding: '.25rem 0', borderTop: '1px solid var(--border)' }}>
                                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{a.metodo_pago} · {fmtDate(a.fecha)}{a.notas ? ` · ${a.notas}` : ''}</span>
                                  <span style={{ fontWeight: 700, color: '#10b981' }}>+{fmt(a.monto)}</span>
                                </div>
                              ))}
                              {!(exp?.abonos ?? []).length && !Number(venta.anticipo_pagado) && (
                                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>Sin pagos registrados aún.</div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '.35rem', marginTop: '.2rem', fontSize: '.82rem', fontWeight: 700 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Saldo pendiente</span>
                                <span style={{ color: saldo > 0 ? '#f59e0b' : '#10b981' }}>{fmt(saldo)}</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Drawer crear / editar venta */}
        {drawer && (
          <Drawer
            title={drawer.mode === 'create' ? 'Nueva venta' : 'Editar venta'}
            onClose={() => setDrawer(null)}
            onSave={handleSave}
            saving={saving}
          >
            {/* Cliente */}
            <div className="field">
              <label>Cliente</label>
              <ClienteSearch
                displayName={headerForm.nombre_cliente}
                participanteId={headerForm.participante_id}
                onChange={({ participante_id, nombre_cliente }) =>
                  setHeaderForm(f => ({ ...f, participante_id, nombre_cliente }))
                }
              />
            </div>

            {/* Tipo + Fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="field">
                <label>Tipo de venta</label>
                <select value={headerForm.tipo} onChange={e => setH('tipo', e.target.value)}>
                  <option value="directa">Directa (pago completo)</option>
                  <option value="apartado">Apartado (con anticipo)</option>
                </select>
              </div>
              <div className="field">
                <label>Fecha</label>
                <input type="date" value={headerForm.fecha_venta} onChange={e => setH('fecha_venta', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: headerForm.tipo === 'apartado' ? '1fr 1fr' : '1fr', gap: '.75rem' }}>
              <div className="field">
                <label>Método de pago</label>
                <select value={headerForm.metodo_pago} onChange={e => setH('metodo_pago', e.target.value)}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {headerForm.tipo === 'apartado' && (
                <div className="field">
                  <label>Anticipo pagado</label>
                  <input type="number" min="0" step="0.01" value={headerForm.anticipo_pagado} onChange={e => setH('anticipo_pagado', e.target.value)} placeholder="0.00" />
                </div>
              )}
            </div>

            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={headerForm.notas} onChange={e => setH('notas', e.target.value)} placeholder="Comentarios opcionales" maxLength={300} />
            </div>

            {/* Carrito de productos */}
            {drawerItemsLoading ? (
              <div style={{ padding: '.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>Cargando productos…</div>
            ) : (
              <div style={{ marginTop: '.5rem' }}>
                <div style={{ fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: '.5rem' }}>
                  Productos
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px auto', gap: '.4rem', marginBottom: '.3rem' }}>
                  <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', paddingLeft: '.2rem' }}>Producto</span>
                  <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>Cant.</span>
                  <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>Precio/u</span>
                  <span />
                </div>
                {items.map((item, i) => (
                  <ItemRow key={i} idx={i} item={item} productos={productos} onChange={changeItem} onRemove={removeItem} />
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={addItem} style={{ marginTop: '.25rem', width: '100%' }}>
                  <Plus size={13} /> Agregar producto
                </button>

                {/* Resumen */}
                {resumen.total > 0 && (
                  <div style={{ marginTop: '.75rem', padding: '.6rem .75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total</span>
                      <strong style={{ color: 'var(--text)' }}>{fmt(resumen.total)}</strong>
                    </div>
                    {headerForm.tipo === 'apartado' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Anticipo</span>
                          <strong style={{ color: 'var(--text)' }}>{fmt(resumen.anticipo)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '.25rem', marginTop: '.1rem' }}>
                          <span>Saldo pendiente</span>
                          <strong style={{ color: resumen.saldo > 0 ? '#f59e0b' : '#10b981', fontSize: '.9rem' }}>{fmt(resumen.saldo)}</strong>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </Drawer>
        )}

        {/* Drawer abono */}
        {abonoVenta && (
          <Drawer
            title={`Abonar — ${abonoVenta.nombre_cliente || 'apartado'}`}
            onClose={() => setAbonoVenta(null)}
            onSave={handleAbonoSave}
            saving={abonoSaving}
            saveLabel="Registrar abono"
          >
            <div style={{ padding: '.5rem .75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius)', fontSize: '.82rem', marginBottom: '.25rem' }}>
              Saldo actual: <strong style={{ color: '#f59e0b' }}>{fmt(abonoVenta.saldo_pendiente)}</strong>
            </div>
            <div className="field">
              <label>Monto *</label>
              <input type="number" min="0.01" step="0.01" value={abonoForm.monto} onChange={e => setAbo('monto', e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
              <div className="field">
                <label>Fecha</label>
                <input type="date" value={abonoForm.fecha} onChange={e => setAbo('fecha', e.target.value)} />
              </div>
              <div className="field">
                <label>Método de pago</label>
                <select value={abonoForm.metodo_pago} onChange={e => setAbo('metodo_pago', e.target.value)}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={abonoForm.notas} onChange={e => setAbo('notas', e.target.value)} placeholder="Notas opcionales" maxLength={300} />
            </div>
          </Drawer>
        )}

        {/* Modal entregar */}
        {entregarConfirm && (
          <ConfirmModal
            message={`¿Marcar la venta de ${entregarConfirm.nombre_cliente || 'este cliente'} como entregada?`}
            onConfirm={handleEntregar}
            onCancel={() => setEntregarConfirm(null)}
            loading={saving}
            confirmLabel="Marcar entregado"
            loadingLabel="Guardando…"
            confirmClassName="btn-primary"
          />
        )}

        {/* Modal eliminar */}
        {confirm && (
          <ConfirmModal
            message="¿Eliminar esta venta? El stock de los productos se ajustará automáticamente."
            onConfirm={handleDelete}
            onCancel={() => setConfirm(null)}
          />
        )}

        {errModal && <ErrorModal title={errModal.title} body={errModal.body} onClose={() => setErrModal(null)} />}
        <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPage={setPage} />
      </div>
    </>
  )
}

