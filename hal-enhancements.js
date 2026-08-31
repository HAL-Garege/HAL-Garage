(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc2 = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function modal(html){
    document.getElementById('halEnhModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="halEnhModal"><div class="modalbox">${html}</div></div>`);
  }
  window.closeHalEnhModal = () => document.getElementById('halEnhModal')?.remove();

  async function viewSaleEvidenceByNumber(saleNumber){
    try{
      const {data:sale,error:se}=await db.from('sales').select('id,sale_number,created_at').eq('sale_number',saleNumber).limit(1).maybeSingle();
      if(se) throw se;
      if(!sale) throw new Error('No se encontró la venta.');
      const {data:rows,error}=await db.from('sale_evidence').select('evidence_type,storage_path,created_at').eq('sale_id',sale.id).order('created_at');
      if(error) throw error;
      const images=[];
      for(const r of (rows||[])){
        const {data:urlData,error:ue}=await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(r.storage_path,600);
        if(!ue && urlData?.signedUrl) images.push({type:r.evidence_type,url:urlData.signedUrl});
      }
      const label=t=>t==='plate'?'Placa':'Comprobante de pago';
      modal(`<div class="row"><b>📸 Evidencias · Venta #${esc2(sale.sale_number)}</b><button class="btn alt" style="width:auto;margin:0" onclick="closeHalEnhModal()">Cerrar</button></div>
        <div class="muted" style="margin:8px 0">Las imágenes son enlaces temporales de seguridad.</div>
        ${images.map(i=>`<div class="card"><b>${label(i.type)}</b><img src="${i.url}" class="photo-preview" style="max-height:360px"><a class="btn alt" style="display:block;text-align:center;text-decoration:none" href="${i.url}" target="_blank" rel="noopener">Abrir foto</a></div>`).join('') || '<div class="card muted">No hay fotos registradas para esta venta.</div>'}`);
    }catch(e){ toast(e.message || 'No se pudieron cargar las fotos.',true); }
  }
  window.viewSaleEvidenceByNumber=viewSaleEvidenceByNumber;

  function addHistoryPhotoButtons(){
    document.querySelectorAll('#app .card').forEach(card=>{
      if(card.dataset.evidenceButton==='1') return;
      const text=card.textContent||'';
      const m=text.match(/Venta\s*#\s*([^\n·]+)/i);
      if(!m) return;
      const number=m[1].trim();
      const buttons=card.querySelectorAll('button');
      const b=document.createElement('button');
      b.className='btn alt'; b.textContent='📸 Ver fotos'; b.dataset.evidenceButton='1';
      b.onclick=()=>viewSaleEvidenceByNumber(number);
      (buttons[buttons.length-1]?.parentElement || card).appendChild(b);
      card.dataset.evidenceButton='1';
    });
  }

  async function editProduct(productId){
    if(!(isAdmin()||role()==='supervisor')) return toast('Solo Administrador o Supervisor puede editar productos.',true);
    try{
      const {data:p,error}=await db.from('products').select('*').eq('id',productId).single();
      if(error) throw error;
      const name=prompt('Nombre del producto',p.name); if(name===null)return;
      const unit=prompt('Unidad',p.unit_name||'unidad'); if(unit===null)return;
      const minimum=Number(prompt('Stock mínimo',String(p.minimum_stock??0))); if(!(minimum>=0))return toast('Stock mínimo inválido.',true);
      const {error:ue}=await db.from('products').update({name:name.trim(),unit_name:unit.trim()||'unidad',minimum_stock:minimum,updated_at:new Date().toISOString()}).eq('id',productId);
      if(ue) throw ue;
      const current=Number(p.stock||0);
      const change=prompt(`Stock actual: ${current}. Si necesitas cambiarlo, escribe la NUEVA cantidad. Deja vacío para conservar ${current}.`,'');
      if(change!==null && change.trim()!==''){
        const next=Number(change); if(!(next>=0)) throw new Error('Stock inválido.');
        if(next!==current){
          const qty=Math.abs(next-current);
          const {error:me}=await db.from('inventory_movements').insert({product_id:productId,movement_type:'adjustment',quantity:qty,reason:`Edición de inventario: ${current} → ${next}`,...createdBy()});
          if(me) throw me;
          const {error:se}=await db.from('products').update({stock:next,updated_at:new Date().toISOString()}).eq('id',productId);
          if(se) throw se;
        }
      }
      toast('Producto actualizado correctamente'); await inventoryPage();
    }catch(e){toast(e.message || 'No se pudo editar el producto.',true)}
  }
  window.editProduct=editProduct;

  function addInventoryEditButtons(){
    document.querySelectorAll('#app button[onclick^="inventoryMove("]').forEach(move=>{
      if(move.dataset.editAdded==='1') return;
      const match=(move.getAttribute('onclick')||'').match(/inventoryMove\('([^']+)'\)/);
      if(!match) return;
      const edit=document.createElement('button');
      edit.className='smallbtn'; edit.textContent='Editar'; edit.style.marginLeft='5px'; edit.dataset.editAdded='1';
      edit.onclick=()=>editProduct(match[1]);
      move.parentElement.appendChild(edit); move.dataset.editAdded='1';
    });
  }

  function enhanceRegisterLabels(){
    document.querySelectorAll('#app button').forEach(b=>{
      if(b.textContent.includes('Nuevo cliente')) b.textContent=b.textContent.replace('Nuevo cliente','Registrar cliente');
      if(b.textContent.includes('CONFIRMAR VENTA')) b.textContent=b.textContent.replace('CONFIRMAR VENTA','REGISTRAR VENTA');
      if(b.textContent.includes('Ingresar producto al inventario')) b.textContent=b.textContent.replace('Ingresar producto al inventario','Registrar producto');
    });
  }

  const originalInventory=window.inventoryPage;
  if(typeof originalInventory==='function'){
    window.inventoryPage=async function(){ await originalInventory(); await sleep(40); addInventoryEditButtons(); };
  }

  const observer=new MutationObserver(()=>{
    addHistoryPhotoButtons();
    addInventoryEditButtons();
    enhanceRegisterLabels();
  });
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

  setTimeout(()=>{ addHistoryPhotoButtons(); addInventoryEditButtons(); enhanceRegisterLabels(); },250);
})();
