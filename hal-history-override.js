(async()=>{
  window.clientHistory=async function(clientId){
    const c=clients.find(x=>x.id===clientId);if(!c)return;
    try{
      const sales=await q('sales',db.from('sales').select('id,sale_number,total,status,created_at,vehicle_id').eq('client_id',clientId).order('created_at',{ascending:false}));
      const items=sales.length?await q('sale_items',db.from('sale_items').select('sale_id,service_name_snapshot,price_applied,quantity,subtotal').in('sale_id',sales.map(x=>x.id))):[];
      const total=sales.reduce((a,x)=>a+Number(x.total||0),0);
      setHTML(`<div class="title">Historial del cliente</div><div class="date">${esc(c.full_name)} · ${sales.length} visita(s) · ${money(total)} acumulado</div>
      <button class="btn alt" onclick="clientsPage()">← Volver a clientes</button>
      <div class="card"><div class="grid"><div><div class="muted">Visitas</div><div class="metric">${sales.length}</div></div><div><div class="muted">Total gastado</div><div class="metric green">${money(total)}</div></div></div></div>
      ${sales.map(x=>{const v=vehicles.find(v=>v.id===x.vehicle_id),its=items.filter(i=>i.sale_id===x.id);return `<div class="card"><div class="row"><b>Venta #${esc(x.sale_number)}</b><span class="badge">${new Date(x.created_at).toLocaleDateString('es-PE')}</span></div><div class="muted">${v?esc(v.plate):'Vehículo'} · ${esc(x.status)}</div>${its.map(i=>`<div class="result row"><span>${esc(i.service_name_snapshot)} × ${i.quantity}</span><b>${money(i.subtotal)}</b></div>`).join('')}<div class="row" style="margin-top:8px"><span>Total</span><b>${money(x.total)}</b></div><button class="btn alt" style="width:auto;margin-top:8px" onclick="editSale('${x.id}')">✏️ Editar</button></div>`}).join('')||'<div class="card muted">Este cliente todavía no tiene servicios registrados.</div>'}`);
    }catch(e){setHTML(`<div class="title">Historial</div><div class="errorbox">${esc(e.message)}</div>`)}
  };
})();
