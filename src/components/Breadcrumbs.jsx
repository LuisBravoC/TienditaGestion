import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/**
 * crumbs = [{ label, to? }, ...]
 * Last item has no link (current page).
 */
export default function Breadcrumbs({ crumbs }) {
  if (!crumbs || crumbs.length === 0) return null
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '.25rem' }}>
            {i > 0 && <ChevronRight size={12} className="breadcrumbs-sep" />}
            {isLast || !c.to
              ? <span style={{ color: 'var(--text)' }}>{c.label}</span>
              : <Link to={c.to}>{c.label}</Link>
            }
          </span>
        )
      })}
    </nav>
  )
}
