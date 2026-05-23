import { XCircle } from 'lucide-react'

/**
 * ErrorModal — Modal informativo de error (no pide confirmación).
 * Reutiliza los estilos .modal-overlay y .modal-dialog del ConfirmModal.
 *
 * Props:
 *   title   — Título corto y legible del error
 *   body    — Descripción detallada del problema y cómo resolverlo
 *   onClose — Función para cerrar el modal
 */
export default function ErrorModal({ title, body, onClose }) {
  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-dialog">
        <div className="modal-icon" style={{ color: 'var(--deuda)' }}>
          <XCircle size={44} />
        </div>
        <h3 style={{ margin: '0 0 .5rem', fontSize: '1.05rem', fontWeight: 700 }}>
          {title}
        </h3>
        <p className="modal-msg">{body}</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Entendido
          </button>
        </div>
      </div>
    </>
  )
}
