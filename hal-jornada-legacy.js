// Jornada: mantener exactamente la pantalla original y agregar únicamente "Ver fotos".
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
        <div class="muted" style="margin:6px 0 12px">Evidencias fotográficas</div>
        ${body || '<div class="card muted">No hay fotos registradas.</div>'}
      </div></div>`);
    } catch (e) {
      toast(e.message || 'No se pudieron cargar las fotos.', true);
    }
  }

  window.viewWorkdayPhotos = viewWorkdayPhotos;

  window.workdayPage = async function() {
    await originalWorkdayPage();
    try {
      // No se modifica el HTML original: solo se añade un botón al final de la tarjeta activa.
      const today = new Date().toISOString().slice(0,10);
      const {data: mine, error} = await db.from('workdays')
        .select('id,status')
        .eq('operator_id', HAL_USER.id)
        .eq('work_date', today)
        .order('created_at', {ascending:false})
        .limit(1)
        .maybeSingle();
      if (error || !mine) return;

      const cards = Array.from(document.querySelectorAll('#app .card'));
      const activeCard = cards.find(c => c.textContent.includes('Jornada abierta')) || cards.find(c => c.textContent.includes('Jornada iniciada'));
      if (!activeCard || activeCard.querySelector('[data-hal-workday-photos]')) return;

      const btn = document.createElement('button');
      btn.className = 'btn alt';
      btn.setAttribute('data-hal-workday-photos','1');
      btn.textContent = '📸 VER FOTOS';
      btn.onclick = () => viewWorkdayPhotos(mine.id);
      activeCard.appendChild(btn);
    } catch (e) {
      console.warn('HAL Garage: no se pudo agregar Ver fotos', e);
    }
  };
})();
