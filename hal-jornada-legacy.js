// Jornada: mantener exactamente la pantalla original y agregar "Ver fotos" SOLO en cada registro del historial.
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

      const labels = {
        entry: 'Ingreso',
        lunch_out: 'Salida a almuerzo',
        lunch_in: 'Regreso del almuerzo',
        exit: 'Salida de jornada'
      };
      const items = [];
      for (const r of (rows || [])) {
        let url = null;
        if (r.storage_path) {
          const s = await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(r.storage_path, 900);
          url = s.error ? null : s.data?.signedUrl || null;
        }
        items.push({
          label: labels[r.evidence_type] || r.evidence_type,
          time: r.created_at ? new Date(r.created_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—',
          url
        });
      }

      document.getElementById('halWorkdayPhotosModal')?.remove();
      const body = items.map(i => `<div class="card">
        <b>${esc(i.label)}</b><div class="muted">${esc(i.time)}</div>
        ${i.url ? `<img src="${i.url}" class="photo-preview" style="max-height:300px"><a class="btn alt" href="${i.url}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">Abrir foto</a>` : '<div class="danger small">Foto no disponible.</div>'}
      </div>`).join('');
      document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="halWorkdayPhotosModal"><div class="modalbox">
        <div class="row"><b>📸 Fotos de jornada</b><button class="btn alt" style="width:auto;margin:0" onclick="document.getElementById('halWorkdayPhotosModal')?.remove()">Cerrar</button></div>
        <div class="muted" style="margin:6px 0 12px">Evidencias fotográficas de esta jornada</div>
        ${body || '<div class="card muted">No hay fotos registradas para esta jornada.</div>'}
      </div></div>`);
    } catch (e) {
      toast(e.message || 'No se pudieron cargar las fotos.', true);
    }
  }

  window.viewWorkdayPhotos = viewWorkdayPhotos;

  window.workdayPage = async function() {
    // Ejecutar la pantalla original sin cambiar su diseño ni sus botones.
    await originalWorkdayPage();
    try {
      // Recuperamos exactamente el mismo historial que muestra la pantalla original.
      const {data: rows, error} = await db.from('workdays')
        .select('id')
        .order('work_date',{ascending:false})
        .limit(50);
      if (error) throw error;

      const table = document.querySelector('#app table.table');
      if (!table) return;
      const trs = Array.from(table.querySelectorAll('tr'));
      if (!trs.length) return;

      // El botón NO va en la jornada activa. Va al lado del estado de CADA fila histórica.
      const header = trs[0];
      if (!header.querySelector('[data-hal-workday-photo-header]')) {
        const th = document.createElement('th');
        th.textContent = 'Fotos';
        th.setAttribute('data-hal-workday-photo-header','1');
        header.appendChild(th);
      }

      rows.forEach((w, index) => {
        const tr = trs[index + 1];
        if (!tr || tr.querySelector('[data-hal-workday-photos]')) return;
        const td = document.createElement('td');
        const btn = document.createElement('button');
        btn.className = 'btn alt';
        btn.style.cssText = 'width:auto;padding:6px 8px;margin:0;font-size:11px;white-space:nowrap';
        btn.setAttribute('data-hal-workday-photos','1');
        btn.textContent = '📸 Ver fotos';
        btn.onclick = () => viewWorkdayPhotos(w.id);
        td.appendChild(btn);
        tr.appendChild(td);
      });
    } catch (e) {
      console.warn('HAL Garage: no se pudieron agregar fotos al historial', e);
    }
  };
})();
