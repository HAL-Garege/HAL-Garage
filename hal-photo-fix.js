(() => {
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const show = html => {
    document.getElementById('halPhotoFixModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class=\"modal\" id=\"halPhotoFixModal\"><div class=\"modalbox\">${html}</div></div>`);
  };
  const close = () => document.getElementById('halPhotoFixModal')?.remove();
  window.halPhotoFixClose = close;
  async function openById(id){
    try{
      if(!id) throw new Error('Venta inválida.');
      const {data:sale,error:se}=await db.from('sales').select('id,sale_number,created_at').eq('id',id).maybeSingle();
      if(se) throw se;
      if(!sale) throw new Error('No se encontró la venta.');
      const {data:rows,error}=await db.from('sale_evidence').select('evidence_type,storage_path,created_at').eq('sale_id',sale.id).order('created_at');
      if(error) throw error;
      const imgs=[];
      for(const r of rows||[]){
        if(!r.storage_path) continue;
        const {data:u,error:ue}=await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(r.storage_path,900);
        if(!ue && u?.signedUrl) imgs.push({type:r.evidence_type,url:u.signedUrl});
      }
      const label=t=>t==='plate'?'📷 Placa':t==='payment'?'🧾 Comprobante de pago':'📸 Evidencia';
      show(`<div class=\"row\"><b>📸 Fotos · Venta #${esc(sale.sale_number)}</b><button class=\"btn alt\" style=\"width:auto;margin:0\" onclick=\"halPhotoFixClose()\">Cerrar</button></div><div class=\"muted\" style=\"margin:7px 0 12px\">${esc(new Date(sale.created_at).toLocaleString('es-PE'))}</div>${imgs.map(x=>`<div class=\"card\"><b>${label(x.type)}</b><img class=\"photo-preview\" style=\"max-height:360px\" src=\"${x.url}\"><a class=\"btn alt\" href=\"${x.url}\" target=\"_blank\" rel=\"noopener\">Abrir foto</a></div>`).join('') || '<div class=\"card muted\">No hay fotos registradas para esta venta.</div>'}`);
    }catch(e){ toast(e.message || 'No se pudieron cargar las fotos.',true); }
  }
  window.halOpenPhotosById=openById;
  async function bindHistory(clientId){
    try{
      const {data:sales,error}=await db.from('sales').select('id,sale_number,created_at').eq('client_id',clientId).order('created_at',{ascending:false});
      if(error) throw error;
      const cards=[...document.querySelectorAll('#app .result')];
      const used=new Set();
      cards.forEach((card,index)=>{
        const text=card.textContent||'';
        let sale=sales.find(s=>new RegExp(`(?:Venta\\s*#\\s*|#\\s*)${s.sale_number}\\b`,'i').test(text));
        if(!sale) sale=sales[index];
        if(!sale || used.has(sale.id)) return;
        used.add(sale.id);
        let b=[...card.querySelectorAll('button')].find(x=>/ver fotos|fotos/i.test(x.textContent||''));
        if(!b){b=document.createElement('button');b.className='btn alt';b.textContent='📸 Ver fotos';card.appendChild(b)}
        b.disabled=false;b.removeAttribute('disabled');b.title='Ver fotos de la venta';b.dataset.saleId=String(sale.id);b.onclick=()=>openById(sale.id);b.dataset.halPhotoFix='1';
      });
      if(!cards.length){
        const candidates=[...document.querySelectorAll('#app .card')].filter(c=>/Venta\s*#|Servicio|Total|S\\//i.test(c.textContent||''));
        candidates.forEach((card,index)=>{const sale=sales[index];if(!sale)return;let b=[...card.querySelectorAll('button')].find(x=>/fotos/i.test(x.textContent||''));if(!b){b=document.createElement('button');b.className='btn alt';b.textContent='📸 Ver fotos';card.appendChild(b)}b.onclick=()=>openById(sale.id);b.dataset.saleId=String(sale.id);b.disabled=false;b.dataset.halPhotoFix='1'});
      }
    }catch(e){console.warn('No se pudieron asociar las fotos del historial:',e)}
  }
  window.halBindHistoryPhotos=bindHistory;
  const oldHistory=window.clientHistory;
  if(typeof oldHistory==='function'){
    window.clientHistory=async function(clientId){await oldHistory(clientId);setTimeout(()=>bindHistory(clientId),120)};
  }
  new MutationObserver(()=>{document.querySelectorAll('#app .result').forEach(card=>{const b=card.querySelector('button[data-halPhotoFix]');if(b)b.disabled=false})}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setTimeout(()=>{
    const app=document.getElementById('app');if(!app)return;
    const title=(app.textContent||'');if(/historial/i.test(title)){const clientId=window.__halCurrentClientId||window.selectedClient?.id;if(clientId)bindHistory(clientId)}
  },300);
})();
