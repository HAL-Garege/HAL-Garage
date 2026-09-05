// Club HAL Garage: acumula puntos automáticamente al confirmar una venta.
// Cambio aislado: no modifica la venta, historial, caja, vehículos ni precios.
(() => {
  let installed = false;
  const install = () => {
    if (installed || typeof window.finishSale !== 'function') return;
    installed = true;
    const originalFinishSale = window.finishSale;
    window.finishSale = async function() {
      const clientId = window.selectedClient?.id || selectedClient?.id || null;
      const vehicleId = window.selectedVehicle?.id || selectedVehicle?.id || null;
      const startedAt = new Date().toISOString();
      const result = await originalFinishSale.apply(this, arguments);
      if (!clientId || !vehicleId) return result;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const { data: sale, error } = await db
            .from('sales')
            .select('id,total,status,sale_number,created_at')
            .eq('client_id', clientId)
            .eq('vehicle_id', vehicleId)
            .eq('status', 'confirmed')
            .gte('created_at', startedAt)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!error && sale) {
            const { data, error: syncError } = await db.rpc('award_club_points_for_sale', { p_sale_id: sale.id });
            if (!syncError) {
              const awarded = Number(data?.awarded_points || 0);
              if (awarded > 0) console.log(`Club HAL Garage: ${awarded} puntos acreditados.`);
              return result;
            }
          }
        } catch (e) {
          console.warn('Club HAL Garage: intento de sincronización omitido.', e);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      console.warn('Club HAL Garage: no se pudo sincronizar la venta con el Club.');
      return result;
    };
  };
  install();
  if (!installed) {
    const timer = setInterval(() => {
      install();
      if (installed) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 10000);
  }
})();
