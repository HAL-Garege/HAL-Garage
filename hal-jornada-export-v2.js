// Exportación robusta de Jornada y Almuerzo. No modifica el diseño ni las marcaciones.
(() => {
  const esc = s => String(s ?? '').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  const tm = v => { if(!v) return '—'; const d=new Date(v); return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}); };
  const dt = v => { if(!v) return '—'; const d=new Date(String(v).length===10?v+'T00:00:00':v); return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('es-PE'); };
  async function rows(){
    let q=db.from('workdays').select('id,operator_id,work_date,status,created_at').order('work_date',{ascending:false}).order('created_at',{ascending:false}).limit(1000);
    if(window.HAL_USER?.role==='operator' && window.HAL_USER?.id) q=q.eq('operator_id',window.HAL_USER.id);
    const {data:w,error}=await q; if(error) throw error;
    const ids=(w||[]).map(x=>x.id); let ev=[];
    if(ids.length){const r=await db.from('workday_evidence').select('workday_id,evidence_type,created_at').in('workday_id',ids).order('created_at');if(r.error)throw r.error;ev=r.data||[];}
    const map={}; ev.forEach(e=>{(map[e.workday_id]??={})[e.evidence_type]??=e.created_at;});
    return (w||[]).map(x=>{const e=map[x.id]||{};return {fecha:dt(x.work_date),ingreso:tm(e.entry),almuerzo:tm(e.lunch_out),regreso:tm(e.lunch_in),salida:tm(e.exit),estado:x.status==='open'?'Abierta':x.status==='closed'?'Cerrada':(x.status||'—')};});
  }
  function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function excel(){try{const r=await rows(),h=['Fecha','Ingreso','Salida a almuerzo','Regreso del almuerzo','Salida de jornada','Estado'];const b=r.map(x=>[x.fecha,x.ingreso,x.almuerzo,x.regreso,x.salida,x.estado].map(esc).map(v=>`<td>${v}</td>`).join('')).map(x=>`<tr>${x}</tr>`).join('');const html=`<html><head><meta charset="utf-8"></head><body><table border="1"><tr>${h.map(esc).map(x=>`<th>${x}</th>`).join('')}</tr>${b}</table></body></html>`;download(new Blob([html],{type:'application/vnd.ms-excel'}),`HAL-Garage-Jornada-${new Date().toISOString().slice(0,10)}.xls`);toast('Excel generado correctamente.');}catch(e){toast(e.message||'No se pudo generar el Excel.',true);}}
  async function pdf(){try{const r=await rows();const w=window.open('','_blank');if(!w)throw new Error('Permite ventanas emergentes para generar el PDF.');w.document.write(`<html><head><meta charset="utf-8"><title>HAL Garage - Jornada</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px;text-align:left}h1{font-size:18px}</style></head><body><h1>HAL Garage — Registro de Jornada y Almuerzo</h1><table><tr><th>Fecha</th><th>Ingreso</th><th>Salida a almuerzo</th><th>Regreso del almuerzo</th><th>Salida de jornada</th><th>Estado</th></tr>${r.map(x=>`<tr><td>${esc(x.fecha)}</td><td>${esc(x.ingreso)}</td><td>${esc(x.almuerzo)}</td><td>${esc(x.regreso)}</td><td>${esc(x.salida)}</td><td>${esc(x.estado)}</td></tr>`).join('')}</table><script>setTimeout(()=>window.print(),300)</script></body></html>`);w.document.close();}catch(e){toast(e.message||'No se pudo generar el PDF.',true);}}
  window.halExportJornadaExcel=excel; window.halExportJornadaPdf=pdf;
  function inject(){
    const app=document.getElementById('app'); if(!app)return;
    const nodes=[...app.querySelectorAll('*')]; const heading=nodes.find(n=>/^\s*Historia de jornadas?\s*$/i.test(n.textContent||'') && n.children.length===0);
    if(!heading)return;
    let host=heading.closest('.card')||heading.parentElement?.parentElement||heading.parentElement; if(!host||host.querySelector('[data-hal-export-v2]'))return;
    const box=document.createElement('div');box.dataset.halExportV2='1';box.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid var(--line)';
    box.innerHTML='<div style="font-weight:750">📥 Exportar marcaciones</div><div class="muted" style="margin-top:4px">Registro completo de jornada y almuerzo.</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:7px"><button class="btn alt" onclick="halExportJornadaExcel()">📊 DESCARGAR EXCEL</button><button class="btn alt" onclick="halExportJornadaPdf()">📄 GENERAR PDF</button></div>';
    host.appendChild(box);
  }
  let ticks=0; const timer=setInterval(()=>{inject();if(++ticks>40)clearInterval(timer);},500);
  try{if(typeof window.jornadaPage==='function'){const f=window.jornadaPage;window.jornadaPage=async function(){const r=await f();setTimeout(inject,50);return r;};window.workdayPage=window.jornadaPage;}}catch(e){}
})();
