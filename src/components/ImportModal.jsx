import { X } from 'lucide-react'

export default function ImportModal({ preview, importing, onConfirm, onClose }) {
  const toImport = preview.filter(r => r._status === 'ok').length
  const ocupados = preview.filter(r => r._status === 'ocupado').length
  const vacios   = preview.filter(r => r._status === 'vacio' || r._status === 'no-existe').length

  return (
    <>
      <div className="modal-overlay" onClick={!importing ? onClose : undefined} />
      <div className="modal-dialog import-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Vista previa — Importar CSV</h3>
          <button className="btn btn-icon" onClick={onClose} disabled={importing}><X size={16} /></button>
        </div>

        <div className="import-summary">
          <span className="import-badge import-badge--ok">✓ {toImport} a importar</span>
          {ocupados > 0 && <span className="import-badge import-badge--warn">{ocupados} ya ocupados</span>}
          {vacios   > 0 && <span className="import-badge import-badge--gray">{vacios} sin nombre</span>}
        </div>

        <div className="import-table-wrap">
          <table className="import-table">
            <thead>
              <tr>
                <th>#</th><th>Nombre</th><th>Grupo</th><th>Pagado</th><th>Contacto</th><th>Fecha</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className={`import-row import-row--${r._status}`}>
                  <td>{r._num || '—'}</td>
                  <td>{r.nombre || <em style={{ opacity: .5 }}>—</em>}</td>
                  <td>{r.grupo}</td>
                  <td>{r.pagado}</td>
                  <td>{r.contacto}</td>
                  <td>{r.fecha}</td>
                  <td>
                    {r._status === 'ok'        && <span className="import-tag ok">Importar</span>}
                    {r._status === 'ocupado'   && <span className="import-tag warn">Ocupado</span>}
                    {r._status === 'vacio'     && <span className="import-tag gray">Vacío</span>}
                    {r._status === 'no-existe' && <span className="import-tag gray">No existe</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-actions" style={{ marginTop: '1rem' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={importing}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={importing || toImport === 0}
          >
            {importing ? 'Importando…' : `Importar ${toImport} boleto${toImport !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </>
  )
}
