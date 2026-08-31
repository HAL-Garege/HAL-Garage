(() => {
  const modal = html => {
    document.getElementById('halEnhModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="halEnhModal"><div class="modalbox">${html}</div></div>`);
  };
  window.closeHalEnhModal = () => document.getElementById('halEnhModal')?.remove();

  async function viewSaleEvidenceById(saleId) {
    try {
      if (!saleId) throw new Error('Venta inválida.');
      const { data: sale, error: se } = await db.from('sales').select('id,sale_number').eq('id', saleId).single();
      if (se) throw se;
      const { data: rows, error } = await db.from('sale_evidence').select('evidence_type,storage_path,created_at').eq('sale_id', sale.id).order('created_at');
      if (error) throw error;
      const images = [];
      for (const r of (rows || [])) {
        const { data, error: ue } = await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(r.storage_path, 900);
        if (!ue && data?.signedUrl) images.push({ type: r.evidence_type, url: data.signedUrl });
      }
      const label = t => t === 'plate' ? 'Placa' : 'Comprobante de pago';
      modal(`<div class="row"><b>📸 Evidencias · Venta #${esc(sale.sale_number)}</b><button class="btn alt" style="width:auto;margin:0" onclick="closeHalEnhModal()">Cerrar</button></div>
        <div class="muted" style="margin:8px 0">Fotos guardadas al finalizar el servicio.</div>
        ${images.map(i => `<div class="card"><b>${label(i.type)}</b><img src="${i.url}" class="photo-preview" style="max-height:360px"><a class="btn alt" href="${i.url}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">Abrir foto</a></div>`).join('') || '<div class="card muted">No hay fotos registradas para esta venta.</div>'}`);
    } catch (e) { toast(e.message || 'No se pudieron cargar las fotos.', true); }
  }
  window.viewSaleEvidenceById = viewSaleEvidenceById;

  async function addHistoryPhotoButtons(clientId) {
    try {
      const { data: sales, error } = await db.from('sales').select('id,sale_number').eq('client_id', clientId).order('created_at', { ascending: false });
      if (error) throw error;
      const byNumber = Object.fromEntries((sales || []).map(s => [String(s.sale_number), s.id]));
      document.querySelectorAll('#app .card').forEach(card => {
        const m = (card.textContent || '').match(/Venta\s*#\s*([0-9]+)/i);
        if (!m || card.dataset.halSalePhoto === '1') return;
        const saleId = byNumber[m[1]];
        if (!saleId) return;
        const b = document.createElement('button');
        b.className = 'btn alt'; b.textContent = '📸 Ver fotos';
        b.style.cssText = 'width:auto;margin:7px 0 0';
        b.onclick = () => viewSaleEvidenceById(saleId);
        card.appendChild(b);
        card.dataset.halSalePhoto = '1';
      });
    } catch (e) { console.warn('Fotos de historial:', e); }
  }

  const originalHistory = window.clientHistory;
  if (typeof originalHistory === 'function') {
    window.clientHistory = async function (clientId) {
      await originalHistory(clientId);
      await addHistoryPhotoButtons(clientId);
    };
  }

  // Inventory edit remains available for Admin/Supervisor without a global observer.
  async function editProduct(productId) {
    if (!(isAdmin() || role() === 'supervisor')) return toast('Solo Administrador o Supervisor puede editar productos.', true);
    try {
      const { data: p, error } = await db.from('products').select('*').eq('id', productId).single();
      if (error) throw error;
      const name = prompt('Nombre del producto', p.name); if (name === null) return;
      const unit = prompt('Unidad', p.unit_name || 'unidad'); if (unit === null) return;
      const minimum = Number(prompt('Stock mínimo', String(p.minimum_stock ?? 0))); if (!(minimum >= 0)) return toast('Stock mínimo inválido.', true);
      const { error: ue } = await db.from('products').update({ name: name.trim(), unit_name: unit.trim() || 'unidad', minimum_stock: minimum, updated_at: new Date().toISOString() }).eq('id', productId);
      if (ue) throw ue;
      const current = Number(p.stock || 0);
      const change = prompt(`Stock actual: ${current}. Escribe la NUEVA cantidad o deja vacío para conservarla.`, '');
      if (change !== null && change.trim() !== '') {
        const next = Number(change); if (!(next >= 0)) throw new Error('Stock inválido.');
        if (next !== current) {
          const { error: me } = await db.from('inventory_movements').insert({ product_id: productId, movement_type: 'adjustment', quantity: Math.abs(next - current), reason: `Edición de inventario: ${current} → ${next}`, ...createdBy() });
          if (me) throw me;
          const { error: se } = await db.from('products').update({ stock: next, updated_at: new Date().toISOString() }).eq('id', productId);
          if (se) throw se;
        }
      }
      toast('Producto actualizado correctamente'); await inventoryPage(); addInventoryEditButtons();
    } catch (e) { toast(e.message || 'No se pudo editar el producto.', true); }
  }
  window.editProduct = editProduct;
  function addInventoryEditButtons() {
    document.querySelectorAll('#app button[onclick^="inventoryMove("]').forEach(move => {
      if (move.dataset.editAdded === '1') return;
      const m = (move.getAttribute('onclick') || '').match(/inventoryMove\('([^']+)'\)/); if (!m) return;
      const edit = document.createElement('button'); edit.className = 'smallbtn'; edit.textContent = 'Editar'; edit.style.marginLeft = '5px'; edit.onclick = () => editProduct(m[1]);
      move.parentElement.appendChild(edit); move.dataset.editAdded = '1';
    });
  }
  const originalInventory = window.inventoryPage;
  if (typeof originalInventory === 'function') {
    window.inventoryPage = async function () { await originalInventory(); addInventoryEditButtons(); };
  }
})();
