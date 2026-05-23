import { useState } from 'react'
import { Sun, Moon, Globe, Bell, Shield, User, Palette, Info, ChevronRight, ChevronDown, Users, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../lib/useBreadcrumbs.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { useTheme } from '../lib/ThemeContext.jsx'
import { useQuery } from '../lib/useQuery.js'
import { useToast } from '../lib/toast.jsx'
import * as q from '../lib/rifas-queries.js'
import GrupoBadge from '../components/GrupoBadge.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'

function OptionSection({ icon: Icon, title, description, badge }) {
  return (
    <div className="opciones-item">
      <div className="opciones-item-icon">
        <Icon size={18} />
      </div>
      <div className="opciones-item-body">
        <span className="opciones-item-label">{title}</span>
        <span className="opciones-item-desc">{description}</span>
      </div>
      {badge && <span className="opciones-badge">{badge}</span>}
      <ChevronRight size={15} className="opciones-chevron" />
    </div>
  )
}

function OptionGroup({ title, children }) {
  return (
    <section className="opciones-group">
      <h2 className="opciones-group-title">{title}</h2>
      <div className="opciones-group-body">
        {children}
      </div>
    </section>
  )
}

export default function Opciones() {
  const crumbs = useBreadcrumbs()
  const { user, rol, isAdmin } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()

  const { data: grupos, refetch: refetchGrupos } = useQuery(() => q.getGrupos(), [])
  const [grupoForm,    setGrupoForm]    = useState(null)
  const [grupoSaving,  setGrupoSaving]  = useState(false)
  const [grupoConfirm, setGrupoConfirm] = useState(null)
  const [gruposOpen,   setGruposOpen]   = useState(true)

  const COLORES_PRESET = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16']

  async function handleGrupoSave() {
    if (!grupoForm?.nombre?.trim()) return
    setGrupoSaving(true)
    try {
      if (grupoForm.id) await q.updateGrupo(grupoForm.id, { nombre: grupoForm.nombre.trim(), color: grupoForm.color })
      else              await q.insertGrupo({ nombre: grupoForm.nombre.trim(), color: grupoForm.color })
      toast(grupoForm.id ? 'Grupo actualizado' : 'Grupo creado')
      setGrupoForm(null)
      refetchGrupos()
    } catch { toast('Error al guardar el grupo') }
    finally { setGrupoSaving(false) }
  }

  async function handleGrupoDelete() {
    if (!grupoConfirm) return
    try {
      await q.deleteGrupo(grupoConfirm)
      toast('Grupo eliminado')
      setGrupoConfirm(null)
      refetchGrupos()
    } catch { toast('No se puede eliminar: hay participantes asignados a este grupo') }
  }

  const themeConfig = {
    dark:  { icon: Moon, label: 'Oscuro' },
    light: { icon: Sun,  label: 'Claro'  },
    //google: { icon: Globe, label: 'Google' },
  }

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-header" style={{ maxWidth: 620, margin: '0 auto', width: '100%' }}>
          <h1 className="page-title">Opciones</h1>
          <p className="page-subtitle">Personalización y configuración de la aplicación</p>
        </div>

        <div className="opciones-layout">

          {/* Cuenta */}
          <OptionGroup title="Cuenta">
            <div className="opciones-item opciones-item-account">
              <div className="opciones-item-avatar">
                {(user?.email ?? '?')[0].toUpperCase()}
              </div>
              <div className="opciones-item-body">
                <span className="opciones-item-label">{user?.email ?? '—'}</span>
              </div>
              <span className={`badge ${rol === 'admin' ? 'badge-liquidado' : 'badge-abonado'}`}>
                {rol}
              </span>
            </div>
            <OptionSection icon={User}   title="Perfil"        description="Nombre, avatar y datos personales"     badge="Próximamente" />
            <OptionSection icon={Shield} title="Seguridad"     description="Contraseña y verificación en dos pasos" badge="Próximamente" />
          </OptionGroup>

          {/* Grupos sociales */}
          {isAdmin && (
          <OptionGroup title="Grupos sociales">

            {/* Cabecera: descripción + botón nuevo (siempre visible) */}
            <div style={{ padding: '.75rem 1rem .5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                Clasifica participantes en grupos para filtrar boletos y pendientes.
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setGrupoForm({ nombre: '', color: COLORES_PRESET[0] }); setGruposOpen(true) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '.3rem', flexShrink: 0 }}
              >
                <Plus size={13} /> Nuevo grupo
              </button>
            </div>

            {/* Formulario inline crear/editar */}
            {grupoForm && (
              <div style={{ padding: '.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                <p style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '.6rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {grupoForm.id ? 'Editar grupo' : 'Nuevo grupo'}
                </p>
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.5rem' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: grupoForm.color, flexShrink: 0, border: '2px solid var(--border)' }} />
                  <input
                    value={grupoForm.nombre}
                    onChange={e => setGrupoForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Nombre del grupo"
                    style={{ ...inputStyle, flex: 1 }}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleGrupoSave(); if (e.key === 'Escape') setGrupoForm(null) }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginBottom: '.6rem', alignItems: 'center' }}>
                  {COLORES_PRESET.map(c => (
                    <button key={c} onClick={() => setGrupoForm(f => ({ ...f, color: c }))}
                      title={c}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', border: '3px solid',
                        borderColor: grupoForm.color === c ? 'var(--text)' : 'transparent',
                        background: c, cursor: 'pointer', padding: 0, flexShrink: 0,
                        boxShadow: grupoForm.color === c ? '0 0 0 2px var(--bg), 0 0 0 4px ' + c : 'none',
                        transition: 'box-shadow .15s',
                      }}
                    />
                  ))}
                  <input type="color" value={grupoForm.color}
                    onChange={e => setGrupoForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: 24, height: 24, padding: 0, border: '2px solid var(--border)', cursor: 'pointer', borderRadius: '50%', background: 'none' }}
                    title="Color personalizado"
                  />
                </div>
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleGrupoSave} disabled={grupoSaving}>
                    <Check size={13} /> {grupoForm.id ? 'Guardar cambios' : 'Crear grupo'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setGrupoForm(null)}>
                    <X size={13} /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Toggle colapsable */}
            {(grupos ?? []).length > 0 && (
              <button
                onClick={() => setGruposOpen(o => !o)}
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '.82rem', borderBottom: gruposOpen ? '1px solid var(--border)' : 'none' }}
              >
                <span>{(grupos ?? []).length} {(grupos ?? []).length === 1 ? 'grupo' : 'grupos'} registrados</span>
                <ChevronDown size={15} style={{ transform: gruposOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
            )}

            {/* Lista de grupos */}
            {gruposOpen && (grupos ?? []).map((g, i) => (
              <div
                key={g.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '.75rem',
                  padding: '.6rem 1rem',
                  borderBottom: i < (grupos.length - 1) ? '1px solid var(--border)' : 'none',
                  background: grupoForm?.id === g.id ? 'var(--bg-muted)' : 'transparent',
                  transition: 'background .15s',
                }}
              >
                {/* Pastilla color */}
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                {/* Nombre */}
                <GrupoBadge grupo={g} size="md" />
                {/* Spacer */}
                <div style={{ flex: 1 }} />
                {/* Acciones */}
                <button
                  className="btn btn-icon"
                  onClick={() => { setGrupoForm({ id: g.id, nombre: g.nombre, color: g.color }); setGruposOpen(true) }}
                  title="Editar grupo"
                >
                  <Pencil size={13} />
                </button>
                <button
                  className="btn btn-icon btn-danger-icon"
                  onClick={() => setGrupoConfirm(g.id)}
                  title="Eliminar grupo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {/* Estado vacío */}
            {(grupos ?? []).length === 0 && !grupoForm && (
              <div style={{ padding: '.75rem 1rem', fontSize: '.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Sin grupos todavía. Crea el primero con el botón de arriba.
              </div>
            )}

          </OptionGroup>
          )}

          {/* Apariencia */}
          <OptionGroup title="Apariencia">
            <div className="opciones-item opciones-item-theme">
              <div className="opciones-item-icon"><Palette size={18} /></div>
              <div className="opciones-item-body">
                <span className="opciones-item-label">Tema</span>
                <span className="opciones-item-desc">Elige entre claro u oscuro</span>
              </div>
              <div className="opciones-theme-pills">
                {Object.entries(themeConfig).map(([key, { icon: Icon, label }]) => (
                  <button
                    key={key}
                    className={`theme-pill ${theme === key ? 'theme-pill-active' : ''}`}
                    onClick={() => setTheme(key)}
                    title={`Tema ${label}`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </OptionGroup>

          {/* Idioma y región */}
          <OptionGroup title="Idioma y región">
            <div className="opciones-item">
              <div className="opciones-item-icon"><Globe size={18} /></div>
              <div className="opciones-item-body">
                <span className="opciones-item-label">Idioma</span>
                <span className="opciones-item-desc">Español (México)</span>
              </div>
              <span className="opciones-badge">Próximamente</span>
              <ChevronRight size={15} className="opciones-chevron" />
            </div>
          </OptionGroup>

          {/* Notificaciones */}
          <OptionGroup title="Notificaciones">
            <OptionSection icon={Bell} title="Notificaciones de sorteo" description="Avisar sobre boletos vencidos o ganadores pendientes" badge="Próximamente" />
          </OptionGroup>

          {/* Acerca de */}
          <OptionGroup title="Acerca de">
            <div className="opciones-item">
              <div className="opciones-item-icon"><Info size={18} /></div>
              <div className="opciones-item-body">
                <span className="opciones-item-label">RifaGestión</span>
                <span className="opciones-item-desc">Versión 1.1 · Gestión de rifas y sorteos</span>
              </div>
            </div>
          </OptionGroup>

        </div>
      </div>

      {grupoConfirm && (
        <ConfirmModal
          title="Eliminar grupo"
          message="¿Seguro? Los participantes asignados a este grupo quedarán sin grupo."
          onConfirm={handleGrupoDelete}
          onCancel={() => setGrupoConfirm(null)}
        />
      )}
    </>
  )
}

const inputStyle = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '.4rem .7rem',
  color: 'var(--text)', fontSize: '.875rem', outline: 'none', width: '100%',
}
