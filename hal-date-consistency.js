// HAL Garage — fechas reales para historial, inicio y caja
// Las ventas se contabilizan por service_date. Los gastos mantienen created_at.
(function(){
  function localDateISO(d=new Date()){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function saleDate(x){return x.service_date||String(x.created_at||'').slice(0,10)}

  window.dashboard=async function(){
    try{
      const today=localDateISO();
      const [sales,expenses,allClients,low]=await Promise.all([
        q('sales',db.from('sales').select('id,total,status,created_at,service_date').eq('service_date',today).neq('status','voided')),
        q('expenses',db.from('expenses').select('id,amount,created_at').gte('created_at',today+'T00:00:00').lt('created_at',today+'T23:59:59.999')),
        q('clients',db.from('clients').select('id,full_name,phone').eq('active',true).order('full_name')),
        q('products',db.from('products').select('id,name,stock,minimum_stock').eq('active',true).order('name'))
      ]);
      const income=sales.reduce((a,x)=>a+Number(x.total||0),0),expense=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
      setHTML(`<div class="title">Inicio</div><div class="date">${fmtDate()}</div>
      <div class="grid"><div class="card"><div class="muted">Ventas hoy</div><div class="metric green">${money(income)}</div></div>
      <div class="card"><div class="muted">Gastos hoy</div><div class="metric red">${money(expense)}</div></div>
      <div class="card"><div class="muted">Neto del día</div><div class="metric blue">${money(income-expense)}</div></div>
      <div class="card"><div class="muted">Clientes</div><div class="metric">${allClients.length}</div></div></div>
      <div class="card"><div class="row"><b>Acciones rápidas</b><span class="badge">${roleLabel(role())}</span></div>
      <button class="btn" onclick="go('sale')">＋ Registrar venta</button><button class="btn alt" onclick="go('clients')">👤 Buscar cliente</button><button class="btn alt" onclick="cashPage()">💰 Ver caja</button></div>
      <div class="card"><b>Stock bajo</b>${low.filter(x=>Number(x.stock)<=Number(x.minimum_stock)).map(x=>`<div class="result row"><span>${esc(x.name)}</span><span class="badge warn">${esc(x.stock)}</span></div>`).join('')||'<div class="muted" style="margin-top:8px">No hay productos bajo mínimo.</div>'}</div>`);
    }catch(e){setHTML(`<div class="title">Inicio</div><div class="errorbox">${esc(e.message)}`+`</div>`)}
  };

  window.cashPage=async function(){
    try{
      const global=!(['operator'].includes(role()));
      const today=localDateISO();
      const sales=await q('sales',db.from('sales').select('id,sale_number,total,status,created_at,service_date,vehicle_id').eq('service_date',today).neq('status','voided'));
      const saleIds=sales.map(x=>x.id);
      let movements=[],expenses=[];
      if(global){
        movements=await q('cash_movements',db.from('cash_movements').select('*').order('created_at',{ascending:false}).limit(500));
        expenses=await q('expenses',db.from('expenses').select('*').order('created_at',{ascending:false}).limit(500));
      }else{
        movements=saleIds.length?await q('cash_movements',db.from('cash_movements').select('*').in('sale_id',saleIds).order('created_at',{ascending:false}).limit(500)):[];
        expenses=await q('expenses',db.from('expenses').select('*').gte('created_at',today+'T00:00:00').lt('created_at',today+'T23:59:59.999').order('created_at',{ascending:false}));
      }
      const validSaleIds=new Set(sales.map(x=>x.id));
      if(global)movements=movements.filter(m=>m.movement_type!=='income'||!m.sale_id||validSaleIds.has(m.sale_id));
      const income=movements.filter(x=>x.movement_type==='income').reduce((a,x)=>a+Number(x.amount||0),0);
      const expense=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
      const net=income-expense;
      setHTML(`<div class="title">Caja</div><div class="date">${global?'Ingresos y gastos del día por fecha de servicio':'Movimientos de hoy'}</div>
      <div class="grid"><div class="card"><div class="muted">Ingresos</div><div class="metric green">${money(income)}</div></div><div class="card"><div class="muted">Gastos</div><div class="metric red">${money(expense)}</div></div><div class="card"><div class="muted">Neto</div><div class="metric ${net>=0?'blue':'red'}">${money(net)}</div></div></div>
      <div class="card"><b>Ventas del ${new Date(today+'T12:00:00').toLocaleDateString('es-PE')}</b>${sales.map(s=>`<div class="result row"><span>Venta #${esc(s.sale_number||'')}<br><span class="muted">${money(s.total)}</span></span><b class="green">Ingreso</b></div>`).join('')||'<div class="muted" style="margin-top:8px">No hay ventas para esta fecha.</div>'}</div>
      <div class="card"><b>Gastos</b>${expenses.map(e=>`<div class="result row"><span>${esc(e.description||e.category||'Gasto')}</span><b class="red">-${money(e.amount)}</b></div>`).join('')||'<div class="muted" style="margin-top:8px">No hay gastos para esta fecha.</div>'}</div>`;
    }catch(e){setHTML(`<div class="title">Caja</div><div class="errorbox">${esc(e.message)}`+`</div>`)}
  };
})();
