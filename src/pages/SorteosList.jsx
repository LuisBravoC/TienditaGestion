import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ticket, Trophy, Calendar, DollarSign, ArrowRight, Pencil, Trash2, Plus, Hash } from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { useToast } from '../lib/toast.jsx'
import { fmt, fmtDate } from '../lib/formatters.js'
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
import ChartBoletosPorEstatus from '../components/ChartBoletosPorEstatus.jsx'

const CUPOS_COMUNES = [100, 200, 500, 1000]

const EMPTY = {
  nombre_premio:    '',
  descripcion:      '',
  precio_boleto:    '',
  cantidad_boletos: 100,
  fecha_sorteo:     '',
  horas_expiracion: 24,
  estatus:          'Activa',
}

const ESTATUS_RIFA = ['Activa', 'Finalizada', 'Cancelada']

export default function SorteosList() {
  const { campanaId } = useParams()
  const navigate = useNavigate()
  const campanaQ  = useQuery(() => q.getCampana(campanaId), [campanaId])
  const rifasQ    = useQuery(() => q.getRifasConResumen(campanaId), [campanaId])
  const boletosPorEstatusQ = useQuery(() => q.getBoletosPorEstatusCampana(campanaId), [campanaId])

  const [drawer,   setDrawer]   = useState(null)
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [confirm,  setConfirm]  = useState(null)
  const [errModal, setErrModal] = useState(null)
  const showErr = e => setErrModal(typeof e === 'string' ? { title: 'Aviso', body: e } : (e?.title ? e : parseError(e)))
  const toast   = useToast()
  const { isAdmin } = useAuth()

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const done = msg  => { rifasQ.refetch(); setDrawer(null); if (msg) toast(msg) }

  function openCreate() { setForm(EMPTY); setDrawer({ mode: 'create' }) }
  function openEdit(rifa, e) {
    e.stopPropagation()
    setForm({
      nombre_premio:    rifa.nombre_premio,
      descripcion:      rifa.descripcion ?? '',
      precio_boleto:    rifa.precio_boleto,
      cantidad_boletos: rifa.cantidad_boletos,
      fecha_sorteo:     rifa.fecha_sorteo ?? '',
      horas_expiracion: rifa.horas_expiracion,
      estatus:          rifa.estatus,
    })
    setDrawer({ mode: 'edit', record: rifa })
  }

  async function handleSave() {
    if (!form.nombre_premio.trim())          { showErr('El nombre del premio es obligatorio.'); return }
    if (!form.precio_boleto || Number(form.precio_boleto) <= 0) { showErr('El precio por boleto debe ser mayor a 0.'); return }
    if (!form.cantidad_boletos || Number(form.cantidad_boletos) < 2) { showErr('Se necesitan al menos 2 boletos.'); return }

    setSaving(true)
    try {
      if (drawer.mode === 'create') {
        await q.insertRifa({ ...form, campana_id: campanaId })
        done('Rifa creada con sus boletos')
      } else {
        // Al editar NO se regeneran los boletos para no perder asignaciones
        const { nombre_premio, descripcion, precio_boleto, fecha_sorteo, horas_expiracion, estatus } = form
        const precioAnterior = drawer.record.precio_boleto
        await q.updateRifa(drawer.record.id, { nombre_premio, descripcion, precio_boleto: Number(precio_boleto), fecha_sorteo: fecha_sorteo || null, horas_expiracion: Number(horas_expiracion), estatus })
        if (Number(precio_boleto) !== Number(precioAnterior)) {
          await q.recalcularEstatusPorPrecio(drawer.record.id, Number(precio_boleto))
        }
        done('Rifa actualizada')
      }
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await q.deleteRifa(confirm)
      toast('Rifa eliminada')
      setConfirm(null)
      rifasQ.refetch()
    } catch (e) { showErr(e) }
    finally { setSaving(false) }
  }

  const campana = campanaQ.data
  const crumbs  = useBreadcrumbs({ campanaId: campana?.nombre })

  if (campanaQ.loading || rifasQ.loading) return <><Breadcrumbs crumbs={crumbs} /><LoadingSpinner text="Cargando rifas…" /></>
  if (campanaQ.error) return <ErrorMsg message={campanaQ.error} />
  if (!campana)       return <ErrorMsg message="Campaña no encontrada" />

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              <Ticket size={22} /> {campana.nombre}
            </h1>
            {campana.descripcion && (
              <p style={{ color: 'var(--text-muted)', fontSize: '.88rem', marginTop: '.2rem' }}>
                {campana.descripcion}
              </p>
            )}
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={15} /> Nueva rifa
            </button>
          )}
        </div>

        {/* Gráfica de boletos por estatus */}
        <div style={{ marginBottom: '2rem' }}>
          <p className="section-heading">Estado de los Boletos</p>
          <div className="card" style={{ padding: '1.5rem' }}>
            <ChartBoletosPorEstatus
              data={boletosPorEstatusQ.data}
              loading={boletosPorEstatusQ.loading}
              error={boletosPorEstatusQ.error}
            />
          </div>
        </div>

        <div className="grid grid-auto">
          {(rifasQ.data ?? []).map(rifa => (
            <RifaCard
              key={rifa.id}
              rifa={rifa}
              onEdit={isAdmin ? openEdit : null}
              onDelete={isAdmin ? id => setConfirm(id) : null}
              onClick={() => navigate(`/rifas/${campanaId}/sorteos/${rifa.id}`)}
            />
          ))}
          {(rifasQ.data ?? []).length === 0 && (
            <p className="empty">No hay rifas en esta campaña. Crea la primera.</p>
          )}
        </div>
      </div>

      {/* Drawer crear/editar */}
      {drawer && (
        <Drawer
          title={drawer.mode === 'create' ? 'Nueva rifa' : 'Editar rifa'}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
          saving={saving}
        >
          <div className="field">
            <label>Premio *</label>
            <input
              value={form.nombre_premio}
              onChange={e => set('nombre_premio', e.target.value)}
              placeholder="ej. iPhone 15 Pro, Viaje a Cancún…"
              autoFocus
            />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              rows={2}
              placeholder="Descripción del premio o condiciones…"
            />
          </div>
          <div className="field">
            <label>Precio por boleto ($) *</label>
            <input
              type="number"
              min="1"
              value={form.precio_boleto}
              onChange={e => set('precio_boleto', e.target.value)}
              placeholder="ej. 100"
            />
          </div>

          {drawer.mode === 'create' && (
            <div className="field">
              <label>Cantidad de boletos *</label>
              <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.4rem', flexWrap: 'wrap' }}>
                {CUPOS_COMUNES.map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`btn btn-sm ${Number(form.cantidad_boletos) === n ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => set('cantidad_boletos', n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="2"
                max="10000"
                value={form.cantidad_boletos}
                onChange={e => set('cantidad_boletos', e.target.value)}
                placeholder="o ingresa un número personalizado"
              />
              <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
                {`Números: ${String(1).padStart(String(Number(form.cantidad_boletos)).length, '0')} – ${form.cantidad_boletos}`}
              </div>
            </div>
          )}

          <div className="field">
            <label>Fecha del sorteo</label>
            <input
              type="date"
              value={form.fecha_sorteo}
              onChange={e => set('fecha_sorteo', e.target.value)}
            />
          </div>
          <div className="field">
            <label>Horas para expirar apartados</label>
            <input
              type="number"
              min="1"
              value={form.horas_expiracion}
              onChange={e => set('horas_expiracion', e.target.value)}
            />
            <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.2rem' }}>
              Si no se abona en este tiempo, el boleto se marca como Vencido.
            </div>
          </div>
          {drawer.mode === 'edit' && (
            <div className="field">
              <label>Estatus</label>
              <select value={form.estatus} onChange={e => set('estatus', e.target.value)}>
                {ESTATUS_RIFA.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {drawer.mode === 'create' && form.precio_boleto && form.cantidad_boletos && (
            <div className="info-box" style={{ marginTop: '.75rem' }}>
              Meta total: <strong>{fmt(Number(form.precio_boleto) * Number(form.cantidad_boletos))}</strong>
            </div>
          )}
        </Drawer>
      )}

      {confirm && (
        <ConfirmModal
          message="¿Eliminar esta rifa? Se eliminarán todos sus boletos e historial de pagos. Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          loading={saving}
        />
      )}

      {errModal && <ErrorModal {...errModal} onClose={() => setErrModal(null)} />}
    </>
  )
}

function RifaCard({ rifa, onEdit, onDelete, onClick }) {
  const r   = rifa.resumen ?? { total: 0, disponible: 0, apartado: 0, liquidado: 0, recaudado: 0 }
  const meta = Number(rifa.precio_boleto) * rifa.cantidad_boletos
  const pct  = r.total > 0 ? Math.round((r.liquidado / r.total) * 100) : 0

  const estatusBadgeClass = {
    Activa:      'badge-liquidado',
    Finalizada:  'badge-abonado',
    Cancelada:   'badge-deuda',
  }[rifa.estatus] ?? 'badge-abonado'

  return (
    <div className="card card-link" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">
            <Trophy size={15} style={{ marginRight: '.3rem', color: 'var(--abonado)', flexShrink: 0 }} />
            {rifa.nombre_premio}
          </div>
          {rifa.descripcion && (
            <div className="card-sub" style={{ marginTop: '.1rem' }}>{rifa.descripcion}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '.35rem', flexShrink: 0 }}>
          {onEdit && (
            <button className="btn btn-icon" onClick={e => onEdit(rifa, e)} title="Editar">
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button className="btn btn-icon btn-danger-icon" onClick={e => { e.stopPropagation(); onDelete(rifa.id) }} title="Eliminar">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', fontSize: '.8rem', color: 'var(--text-muted)', margin: '.6rem 0 .5rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.2rem' }}>
          <DollarSign size={11} /> {fmt(rifa.precio_boleto)} / boleto
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.2rem' }}>
          <Hash size={11} /> {rifa.cantidad_boletos} números
        </span>
        {rifa.fecha_sorteo && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '.2rem' }}>
            <Calendar size={11} /> {fmtDate(rifa.fecha_sorteo)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '.6rem', fontSize: '.78rem', margin: '.3rem 0 .5rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Libre: {r.disponible}</span>
        <span style={{ color: 'var(--abonado)' }}>Apart: {r.apartado}</span>
        <span style={{ color: 'var(--liquidado)' }}>Pagado: {r.liquidado}</span>
      </div>

      <ProgressBar value={r.recaudado} max={meta} />

      <div style={{ marginTop: '.65rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className={`badge ${estatusBadgeClass}`} style={{ fontSize: '.72rem' }}>
          {rifa.estatus}
        </span>
        <span style={{ fontSize: '.8rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '.2rem' }}>
          Ver cuadrícula <ArrowRight size={13} />
        </span>
      </div>
    </div>
  )
}
