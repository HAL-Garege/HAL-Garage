// Evidencia de venta según método de pago.
// Efectivo: solo placa. Yape/Plin/Transferencia: placa + comprobante.
(() => {
  const originalSalePage = window.salePage;
  if (typeof originalSalePage !== 'function') return;

  function updatePaymentEvidenceUI() {
    const payment = window.salePayment || 'cash';
    const label = document.querySelector('label[for="paymentPhoto"]');
    const input = document.getElementById('paymentPhoto');
    if (!input) return;
    const wrapper = input.closest('label')?.parentElement || input.parentElement;
    const needsProof = payment !== 'cash';
    if (label) label.textContent = needsProof ? 'Comprobante de pago (obligatorio)' : 'Comprobante de pago (no requerido en efectivo)';
    if (!needsProof) {
      input.value = '';
      window.saleEvidence = window.saleEvidence || {plate:null,payment:null};
      window.saleEvidence.payment = null;
      const preview = document.getElementById('paymentPreview');
      if (preview) { preview.src=''; preview.classList.add('hidden'); }
      if (wrapper) wrapper.style.display='none';
    } else if (wrapper) wrapper.style.display='';
  }

  const oldSetPay = window.setPay;
  window.setPay = function(method) {
    if (typeof oldSetPay === 'function') oldSetPay(method);
    updatePaymentEvidenceUI();
  };

  const oldFinishSale = window.finishSale;
  window.finishSale = async function() {
    if (window.salePayment !== 'cash' && !document.getElementById('paymentPhoto')?.files?.[0]) {
      if (typeof toast === 'function') toast('Para Yape, Plin o transferencia debes adjuntar el comprobante.', true);
      return;
    }
    return typeof oldFinishSale === 'function' ? oldFinishSale() : undefined;
  };

  window.salePage = async function() {
    await originalSalePage();
    updatePaymentEvidenceUI();
  };
})();