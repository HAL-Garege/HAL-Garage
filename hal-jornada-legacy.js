// Jornada: mantener exactamente la pantalla original, agregar Ver fotos por registro y exportación.
(() => {
  const originalWorkdayPage = window.workdayPage;
  if (typeof originalWorkdayPage !== 'function') return;

  async function viewWorkdayPhotos(workdayId) {
    try {
      if (!workdayId) throw new Error('Jornada inválida.');
      const {data: rows, error} = await db.from('workday_evidence')
        .select('evidence_type,storage_path,created_at')
        .eq('workday_id', workdayId)
        .order('created_at');
      if (error) throw error;

      const labels = {entry:'Ingreso',lunch_out:'Salida a almuerzo',lunch_in:'Regreso del almuerzo',exit:'Salida de jornada'};
      const items = [];
      for (const r of (rows || [])) {
        let url = null;
        if (r.storage_path) {
          const s = await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(r.storage_path, 900);
          url = s.error ? null : s.data?.signedUrl || null;
        }
        items.push({label:labels[r.evidence_type] || r.evidence_type,time:r.created_at ? new Date(r.created_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—',url});
      }
      document.getElementById('halWorkdayPhotosModal')?.remove();
      const body = items.map(i => `<div class="card"><b>${esc(i.label)}</b><div class="muted">${esc(i.time)}</div>${i.url ? `<img src="${i.url}" class="photo-preview" style="max-height:300px"><a class="btn alt" href="${i.url}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">Abrir foto</a>` : '<div class="danger small">Foto no disponible.</div>'}</div>`).join('');
      document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="halWorkdayPhotosModal"><div class="modalbox"><div class="row"><b>📸 Fotos de jornada</b><button class="btn alt" style="width:auto;margin:0" onclick="document.getElementById('halWorkdayPhotosModal')?.remove()">Cerrar</button></div><div class="muted" style="margin:6px 0 12px">Evidencias fotográficas de esta jornada</div>${body || '<div class="card muted">No hay fotos registradas para esta jornada.</div>'}</div></div>`);
    } catch (e) { toast(e.message || 'No se pudieron cargar las fotos.', true); }
  }

  function exportCsv(rows) {
    const header = ['Fecha','Ingreso','Salida a almuerzo','Regreso del almuerzo','Salida de jornada','Estado'];
    const fmt = x => x ? new Date(x).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—';
    const csvRows = rows.map(w => [w.work_date,fmt(w.created_at),fmt(w.lunch_out_at),fmt(w.lunch_in_at),fmt(w.closed_at),w.status || '—']);
    const csv = '\uFEFF' + [header,...csvRows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href=url; a.download=`HAL-Garage-Marcaciones-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Registro descargado. Ábrelo con Excel.');
  }

  function exportPdf(rows) {
    const fmt = x => x ? new Date(x).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—';
    const esc2 = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const body = rows.map(w=>`<tr><td>${esc2(w.work_date)}</td><td>${esc2(fmt(w.created_at))}</td><td>${esc2(fmt(w.lunch_out_at))}</td><td>${esc2(fmt(w.lunch_in_at))}</td><td>${esc2(fmt(w.closed_at))}</td><td>${esc2(w.status||'—')}</td></tr>`).join('');
    const win = window.open('','_blank');
    if(!win){toast('El navegador bloqueó la ventana del PDF.',true);return;}
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>HAL Garage - Marcaciones</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #999;padding:6px;text-align:left}th{font-weight:bold}</style></head><body><h1>HAL Garage — Registro de Jornada y Almuerzo</h1><p>Generado: ${esc2(new Date().toLocaleString('es-PE'))}</p><table><thead><tr><th>Fecha</th><th>Ingreso</th><th>Salida almuerzo</th><th>Regreso almuerzo</th><th>Salida jornada</th><th>Estado</th></tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    win.document.close();
  }

  window.viewWorkdayPhotos = viewWorkdayPhotos;

  window.workdayPage = async function() {
    await originalWorkdayPage();
    try {
      const {data: rows, error} = await db.from('workdays').select('*').order('work_date',{ascending:false}).limit(50);
      if (error) throw error;
      const table = document.querySelector('#app table.table');
      if (!table) return;
      const trs = Array.from(table.querySelectorAll('tr'));
      if (!trs.length) return;

      const header = trs[0];
      if (!header.querySelector('[data-hal-workday-photo-header]')) {
        const th = document.createElement('th'); th.textContent='Fotos'; th.setAttribute('data-hal-workday-photo-header','1'); header.appendChild(th);
      }
      rows.forEach((w,index)=>{
        const tr=trs[index+1]; if(!tr || tr.querySelector('[data-hal-workday-photos]')) return;
        const td=document.createElement('td'),btn=document.createElement('button');
        btn.className='btn alt'; btn.style.cssText='width:auto;padding:6px 8px;margin:0;font-size:11px;white-space:nowrap'; btn.setAttribute('data-hal-workday-photos','1'); btn.textContent='📸 Ver fotos'; btn.onclick=()=>viewWorkdayPhotos(w.id); td.appendChild(btn); tr.appendChild(td);
      });

      const old=document.querySelector('[data-hal-jornada-export-direct]'); old?.remove();
      const box=document.createElement('div'); box.className='card'; box.setAttribute('data-hal-jornada-export-direct','1');
      box.innerHTML='<b>📥 Registro de marcaciones</b><div class="muted" style="margin-top:6px">Descarga el historial de jornada y almuerzo.</div><button class="btn alt" id="halJornadaExcelDirect">📊 DESCARGAR EXCEL</button><button class="btn alt" id="halJornadaPdfDirect">📄 GENERAR PDF</button>';
      const historyCard=Array.from(document.querySelectorAll('#app .card')).find(c=>c.querySelector('table.table') && /Historial de jornadas/i.test(c.textContent||''));
      (historyCard || document.getElementById('app')).appendChild(box);
      box.querySelector('#halJornadaExcelDirect').onclick=()=>exportCsv(rows);
      box.querySelector('#halJornadaPdfDirect').onclick=()=>exportPdf(rows);
    } catch (e) { console.warn('HAL Garage Jornada:', e); }
  };
})();