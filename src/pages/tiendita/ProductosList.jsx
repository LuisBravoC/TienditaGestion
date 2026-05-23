import { Package } from 'lucide-react'
import Breadcrumbs from '../../components/Breadcrumbs.jsx'
import { useBreadcrumbs } from '../../lib/useBreadcrumbs.js'

export default function ProductosList() {
  const crumbs = useBreadcrumbs()
  return (
    <>
      <Breadcrumbs crumbs={crumbs} />
      <div className="page">
        <div className="page-title-row">
          <h1 className="page-title" style={{ margin: 0 }}><Package size={22} /> Productos</h1>
        </div>
        <Placeholder icon={<Package size={48} />} titulo="Gestión de Productos" desc="CRUD de productos, categorías, ficha con mini-dashboard de stock e historial de ventas." fase="Fase 1" />
      </div>
    </>
  )
}

function Placeholder({ icon, titulo, desc, fase }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
      <div style={{ opacity: .25, marginBottom: '1rem' }}>{icon}</div>
      <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>{titulo}</p>
      <p style={{ fontSize: '.875rem', marginTop: '.4rem', maxWidth: '360px', margin: '.4rem auto 0' }}>{desc}</p>
      <span style={{ display: 'inline-block', marginTop: '1rem', padding: '.25rem .75rem', background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: '999px', fontSize: '.75rem', fontWeight: 600 }}>{fase}</span>
    </div>
  )
}
