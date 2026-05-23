import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket, ArrowRight, Pencil, Trash2, Plus, Activity } from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { useToast } from '../lib/toast.jsx'
import { fmt } from '../lib/formatters.js'
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

const EMPTY = { nombre: '', descripcion: '', activa: true }

export default function Campanas() {
  const navigate = useNavigate()
  const crumbs  = useBreadcrumbs()
  const { isAdmin } = useAuth()
  const { data, loading, error, refetch } = useQuery(() => q.getCampanasConResumen(), [])

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
  function openEdit(c, e) {
    e.stopPropagation()
    setForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', activa: c.activa })
    setDrawer({ mode: 'edit', record: c })
  }

  async function handleSave() {
    if (!form.nombre.trim()) { showErr('El nombre de la campaña es obligatorio.'); return }
    setSaving(true)
    try {
      if (drawer.mode === 'create') await q.insertCampana(form)
      else await q.updateCampana(drawer.record.id, form)
      done(drawer.mode === 'create' ? 'Campaña creada' : 'Campaña actualizada')
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await q.deleteCampana(confirm)
      toast('Campaña eliminada')
      setConfirm(null)
      refetch()
    } catch (e) {
      showErr(e)
    } finally { setSaving(false) }
  }

  if (loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando campañas…" /></>
  if (error)   return <ErrorMsg message={error} />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><Ticket size={22} /> Campañas de Rifas</h1>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={15} /> Nueva campaña
            </button>
          )}
        </div>

        <div className="grid grid-auto">
          {(data ?? []).map(c => (
            <CampanaCard
              key={c.id}
              campana={c}
              onEdit={isAdmin ? openEdit : null}
              onDelete={isAdmin ? id => setConfirm(id) : null}
              onClick={() => navigate(`/rifas/${c.id}`)}
            />
          ))}
          {(data ?? []).length === 0 && (
            <p className="empty">No hay campañas. Crea la primera para empezar a gestionar tus rifas.</p>
          )}
        </div>
      </div>

      {/* Drawer crear/editar */}
      {drawer && (
        <Drawer
          title={drawer.mode === 'create' ? 'Nueva campaña' : 'Editar campaña'}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className="field">
            <label>Nombre *</label>
            <input
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="ej. Rifas Pro-Graduación 2025"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              rows={3}
              placeholder="Descripción breve de la campaña…"
            />
          </div>
          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.activa}
                onChange={e => set('activa', e.target.checked)}
                style={{ width: 'auto' }}
              />
              Campaña activa
            </label>
          </div>
        </Drawer>
      )}

      {/* Confirmar eliminar */}
      {confirm && (
        <ConfirmModal
          message="¿Eliminar esta campaña? Se eliminarán también todas sus rifas y boletos. Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          loading={saving}
        />
      )}

      {errModal && <ErrorModal {...errModal} onClose={() => setErrModal(null)} />}
    </>
  )
}

function CampanaCard({ campana, onEdit, onDelete, onClick }) {
  const r = campana.resumen ?? { rifas: 0, meta: 0, boletos: 0, liquidados: 0, recaudado: 0 }
  const pct = r.boletos > 0 ? Math.round((r.liquidados / r.boletos) * 100) : 0

  return (
    <div className="card card-link" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">{campana.nombre}</div>
          {campana.descripcion && (
            <div className="card-sub" style={{ marginTop: '.15rem' }}>{campana.descripcion}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '.35rem', flexShrink: 0 }}>
          {onEdit && (
            <button className="btn btn-icon" onClick={e => onEdit(campana, e)} title="Editar">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); onDelete(campana.id) }} title="Eliminar">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '.82rem', color: 'var(--text-muted)', margin: '.75rem 0 .5rem' }}>
        <span><Activity size={12} style={{ marginRight: '.2rem' }} />{r.rifas} {r.rifas === 1 ? 'rifa' : 'rifas'}</span>
        <span>
          {r.liquidados}/{r.boletos} boletos <span style={{ color: 'var(--liquidado)', fontWeight: 600 }}>({pct}%)</span>
        </span>
        <span>
          Rec: <strong style={{ color: 'var(--liquidado)' }}>{fmt(r.recaudado)}</strong>
          {r.meta > 0 && <> / <span style={{ color: 'var(--text-muted)' }}>{fmt(r.meta)}</span></>}
        </span>
      </div>

      {r.meta > 0 && <ProgressBar value={r.recaudado} max={r.meta} />}

      <div style={{ marginTop: '.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          className={`badge badge-${campana.activa ? 'liquidado' : 'deuda'}`}
          style={{ fontSize: '.72rem' }}
        >
          {campana.activa ? 'Activa' : 'Inactiva'}
        </span>
        <span style={{ fontSize: '.8rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '.2rem' }}>
          Ver rifas <ArrowRight size={13} />
        </span>
      </div>
    </div>
  )
}
