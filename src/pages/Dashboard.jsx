import { Link } from 'react-router-dom'
import { Ticket, ArrowRight, Activity, TrendingUp, Target, CreditCard, CalendarDays, Users, PieChart as PieIcon, Trophy } from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '../lib/useQuery.js'
import { getCampanasConResumen, getRecaudacionPorDia, getRecaudacionVsMeta, getRecaudacionPorMetodoPago, getApartadosPorDia, getNuevosParticipantesPorDia, getBoletosPorGrupo, getTop5ParticipantesPorBoletos } from '../lib/rifas-queries.js'
import { fmt } from '../lib/formatters.js'
import ProgressBar from '../components/ProgressBar.jsx'
import LoadingSpinner, { ErrorMsg } from '../components/LoadingSpinner.jsx'
import ChartRecaudacionMes from '../components/ChartRecaudacionMes.jsx'
import ChartRecaudacionVsMeta from '../components/ChartRecaudacionVsMeta.jsx'
import ChartRecaudacionPorMetodo from '../components/ChartRecaudacionPorMetodo.jsx'
import ChartApartadosPorDia from '../components/ChartApartadosPorDia.jsx'
import ChartNuevosParticipantes from '../components/ChartNuevosParticipantes.jsx'
import ChartGrupoSocial from '../components/ChartGrupoSocial.jsx'
import ChartTop5Participantes from '../components/ChartTop5Participantes.jsx'

const PERIODOS = [
  { id: '7d',  label: '7 días' },
  { id: 'sem', label: 'Esta semana' },
  { id: '30d', label: '30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: '90d', label: '90 días' },
]

function getRange(periodoId) {
  const hoy = new Date()
  const hasta = new Date(hoy); hasta.setHours(23, 59, 59, 999)
  let desde = new Date(hoy)
  if (periodoId === '7d') { desde.setDate(hoy.getDate() - 6) }
  else if (periodoId === 'sem') { const dow = hoy.getDay(); desde.setDate(hoy.getDate() - (dow === 0 ? 6 : dow - 1)) }
  else if (periodoId === '30d') { desde.setDate(hoy.getDate() - 29) }
  else if (periodoId === 'mes') { desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1) }
  else if (periodoId === '90d') { desde.setDate(hoy.getDate() - 89) }
  desde.setHours(0, 0, 0, 0)
  return { desde, hasta }
}

function PeriodoSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
      {PERIODOS.map(p => (
        <button key={p.id} onClick={() => onChange(p.id)} style={{
          padding: '.3rem .65rem', borderRadius: '.4rem', border: 'none', cursor: 'pointer',
          background: value === p.id ? 'var(--accent-light)' : 'var(--bg-secondary)',
          color: value === p.id ? 'var(--bg)' : 'var(--text-muted)',
          fontSize: '.78rem', fontWeight: value === p.id ? '600' : '400',
          transition: 'all .15s',
        }}>{p.label}</button>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('sem')
  const [openCharts, setOpenCharts] = useState(new Set())
  const range = useMemo(() => getRange(periodo), [periodo])

  function toggleChart(id) {
    setOpenCharts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const campanasQ = useQuery(() => getCampanasConResumen(), [])
  const recaudacionDiaQ = useQuery(() => getRecaudacionPorDia(range), [range])
  const recaudacionPorMetodoQ = useQuery(() => getRecaudacionPorMetodoPago(), [])
  const grupoSocialQ          = useQuery(() => getBoletosPorGrupo(), [])
  const top5Q                 = useQuery(() => getTop5ParticipantesPorBoletos(), [])
  const apartadosDiaQ = useQuery(() => getApartadosPorDia(range), [range])
  const participantesDiaQ = useQuery(() => getNuevosParticipantesPorDia(range), [range])

  const primeraCampanaId = campanasQ.data?.[0]?.id
  const recaudacionVsMetaQ = useQuery(
    () => primeraCampanaId ? getRecaudacionVsMeta(primeraCampanaId) : Promise.resolve([]),
    [primeraCampanaId]
  )

  if (campanasQ.loading) return <LoadingSpinner text="Cargando dashboard…" />
  if (campanasQ.error)   return <ErrorMsg message={campanasQ.error} />

  const campanas = campanasQ.data ?? []

  const totalMeta       = campanas.reduce((s, c) => s + (c.resumen?.meta       ?? 0), 0)
  const totalRecaudado  = campanas.reduce((s, c) => s + (c.resumen?.recaudado  ?? 0), 0)
  const totalBoletos    = campanas.reduce((s, c) => s + (c.resumen?.boletos    ?? 0), 0)
  const totalLiquidados = campanas.reduce((s, c) => s + (c.resumen?.liquidados ?? 0), 0)

  return (
    <div className="page">
      <h1 className="page-title"><Activity size={22} /> Dashboard</h1>

      <div className="grid grid-stats" style={{ marginBottom: '2rem' }}>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{campanas.length}</div>
          <div className="stat-label">Campañas</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--liquidado)' }}>{fmt(totalRecaudado)}</div>
          <div className="stat-label">Total recaudado</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--abonado)' }}>{fmt(totalMeta - totalRecaudado)}</div>
          <div className="stat-label">Por recaudar</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--text)' }}>{totalLiquidados} / {totalBoletos}</div>
          <div className="stat-label">Boletos pagados</div>
        </div>
      </div>

      <ProgressBar value={totalRecaudado} max={totalMeta} />

      {/* Gráficas — tabs que togglean secciones en un solo card */}
      <div className="card" style={{ marginTop: '2rem', marginBottom: '2rem', padding: '1rem 1.25rem' }}>
        {/* Fila de controles: tabs + período */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.75rem', marginBottom: openCharts.size > 0 ? '1rem' : 0 }}>
          <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
            {[
              { id: 'recaudacion',   label: 'Recaudación',    Icon: TrendingUp },
              { id: 'apartados',     label: 'Apartados',      Icon: CalendarDays },
              { id: 'participantes', label: 'Participantes',  Icon: Users },
              { id: 'metas',         label: 'Metas',          Icon: Target },
              { id: 'metodos',       label: 'Métodos',        Icon: CreditCard },
              { id: 'grupos',        label: 'Grupos',         Icon: PieIcon },
              { id: 'top5',          label: 'Top 5',          Icon: Trophy },
            ].map(({ id, label, Icon }) => {
              const active = openCharts.has(id)
              return (
                <button key={id} onClick={() => toggleChart(id)} style={{
                  padding: '.4rem .85rem', borderRadius: '.45rem', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '.35rem',
                  background: active ? 'var(--accent-light)' : 'var(--bg-secondary)',
                  color: active ? 'var(--bg)' : 'var(--text)',
                  fontSize: '.82rem', fontWeight: active ? '600' : '500',
                  transition: 'all .15s',
                }}>
                  <Icon size={12} />{label}
                </button>
              )
            })}
          </div>
          {openCharts.size > 0 && <PeriodoSelector value={periodo} onChange={setPeriodo} />}
        </div>

        {/* Secciones colapsadas/expandidas */}
        {(() => {
          const sections = [
            { id: 'recaudacion', title: 'Recaudación por día', chart: <ChartRecaudacionMes data={recaudacionDiaQ.data} loading={recaudacionDiaQ.loading} error={recaudacionDiaQ.error} height={240} xKey="dia" /> },
            { id: 'apartados',   title: 'Boletos apartados por día', chart: <ChartApartadosPorDia data={apartadosDiaQ.data} loading={apartadosDiaQ.loading} error={apartadosDiaQ.error} height={240} /> },
            { id: 'participantes', title: 'Nuevos participantes por día', chart: <ChartNuevosParticipantes data={participantesDiaQ.data} loading={participantesDiaQ.loading} error={participantesDiaQ.error} height={240} /> },
            ...(primeraCampanaId ? [{ id: 'metas', title: 'Recaudado vs Meta', chart: <ChartRecaudacionVsMeta data={recaudacionVsMetaQ.data} loading={recaudacionVsMetaQ.loading} error={recaudacionVsMetaQ.error} height={240} /> }] : []),
            { id: 'metodos', title: 'Recaudación por método de pago', chart: <ChartRecaudacionPorMetodo data={recaudacionPorMetodoQ.data} loading={recaudacionPorMetodoQ.loading} error={recaudacionPorMetodoQ.error} height={240} /> },
            { id: 'grupos',  title: 'Distribución por grupo social', chart: <ChartGrupoSocial data={grupoSocialQ.data} loading={grupoSocialQ.loading} error={grupoSocialQ.error} height={260} /> },
            { id: 'top5',    title: 'Top 5 participantes por boletos', chart: <ChartTop5Participantes data={top5Q.data} loading={top5Q.loading} error={top5Q.error} height={220} /> },
          ]

          return sections.map((s, i) => {
            const isOpen = openCharts.has(s.id)
            const anyPrevOpen = sections.slice(0, i).some(x => openCharts.has(x.id))
            return (
              <ChartSection key={s.id} isOpen={isOpen} title={s.title} showDivider={anyPrevOpen}>
                {s.chart}
              </ChartSection>
            )
          })
        })()}
      </div>

      <p className="section-heading">Campañas</p>
      <div className="grid grid-auto">
        {campanas.map(c => (
          <CampanaCard key={c.id} campana={c} />
        ))}
      </div>
    </div>
  )
}

function ChartSection({ isOpen, title, showDivider, children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 320)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  return (
    <div className={`chart-collapse${isOpen ? ' open' : ''}`}>
      <div className="chart-collapse-inner">
        {showDivider && <div style={{ borderTop: '1px solid var(--border)', margin: '1.25rem 0' }} />}
        <p style={{ fontSize: '.78rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: '.6rem' }}>{title}</p>
        {mounted && children}
        <div style={{ height: '4px' }} />
      </div>
    </div>
  )
}

function CampanaCard({ campana }) {
  const r = campana.resumen ?? { rifas: 0, meta: 0, boletos: 0, liquidados: 0, recaudado: 0 }

  return (
    <Link to={`/rifas/${campana.id}`} className="card card-link">
      <div className="card-header">
        <div>
          <div className="card-title">{campana.nombre}</div>
          <div className="card-sub">{r.rifas} {r.rifas === 1 ? 'rifa' : 'rifas'} · {r.boletos} boletos vendidos</div>
        </div>
        <Ticket size={20} className="card-icon" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--text-muted)', margin: '.5rem 0 .25rem' }}>
        <span>Recaudado: <strong style={{ color: 'var(--liquidado)' }}>{fmt(r.recaudado)}</strong></span>
        <span>Meta: <strong style={{ color: 'var(--abonado)' }}>{fmt(r.meta)}</strong></span>
      </div>
      <ProgressBar value={r.recaudado} max={r.meta} />
      <div style={{ marginTop: '.75rem', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '.8rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '.2rem' }}>
          Ver rifas <ArrowRight size={13} />
        </span>
      </div>
    </Link>
  )
}
