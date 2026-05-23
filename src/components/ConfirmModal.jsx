import { AlertTriangle } from 'lucide-react'

/**
 * ConfirmModal — modal de confirmación para eliminar registros.
 * Uso:
 *   <ConfirmModal message="¿Eliminar?" onConfirm={fn} onCancel={fn} loading={bool} />
 */
export default function ConfirmModal({ message = '¿Confirmas eliminar este registro? Esta acción no se puede deshacer.', onConfirm, onCancel, loading = false, confirmLabel = 'Eliminar', loadingLabel = 'Eliminando…', confirmClassName = 'btn-danger' }) {
  return (
    <>
      <div className="modal-overlay" onClick={onCancel} />
      <div className="modal-dialog" role="alertdialog" aria-modal="true">
        <div className="modal-icon"><AlertTriangle size={32} /></div>
        <p className="modal-msg">{message}</p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className={`btn ${confirmClassName}`} onClick={onConfirm} disabled={loading}>
            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
