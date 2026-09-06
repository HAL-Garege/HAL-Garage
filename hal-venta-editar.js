// HAL Garage — edición aislada de ventas.
// Solo permite cambiar servicio, costo y forma de pago.
(() => {
  const escE=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let editState=null;
  async function editSale(id){
    if(!canOperate())return toast('No tienes permiso para editar ventas.',true);
    try{
      const {data:sale,error}=await db.from('sales').select('id,sale_number,client_id,vehicle_id,total,status,created_at').eq('id',id).single();if(error)throw error;
      if(sale.status==='voided')return toast('Esta venta no se puede editar.',true);
      const {data:items,error:ie}=await db.from('sale_items').select('id,service_id,vehicle_type_id,service_name_snapshot,price_applied,quantity,subtotal').eq('sale_id',id).order('id');if(ie)throw ie;
      const {data:payment,error:pe}=await db.from('payments').select('id,payment_method,amount').eq('sale_id',id).limit(1).maybeSingle();if(pe)throw pe;
      editState={sale,items:items||[],payment:payment||null};
      const item=editState.items[0],client=clients.find(c=>c.id===sale.client_id),vehicle=vehicles.find(v=>v.id===sale.vehicle_id);
      const opts=services.map(s=>`<option value="${s.id}">${escE(s.name)}</option>`).join('');
      document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="halEditSale"><div class="modalbox"><div class="row"><div><b style="font-size:20px">✏️ Editar venta #${escE(sale.sale_number||'')}</b><div class="muted">Solo servicio, costo y forma de pago</div></div><button class="btn alt" style="width:auto;margin:0" onclick="closeEditSale()">✕</button></div><div class="card"><b>Cliente:</b> ${escE(client?.full_name||'')}<br><b>Placa:</b> ${escE(vehicle?.plate||'')}<br><b>Fecha:</b> ${new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(sale.created_at))}</div><label>Tipo de servicio</label><select id="editService">${opts}</select><label>Costo (S/)</label><input id="editAmount" type="number" min="0.01" step="0.01" value="${Number(item?.price_applied||0)}"><label>Forma de pago</label><div class="pay" id="editPay"><button type="button" data-p="cash" onclick="selectEditPayment('cash')">Efectivo</button><button type="button" data-p="yape" onclick="selectEditPayment('yape')">Yape</button><button type="button" data-p="plin" onclick="selectEditPayment('plin')">Plin</button><button type="button" data-p="transfer" onclick="selectEditPayment('transfer')">Transferencia</button><button type="button" data-p="other" onclick="selectEditPayment('other')">Otro</button></div><button class="btn green" onclick="saveEditSale()">💾 Guardar cambios</button><button class="btn alt" onclick="closeEditSale()">Cancelar</button></div></div>`);
      document.getElementById('editService').value=item?.service_id||'';selectEditPayment(payment?.payment_method||'cash');
    }catch(e){toast(e.message||'No se pudo abrir la venta.',true)}
  }
  function selectEditPayment(p){window.__editPay=p;document.querySelectorAll('#editPay button').forEach(b=>b.classList.toggle('active',b.dataset.p===p))}
  function closeEditSale(){document.getElementById('halEditSale')?.remove();editState=null}
  async function saveEditSale(){
    const x=editState;if(!x)return;
    const item=x.items[0],service=services.find(s=>s.id===document.getElementById('editService')?.value),amount=Number(document.getElementById('editAmount')?.value),pay=window.__editPay||'cash';
    if(!service||!item)return toast('No se encontró el detalle de la venta.',true);if(!(amount>0))return toast('Ingresa un costo válido.',true);
    try{
      const subtotal=amount*Number(item.quantity||1);let r=await db.from('sale_items').update({service_id:service.id,service_name_snapshot:service.name,price_applied:amount,subtotal}).eq('id',item.id);if(r.error)throw r.error;
      r=await db.from('sales').update({total:subtotal}).eq('id',x.sale.id);if(r.error)throw r.error;
      if(x.payment){r=await db.from('payments').update({payment_method:pay,amount:subtotal}).eq('id',x.payment.id);if(r.error)throw r.error}else{r=await db.from('payments').insert({sale_id:x.sale.id,payment_method:pay,amount:subtotal,...createdBy()});if(r.error)throw r.error}
      r=await db.from('cash_movements').select('id').eq('reference_id',x.sale.id).eq('movement_type','income').limit(1).maybeSingle();if(r.error)throw r.error;if(r.data){r=await db.from('cash_movements').update({amount:subtotal,payment_method:pay}).eq('id',r.data.id);if(r.error)throw r.error}
      closeEditSale();toast('Venta actualizada correctamente');if(typeof clientHistory==='function'&&x.sale.client_id)clientHistory(x.sale.client_id);
    }catch(e){toast(e.message||'No se pudo guardar la venta.',true)}
  }
  async function addEditButtons(clientId){
    try{
      const {data:sales,error}=await db.from('sales').select('id,sale_number').eq('client_id',clientId).order('created_at',{ascending:false});if(error)throw error;
      const byNumber=Object.fromEntries((sales||[]).map(s=>[String(s.sale_number),s.id]));
      document.querySelectorAll('#app .card').forEach(card=>{
        if(card.dataset.halEditSale==='1')return;
        const m=(card.textContent||'').match(/Venta\s*#\s*([0-9]+)/i);if(!m)return;
        const saleId=byNumber[m[1]];if(!saleId)return;
        const b=document.createElement('button');b.className='btn alt';b.textContent='✏️ Editar';b.style.cssText='width:auto;margin:7px 0 0';b.onclick=()=>editSale(saleId);card.appendChild(b);card.dataset.halEditSale='1';
      });
    }catch(e){console.warn('Editar ventas:',e)}
  }
  window.editSale=editSale;window.selectEditPayment=selectEditPayment;window.closeEditSale=closeEditSale;window.saveEditSale=saveEditSale;
  const oldHistory=window.clientHistory;
  if(typeof oldHistory==='function')window.clientHistory=async function(clientId){await oldHistory.apply(this,arguments);setTimeout(()=>addEditButtons(clientId),50)};
})();
