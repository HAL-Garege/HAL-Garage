// Venta: servicios sin precio fijo, monto manual y motivo/observación.
// No modifica clientes, historial, caja ni la estructura de vehículos.
(() => {
  function serviceRows() {
    const box = document.getElementById('serviceList');
    if (!box) return;
    if (!selectedVehicle) {
      box.innerHTML = '<div class="muted">Selecciona un vehículo.</div>';
      updateTotalManual();
      return;
    }
    box.innerHTML = services.map(s => {
      const item = saleItems.find(i => i.service_id === s.id);
      const active = !!item;
      return `<div class="service ${active ? 'active' : ''}" onclick="toggleServiceManual('${s.id}')">
        <span>${esc(s.name)}</span><b>${active ? '✓ Seleccionado' : 'Seleccionar'}</b>
      </div>${active ? `<div class="card" style="margin-top:4px;margin-bottom:8px" onclick="event.stopPropagation()">
        <label>Monto cobrado (S/)</label>
        <input type="number" min="0" step="0.01" value="${Number(item.price_applied || 0)}" placeholder="Ej. 15.00" oninput="setManualAmount('${s.id}',this.value)">
        <label>Motivo / observación del precio</label>
        <input type="text" value="${esc(item.price_reason || '')}" placeholder="Ej. Cliente frecuente, amistad, primera visita..." oninput="setManualReason('${s.id}',this.value)">
      </div>` : ''}`;
    }).join('') || '<div class="muted">No hay servicios registrados.</div>';
    updateTotalManual();
  }

  function toggleServiceManual(id) {
    if (!selectedVehicle) return;
    const idx = saleItems.findIndex(x => x.service_id === id);
    if (idx >= 0) {
      saleItems.splice(idx, 1);
    } else {
      const s = services.find(x => x.id === id);
      if (!s) return;
      saleItems.push({
        service_id: id,
        vehicle_type_id: selectedVehicle.vehicle_type_id || null,
        service_name_snapshot: s.name,
        price_applied: 0,
        price_reason: '',
        quantity: 1,
        subtotal: 0
      });
    }
    serviceRows();
  }

  function setManualAmount(id, value) {
    const item = saleItems.find(x => x.service_id === id);
    if (!item) return;
    const amount = Number(value);
    item.price_applied = Number.isFinite(amount) && amount >= 0 ? amount : 0;
    item.subtotal = item.price_applied * Number(item.quantity || 1);
    updateTotalManual();
  }

  function setManualReason(id, value) {
    const item = saleItems.find(x => x.service_id === id);
    if (!item) return;
    item.price_reason = String(value || '');
  }

  function updateTotalManual() {
    const total = saleItems.reduce((a, x) => a + Number(x.subtotal || 0), 0);
    const e = document.getElementById('saleTotal');
    if (e) e.textContent = money(total);
  }

  window.toggleServiceManual = toggleServiceManual;
  window.setManualAmount = setManualAmount;
  window.setManualReason = setManualReason;
  window.updateTotalManual = updateTotalManual;
  window.renderServices = serviceRows;
  window.toggleService = toggleServiceManual;
  window.updateTotal = updateTotalManual;

  const originalSelectSaleVehicle = window.selectSaleVehicle;
  if (typeof originalSelectSaleVehicle === 'function') {
    window.selectSaleVehicle = function(id) {
      const result = originalSelectSaleVehicle.apply(this, arguments);
      const info = document.getElementById('saleVehicleInfo');
      if (info && selectedVehicle) {
        info.innerHTML = `<div class="result"><b>${esc(selectedVehicle.plate)}</b> · ${esc(selectedVehicle.brand || '')} ${esc(selectedVehicle.model || '')}</div>`;
      }
      return result;
    };
  }

  const originalFinishSale = window.finishSale;
  if (typeof originalFinishSale === 'function') {
    window.finishSale = async function() {
      for (const item of saleItems) {
        if (!(Number(item.price_applied) >= 0)) return toast('Ingresa un monto válido en cada servicio.', true);
        item.subtotal = Number(item.price_applied) * Number(item.quantity || 1);
        const reason = String(item.price_reason || '').trim();
        if (reason) item.service_name_snapshot = `${item.service_name_snapshot} — ${reason}`;
      }
      updateTotalManual();
      return originalFinishSale.apply(this, arguments);
    };
  }

  const originalSalePage = window.salePage;
  if (typeof originalSalePage === 'function') {
    window.salePage = async function() {
      await originalSalePage.apply(this, arguments);
      serviceRows();
      const info = document.getElementById('saleVehicleInfo');
      if (info && selectedVehicle) {
        info.innerHTML = `<div class="result"><b>${esc(selectedVehicle.plate)}</b> · ${esc(selectedVehicle.brand || '')} ${esc(selectedVehicle.model || '')}</div>`;
      }
    };
  }
})();
