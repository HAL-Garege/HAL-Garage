// HAL Garage - Fecha manual de servicio/venta
// Agrega únicamente la posibilidad de registrar la fecha real del servicio.
(function(){
  function localDateISO(d=new Date()){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  window.salePage=async function(){
    try{await loadCatalog()}catch(e){toast(e.message,true)}
    saleItems=[];salePayment='cash';saleEvidence={plate:null,payment:null};
    const today=localDateISO();
    setHTML(`<div class="title">Nueva venta</div><div class="date">Registra servicios y evidencia</div>
    <label>Cliente</label><select id="saleClient" onchange="selectSaleClient(this.value)"><option value="">Seleccionar...</option>${clients.map(c=>`<option value="${c.id}" ${selectedClient?.id===c.id?'selected':''}>${esc(c.full_name)}</option>`).join('')}</select>
    <label>Vehículo</label><select id="saleVehicle" onchange="selectSaleVehicle(this.value)"><option value="">Seleccionar...</option></select>
    <div id="saleVehicleInfo"></div><div class="card"><b>Servicios</b><div id="serviceList"></div></div>
    <div class="card"><div class="row"><b>Total</b><span id="saleTotal" class="metric green">${money(0)}</span></div>
    <div class="pay"><button onclick="setPay('cash')" id="pay_cash">💵 Efectivo</button><button onclick="setPay('yape')" id="pay_yape">📱 Yape</button><button onclick="setPay('plin')" id="pay_plin">📱 Plin</button><button onclick="setPay('transfer')" id="pay_transfer">🏦 Transfer.</button></div>
    <label>Fecha del servicio / venta</label><input id="saleServiceDate" type="date" value="${today}" max="${today}">
    <div class="muted">Por defecto aparece hoy. Si el servicio se realizó ayer o antes, cambia aquí la fecha real.</div>
    <div class="card"><b>📤 Entrega / pago</b>
    <div class="muted">Al terminar el servicio se toman únicamente estas dos evidencias.</div>
    <label>Foto de placa al entregar (obligatoria)</label><input id="platePhoto" type="file" accept="image/*" capture="environment" onchange="previewFile(this,'platePreview')"><img id="platePreview" class="photo-preview hidden">
    <label>Comprobante de pago (obligatorio)</label><input id="paymentPhoto" type="file" accept="image/*" capture="environment" onchange="previewFile(this,'paymentPreview')"><img id="paymentPreview" class="photo-preview hidden"></div>
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
    const plate=document.getElementById('platePhoto')?.files?.[0],payment=document.getElementById('paymentPhoto')?.files?.[0];
    if(!plate||!payment)return toast('La foto de placa y el comprobante son obligatorios.',true);
    const total=saleItems.reduce((a,x)=>a+x.subtotal,0);
    try{
      const {data:sale,error}=await db.from('sales').insert({client_id:selectedClient.id,vehicle_id:selectedVehicle.id,total,status:'confirmed',service_date:serviceDate,...createdBy()}).select().single();if(error)throw error;
      const {error:ie}=await db.from('sale_items').insert(saleItems.map(x=>({...x,sale_id:sale.id})));if(ie)throw ie;
      const {error:pe}=await db.from('payments').insert({sale_id:sale.id,method:salePayment,amount:total,...createdBy()});if(pe)throw pe;
      const {error:ce}=await db.from('cash_movements').insert({movement_type:'income',payment_method:salePayment,amount:total,sale_id:sale.id,...createdBy()});if(ce)throw ce;
      await uploadEvidence(sale.id,'plate',plate);await uploadEvidence(sale.id,'payment',payment);
      toast('Venta registrada correctamente');selectedClient=null;selectedVehicle=null;saleItems=[];setTimeout(()=>go('dashboard'),700);
    }catch(e){toast(e.message,true)}
  };
})();
