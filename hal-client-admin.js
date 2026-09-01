// Administración de Clientes y Vehículos — edición y eliminación segura.
(() => {
  const canManageClient = () => typeof isAdmin === 'function' && (isAdmin() || role() === 'supervisor');
  const canDeleteClient = () => typeof isAdmin === 'function' && isAdmin();

  async function editClient(id, currentName, currentPhone){
    if(!canManageClient()) return;
    const name = prompt('Nombre del cliente:', currentName || '');
    if(name === null) return;
    const cleanName = name.trim();
    if(!cleanName) return toast('El nombre del cliente no puede quedar vacío.', true);
    const phone = prompt('Teléfono / contacto del cliente:', currentPhone || '');
    if(phone === null) return;
    const cleanPhone = phone.trim() || null;
    try{
      const {error}=await db.from('clients').update({full_name:cleanName, phone:cleanPhone}).eq('id',id);
      if(error) throw error;
      toast('Cliente actualizado correctamente');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo actualizar el cliente.',true)}
  }

  async function deleteVehicle(id, plate){
    if(!canManageClient()) return;
    if(!confirm(`Primera confirmación\n\n¿Eliminar el vehículo ${plate}?\n\nEl vehículo dejará de aparecer en el listado.`)) return;
    if(!confirm(`Segunda confirmación\n\nVas a eliminar ${plate}.\nSus servicios históricos vinculados a este vehículo también serán eliminados.\n\n¿Estás completamente seguro?`)) return;
    try{
      const {data:sales,error:se}=await db.from('sales').select('id').eq('vehicle_id',id);
      if(se) throw se;
      const ids=(sales||[]).map(x=>x.id);
      if(ids.length){
        const {error:ce}=await db.from('cash_movements').delete().in('sale_id',ids); if(ce) throw ce;
        const {error:de}=await db.from('sales').delete().in('id',ids); if(de) throw de;
      }
      const {error:ve}=await db.from('vehicles').delete().eq('id',id); if(ve) throw ve;
      toast('Vehículo y sus registros eliminados');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo eliminar el vehículo.',true)}
  }

  async function deleteClient(id, name){
    if(!canDeleteClient()) return;
    if(!confirm(`Primera confirmación\n\n¿Estás seguro de eliminar al cliente «${name}»?\n\nEsto quitará al cliente de Clientes y también eliminará sus vehículos y registros de ventas/servicios asociados.`)) return;
    if(!confirm(`SEGUNDA CONFIRMACIÓN\n\nEsta acción es permanente.\n\nCliente: ${name}\n\nSe eliminarán sus ventas, servicios, pagos/movimientos de caja y vehículos.\n\n¿ACEPTAR Y ELIMINAR TODO?`)) return;
    try{
      const {data:sales,error:se}=await db.from('sales').select('id').eq('client_id',id);
      if(se) throw se;
      const ids=(sales||[]).map(x=>x.id);
      if(ids.length){
        const {error:ce}=await db.from('cash_movements').delete().in('sale_id',ids); if(ce) throw ce;
        const {error:de}=await db.from('sales').delete().in('id',ids); if(de) throw de;
      }
      const {error:ve}=await db.from('vehicles').delete().eq('client_id',id); if(ve) throw ve;
      const {error:cl}=await db.from('clients').delete().eq('id',id); if(cl) throw cl;
      toast('Cliente y todos sus registros fueron eliminados');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo eliminar el cliente.',true)}
  }

  function getClientId(card){
    const historyBtn=Array.from(card.querySelectorAll('button')).find(b=>(b.getAttribute('onclick')||'').startsWith('clientHistory('));
    const m=(historyBtn?.getAttribute('onclick')||'').match(/clientHistory\('([^']+)'\)/);
    return m?.[1] || null;
  }

  function getPhone(card){
    const el=Array.from(card.querySelectorAll('.muted')).find(x=>/Sin teléfono|Teléfono|\d/.test(x.textContent||''));
    return (el?.textContent||'').replace(/^.*?Teléfono\s*:?\s*/i,'').trim() === 'Sin teléfono' ? '' : ((el?.textContent||'').replace(/^.*?Teléfono\s*:?\s*/i,'').trim());
  }

  function inject(){
    if(!canManageClient()) return;
    const app=document.getElementById('app'); if(!app) return;
    const cards=Array.from(app.querySelectorAll('.card'));
    cards.forEach(card=>{
      const clientId=getClientId(card); if(!clientId) return;
      const nameEl=card.querySelector('.row b');
      const name=nameEl?.textContent?.trim()||'este cliente';
      const phone=getPhone(card);

      if(!card.querySelector('[data-hal-edit-client]')){
        const edit=document.createElement('button');
        edit.className='btn alt';
        edit.setAttribute('data-hal-edit-client','1');
        edit.textContent='✏️ Editar cliente';
        edit.title='Modificar nombre y teléfono del cliente';
        edit.onclick=()=>editClient(clientId,name,phone);
        const history=Array.from(card.querySelectorAll('button')).find(b=>(b.getAttribute('onclick')||'').startsWith('clientHistory('));
        if(history) history.insertAdjacentElement('beforebegin',edit); else card.appendChild(edit);
      }

      const vehicleButtons=Array.from(card.querySelectorAll('button[onclick^="startSale"]'));
      vehicleButtons.forEach(btn=>{
        const result=btn.closest('.result');
        if(!result || result.querySelector('[data-hal-delete-vehicle]')) return;
        const plate=(result.textContent||'').replace(/^.*?🚗\s*/,'').split('·')[0].trim();
        const m=(btn.getAttribute('onclick')||'').match(/startSale\('([^']+)','([^']+)'\)/);
        if(!m) return;
        const del=document.createElement('button');
        del.className='smallbtn';
        del.setAttribute('data-hal-delete-vehicle','1');
        del.textContent='🗑️';
        del.title='Eliminar vehículo y sus registros';
        del.onclick=()=>deleteVehicle(m[2],plate);
        result.appendChild(del);
      });

      if(canDeleteClient() && !card.querySelector('[data-hal-delete-client]')){
        const del=document.createElement('button');
        del.className='btn red';
        del.setAttribute('data-hal-delete-client','1');
        del.textContent='🗑️ Eliminar cliente';
        del.title='Eliminar cliente y todos sus registros';
        del.onclick=()=>deleteClient(clientId,name);
        card.appendChild(del);
      }
    });
  }

  const original=window.clientsPage;
  if(typeof original!=='function') return;
  window.clientsPage=async function(){await original();setTimeout(inject,0)};
})();
