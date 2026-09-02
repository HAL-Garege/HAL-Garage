// Administración de Clientes y Vehículos — edición y eliminación segura.
(() => {
  const canManageClient=()=>typeof isAdmin==='function'&&(isAdmin()||role()==='supervisor');
  const canDeleteClient=()=>typeof isAdmin==='function'&&isAdmin();

  async function editClient(id,n,p){
    if(!canManageClient())return;
    const name=prompt('Nombre del cliente:',n||'');if(name===null)return;if(!name.trim())return toast('El nombre no puede quedar vacío.',true);
    const phone=prompt('Teléfono / contacto:',p||'');if(phone===null)return;
    try{const {error}=await db.from('clients').update({full_name:name.trim(),phone:phone.trim()||null}).eq('id',id);if(error)throw error;toast('Cliente actualizado correctamente');await clientsPage()}catch(e){toast(e.message||'No se pudo actualizar el cliente.',true)}
  }

  async function editVehicle(id,plate,brand,model,typeName){
    if(!canManageClient())return;
    const np=prompt('Placa:',plate||'');if(np===null)return;if(!np.trim())return toast('La placa no puede quedar vacía.',true);
    const nb=prompt('Marca:',brand||'');if(nb===null)return;const nm=prompt('Modelo:',model||'');if(nm===null)return;
    const nt=prompt('Tipo (Auto / Camioneta / Camioneta XL):',typeName||'');if(nt===null)return;
    const type=(vehicleTypes||[]).find(t=>String(t.name).trim().toLowerCase()===nt.trim().toLowerCase());if(!type)return toast('Tipo inválido. Usa Auto, Camioneta o Camioneta XL.',true);
    try{const {error}=await db.from('vehicles').update({plate:np.trim().toUpperCase(),brand:nb.trim()||null,model:nm.trim()||null,vehicle_type_id:type.id}).eq('id',id);if(error)throw error;toast('Vehículo actualizado correctamente');await clientsPage()}catch(e){toast(e.message||'No se pudo actualizar el vehículo.',true)}
  }

  async function deleteVehicle(id,plate){
    if(!canManageClient())return;if(!confirm(`Primera confirmación\n\n¿Eliminar el vehículo ${plate}?`))return;if(!confirm('SEGUNDA CONFIRMACIÓN\n\nSe eliminarán también sus registros de ventas/servicios vinculados.\n\n¿ACEPTAR Y ELIMINAR TODO?'))return;
    try{const {data:sales,error:se}=await db.from('sales').select('id').eq('vehicle_id',id);if(se)throw se;const ids=(sales||[]).map(x=>x.id);if(ids.length){const {error:ce}=await db.from('cash_movements').delete().in('sale_id',ids);if(ce)throw ce;const {error:de}=await db.from('sales').delete().in('id',ids);if(de)throw de}const {error:ve}=await db.from('vehicles').delete().eq('id',id);if(ve)throw ve;toast('Vehículo eliminado');await clientsPage()}catch(e){toast(e.message||'No se pudo eliminar el vehículo.',true)}
  }

  async function deleteClient(id,name){
    if(!canDeleteClient())return;if(!confirm(`Primera confirmación\n\n¿Eliminar al cliente «${name}»?`))return;if(!confirm('SEGUNDA CONFIRMACIÓN\n\nSe eliminarán sus vehículos y registros de ventas/servicios.\n\n¿ACEPTAR Y ELIMINAR TODO?'))return;
    try{const {data:sales,error:se}=await db.from('sales').select('id').eq('client_id',id);if(se)throw se;const ids=(sales||[]).map(x=>x.id);if(ids.length){const {error:ce}=await db.from('cash_movements').delete().in('sale_id',ids);if(ce)throw ce;const {error:de}=await db.from('sales').delete().in('id',ids);if(de)throw de}const {error:ve}=await db.from('vehicles').delete().eq('client_id',id);if(ve)throw ve;const {error:cl}=await db.from('clients').delete().eq('id',id);if(cl)throw cl;toast('Cliente y registros eliminados');await clientsPage()}catch(e){toast(e.message||'No se pudo eliminar el cliente.',true)}
  }

  function getCid(card){const b=[...card.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').startsWith('clientHistory('));const m=(b?.getAttribute('onclick')||'').match(/clientHistory\('([^']+)'\)/);return m?.[1]||null}
  function getPhone(card){const e=[...card.querySelectorAll('.muted')].find(x=>/Sin teléfono|\d/.test(x.textContent||''));return (e?.textContent||'').replace(/^.*?Teléfono\s*:?\s*/i,'').replace('Sin teléfono','').trim()}

  function inject(){
    if(!canManageClient())return;const app=document.getElementById('app');if(!app||!document.getElementById('clientResults'))return;
    [...app.querySelectorAll('.card')].forEach(card=>{
      const cid=getCid(card);if(!cid)return;const name=card.querySelector('.row b')?.textContent?.trim()||'Cliente';const phone=getPhone(card);
      if(!card.querySelector('[data-hal-client-actions]')){
        const box=document.createElement('div');box.dataset.halClientActions='1';box.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px';
        const edit=document.createElement('button');edit.className='btn alt';edit.style.marginTop='0';edit.textContent='✏️ Editar cliente';edit.title='Modificar nombre y teléfono';edit.onclick=()=>editClient(cid,name,phone);box.appendChild(edit);
        if(canDeleteClient()){const del=document.createElement('button');del.className='btn red';del.style.marginTop='0';del.textContent='🗑️ Eliminar';del.title='Eliminar cliente y sus registros';del.onclick=()=>deleteClient(cid,name);box.appendChild(del)}
        const h=[...card.querySelectorAll('button')].find(x=>(x.getAttribute('onclick')||'').startsWith('clientHistory('));h?h.insertAdjacentElement('beforebegin',box):card.appendChild(box);
      }
      [...card.querySelectorAll('button[onclick^="startSale"]')].forEach(sb=>{
        const r=sb.closest('.result');if(!r||r.querySelector('[data-hal-vehicle-actions]'))return;const m=(sb.getAttribute('onclick')||'').match(/startSale\('([^']+)','([^']+)'\)/);if(!m)return;
        const v=(vehicles||[]).find(x=>x.id===m[2]);const t=(vehicleTypes||[]).find(x=>x.id===v?.vehicle_type_id)?.name||'';
        const oldText=r.querySelector('span');if(oldText)oldText.style.flex='1';r.style.display='flex';r.style.alignItems='center';r.style.gap='6px';
        const actions=document.createElement('span');actions.dataset.halVehicleActions='1';actions.style.cssText='display:flex;gap:5px;align-items:center;flex-shrink:0';
        const edit=document.createElement('button');edit.className='smallbtn';edit.textContent='✏️ Editar';edit.title='Modificar vehículo';edit.onclick=()=>editVehicle(m[2],v?.plate||'',v?.brand||'',v?.model||'',t);actions.appendChild(edit);
        const del=document.createElement('button');del.className='smallbtn';del.textContent='🗑️';del.title='Eliminar vehículo';del.onclick=()=>deleteVehicle(m[2],v?.plate||'');actions.appendChild(del);r.appendChild(actions);
      });
    });
  }

  const original=window.clientsPage;if(typeof original!=='function')return;
  window.clientsPage=async function(){await original();setTimeout(inject,50)};
  document.addEventListener('input',e=>{if(e.target?.id==='clientSearch')setTimeout(inject,50)});
  setTimeout(inject,300);
})();
