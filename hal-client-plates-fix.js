/* HAL Garage - fix de carga de clientes y placas */
(function(){
  function showLoadError(message){
    const box=document.getElementById('clientResults');
    if(box) box.innerHTML='<div class="card"><div class="danger"><b>No se pudieron cargar los clientes/vehículos.</b></div><div class="muted" style="margin-top:6px">'+String(message||'Error de conexión')+'</div><button class="btn alt" onclick="clientsPage()">↻ Reintentar</button></div>';
  }

  window.loadCatalog=async function(){
    const results=await Promise.allSettled([
      db.from('clients').select('*').eq('active',true).order('full_name'),
      db.from('vehicles').select('*').eq('active',true).order('plate'),
      db.from('vehicle_types').select('*').eq('active',true).order('name'),
      db.from('services').select('*').eq('active',true).order('name'),
      db.from('service_prices').select('*').eq('active',true)
    ]);

    const names=['clients','vehicles','vehicleTypes','services','prices'];
    const errors=[];
    results.forEach((r,i)=>{
      if(r.status==='fulfilled' && !r.value.error){
        window[names[i]]=r.value.data||[];
      }else{
        errors.push(names[i]+': '+(r.reason?.message||r.value?.error?.message||'error'));
        if(!Array.isArray(window[names[i]])) window[names[i]]=[];
      }
    });

    if(errors.length && (!clients.length || !vehicles.length)) throw new Error(errors.join(' | '));
    if(errors.length) console.warn('HAL Garage catálogo parcial:',errors.join(' | '));
    return {clients,vehicles,vehicleTypes,services,prices};
  };

  window.clientsPage=async function(){
    try{
      await window.loadCatalog();
    }catch(e){
      setHTML('<div class="title">Clientes</div><div class="date">Clientes y vehículos registrados</div><input id="clientSearch" placeholder="Buscar por nombre, teléfono o placa..." oninput="renderClientResults()"><button class="btn" onclick="newClient()">＋ Nuevo cliente</button><div id="clientResults"></div>');
      showLoadError(e.message);
      return;
    }
    setHTML('<div class="title">Clientes</div><div class="date">Clientes y vehículos registrados</div><input id="clientSearch" placeholder="Buscar por nombre, teléfono o placa..." oninput="renderClientResults()"><button class="btn" onclick="newClient()">＋ Nuevo cliente</button><div id="clientResults"></div>');
    renderClientResults();
  };

  const oldRender=window.renderClientResults;
  window.renderClientResults=function(){
    const input=document.getElementById('clientSearch');
    const term=String(input?.value||'').trim().toLowerCase().replace(/[-\s]/g,'');
    const list=Array.isArray(window.clients)?window.clients:[];
    const cars=Array.isArray(window.vehicles)?window.vehicles:[];
    const rows=list.filter(c=>{
      const vs=cars.filter(v=>v.client_id===c.id);
      const hay=(String(c.full_name||'')+' '+String(c.phone||'')+' '+vs.map(v=>v.plate||'').join(' ')).toLowerCase();
      const normalized=hay.replace(/[-\s]/g,'');
      return !term || hay.includes(term) || normalized.includes(term);
    });
    const box=document.getElementById('clientResults');
    if(!box)return;
    box.innerHTML=rows.slice(0,100).map(c=>{
      const vs=cars.filter(v=>v.client_id===c.id);
      return '<div class="card"><div class="row"><b>'+esc(c.full_name)+'</b><span class="badge">'+vs.length+' vehículo(s)</span></div><div class="muted">'+esc(c.phone||'Sin teléfono')+'</div>'+vs.map(v=>'<div class="result row"><span>🚗 <b>'+esc(v.plate)+'</b> · '+esc(v.brand||'')+' '+esc(v.model||'')+'</span><button class="smallbtn" onclick="startSale(\''+c.id+'\',\''+v.id+'\')">Vender</button></div>').join('')+'<button class="btn alt" onclick="addVehicle(\''+c.id+'\')">＋ Agregar vehículo</button><button class="btn alt" onclick="clientHistory(\''+c.id+'\')">📋 Historial de servicios</button></div>';
    }).join('') || '<div class="card muted">No se encontraron clientes.</div>';
  };

  console.log('HAL Garage: fix de placas activo');
})();
