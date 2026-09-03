// Corrección puntual: conservar cliente/vehículo al entrar a Nueva venta y restaurar historial.
(() => {
  const selected = { clientId:null, vehicleId:null };

  const originalStartSale = window.startSale;
  if (typeof originalStartSale === 'function') {
    window.startSale = function(clientId, vehicleId) {
      selected.clientId = clientId || null;
      selected.vehicleId = vehicleId || null;
      return originalStartSale.apply(this, arguments);
    };
  }

  const originalSalePage = window.salePage;
  if (typeof originalSalePage === 'function') {
    window.salePage = async function() {
      await originalSalePage.apply(this, arguments);
      try {
        if (!selected.clientId) return;
        if (!selectedClient || selectedClient.id !== selected.clientId) {
          selectedClient = clients.find(c => c.id === selected.clientId) || null;
        }
        if (!selectedVehicle && selected.vehicleId) {
          selectedVehicle = vehicles.find(v => v.id === selected.vehicleId) || null;
        }
        const clientSelect = document.getElementById('saleClient');
        if (clientSelect && selectedClient) clientSelect.value = selectedClient.id;
        if (selectedClient && typeof selectSaleClient === 'function') selectSaleClient(selectedClient.id);
        if (selectedVehicle) {
          const vehicleSelect = document.getElementById('saleVehicle');
          if (vehicleSelect) vehicleSelect.value = selectedVehicle.id;
          if (typeof selectSaleVehicle === 'function') selectSaleVehicle(selectedVehicle.id);
        }
      } catch (e) { console.warn('HAL venta:', e); }
    };
  }

  const originalHistory = window.clientHistory;
  if (typeof originalHistory === 'function') {
    window.clientHistory = async function(clientId) {
      try {
        const { data: c, error: ce } = await db.from('clients').select('id,full_name,phone').eq('id',clientId).maybeSingle();
        if (ce) throw ce;
        if (!c) return originalHistory(clientId);
        const { data: sales, error: se } = await db.from('sales').select('id,sale_number,total,status,created_at,vehicle_id').eq('client_id',clientId).order('created_at',{ascending:false});
        if (se) throw se;
        const ids=(sales||[]).map(x=>x.id);
        const items=ids.length ? (await db.from('sale_items').select('sale_id,service_name_snapshot,price_applied,quantity,subtotal').in('sale_id',ids)).data || [] : [];
        const vs=await db.from('vehicles').select('id,plate,brand,model,vehicle_type_id').eq('client_id',clientId);
        const vehiclesLocal=vs.data||[];
        const total=(sales||[]).reduce((a,x)=>a+Number(x.total||0),0);
        const moneyLocal=n=>'S/ '+Number(n||0).toFixed(2);
        const escLocal=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
        setHTML(`<div class="title">Historial del cliente</div><div class="date">${escLocal(c.full_name)} · ${(sales||[]).length} visita(s) · ${moneyLocal(total)} acumulado</div><button class="btn alt" onclick="clientsPage()">← Volver a clientes</button><div class="card"><div class="grid"><div><div class="muted">Visitas</div><div class="metric">${(sales||[]).length}</div></div><div><div class="muted">Total gastado</div><div class="metric green">${moneyLocal(total)}</div></div></div></div>${(sales||[]).map(x=>{const v=vehiclesLocal.find(v=>v.id===x.vehicle_id),its=items.filter(i=>i.sale_id===x.id);return `<div class="card"><div class="row"><b>Venta #${escLocal(x.sale_number)}</b><span class="badge">${new Date(x.created_at).toLocaleDateString('es-PE')}</span></div><div class="muted">${v?escLocal(v.plate):'Vehículo'} · ${escLocal(x.status)}</div>${its.map(i=>`<div class="result row"><span>${escLocal(i.service_name_snapshot)} × ${i.quantity}</span><b>${moneyLocal(i.subtotal)}</b></div>`).join('')}<div class="row" style="margin-top:8px"><span>Total</span><b>${moneyLocal(x.total)}</b></div></div>`}).join('')||'<div class="card muted">Este cliente todavía no tiene servicios registrados.</div>'}`);
      } catch (e) {
        console.warn('Historial HAL:', e);
        return originalHistory(clientId);
      }
    };
  }
})();