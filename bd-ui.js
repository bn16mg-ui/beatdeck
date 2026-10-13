'use strict';
/* ===== BeatDeck 5 · interface : platine SX1 à l'écran, palettes, réglages ===== */
let EDIT=false,LEARN=null,SCALE=1;
const UIV={};   // dernière valeur affichée des potentiomètres

/* ---------- construction de la platine ---------- */
function buildStage(){
  $('waves').innerHTML=[0,1].map(i=>`<div class="wr" style="--c:${COL[i]}"><div class="wi"><div class="t1"><b>DECK ${i+1}</b><span class="nm" id="wn${i}">Aucun morceau</span></div><div class="t2" id="wt${i}"></div></div><button class="tapb" data-tap="${i}" title="Tape en rythme pour corriger le tempo">TAP</button><div class="wc"><canvas id="w${i}"></canvas><span class="tag" id="wg${i}" hidden></span></div></div>`).join('');
  const S=$('sx1');let h='';
  h+=`<div class="plate" style="left:40px;top:330px;width:850px;height:760px"></div><div class="plate" style="left:1310px;top:330px;width:850px;height:760px"></div><div class="plate mx" style="left:878px;top:338px;width:444px;height:744px"></div>`;
  h+=`<div class="deco brand" style="left:1100px;top:930px;transform:translateX(-50%);font-size:20px">⟆ The Next Beat</div><div class="deco" style="left:330px;top:1050px">+ SEARCH −</div><div class="deco" style="left:1760px;top:1050px">+ SEARCH −</div><div class="deco" style="left:100px;top:360px">MASTER TEMPO</div><div class="deco" style="left:1905px;top:360px">MASTER TEMPO</div>`;
  for(const p of PHYS){
    if(p.shape=='hidden')continue;
    const st=`left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;--c:${p.deck==null?'var(--ai)':COL[p.deck]}`;
    const lab=`<span class="phn">${esc(p.impr)}</span>`;
    if(p.shape=='rect'||p.shape=='round')h+=`<div class="ctl btn ${p.shape}${p.w>90?' big':''}" data-ph="${p.id}" style="${st}">${lab}<span class="lbl b"></span><span class="lbl s"></span></div>`;
    else if(p.shape=='knob'||p.shape=='enc')h+=`<div class="ctl knob ${p.shape}${/^flt/.test(p.id)?' flt':''}" data-ph="${p.id}" style="${st}">${lab}<div class="kb"><i></i></div><span class="lbl b"></span><span class="lbl s"></span></div>`;
    else if(p.shape=='jog')h+=`<div class="ctl jog" data-ph="${p.id}" style="${st}">${lab}<div class="ring"></div><div class="plat"></div><div class="top"></div><div class="spin"></div><div class="mid"><b id="jb${p.deck}">--</b><small>BPM</small><span class="tr" id="jt${p.deck}">-0:00</span></div><span class="ld" id="jl${p.deck}" hidden>Analyse…</span><span class="lbl b"></span><span class="lbl s"></span></div>`;
    else if(p.shape=='xf')h+=`<div class="ctl xf" data-ph="${p.id}" style="${st}">${lab}<div class="tr"></div><div class="th"></div><span class="lbl b"></span><span class="lbl s"></span></div>`;
  }
  S.innerHTML=h;
  QA('.ctl',S).forEach(bindCtl);
  refreshStage();
}
function bindingFor(id,layer){const A=PROF.assign[id]||{};return layer=='shift'?A.shift:A.base}
const lblOf=b=>b&&CAT[b.fn]?(b.nom||CAT[b.fn].court):'—';
function refreshStage(){
  for(const p of PHYS){const el=Q('[data-ph="'+p.id+'"]');if(!el)continue;
    const A=PROF.assign[p.id]||{},b=el.querySelector('.lbl.b'),s=el.querySelector('.lbl.s');
    b.textContent=lblOf(A.base);s.textContent=A.shift&&A.shift.fn?'⇧ '+lblOf(A.shift):'';b.classList.toggle('hasS',!!(A.shift&&A.shift.fn));
    const m=MIDI.map.phys[p.id];
    el.title=p.nom+'\nFonction : '+(A.base&&CAT[A.base.fn]?CAT[A.base.fn].nom:'aucune')+(A.shift&&CAT[A.shift.fn]?'\nAvec SHIFT : '+CAT[A.shift.fn].nom:'')+'\n'+(m?(m.none?'N\'envoie rien':physLabel(m.k)):'Pas encore configurée');
  }
}
/* ---------- gestes à l'écran ---------- */
function physScreen(id,ev){
  if(EDIT){if(ev.t=='press'||ev.t=='value'||ev.t=='delta')openEditor(id,SHIFT.on?'shift':'base');return}
  const A=PROF.assign[id]||{},isSh=A.base&&A.base.fn=='shift';
  if(LEARN&&!isSh){if(ev.t!='release')learnPick(id);return}
  const layer=isSh?'base':SHIFT.on?'shift':'base',b=layer=='shift'&&A.shift&&A.shift.fn?A.shift:A.base;if(!b)return;
  runBinding(b,PH[id].deck,ev);
}
function bindCtl(el){
  const id=el.dataset.ph,p=PH[id];
  if(p.shape=='rect'||p.shape=='round'){
    let down=false;
    el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);down=true;el.classList.add('hit');physScreen(id,{t:'press'})};
    const up=()=>{if(!down)return;down=false;el.classList.remove('hit');if(!EDIT)physScreen(id,{t:'release'})};
    el.onpointerup=up;el.onpointercancel=up;
  }else if(p.shape=='knob'){
    el.onpointerdown=e=>{e.preventDefault();if(EDIT||LEARN){physScreen(id,{t:'press'});return}el.setPointerCapture(e.pointerId);
      const y0=e.clientY,v0=UIV[id]??(bindingVal(bindingFor(id,'base'),p.deck)??.5);
      el.onpointermove=ev=>{const v=clamp(v0+(y0-ev.clientY)/(260*SCALE));UIV[id]=v;physScreen(id,{t:'value',v})}};
    el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null};
    el.ondblclick=()=>{if(/^(hi|low|flt|mg)/.test(id)||id.startsWith('mid')){UIV[id]=.5;physScreen(id,{t:'value',v:.5})}};
  }else if(p.shape=='enc'){
    el.onpointerdown=e=>{e.preventDefault();if(EDIT||LEARN){physScreen(id,{t:'press'});return}el.setPointerCapture(e.pointerId);
      let y=e.clientY,mv=0;const t0=performance.now();
      el.onpointermove=ev=>{const dy=ev.clientY-y;if(Math.abs(dy)>34*SCALE){const n=Math.sign(dy);y=ev.clientY;mv++;physScreen(id,{t:'delta',v:n});uiTurn(id,n)}};
      el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null;if(!mv&&performance.now()-t0<400){physScreen('brwp',{t:'press'});physScreen('brwp',{t:'release'})}}};
  }else if(p.shape=='jog'){
    el.onpointerdown=e=>{e.preventDefault();if(EDIT||LEARN){physScreen(id,{t:'press'});return}el.setPointerCapture(e.pointerId);
      const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let a0=Math.atan2(e.clientY-cy,e.clientX-cx);
      el.onpointermove=ev=>{const a=Math.atan2(ev.clientY-cy,ev.clientX-cx);let d=a-a0;a0=a;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;const n=Math.round(d*30);if(n)physScreen(id,{t:'delta',v:n})}};
    el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null};
  }else if(p.shape=='xf'){
    const set=ev=>{const r=el.getBoundingClientRect(),v=clamp((ev.clientX-r.left)/r.width);UIV[id]=v;physScreen(id,{t:'value',v})};
    el.onpointerdown=e=>{e.preventDefault();if(EDIT||LEARN){physScreen(id,{t:'press'});return}el.setPointerCapture(e.pointerId);set(e);el.onpointermove=set};
    el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null};
  }
}
function uiFlash(id){const el=Q('[data-ph="'+id+'"]');if(!el)return;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}
function uiVal(id,v){UIV[id]=v}
const TURN={};function uiTurn(id,dl){TURN[id]=(TURN[id]||0)+dl}
function majStatut(t,ok){const e=$('st');if(!e)return;e.textContent=t;e.classList.toggle('ok',!!ok)}

/* ---------- boucle d'affichage ---------- */
function drawW(i){
  const d=D[i],c=$('w'+i);if(!c||!UI.wave)return;const r=devicePixelRatio||1,W=Math.round(c.clientWidth*r),H=Math.round(c.clientHeight*r);if(!W||!H)return;
  if(c.width!=W)c.width=W;if(c.height!=H)c.height=H;
  const x=c.getContext('2d');x.clearRect(0,0,W,H);if(!d.pk)return;
  const ct=Math.max(0,heard(d)),S0=12,t0=ct-S0/2,bw=2*r,col=COL[i];
  if(d.lp){x.fillStyle='#ffc24b22';const a=(d.lp.s-t0)/S0*W,b=(d.lp.s+d.lp.len-t0)/S0*W;x.fillRect(a,0,b-a,H)}
  for(let px=0;px<W;px+=bw){const t=t0+px/W*S0,k=Math.floor(t*50);if(k<0||k>=d.pk.length)continue;const h=Math.max(1,d.pk[k]*H*.92);x.fillStyle=px<W/2?col+'88':col;x.fillRect(px,(H-h)/2,bw-1,h)}
  if(d.grid){const p=beatLen(d);for(let n=Math.ceil((t0-d.off)/p);d.off+n*p<t0+S0;n++){const px=(d.off+n*p-t0)/S0*W;x.fillStyle=n%4?'#ffffff30':'#ffffffaa';x.fillRect(px,0,n%4?1:2,H)}}
  const pl=AUTO.on&&i==live()&&d.plan&&d.plan.exit;if(pl&&pl>t0&&pl<t0+S0){x.fillStyle='#ffc24b';x.fillRect((pl-t0)/S0*W-2,0,4,H)}
  x.fillStyle='#fff';x.fillRect(W/2-1,0,2,H);
}
let ledT=0;
function frame(){
  D.forEach((d,i)=>{
    loopLegacyTick(d);
    const a=d.a,dur=a.duration||0,cur=posOf(d),rem=dur?dur-cur:0;
    const sp=Q('[data-ph="jog'+i+'"] .spin');if(sp)sp.style.transform=`rotate(${cur*200}deg)`;
    const rg=Q('[data-ph="jog'+i+'"] .ring');if(rg)rg.style.setProperty('--p',dur?cur/dur:0);
    $('jb'+i).textContent=d.bpm?nf(d.bpm*rateOf(d),1):'--';$('jt'+i).textContent='-'+fmt(rem>0?rem:0);
    $('jl'+i).hidden=!d.loading;
    drawW(i);
  });
  if(performance.now()-ledT>150){ledT=performance.now();majLeds()}
  requestAnimationFrame(frame);
}
function majLeds(){
  for(const p of PHYS){const el=Q('[data-ph="'+p.id+'"]');if(!el)continue;const A=PROF.assign[p.id]||{};
    const b=SHIFT.on&&A.shift&&A.shift.fn&&!(A.base&&A.base.fn=='shift')?A.shift:A.base;
    if(p.kind=='b')el.classList.toggle('on',bindingOn(b,p.deck));
    else if(p.kind=='pot'||p.kind=='fader'){const v=bindingVal(A.base,p.deck)??UIV[p.id]??.5;
      if(p.shape=='xf'){const th=el.querySelector('.th');if(th)th.style.left=(v*100)+'%'}else{el.style.setProperty('--v',v);el.querySelector('.kb i').style.transform=`rotate(${-135+v*270}deg)`}}
    else if(p.shape=='enc'){const k=el.querySelector('.kb i');if(k)k.style.transform=`rotate(${(TURN[p.id]||0)*15}deg)`}
  }
  D.forEach((d,i)=>{
    $('wn'+i).textContent=d.name||'Aucun morceau';
    const r=d.r,bits=[];
    if(d.bpm)bits.push(nf(d.bpm*rateOf(d),1)+' BPM'+(r&&r.bc!=null&&r.bc<.6?' ('+confTxt(r.bc)+')':''));
    if(d.key)bits.push(cm(d.key)+(d.key.c!=null&&d.key.c<.6?' ('+confTxt(d.key.c)+')':''));
    if(d.a.src)bits.push(((rateOf(d)-1)*100>=0?'+':'')+nf((rateOf(d)-1)*100,1)+' %');
    if(d.syncLock)bits.push('SYNC');if(d.lp)bits.push('BOUCLE '+lenTxt(Math.round(d.lp.len/beatLen(d)*1000)/1000));if(!d.keylock)bits.push('tonalité libre');
    if(d.a.src&&!d.bpm&&!d.loading)bits.push('tempo non détecté');
    $('wt'+i).textContent=bits.join(' · ');
  });
  const L=live();$('actif').innerHTML='Deck actif : <span style="color:'+COL[L]+';margin-left:8px">'+(L+1)+(L?' ▶':' ◀')+'</span>';
  const js=[...JOBS].filter(j=>!/^start/.test(j.cle||'')),tr=js.find(j=>j.cle=='transition');
  $('trans').classList.toggle('on',js.length>0);
  $('trans').textContent=tr?'▶ '+tr.nom:js.length?js.length+' effet'+(js.length>1?'s':'')+' en cours : '+js.map(j=>j.nom).join(', '):'Aucun automatisme en cours';
  $('stop').classList.toggle('vif',js.length>0||AUTO.on);
  badge();
}
majJobs=()=>{};
function badge(){
  const el=$('cb');const L=live(),ra=recOf(D[L]),rb=recOf(D[1-L]);
  if(!ra||!rb){el.textContent='Compatibilité —';el.className='pill';return}
  const s=pairScore(ra,rb),p=Math.round(s.total*100);
  el.textContent='Deck '+(L+1)+' → '+(2-L)+' · '+p+' %';el.className='pill'+(p>=70?' ok':'');
  el.title='Tempo '+Math.round(s.tempo*100)+' % · tonalité '+(s.key==null?'?':Math.round(s.key*100)+' %')+' · style '+(s.genre==null?'?':Math.round(s.genre*100)+' %')+' · énergie '+(s.energy==null?'?':Math.round(s.energy*100)+' %');
}

/* ---------- mise à l'échelle ---------- */
function fit(){const w=innerWidth,h=innerHeight;SCALE=Math.min(w/2200,h/1240)*(UI.size||1);const st=$('stage');st.style.transform=`translate(${(w-2200*SCALE)/2}px,${(h-1240*SCALE)/2}px) scale(${SCALE})`}

/* ---------- panneaux ---------- */
function openPanel(id,stack){if(!stack)QA('.pan').forEach(p=>{if(p.id!=id)p.hidden=true});$(id).hidden=false;if(id=='pal_temps')renderTemps();if(id=='pal_ia')renderIA();if(id=='pal_fx')renderFx();if(id=='rcm')renderRc();if(id=='set')renderSet()}
function closePanels(){QA('.pan').forEach(p=>p.hidden=true);if(PE)peStop()}
function togglePanel(id){if($(id).hidden)openPanel(id);else $(id).hidden=true}
function choose(title,opts,cb){$('cht').textContent=title;$('chb').innerHTML=opts.map(([v,n])=>`<button data-v="${esc(v)}">${n}</button>`).join('');openPanel('choose',true);$('chb').onclick=e=>{const b=e.target.closest('button');if(!b)return;$('choose').hidden=true;cb(b.dataset.v)}}

/* ---------- palette Temps ---------- */
const TCUR=[['20','20 s'],['30','30 s'],['45','45 s'],['60','1 min'],['90','1 min 30'],['120','2 min'],['x2','2 × 30 s'],['raf','Rafale'],['0','Jusqu\'à la fin'],['perso','Personnalisée…']];
const TDEF=[['20','20 s'],['30','30 s'],['45','45 s'],['60','1 min'],['90','1 min 30'],['120','2 min'],['180','3 min'],['0','Jusqu\'à la fin'],['perso','Personnalisée…']];
function askSec(cb){const v=prompt('Durée en secondes (par exemple 75)','75');const n=Math.round(+String(v||'').replace(',','.'));if(n>=10&&n<=900)cb(n);else if(v!=null)toast('Durée invalide (entre 10 et 900 secondes)')}
function renderTemps(){
  $('tcur').innerHTML=TCUR.map(([k,n])=>`<button data-c="${k}">${n}</button>`).join('');
  $('tdef').innerHTML=TDEF.map(([k,n])=>`<button data-d="${k}"${String(PREF.mt)==k?' class="on ai"':''}>${n}</button>`).join('')+(TDEF.some(x=>x[0]==String(PREF.mt))?'':`<button class="on ai">${lblDur(String(PREF.mt))}</button>`);
  QA('#pal_temps [data-tm]').forEach(b=>b.classList.toggle('on',b.dataset.tm==PREF.tm));QA('#pal_temps [data-tm]').forEach(b=>b.classList.add('ai'));
  QA('#pal_temps [data-tb]').forEach(b=>{b.classList.toggle('on',+b.dataset.tb==PREF.tb);b.classList.add('ai')});
  $('tsi').classList.toggle('on',PREF.si);$('tsi').classList.add('ai');
  tinfo();
}
function tinfo(){
  const el=$('tinfo');if(!el||$('pal_temps').hidden)return;const L=live(),o=D[L];
  if(o.a.paused||!o.a.src){el.textContent='Aucun morceau ne joue.'+(AUTO.on?'':' (Les durées servent au mode AUTO.)');return}
  const r=rateOf(o),tb=tbNow(),trs=o.bpm?tb*wallBeat(o):0,parts=[];
  if(!AUTO.on)parts.push('Mode AUTO coupé : ces durées s\'appliqueront quand tu l\'activeras.');
  if(o.dl!=null&&o.dl<1e8){parts.push('Temps restant avant la transition : <b>'+fmt(Math.max(0,(o.dl-o.a.currentTime)/r))+'</b>')}
  else parts.push('Ce morceau ira jusqu\'à sa fin.');
  if(trs)parts.push('Durée de la transition : <b>'+Math.round(trs)+' s</b> ('+tb+' temps)');
  const I=AUTO.info;
  if(I&&I.deck==L&&I.exit!=null&&I.dl<1e8){const dt=I.exit-I.dl;
    parts.push('Moment musical prévu : <b>'+fmt(I.exit)+'</b>'+(Math.abs(dt)>3?' — ta durée tombait à '+fmt(I.dl)+', au milieu d\'une phrase : je décale de '+(dt>0?'+':'')+Math.round(dt)+' s. Choisis « À l\'échéance exacte » pour garder ta durée.':' (fin de phrase)'))}
  el.innerHTML=parts.join('<br>');
}
setInterval(tinfo,1000);
function initTemps(){
  $('tcur').onclick=e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.c;if(k=='perso')askSec(n=>dureeCeMorceau(String(n)));else dureeCeMorceau(k);tinfo()};
  $('tdef').onclick=e=>{const b=e.target.closest('button');if(!b||!b.dataset.d)return;const set=n=>{PREF.mt=n;savePref();D.forEach(d=>{d.dl=null;d.plan=null});renderTemps();toast('Durée de chaque morceau : '+lblDur(String(n)))};
    if(b.dataset.d=='perso')askSec(set);else set(+b.dataset.d)};
  QA('#pal_temps [data-tm]').forEach(b=>b.onclick=()=>{PREF.tm=b.dataset.tm;savePref();D.forEach(d=>d.plan=null);renderTemps()});
  QA('#pal_temps [data-tb]').forEach(b=>b.onclick=()=>{PREF.tb=+b.dataset.tb;savePref();D.forEach(d=>d.plan=null);renderTemps()});
  $('tsi').onclick=()=>{PREF.si=!PREF.si;savePref();renderTemps();toast(PREF.si?'Le morceau suivant démarre au refrain':'Le morceau suivant démarre au début')};
}

/* ---------- palette IA ---------- */
const TECHS=[['','Auto'],['blend','Fondu EQ'],['bassswap','Échange des basses'],['filter','Filtre'],['echo','Écho'],['cut','Coupure'],['drop','Roulement → drop']];
const AMB={chill:[150,32,false,false],normal:[90,16,false,false],chaud:[40,8,true,true]};
function renderIA(){
  $('iaAuto').classList.toggle('on',AUTO.on);$('iaAuto').classList.add('ai');
  $('iaTech').innerHTML=TECHS.map(([k,n])=>`<button data-k="${k}"${PREF.ft==k?' class="on ai"':''}>${n}</button>`).join('');
  QA('#pal_ia [data-amb]').forEach(b=>{b.classList.toggle('on',b.dataset.amb==PREF.amb);b.classList.add('ai')});
  $('iaVal').classList.toggle('on',!!PREF.valider);$('iaVal').classList.add('ok');
  $('iaBac').innerHTML=`<button data-bc=""${!PREF.bac?' class="on ai"':''}>Toute ma musique</button>`+Object.keys(BACS).map(n=>`<button data-bc="${esc(n)}"${PREF.bac==n?' class="on ai"':''}>${esc(n)}</button>`).join('')+(Object.keys(BACS).length?'':'<small class="mu">Crée des bacs dans Morceaux (bouton « Bac » sur chaque morceau).</small>');
  QA('#pal_ia [data-sty]').forEach(b=>{b.classList.toggle('on',b.dataset.sty==(PREF.style||'propre'));b.classList.add('ai')});QA('#pal_ia [data-anim]').forEach(b=>{b.classList.toggle('on',b.dataset.anim==(PREF.anim||'discret'));b.classList.add('ai')});QA('#pal_ia [data-bloc]').forEach(b=>{b.classList.toggle('on',+b.dataset.bloc==(PREF.bloc??5));b.classList.add('ai')});$('iaRet').classList.toggle('on',!!PREF.retour);$('iaRet').classList.add('ok');
  QA('#pal_ia [data-ex]').forEach(b=>{b.classList.toggle('on',b.dataset.ex==(PREF.ex||'stricte'));b.classList.add('ai')});
  [['iaAp','ap'],['iaDa','da'],['iaFx','fx'],['iaAf','af']].forEach(([id,k])=>{$(id).classList.toggle('on',!!PREF[k]);$(id).classList.add('ok')});
}
function iaPlan(){
  const L=live(),o=D[L],n=D[1-L],el=$('iaPlan');
  if(!o.a.src||!n.a.src){el.innerHTML='<p class="info">Charge un morceau sur chaque deck pour voir le plan.</p>';return}
  const P=getPlan(o,n,{near:o.dl&&o.dl<1e8?o.dl:Math.max(o.a.currentTime+20,(o.a.duration||200)*.7)});
  if(!P){el.innerHTML='<p class="info">Tempo non détecté sur un des deux morceaux : seul un fondu simple est possible.</p>';return}
  const fx=[P.eq.lowSwap?'échange des basses':'',P.eq.midCut?'médiums de A coupés':'',P.fx.riser?'bruit de montée':'',P.fx.impact?'impact':''].filter(Boolean).join(', ');
  el.innerHTML=`<div class="info"><b>${esc(TECH[P.tech])}</b> · ${P.tb} temps (${Math.round(P.tb*wallBeat(o))} s)${P.saved?' · duo enregistré':''}<br>Sortie du deck ${L+1} à <b>${fmt(P.exit)}</b> · entrée du deck ${2-L} à <b>${fmt(P.entry)}</b>${fx?'<br>Réglages : '+fx:''}
  <ul class="pl">${P.why.map(w=>'<li>'+esc(w)+'</li>').join('')}</ul>${P.issues.map(s=>`<div class="iss${s.sev=='err'?' err':''}">${s.sev=='err'?'Erreur':'Attention'} · ${esc(s.msg)}</div>`).join('')||'<div class="iss ok">Aucun problème détecté.</div>'}
  <p class="mu petit">Fiabilité de l'analyse : tempo ${confTxt(P.ra.bc)} / ${confTxt(P.rb.bc)}, tonalité ${confTxt(P.ra.key&&P.ra.key.c)} / ${confTxt(P.rb.key&&P.rb.key.c)}. Les voix sont estimées d'après les médiums, pas reconnues.</p></div>`;
}
function initIA(){
  $('iaAuto').onclick=()=>{setAuto(!AUTO.on);renderIA()};
  $('iaNow').onclick=()=>{if(AUTO.on){AUTO.mixNow=1;toast('Mix lancé')}else aiMix(true)};
  $('iaPlanBtn').onclick=iaPlan;
  $('iaSugg').onclick=()=>openSugg(live());
  QA('#pal_ia [data-sty]').forEach(b=>b.onclick=()=>{PREF.style=b.dataset.sty;if(PREF.style=='festif')PREF.fx=true;else PREF.fx=false;savePref();D.forEach(d=>d.plan=null);renderIA();toast(PREF.style=='propre'?'Transitions propres : longs mélanges sur les fins de phrase, effets rares':'Transitions festives : plus d\'effets')});
  QA('#pal_ia [data-anim]').forEach(b=>b.onclick=()=>{PREF.anim=b.dataset.anim;savePref();renderIA()});
  QA('#pal_ia [data-bloc]').forEach(b=>b.onclick=()=>{PREF.bloc=+b.dataset.bloc;savePref();renderIA()});
  $('iaRet').onclick=()=>{PREF.retour=!PREF.retour;savePref();renderIA()};
  $('iaVal').onclick=()=>{PREF.valider=!PREF.valider;savePref();renderIA();toast(PREF.valider?'Je te montrerai chaque transition AUTO avant de la lancer':'Les transitions AUTO partent sans attendre')};
  $('iaBac').onclick=e=>{const b=e.target.closest('button');if(!b)return;PREF.bac=b.dataset.bc;savePref();renderIA();D.forEach(d=>{if(d.a.paused&&d.cur&&AUTO.on)d.done=1});toast(PREF.bac?'Je pioche seulement dans « '+PREF.bac+' »':'Je pioche dans toute ta musique')};
  QA('#pal_ia [data-ex]').forEach(b=>b.onclick=()=>{PREF.ex=b.dataset.ex;savePref();renderIA();D.forEach(d=>{if(d.a.paused&&d.cur&&!d.done&&AUTO.on)d.done=1});toast('Exigence : '+b.textContent)});
  $('iaTech').onclick=e=>{const b=e.target.closest('button');if(!b)return;PREF.ft=b.dataset.k;savePref();D.forEach(d=>d.plan=null);renderIA();toast('Technique : '+b.textContent)};
  QA('#pal_ia [data-amb]').forEach(b=>b.onclick=()=>{const k=b.dataset.amb,[m,t,i,d]=AMB[k];Object.assign(PREF,{amb:k,mt:m,tb:t,si:i,da:d});savePref();D.forEach(x=>x.plan=null);renderIA();toast('Ambiance '+b.textContent.toLowerCase()+' : '+lblDur(String(m))+' par morceau, transition '+t+' temps'+(d?', drop automatique':''))});
  [['iaAp','ap','Suivre le plan IA'],['iaDa','da','Drop automatique'],['iaFx','fx','Effets automatiques'],['iaAf','af','Correction des erreurs']].forEach(([id,k,n])=>$(id).onclick=()=>{PREF[k]=!PREF[k];savePref();renderIA();toast(n+(PREF[k]?' : activé':' : coupé'))});
}

/* ---------- palette Effets ---------- */
const FXCATS=['Effets rythmiques','Vitesse','Boucles','Filtres','Écho','Volume','Enchaînements','Sons'];
function renderFx(){
  $('fxl').innerHTML=FXCATS.map(cn=>{const c=CATS.find(x=>x.n==cn);if(!c)return'';
    return`<details${cn=='Effets rythmiques'||cn=='Vitesse'?' open':''}><summary>${esc(cn)}</summary>`+c.l.filter(f=>f.k=='b'||f.k=='m').map(f=>`<div class="lr"><span class="wrap"><b>${esc(f.nom)}</b><span class="tag2">${K[f.k]}</span><br><small class="mu">${esc(f.desc||'')}</small></span><button data-try="${f.id}">Essayer</button>${f.p.length?`<button data-prm="${f.id}">Réglages</button>`:''}<button data-asg="${f.id}" class="on ai">Attribuer</button></div>`).join('')+'</details>'}).join('');
}
function initFx(){
  $('fxl').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.try){const f=CAT[b.dataset.try],bd={fn:f.id,deck:'actif',p:PROF.fxp[f.id]||{}};runBinding(bd,null,{t:'press'});if(f.k=='m'){const d=D[live()];setTimeout(()=>runBinding(bd,null,{t:'release'}),Math.max(800,2*(d.bpm?wallBeat(d):.5)*1000))}}
    else if(b.dataset.prm)openParams(b.dataset.prm);
    else if(b.dataset.asg){LEARN={fn:b.dataset.asg,p:Object.assign({},PROF.fxp[b.dataset.asg]||{})};closePanels();$('lnT').textContent='Attribuer « '+CAT[LEARN.fn].nom+' »';$('learn').hidden=false}};
  $('lnQ').onclick=()=>{LEARN=null;$('learn').hidden=true};
}
function learnPick(id){
  const L=LEARN;if(!L)return;const p=PH[id],f=CAT[L.fn];
  if(!PK[p.kind].includes(f.k)){toast(p.nom+' n\'est pas un bouton : choisis un bouton de la platine','err');return}
  const A=PROF.assign[id]=PROF.assign[id]||{},layer=SHIFT.on?'shift':'base';
  A[layer]={fn:f.id,deck:'commande',p:L.p};LEARN=null;$('learn').hidden=true;saveProf();refreshStage();uiFlash(id);
  toast('« '+f.court+' » attribué à '+p.nom+(layer=='shift'?' avec SHIFT':''));
}
/* réglages par défaut d'un effet (utilisés pour « Essayer » et les nouvelles attributions) */
function openParams(fnId){
  const f=CAT[fnId],ED={fn:fnId,p:Object.assign({},PROF.fxp[fnId]||{})};
  $('pkT').textContent='Réglages : '+f.nom;$('pkSub').textContent='Ces réglages servent pour « Essayer » et pour les prochaines attributions.';$('pkQ').hidden=true;$('pkL').innerHTML='';
  $('pkForm').innerHTML=paramsHtml(f,ED.p)+'<div class="row"><button id="pkOk" class="on ok">Enregistrer</button><button id="pkTry">Essayer</button><button id="pkDef">Valeurs d\'origine</button></div>';
  openPanel('pick',true);
  const read=()=>readParams(f,ED.p);
  $('pkOk').onclick=()=>{read();PROF.fxp[fnId]=ED.p;saveProf();$('pick').hidden=true;toast('Réglages enregistrés')};
  $('pkTry').onclick=()=>{read();runBinding({fn:fnId,deck:'actif',p:ED.p},null,{t:'press'})};
  $('pkDef').onclick=()=>{ED.p={};$('pkForm').querySelectorAll('[data-pk]').forEach(i=>{const d=f.p.find(x=>x[0]==i.dataset.pk);i.value=d[2]})};
}
function paramsHtml(f,p){
  if(!f.p.length)return'<p class="mu petit">Cette fonction n\'a pas de réglage.</p>';
  return'<div class="fld">'+f.p.map(([k,n,def,o])=>{const v=p[k]??def,oo=o&&o.dyn=='macros'?(PROF.macros||[]).map(m=>[m.id,m.nom]):o&&o.o;
    return`<label>${esc(n)}</label>`+(oo?`<select class="sel" data-pk="${k}">${(oo.length?oo:[['','(aucune : crée-en dans Effets → Mes macros)']]).map(([ov,ol])=>`<option value="${ov}"${String(ov)==String(v)?' selected':''}>${esc(ol)}</option>`).join('')}</select>`:`<input class="inp" type="number" data-pk="${k}" value="${v}" min="${o.min}" max="${o.max}" step="${o.pas}">`)}).join('')+'</div>';
}
function readParams(f,p){QA('#pkForm [data-pk]').forEach(i=>{const d=f.p.find(x=>x[0]==i.dataset.pk);if(!d)return;let v=i.value;if(typeof d[2]=='number'){v=+String(v).replace(',','.');if(!isFinite(v))v=d[2];if(d[3]&&d[3].min!=null)v=clamp(v,d[3].min,d[3].max)}p[d[0]]=v})}

/* ---------- Commandes ---------- */
function renderRc(){
  const n=Object.values(MIDI.map.phys).filter(m=>m&&m.k).length,tot=CAP_ORDER.length;
  $('rcInfo').innerHTML=(MIDI.devs.length?'Platine : <b>'+esc(MIDI.devs.join(', '))+'</b>':'Platine non détectée (branche-la en USB)')+' · '+n+' commandes reconnues sur '+tot+(MIDI.map.shift?' · SHIFT : '+(MIDI.map.shift.mode=='decal'?'géré par la platine':'géré par l\'application'):'');
  $('rcEdit').classList.toggle('on',EDIT);$('rcEdit').classList.add('ai');
  const grp=[['Deck gauche',p=>p.deck===0],['Centre',p=>p.deck==null],['Deck droit',p=>p.deck===1]];
  $('rcl').innerHTML=grp.map(([g,fl])=>`<details open><summary>${g}</summary>`+PHYS.filter(fl).map(p=>{const A=PROF.assign[p.id]||{},m=MIDI.map.phys[p.id];
    return`<div class="lr"><span class="wrap"><b>${esc(p.nom)}</b> <small class="mu">${m?(m.none?'n\'envoie rien':physLabel(m.k)):'pas configurée'}</small><br>Fonction : <b>${esc(A.base&&CAT[A.base.fn]?CAT[A.base.fn].nom:'aucune')}</b>${A.base&&A.base.nom?' (affiché « '+esc(A.base.nom)+' »)':''}${p.kind=='b'?'<br><small>Avec SHIFT : '+esc(A.shift&&CAT[A.shift.fn]?CAT[A.shift.fn].nom:'même fonction')+'</small>':''}</span><button data-e="${p.id}" data-l="base">Changer</button>${p.kind=='b'?`<button data-e="${p.id}" data-l="shift">SHIFT +</button>`:''}</div>`}).join('')+'</details>').join('');
}
function setEdit(on){EDIT=on;document.body.classList.toggle('edit',EDIT);$('bEdit').classList.toggle('on',EDIT);if(EDIT)toast('Mode modification : touche une commande (à l\'écran ou sur la platine) pour changer sa fonction');}
function initRc(){
  $('rcl').onclick=e=>{const b=e.target.closest('button[data-e]');if(b)openEditor(b.dataset.e,b.dataset.l)};
  $('rcCap').onclick=()=>capStart();
  $('rcTest').onclick=()=>{closePanels();MIDI.test=true;MIDI.testRun=false;$('testRun').checked=false;$('test').hidden=false};
  $('testRun').onchange=e=>MIDI.testRun=e.target.checked;
  $('testQ').onclick=()=>{MIDI.test=false;$('test').hidden=true};
  $('rcEdit').onclick=()=>{setEdit(!EDIT);renderRc();if(EDIT)closePanels()};
  $('bEdit').onclick=()=>setEdit(!EDIT);
  $('rcReset').onclick=()=>{if(!confirm('Remettre toutes les commandes de ce profil sur leurs fonctions d\'origine ?'))return;PROF.assign=JSON.parse(JSON.stringify(DEF_ASSIGN));PROF.inv={};saveProf();refreshStage();renderRc();toast('Commandes remises par défaut')};
  $('capB').onclick=()=>{const C=MIDI.cap;if(!C)return;clearTimeout(C.tm);C.tm=0;C.buf=[];C.shiftTest=false;C.i=Math.max(0,C.i-1);capShow()};
  $('capRe').onclick=()=>{const C=MIDI.cap;if(!C)return;clearTimeout(C.tm);C.tm=0;C.buf=[];capShow()};
  $('capSk').onclick=()=>{const C=MIDI.cap;if(!C)return;clearTimeout(C.tm);C.tm=0;C.buf=[];if(C.shiftTest||C.single){capStop('Configuration terminée');return}C.i++;capShow()};
  $('capNone').onclick=()=>{const C=MIDI.cap;if(!C||C.shiftTest)return;clearTimeout(C.tm);C.tm=0;C.buf=[];MIDI.map.phys[CAP_ORDER[C.i]]={none:true};if(C.single){capStop('Enregistré : n\'envoie rien');return}C.i++;capShow()};
  $('capQ').onclick=()=>capStop('Configuration arrêtée : ce qui a été capturé est gardé');
}
/* éditeur d'une commande */
let ED=null;
function openEditor(id,layer){
  const p=PH[id];if(!p)return;if(p.kind!='b')layer='base';
  const A=PROF.assign[id]||{},cur=A[layer];
  ED={id,layer,fn:cur&&cur.fn||'',deck:cur&&cur.deck||'commande',p:Object.assign({},cur&&cur.p||{}),nom:cur&&cur.nom||''};
  $('pkT').textContent=p.nom+(layer=='shift'?' · avec SHIFT':'');$('pkQ').hidden=false;$('pkQ').value='';
  const m=MIDI.map.phys[id];
  $('pkSub').textContent='Type : '+({b:'bouton',pot:'potentiomètre',fader:'curseur',jog:'molette',enc:'bouton rotatif'}[p.kind])+' · imprimé sur la platine : « '+p.impr+' » · '+(m?(m.none?'n\'envoie rien':physLabel(m.k)):'pas encore configurée');
  $('pkSub').innerHTML=esc($('pkSub').textContent)+' · <button id="edRe" class="on ai">Réapprendre cette commande</button>';$('edRe').onclick=()=>{$('pick').hidden=true;$('rcm').hidden=true;MIDI.test=false;$('test').hidden=true;capStart(CAP_ORDER.indexOf(id),true)};
  renderEdForm();renderEdList();openPanel('pick',true);
}
function renderEdForm(){
  const p=PH[ED.id],f=CAT[ED.fn];
  if(!f){$('pkForm').innerHTML='<p class="info">'+(ED.layer=='shift'?'Aucune fonction avec SHIFT : la commande garde sa fonction normale.':'Aucune fonction.')+' Choisis une fonction dans la liste.</p>'+(ED.layer=='shift'?'':'<div class="row"><button id="edDef">Fonction d\'origine</button></div>');const d=$('edDef');if(d)d.onclick=edDefault;return}
  const decks=[['commande',p.deck==null?'Deck actif (commande du centre)':'Le deck de cette commande ('+SIDE[p.deck]+')'],['actif','Le deck actif (celui qu\'on entend)'],['autre','L\'autre deck (celui qui attend)'],['1','Toujours le deck 1'],['2','Toujours le deck 2']];
  $('pkForm').innerHTML=`<div class="info"><b>${esc(f.nom)}</b> <span class="tag2">${K[f.k]}</span><br><small>${esc(f.desc||'')}</small></div>
  <div class="fld"><label>Agit sur</label><select class="sel" id="edDeck">${decks.map(([v,n])=>`<option value="${v}"${ED.deck==v?' selected':''}>${n}</option>`).join('')}</select>
  <label>Nom affiché sur la commande</label><input class="inp" id="edNom" maxlength="14" placeholder="${esc(f.court)}" value="${esc(ED.nom)}">
  ${p.kind!='b'?`<label>Sens inversé</label><label class="chk"><input type="checkbox" id="edInv"${PROF.inv[ED.id]?' checked':''}>Inverser le sens</label>`:''}</div>
  ${paramsHtml(f,ED.p)}
  <div class="row"><button id="edOk" class="on ok">Enregistrer</button><button id="edTry">Essayer</button><button id="edDef">Fonction d'origine</button>${ED.layer=='shift'?'<button id="edRm">Retirer la fonction SHIFT</button>':''}</div>`;
  $('edOk').onclick=edSave;$('edDef').onclick=edDefault;
  $('edTry').onclick=()=>{readParams(f,ED.p);const b={fn:ED.fn,deck:$('edDeck').value,p:ED.p};if(f.k=='b'||f.k=='m'){runBinding(b,p.deck,{t:'press'});if(f.k=='m')setTimeout(()=>runBinding(b,p.deck,{t:'release'}),1500)}else toast('Essaie-la directement avec la commande')};
  const rm=$('edRm');if(rm)rm.onclick=()=>{const A=PROF.assign[ED.id];if(A)delete A.shift;saveProf();refreshStage();$('pick').hidden=true;if(!$('rcm').hidden)renderRc();toast('Fonction SHIFT retirée')};
}
function renderEdList(){
  const p=PH[ED.id],q=$('pkQ').value.toLowerCase(),ok=PK[p.kind];
  $('pkL').innerHTML=CATS.map(c=>{const L=c.l.filter(f=>ok.includes(f.k)&&(f.nom+' '+c.n+' '+f.court).toLowerCase().includes(q));if(!L.length)return'';
    return'<h3>'+esc(c.n)+'</h3>'+L.map(f=>`<div class="fn${f.id==ED.fn?' sel':''}" data-f="${f.id}"><b>${esc(f.nom)}</b><small>${K[f.k]}</small></div>`).join('')}).join('');
}
function edSave(){
  const f=CAT[ED.fn];if(!f)return;readParams(f,ED.p);
  const A=PROF.assign[ED.id]=PROF.assign[ED.id]||{};A[ED.layer]={fn:ED.fn,deck:$('edDeck').value,p:ED.p,nom:$('edNom').value.trim()||undefined};
  const inv=$('edInv');if(inv){if(inv.checked)PROF.inv[ED.id]=1;else delete PROF.inv[ED.id]}
  saveProf();refreshStage();$('pick').hidden=true;if(!$('rcm').hidden)renderRc();uiFlash(ED.id);toast('Enregistré : '+(PH[ED.id].impr)+' → '+f.court);
}
function edDefault(){const d=DEF_ASSIGN[ED.id];const A=PROF.assign[ED.id]=PROF.assign[ED.id]||{};
  if(ED.layer=='shift'){if(d&&d.shift)A.shift=JSON.parse(JSON.stringify(d.shift));else delete A.shift}else A.base=d?JSON.parse(JSON.stringify(d.base)):{fn:'aucune',deck:'commande'};
  saveProf();refreshStage();$('pick').hidden=true;if(!$('rcm').hidden)renderRc();toast('Fonction d\'origine remise')}
function initEditor(){
  $('pkQ').oninput=renderEdList;
  $('pkL').onclick=e=>{const r=e.target.closest('[data-f]');if(!r||!ED)return;ED.fn=r.dataset.f;ED.p=Object.assign({},PROF.fxp[ED.fn]||{});ED.nom='';renderEdForm();renderEdList();$('pkForm').scrollIntoView({block:'nearest'})};
}

/* ---------- Réglages ---------- */
function renderSet(){
  $('pf').innerHTML=Object.keys(PROFS).map(n=>`<option${n==CURP?' selected':''}>${esc(n)}</option>`).join('');
  $('latV').textContent='Retard : '+Math.round(LAT*1000)+' ms';$('latS').value=Math.round(LAT*1000);
  $('casOn').checked=!!LS.get('bd5_cas',false);$('egal').checked=G.egal;$('calage').checked=CALAGE;$('anaLive').checked=!!PREF.anaLive;
  $('ui_wave').checked=!!UI.wave;$('ui_coach').checked=!!UI.coach;$('ui_size').value=UI.size;
  $('ver').textContent='BeatDeck '+VERSION+' · sortie : '+AC.destination.maxChannelCount+' canaux · retard annoncé par Android : '+Math.round(((AC.outputLatency||0)+(AC.baseLatency||0))*1000)+' ms';
}
function initSet(){
  $('latS').oninput=e=>{LAT=+e.target.value/1000;LS.set('bd5_lat',LAT);$('latV').textContent='Retard : '+Math.round(LAT*1000)+' ms'};
  $('latM').onclick=()=>{openPanel('calib',true);$('calR').textContent='';$('calTap').textContent='Commencer';$('calTap').classList.remove('on')};
  $('egal').onchange=e=>{G.egal=e.target.checked;LS.set('bd5_egal',G.egal);mix()};
  $('calage').onchange=e=>{CALAGE=e.target.checked;LS.set('bd5_calage',CALAGE)};
  $('anaLive').onchange=e=>{PREF.anaLive=e.target.checked;savePref()};
  $('casOn').onchange=e=>{const ok=route(e.target.checked);LS.set('bd5_cas',e.target.checked&&ok);if(e.target.checked&&!ok){e.target.checked=false;toast('Impossible : la sortie actuelle n\'a que '+AC.destination.maxChannelCount+' canaux','err')}else toast(ok?'Casque séparé actif : canaux 3-4 = casque':'Casque séparé coupé')};
  $('casT').onclick=testCasque;
  $('tb').onclick=()=>{AC.resume();const o=AC.createOscillator(),g=AC.createGain();g.gain.value=.2;o.connect(g);g.connect(BUS.master);o.start();o.stop(AC.currentTime+.6);toast('Bip envoyé · audio : '+(AC.state=='running'?'actif':AC.state))};
  ['ui_wave','ui_coach'].forEach(id=>$(id).onchange=()=>{UI.wave=+$('ui_wave').checked;UI.coach=+$('ui_coach').checked;saveProf();applyUI()});
  $('ui_size').oninput=()=>{UI.size=+$('ui_size').value;saveProf();applyUI()};
  $('calTap').onpointerdown=e=>{e.preventDefault();calTap()};
}
function applyUI(){document.body.classList.toggle('nowave',!UI.wave);document.body.classList.toggle('nocoach',!UI.coach);fit()}
function testCasque(){
  AC.resume();const n=AC.destination.maxChannelCount;
  if(n<4){$('casInfo').innerHTML='Résultat : la sortie actuelle n\'a que <b>'+n+' canaux</b>. Le casque séparé n\'est pas possible ainsi. Pour essayer : branche la platine en USB, choisis-la comme sortie du son dans Android (et non les enceintes Bluetooth), relance l\'appli puis refais le test. Les enceintes se branchent alors sur la sortie RCA de la platine.';return}
  const was=BUS.split;route(true);const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=660;g.gain.value=.25;o.connect(g);g.connect(BUS.cue);o.start();o.stop(AC.currentTime+1.5);
  setTimeout(()=>{if(!was)route(false)},1700);
  $('casInfo').innerHTML='Résultat : la sortie a <b>'+n+' canaux</b>. Je viens de jouer un bip <b>uniquement dans le casque</b>. Si tu l\'as entendu seulement dans le casque, coche « Utiliser le casque séparé ». Si tu l\'as entendu dans les enceintes, la séparation ne fonctionne pas avec ce branchement.';
}
/* mesure du retard Bluetooth */
let CAL=null;
function calTap(){
  AC.resume();const now=performance.now();
  if(!CAL||CAL.fini){
    const ctx0=AC.currentTime+.8,per=.6,N=14,perf0=performance.now()+(ctx0-AC.currentTime)*1000;CAL={clicks:[],taps:[],fini:false};
    for(let k=0;k<N;k++){const t=ctx0+k*per,o=AC.createOscillator(),g=AC.createGain();o.frequency.value=k%4?1200:1800;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.4,t+.002);g.gain.exponentialRampToValueAtTime(.001,t+.06);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+.08);CAL.clicks.push(perf0+k*per*1000)}
    $('calTap').textContent='Touche en rythme avec les tic !';$('calTap').classList.add('on');$('calR').textContent='';
    setTimeout(calFin,(.8+N*per+.9)*1000);return;
  }
  CAL.taps.push(now);$('calR').textContent=CAL.taps.length+' appuis';
}
function calFin(){
  const C=CAL;C.fini=true;$('calTap').classList.remove('on');$('calTap').textContent='Recommencer';
  const ds=[];C.taps.forEach(t=>{let best=null;C.clicks.slice(3).forEach(c=>{const d=t-c;if(d>-150&&d<700&&(best==null||Math.abs(d-250)<Math.abs(best-250)))best=d});if(best!=null)ds.push(best)});
  if(ds.length<5){$('calR').textContent='Pas assez d\'appuis en rythme. Recommence en touchant à chaque tic.';return}
  const m=med(ds),spread=med(ds.map(d=>Math.abs(d-m)));
  if(spread>70){$('calR').textContent='Mesure peu régulière (écart '+Math.round(spread)+' ms). Recommence en suivant bien le rythme.';return}
  LAT=clamp(m/1000,0,.6);LS.set('bd5_lat',LAT);renderSet();
  $('calR').innerHTML='Retard mesuré : <b>'+Math.round(m)+' ms</b> (régularité '+(spread<30?'très bonne':'correcte')+'). Il est enregistré et utilisé pour caler boucles, effets et affichage sur ce que tu entends.';
}

/* ---------- Meilleurs morceaux pour celui qui joue ---------- */
let SGD=0;
function openSugg(i){SGD=i;openPanel('sugg');renderSugg()}
function renderSugg(){
  const d=D[SGD],r=recOf(d);QA('#sugg [data-sd]').forEach(b=>{b.classList.toggle('on',+b.dataset.sd==SGD);b.classList.add('ai')});
  $('sgT').textContent='Meilleurs morceaux après le deck '+(SGD+1);
  if(!r){$('sgI').textContent='Charge un morceau analysé sur le deck '+(SGD+1)+'.';$('sgL').innerHTML='';return}
  const niv=PREF.ex||'stricte',L=classer(r,d.cur&&d.cur.id),ok=L.filter(x=>passe(x,niv)),non=L.length-ok.length;
  $('sgI').innerHTML='<b>'+esc(d.name)+'</b> · '+nf(r.bpm,1)+' BPM · '+cm(r.key)+' · '+(r.rf?RFN[r.rf]+' ('+confTxt(r.rfc)+')':'style pas encore analysé')+'<br>'+ok.length+' morceau'+(ok.length>1?'x':'')+' compatible'+(ok.length>1?'s':'')+' avec l\'exigence « '+niv+' »'+(non?' · '+non+' écarté'+(non>1?'s':''):'');
  const o=1-SGD,row=x=>{const sc=x.sc,c=[];c.push('<b>'+Math.round(x.s*100)+' %</b>');
    if(sc.son!=null)c.push('style '+Math.round(sc.son*100)+' %'+(x.it.r.rf?' · '+RFC[x.it.r.rf]:''));
    c.push('tempo '+(sc.ad<=3?'✓':sc.ad<=6?'~':'✗')+' '+Math.round(x.it.r.bpm));
    if(sc.key!=null)c.push('tonalité '+cm(r.key)+'→'+cm(x.it.r.key)+(sc.key>=.85?' ✓':sc.key>=.4?' ~':' ✗'));
    if(x.refus)c.push('<span style="color:var(--bad)">déjà refusé</span>');
    return`<div class="lr"><span class="wrap"><b>${esc(x.it.name)}</b><br><small class="mu">${c.join(' · ')}</small></span><button data-sl="${lib.indexOf(x.it)}" class="d${o}">Deck ${o+1}</button><button data-sq="${lib.indexOf(x.it)}">File</button><button data-sx="${lib.indexOf(x.it)}" title="Ne va pas avec ce morceau">✕</button></div>`};
  $('sgL').innerHTML=(ok.length?ok.slice(0,12).map(row).join(''):'<p class="info">Aucun morceau assez proche dans ta musique. Ajoute des morceaux du même style, ou passe l\'exigence sur « Normale ».</p>')+
    (non&&niv!='libre'?'<details><summary>Écartés (style ou tempo trop différents)</summary>'+L.filter(x=>!passe(x,niv)).slice(0,10).map(row).join('')+'</details>':'');
}
function initSugg(){
  QA('#sugg [data-sd]').forEach(b=>b.onclick=()=>{SGD=+b.dataset.sd;renderSugg()});
  $('sgL').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=D[SGD];
    if(b.dataset.sl){const it=lib[+b.dataset.sl];chargerDeck(1-SGD,it).then(ok=>{if(ok){AUTO.played.add(it.id);toast('Deck '+(2-SGD)+' : '+it.name);$('sugg').hidden=true}})}
    else if(b.dataset.sq){const it=lib[+b.dataset.sq];AUTO.queue.push(it);toast('File d\'attente ('+AUTO.queue.length+') : '+it.name)}
    else if(b.dataset.sx){const it=lib[+b.dataset.sx];if(d.cur)noterRefus(d.cur.id,it.id);toast('Noté : « '+it.name+' » ne va pas après ce morceau');renderSugg()}};
}
