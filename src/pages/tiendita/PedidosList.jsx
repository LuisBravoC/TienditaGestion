import { ShoppingCart } from 'lucide-react'
import Breadcrumbs from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../../lib/useBreadcrumbs.js'

export default function PedidosList() {
  const crumbs = useBreadcrumbs()
  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><ShoppingCart size={22} /> Pedidos de Compra</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ opacity: .25, marginBottom: '1rem' }}><ShoppingCart size={48} /></div>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>Pedidos de Compra</p>
          <p style={{ fontSize: '.875rem', marginTop: '.4rem', maxWidth: '400px', margin: '.4rem auto 0' }}>
            Registro de órdenes a proveedores (Aliexpress, Amazon, Temu…), número de guía, cálculo de costo real con prorrateo de envío y actualización automática de stock al recibir.
          </p>
          <span style={{ display: 'inline-block', marginTop: '1rem', padding: '.25rem .75rem', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '999px', fontSize: '.75rem', fontWeight: 600 }}>Fase 2</span>
        </div>
      </div>
    </>
  )
}
