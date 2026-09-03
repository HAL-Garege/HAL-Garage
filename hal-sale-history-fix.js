// Corrección puntual: conservar cliente/vehículo al entrar a Nueva venta.
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
        if (!selectedClient || selectedClient.id !== selected.clientId) selectedClient = clients.find(c => c.id === selected.clientId) || null;
        if (!selectedVehicle && selected.vehicleId) selectedVehicle = vehicles.find(v => v.id === selected.vehicleId) || null;
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
})();