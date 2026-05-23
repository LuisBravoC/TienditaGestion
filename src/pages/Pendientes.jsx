import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, LayoutGrid, ChevronDown } from 'lucide-react'
import { useQuery } from '../lib/useQuery.js'
import { fmt, fmtNum, fmtDate } from '../lib/formatters.js'
import { getPendientes, getCampanas, getRifasByCampana, getGrupos } from '../lib/rifas-queries.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import LoadingSpinner, { ErrorMsg } from '../components/LoadingSpinner.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import WhatsAppBtn from '../components/WhatsAppBtn.jsx'
import GrupoBadge from '../components/GrupoBadge.jsx'

export default function Pendientes() {
  const [campanaId, setCampanaId] = useState('')
  const [rifaId,    setRifaId]    = useState('')
  const [estatus,   setEstatus]   = useState('')
  const [grupoId,   setGrupoId]   = useState('')
  const [openMap,   setOpenMap]   = useState({})  // rifaId → boolean

  const toggleGrupo = (id) => setOpenMap(m => ({ ...m, [id]: !m[id] }))

  const campanasQ = useQuery(() => getCampanas(), [])
  const gruposQ   = useQuery(() => getGrupos(), [])
  const rifasQ    = useQuery(
    () => campanaId ? getRifasByCampana(campanaId) : Promise.resolve([]),
    [campanaId]
  )
  const pendQ = useQuery(
    () => getPendientes({ campanaId: campanaId || null, rifaId: rifaId || null, estatus: estatus || null }),
    [campanaId, rifaId, estatus]
  )

  const crumbs = [{ label: 'Pendientes de pago' }]
  const pendientes = useMemo(() => {
    const raw = pendQ.data ?? []
    if (!grupoId) return raw
    return raw.filter(b => b.grupo_id === grupoId)
  }, [pendQ.data, grupoId])

  const { totalSaldo, totalAbonado } = useMemo(() => ({
    totalSaldo:   pendientes.reduce((s, b) => s + Number(b.saldo_pendiente), 0),
    totalAbonado: pendientes.reduce((s, b) => s + Number(b.total_pagado),    0),
  }), [pendientes])

  const agrupados = useMemo(() => {
    if (rifaId) return null
    const map = new Map()
    for (const b of pendientes) {
      if (!map.has(b.rifa_id)) map.set(b.rifa_id, {
        rifaId: b.rifa_id, campanaId: b.campana_id, nombre: b.nombre_premio,
        boletos: [], saldo: 0, abonado: 0, apartado: 0, vencido: 0,
      })
      const g = map.get(b.rifa_id)
      g.boletos.push(b)
      g.saldo   += Number(b.saldo_pendiente)
      g.abonado += Number(b.total_pagado)
      if (b.estatus === 'Apartado') g.apartado++
      else if (b.estatus === 'Vencido') g.vencido++
    }
    return [...map.values()]
  }, [pendientes, rifaId])

  function handleCampana(e) { setCampanaId(e.target.value); setRifaId('') }

  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title"><AlertCircle size={20} /> Pendientes de pago</h1>
        </div>

        {/* ── Filtros ── */}
        <div style={{ display: 'flex', gap: '.6rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={campanaId} onChange={handleCampana} style={selectStyle}>
            <option value="">Todas las campañas</option>
            {(campanasQ.data ?? []).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          {campanaId && (
            <select value={rifaId} onChange={e => setRifaId(e.target.value)} style={selectStyle}>
              <option value="">Todas las rifas</option>
              {(rifasQ.data ?? []).map(r => <option key={r.id} value={r.id}>{r.nombre_premio}</option>)}
            </select>
          )}

          {(gruposQ.data ?? []).length > 0 && (
            <select value={grupoId} onChange={e => setGrupoId(e.target.value)} style={selectStyle}>
              <option value="">Todos los grupos</option>
              {(gruposQ.data ?? []).map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          )}

          <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap' }}>
            {[['', 'Todos'], ['Apartado', '🟡 Apartado'], ['Vencido', '🔴 Vencido']].map(([val, label]) => (
              <button key={val} className={`btn btn-sm ${estatus === val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setEstatus(val)}>
                {label}
              </button>
            ))}
          </div>

          {!pendQ.loading && pendientes.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '.85rem', color: 'var(--text-muted)' }}>
              <span><strong style={{ color: 'var(--text)' }}>{pendientes.length}</strong> boletos</span>
              <span>Abonado: <strong style={{ color: 'var(--liquidado)' }}>{fmt(totalAbonado)}</strong></span>
              <span>Por cobrar: <strong style={{ color: 'var(--abonado)' }}>{fmt(totalSaldo)}</strong></span>
            </div>
          )}
        </div>

        {/* ── Contenido con fade suave en re-fetch ── */}
        <style>{`
          @keyframes pendientes-appear {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div style={{ opacity: pendQ.loading && pendQ.data ? 0.55 : 1, transition: 'opacity .22s ease' }}>
          {pendQ.loading && !pendQ.data ? (
            <LoadingSpinner text="Cargando pendientes…" />
          ) : pendQ.error ? (
            <ErrorMsg message={pendQ.error} />
          ) : pendientes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>Sin boletos pendientes de pago.</p>
          ) : (
            <div
              key={`${campanaId}|${rifaId}|${estatus}|${grupoId}`}
              style={{ animation: 'pendientes-appear .22s ease both' }}
            >
              {rifaId ? (
                <PendientesList boletos={pendientes} />
              ) : (
                (agrupados ?? []).map(grupo => <GrupoRifa key={grupo.rifaId} grupo={grupo} open={openMap[grupo.rifaId] ?? false} onToggle={() => toggleGrupo(grupo.rifaId)} />)
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Grupo colapsable por rifa ─────────────────────────────────────────────────
function GrupoRifa({ grupo, open, onToggle }) {
  const pctVencido = grupo.boletos.length > 0 ? Math.round(grupo.vencido / grupo.boletos.length * 100) : 0

  return (
    <div style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

      {/* Cabecera */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', gap: '.75rem',
          padding: '.85rem 1rem', background: 'var(--bg-muted, var(--card-bg, var(--bg)))',
          border: 'none', borderBottom: open ? '1px solid var(--border)' : 'none',
          cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap',
        }}
      >
        {/* Icono + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flex: '1 1 10rem', minWidth: 0 }}>
          <LayoutGrid size={15} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '.95rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {grupo.nombre}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.1rem', display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              <span><strong style={{ color: 'var(--text)' }}>{grupo.boletos.length}</strong> boleto{grupo.boletos.length !== 1 ? 's' : ''}</span>
              {grupo.apartado > 0 && <span style={{ color: 'var(--abonado)' }}>🟡 {grupo.apartado}</span>}
              {grupo.vencido  > 0 && <span style={{ color: 'var(--deuda)' }}>🔴 {grupo.vencido}</span>}
            </div>
          </div>
        </div>

        {/* Métricas + link + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>Abonado</div>
            <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--liquidado)' }}>{fmt(grupo.abonado)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>Por cobrar</div>
            <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--abonado)' }}>{fmt(grupo.saldo)}</div>
          </div>
          {pctVencido > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>Vencidos</div>
              <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--deuda)' }}>{pctVencido}%</div>
            </div>
          )}
          <Link
            to={`/rifas/${grupo.campanaId}/sorteos/${grupo.rifaId}`}
            onClick={e => e.stopPropagation()}
            style={{ fontSize: '.75rem', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '.15rem', textDecoration: 'none', flexShrink: 0 }}
          >
            Ver rifa <ArrowRight size={11} />
          </Link>
          <ChevronDown
            size={16}
            style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }}
          />
        </div>
      </button>

      {/* Contenido con animación grid-template-rows */}
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .28s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <PendientesList boletos={grupo.boletos} />
        </div>
      </div>
    </div>
  )
}

// ── Lista de boletos — tabla en escritorio, tarjetas en móvil ────────────────
function PendientesList({ boletos }) {
  return (
    <>
      <style>{`
        .pendientes-table { width:100%; border-collapse:collapse; font-size:.875rem; }
        .pendientes-table th { padding:.6rem .9rem; text-align:left; font-weight:600; font-size:.78rem; color:var(--text-muted); white-space:nowrap; background:var(--bg-muted,var(--bg)); border-bottom:1px solid var(--border); }
        .pendientes-table td { padding:.55rem .9rem; border-bottom:1px solid var(--border); }
        .pendientes-cards { display:none; }
        @media (max-width: 640px) {
          .pendientes-table { display:none; }
          .pendientes-cards { display:block; }
        }
      `}</style>

      {/* ── Tabla (escritorio) ── */}
      <table className="pendientes-table">
        <thead>
          <tr>
            {['Boleto','Participante','Grupo','Estatus','Apartado','Abonado','Saldo',''].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {boletos.map(b => (
            <tr key={b.id}>
              <td style={{ fontVariantNumeric:'tabular-nums', fontWeight:600 }}>
                <Link to={`/rifas/${b.campana_id}/sorteos/${b.rifa_id}`} style={{ color:'var(--accent-light)', textDecoration:'none' }}>
                  #{fmtNum(b.numero_asignado, b.cantidad_boletos)}
                </Link>
              </td>
              <td>
                {b.participante_id ? (
                  <Link to={`/participantes/${b.participante_id}`} style={{ color:'inherit', display:'inline-flex', alignItems:'center', gap:'.2rem', textDecoration:'none' }}>
                    {b.nombre_completo ?? '—'} <ArrowRight size={11} />
                  </Link>
                ) : (b.nombre_completo ?? '—')}
              </td>
              <td>
                {b.grupo_nombre && <GrupoBadge grupo={{ nombre: b.grupo_nombre, color: b.grupo_color }} />}
              </td>
              <td><StatusBadge status={b.estatus} style={{ fontSize:'.72rem' }} /></td>
              <td style={{ color:'var(--text-muted)', fontSize:'.8rem', whiteSpace:'nowrap' }}>{fmtDate(b.fecha_apartado)}</td>
              <td style={{ color:'var(--liquidado)', fontWeight:500, textAlign:'right', whiteSpace:'nowrap' }}>{fmt(b.total_pagado)}</td>
              <td style={{ color:'var(--abonado)', fontWeight:600, textAlign:'right', whiteSpace:'nowrap' }}>{fmt(b.saldo_pendiente)}</td>
              <td style={{ textAlign:'right' }}>
                {b.telefono_whatsapp && <WhatsAppBtn nombre={b.nombre_completo} telefono={b.telefono_whatsapp} saldo={b.saldo_pendiente} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Tarjetas (móvil) ── */}
      <div className="pendientes-cards">
        {boletos.map(b => (
          <div key={b.id} style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'.3rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
              <Link to={`/rifas/${b.campana_id}/sorteos/${b.rifa_id}`} style={{ fontWeight:700, color:'var(--accent-light)', textDecoration:'none', fontVariantNumeric:'tabular-nums', flexShrink:0 }}>
                #{fmtNum(b.numero_asignado, b.cantidad_boletos)}
              </Link>
              <StatusBadge status={b.estatus} style={{ fontSize:'.68rem' }} />
              {b.grupo_nombre && <GrupoBadge grupo={{ nombre: b.grupo_nombre, color: b.grupo_color }} />}
              <span style={{ marginLeft:'auto', fontWeight:700, color:'var(--abonado)', flexShrink:0 }}>{fmt(b.saldo_pendiente)}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
              {b.participante_id ? (
                <Link to={`/participantes/${b.participante_id}`} style={{ color:'var(--text)', flex:1, display:'inline-flex', alignItems:'center', gap:'.2rem', textDecoration:'none', minWidth:0 }}>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.nombre_completo ?? '—'}</span>
                  <ArrowRight size={11} style={{ color:'var(--accent-light)', flexShrink:0 }} />
                </Link>
              ) : <span style={{ flex:1 }}>{b.nombre_completo ?? '—'}</span>}
              {b.telefono_whatsapp && <WhatsAppBtn nombre={b.nombre_completo} telefono={b.telefono_whatsapp} saldo={b.saldo_pendiente} />}
            </div>
            <div style={{ display:'flex', gap:'1rem', fontSize:'.76rem', color:'var(--text-muted)', flexWrap:'wrap' }}>
              <span>Apartado: {fmtDate(b.fecha_apartado)}</span>
              {Number(b.total_pagado) > 0 && <span>Abonado: <strong style={{ color:'var(--liquidado)' }}>{fmt(b.total_pagado)}</strong></span>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

const selectStyle = {
  minWidth: '12rem', height: '2.2rem',
  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)',
  padding: '0 .75rem', fontSize: '.875rem',
}
