import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Barra de paginación reutilizable.
 * Props: page (0-based), pageSize, count (total), onPage(newPage)
 */
export default function Pagination({ page, pageSize, count, onPage }) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  if (totalPages <= 1 && count <= pageSize) return null

  const from = count === 0 ? 0 : page * pageSize + 1
  const to   = Math.min((page + 1) * pageSize, count)

  return (
    <div className="pagination">
      <span className="pagination-info">
        {count === 0 ? '0 resultados' : `${from}–${to} de ${count}`}
      </span>
      <div className="pagination-btns">
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <span className="pagination-pages">{page + 1} / {totalPages}</span>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages - 1}
        >
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
