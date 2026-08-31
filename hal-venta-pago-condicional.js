// Evidencia de venta según método de pago.
// Efectivo: solo placa. Yape/Plin/Transferencia: placa + comprobante.
(() => {
  const paymentPhoto = () => document.getElementById('paymentPhoto');
  const platePhoto = () => document.getElementById('platePhoto');

  function ensurePlateEvidenceUI() {
    if (document.getElementById('halPlateEvidenceBlock')) return;
    const app = document.getElementById('app');
    if (!app) return;

    const confirm = [...app.querySelectorAll('button')].find(b => /CONFIRMAR VENTA/i.test(b.textContent || ''));
    if (!confirm) return;

    const block = document.createElement('div');
    block.id = 'halPlateEvidenceBlock';
    block.className = 'card';
    block.innerHTML = `
      <div style="font-weight:800;font-size:16px">📸 Entrega / pago</div>
      <div class="muted" style="margin:4px 0 8px">Al terminar el servicio se toma la foto de la placa.</div>
      <label>Foto de placa al entregar (obligatoria)</label>
      <input id="platePhoto" type="file" accept="image/*" capture="environment" class="hidden">
      <button type="button" class="btn alt" id="halTakePlatePhoto">📷 TOMAR FOTO DE PLACA</button>
      <div id="halPlatePhotoStatus" class="muted" style="margin-top:7px">Sin foto seleccionada</div>
      <img id="halPlatePreview" class="photo-preview hidden" alt="Foto de placa">
    `;

    confirm.parentElement.insertBefore(block, confirm);

    const input = document.getElementById('platePhoto');
    const button = document.getElementById('halTakePlatePhoto');
    const status = document.getElementById('halPlatePhotoStatus');
    const preview = document.getElementById('halPlatePreview');

    button.onclick = () => input.click();
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      status.textContent = '✅ Foto seleccionada: ' + file.name;
      status.className = 'success';
      preview.src = URL.createObjectURL(file);
      preview.classList.remove('hidden');
    };
  }

  function currentMethod() {
    try {
      if (typeof salePayment !== 'undefined') return salePayment === 'cash' ? 'cash' : 'digital';
    } catch (_) {}
    const active = [...document.querySelectorAll('#app button')].find(b =>
      b.classList.contains('active') && /Efectivo|Yape|Plin|Transfer/i.test(b.textContent || '')
    );
    if (active) return /Efectivo/i.test(active.textContent || '') ? 'cash' : 'digital';
    return 'cash';
  }

  function paymentBlock() {
    const input = paymentPhoto();
    if (!input) return null;
    const labels = [...document.querySelectorAll('#app label')];
    const label = labels.find(x => /^Comprobante de pago/i.test((x.textContent || '').trim()));
    if (label) {
      let el = label.parentElement;
      for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
        const text = el.textContent || '';
        if (/Comprobante de pago/i.test(text) && /Tomar foto del comprobante/i.test(text)) return el;
      }
      return label.parentElement || label;
    }
    return input.parentElement;
  }

  function sync() {
    ensurePlateEvidenceUI();
    const input = paymentPhoto();
    if (!input) return;
    const block = paymentBlock();
    if (!block) return;
    const cash = currentMethod() === 'cash';
    input.required = !cash;
    if (cash) input.removeAttribute('required');
    else input.setAttribute('required', 'required');
    if (cash) {
      try { input.value = ''; } catch (_) {}
      block.classList.add('hidden');
      block.style.display = 'none';
    } else {
      block.classList.remove('hidden');
      block.style.display = '';
    }

    const plate = platePhoto();
    if (plate) plate.required = true;
  }

  function scheduleSync() {
    [0,50,150,400,900].forEach(ms => setTimeout(sync, ms));
  }

  document.addEventListener('click', e => {
    const b = e.target.closest?.('#app button');
    if (b && /Efectivo|Yape|Plin|Transfer/i.test(b.textContent || '')) scheduleSync();
  }, false);

  const observer = new MutationObserver(() => scheduleSync());
  observer.observe(document.getElementById('app') || document.body, {
    childList:true, subtree:true, attributes:true, attributeFilter:['class','required']
  });
  scheduleSync();

  // Placa siempre obligatoria; comprobante únicamente en Yape, Plin o transferencia.
  window.finishSale = async function() {
    if (!canOperate()) return toast('No tienes permiso.', true);
    if (!selectedClient || !selectedVehicle) return toast('Selecciona cliente y vehículo.', true);
    if (!saleItems.length) return toast('Agrega al menos un servicio.', true);

    ensurePlateEvidenceUI();
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
