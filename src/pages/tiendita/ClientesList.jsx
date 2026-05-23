import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCheck, Plus, Pencil, Trash2, Phone, Mail, MapPin,
  ArrowRight, ShoppingBag, LayoutGrid, List as ListIcon,
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

function ClienteCard({ cliente, onEdit, onDelete, onClick }) {
  const stats = ventasStats(cliente)
  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem' }}>
        <span style={{ fontWeight: 700, fontSize: '.95rem', lineHeight: 1.3 }}>{cliente.nombre_completo}</span>
        {stats.count > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '.25rem', padding: '.15rem .45rem', borderRadius: '999px', fontSize: '.7rem', fontWeight: 700, background: 'var(--accent-light)', color: 'var(--accent)', flexShrink: 0 }}>
            <ShoppingBag size={10} /> {stats.count}
          </span>
        )}
      </div>
      {cliente.telefono_whatsapp && (
        <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
          <Phone size={11} /> {cliente.telefono_whatsapp}
        </div>
      )}
      {cliente.email && (
        <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Mail size={11} /> {cliente.email}
        </div>
      )}
      {cliente.direccion && (
        <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
          <MapPin size={11} /> {cliente.direccion}
        </div>
      )}
      {stats.count > 0 && (
        <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.1rem' }}>
          Total compras: <strong style={{ color: 'var(--text)' }}>{fmt(stats.total)}</strong>
        </div>
      )}
      {(onEdit || onDelete) && (
        <div style={{ display: 'flex', gap: '.35rem', marginTop: '.25rem' }}>
          {onEdit  && <button className="btn btn-icon" onClick={e => { e.stopPropagation(); onEdit(cliente, e) }} title="Editar"><Pencil size={13} /></button>}
          {onDelete && <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); onDelete(cliente.id) }} title="Eliminar"><Trash2 size={13} /></button>}
          <div style={{ flex: 1 }} />
          <ArrowRight size={15} style={{ color: 'var(--text-muted)', alignSelf: 'center' }} />
        </div>
      )}
    </div>
  )
}

function ClienteRow({ cliente, onEdit, onDelete, onClick }) {
  const stats = ventasStats(cliente)
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
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

  const [search,       setSearch]       = useState('')
  const [soloConCompras, setSoloConCompras] = useState(false)
  const [viewMode,     setViewMode]     = useState('cards')
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

  const list = useMemo(() => {
    return (data ?? []).filter(c => {
      if (soloConCompras && !(c.ventas?.length > 0)) return false
      if (!search.trim()) return true
      const s = search.toLowerCase()
      return (
        c.nombre_completo.toLowerCase().includes(s) ||
        (c.telefono_whatsapp ?? '').includes(s) ||
        (c.email ?? '').toLowerCase().includes(s) ||
        (c.direccion ?? '').toLowerCase().includes(s)
      )
    })
  }, [data, search, soloConCompras])

  const totalConCompras = useMemo(() => (data ?? []).filter(c => c.ventas?.length > 0).length, [data])

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
          <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem', cursor: 'pointer', flexShrink: 0, color: soloConCompras ? 'var(--accent)' : 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={soloConCompras}
              onChange={e => setSoloConCompras(e.target.checked)}
              style={{ width: 'auto', accentColor: 'var(--accent)' }}
            />
            Con compras ({totalConCompras})
          </label>
        </div>

        {search.trim() && (
          <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            {list.length} {list.length === 1 ? 'resultado' : 'resultados'}
          </p>
        )}

        {/* Vista tarjetas */}
        {viewMode === 'cards' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {list.map(c => (
              <ClienteCard
                key={c.id}
                cliente={c}
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
              <input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)} placeholder="Nombre del cliente" autoFocus />
            </div>
            <div className="field">
              <label>WhatsApp / Teléfono</label>
              <input value={form.telefono_whatsapp} onChange={e => set('telefono_whatsapp', e.target.value)} placeholder="10 dígitos" />
            </div>
            <div className="field">
              <label>Correo electrónico</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="field">
              <label>Dirección</label>
              <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Colonia, calle, número…" />
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Notas internas del cliente" />
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
        {errModal && <ErrorModal title={errModal.title} message={errModal.body} onClose={() => setErrModal(null)} />}
      </div>
    </>
  )
}

