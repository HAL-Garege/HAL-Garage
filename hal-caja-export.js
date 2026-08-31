// Exportación de Caja: agrega reporte mensual sin cambiar el diseño original.
(() => {
  const originalCashPage = window.cashPage;
  if (typeof originalCashPage !== 'function') return;

  const money = n => 'S/ ' + Number(n || 0).toFixed(2);
  const escLocal = s => String(s ?? '').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const monthLabel = ym => {
    const [y,m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-PE', {month:'long', year:'numeric'});
  };
  const monthRange = ym => {
    const [y,m] = ym.split('-').map(Number);
    return {start:new Date(Date.UTC(y,m-1,1)), end:new Date(Date.UTC(y,m,1))};
  };
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  async function getMonthData(ym) {
    const {start,end} = monthRange(ym);
    const [mr,er] = await Promise.all([
      db.from('cash_movements').select('*').gte('created_at',start.toISOString()).lt('created_at',end.toISOString()).order('created_at',{ascending:true}).limit(5000),
      db.from('expenses').select('*').gte('created_at',start.toISOString()).lt('created_at',end.toISOString()).order('created_at',{ascending:true}).limit(5000)
    ]);
    if(mr.error) throw mr.error;
    if(er.error) throw er.error;
    const movements = mr.data || [], expenses = er.data || [];
    const income = movements.filter(x => x.movement_type === 'income').reduce((a,x)=>a+Number(x.amount||0),0);
    const cashExpenses = expenses.reduce((a,x)=>a+Number(x.amount||0),0);
    const otherOut = movements.filter(x => x.movement_type !== 'income').reduce((a,x)=>a+Number(x.amount||0),0);
    return {movements,expenses,income,expensesTotal:cashExpenses,otherOut,net:income-cashExpenses-otherOut};
  }

  function buildRows(data){
    const rows=[];
    data.movements.forEach(x=>rows.push({date:x.created_at,type:x.movement_type==='income'?'Ingreso':'Salida',concept:x.concept||x.description||'Movimiento de caja',amount:Number(x.amount||0),method:x.payment_method||''}));
    data.expenses.forEach(x=>rows.push({date:x.created_at,type:'Gasto',concept:x.concept||'Gasto',amount:-Number(x.amount||0),method:x.payment_method||''}));
    return rows.sort((a,b)=>new Date(a.date)-new Date(b.date));
  }

  async function exportExcel(){
    try{
      const ym=document.getElementById('halCajaMonth')?.value || new Date().toISOString().slice(0,7);
      const d=await getMonthData(ym), rows=buildRows(d);
      const body=rows.map(r=>`<tr><td>${escLocal(new Date(r.date).toLocaleString('es-PE'))}</td><td>${escLocal(r.type)}</td><td>${escLocal(r.concept)}</td><td>${escLocal(money(r.amount))}</td><td>${escLocal(r.method)}</td></tr>`).join('');
      const html=`<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial;font-size:11pt}th,td{border:1px solid #999;padding:6px 9px}th{font-weight:bold}.num{text-align:right}.summary{margin:8px 0}</style></head><body><h2>HAL Garage — Reporte de Caja</h2><div>Periodo: ${escLocal(monthLabel(ym))}</div><div class="summary">Ingresos: <b>${money(d.income)}</b> | Gastos: <b>${money(d.expensesTotal)}</b> | Otras salidas: <b>${money(d.otherOut)}</b> | Neto: <b>${money(d.net)}</b></div><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Método</th></tr></thead><tbody>${body||'<tr><td colspan="5">Sin movimientos en el periodo.</td></tr>'}</tbody></table></body></html>`;
      downloadBlob(new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'}),`HAL-Garage-Caja-${ym}.xls`);
      toast('Reporte de caja en Excel generado correctamente.');
    }catch(e){toast(e.message||'No se pudo generar el Excel.',true)}
  }

  async function exportPdf(){
    try{
      const ym=document.getElementById('halCajaMonth')?.value || new Date().toISOString().slice(0,7);
      const d=await getMonthData(ym), rows=buildRows(d);
      const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>HAL Garage — Reporte de Caja</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:11px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#555}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.box{border:1px solid #bbb;padding:8px}.box b{display:block;font-size:14px;margin-top:3px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px;text-align:left}th{font-weight:bold}td.num{text-align:right}tr{page-break-inside:avoid}</style></head><body><h1>HAL Garage — Reporte de Caja</h1><p>Periodo: ${escLocal(monthLabel(ym))} · Generado: ${escLocal(new Date().toLocaleString('es-PE'))}</p><div class="summary"><div class="box">Ingresos<b>${money(d.income)}</b></div><div class="box">Gastos<b>${money(d.expensesTotal)}</b></div><div class="box">Otras salidas<b>${money(d.otherOut)}</b></div><div class="box">Neto<b>${money(d.net)}</b></div></div><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Método</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${escLocal(new Date(r.date).toLocaleString('es-PE'))}</td><td>${escLocal(r.type)}</td><td>${escLocal(r.concept)}</td><td class="num">${escLocal(money(r.amount))}</td><td>${escLocal(r.method)}</td></tr>`).join('')||'<tr><td colspan="5">Sin movimientos en el periodo.</td></tr>'}</tbody></table><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
      const w=window.open('','_blank'); if(!w)throw new Error('El navegador bloqueó la ventana de impresión.');
      w.document.write(html); w.document.close();
    }catch(e){toast(e.message||'No se pudo generar el PDF.',true)}
  }

  window.halExportCajaExcel=exportExcel;
  window.halExportCajaPdf=exportPdf;

  async function injectControls(){
    const app=document.getElementById('app'); if(!app || document.querySelector('[data-hal-caja-export]'))return;
    const cards=Array.from(app.querySelectorAll('.card'));
    const history=cards.find(c=>/Movimientos (globales|del día)/i.test(c.textContent||''));
    if(!history)return;
    const now=new Date(), ym=now.toISOString().slice(0,7);
    const box=document.createElement('div');
    box.setAttribute('data-hal-caja-export','1');
    box.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid var(--line)';
    box.innerHTML=`<div class="row"><b>📥 Reporte de caja</b></div><div class="muted" style="margin-top:4px">Selecciona el mes y descarga el registro completo en Excel o PDF.</div><label style="margin-top:8px">Mes del reporte</label><input id="halCajaMonth" type="month" value="${ym}"><div class="grid" style="margin-top:6px"><button class="btn alt" id="halCajaExcelBtn">📊 DESCARGAR EXCEL</button><button class="btn alt" id="halCajaPdfBtn">📄 GENERAR PDF</button></div>`;
    history.appendChild(box);
    box.querySelector('#halCajaExcelBtn').onclick=exportExcel;
    box.querySelector('#halCajaPdfBtn').onclick=exportPdf;
  }

  window.cashPage = async function(){
    await originalCashPage();
    await injectControls();
  };
})();
