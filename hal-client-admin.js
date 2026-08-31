// Controles de administración de Clientes y Vehículos.
// Mantiene el diseño existente y añade edición de contacto para Supervisor/Administrador.
(() => {
  const canManageClient = () => typeof isAdmin === 'function' && (isAdmin() || role() === 'supervisor');

  async function editClientPhone(id, currentPhone){
    if(!canManageClient()) return;
    const value = prompt('Modificar teléfono / contacto del cliente:', currentPhone || '');
    if(value === null) return;
    const phone = value.trim() || null;
    try{
      const {error}=await db.from('clients').update({phone}).eq('id',id);
      if(error) throw error;
      toast(phone ? 'Contacto actualizado' : 'Contacto eliminado');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo actualizar el contacto.',true)}
  }

  async function deleteVehicle(id, plate){
    if(!canManageClient()) return;
    if(!confirm(`¿Eliminar el vehículo ${plate}?\n\nSe quitará del listado, pero se conservarán sus servicios históricos.`)) return;
    try{
      const {error}=await db.from('vehicles').update({active:false}).eq('id',id);
      if(error) throw error;
      toast('Vehículo eliminado');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo eliminar el vehículo.',true)}
  }

  async function deleteClient(id, name){
    if(!canManageClient()) return;
    if(!confirm(`¿Eliminar al cliente ${name}?\n\nEl cliente dejará de aparecer en Clientes. Sus servicios históricos se conservarán.`)) return;
    try{
      const {error}=await db.from('clients').update({active:false}).eq('id',id);
      if(error) throw error;
      const {error:ve}=await db.from('vehicles').update({active:false}).eq('client_id',id);
      if(ve) throw ve;
      toast('Cliente eliminado');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo eliminar el cliente.',true)}
  }

  function getClientId(card){
    const historyBtn=Array.from(card.querySelectorAll('button')).find(b=>(b.getAttribute('onclick')||'').startsWith('clientHistory('));
    const m=(historyBtn?.getAttribute('onclick')||'').match(/clientHistory\('([^']+)'\)/);
    return m?.[1] || null;
  }

  function inject(){
    if(!canManageClient()) return;
    const app=document.getElementById('app'); if(!app) return;
    const cards=Array.from(app.querySelectorAll('.card'));
    cards.forEach(card=>{
      const clientId=getClientId(card);
      if(!clientId) return;

      // Nuevo: solo Supervisor/Administrador pueden modificar el contacto.
      if(!card.querySelector('[data-hal-edit-client]')){
        const name=card.querySelector('.row b')?.textContent?.trim()||'este cliente';
        const phoneText=Array.from(card.querySelectorAll('.muted')).find(x=>/Sin teléfono|\d/.test(x.textContent||''))?.textContent?.trim()||'';
        const edit=document.createElement('button');
        edit.className='btn alt';
        edit.setAttribute('data-hal-edit-client','1');
        edit.textContent='✏️ Editar contacto';
        edit.title='Modificar teléfono del cliente';
        edit.onclick=()=>editClientPhone(clientId, phoneText==='Sin teléfono'?'':phoneText);
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
        del.title='Eliminar vehículo';
        del.onclick=()=>deleteVehicle(m[2],plate);
        result.appendChild(del);
      });

      if(card.querySelector('[data-hal-delete-client]')) return;
      const name=card.querySelector('.row b')?.textContent?.trim()||'este cliente';
      const del=document.createElement('button');
      del.className='btn red';
      del.setAttribute('data-hal-delete-client','1');
      del.textContent='🗑️ Eliminar cliente';
      del.onclick=()=>deleteClient(clientId,name);
      card.appendChild(del);
    });
  }

  const original=window.clientsPage;
  if(typeof original!=='function') return;
  window.clientsPage=async function(){await original();setTimeout(inject,0)};
})();
