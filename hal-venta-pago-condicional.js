// Evidencia de venta por método de pago + captura rápida de fotos.
// Efectivo: SOLO placa. Yape/Plin/Transferencia: placa + comprobante.
// Este parche no reemplaza la pantalla de Ventas ni el flujo de guardado.
(() => {
  let installed = false;

  function paymentMethod() {
    try { return String(salePayment || 'cash').toLowerCase(); } catch (_) {}
    const active = [...document.querySelectorAll('#app button')].find(b => b.classList.contains('active') && /Efectivo|Yape|Plin|Transfer/i.test(b.textContent || ''));
    if (active) return /Efectivo/i.test(active.textContent || '') ? 'cash' : 'digital';
    return 'cash';
  }

  function getPlateInput() {
    const direct = document.getElementById('platePhoto');
    if (direct) return direct;
    const inputs = [...document.querySelectorAll('#app input[type="file"]')];
    return inputs.find(i => {
      const box = i.parentElement?.parentElement || i.parentElement;
      return /placa/i.test((box?.textContent || '') + ' ' + (i.getAttribute('aria-label') || '') + ' ' + (i.name || '') + ' ' + (i.id || ''));
    }) || inputs[0] || null;
  }

  function getPaymentInput() { return document.getElementById('paymentPhoto'); }

  function installLexicalBridge() {
    try {
      (0, eval)(`window.__halSetSaleEvidence = function(t,f){ try { saleEvidence[t]=f; } catch(e){} }; window.__halGetSalePayment = function(){ try{return salePayment;}catch(e){return 'cash';} };`);
    } catch (_) {}
  }

  function patchFinishSaleCondition() {
    try {
      (0, eval)(`(() => {
        if (window.__halFinishSaleConditionalPatched || typeof finishSale !== 'function') return;
        const original = finishSale;
        const originalSource = original.toString();
        let src = originalSource;
        src = src.replace(/!saleEvidence\\.plate\\s*\\|\\|\\s*!saleEvidence\\.payment/g, "!saleEvidence.plate || (salePayment !== 'cash' && !saleEvidence.payment)");
        src = src.replace(/!saleEvidence\\.plate\\|\\|!saleEvidence\\.payment/g, "!saleEvidence.plate || (salePayment !== 'cash' && !saleEvidence.payment)");
        if (src !== originalSource) {
          finishSale = (0, eval)('(' + src + ')');
          window.__halFinishSaleConditionalPatched = true;
        }
      })()`);
    } catch (e) { console.warn('HAL: no se pudo adaptar la validación de venta', e); }
  }

  function styleInput(input, type) {
    if (!input) return;
    input.accept = 'image/*';
    input.setAttribute('accept','image/*');
    input.setAttribute('capture','environment');
    input.removeAttribute('required');
    if (input.dataset.halEvidenceBound) return;
    input.dataset.halEvidenceBound = '1';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      installLexicalBridge();
      try { window.__halSetSaleEvidence(type, file); } catch (_) {}
      const status = input.parentElement?.querySelector('.hal-photo-status');
      if (status) status.textContent = '✅ Foto seleccionada';
    }, {passive:true});
  }

  function addCameraButton(input, type) {
    if (!input || input.dataset.halCameraButton) return;
    input.dataset.halCameraButton = '1';
    styleInput(input, type);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn alt';
    b.style.marginTop = '6px';
    b.textContent = type === 'plate' ? '📷 TOMAR FOTO DE PLACA' : '🧾 TOMAR FOTO DEL COMPROBANTE';
    b.onclick = () => input.click();
    const status = document.createElement('div');
    status.className = 'hal-photo-status muted';
    status.style.marginTop = '5px';
    status.textContent = 'Sin foto seleccionada';
    input.insertAdjacentElement('afterend', b);
    b.insertAdjacentElement('afterend', status);
  }

  function refresh() {
    const app = document.getElementById('app');
    if (!app || !/Efectivo|Yape|Plin|Transfer/i.test(app.textContent || '')) return;
    installLexicalBridge();
    const plate = getPlateInput();
    const payment = getPaymentInput();
    if (plate) addCameraButton(plate, 'plate');
    if (payment) addCameraButton(payment, 'payment');

    const digital = paymentMethod() !== 'cash';
    if (payment) {
      const label = document.querySelector('label[for="paymentPhoto"]');
      if (label) label.textContent = digital ? 'Comprobante de pago (obligatorio)' : 'Comprobante de pago (no requerido en efectivo)';
      payment.required = false;
      payment.removeAttribute('required');
      const button = payment.nextElementSibling;
      const status = button?.nextElementSibling;
      if (digital) {
        payment.style.display = '';
        if (button) button.style.display = '';
        if (status?.classList?.contains('hal-photo-status')) status.style.display = '';
        if (label) label.style.display = '';
      } else {
        payment.value = '';
        try { window.__halSetSaleEvidence('payment', null); } catch (_) {}
        payment.style.display = 'none';
        if (button) button.style.display = 'none';
        if (status?.classList?.contains('hal-photo-status')) status.style.display = 'none';
        if (label) label.style.display = 'none';
      }
    }
    patchFinishSaleCondition();
  }

  function hookSetPay() {
    try {
      (0, eval)(`(() => {
        if (window.__halSetPayConditionalPatched || typeof setPay !== 'function') return;
        const old = setPay;
        setPay = function(method){ const r = old.apply(this, arguments); setTimeout(window.__halRefreshSaleEvidence, 0); return r; };
        window.__halSetPayConditionalPatched = true;
      })()`);
    } catch (_) {}
  }

  window.__halRefreshSaleEvidence = refresh;

  document.addEventListener('click', e => {
    const b = e.target.closest?.('#app button');
    if (b && /Efectivo|Yape|Plin|Transfer/i.test(b.textContent || '')) {
      setTimeout(refresh, 0);
      setTimeout(refresh, 120);
    }
  }, true);

  const observer = new MutationObserver(() => refresh());

  function start() {
    if (installed) return;
    installed = true;
    installLexicalBridge();
    hookSetPay();
    patchFinishSaleCondition();
    refresh();
    // Observe only additions/removals. We deliberately do NOT observe class/style changes,
    // avoiding the repeated work that was making the Sales screen feel slow.
    observer.observe(document.getElementById('app') || document.body, {childList:true, subtree:true});
  }

  const timer = setInterval(() => {
    try {
      if (typeof salePage === 'function' || document.getElementById('app')) {
        clearInterval(timer);
        start();
      }
    } catch (_) {}
  }, 100);
  setTimeout(() => clearInterval(timer), 10000);
})();
