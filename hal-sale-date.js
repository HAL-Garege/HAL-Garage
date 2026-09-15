// HAL Garage - Fecha manual de servicio/venta + comisión de referidos
// Mantiene el flujo actual de venta y añade la vinculación automática con Comisionistas.
(function(){
  function localDateISO(d=new Date()){
    const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  async function findCommissionerForClient(clientId){
    const {data,error}=await db.from('commissioner_referrals').select('id,commissioner_id,referred_at,active').eq('client_id',clientId).eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error) return null;
    return data||null;
  }

  async function createCommissionForSale(sale, clientId){
    const referral=await findCommissionerForClient(clientId);
    if(!referral) return;

    // Evita duplicar comisión si la venta se procesa nuevamente.
    const {data:existing}=await db.from('commissioner_earnings').select('id').eq('sale_id',sale.id).maybeSingle();
    if(existing) return;

    // Primera visita = primera venta confirmada del cliente desde su referencia.
    const referredDate=(referral.referred_at||'').slice(0,10);
    const {data:priorSales}=await db.from('sales').select('id,service_date,created_at').eq('client_id',clientId).eq('status','confirmed').order('service_date',{ascending:true});
    const eligible=(priorSales||[]).filter(s=>s.id!==sale.id && (!referredDate || String(s.service_date||s.created_at||'').slice(0,10)>=referredDate));
    const visitType=eligible.length===0?'first':'repeat';
    const amount=visitType==='first'?5:3;

    const {error}=await db.from('commissioner_earnings').insert({
      commissioner_id:referral.commissioner_id,
      sale_id:sale.id,
      visit_type:visitType,
      amount,
      status:'pending'
    });
    if(error) throw error;

    // Guarda también el comisionista directamente en la venta para consultas administrativas.
    const {error:ue}=await db.from('sales').update({commissioner_id:referral.commissioner_id}).eq('id',sale.id);
    if(ue) throw ue;
  }

  window.salePage=async function(){
    try{await loadCatalog()}catch(e){toast(e.message,true)}
    saleItems=[];salePayment='cash';saleEvidence={plate:null,payment:null};
    const today=localDateISO();
    setHTML(`<div class="title">Nueva venta</div><div class="date">Registra servicios y pago</div>
    <label>Cliente</label><select id="saleClient" onchange="selectSaleClient(this.value)"><option value="">Seleccionar...</option>${clients.map(c=>`<option value="${c.id}" ${selectedClient?.id===c.id?'selected':''}>${esc(c.full_name)}</option>`).join('')}</select>
    <label>Vehículo</label><select id="saleVehicle" onchange="selectSaleVehicle(this.value)"><option value="">Seleccionar...</option></select>
    <div id="saleVehicleInfo"></div><div class="card"><b>Servicios</b><div id="serviceList"></div></div>
    <div class="card"><div class="row"><b>Total</b><span id="saleTotal" class="metric green">${money(0)}</span></div>
    <div class="pay"><button onclick="setPay('cash')" id="pay_cash">💵 Efectivo</button><button onclick="setPay('yape')" id="pay_yape">📱 Yape</button><button onclick="setPay('plin')" id="pay_plin">📱 Plin</button><button onclick="setPay('transfer')" id="pay_transfer">🏦 Transfer.</button></div>
    <label>Fecha del servicio / venta</label><input id="saleServiceDate" type="date" value="${today}" max="${today}">
    <div class="muted">Por defecto aparece hoy. Si el servicio se realizó ayer o antes, cambia aquí la fecha real.</div>
    <button class="btn green" onclick="finishSale()">CONFIRMAR VENTA</button></div>`);
    selectSaleClient(selectedClient?.id||'');setPay('cash');
  };

  window.finishSale=async function(){
    if(!canOperate())return toast('No tienes permiso.',true);
    if(!selectedClient||!selectedVehicle)return toast('Selecciona cliente y vehículo.',true);
    if(!saleItems.length)return toast('Agrega al menos un servicio.',true);
    const serviceDate=document.getElementById('saleServiceDate')?.value;
    const today=localDateISO();
    if(!serviceDate)return toast('Selecciona la fecha del servicio.',true);
    if(serviceDate>today)return toast('La fecha del servicio no puede ser futura.',true);
    const total=saleItems.reduce((a,x)=>a+x.subtotal,0);
    try{
      // Si el cliente tiene un referido activo, la venta queda vinculada automáticamente.
      const referral=await findCommissionerForClient(selectedClient.id);
      const commissionerId=referral?.commissioner_id||null;
      const {data:sale,error}=await db.from('sales').insert({client_id:selectedClient.id,vehicle_id:selectedVehicle.id,total,status:'confirmed',service_date:serviceDate,commissioner_id:commissionerId,...createdBy()}).select().single();if(error)throw error;
      const {error:ie}=await db.from('sale_items').insert(saleItems.map(x=>({...x,sale_id:sale.id})));if(ie)throw ie;
      const {error:pe}=await db.from('payments').insert({sale_id:sale.id,method:salePayment,amount:total,...createdBy()});if(pe)throw pe;
      const {error:ce}=await db.from('cash_movements').insert({movement_type:'income',payment_method:salePayment,amount:total,sale_id:sale.id,...createdBy()});if(ce)throw ce;
      if(referral) await createCommissionForSale(sale,selectedClient.id);
      toast(referral?'Venta registrada · comisión generada':'Venta registrada correctamente');selectedClient=null;selectedVehicle=null;saleItems=[];setTimeout(()=>go('dashboard'),700);
    }catch(e){toast(e.message,true)}
  };
})();
