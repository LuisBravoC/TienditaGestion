import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCheck, Plus, Pencil, Trash2, Phone, Mail, MapPin,
  ArrowRight, ShoppingBag, LayoutGrid, List as ListIcon, AlertCircle,
} from 'lucide-react'
import { useQuery }       from '../../lib/useQuery.js'
import { useToast }       from '../../lib/toast.jsx'
import { fmt }            from '../../lib/formatters.js'
import * as qt            from '../../lib/tiendita-queries.js'
import * as qr            from '../../lib/rifas-queries.js'
import Breadcrumbs        from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../../lib/useBreadcrumbs.js'
import { useAuth }        from '../../lib/AuthContext.jsx'
import LoadingSpinner, { ErrorMsg } from '../../components/LoadingSpinner.jsx'
import Drawer             from '../../components/Drawer.jsx'
import ConfirmModal       from '../../components/ConfirmModal.jsx'
import ErrorModal         from '../../components/ErrorModal.jsx'
import { parseError }     from '../../lib/parseError.js'

const EMPTY = { nombre_completo: '', telefono_whatsapp: '', email: '', direccion: '', notas: '' }

function ventasStats(c) {
  const count = c.ventas?.length ?? 0
  const total = c.ventas?.reduce((s, v) => s + Number(v.precio_total), 0) ?? 0
  return { count, total }
}

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#3b82f6','#10b981','#f59e0b']
const avatarColor = name => AVATAR_COLORS[(name ?? '?').charCodeAt(0) % AVATAR_COLORS.length]

function ClienteCard({ cliente, tieneDeuda, onEdit, onDelete, onClick }) {
  const stats   = ventasStats(cliente)
  const inicial = (cliente.nombre_completo ?? '?')[0].toUpperCase()

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', gap: 0 }}>
      {/* Cuerpo */}
      <div style={{ padding: '1.1rem 1.1rem .9rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: avatarColor(cliente.nombre_completo), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.15rem', color: '#fff', flexShrink: 0 }}>
          {inicial}
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '.32rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: 1.25 }}>
            {cliente.nombre_completo}
          </div>
          {cliente.telefono_whatsapp && (
            <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '.35rem' }}>
              <Phone size={12} style={{ flexShrink: 0 }} />{cliente.telefono_whatsapp}
            </div>
          )}
          {cliente.email && (
            <div style={{ fontSize: '.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '.35rem', overflow: 'hidden' }}>
              <Mail size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.email}</span>
            </div>
          )}
          {cliente.direccion && (
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '.35rem' }}>
              <MapPin size={12} style={{ flexShrink: 0, marginTop: '.15rem' }} />
              <span style={{ lineHeight: 1.45 }}>{cliente.direccion}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer: stats + acciones */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '.6rem 1.1rem', display: 'flex', alignItems: 'center', gap: '.55rem', background: 'var(--bg-muted)', flexWrap: 'wrap' }}>
        {stats.count > 0 ? (
          <>
            <ShoppingBag size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>{stats.count}</strong> venta{stats.count !== 1 ? 's' : ''}
            </span>
            <span style={{ opacity: .3, fontSize: '.8rem' }}>·</span>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--liquidado)' }}>{fmt(stats.total)}</span>
            {tieneDeuda && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.2rem', padding: '.1rem .45rem', borderRadius: '999px', fontSize: '.7rem', fontWeight: 700, background: '#ef444420', color: '#ef4444' }}>
                <AlertCircle size={10} /> Deuda
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin compras</span>
        )}
        <div style={{ flex: 1 }} />
        {onEdit   && <button className="btn btn-icon" onClick={e => { e.stopPropagation(); onEdit(cliente, e) }}   title="Editar"><Pencil size={13} /></button>}
        {onDelete && <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); onDelete(cliente.id) }} title="Eliminar"><Trash2 size={13} /></button>}
        <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
    </div>
  )
}

function ClienteRow({ cliente, onEdit, onDelete, onClick }) {
  const stats = ventasStats(cliente)
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', animation: 'fadeIn .18s ease' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.9rem' }}>{cliente.nombre_completo}</div>
        {(cliente.telefono_whatsapp || cliente.email) && (
          <div style={{ fontSize: '.77rem', color: 'var(--text-muted)', marginTop: '.1rem', display: 'flex', gap: '.6rem' }}>
            {cliente.telefono_whatsapp && <span><Phone size={10} style={{ verticalAlign: 'middle' }} /> {cliente.telefono_whatsapp}</span>}
            {cliente.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}><Mail size={10} style={{ verticalAlign: 'middle' }} /> {cliente.email}</span>}
          </div>
        )}
      </div>
      {stats.count > 0 && (
        <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {stats.count} venta{stats.count !== 1 ? 's' : ''} · <strong style={{ color: 'var(--text)' }}>{fmt(stats.total)}</strong>
        </span>
      )}
      {onEdit  && <button className="btn btn-icon" onClick={e => { e.stopPropagation(); onEdit(cliente, e) }} title="Editar"><Pencil size={13} /></button>}
      {onDelete && <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); onDelete(cliente.id) }} title="Eliminar"><Trash2 size={13} /></button>}
      <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  )
}

export default function ClientesList() {
  const navigate    = useNavigate()
  const crumbs      = useBreadcrumbs()
  const { isAdmin } = useAuth()
  const toast       = useToast()

  const { data, loading, error, refetch } = useQuery(() => qt.getClientesConResumen(), [])
  const { data: apartados }               = useQuery(() => qt.getApartadosPendientes(), [])

  const [search,         setSearch]         = useState('')
  const [soloConCompras, setSoloConCompras]   = useState(false)
  const [soloConDeuda,   setSoloConDeuda]     = useState(false)
  const [viewMode,       setViewMode]         = useState('cards')
  const [drawer,       setDrawer]       = useState(null)
  const [form,         setForm]         = useState(EMPTY)
  const [saving,       setSaving]       = useState(false)
  const [confirm,      setConfirm]      = useState(null)
  const [errModal,     setErrModal]     = useState(null)

  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const set     = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function openCreate() { setForm(EMPTY); setDrawer({ mode: 'create' }) }
  function openEdit(c, e) {
    e.stopPropagation()
    setForm({
      nombre_completo:    c.nombre_completo,
      telefono_whatsapp:  c.telefono_whatsapp ?? '',
      email:              c.email             ?? '',
      direccion:          c.direccion         ?? '',
      notas:              c.notas             ?? '',
    })
    setDrawer({ mode: 'edit', record: c })
  }

  async function handleSave() {
    if (!form.nombre_completo.trim()) { showErr('El nombre es obligatorio.'); return }
    setSaving(true)
    try {
      const payload = {
        nombre_completo:   form.nombre_completo.trim(),
        telefono_whatsapp: form.telefono_whatsapp.trim() || null,
        email:             form.email.trim()             || null,
        direccion:         form.direccion.trim()         || null,
        notas:             form.notas.trim()             || null,
      }
      if (drawer.mode === 'create') await qr.insertParticipante(payload)
      else                          await qr.updateParticipante(drawer.record.id, payload)
      toast(drawer.mode === 'create' ? 'Cliente registrado' : 'Cliente actualizado')
      setDrawer(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await qr.deleteParticipante(confirm)
      toast('Cliente eliminado')
      setConfirm(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  const clientesConDeuda = useMemo(
    () => new Set((apartados ?? []).map(a => a.participante_id).filter(Boolean)),
    [apartados]
  )

  const list = useMemo(() => {
    return (data ?? []).filter(c => {
      if (soloConCompras && !(c.ventas?.length > 0))  return false
      if (soloConDeuda   && !clientesConDeuda.has(c.id)) return false
      if (!search.trim()) return true
      const s = search.toLowerCase()
      return (
        c.nombre_completo.toLowerCase().includes(s) ||
        (c.telefono_whatsapp ?? '').includes(s) ||
        (c.email ?? '').toLowerCase().includes(s) ||
        (c.direccion ?? '').toLowerCase().includes(s)
      )
    })
  }, [data, search, soloConCompras, soloConDeuda, clientesConDeuda])

  const totalConCompras = useMemo(() => (data ?? []).filter(c => c.ventas?.length > 0).length, [data])
  const totalConDeuda   = clientesConDeuda.size

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando clientes…" /></>
  if (error)   return <ErrorMsg message={error} />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">

        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><UserCheck size={22} /> Clientes</h1>
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('cards')} title="Tarjetas"><LayoutGrid size={14} /></button>
            <button className={`btn btn-sm ${viewMode === 'list'  ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('list')}  title="Lista"><ListIcon size={14} /></button>
            {isAdmin && <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> Nuevo cliente</button>}
          </div>
        </div>

        {/* Filtros */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="deuda-search"
            style={{ flex: '1 1 220px', minWidth: 0 }}
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            className={`btn btn-sm ${soloConCompras ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSoloConCompras(c => !c)}
            style={{ display: 'flex', alignItems: 'center', gap: '.35rem', flexShrink: 0 }}
          >
            <ShoppingBag size={13} /> Con compras ({totalConCompras})
          </button>
          <button
            className={`btn btn-sm ${soloConDeuda ? '' : 'btn-outline'}`}
            onClick={() => setSoloConDeuda(c => !c)}
            style={{ display: 'flex', alignItems: 'center', gap: '.35rem', flexShrink: 0, ...(soloConDeuda ? { background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' } : {}) }}
          >
            <AlertCircle size={13} /> Con deuda ({totalConDeuda})
          </button>
        </div>

        {search.trim() && (
          <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            {list.length} {list.length === 1 ? 'resultado' : 'resultados'}
          </p>
        )}

        <div key={viewMode + '|' + soloConCompras + '|' + soloConDeuda} style={{ animation: 'fadeIn .2s ease' }}>
        {/* Vista tarjetas */}
        {viewMode === 'cards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {list.map(c => (
              <ClienteCard
                key={c.id}
                cliente={c}
                tieneDeuda={clientesConDeuda.has(c.id)}
                onEdit={isAdmin ? openEdit : null}
                onDelete={isAdmin ? id => setConfirm(id) : null}
                onClick={() => navigate(`/participantes/${c.id}`)}
              />
            ))}
            {list.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <UserCheck size={36} style={{ opacity: .25, marginBottom: '.5rem' }} />
                <p>Sin clientes{search || soloConCompras ? ' con esos filtros' : ' todavía'}.</p>
                {isAdmin && !search && !soloConCompras && (
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={openCreate}>
                    <Plus size={15} /> Registrar primer cliente
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vista lista */}
        {viewMode === 'list' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {list.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin clientes.</div>
            ) : list.map(c => (
              <ClienteRow
                key={c.id}
                cliente={c}
                onEdit={isAdmin ? openEdit : null}
                onDelete={isAdmin ? id => setConfirm(id) : null}
                onClick={() => navigate(`/participantes/${c.id}`)}
              />
            ))}
          </div>
        )}
        </div>

        {/* Drawer crear/editar */}
        {drawer && (
          <Drawer
            title={drawer.mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'}
            onClose={() => setDrawer(null)}
            onSave={handleSave}
            saving={saving}
          >
            <div className="field">
              <label>Nombre completo *</label>
              <input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} placeholder="Nombre del cliente" maxLength={100} autoFocus />
            </div>
            <div className="field">
              <label>WhatsApp / Teléfono</label>
              <input value={form.telefono_whatsapp} onChange={e => set('telefono_whatsapp', e.target.value)} placeholder="10 dígitos" maxLength={20} />
            </div>
            <div className="field">
              <label>Correo electrónico</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" maxLength={254} />
            </div>
            <div className="field">
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Colonia, calle, número…" maxLength={300} />
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Notas internas del cliente" maxLength={300} />
            </div>
          </Drawer>
        )}

        {confirm && (
          <ConfirmModal
            message="¿Eliminar este cliente? Sus ventas quedarán sin cliente asignado."
            onConfirm={handleDelete}
            onCancel={() => setConfirm(null)}
          />
        )}
        {errModal && <ErrorModal title={errModal.title} body={errModal.body} onClose={() => setErrModal(null)} />}
      </div>
    </>
  )
}

