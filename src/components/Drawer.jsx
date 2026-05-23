import { X } from 'lucide-react'

/**
 * Drawer — panel lateral deslizante para crear/editar registros.
 * Uso:
 *   <Drawer title="Editar X" onClose={fn} onSave={fn} saving={bool}>
 *     <div className="field">...</div>
 *   </Drawer>
 */
export default function Drawer({ title, onClose, onSave, saving = false, children }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <h3 className="drawer-title">{title}</h3>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {children}
        </div>

        <div className="drawer-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </>
  )
}
