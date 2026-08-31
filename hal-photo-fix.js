(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const show = html => {
    document.getElementById('halPhotoFixModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="halPhotoFixModal"><div class="modalbox">${html}</div></div>`);
  };
  const close = () => document.getElementById('halPhotoFixModal')?.remove();
  window.halPhotoFixClose = close;
  async function openByNumber(n){
    try {
      const number = Number(n);
      if (!Number.isInteger(number) || number < 1) throw new Error('Número de venta inválido.');
      const {data:sale,error:se}=await db.from('sales').select('id,sale_number').eq('sale_number',number).maybeSingle();
      if(se) throw se;
      if(!sale) throw new Error('No se encontró la venta #'+number+'.');
      const {data:rows,error}=await db.from('sale_evidence').select('evidence_type,storage_path,created_at').eq('sale_id',sale.id).order('created_at');
      if(error) throw error;
      const imgs=[];
      for(const r of rows||[]){
        const {data:u,error:ue}=await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(r.storage_path,600);
        if(!ue && u?.signedUrl) imgs.push({type:r.evidence_type,url:u.signedUrl});
      }
      show(`<div class="row"><b>📸 Evidencias · Venta #${esc(sale.sale_number)}</b><button class="btn alt" style="width:auto;margin:0" onclick="halPhotoFixClose()">Cerrar</button></div>${imgs.map(x=>`<div class="card"><b>${x.type==='plate'?'📷 Placa':'🧾 Comprobante de pago'}</b><img class="photo-preview" style="max-height:360px" src="${x.url}"><a class="btn alt" href="${x.url}" target="_blank" rel="noopener">Abrir foto</a></div>`).join('') || '<div class="card muted">No hay fotos registradas para esta venta.</div>'}`);
    } catch(e) { toast(e.message || 'No se pudieron cargar las fotos.',true); }
  }
  window.halOpenPhotosByNumber=openByNumber;
  function enable(){
    document.querySelectorAll('#app .card').forEach(card=>{
      const m=(card.textContent||'').match(/Venta\s*#\s*(\d+)/i);
      if(!m) return;
      const b=[...card.querySelectorAll('button')].find(x=>/ver fotos/i.test(x.textContent||''));
      if(!b) return;
      b.disabled=false;
      b.removeAttribute('disabled');
      b.title='Ver evidencias de esta venta';
      b.onclick=()=>openByNumber(m[1]);
      b.dataset.halPhotoFix='1';
    });
  }
  new MutationObserver(enable).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setTimeout(enable,100);
})();
