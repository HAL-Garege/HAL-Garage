// Evidencia de venta según método de pago.
// Efectivo: solo placa. Yape/Plin/Transferencia: placa + comprobante.
// También corrige la validación final de finishSale para que efectivo no exija comprobante.
(() => {
  const paymentPhoto = () => document.getElementById('paymentPhoto');
  const platePhoto = () => document.getElementById('platePhoto');
  const isSalePage = () => {
    const app = document.getElementById('app');
    return !!app && /Efectivo|Yape|Plin|Transfer/i.test(app.textContent || '');
  };
  const wrapperOf = el => el?.closest('label')?.parentElement || el?.parentElement;

  function currentMethod() {
    const active = [...document.querySelectorAll('#app button')].find(b =>
      b.classList.contains('active') && /Efectivo|Yape|Plin|Transfer/i.test(b.textContent || '')
    );
    if (active) return /Efectivo/i.test(active.textContent) ? 'cash' : 'digital';
    const selected = document.querySelector('#app [data-payment-method].active');
    if (selected) return /Efectivo/i.test(selected.textContent || '') ? 'cash' : 'digital';
    return window.salePayment === 'cash' ? 'cash' : (window.salePayment || null);
  }

  function sync() {
    if (!isSalePage()) return;
    const input = paymentPhoto();
    if (!input) return;
    const method = currentMethod();
    if (!method) return;
    const wrapper = wrapperOf(input);
    const label = input.closest('label') || document.querySelector('label[for="paymentPhoto"]');
    if (method === 'cash') {
      input.required = false;
      input.removeAttribute('required');
      input.value = '';
      if (wrapper) wrapper.style.display = 'none';
      if (label && label !== wrapper) label.style.display = 'none';
    } else {
      input.required = true;
      input.setAttribute('required', 'required');
      if (wrapper) wrapper.style.display = '';
      if (label && label !== wrapper) label.style.display = '';
    }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest?.('#app button');
    if (!b || !/Efectivo|Yape|Plin|Transfer/i.test(b.textContent || '')) return;
    setTimeout(sync, 0);
    setTimeout(sync, 80);
  }, false);

  const obs = new MutationObserver(() => {
    if (isSalePage()) sync();
  });
  obs.observe(document.getElementById('app') || document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class']});
  setTimeout(sync, 250);
  setTimeout(sync, 800);

  // Reemplaza únicamente la validación final, manteniendo la lógica de venta existente.
  // Para efectivo no se sube ni se registra un comprobante de pago.
  const originalFinishSale = window.finishSale;
  window.finishSale = async function() {
    if (!canOperate()) return toast('No tienes permiso.', true);
    if (!selectedClient || !selectedVehicle) return toast('Selecciona cliente y vehículo.', true);
    if (!saleItems.length) return toast('Agrega al menos un servicio.', true);

    const plate = platePhoto()?.files?.[0];
    const payment = paymentPhoto()?.files?.[0];
    const method = salePayment || 'cash';

    if (!plate) return toast('La foto de placa es obligatoria.', true);
    if (method !== 'cash' && !payment) return toast('Para Yape, Plin o transferencia debes adjuntar el comprobante.', true);

    // Si por alguna razón la función original ya fue reemplazada por otra corrección
    // compatible, usamos esta versión completa para evitar la validación antigua.
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

      const {error: ie} = await db.from('sale_items').insert(
        saleItems.map(x => ({...x, sale_id: sale.id}))
      );
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
