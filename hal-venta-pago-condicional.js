// Nueva venta sin solicitud de fotografías.
// Se mantienen únicamente el registro de la venta, el método de pago y sus movimientos de caja.
(() => {
  function removeEvidenceUI() {
    const ids = ['platePhoto', 'paymentPhoto', 'halPlateEvidenceBlock'];
    ids.forEach(id => document.getElementById(id)?.closest('.card')?.remove());

    // Si la tarjeta contiene ambos campos, el primer selector ya la elimina.
    document.querySelectorAll('#app label').forEach(label => {
      const t = (label.textContent || '').trim();
      if (/Foto de placa|Comprobante de pago|Entrega \/ pago/i.test(t)) {
        const card = label.closest('.card');
        if (card) card.remove();
      }
    });

    // Actualizar el subtítulo de Nueva venta para no mencionar evidencias.
    const title = [...document.querySelectorAll('#app .title')].find(x => /Nueva venta/i.test(x.textContent || ''));
    if (title) {
      const date = title.nextElementSibling;
      if (date && /evidencia/i.test(date.textContent || '')) date.textContent = 'Registra servicios y método de pago';
    }
  }

  function hideEvidenceSoon() {
    [0, 80, 250, 600].forEach(ms => setTimeout(removeEvidenceUI, ms));
  }

  // La pantalla de venta es dinámica; se limpia solo al entrar a Nueva venta.
  const originalGo = window.go;
  if (typeof originalGo === 'function') {
    window.go = function(p) {
      const result = originalGo.apply(this, arguments);
      if (p === 'sale') hideEvidenceSoon();
      return result;
    };
  }

  // Por si otra función navega directamente a la pantalla de venta.
  const originalSetHTML = window.setHTML;
  if (typeof originalSetHTML === 'function') {
    window.setHTML = function(html) {
      const result = originalSetHTML.apply(this, arguments);
      if (/Nueva venta/i.test(String(html || ''))) hideEvidenceSoon();
      return result;
    };
  }

  // La función original exigía fotos; se reemplaza por una versión que no solicita ninguna.
  window.finishSale = async function() {
    if (!canOperate()) return toast('No tienes permiso.', true);
    if (!selectedClient || !selectedVehicle) return toast('Selecciona cliente y vehículo.', true);
    if (!saleItems.length) return toast('Agrega al menos un servicio.', true);

    const total = saleItems.reduce((a, x) => a + Number(x.subtotal || 0), 0);
    let method = 'cash';
    try { method = (typeof salePayment !== 'undefined' && salePayment) || 'cash'; } catch (_) {}

    try {
      const {data: sale, error} = await db.from('sales').insert({
        client_id: selectedClient.id,
        vehicle_id: selectedVehicle.id,
        total,
        status: 'confirmed',
        ...createdBy()
      }).select().single();
      if (error) throw error;

      const {error: ie} = await db.from('sale_items').insert(saleItems.map(x => ({...x, sale_id: sale.id})));
      if (ie) throw ie;

      const {error: pe} = await db.from('payments').insert({
        sale_id: sale.id,
        method,
        amount: total,
        ...createdBy()
      });
      if (pe) throw pe;

      const {error: ce} = await db.from('cash_movements').insert({
        movement_type: 'income',
        payment_method: method,
        amount: total,
        sale_id: sale.id,
        ...createdBy()
      });
      if (ce) throw ce;

      toast('Venta registrada correctamente');
      selectedClient = null;
      selectedVehicle = null;
      saleItems = [];
      saleEvidence = {plate:null, payment:null};
      setTimeout(() => go('dashboard'), 700);
    } catch (e) {
      toast(e.message, true);
    }
  };

  // Limpiar también si la pantalla ya estaba renderizada cuando carga este script.
  hideEvidenceSoon();
})();
