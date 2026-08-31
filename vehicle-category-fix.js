(() => {
  function vehicleTypeOptions(){
    return (vehicleTypes||[]).filter(t=>t.active && ['auto','camioneta','camioneta xl'].includes(String(t.name).trim().toLowerCase())).sort((a,b)=>{
      const order={'auto':1,'camioneta':2,'camioneta xl':3};
      return (order[String(a.name).trim().toLowerCase()]||99)-(order[String(b.name).trim().toLowerCase()]||99);
    });
  }

  window.addVehicle = function(clientId){
    if(!clientId) return;
    const opts=vehicleTypeOptions();
    if(opts.length!==3) return toast('No se pudieron cargar los 3 tipos de vehículo.',true);
    const old=document.getElementById('halVehicleModal'); old?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="modal" id="halVehicleModal"><div class="modalbox">
      <div class="row"><b>🚗 Registrar vehículo</b><button class="btn alt" style="width:auto;margin:0" onclick="document.getElementById('halVehicleModal')?.remove()">Cerrar</button></div>
      <label>Placa</label><input id="halVehiclePlate" placeholder="Ej. ABC123" maxlength="12" autocomplete="off">
      <label>Tipo de vehículo</label><select id="halVehicleType">${opts.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
      <label>Marca (opcional)</label><input id="halVehicleBrand" placeholder="Toyota, Kia, Ford...">
      <label>Modelo (opcional)</label><input id="halVehicleModel" placeholder="Hilux, Sportage, Ranger...">
      <button class="btn green" onclick="saveVehicleCategoryFix('${clientId}')">REGISTRAR VEHÍCULO</button>
    </div></div>`);
  };

  window.saveVehicleCategoryFix = async function(clientId){
    const plate=document.getElementById('halVehiclePlate')?.value.trim().toUpperCase();
    const typeId=document.getElementById('halVehicleType')?.value;
    const brand=document.getElementById('halVehicleBrand')?.value.trim()||null;
    const model=document.getElementById('halVehicleModel')?.value.trim()||null;
    if(!plate) return toast('Ingresa la placa.',true);
    if(!typeId) return toast('Selecciona el tipo de vehículo.',true);
    try{
      const {data,error}=await db.from('vehicles').insert({client_id:clientId,vehicle_type_id:typeId,plate,brand,model,...createdBy()}).select().single();
      if(error) throw error;
      const type=vehicleTypes.find(t=>t.id===typeId);
      document.getElementById('halVehicleModal')?.remove();
      toast(`Vehículo ${plate} registrado como ${type?.name||'vehículo'}.`);
      selectedClient=clients.find(c=>c.id===clientId)||selectedClient;
      selectedVehicle=data||null;
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo registrar el vehículo.',true)}
  };
})();
