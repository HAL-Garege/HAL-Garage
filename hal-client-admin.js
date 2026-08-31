// Controles de administración de Clientes y Vehículos.
// No cambia el diseño existente: solo añade acciones de eliminación para Supervisor/Administrador.
(() => {
  const canDelete = () => typeof isAdmin === 'function' && (isAdmin() || role() === 'supervisor');

  async function deleteVehicle(id, plate){
    if(!canDelete()) return;
    if(!confirm(`¿Eliminar el vehículo ${plate}?\n\nSe quitará del listado, pero se conservarán sus servicios históricos.`)) return;
    try{
      const {error}=await db.from('vehicles').update({active:false}).eq('id',id);
      if(error) throw error;
      toast('Vehículo eliminado');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo eliminar el vehículo.',true)}
  }

  async function deleteClient(id, name){
    if(!canDelete()) return;
    if(!confirm(`¿Eliminar al cliente ${name}?\n\nEl cliente dejará de aparecer en Clientes. Sus servicios históricos se conservarán.`)) return;
    try{
      const {error}=await db.from('clients').update({active:false}).eq('id',id);
      if(error) throw error;
      // También ocultamos sus vehículos activos del catálogo, sin borrar el historial.
      const {error:ve}=await db.from('vehicles').update({active:false}).eq('client_id',id);
      if(ve) throw ve;
      toast('Cliente eliminado');
      await clientsPage();
    }catch(e){toast(e.message||'No se pudo eliminar el cliente.',true)}
  }

  function inject(){
    if(!canDelete()) return;
    const app=document.getElementById('app'); if(!app) return;
    // Cliente: el botón se coloca en cada tarjeta, junto a las acciones existentes.
    const cards=Array.from(app.querySelectorAll('.card'));
    cards.forEach(card=>{
      const vehicleButtons=Array.from(card.querySelectorAll('button[onclick^="startSale"]'));
      vehicleButtons.forEach(btn=>{
        const result=btn.closest('.result');
        if(!result || result.querySelector('[data-hal-delete-vehicle]')) return;
        const plate=(result.textContent||'').replace(/^.*?🚗\s*/,'').split('·')[0].trim();
        const m=(btn.getAttribute('onclick')||'').match(/startSale\('([^']+)','([^']+)'\)/);
        if(!m) return;
        const del=document.createElement('button');del.className='smallbtn';del.setAttribute('data-hal-delete-vehicle','1');del.textContent='🗑️';del.title='Eliminar vehículo';del.onclick=()=>deleteVehicle(m[2],plate);result.appendChild(del);
      });
      if(card.querySelector('[data-hal-delete-client]')) return;
      const historyBtn=Array.from(card.querySelectorAll('button')).find(b=>(b.getAttribute('onclick')||'').startsWith('clientHistory('));
      if(!historyBtn) return;
      const m=(historyBtn.getAttribute('onclick')||'').match(/clientHistory\('([^']+)'\)/);if(!m)return;
      const name=card.querySelector('.row b')?.textContent?.trim()||'este cliente';
      const del=document.createElement('button');del.className='btn red';del.setAttribute('data-hal-delete-client','1');del.textContent='🗑️ Eliminar cliente';del.onclick=()=>deleteClient(m[1],name);card.appendChild(del);
    });
  }

  const original=window.clientsPage;
  if(typeof original!=='function') return;
  window.clientsPage=async function(){await original();setTimeout(inject,0)};
})();
