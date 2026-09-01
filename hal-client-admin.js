// Administración de Clientes y Vehículos — edición y eliminación segura.
(() => {
  const canManageClient = () => typeof isAdmin === 'function' && (isAdmin() || role() === 'supervisor');
  const canDeleteClient = () => typeof isAdmin === 'function' && isAdmin();

  async function editClient(id, currentName, currentPhone){
    if(!canManageClient()) return;
    const name=prompt('Nombre del cliente:',currentName||''); if(name===null)return;
    const cleanName=name.trim(); if(!cleanName)return toast('El nombre no puede quedar vacío.',true);
    const phone=prompt('Teléfono / contacto:',currentPhone||''); if(phone===null)return;
    try{const {error}=await db.from('clients').update({full_name:cleanName,phone:phone.trim()||null}).eq('id',id);if(error)throw error;toast('Cliente actualizado correctamente');await clientsPage()}catch(e){toast(e.message||'No se pudo actualizar el cliente.',true)}
  }

  async function editVehicle(id,currentPlate,currentBrand,currentModel,currentType){
    if(!canManageClient())return;
    const plate=prompt('Placa:',currentPlate||'');if(plate===null)return;
    if(!plate.trim())return toast('La placa no puede quedar vacía.',true);
    const brand=prompt('Marca:',currentBrand||'');if(brand===null)return;
    const model=prompt('Modelo:',currentModel||'');if(model===null)return;
    const typeName=prompt('Tipo de vehículo (Auto / Camioneta / Camioneta XL):',currentType||'');if(typeName===null)return;
    const type=(vehicleTypes||[]).find(t=>String(t.name).trim().toLowerCase()===typeName.trim().toLowerCase());
    if(!type)return toast('Tipo inválido. Usa Auto, Camioneta o Camioneta XL.',true);
    try{const {error}=await db.from('vehicles').update({plate:plate.trim().toUpperCase(),brand:brand.trim()||null,model:model.trim()||null,vehicle_type_id:type.id}).eq('id',id);if(error)throw error;toast('Vehículo actualizado correctamente');await clientsPage()}catch(e){toast(e.message||'No se pudo actualizar el vehículo.',true)}
  }

  async function deleteVehicle(id,plate){
    if(!canManageClient())return;
    if(!confirm(`Primera confirmación\n\n¿Eliminar el vehículo ${plate}?`))return;
    if(!confirm(`SEGUNDA CONFIRMACIÓN\n\nSe eliminarán también sus registros de ventas/servicios vinculados.\n\n¿ACEPTAR Y ELIMINAR TODO?`))return;
    try{const {data:sales,error:se}=await db.from('sales').select('id').eq('vehicle_id',id);if(se)throw se;const ids=(sales||[]).map(x=>x.id);if(ids.length){const {error:ce}=await db.from('cash_movements').delete().in('sale_id',ids);if(ce)throw ce;const {error:de}=await db.from('sales').delete().in('id',ids);if(de)throw de}const {error:ve}=await db.from('vehicles').delete().eq('id',id);if(ve)throw ve;toast('Vehículo eliminado');await clientsPage()}catch(e){toast(e.message||'No se pudo eliminar el vehículo.',true)}
  }

  async function deleteClient(id,name){
    if(!canDeleteClient())return;
    if(!confirm(`Primera confirmación\n\n¿Eliminar al cliente «${name}»?`))return;
    if(!confirm(`SEGUNDA CONFIRMACIÓN\n\nSe eliminarán sus vehículos y registros de ventas/servicios.\n\n¿ACEPTAR Y ELIMINAR TODO?`))return;
    try{const {data:sales,error:se}=await db.from('sales').select('id').eq('client_id',id);if(se)throw se;const ids=(sales||[]).map(x=>x.id);if(ids.length){const {error:ce}=await db.from('cash_movements').delete().in('sale_id',ids);if(ce)throw ce;const {error:de}=await db.from('sales').delete().in('id',ids);if(de)throw de}const {error:ve}=await db.from('vehicles').delete().eq('client_id',id);if(ve)throw ve;const {error:cl}=await db.from('clients').delete().eq('id',id);if(cl)throw cl;toast('Cliente y registros eliminados');await clientsPage()}catch(e){toast(e.message||'No se pudo eliminar el cliente.',true)}
  }

  function clientId(card){const b=[...card.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').startsWith('clientHistory('));const m=(b?.getAttribute('onclick')||'').match(/clientHistory\('([^']+)'\)/);return m?.[1]||null}
  function clientPhone(card){const m=[...card.querySelectorAll('.muted')].find(x=>/Sin teléfono|\d/.test(x.textContent||''));return (m?.textContent||'').replace(/^.*?Teléfono\s*:?\s*/i,'').replace('Sin teléfono','').trim()}

  function inject(){
    if(!canManageClient())return;const app=document.getElementById('app');if(!app)return;
    [...app.querySelectorAll('.card')].forEach(card=>{
      const cid=clientId(card);if(!cid)return;const name=card.querySelector('.row b')?.textContent?.trim()||'Cliente';const phone=clientPhone(card);
      if(!card.querySelector('[data-hal-edit-client]')){const b=document.createElement('button');b.className='btn alt';b.dataset.halEditClient='1';b.textContent='✏️ Editar cliente';b.onclick=()=>editClient(cid,name,phone);const h=[...card.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').startsWith('clientHistory('));h?h.insertAdjacentElement('beforebegin',b):card.appendChild(b)}
      [...card.querySelectorAll('button[onclick^="startSale"]')].forEach(sb=>{const r=sb.closest('.result');if(!r||r.querySelector('[data-hal-edit-vehicle]'))return;const m=(sb.getAttribute('onclick')||'').match(/startSale\('([^']+)','([^']+)'\)/);if(!m)return;const v=(vehicles||[]).find(x=>x.id===m[2]);const edit=document.createElement('button');edit.className='smallbtn';edit.dataset.halEditVehicle='1';edit.textContent='✏️';edit.title='Modificar vehículo';edit.onclick=()=>editVehicle(m[2],v?.plate||'',v?.brand||'',v?.model||'',(vehicleTypes||[]).find(t=>t.id===v?.vehicle_type_id)?.name||'');r.appendChild(edit);if(!r.querySelector('[data-hal-delete-vehicle]')){const del=document.createElement('button');del.className='smallbtn';del.dataset.halDeleteVehicle='1';del.textContent='🗑️';del.title='Eliminar vehículo';del.onclick=()=>deleteVehicle(m[2],v?.plate||'');r.appendChild(del)}});
      if(canDeleteClient()&&!card.querySelector('[data-hal-delete-client]')){const d=document.createElement('button');d.className='btn red';d.dataset.halDeleteClient='1';d.textContent='🗑️ Eliminar cliente';d.onclick=()=>deleteClient(cid,name);card.appendChild(d)}
    });
  }

  setInterval(inject,1500);
  const observer=new MutationObserver(()=>{if(document.getElementById('clientResults'))inject()});
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  setTimeout(inject,300);
})();
