// Club HAL Garage: acumula puntos automáticamente al confirmar una venta.
// Cambio aislado: no modifica la venta, historial, caja, vehículos ni precios.
(() => {
  const originalFinishSale = window.finishSale;
  if (typeof originalFinishSale !== 'function') return;

  window.finishSale = async function() {
    const clientId = selectedClient?.id || null;
    const vehicleId = selectedVehicle?.id || null;
    const startedAt = new Date().toISOString();

    const result = await originalFinishSale.apply(this, arguments);

    // La función original muestra sus propios errores y no lanza la excepción.
    // Si no se creó una venta, simplemente no hay nada que sincronizar.
    if (!clientId || !vehicleId) return result;

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

      if (error || !sale) return result;

      const { data, error: syncError } = await db.rpc('award_club_points_for_sale', {
        p_sale_id: sale.id
      });

      if (syncError) {
        console.warn('Club HAL Garage: no se pudieron sincronizar los puntos.', syncError);
        return result;
      }

      const awarded = Number(data?.awarded_points || 0);
      if (awarded > 0) {
        console.log(`Club HAL Garage: ${awarded} puntos acreditados.`);
      }
    } catch (e) {
      // La venta ya quedó registrada: un fallo del Club nunca bloquea la venta.
      console.warn('Club HAL Garage: sincronización de puntos omitida.', e);
    }

    return result;
  };
})();
