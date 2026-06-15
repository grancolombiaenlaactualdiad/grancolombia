/* ============================================================
   ATLAS DE LA GRAN COLOMBIA — app.js
   Mapa geográfico real, bandera, gráficas, buscador y tablas
   ============================================================ */
(function(){
'use strict';
const $ = s => document.querySelector(s);
const body = document.body;
const ROOT = body.dataset.root || '.';          // prefijo relativo a la raíz del sitio
const PAGINA = body.dataset.page || '';
const SLUG = body.dataset.slug || '';

const fmt = n => Math.round(n).toLocaleString('es-CO');
const fmtM = n => n>=1e6 ? (n/1e6).toLocaleString('es-CO',{maximumFractionDigits:1})+' M' : fmt(n);
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

const D = (window.GC||{}).departamentos || [];
const bySlug = Object.fromEntries(D.map(d=>[d.slug,d]));

/* ---- colores por país de origen ---- */
const PAISES = [
 {k:'Colombia', hex:'#f2a900', test:p=>p==='Colombia'},
 {k:'Venezuela', hex:'#d64550', test:p=>p==='Venezuela'},
 {k:'Ecuador', hex:'#2d7dd2', test:p=>p==='Ecuador'},
 {k:'Panamá', hex:'#1fa67a', test:p=>p==='Panama'},
 {k:'Trinidad y Tobago', hex:'#8e5bc0', test:p=>p.includes('Trinidad')},
 {k:'Mosquitia (Costa Rica y Nicaragua)', hex:'#e07b39', test:p=>p.includes('Costa Rica')},
 {k:'Antillas', hex:'#18b6c9', test:p=>p.includes('Curazao')},
 {k:'Multinacional (Amazonas)', hex:'#5e8c61', test:p=>p.includes('Peru')||p.includes('Brasil')},
];
const colorPais = p => (PAISES.find(x=>x.test(p))||PAISES[0]).hex;
window.GCcolorPais = colorPais; window.GCPAISES = PAISES;

/* =================== BANDERA ===================
   Tricolor de Miranda 2:1:1 — las 12 estrellas van ÚNICAMENTE
   dentro de la franja azul, en arco suave. */
function bandera(w){
  const h = Math.round(w*2/3);
  const star=(cx,cy,r)=>{let p='';for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5,b=a+Math.PI/5;
    p+=(i?'L':'M')+(cx+r*Math.cos(a)).toFixed(1)+','+(cy+r*Math.sin(a)).toFixed(1)+' L'+(cx+r*.42*Math.cos(b)).toFixed(1)+','+(cy+r*.42*Math.sin(b)).toFixed(1)+' ';}
    return p+'Z';};
  const y0=h*0.5, y1=h*0.75;                  // límites de la franja azul
  const rs=h*0.031;                            // radio de estrella
  const cyBase=y1-rs-h*0.012;                  // línea inferior del arco (dentro del azul)
  const amp=(y1-y0)-2*rs-h*0.028;              // amplitud vertical disponible
  let stars='';
  for(let i=0;i<12;i++){
    const t=(i+0.5)/12;                        // 0..1 a lo largo del arco
    const cx=w*(0.10+0.80*t);
    const cy=cyBase-amp*Math.sin(Math.PI*t);   // arco que sube al centro, siempre en el azul
    stars+=`<path d="${star(cx,cy,rs)}" fill="#fff"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bandera de la Gran Colombia: tricolor amarillo, azul y rojo con doce estrellas blancas en la franja azul">
    <rect width="${w}" height="${y0}" fill="#FCD116"/>
    <rect y="${y0}" width="${w}" height="${h*0.25}" fill="#003893"/>
    <rect y="${y1}" width="${w}" height="${h*0.25}" fill="#CE1126"/>${stars}</svg>`;
}
window.GCbandera = bandera;
document.querySelectorAll('[data-bandera]').forEach(el=>{ el.innerHTML = bandera(+el.dataset.bandera||120); });

/* =================== MAPA GEOGRÁFICO REAL =================== */
const ETIQUETAS = {bogota:'BOG',miranda:'MIR',pichincha:'PIC',panama:'PANAMÁ',antioquia:'ANTIOQUIA','valle-del-cauca':'VALLE',atlantico:'ATL',guayas:'GYS',bolivar:'BOL',zulia:'ZULIA',sucre:'SUC',carabobo:'CBO',orinoco:'ORINOCO',lara:'LARA',monagas:'MONAGAS',cundinamarca:'CUN',aragua:'ARAGUA',esmeraldas:'ESM',magdalena:'MAG',amazonas:'AMAZONAS',santander:'SAN',meta:'META',tolima:'TOL','santo-domingo-de-los-tsachilas':'STO DGO',cordoba:'CÓR',canar:'CÑR',risaralda:'RIS','norte-de-santander':'NDS',caldas:'CAL','trinidad-y-tobago':'T&T',tachira:'TÁCHIRA',cesar:'CES',merida:'MÉRIDA','nueva-grecia-nueva-esparta':'N.GRECIA','guayana-esequiba':'ESEQUIBA',huila:'HUI',narino:'NARIÑO',vichada:'VICHADA',boyaca:'BOY',cauca:'CAU',arauca:'ARA',chimborazo:'CHB','la-guajira':'GUAJIRA',loja:'LOJA',casanare:'CASANARE','los-rios':'RÍOS',choco:'CHOCÓ','antillas-menores':'ANTILLAS','islas-galapagos':'GALÁPAGOS',mosquitia:'MOSQUITIA'};
const OSCUROS = ['#f2a900','#18b6c9','#1fa67a','#e07b39'];

function dibujarMapa(cont, opts={}){
  if(!window.GEO || !cont) return;
  const {mini=false, resaltar=null} = opts;
  const G = window.GEO;
  // retícula de fondo
  let grat='';
  for(let x=0; x<=G.w; x+=60) grat+=`<line class="graticula" x1="${x}" y1="0" x2="${x}" y2="${G.h}"/>`;
  for(let y=0; y<=G.h; y+=60) grat+=`<line class="graticula" x1="0" y1="${y}" x2="${G.w}" y2="${y}"/>`;
  let insets='';
  for(const i of G.insets){
    insets+=`<rect class="inset-marco" x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}"/>`;
    if(!mini) insets+=`<text class="inset-rotulo" x="${i.x+4}" y="${i.y-5}">${i.t} <tspan font-size="8.5">${i.nota}</tspan></text>`;
  }
  let regiones='';
  for(const d of D){
    const g = G.d[d.slug]; if(!g) continue;
    const fill = colorPais(d.pais);
    const aten = resaltar && resaltar!==d.slug;
    let lbl='';
    if(!mini && g.a > 1.6){
      const dark = OSCUROS.includes(fill);
      const fs = g.a>40?17 : g.a>8?12.5 : 10;
      lbl=`<text class="etq ${dark?'':'clara'}" x="${g.lx}" y="${g.ly}" font-size="${fs}">${ETIQUETAS[d.slug]||''}</text>`;
    }
    regiones+=`<g class="region${aten?' atenuada':''}" data-slug="${d.slug}" tabindex="${mini?-1:0}" role="link" aria-label="${esc(d.nombre)}"><path d="${g.p}" fill="${fill}"/>${lbl}</g>`;
  }
  cont.innerHTML = `<svg viewBox="${G.vb}" xmlns="http://www.w3.org/2000/svg" aria-label="Mapa de la Gran Colombia con sus 50 departamentos">${grat}${insets}${regiones}</svg>`;
  activarMapa(cont);
}

function activarMapa(scope){
  const tip = $('#tooltip'); if(!tip) return;
  scope.querySelectorAll('.region').forEach(g=>{
    const d = bySlug[g.dataset.slug]; if(!d) return;
    g.addEventListener('mousemove',e=>{
      tip.style.display='block';
      tip.innerHTML=`<b>${esc(d.nombre)}</b><br>Capital: ${esc(d.capital)}<br><span class="mono">${fmtM(d.poblacion)} hab · ${fmt(d.area)} km²</span><br><span class="mono" style="opacity:.75">${esc(d.pais)}</span>`;
      tip.style.left=Math.min(e.clientX+14, innerWidth-285)+'px';
      tip.style.top=(e.clientY+14)+'px';
    });
    g.addEventListener('mouseleave',()=>tip.style.display='none');
    const go=()=>{ tip.style.display='none'; location.href = ROOT+'/departamentos/'+d.slug+'.html'; };
    g.addEventListener('click',go);
    g.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();go();} });
  });
}
const elMapa = $('#mapa');      if(elMapa) dibujarMapa(elMapa);
const elMini = $('#mini-mapa'); if(elMini) dibujarMapa(elMini, {mini:true, resaltar: SLUG});

/* =================== TREEMAP DE MUNICIPIOS =================== */
function squarify(items, x, y, w, h, out){
  if(!items.length) return;
  if(items.length===1){ out.push({...items[0], x,y,w,h}); return; }
  const total=items.reduce((a,b)=>a+b.v,0);
  let fila=[], resto=items.slice(), mejor=Infinity;
  const lado=Math.min(w,h);
  while(resto.length){
    const cand=[...fila, resto[0]];
    const s=cand.reduce((a,b)=>a+b.v,0);
    const ancho=s/total*(w*h)/lado;
    const peor=Math.max(...cand.map(it=>{const l=it.v/s*lado;return Math.max(ancho/l,l/ancho);}));
    if(peor<=mejor){ fila=cand; resto.shift(); mejor=peor; } else break;
  }
  const s=fila.reduce((a,b)=>a+b.v,0), frac=s/total;
  if(w>=h){
    const fw=w*frac; let cy=y;
    for(const it of fila){ const ih=it.v/s*h; out.push({...it,x,y:cy,w:fw,h:ih}); cy+=ih; }
    squarify(resto,x+fw,y,w-fw,h,out);
  } else {
    const fh=h*frac; let cx=x;
    for(const it of fila){ const iw=it.v/s*w; out.push({...it,x:cx,y,w:iw,h:fh}); cx+=iw; }
    squarify(resto,x,y+fh,w,h-fh,out);
  }
}
const elTree = $('#treemap');
if(elTree && SLUG && bySlug[SLUG]){
  const d=bySlug[SLUG];
  const items=(d.munis||[]).map(m=>({n:m.n,v:m.t||m.u||1})).filter(i=>i.v>0).sort((a,b)=>b.v-a.v).slice(0,40);
  if(items.length){
    const out=[]; squarify(items,0,0,760,420,out);
    const fill=colorPais(d.pais);
    let svg='';
    out.forEach((c,i)=>{
      const op=0.45+0.55*(1-i/out.length);
      const mostrar=c.w>56&&c.h>26;
      svg+=`<g><title>${esc(c.n)} — ${fmt(c.v)} hab</title><rect x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" width="${c.w.toFixed(1)}" height="${c.h.toFixed(1)}" fill="${fill}" opacity="${op.toFixed(2)}"/>`+
        (mostrar?`<text x="${(c.x+5).toFixed(1)}" y="${(c.y+15).toFixed(1)}" font-size="${c.w>120?11:9}" fill="#1d2b3a">${esc(c.n.length>18?c.n.slice(0,17)+'…':c.n)}</text>`:'')+`</g>`;
    });
    elTree.innerHTML=`<svg class="treemap" viewBox="0 0 760 420">${svg}</svg>`;
  } else elTree.closest('.lamina')?.remove();
}

/* =================== BARRAS DE EMPRESAS (página de departamento) =================== */
const elBarras = $('#barras-empresas');
if(elBarras && SLUG && bySlug[SLUG]){
  const d=bySlug[SLUG];
  const items=(d.comps||[]).filter(c=>c.rev>0).slice(0,12);
  if(items.length){
    const max=Math.max(...items.map(i=>i.rev));
    const W=720,lblW=230,bw=W-lblW-95; let svg='';
    items.forEach((it,i)=>{
      const y=i*33, w=Math.max(3,it.rev/max*bw);
      svg+=`<text class="bar-lbl" x="${lblW-8}" y="${y+17}" text-anchor="end">${esc(it.n.length>32?it.n.slice(0,31)+'…':it.n)}</text>
      <rect x="${lblW}" y="${y}" width="${w.toFixed(1)}" height="25" rx="5" fill="${colorPais(d.pais)}"/>
      <text class="bar-val" x="${lblW+w+7}" y="${y+17}">${fmt(it.rev)}</text>`;
    });
    elBarras.innerHTML=`<svg viewBox="0 0 ${W} ${items.length*33}">${svg}</svg><p class="suave" style="font-size:.78rem;margin-top:4px">Ingresos anuales en millones de dólares (USD).</p>`;
  } else elBarras.closest('.lamina')?.remove();
}

/* =================== BUSCADOR =================== */
(function(){
  const inp=$('#buscador-input'), caja=$('#sugerencias');
  if(!inp||!caja) return;
  const idx=[];
  for(const d of D){
    idx.push({t:d.nombre, s:'Departamento · '+d.capital, url:ROOT+'/departamentos/'+d.slug+'.html', k:norm(d.nombre)});
    for(const m of (d.munis||[])) idx.push({t:m.n, s:'Municipio · '+d.nombre, url:ROOT+'/departamentos/'+d.slug+'.html', k:norm(m.n)});
  }
  inp.addEventListener('input',()=>{
    const q=norm(inp.value);
    if(q.length<2){ caja.style.display='none'; return; }
    const res=idx.filter(i=>i.k.includes(q)).slice(0,9);
    caja.innerHTML=res.map(r=>`<a href="${r.url}"><span>${esc(r.t)}</span><span class="tipo">${esc(r.s)}</span></a>`).join('')||'<a><span class="tipo">Sin resultados</span></a>';
    caja.style.display='block';
  });
  document.addEventListener('click',e=>{ if(!caja.contains(e.target)&&e.target!==inp) caja.style.display='none'; });
})();

/* =================== TABLA DE TODAS LAS EMPRESAS =================== */
(function(){
  const cuerpo=$('#empresas-cuerpo'); if(!cuerpo||!window.GC.todasEmpresas) return;
  const filtro=$('#empresas-filtro'), selDep=$('#empresas-dep'), masBtn=$('#empresas-mas'), info=$('#empresas-info');
  const datos=window.GC.todasEmpresas;
  const deps=[...new Set(datos.map(e=>e.dep))].sort();
  selDep.innerHTML='<option value="">Todos los departamentos</option>'+deps.map(d=>`<option>${esc(d)}</option>`).join('');
  let visibles=100;
  function pinta(){
    const q=norm(filtro.value||''), dep=selDep.value;
    const f=datos.filter(e=>(!dep||e.dep===dep)&&(!q||norm(e.n).includes(q)));
    cuerpo.innerHTML=f.slice(0,visibles).map(e=>
      `<tr><td class="num">${e.r}</td><td>${esc(e.n)}</td><td class="num">${fmt(e.ing)}</td><td>${esc(e.dep)}</td></tr>`).join('');
    info.textContent=`Mostrando ${Math.min(visibles,f.length)} de ${fmt(f.length)} empresas`;
    masBtn.style.display=f.length>visibles?'inline-block':'none';
  }
  filtro.addEventListener('input',()=>{visibles=100;pinta();});
  selDep.addEventListener('change',()=>{visibles=100;pinta();});
  masBtn.addEventListener('click',()=>{visibles+=200;pinta();});
  pinta();
})();

/* =================== CONTADOR DE VISITAS =================== */
(function(){
  const el=$('#contador'); if(!el) return;
  const clave='gc-atlas-'+(PAGINA||'home');
  const local=()=>{try{let n=+(localStorage.getItem('gc_visitas')||0)+1;localStorage.setItem('gc_visitas',n);el.textContent=fmt(n);}catch(e){el.textContent='—';}};
  try{
    fetch('https://api.counterapi.dev/v1/gran-colombia-atlas/visitas/up')
      .then(r=>r.ok?r.json():Promise.reject())
      .then(j=>{el.textContent=fmt(j.count||j.value||0);})
      .catch(local);
  }catch(e){local();}
})();

/* =================== NAV ACTIVA =================== */
document.querySelectorAll('nav.principal a').forEach(a=>{
  if(a.dataset.p===PAGINA) a.classList.add('activo');
});
})();
