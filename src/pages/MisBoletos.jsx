import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Ticket, Search, Phone, CheckCircle2, Clock, AlertCircle, Share2, Copy, Trophy } from 'lucide-react'
import { fmt, fmtNum, fmtDate, normalizePhone } from '../lib/formatters.js'
import { getMisBoletos } from '../lib/rifas-queries.js'
import ProgressBar from '../components/ProgressBar.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

export default function MisBoletos() {
  const [searchParams] = useSearchParams()
  const [telefono,  setTelefono]  = useState(() => { const t = searchParams.get('tel') ?? ''; return normalizePhone(t) || t })
  const [buscado,   setBuscado]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error,     setError]     = useState(null)
  const [copied,    setCopied]    = useState(false)

  // Auto-buscar si llega con ?tel= en la URL
  useEffect(() => {
    const tel = searchParams.get('tel')
    if (tel) {
      const norm = normalizePhone(tel) || tel
      setTelefono(norm)
      buscar(norm)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function buscar(tel) {
    if (!tel?.trim()) return
    setLoading(true); setError(null); setBuscado(false)
    try {
      const r = await getMisBoletos(tel.trim())
      setResultado(r)
      setBuscado(true)
    } catch {
      setError('Ocurrió un error al buscar. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBuscar(e) {
    e.preventDefault()
    await buscar(telefono)
  }

  async function handleCompartir() {
    const norm = normalizePhone(telefono) || telefono.trim()
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const url  = `${window.location.origin}${base}/mis-boletos?tel=${encodeURIComponent(norm)}`
    if (navigator.share) {
      await navigator.share({ title: 'Mis boletos', text: 'Consulta tus boletos:', url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // Agrupar boletos por rifa
  const boletosPorRifa = resultado?.boletos
    ? resultado.boletos.reduce((acc, b) => {
        const key = b.rifa?.id ?? 'sin-rifa'
        if (!acc[key]) acc[key] = { rifa: b.rifa, boletos: [] }
        acc[key].boletos.push(b)
        return acc
      }, {})
    : {}

  return (
    <div className="mis-boletos-page">
      {/* Cabecera pública */}
      <header className="mis-boletos-header">
        <div className="mis-boletos-brand">
          <Ticket size={24} />
          <span>Mis Boletos</span>
        </div>
        <Link to="/" className="mis-boletos-admin-link">Panel admin →</Link>
      </header>

      <main className="mis-boletos-main">
        <div className="mis-boletos-card">
          <h1 className="mis-boletos-title">Consulta tus boletos</h1>
          <p className="mis-boletos-sub">Ingresa tu número de WhatsApp para ver el estatus de tus boletos.</p>

          <form onSubmit={handleBuscar} className="mis-boletos-form">
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: '.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                type="tel"
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="ej. 6671234567"
                style={{ paddingLeft: '2.6rem' }}
                maxLength={15}
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading || !telefono.trim()}>
              {loading ? 'Buscando…' : <><Search size={15} /> Consultar</>}
            </button>
          </form>

          {error && (
            <div className="mis-boletos-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Sin resultados */}
          {buscado && !loading && !resultado?.participante && !error && (
            <div className="mis-boletos-empty">
              <Ticket size={36} style={{ opacity: .4 }} />
              <p>No encontramos boletos registrados para el número <strong>{telefono}</strong>.</p>
              <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
                Verifica que ingresaste el número correcto o contacta al organizador.
              </p>
            </div>
          )}

          {/* Resultados */}
          {buscado && resultado?.participante && (
            <div className="mis-boletos-resultados">
              <div className="mis-boletos-bienvenida">
                <CheckCircle2 size={18} style={{ color: 'var(--liquidado)' }} />
                <span>¡Hola, <strong>{resultado.participante.nombre_completo}</strong>!</span>
                <button
                  onClick={handleCompartir}
                  title={copied ? '¡Enlace copiado!' : 'Compartir mi enlace'}
                  style={{
                    marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                    background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    padding: '.25rem .6rem', cursor: 'pointer', fontSize: '.78rem',
                    color: copied ? 'var(--liquidado)' : 'var(--accent-light)',
                    transition: 'color .2s',
                  }}
                >
                  {copied ? <Copy size={13} /> : <Share2 size={13} />}
                  {copied ? '¡Copiado!' : 'Compartir'}
                </button>
              </div>

              {resultado.boletos.length === 0 ? (
                <p style={{ fontSize: '.9rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                  No tienes boletos activos en este momento.
                </p>
              ) : (
                Object.values(boletosPorRifa).map(({ rifa, boletos }) => (
                  <RifaGroup key={rifa?.id ?? 'sin-rifa'} rifa={rifa} boletos={boletos} />
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function RifaGroup({ rifa, boletos }) {
  const total      = rifa?.cantidad_boletos ?? 100
  const precio     = Number(rifa?.precio_boleto ?? 0)
  const totalDebo  = boletos.reduce((s, b) => s + Math.max(0, Number(b.saldo_pendiente)), 0)
  const totalAbonado = boletos.reduce((s, b) => s + Number(b.total_pagado), 0)
  const meta       = precio * boletos.length

  return (
    <div className="rifa-group">
      <div className="rifa-group-header">
        <div>
          <div className="rifa-group-title">{rifa?.nombre_premio ?? 'Rifa'}</div>
          {rifa?.fecha_sorteo && (
            <div className="rifa-group-sub">
              <Clock size={12} /> Sorteo: {fmtDate(rifa.fecha_sorteo)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', fontSize: '.82rem' }}>
          <div style={{ color: 'var(--liquidado)', fontWeight: 600 }}>{fmt(totalAbonado)}</div>
          <div style={{ color: 'var(--text-muted)' }}>de {fmt(meta)}</div>
        </div>
      </div>

      {meta > 0 && <ProgressBar value={totalAbonado} max={meta} />}

      <div className="mis-boletos-grid">
        {boletos.map(b => <BoletoMini key={b.id} boleto={b} total={total} />)}
      </div>

      {totalDebo > 0 && (
        <div className="mis-boletos-deuda-total">
          <AlertCircle size={14} />
          Saldo pendiente total: <strong style={{ color: 'var(--abonado)' }}>{fmt(totalDebo)}</strong>
        </div>
      )}
    </div>
  )
}

function BoletoMini({ boleto, total }) {
  const saldo     = Number(boleto.saldo_pendiente)
  const ganador   = boleto.es_ganador
  const posicion  = boleto.posicion_ganador
  const medalles  = ['🥇', '🥈', '🥉']
  const medalla   = posicion && posicion <= 3 ? medalles[posicion - 1] : `#${posicion}`

  return (
    <div className={`boleto-mini boleto-mini-${boleto.estatus.toLowerCase()}${ganador ? ' boleto-mini-ganador' : ''}`}>
      {ganador && (
        <div className="boleto-mini-ganador-banner">
          <Trophy size={12} /> ¡GANADOR!
        </div>
      )}
      <div className="boleto-mini-num">
        {ganador && <span className="boleto-mini-medalla">{medalla}</span>}
        #{fmtNum(boleto.numero_asignado, total)}
      </div>
      <StatusBadge status={boleto.estatus} style={{ fontSize: '.68rem' }} />
      <div className="boleto-mini-pagos">
        <span>Pagado: <strong>{fmt(boleto.total_pagado)}</strong></span>
        {saldo > 0 && <span style={{ color: 'var(--abonado)' }}>Falta: <strong>{fmt(saldo)}</strong></span>}
        {saldo <= 0 && boleto.estatus !== 'Vencido' && <span style={{ color: 'var(--liquidado)' }}>✓ Pagado</span>}
      </div>
      {boleto.pagos?.length > 0 && (
        <details className="boleto-mini-historial">
          <summary>
            Ver historial ({boleto.pagos.length})
          </summary>
          <div className="boleto-mini-historial-list">
            {boleto.pagos.map((p, i) => (
              <div key={i} className="boleto-mini-pago-row">
                <span className="boleto-mini-pago-monto">{fmt(p.monto)}</span>
                <span className="boleto-mini-pago-meta">{fmtDate(p.fecha)} · {p.metodo_pago}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
