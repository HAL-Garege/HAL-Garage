// Evidencia de venta según método de pago.
// Efectivo: solo placa. Yape/Plin/Transferencia: placa + comprobante.
(() => {
  const paymentPhoto = () => document.getElementById('paymentPhoto');
  const platePhoto = () => document.getElementById('platePhoto');

  function currentMethod() {
    // Primero usa el estado real de la venta.
    try {
      if (typeof salePayment !== 'undefined') return salePayment === 'cash' ? 'cash' : 'digital';
    } catch (_) {}

    // Respaldo para interfaces que marcan el botón activo.
    const buttons = [...document.querySelectorAll('#app button')];
    const active = buttons.find(b => b.classList.contains('active') && /Efectivo|Yape|Plin|Transfer/i.test(b.textContent || ''));
    if (active) return /Efectivo/i.test(active.textContent || '') ? 'cash' : 'digital';
    return 'cash';
  }

  function paymentSection() {
    const input = paymentPhoto();
    if (!input) return null;

    // Busca el bloque que contiene específicamente el texto del comprobante.
    let el = input;
    while (el && el !== document.body) {
      const text = (el.textContent || '').trim();
      if (/Comprobante de pago/i.test(text) && !/Foto de placa al entregar/i.test(text)) return el;
      el = el.parentElement;
    }

    // Respaldo: etiqueta del input y su contenedor inmediato.
    const label = input.closest('label');
    return label?.parentElement || label || input.parentElement;
  }

  function sync() {
    const input = paymentPhoto();
    if (!input) return;

    const method = currentMethod();
    const section = paymentSection();
    if (!section) return;

    if (method === 'cash') {
      input.required = false;
      input.removeAttribute('required');
      try { input.value = ''; } catch (_) {}
      section.style.display = 'none';
    } else {
      input.required = true;
      input.setAttribute('required', 'required');
      section.style.display = '';
    }
  }

  // Reaplica la UI después de cambiar el método o reconstruir la pantalla.
  document.addEventListener('click', e => {
    const b = e.target.closest?.('#app button');
    if (!b || !/Efectivo|Yape|Plin|Transfer/i.test(b.textContent || '')) return;
    setTimeout(sync, 0);
    setTimeout(sync, 80);
    setTimeout(sync, 250);
  }, false);

  const observer = new MutationObserver(() => setTimeout(sync, 0));
  const target = document.getElementById('app') || document.body;
  observer.observe(target, {childList:true, subtree:true, attributes:true, attributeFilter:['class','required']});

  setTimeout(sync, 100);
  setTimeout(sync, 500);
  setTimeout(sync, 1200);

  // Validación y registro: placa siempre; comprobante solo para pagos digitales.
  window.finishSale = async function() {
    if (!canOperate()) return toast('No tienes permiso.', true);
    if (!selectedClient || !selectedVehicle) return toast('Selecciona cliente y vehículo.', true);
    if (!saleItems.length) return toast('Agrega al menos un servicio.', true);

    const plate = platePhoto()?.files?.[0];
    const payment = paymentPhoto()?.files?.[0];
    let method = 'cash';
    try { method = (typeof salePayment !== 'undefined' && salePayment) || 'cash'; } catch (_) {}

    if (!plate) return toast('La foto de placa es obligatoria.', true);
    if (method !== 'cash' && !payment) return toast('Para Yape, Plin o transferencia debes adjuntar el comprobante.', true);

    const total = saleItems.reduce((a, x) => a + Number(x.subtotal || 0), 0);
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

      await uploadEvidence(sale.id, 'plate', plate);
      if (method !== 'cash') await uploadEvidence(sale.id, 'payment', payment);

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
})();
