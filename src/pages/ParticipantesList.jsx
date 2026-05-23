import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Phone, Mail, ArrowRight, Pencil, Trash2, Plus, LayoutGrid, List as ListIcon } from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { useToast } from '../lib/toast.jsx'
import { fmt } from '../lib/formatters.js'
import * as q from '../lib/rifas-queries.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../lib/useBreadcrumbs.js'
import { useAuth } from '../lib/AuthContext.jsx'
import LoadingSpinner, { ErrorMsg } from '../components/LoadingSpinner.jsx'
import Drawer from '../components/Drawer.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import ErrorModal from '../components/ErrorModal.jsx'
import { parseError } from '../lib/parseError.js'
import { supabase } from '../lib/supabase.js'
import GrupoBadge from '../components/GrupoBadge.jsx'

const EMPTY = { nombre_completo: '', telefono_whatsapp: '', email: '', grupo_id: '' }

export default function ParticipantesList() {
  const navigate = useNavigate()
  const crumbs = useBreadcrumbs()
  const { isAdmin } = useAuth()
  const { data, loading, error, refetch } = useQuery(() => q.getParticipantes(), [])
  const { data: grupos } = useQuery(() => q.getGrupos(), [])

  const [search,     setSearch]     = useState('')
  const [grupoFiltro, setGrupoFiltro] = useState('')  // '' = todos
  const [viewMode,   setViewMode]   = useState('cards')  // 'cards' | 'list'
  const [drawer,   setDrawer]   = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [confirm,  setConfirm]  = useState(null)
  const [errModal, setErrModal] = useState(null)
  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const toast = useToast()

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const done = msg  => { refetch(); setDrawer(null); if (msg) toast(msg) }

  function openCreate() { setForm(EMPTY); setDrawer({ mode: 'create' }) }
  function openEdit(p, e) {
    e.stopPropagation()
    setForm({ nombre_completo: p.nombre_completo, telefono_whatsapp: p.telefono_whatsapp ?? '', email: p.email ?? '', grupo_id: p.grupo_id ?? '' })
    setDrawer({ mode: 'edit', record: p })
  }

  async function handleSave() {
    if (!form.nombre_completo.trim()) { showErr('El nombre del participante es obligatorio.'); return }
    setSaving(true)
    try {
      // Si no se escogió grupo, asignar automáticamente "Otros"
      let grupo_id = form.grupo_id || null
      if (!grupo_id) {
        const otros = (grupos ?? []).find(g => g.nombre.toLowerCase() === 'otros')
        grupo_id = otros?.id ?? null
      }
      const payload = { ...form, grupo_id }
      if (drawer.mode === 'create') await q.insertParticipante(payload)
      else await q.updateParticipante(drawer.record.id, payload)
      done(drawer.mode === 'create' ? 'Participante registrado' : 'Participante actualizado')
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await q.deleteParticipante(confirm)
      toast('Participante eliminado')
      setConfirm(null)
      refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  // Filtered list
  const list = useMemo(() => {
    return (data ?? []).filter(p => {
      if (grupoFiltro && p.grupo_id !== grupoFiltro) return false
      if (!search.trim()) return true
      const s = search.toLowerCase()
      return (
        p.nombre_completo.toLowerCase().includes(s) ||
        (p.telefono_whatsapp ?? '').includes(s) ||
        (p.email ?? '').toLowerCase().includes(s)
      )
    })
  }, [data, search, grupoFiltro])

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando participantes…" /></>
  if (error)   return <ErrorMsg message={error} />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><Users size={22} /> Participantes</h1>
          <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('cards')}
              title="Vista tarjetas"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('list')}
              title="Vista lista"
            >
              <ListIcon size={14} />
            </button>
            {isAdmin && (
              <button className="btn btn-primary" onClick={openCreate}>
                <Plus size={15} /> Nuevo participante
              </button>
            )}
          </div>
        </div>

        {/* Barra de búsqueda + filtro grupo */}
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="deuda-search"
            style={{ flex: '1 1 220px', minWidth: 0 }}
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {(grupos ?? []).length > 0 && (
            <select
              value={grupoFiltro}
              onChange={e => setGrupoFiltro(e.target.value)}
              style={{ height: '2.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '0 .75rem', fontSize: '.875rem', flexShrink: 0 }}
            >
              <option value="">Todos los grupos</option>
              {(grupos ?? []).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          )}
        </div>

        {/* Contador */}
        {search.trim() && (
          <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            {list.length} {list.length === 1 ? 'resultado' : 'resultados'}
          </p>
        )}

        {viewMode === 'cards' ? (
          <div className="grid grid-auto" key={`${viewMode}|${grupoFiltro}|${search}`} style={{ animation: 'boleto-view-in .5s ease both' }}>
            {list.map(p => (
              <ParticipanteCard
                key={p.id}
                part={p}
                onEdit={isAdmin ? openEdit : null}
                onDelete={isAdmin ? id => setConfirm(id) : null}
                onClick={() => navigate(`/participantes/${p.id}`)}
              />
            ))}
            {list.length === 0 && (
              <p className="empty">
                {search.trim() ? 'Sin resultados para la búsqueda.' : 'No hay participantes registrados.'}
              </p>
            )}
          </div>
        ) : (
          <div className="part-list-container" key={`${viewMode}|${grupoFiltro}|${search}`} style={{ animation: 'boleto-view-in .5s ease both' }}>
            {list.map(p => (
              <ParticipanteRow
                key={p.id}
                part={p}
                onEdit={isAdmin ? openEdit : null}
                onDelete={isAdmin ? id => setConfirm(id) : null}
                onClick={() => navigate(`/participantes/${p.id}`)}
              />
            ))}
            {list.length === 0 && (
              <p className="empty">
                {search.trim() ? 'Sin resultados para la búsqueda.' : 'No hay participantes registrados.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Drawer crear/editar */}
      {drawer && (
        <Drawer
          title={drawer.mode === 'create' ? 'Nuevo participante' : 'Editar participante'}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className="field">
            <label>Nombre completo *</label>
            <input
              value={form.nombre_completo}
              onChange={e => set('nombre_completo', e.target.value)}
              placeholder="Nombre del comprador"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Teléfono WhatsApp</label>
            <input
              type="tel"
              value={form.telefono_whatsapp}
              onChange={e => set('telefono_whatsapp', e.target.value)}
              placeholder="ej. 6671234567"
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="correo@ejemplo.com"
            />
          </div>
          <div className="field">
            <label>Grupo social</label>
            <select value={form.grupo_id} onChange={e => set('grupo_id', e.target.value || null)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '.45rem .75rem', color: 'var(--text)', fontSize: '.875rem', width: '100%' }}>
              <option value="">Sin grupo</option>
              {(grupos ?? []).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
        </Drawer>
      )}

      {confirm && (
        <ConfirmModal
          message="¿Eliminar este participante? Sus boletos quedarán disponibles nuevamente."
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          loading={saving}
        />
      )}

      {errModal && <ErrorModal {...errModal} onClose={() => setErrModal(null)} />}
    </>
  )
}

// Eliminación directa desde supabase (sin query wrapper extra)
async function supabaseDeleteParticipante(id) {
  const { error } = await supabase.from('participantes').delete().eq('id', id)
  if (error) throw error
}

// ── Fila de participante (vista lista) ────────────────────────────────────────

function ParticipanteRow({ part, onEdit, onDelete, onClick }) {
  const r = part.resumen ?? { total: 0, liquidados: 0, apartados: 0, pagado: 0, pendiente: 0 }
  return (
    <div className="part-list-row" onClick={onClick}>
      <div className="part-avatar" aria-hidden="true">
        {part.nombre_completo.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {part.nombre_completo}
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.1rem', alignItems: 'center' }}>
          {part.grupo && <GrupoBadge grupo={part.grupo} />}
          {part.telefono_whatsapp && <span><Phone size={10} /> {part.telefono_whatsapp}</span>}
          {part.email && <span><Mail size={10} /> {part.email}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: '.8rem', flexShrink: 0 }}>
        <div style={{ color: 'var(--text-muted)' }}>
          {r.total} {r.total === 1 ? 'boleto' : 'boletos'}
          {r.liquidados > 0 && <span style={{ color: 'var(--liquidado)', marginLeft: '.35rem' }}>· {r.liquidados} liq.</span>}
        </div>
        {r.pendiente > 0 && (
          <div style={{ color: 'var(--abonado)', fontWeight: 600 }}>Debe {fmt(r.pendiente)}</div>
        )}
      </div>
      {onEdit && (
        <button className="btn btn-icon" onClick={e => onEdit(part, e)} title="Editar">
          <Pencil size={14} />
        </button>
      )}
      {onDelete && (
        <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); onDelete(part.id) }} title="Eliminar">
          <Trash2 size={14} />
        </button>
      )}
      <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  )
}

// ── Tarjeta de participante ───────────────────────────────────────────────────

function ParticipanteCard({ part, onEdit, onDelete, onClick }) {
  const r = part.resumen ?? { total: 0, liquidados: 0, apartados: 0, pagado: 0, pendiente: 0 }
  const accentColor = r.pendiente > 0
    ? 'var(--abonado)'
    : r.total > 0 && r.pendiente === 0
      ? 'var(--liquidado)'
      : 'transparent'

  return (
    <div
      className="part-card"
      // Decidir si lo quito o conservo
      // style={{ '--part-card-accent': accentColor }}
      onClick={onClick}
    >
      {/* Cabecera: avatar + nombre + grupo + contacto */}
      <div className="part-card-header">
        <span className="part-avatar part-avatar-md" aria-hidden="true">
          {part.nombre_completo.charAt(0).toUpperCase()}
        </span>
        <div className="part-card-info">
          <div className="part-card-nombre">{part.nombre_completo}</div>
          {part.grupo && <GrupoBadge grupo={part.grupo} size="sm" />}
          {(part.telefono_whatsapp || part.email) && (
            <div className="part-card-contact">
              {part.telefono_whatsapp && (
                <span><Phone size={10} /> {part.telefono_whatsapp}</span>
              )}
              {part.email && (
                <span><Mail size={10} /> {part.email}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divisor */}
      <div className="part-card-divider" />

      {/* Mini-stats */}
      <div className="part-card-stats">
        <div className="part-card-stat">
          <span className="part-card-stat-val">{r.total}</span>
          <span className="part-card-stat-lbl">{r.total === 1 ? 'boleto' : 'boletos'}</span>
        </div>
        <div className="part-card-stat">
          <span className="part-card-stat-val" style={{ color: r.pagado > 0 ? 'var(--liquidado)' : 'var(--text-muted)' }}>
            {r.pagado > 0 ? fmt(r.pagado) : '—'}
          </span>
          <span className="part-card-stat-lbl">pagado</span>
        </div>
        <div className="part-card-stat">
          <span className="part-card-stat-val" style={{ color: r.pendiente > 0 ? 'var(--abonado)' : 'var(--text-muted)' }}>
            {r.pendiente > 0 ? fmt(r.pendiente) : '—'}
          </span>
          <span className="part-card-stat-lbl">saldo</span>
        </div>
      </div>

      {/* Footer: acciones + link */}
      <div className="part-card-footer">
        <div style={{ display: 'flex', gap: '.3rem' }}>
          {onEdit && (
            <button className="btn btn-icon" onClick={e => onEdit(part, e)} title="Editar">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); onDelete(part.id) }} title="Eliminar">
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <span className="part-card-ver-perfil">Ver perfil <ArrowRight size={12} /></span>
      </div>
    </div>
  )
}
