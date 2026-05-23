import { Store, TrendingUp, Package, ShoppingCart, ShoppingBag, AlertTriangle, Clock } from 'lucide-react'
import { useQuery } from '../../lib/useQuery.js'
import { getDashboardTiendita } from '../../lib/tiendita-queries.js'
import { fmt } from '../../lib/formatters.js'
import LoadingSpinner, { ErrorMsg } from '../../components/LoadingSpinner.jsx'

export default function TienditaDashboard() {
  const { data, loading, error } = useQuery(() => getDashboardTiendita(), [])

  if (loading) return <LoadingSpinner text="Cargando dashboard…" />
  if (error)   return <ErrorMsg message={error} />

  const { ventasMes, apartadosPendientes, productosStockBajo, pedidosEnTransito } = data

  return (
    <div className="page">
      <div className="page-title-row">
        <h1 className="page-title" style={{ margin: 0 }}><Store size={22} /> Tiendita</h1>
      </div>

      {/* ── Cards de resumen ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Ventas del mes"
          value={fmt(ventasMes)}
          color="var(--liquidado)"
        />
        <StatCard
          icon={<ShoppingBag size={20} />}
          label="Apartados pendientes"
          value={`${apartadosPendientes.count} (${fmt(apartadosPendientes.monto)})`}
          color="var(--accent)"
          alert={apartadosPendientes.count > 0}
        />
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Stock bajo"
          value={`${productosStockBajo.length} productos`}
          color="var(--deuda)"
          alert={productosStockBajo.length > 0}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Pedidos en tránsito"
          value={pedidosEnTransito}
          color="var(--text-muted)"
        />
      </div>

      {/* ── Productos con stock bajo ── */}
      {productosStockBajo.length > 0 && (
        <section className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
            <AlertTriangle size={16} style={{ color: 'var(--deuda)' }} />
            <strong style={{ fontSize: '.9rem' }}>Productos con stock bajo</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
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

      {/* Placeholder para gráficas — se implementan en Fase 4 */}
      <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
        <ShoppingCart size={40} style={{ opacity: .25, marginBottom: '.75rem' }} />
        <p style={{ fontWeight: 500 }}>Gráficas de ventas — próximamente</p>
        <p style={{ fontSize: '.8rem', marginTop: '.35rem' }}>Se añadirán en la Fase 4 del plan.</p>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, alert = false }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem', color: alert ? color : 'var(--text-muted)', fontSize: '.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}
