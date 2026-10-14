'use strict';
/* ===== BeatDeck 6 · l'interface =====
   La platine The Next Beat by Tiësto SX1 dessinée à l'écran, commandes aux mêmes emplacements que la vraie.
   Chaque commande (à l'écran ou sur la platine) appelle commande(id, geste) dans bd-commandes.js. */
const VERSION='6.11.0';
const $=id=>document.getElementById(id),Q=(s,r=document)=>r.querySelector(s),QA=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>isFinite(s)&&s>=0?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
const nf=(v,d=1)=>Number(v).toFixed(d).replace('.',',');
let toastT;function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600)}
const COL=['#38c8ff','#b46bff'];
let SCALE=1;

/* ---------- les commandes physiques de la platine (scène de 2200 × 1240) ----------
   id, deck (0 = gauche, 1 = droite, null = milieu), type, nom complet, texte affiché, position x/y, taille, forme */
const PHYS=[],PH={};
function ph(id,deck,nom,txt,x,y,w,h,forme){const p={id,deck,nom,txt,x,y,w,h:h||w,forme};PHYS.push(p);PH[id]=p;return p}
[0,1].forEach(i=>{
  const s=i?' (deck droit)':' (deck gauche)',X=x=>i?2200-x:x;
  ph('tmpm'+i,i,'Bouton TEMPO −'+s,'TEMPO −',X(i?300:220),412,78,58,'rect');
  ph('tmpp'+i,i,'Bouton TEMPO +'+s,'TEMPO +',X(i?220:300),412,78,58,'rect');
  ph('lpp'+i,i,'Bouton boucle +'+s,'BOUCLE +',X(175),492,56,56,'round');
  ph('lpa'+i,i,'Bouton boucle auto'+s,'BOUCLE AUTO',X(175),556,62,58,'rect');
  ph('lpm'+i,i,'Bouton boucle −'+s,'BOUCLE −',X(175),620,56,56,'round');
  ph('cue'+i,i,'Bouton CUE'+s,'CUE',X(172),905,96,92,'rect');
  ph('play'+i,i,'Bouton lecture'+s,'LECTURE ▶/II',X(172),1012,96,92,'rect');
  ph('jog'+i,i,'Molette'+s,'MOLETTE',X(520),690,600,600,'jog');
  ph('sync'+i,i,'Bouton SYNC'+s,'SYNC',X(752),380,58,58,'round');
  ph('flt'+i,i,'Bouton rotatif FILTRE'+s,'FILTRE',X(836),388,72,72,'knob');
  ph('fx'+i,i,'Bouton FX'+s,'FX',X(842),474,52,52,'round');
  ph('hi'+i,i,'Bouton rotatif AIGUS'+s,'AIGUS',X(944),390,72,72,'knob');
  ph('low'+i,i,'Bouton rotatif GRAVES'+s,'GRAVES',X(944),498,72,72,'knob');
  ph('vol'+i,i,'Bouton rotatif VOLUME'+s,'VOLUME',X(944),606,72,72,'knob');
  ph('vin'+i,i,'Bouton VINYLE'+s,'VINYLE',X(944),706,84,56,'rect');
  ph('cas'+i,i,'Bouton CASQUE'+s,'CASQUE',X(944),786,84,56,'rect');
  ph('shf'+i,i,'Bouton SHIFT '+(i+1)+s,'SHIFT',X(944),874,84,56,'rect');
});
ph('brw',null,'Bouton PARCOURIR (on le tourne et on appuie)','PARCOURIR',1100,404,96,96,'enc');
ph('brwp',null,'Appui sur le bouton PARCOURIR','PARCOURIR',1100,404,1,1,'hidden');
ph('mst',null,'Bouton MASTER','MASTER',1100,528,74,56,'rect');
ph('ld1',null,'Bouton CHARGER 1','CHARGER 1',1036,606,62,56,'rect');
ph('ld2',null,'Bouton CHARGER 2','CHARGER 2',1164,606,62,56,'rect');
ph('mg',null,'Bouton rotatif VOLUME GÉNÉRAL','VOL. GÉNÉRAL',1100,700,72,72,'knob');
ph('xf',null,'Crossfader','CROSSFADER',1100,980,330,60,'xf');

/* position affichée de chaque commande (0 à 1), en mémoire seulement */
const VAL={};
PHYS.forEach(p=>{if(p.forme=='hidden')return;if(p.forme=='knob')VAL[p.id]=/^vol/.test(p.id)?.8:p.id=='mg'?.7:.5;if(p.forme=='xf')VAL[p.id]=.5;if(p.forme=='jog'||p.forme=='enc')VAL[p.id]=0});

/* ---------- galaxie spirale dessinée une fois par deck (image de fond des molettes) ---------- */
function galaxie(col){
  const N=640,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),R=N/2;
  const rgb=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16));const [r,g,b]=rgb(col);
  let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647; // tirage fixe : la galaxie est toujours la même
  x.globalCompositeOperation='lighter';
  // halo central
  let gr=x.createRadialGradient(R,R,0,R,R,R*.42);gr.addColorStop(0,'rgba(255,255,255,.95)');gr.addColorStop(.12,`rgba(${r},${g},${b},.75)`);gr.addColorStop(.5,`rgba(${r},${g},${b},.18)`);gr.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=gr;x.fillRect(0,0,N,N);
  // bras en spirale
  const bras=3;
  for(let k=0;k<5200;k++){
    const a=Math.floor(rnd()*bras),t=Math.pow(rnd(),.75),rad=t*R*.95,ang=a*2*Math.PI/bras+t*4.2+(rnd()-.5)*(.55-.3*t);
    const px=R+Math.cos(ang)*rad+(rnd()-.5)*12,py=R+Math.sin(ang)*rad+(rnd()-.5)*12,sz=rnd()*1.8+.4,al=(1-t)*.7+.15;
    const mix=rnd();const cr=mix<.15?255:mix<.45?150:r,cg=mix<.15?255:mix<.45?125:g,cb=mix<.15?255:255;
    x.fillStyle=`rgba(${cr},${cg},${cb},${al})`;x.beginPath();x.arc(px,py,sz,0,6.3);x.fill();
  }
  // nuages diffus le long des bras
  for(let k=0;k<160;k++){const a=Math.floor(rnd()*bras),t=rnd(),rad=t*R*.85,ang=a*2*Math.PI/bras+t*4.2,px=R+Math.cos(ang)*rad,py=R+Math.sin(ang)*rad,rr=18+rnd()*30;
    const n=x.createRadialGradient(px,py,0,px,py,rr);n.addColorStop(0,`rgba(${r},${g},${b},${.10*(1-t)+.03})`);n.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=n;x.fillRect(px-rr,py-rr,rr*2,rr*2)}
  return c.toDataURL();
}

/* ---------- construction de l'écran ---------- */
function construire(){
  $('waves').innerHTML=[0,1].map(i=>`<div class="wr" style="--c:${COL[i]}"><div class="wi"><div class="t1"><b>DECK ${i+1}</b><span class="nm" id="wn${i}">Aucun morceau</span></div><div class="t2" id="wt${i}">Choisis une musique dans 🎵 Bibliothèque</div></div><div class="wc"><canvas id="w${i}"></canvas></div></div>`).join('');
  let h=`<div class="plate" style="left:40px;top:330px;width:850px;height:760px"></div><div class="plate" style="left:1310px;top:330px;width:850px;height:760px"></div><div class="plate mx" style="left:878px;top:338px;width:444px;height:744px"></div>`;
  h+=`<div class="deco brand" style="left:1100px;top:895px;transform:translateX(-50%)">⟆ The Next Beat</div><div class="deco" style="left:330px;top:1050px">+ SEARCH −</div><div class="deco" style="left:1760px;top:1050px">+ SEARCH −</div><div class="deco" style="left:100px;top:360px">MASTER TEMPO</div><div class="deco" style="left:1905px;top:360px">MASTER TEMPO</div>`;
  for(const p of PHYS){
    if(p.forme=='hidden')continue;
    const st=`left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;--c:${p.deck==null?'var(--or)':COL[p.deck]}`,lab=`<span class="lbl b"></span><span class="lbl s"></span>`,t=` data-ph="${p.id}" title="${p.nom}" style="${st}"`;
    if(p.forme=='rect'||p.forme=='round')h+=`<div class="ctl btn ${p.forme}${p.w>90?' big':''}"${t}>${lab}</div>`;
    else if(p.forme=='knob'||p.forme=='enc')h+=`<div class="ctl knob ${p.forme}${/^flt/.test(p.id)?' flt':''}"${t}><div class="kb"><i></i></div>${lab}</div>`;
    else if(p.forme=='jog')h+=`<div class="ctl jog"${t}><div class="ring"></div><div class="plat"></div><div class="spin"><div class="gal"></div><div class="rep"></div></div><div class="coeur"></div><div class="mid"><b>--</b><small>BPM</small><span class="tr">-0:00</span></div>${lab}</div>`;
    else if(p.forme=='xf')h+=`<div class="ctl xf"${t}><div class="tr"></div><div class="th"></div>${lab}</div>`;
  }
  $('sx1').innerHTML=h;
  [0,1].forEach(i=>{const g=Q('[data-ph="jog'+i+'"] .gal');if(g)g.style.backgroundImage=`url(${galaxie(COL[i])})`});
  QA('#sx1 .ctl').forEach(gestes);
  etiquettes();
  PHYS.forEach(p=>{dessiner(p.id);const el=Q('[data-ph="'+p.id+'"]');if(el&&typeof estRaccourci=='function'&&estRaccourci(p.id))el.classList.add('racc')});
}

/* ---------- nom de la fonction écrit sur chaque commande (en jaune : avec SHIFT) ---------- */
function etiquettes(){
  for(const p of PHYS){const el=Q('[data-ph="'+p.id+'"]');if(!el)continue;const F=FN[p.id]||{},b=el.querySelector('.lbl.b'),s=el.querySelector('.lbl.s');
    b.textContent=F.base?F.base.nom:p.txt;s.textContent=F.shift?F.shift.nom:'';b.classList.toggle('aS',!!F.shift);
    el.title=p.nom+(F.base?'\n'+F.base.nom+' : '+F.base.desc:'')+(F.shift?'\nAvec SHIFT · '+F.shift.nom+' : '+F.shift.desc:'');}
}

/* ---------- affichage de la position d'une commande ---------- */
function dessiner(id){
  const p=PH[id],el=Q('[data-ph="'+id+'"]');if(!el)return;const v=VAL[id];
  if(p.forme=='knob'){el.style.setProperty('--v',v);el.querySelector('.kb i').style.transform=`rotate(${-135+v*270}deg)`}
  else if(p.forme=='enc')el.querySelector('.kb i').style.transform=`rotate(${v*15}deg)`;
  else if(p.forme=='xf')el.querySelector('.th').style.left=(v*100)+'%';
  else if(p.forme=='jog'){const d=D[p.deck];el.querySelector('.spin').style.transform=`rotate(${d&&d.a.src?posOf(d)*200:v}deg)`}
}

/* ---------- gestes à l'écran : ils font exactement comme la platine ---------- */
function gestes(el){
  const id=el.dataset.ph,p=PH[id];
  if(p.forme=='rect'||p.forme=='round'){
    let down=false;
    el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);down=true;el.classList.add('hit');commande(id,{t:'press'})};
    const up=()=>{if(!down)return;down=false;el.classList.remove('hit');commande(id,{t:'release'})};
    el.onpointerup=up;el.onpointercancel=up;
  }else if(p.forme=='knob'){
    // glisser vers le haut = tourner à droite ; double appui = remettre au milieu
    el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(typeof REAPP!='undefined'&&REAPP.attente){commande(id,{t:'press'});return}const y0=e.clientY,v0=VAL[id];
      el.onpointermove=ev=>{const v=clamp(v0+(y0-ev.clientY)/(260*SCALE));VAL[id]=v;dessiner(id);commande(id,{t:'value',v})}};
    el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null};
    el.ondblclick=()=>{if(!/^vol|^mg/.test(id)){VAL[id]=.5;dessiner(id);commande(id,{t:'value',v:.5})}};
  }else if(p.forme=='enc'){
    el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);let y=e.clientY,bouge=0;el.classList.add('hit');
      el.onpointermove=ev=>{const dy=ev.clientY-y;if(Math.abs(dy)>34*SCALE){y=ev.clientY;bouge=1;VAL[id]+=Math.sign(dy);dessiner(id);commande(id,{t:'delta',v:Math.sign(dy)})}};
      el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null;el.classList.remove('hit');if(!bouge){commande('brwp',{t:'press'});commande('brwp',{t:'release'})}}};
  }else if(p.forme=='jog'){
    el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(typeof REAPP!='undefined'&&REAPP.attente){commande(id,{t:'press'});return}
      const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let a0=Math.atan2(e.clientY-cy,e.clientX-cx);
      el.onpointermove=ev=>{const a=Math.atan2(ev.clientY-cy,ev.clientX-cx);let d=a-a0;a0=a;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;VAL[id]+=d*180/Math.PI;const n=Math.round(d*30);if(n)commande(id,{t:'delta',v:n})}};
    el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null};
  }else if(p.forme=='xf'){
    const set=ev=>{const r=el.getBoundingClientRect(),v=clamp((ev.clientX-r.left)/r.width);VAL[id]=v;dessiner(id);commande(id,{t:'value',v})};
    el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(typeof REAPP!='undefined'&&REAPP.attente){commande(id,{t:'press'});return}set(e);el.onpointermove=set};
    el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null};
  }
}
/* petit éclat quand la platine appuie sur un bouton */
function eclat(id){const el=Q('[data-ph="'+(id=='brwp'?'brw':id)+'"]');if(!el)return;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}

/* ---------- affichage en continu : molettes, voyants, bandes des decks ---------- */
function onde(i){
  const d=D[i],c=$('w'+i);if(!c)return;const r=devicePixelRatio||1,W=Math.round(c.clientWidth*r),H=Math.round(c.clientHeight*r);if(!W||!H)return;
  if(c.width!=W)c.width=W;if(c.height!=H)c.height=H;const x=c.getContext('2d');x.clearRect(0,0,W,H);if(!d.pk)return;
  const ct=heard(d),S0=12,t0=ct-S0/2,bw=2*r,col=COL[i],X=t=>(t-t0)/S0*W;
  if(d.lp){x.fillStyle=col+'2a';x.fillRect(X(d.lp.s),0,X(d.lp.s+d.lp.len)-X(d.lp.s),H)}
  for(let px=0;px<W;px+=bw){const t=t0+px/W*S0,k=Math.floor(t*50);if(k<0||k>=d.pk.length)continue;const h=Math.max(1,d.pk[k]*H*.9);x.fillStyle=px<W/2?col+'70':col;x.fillRect(px,(H-h)/2,bw-1,h)}
  if(d.grid){const p=beatLen(d);for(let n=Math.ceil((t0-d.off)/p);d.off+n*p<t0+S0;n++){x.fillStyle=n%4?'#ffffff22':'#ffffff88';x.fillRect(X(d.off+n*p),0,n%4?1:2,H)}}
  const marque=(t,c,txt)=>{if(t==null||t<t0||t>t0+S0)return;x.fillStyle=c;x.fillRect(X(t)-1.5*r,0,3*r,H);x.font=(11*r)+'px sans-serif';x.fillText(txt,X(t)+4*r,12*r)};
  marque(d.cue,'#ffd27a','CUE');marque(d.hc[0],'#5ef0d2','1');marque(d.hc[1],'#5ef0d2','2');
  x.fillStyle='#fff';x.fillRect(W/2-r,0,2*r,H);
}
let derLed=0;
function image(){
  D.forEach((d,i)=>{
    loopLegacyTick(d);
    const dur=d.a.duration||0,cur=posOf(d),reste=dur?dur-cur:0,jog=Q('[data-ph="jog'+i+'"]');
    if(jog){dessiner('jog'+i);jog.querySelector('.ring').style.setProperty('--p',dur?cur/dur:0);
      jog.querySelector('.mid b').textContent=d.chargement?'…':d.bpm?nf(d.bpm*rateOf(d),1):'--';jog.querySelector('.mid small').textContent=d.chargement?'ANALYSE':'BPM';
      jog.querySelector('.mid .tr').textContent='-'+fmt(reste>0?reste:0);jog.classList.toggle('fin',!d.a.paused&&reste>0&&reste<20)}
    onde(i);
  });
  if(performance.now()-derLed>120){derLed=performance.now();voyants()}
  requestAnimationFrame(image);
}
function voyants(){
  for(const p of PHYS){if(p.forme!='rect'&&p.forme!='round')continue;const el=Q('[data-ph="'+p.id+'"]');if(!el)continue;
    const f=typeof fonctionDe=='function'?fonctionDe(p.id):null;el.classList.toggle('on',!!(f&&f.on&&f.on()))}
  D.forEach((d,i)=>{
    $('wn'+i).textContent=d.nom||'Aucun morceau';
    if(!d.a.src){$('wt'+i).textContent='Choisis une musique dans 🎵 Bibliothèque';return}
    const b=[];if(d.chargement)b.push('analyse du tempo…');else if(d.bpm)b.push(nf(d.bpm*rateOf(d),1)+' BPM');else b.push('tempo non détecté');
    const pc=(d.rate-1)*100;b.push((pc>=0?'+':'')+nf(pc,1)+' %');if(d.syncLock)b.push('SYNC');if(d.lp)b.push(d.lp.slip?'ROULEMENT':'BOUCLE');if(d.echoOn)b.push('ÉCHO');if(d.revOn)b.push('RÉVERB');if(d.flangerOn)b.push('FLANGER');
    const en=typeof JOBS!='undefined'?[...JOBS].filter(j=>j.decks[0]==i&&CAT[j.cle.split(':')[0]]).map(j=>CAT[j.cle.split(':')[0]].nom):[];if(en.length)b.push('▶ '+en.join(', '));
    $('wt'+i).textContent=b.join(' · ');
  });
}
function fermerPanneaux(){QA('.pan').forEach(p=>p.hidden=true)}

/* ---------- mise à l'échelle : la platine remplit l'écran de la tablette ---------- */
function ajuster(){const w=innerWidth,h=innerHeight;SCALE=Math.min(w/2200,h/1110);$('stage').style.transform=`translate(${(w-2200*SCALE)/2}px,${(h-1110*SCALE)/2}px) scale(${SCALE})`}

/* ---------- ciel étoilé en fond (s'arrête si l'appareil demande moins d'animations) ---------- */
function ciel(){
  const c=$('ciel'),x=c.getContext('2d'),calme=matchMedia('(prefers-reduced-motion: reduce)').matches;let E=[],W=0,H=0,r=1;
  const taille=()=>{r=Math.min(devicePixelRatio||1,2);W=c.width=innerWidth*r;H=c.height=innerHeight*r;c.style.width=innerWidth+'px';c.style.height=innerHeight+'px';
    const n=Math.round(innerWidth*innerHeight/2600);E=[...Array(n)].map(()=>({x:Math.random()*W,y:Math.random()*H,t:Math.random()*1.4+.3,a:Math.random()*.7+.2,v:Math.random()*.02+.004,p:Math.random()*6.3,h:Math.random()<.25?'200,215,255':Math.random()<.5?'210,180,255':'255,255,255'}))};
  const dessin=t=>{x.clearRect(0,0,W,H);for(const s of E){const a=calme?s.a:s.a*(.6+.4*Math.sin(s.p+t*s.v*.06));x.fillStyle=`rgba(${s.h},${a})`;x.beginPath();x.arc(s.x,s.y,s.t*r,0,6.3);x.fill()}};
  taille();addEventListener('resize',()=>{taille();dessin(performance.now())});
  if(calme){dessin(0);return}
  let der=0;const boucle=t=>{if(t-der>66){der=t;dessin(t)}requestAnimationFrame(boucle)};requestAnimationFrame(boucle);
}

/* ---------- démarrage ---------- */
function demarrer(){
  ciel();construire();ajuster();mix();initPlatine();initRaccourcis();initBib();initAuto();initTel();initVideo();initOptions();requestAnimationFrame(image);
  QA('.pan').forEach(p=>{p.addEventListener('pointerdown',e=>{if(e.target===p)p.hidden=true});QA('.x',p).forEach(x=>x.onclick=()=>p.hidden=true)});
  addEventListener('resize',ajuster);addEventListener('orientationchange',()=>setTimeout(ajuster,300));document.addEventListener('fullscreenchange',()=>setTimeout(ajuster,300));
  $('fs').onclick=()=>{const e=document.documentElement;document.fullscreenElement?document.exitFullscreen():e.requestFullscreen&&e.requestFullscreen().then(()=>{try{screen.orientation.lock('landscape')}catch(x){}}).catch(()=>{})};
  // l'écran reste allumé pendant l'utilisation
  let wl=null;const garder=async()=>{try{wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>wl=null)}catch(e){}};
  addEventListener('pointerdown',()=>{if(!wl)garder()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'&&!wl)garder()});
  // mise à jour automatique : recharge une seule fois quand une nouvelle version est installée
  if('serviceWorker' in navigator){const avant=!!navigator.serviceWorker.controller;let fait=0;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!avant||fait)return;fait=1;location.reload()});
    navigator.serviceWorker.register('beatdeck-sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{})}
}
