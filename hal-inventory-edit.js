// Inventario: botón Editar por producto para Administrador/Supervisor.
(() => {
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
      toast('Producto actualizado correctamente');
      await inventoryPage();
      addInventoryEditButtons();
    } catch (e) { toast(e.message || 'No se pudo editar el producto.', true); }
  }
  window.halEditInventoryProduct = editProduct;

  function addInventoryEditButtons() {
    document.querySelectorAll('#app button[onclick^="inventoryMove("]').forEach(move => {
      if (move.dataset.halInventoryEdit === '1') return;
      const m = (move.getAttribute('onclick') || '').match(/inventoryMove\('([^']+)'\)/);
      if (!m) return;
      const edit = document.createElement('button');
      edit.className = 'smallbtn'; edit.textContent = 'Editar'; edit.style.marginLeft = '5px';
      edit.onclick = () => editProduct(m[1]);
      move.parentElement.appendChild(edit);
      move.dataset.halInventoryEdit = '1';
    });
  }

  const originalInventory = window.inventoryPage;
  if (typeof originalInventory === 'function') {
    window.inventoryPage = async function () {
      await originalInventory();
      addInventoryEditButtons();
    };
  }
  window.halAddInventoryEditButtons = addInventoryEditButtons;
})();