// Edición de ventas registradas — Administrador y Supervisor.
(() => {
  const canEdit=()=>typeof isAdmin==='function'&&(isAdmin()||role()==='supervisor');
  const esc2=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const money2=n=>'S/ '+Number(n||0).toFixed(2);
  const methods=[['cash','Efectivo'],['yape','Yape'],['plin','Plin'],['transfer','Transferencia'],['other','Otro']];
  function close(){document.getElementById('halEditSale')?.remove();window.__halEditSale=null}
  async function open(id){
    if(!canEdit())return toast('Solo Administrador o Supervisor puede editar ventas.',true);
    try{
      const [{data:s,error:se},{data:items,error:ie},{data:pays,error:pe}]=await Promise.all([
        db.from('sales').select('id,sale_number,total,status,vehicle_id,client_id,vehicles(plate,vehicle_type_id),clients(full_name)').eq('id',id).single(),
        db.from('sale_items').select('id,service_id,vehicle_type_id,service_name_snapshot,price_applied,quantity,subtotal').eq('sale_id',id).order('id'),
        db.from('payments').select('id,method,amount').eq('sale_id',id)
      ]);
      if(se)throw se;if(ie)throw ie;if(pe)throw pe;
      const [sv,pr]=await Promise.all([db.from('services').select('id,name').eq('active',true).order('name'),db.from('service_prices').select('service_id,vehicle_type_id,price').eq('active',true)]);
      if(sv.error)throw sv.error;if(pr.error)throw pr.error;
      const services2=sv.data||[],prices2=pr.data||[],payment=pays?.[0]?.method||'cash';
      const opts=services2.map(x=>`<option value="${x.id}">${esc2(x.name)}</option>`).join('');
      const itemHtml=(items||[]).map((x,i)=>`<div class="result" data-item="${x.id}"><label>Servicio ${i+1}</label><select class="hal-es-service">${opts}</select><label>Cantidad</label><input class="hal-es-qty" type="number" min="1" step="1" value="${Number(x.quantity||1)}"><div class="muted">Precio según vehículo: <span class="hal-es-price">${money2(x.price_applied)}</span></div></div>`).join('');
      document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="halEditSale"><div class="modalbox"><div class="row"><b>✏️ Editar venta #${esc2(s.sale_number)}</b><button class="smallbtn" onclick="window.halCloseEditSale()">✕</button></div><div class="muted" style="margin-top:6px">${esc2(s.clients?.full_name||'Cliente')} · 🚗 ${esc2(s.vehicles?.plate||'Sin placa')}</div><label>Método de pago</label><select id="hal-es-payment">${methods.map(m=>`<option value="${m[0]}" ${m[0]===payment?'selected':''}>${m[1]}</option>`).join('')}</select><div id="hal-es-items">${itemHtml}</div><div class="card"><div class="row"><b>Total nuevo</b><b id="hal-es-total">${money2(s.total)}</b></div></div><button class="btn" onclick="window.halSaveEditSale('${id}')">💾 Guardar cambios</button><button class="btn alt" onclick="window.halCloseEditSale()">Cancelar</button></div></div>`);
      function updatePrices(){const vt=s.vehicles?.vehicle_type_id;let total=0;document.querySelectorAll('#halEditSale .result').forEach(r=>{const sid=r.querySelector('.hal-es-service')?.value,q=Math.max(1,Number(r.querySelector('.hal-es-qty')?.value||1));const p=prices2.find(z=>z.service_id===sid&&z.vehicle_type_id===vt);const price=Number(p?.price||0);r.querySelector('.hal-es-price').textContent=money2(price);total+=price*q});const t=document.getElementById('hal-es-total');if(t)t.textContent=money2(total)}
      window.__halEditSale={s,items,services2,prices2};
      (items||[]).forEach((x,i)=>{const r=document.querySelectorAll('#halEditSale .result')[i],sel=r?.querySelector('.hal-es-service');if(sel){const byName=services2.find(z=>z.name.trim().toLowerCase()===String(x.service_name_snapshot||'').trim().toLowerCase());sel.value=byName?.id||x.service_id||services2[0]?.id||''}});
      document.querySelectorAll('#halEditSale .hal-es-service,#halEditSale .hal-es-qty').forEach(e=>e.addEventListener('change',updatePrices));updatePrices();
    }catch(e){toast(e.message||'No se pudo abrir la venta.',true)}
  }
  window.halCloseEditSale=close;
  window.halSaveEditSale=async id=>{try{const st=window.__halEditSale;if(!st)return;const method=document.getElementById('hal-es-payment').value;const rows=[...document.querySelectorAll('#halEditSale .result')];let total=0;for(const r of rows){const iid=r.dataset.item,sid=r.querySelector('.hal-es-service').value,q=Math.max(1,parseInt(r.querySelector('.hal-es-qty').value||1,10)),p=st.prices2.find(z=>z.service_id===sid&&z.vehicle_type_id===st.s.vehicles?.vehicle_type_id);if(!p)throw new Error('No existe precio para ese servicio y tipo de vehículo.');const price=Number(p.price),sub=price*q;total+=sub;const svc=st.services2.find(x=>x.id===sid);const {error}=await db.from('sale_items').update({service_id:sid,vehicle_type_id:st.s.vehicles.vehicle_type_id,service_name_snapshot:svc?.name||'',price_applied:price,quantity:q,subtotal:sub}).eq('id',iid);if(error)throw error}const r=await db.from('sales').update({total}).eq('id',id);if(r.error)throw r.error;const p=await db.from('payments').update({method,amount:total}).eq('sale_id',id);if(p.error)throw p.error;const cm=await db.from('cash_movements').update({payment_method:method,amount:total}).eq('sale_id',id);if(cm.error)console.warn(cm.error);const cid=st.s.client_id;close();toast('Venta actualizada correctamente');if(cid&&typeof clientHistory==='function')await clientHistory(cid)}catch(e){toast(e.message||'No se pudo guardar la venta.',true)}};
  async function findSaleId(card){
    const photo=[...card.querySelectorAll('button')].find(b=>/ver fotos/i.test(b.textContent||''));
    const raw=[photo?.getAttribute('onclick')||'',photo?.dataset?.saleId||'',photo?.dataset?.sale||''].join(' ');
    const uuid=raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0];
    if(uuid)return uuid;
    const text=card.textContent||'';
    const m=text.match(/Venta\s*#\s*(\d+)/i);if(!m)return null;
    const {data,error}=await db.from('sales').select('id,sale_number').eq('sale_number',m[1]).maybeSingle();
    if(error){console.warn('No se pudo localizar la venta por número:',error);return null}
    return data?.id||null;
  }
  function inject(){
    if(!canEdit())return;
    const app=document.getElementById('app');if(!app)return;
    app.querySelectorAll('.card').forEach(card=>{
      const text=card.textContent||'';
      if(!/Venta\s*#/i.test(text)||card.querySelector('[data-hal-edit-sale]'))return;
      const btn=document.createElement('button');btn.className='btn alt';btn.textContent='✏️ Editar venta';btn.dataset.halEditSale='1';btn.style.cssText='width:auto;margin:7px 0 0';
      btn.onclick=async()=>{btn.disabled=true;try{const id=await findSaleId(card);if(id)await open(id);else toast('No se encontró la venta.',true)}finally{btn.disabled=false}};
      const photo=[...card.querySelectorAll('button')].find(b=>/ver fotos/i.test(b.textContent||''));
      if(photo)photo.insertAdjacentElement('afterend',btn);else card.appendChild(btn);
    });
  }
  function hookHistory(){
    if(typeof window.clientHistory==='function'&&!window.__halEditHistoryHooked){
      const old=window.clientHistory;
      window.clientHistory=async function(cid){const result=await old(cid);setTimeout(inject,100);return result};
      window.__halEditHistoryHooked=true;
    }
  }
  const hookGo=window.go;
  if(typeof hookGo==='function'&&!window.__halEditGoHooked){
    window.go=function(p){const result=hookGo.apply(this,arguments);if(p==='clients')setTimeout(inject,100);return result};
    window.__halEditGoHooked=true;
  }
  let timer=0;
  const app=document.getElementById('app')||document.body;
  const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(inject,80)});
  obs.observe(app,{childList:true,subtree:true});
  setTimeout(()=>obs.disconnect(),15000);
  hookHistory();
  [100,400,900,1800].forEach(ms=>setTimeout(()=>{hookHistory();inject()},ms));
})();
