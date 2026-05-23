import { fmt, fmtDate } from './formatters.js'

/**
 * Abre una ventana con el PDF de la rifa y lanza el diálogo de impresión.
 * @param {object} rifa       - Datos de la rifa (nombre_premio, precio_boleto, fecha_sorteo)
 * @param {Array}  boletos    - Array de boletos con numero_asignado, estatus, nombre_completo
 * @param {object} stats      - { Disponible, Apartado, Liquidado }
 * @param {number} total      - Cantidad total de boletos
 * @param {object} [opts]     - Opciones: { fechaMode: 'fecha' | 'agotarse' }
 */
export function generarRifaPDF(rifa, boletos, stats, total, opts = {}) {
  const nombre = rifa.nombre_premio ?? 'Rifa'
  const precio = fmt(rifa.precio_boleto)
  const fechaS = opts.fechaMode === 'agotarse'
    ? 'Hasta agotar boletos'
    : (rifa.fecha_sorteo ? fmtDate(rifa.fecha_sorteo) : 'Por confirmar')
  const digits = total <= 100 ? 2 : String(total).length
  const pad    = n => String(n).padStart(digits, '0')

  const COLS     = 10
  const tomados   = (stats.Apartado ?? 0) + (stats.Liquidado ?? 0)
  const pct       = total > 0 ? Math.round((tomados / total) * 100) : 0

  const cells = boletos.map(b => {
    const disp   = b.estatus === 'Disponible'
    const bg     = disp ? '#ffffff' : '#1e293b'
    const color  = disp ? '#1e293b' : '#94a3b8'
    const border = disp ? '2px solid #6366f1' : '2px solid transparent'
    const name     = b.nombre_completo ?? ''
    const initial  = name ? name.charAt(0).toUpperCase() : ''
    return `<div class="cell" style="background:${bg};color:${color};border:${border};" title="${name}">
      <span class="num">${pad(b.numero_asignado)}</span>
      ${!disp && initial ? `<span class="ini">${initial}</span>` : ''}
    </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${nombre}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,sans-serif;background:#0f172a;color:#f1f5f9;padding:2.5rem 2rem;min-height:100vh}
  .header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:2rem;flex-wrap:wrap}
  .brand{display:flex;align-items:center;gap:.6rem;font-size:.8rem;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.12em;margin-bottom:.6rem}
  .brand svg{width:18px;height:18px}
  h1{font-size:2.2rem;font-weight:900;line-height:1.1;letter-spacing:-.03em;margin-bottom:.35rem}
  h1 span{color:#6366f1}
  .subtitle{font-size:.95rem;color:#94a3b8;line-height:1.5}
  .badge{display:inline-flex;align-items:center;gap:.35rem;background:#6366f1;color:#fff;font-size:.7rem;font-weight:700;padding:.25rem .75rem;border-radius:99px;text-transform:uppercase;letter-spacing:.08em}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:2rem}
  .stat{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1rem 1.25rem}
  .stat-val{font-size:1.8rem;font-weight:900;line-height:1}
  .stat-lbl{font-size:.72rem;color:#94a3b8;margin-top:.25rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
  .val-disp{color:#6366f1}.val-tom{color:#f59e0b}
  .prog-wrap{margin-bottom:2rem}
  .prog-bar{height:8px;background:#1e293b;border-radius:99px;overflow:hidden;margin:.4rem 0}
  .prog-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#6366f1,#22c55e)}
  .prog-meta{display:flex;justify-content:space-between;font-size:.75rem;color:#94a3b8}
  .section-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#64748b;margin-bottom:.75rem}
  .grid{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:6px;margin-bottom:2rem}
  .cell{border-radius:8px;padding:6px 4px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}
  .num{font-size:.75rem;font-weight:800;line-height:1}
  .ini{font-size:.55rem;font-weight:600;opacity:.7;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  .legend{display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:2rem}
  .leg-item{display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:#94a3b8}
  .dot{width:12px;height:12px;border-radius:3px;flex-shrink:0}
  .footer{border-top:1px solid #1e293b;padding-top:1.25rem;display:flex;justify-content:space-between;align-items:center;font-size:.72rem;color:#475569;flex-wrap:wrap;gap:.5rem}
  .footer strong{color:#6366f1}
  @media print{
    @page{size:A4;margin:1.5cm}
  }
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
      RifaGesti\u00f3n
    </div>
    <h1>🎟️ ${nombre}</h1>
    <div class="subtitle">
      Precio por boleto: <strong style="color:#f1f5f9">${precio}</strong>
      &nbsp;\u2022&nbsp; Fecha de sorteo: <strong style="color:#f1f5f9">${fechaS}</strong>
    </div>
  </div>
  <div class="badge">Boletos disponibles</div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-val val-disp">${stats.Disponible}</div><div class="stat-lbl">Disponibles</div></div>
  <div class="stat"><div class="stat-val val-tom">${tomados}</div><div class="stat-lbl">Apartados</div></div>
  <div class="stat"><div class="stat-val" style="color:#f1f5f9">${total}</div><div class="stat-lbl">Total boletos</div></div>
</div>

<div class="prog-wrap">
  <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
  <div class="prog-meta"><span>${pct}% Apartados</span><span>${stats.Disponible} boletos libres de ${total}</span></div>
</div>

<div class="section-label">Cuadr\u00edcula de boletos</div>
<div class="grid">${cells}</div>

<div class="legend">
  <div class="leg-item"><div class="dot" style="background:#ffffff;border:2px solid #6366f1"></div>Disponible</div>
  <div class="leg-item"><div class="dot" style="background:#1e293b;border:2px solid #334155"></div>No disponible</div>
</div>

<div class="footer">
  <span>Generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
  <strong>RifaGesti\u00f3n</strong>
</div>
</body></html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 600)
}

/**
 * Genera una hoja de papelitos para tómbola física.
 * Solo incluye boletos Apartados y Liquidados (con dueño asignado).
 * Cada papelito muestra: número, nombre del participante, nombre de la rifa.
 */
export function generarPapelitosPDF(rifa, boletos, total) {
  const nombre = rifa.nombre_premio ?? 'Rifa'
  const digits = total <= 100 ? 2 : String(total).length
  const pad    = n => String(n).padStart(digits, '0')

  const vendidos = boletos.filter(b => b.estatus === 'Apartado' || b.estatus === 'Liquidado')

  const papelitos = vendidos.map(b => `
    <div class="ticket">
      <!--<div class="ticket-rifa">${nombre}</div>-->
      <div class="ticket-num">${pad(b.numero_asignado)}</div>
      <div class="ticket-nombre">${b.nombre_completo ?? '—'}</div>
    </div>`).join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Papelitos — ${nombre}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
  }

  .ticket {
    border: 1px dashed #999;
    padding: 6px 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    min-height: 72px;
    page-break-inside: avoid;
  }

  .ticket-rifa {
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ticket-num {
    font-size: 28px;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -.02em;
  }

  .ticket-nombre {
    font-size: 9px;
    font-weight: 600;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media print {
    @page { size: A4; margin: 1cm; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
  <div class="grid">${papelitos}</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
}
