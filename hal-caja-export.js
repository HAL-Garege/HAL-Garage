// Caja global y reportes mensual/anual.
(() => {
  const originalCashPage = window.cashPage;
  if (typeof originalCashPage !== 'function') return;
  const money = n => 'S/ ' + Number(n || 0).toFixed(2);
  const esc = s => String(s ?? '').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const monthLabel = ym => { const [y,m]=ym.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('es-PE',{month:'long',year:'numeric'}); };
  const range = ym => { const [y,m]=ym.split('-').map(Number); return {a:new Date(Date.UTC(y,m-1,1)),b:new Date(Date.UTC(y,m,1))}; };
  const dl = (blob,name) => { const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000); };
  const legacyExpenses=[
    ['2026-08-30','Agua',38.5],['2026-08-30','Luz',53.5],['2026-08-30','Requerimiento',110],['2026-08-25','Internet',59.9],['2026-08-07','Paso de bateria',10],
    ['2026-07-31','Saumerio local',17],['2026-07-29','Internet',42.5],['2026-07-24','APC',60],['2026-07-17','Hidrolavadora',420],['2026-07-07','Insumos local',30],
    ['2026-06-26','Letrero',23],['2026-06-22','Shampoonera',35],['2026-06-13','Impresion',322.5],['2026-05-15','imprenta',100],['2026-05-09','Utiles de',35],
    ['2026-04-11','Arreglo de chapa',50],['2026-04-04','Detergente y poet',10],['2026-04-01','Recarga de Agua',13],['2026-03-10','Repuesto de',45],['2026-02-14','Repuesto',20],
    ['2026-02-08','Detergente/bolsa',12],['2026-01-28','Reparación de',15],['2026-01-10','Compra de',24],['2026-01-08','Compra de tubos',32.4]
  ];
  async function dataFor(ym){
    const {a,b}=range(ym);
    const [sr,er]=await Promise.all([
      db.from('sales').select('id,sale_number,total,created_at,clients(full_name),vehicles(plate),payments(method)').eq('status','confirmed').gte('created_at',a.toISOString()).lt('created_at',b.toISOString()).order('created_at',{ascending:true}).limit(5000),
      db.from('expenses').select('*').gte('created_at',a.toISOString()).lt('created_at',b.toISOString()).order('created_at',{ascending:true}).limit(5000)
    ]);
    if(sr.error)throw sr.error;if(er.error)throw er.error;
    let sales=sr.data||[], expenses=er.data||[];
    if(ym.startsWith('2026') && !expenses.length) expenses=legacyExpenses.filter(x=>x[0].slice(0,7)===ym).map(x=>({created_at:x[0]+'T17:00:00Z',concept:x[1],amount:x[2],payment_method:'cash'}));
    const income=sales.reduce((s,x)=>s+Number(x.total||0),0), gastos=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
    return {sales,expenses,income,gastos,net:income-gastos};
  }
  async function annual(year){
    const months=[]; for(let m=1;m<=12;m++){ const ym=`${year}-${String(m).padStart(2,'0')}`,d=await dataFor(ym); months.push({ym,...d}); }
    return months;
  }
  function cards(d){return `<div class="grid"><div class="card"><div class="muted">Ingresos</div><div class="metric green">${money(d.income)}</div></div><div class="card"><div class="muted">Gastos</div><div class="metric red">${money(d.gastos)}</div></div><div class="card"><div class="muted">Balance</div><div class="metric">${money(d.net)}</div></div><div class="card"><div class="muted">Ventas</div><div class="metric">${d.sales.length}</div></div></div>`;}
  function monthlyRows(d){return d.sales.map(s=>{const p=Array.isArray(s.payments)?s.payments[0]:s.payments;return `<tr><td>${esc(new Date(s.created_at).toLocaleDateString('es-PE'))}</td><td>#${esc(s.sale_number)}</td><td>${esc(s.vehicles?.plate||'Sin placa')}</td><td>${esc(s.clients?.full_name||'')}</td><td>${money(s.total)}</td><td>${esc(p?.method||'')}</td></tr>`}).join('');}
  function expenseRows(d){return d.expenses.map(x=>`<tr><td>${esc(new Date(x.created_at).toLocaleDateString('es-PE'))}</td><td>Gasto</td><td>${esc(x.concept||'Gasto')}</td><td class="red">-${money(x.amount)}</td></tr>`).join('');}
  function monthlyView(ym,d){
    const rows=monthlyRows(d),er=expenseRows(d);
    setHTML(`<div class="title">Caja</div><div class="date">Reporte mensual · ${esc(monthLabel(ym))}</div><div class="grid" style="margin-bottom:10px"><button class="btn ${window._halCajaMode==='month'?'':'alt'}" onclick="window.halCajaMode('month')">📅 Mensual</button><button class="btn ${window._halCajaMode==='year'?'':'alt'}" onclick="window.halCajaMode('year')">📊 Anual</button></div><label>Mes</label><input id="halCajaMonth" type="month" value="${ym}" onchange="window.halCajaRefresh()">${cards(d)}<div class="grid"><button class="btn alt" onclick="window.halCajaExcel()">📊 Descargar Excel</button><button class="btn alt" onclick="window.halCajaPdf()">📄 Generar PDF</button></div><div class="card"><b>Ingresos del mes</b><table class="table"><tr><th>Fecha</th><th>Venta</th><th>Placa</th><th>Cliente</th><th>Monto</th><th>Método</th></tr>${rows||'<tr><td colspan="6" class="muted">Sin ventas.</td></tr>'}</table></div><div class="card"><b>Gastos del mes</b><table class="table"><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Monto</th></tr>${er||'<tr><td colspan="4" class="muted">Sin gastos.</td></tr>'}</table></div>`);
  }
  function yearView(year,months){
    const ti=months.reduce((a,m)=>a+m.income,0),tg=months.reduce((a,m)=>a+m.gastos,0);
    const rows=months.map(m=>`<tr><td>${esc(monthLabel(m.ym))}</td><td>${money(m.income)}</td><td>${money(m.gastos)}</td><td>${money(m.net)}</td><td>${m.sales.length}</td></tr>`).join('');
    setHTML(`<div class="title">Caja</div><div class="date">Reporte anual · ${year}</div><div class="grid" style="margin-bottom:10px"><button class="btn alt" onclick="window.halCajaMode('month')">📅 Mensual</button><button class="btn" onclick="window.halCajaMode('year')">📊 Anual</button></div><label>Año</label><input id="halCajaYear" type="number" min="2020" max="2100" value="${year}" onchange="window.halCajaRefreshYear()"><div class="grid"><div class="card"><div class="muted">Ingresos anuales</div><div class="metric green">${money(ti)}</div></div><div class="card"><div class="muted">Gastos anuales</div><div class="metric red">${money(tg)}</div></div><div class="card"><div class="muted">Balance anual</div><div class="metric">${money(ti-tg)}</div></div><div class="card"><div class="muted">Ventas</div><div class="metric">${months.reduce((a,m)=>a+m.sales.length,0)}</div></div></div><div class="grid"><button class="btn alt" onclick="window.halCajaExcelYear()">📊 Descargar Excel anual</button><button class="btn alt" onclick="window.halCajaPdfYear()">📄 Generar PDF anual</button></div><div class="card"><b>Resumen por mes</b><table class="table"><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th><th>Ventas</th></tr>${rows}</table></div>`);
  }
  window._halCajaMode='month'; window._halCajaYear=2026;
  window.halCajaMode=async mode=>{window._halCajaMode=mode;await window.halCajaRefresh();};
  window.halCajaRefresh=async()=>{if(window._halCajaMode==='year')return window.halCajaRefreshYear();const ym=document.getElementById('halCajaMonth')?.value||'2026-08';monthlyView(ym,await dataFor(ym));};
  window.halCajaRefreshYear=async()=>{const y=Number(document.getElementById('halCajaYear')?.value||2026);window._halCajaYear=y;yearView(y,await annual(y));};
  async function exportRows(ym){const d=await dataFor(ym);return d;}
  window.halCajaExcel=async()=>{const ym=document.getElementById('halCajaMonth')?.value||'2026-08',d=await exportRows(ym),html=`<html><meta charset="utf-8"><h2>HAL Garage - Caja ${esc(monthLabel(ym))}</h2><p>Ingresos: ${money(d.income)} | Gastos: ${money(d.gastos)} | Balance: ${money(d.net)}</p><table border="1"><tr><th>Fecha</th><th>Venta</th><th>Placa</th><th>Cliente</th><th>Monto</th><th>Método</th></tr>${monthlyRows(d)}</table><br><table border="1"><tr><th>Fecha</th><th>Concepto</th><th>Gasto</th></tr>${d.expenses.map(x=>`<tr><td>${esc(new Date(x.created_at).toLocaleDateString('es-PE'))}</td><td>${esc(x.concept)}</td><td>-${money(x.amount)}</td></tr>`).join('')}</table></html>`;dl(new Blob([html],{type:'application/vnd.ms-excel'}),`HAL-Garage-Caja-${ym}.xls`);};
  window.halCajaPdf=async()=>{const ym=document.getElementById('halCajaMonth')?.value||'2026-08',d=await exportRows(ym),w=window.open('','_blank');if(!w)return;w.document.write(`<html><head><title>HAL Garage Caja ${esc(monthLabel(ym))}</title><style>body{font-family:Arial;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:5px}</style></head><body><h2>HAL Garage - Caja ${esc(monthLabel(ym))}</h2>${cards(d)}<h3>Ingresos</h3><table><tr><th>Fecha</th><th>Venta</th><th>Placa</th><th>Cliente</th><th>Monto</th></tr>${monthlyRows(d)}</table><h3>Gastos</h3><table><tr><th>Fecha</th><th>Concepto</th><th>Monto</th></tr>${d.expenses.map(x=>`<tr><td>${esc(new Date(x.created_at).toLocaleDateString('es-PE'))}</td><td>${esc(x.concept)}</td><td>-${money(x.amount)}</td></tr>`).join('')}</table><script>onload=()=>setTimeout(()=>print(),200)</script></body></html>`);w.document.close();};
  window.halCajaExcelYear=async()=>{const ms=await annual(window._halCajaYear||2026),html=`<html><meta charset="utf-8"><h2>HAL Garage - Caja ${window._halCajaYear}</h2><table border="1"><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th><th>Ventas</th></tr>${ms.map(m=>`<tr><td>${esc(monthLabel(m.ym))}</td><td>${money(m.income)}</td><td>${money(m.gastos)}</td><td>${money(m.net)}</td><td>${m.sales.length}</td></tr>`).join('')}</table></html>`;dl(new Blob([html],{type:'application/vnd.ms-excel'}),`HAL-Garage-Caja-${window._halCajaYear}.xls`);};
  window.halCajaPdfYear=async()=>{const ms=await annual(window._halCajaYear||2026),w=window.open('','_blank');if(!w)return;w.document.write(`<html><head><title>HAL Garage Caja ${window._halCajaYear}</title><style>body{font-family:Arial}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:7px}</style></head><body><h2>HAL Garage - Reporte anual ${window._halCajaYear}</h2><table><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th><th>Ventas</th></tr>${ms.map(m=>`<tr><td>${esc(monthLabel(m.ym))}</td><td>${money(m.income)}</td><td>${money(m.gastos)}</td><td>${money(m.net)}</td><td>${m.sales.length}</td></tr>`).join('')}</table><script>onload=()=>setTimeout(()=>print(),200)</script></body></html>`);w.document.close();};
  window.cashPage=async function(){ if(typeof role==='function' && role()==='operator') return originalCashPage(); window._halCajaMode='month'; monthlyView('2026-08',await dataFor('2026-08')); };
})();
