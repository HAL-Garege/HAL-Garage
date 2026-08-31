// Exportación del registro de Jornada y Almuerzo.
// Añade controles al final de la pantalla sin modificar las marcaciones existentes.
(() => {
  const escapeHtml = s => String(s ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));

  function fmtTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit'});
  }

  function fmtDate(value) {
    if (!value) return '—';
    const d = new Date(value + (String(value).length === 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('es-PE');
  }

  async function getExportRows() {
    const {data: workdays, error} = await db.from('workdays')
      .select('id,operator_id,work_date,status,created_at')
      .order('work_date', {ascending:false})
      .order('created_at', {ascending:false})
      .limit(1000);
    if (error) throw error;

    const ids = (workdays || []).map(w => w.id);
    let evidence = [];
    if (ids.length) {
      const r = await db.from('workday_evidence')
        .select('workday_id,evidence_type,created_at')
        .in('workday_id', ids)
        .order('created_at');
      if (r.error) throw r.error;
      evidence = r.data || [];
    }

    const byDay = {};
    evidence.forEach(e => {
      if (!byDay[e.workday_id]) byDay[e.workday_id] = {};
      // Conservamos la primera marcación de cada tipo para evitar duplicados en el reporte.
      if (!byDay[e.workday_id][e.evidence_type]) byDay[e.workday_id][e.evidence_type] = e.created_at;
    });

    return (workdays || []).map(w => {
      const e = byDay[w.id] || {};
      return {
        fecha: fmtDate(w.work_date),
        ingreso: fmtTime(e.entry),
        salidaAlmuerzo: fmtTime(e.lunch_out),
        regresoAlmuerzo: fmtTime(e.lunch_in),
        salidaJornada: fmtTime(e.exit),
        estado: w.status === 'open' ? 'Abierta' : w.status === 'closed' ? 'Cerrada' : (w.status || '—')
      };
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportExcel() {
    try {
      const rows = await getExportRows();
      const headers = ['Fecha','Ingreso','Salida a almuerzo','Regreso del almuerzo','Salida de jornada','Estado'];
      // HTML Spreadsheet: Excel lo abre directamente y conserva columnas y encabezados.
      const body = rows.map(r => `<tr>${[r.fecha,r.ingreso,r.salidaAlmuerzo,r.regresoAlmuerzo,r.salidaJornada,r.estado].map(escapeHtml).map(v=>`<td>${v}</td>`).join('')}</tr>`).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial;font-size:11pt}th,td{border:1px solid #999;padding:6px 9px}th{font-weight:bold}caption{font-size:16pt;font-weight:bold;margin-bottom:10px}</style></head><body><table><caption>HAL Garage — Registro de Jornada y Almuerzo</caption><thead><tr>${headers.map(escapeHtml).map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
      downloadBlob(new Blob([html], {type:'application/vnd.ms-excel;charset=utf-8'}), `HAL-Garage-Jornada-${new Date().toISOString().slice(0,10)}.xls`);
      toast('Excel generado correctamente.');
    } catch (e) {
      toast(e.message || 'No se pudo generar el Excel.', true);
    }
  }

  async function exportPdf() {
    try {
      const rows = await getExportRows();
      const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>HAL Garage — Jornada y Almuerzo</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:11px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#555}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px;text-align:left}th{font-weight:bold}tr{page-break-inside:avoid}</style></head><body><h1>HAL Garage — Registro de Jornada y Almuerzo</h1><p>Generado: ${escapeHtml(new Date().toLocaleString('es-PE'))}</p><table><thead><tr><th>Fecha</th><th>Ingreso</th><th>Salida a almuerzo</th><th>Regreso del almuerzo</th><th>Salida de jornada</th><th>Estado</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.fecha)}</td><td>${escapeHtml(r.ingreso)}</td><td>${escapeHtml(r.salidaAlmuerzo)}</td><td>${escapeHtml(r.regresoAlmuerzo)}</td><td>${escapeHtml(r.salidaJornada)}</td><td>${escapeHtml(r.estado)}</td></tr>`).join('')}</tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) throw new Error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para generar el PDF.');
      w.document.write(html);
      w.document.close();
    } catch (e) {
      toast(e.message || 'No se pudo generar el PDF.', true);
    }
  }

  window.halExportJornadaExcel = exportExcel;
  window.halExportJornadaPdf = exportPdf;

  async function injectControls() {
    try {
      const cards = Array.from(document.querySelectorAll('#app .card'));
      const history = cards.find(c => /Historia de jornada/i.test(c.textContent || ''));
      if (!history || history.querySelector('[data-hal-jornada-export]')) return;

      const box = document.createElement('div');
      box.setAttribute('data-hal-jornada-export', '1');
      box.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid var(--line)';
      box.innerHTML = `<div class="row"><b>📥 Exportar marcaciones</b></div><div class="muted" style="margin-top:4px">Descarga todo el historial de jornada y almuerzo.</div><div class="grid" style="margin-top:6px"><button class="btn alt" onclick="halExportJornadaExcel()">📊 DESCARGAR EXCEL</button><button class="btn alt" onclick="halExportJornadaPdf()">📄 GENERAR PDF</button></div>`;
      history.appendChild(box);
    } catch (e) {
      console.warn('HAL Garage: no se pudieron agregar las exportaciones', e);
    }
  }

  const originalJornada = window.jornadaPage;
  if (typeof originalJornada === 'function') {
    window.jornadaPage = async function() {
      await originalJornada();
      await injectControls();
    };
    window.workdayPage = window.jornadaPage;
  } else {
    // Fallback por si el orden de scripts cambia.
    const timer = setInterval(() => {
      if (typeof window.jornadaPage === 'function') {
        clearInterval(timer);
        const fn = window.jornadaPage;
        window.jornadaPage = async function(){ await fn(); await injectControls(); };
        window.workdayPage = window.jornadaPage;
      }
    }, 50);
    setTimeout(() => clearInterval(timer), 5000);
  }
})();
