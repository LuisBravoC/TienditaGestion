import { useNavigate } from 'react-router-dom'
import {
  Store, TrendingUp, Package, ShoppingBag, AlertTriangle, Clock,
  Plus, ChevronRight, CreditCard, Banknote, Smartphone, CircleDollarSign,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useQuery }   from '../../lib/useQuery.js'
import { getDashboardTiendita, getDashboardCharts, getVentasRecientes } from '../../lib/tiendita-queries.js'
import { fmt, fmtDate } from '../../lib/formatters.js'
import LoadingSpinner, { ErrorMsg } from '../../components/LoadingSpinner.jsx'

// Colores para métodos de pago
const METODO_COLORS = {
  Efectivo:      'var(--liquidado)',
  Transferencia: 'var(--accent)',
  Tarjeta:       '#a78bfa',
  Otro:          'var(--text-muted)',
}
const metodoColor = m => METODO_COLORS[m] ?? 'var(--text-muted)'

const TIPO_LABEL = { directa: 'Directa', apartado: 'Apartado' }

const tooltipStyle = {
  contentStyle: { background: 'rgba(15,23,42,.93)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.08)', borderRadius: '.5rem', fontSize: '.82rem', padding: '.5rem .75rem' },
  labelStyle: { color: '#94a3b8', marginBottom: '.2rem', fontSize: '.75rem' },
  itemStyle: { color: '#f1f5f9' },
  cursor: { fill: 'rgba(255,255,255,.04)' },
}

export default function TienditaDashboard() {
  const navigate = useNavigate()
  const stats    = useQuery(() => getDashboardTiendita(), [])
  const charts   = useQuery(() => getDashboardCharts(),   [])
  const recientes = useQuery(() => getVentasRecientes(5), [])

  if (stats.loading) return <LoadingSpinner text="Cargando dashboard…" />
  if (stats.error)   return <ErrorMsg message={stats.error} />

  const { ventasMes, apartadosPendientes, productosStockBajo, pedidosEnTransito } = stats.data

  return (
    <div className="page">
      <div className="page-title-row">
        <h1 className="page-title" style={{ margin: 0 }}><Store size={22} /> Tiendita</h1>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard icon={<TrendingUp size={20} />} label="Ventas del mes"        value={fmt(ventasMes)}                                          color="var(--liquidado)" />
        <StatCard icon={<ShoppingBag size={20} />} label="Apartados pendientes" value={`${apartadosPendientes.count} (${fmt(apartadosPendientes.monto)})`} color="var(--accent)" alert={apartadosPendientes.count > 0} />
        <StatCard icon={<AlertTriangle size={20} />} label="Stock bajo"         value={`${productosStockBajo.length} productos`}                color="var(--deuda)" alert={productosStockBajo.length > 0} />
        <StatCard icon={<Clock size={20} />} label="Pedidos en tránsito"        value={pedidosEnTransito}                                       color="var(--text-muted)" />
      </div>

      {/* ── Accesos rápidos ── */}
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <QuickBtn label="Nueva venta"   icon={<Plus size={14} />}   onClick={() => navigate('/ventas')}   primary />
        <QuickBtn label="Nuevo pedido"  icon={<Plus size={14} />}   onClick={() => navigate('/pedidos')}  />
        <QuickBtn label="Productos"     icon={<Package size={14} />} onClick={() => navigate('/productos')} />
        <QuickBtn label="Clientes"      icon={<ShoppingBag size={14} />} onClick={() => navigate('/clientes')} />
      </div>

      {/* ── Alerta stock bajo ── */}
      {productosStockBajo.length > 0 && (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
            <AlertTriangle size={16} style={{ color: 'var(--deuda)' }} />
            <strong style={{ fontSize: '.9rem' }}>Productos con stock bajo</strong>
            <button className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }} onClick={() => navigate('/productos')}>
              Ver todos <ChevronRight size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
            {productosStockBajo.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.875rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                  <Package size={14} style={{ color: 'var(--text-muted)' }} /> {p.nombre}
                </span>
                <span style={{ fontWeight: 600, color: p.stock_actual <= 0 ? 'var(--deuda)' : 'var(--accent)' }}>
                  {p.stock_actual <= 0 ? 'Sin stock' : `${p.stock_actual} uds`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Gráficas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

        {/* Ventas del mes por día */}
        <section className="card">
          <p style={{ fontWeight: 600, fontSize: '.875rem', marginBottom: '.75rem' }}>Ventas por día — mes actual</p>
          {charts.loading ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>Cargando…</div>
          ) : !charts.data?.ventasDia?.length ? (
            <EmptyChart label="Sin ventas este mes" />
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={charts.data.ventasDia} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="dia" stroke="var(--text-muted)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={v => [fmt(v), 'Ventas']} labelFormatter={d => `Día ${d}`} />
                  <Bar dataKey="total" fill="var(--liquidado)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Top 5 productos */}
        <section className="card">
          <p style={{ fontWeight: 600, fontSize: '.875rem', marginBottom: '.75rem' }}>Top 5 productos vendidos</p>
          {charts.loading ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>Cargando…</div>
          ) : !charts.data?.topProductos?.length ? (
            <EmptyChart label="Sin ventas registradas" />
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={charts.data.topProductos} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" width={90} stroke="var(--text-muted)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={n => n.length > 14 ? n.slice(0, 13) + '…' : n}
                  />
                  <Tooltip {...tooltipStyle} formatter={v => [v, 'Unidades']} />
                  <Bar dataKey="cantidad" fill="var(--accent)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Método de pago */}
        <section className="card">
          <p style={{ fontWeight: 600, fontSize: '.875rem', marginBottom: '.75rem' }}>
            <CreditCard size={14} style={{ verticalAlign: 'middle', marginRight: '.35rem' }} />
            Método de pago — mes actual
          </p>
          {charts.loading ? (
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>Cargando…</div>
          ) : !charts.data?.metodoPago?.length ? (
            <EmptyChart label="Sin ventas este mes" height={120} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem', marginTop: '.25rem' }}>
              {charts.data.metodoPago.map(({ metodo, total }) => {
                const max = charts.data.metodoPago[0].total
                const pct = Math.round((total / max) * 100)
                return (
                  <div key={metodo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', marginBottom: '.2rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                        <MetodoIcon metodo={metodo} /> {metodo}
                      </span>
                      <span style={{ fontWeight: 600 }}>{fmt(total)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: metodoColor(metodo), transition: 'width .4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Últimas ventas ── */}
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
          <strong style={{ fontSize: '.9rem' }}>Últimas ventas</strong>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/ventas')}>
            Ver todas <ChevronRight size={13} />
          </button>
        </div>
        {recientes.loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem', fontSize: '.82rem' }}>Cargando…</div>
        ) : !recientes.data?.length ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem', fontSize: '.82rem' }}>Sin ventas registradas.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recientes.data.map((v, i) => (
              <div
                key={v.id}
                onClick={() => navigate('/ventas')}
                style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.55rem .25rem', borderBottom: i < recientes.data.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: '.875rem' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nombre_cliente ?? '—'}</div>
                  <div style={{ fontSize: '.77rem', color: 'var(--text-muted)', marginTop: '.1rem' }}>{fmtDate(v.fecha_venta)} · {TIPO_LABEL[v.tipo] ?? v.tipo}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--liquidado)' }}>{fmt(v.precio_total)}</div>
                  {v.saldo_pendiente > 0 && (
                    <div style={{ fontSize: '.75rem', color: 'var(--deuda)' }}>−{fmt(v.saldo_pendiente)} pendiente</div>
                  )}
                </div>
                <span style={{
                  display: 'inline-block', padding: '.1rem .45rem', borderRadius: 999,
                  fontSize: '.7rem', fontWeight: 600, flexShrink: 0,
                  background: v.estado_entrega === 'entregado' ? 'rgba(34,197,94,.12)' : 'rgba(250,176,5,.12)',
                  color:      v.estado_entrega === 'entregado' ? 'var(--liquidado)' : '#f59e0b',
                }}>
                  {v.estado_entrega === 'entregado' ? 'Entregado' : 'Pendiente'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ icon, label, value, color, alert = false }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem', color: alert ? color : 'var(--text-muted)', fontSize: '.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function QuickBtn({ label, icon, onClick, primary = false }) {
  return (
    <button
      className={`btn ${primary ? 'btn-primary' : 'btn-outline'} btn-sm`}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}
    >
      {icon} {label}
    </button>
  )
}

function EmptyChart({ label = 'Sin datos', height = 200 }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '.82rem' }}>
      {label}
    </div>
  )
}

function MetodoIcon({ metodo }) {
  const s = { size: 13, style: { color: metodoColor(metodo), flexShrink: 0 } }
  if (metodo === 'Efectivo')      return <Banknote        {...s} />
  if (metodo === 'Transferencia') return <Smartphone      {...s} />
  if (metodo === 'Tarjeta')       return <CreditCard      {...s} />
  return                                 <CircleDollarSign {...s} />
}

