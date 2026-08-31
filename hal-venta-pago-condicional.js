// Regla de evidencia de venta: no reemplaza salePage ni finishSale.
// Solo ajusta la interfaz existente según el método de pago.
(() => {
  const paymentPhoto = () => document.getElementById('paymentPhoto');
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
    return null;
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
})();
