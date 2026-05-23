import { Package } from 'lucide-react'
import { useParams } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../../lib/useBreadcrumbs.js'

export default function ProductoDetail() {
  const { productoId } = useParams()
  const crumbs = useBreadcrumbs({ productoId: 'Producto' })
  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><Package size={22} /> Detalle de Producto</h1>
        </div>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ opacity: .25, marginBottom: '1rem' }}><Package size={48} /></div>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>Ficha de Producto</p>
          <p style={{ fontSize: '.875rem', marginTop: '.4rem', maxWidth: '400px', margin: '.4rem auto 0' }}>
            Nombre, precios, URL, categoría, mini-dashboard de stock y historial completo de ventas y movimientos.
          </p>
          <span style={{ display: 'inline-block', marginTop: '1rem', padding: '.25rem .75rem', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '999px', fontSize: '.75rem', fontWeight: 600 }}>Fase 1</span>
        </div>
      </div>
    </>
  )
}
