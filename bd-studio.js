'use strict';
/* ===== BeatDeck 5 · Studio : préparer une transition, duos enregistrés, préparation de set ===== */
let DUOS=LS.get('bd_duos',[]);
const duoFor=(a,b)=>{const d=DUOS.find(x=>x.a.id==a&&x.b.id==b);return d?d.plan:null};
const slimPlan=P=>({tech:P.tech,tb:P.tb,exit:P.exit,entry:P.entry,eq:Object.assign({},P.eq),fx:Object.assign({},P.fx)});

/* --- Moteur de préécoute (indépendant des decks) --- */
let PE=null;
function mkPE(){
  const ac=new(window.AudioContext||window.webkitAudioContext)(),master=ac.createGain(),cmp=ac.createDynamicsCompressor();master.connect(cmp);cmp.connect(ac.destination);
  const dly=ac.createDelay(2),fbk=ac.createGain(),wet=ac.createGain();fbk.gain.value=.55;wet.gain.value=.8;dly.connect(fbk);fbk.connect(dly);dly.connect(wet);wet.connect(master);
  const mk=()=>{const a=new Audio();a.preservesPitch=true;const src=ac.createMediaElementSource(a),fl=ac.createBiquadFilter(),fm=ac.createBiquadFilter(),fh=ac.createBiquadFilter(),fi=ac.createBiquadFilter(),g=ac.createGain(),sg=ac.createGain();
    fl.type='lowshelf';fl.frequency.value=180;fm.type='peaking';fm.frequency.value=1000;fm.Q.value=.7;fh.type='highshelf';fh.frequency.value=3200;
    src.connect(fl);fl.connect(fm);fm.connect(fh);fh.connect(fi);fi.connect(g);g.connect(master);sg.gain.value=0;fi.connect(sg);sg.connect(dly);
    return{a,fl,fm,fh,fi,g,sg,bpm:0,off:0,grid:false,mute:0,lp:null,S:{low:.5,mid:.5,hi:.5,flt:.5,vol:.8}}};
  const E={ac,D:[mk(),mk()],x:0,ab:0,tm:[],live:()=>0,base:()=>.5};
  E.ap=()=>{const T=ac.currentTime,g=[Math.cos(E.x*Math.PI/2),Math.sin(E.x*Math.PI/2)];
    E.D.forEach((d,i)=>{const s=d.S;d.g.gain.setTargetAtTime(s.vol*g[i]*(d.mute?0:1),T,.02);d.fl.gain.setTargetAtTime(kdb(s.low),T,.02);d.fm.gain.setTargetAtTime(kdb(s.mid),T,.02);d.fh.gain.setTargetAtTime(kdb(s.hi),T,.02);
      const f=s.flt;if(Math.abs(f-.5)<.03){d.fi.type='allpass'}else if(f<.5){d.fi.type='lowpass';d.fi.frequency.value=20000*Math.pow(.01,(.5-f)*2)}else{d.fi.type='highpass';d.fi.frequency.value=20*Math.pow(60,(f-.5)*2)}})};
  E.set=(i,k,v)=>{E.D[i].S[k]=v==null?.5:v;E.ap()};E.xf=v=>{E.x=v;E.ap()};E.mute=(i,b)=>{E.D[i].mute=b?1:0;E.ap()};
  E.loop=(i,s,len)=>{E.D[i].lp=s==null?null:[s,s+len]};
  E.match=(f,l)=>{if(!f.bpm||!l.bpm)return;let r=l.bpm*l.a.playbackRate/f.bpm;while(r>1.4)r/=2;while(r<.7)r*=2;f.a.playbackRate=r};
  E.restore=i=>{E.D[i].a.playbackRate=1};E.native=f=>{f.a.playbackRate=1};
  E.echo=(i,w)=>{const T=ac.currentTime;dly.delayTime.setValueAtTime(Math.min(1.9,w*.75),T);const s=E.D[i].sg;s.gain.cancelScheduledValues(T);s.gain.setValueAtTime(1,T);s.gain.setValueAtTime(0,T+w)};
  E.later=(f,ms)=>{E.tm.push(setTimeout(()=>{if(!E.ab)f()},ms))};
  E.frame=f=>{const st=()=>{if(E.ab)return;if(f()!==false)requestAnimationFrame(st)};requestAnimationFrame(st)};
  const nz=sec=>{const n=Math.floor(ac.sampleRate*sec),b=ac.createBuffer(1,n,ac.sampleRate),x=b.getChannelData(0);for(let i=0;i<n;i++)x[i]=Math.random()*2-1;const s=ac.createBufferSource();s.buffer=b;return s};
  E.riser=sec=>{const s=nz(sec),f=ac.createBiquadFilter(),g=ac.createGain(),T=ac.currentTime;f.type='highpass';f.frequency.setValueAtTime(300,T);f.frequency.exponentialRampToValueAtTime(7000,T+sec);g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(.16,T+sec*.95);g.gain.linearRampToValueAtTime(0,T+sec);s.connect(f);f.connect(g);g.connect(master);s.start()};
  E.impact=()=>{const T=ac.currentTime,s=nz(1.4),f=ac.createBiquadFilter(),g=ac.createGain();f.type='lowpass';f.frequency.setValueAtTime(9000,T);f.frequency.exponentialRampToValueAtTime(300,T+1.3);s.connect(f);f.connect(g);g.connect(master);g.gain.setValueAtTime(.22,T);g.gain.exponentialRampToValueAtTime(.001,T+1.4);s.start(T)};
  setInterval(()=>E.D.forEach(d=>{if(d.lp&&d.a.currentTime>=d.lp[1])d.a.currentTime=d.lp[0]+(d.a.currentTime-d.lp[1])}),20);
  return E;
}
function peReady(){
  if(D.some(d=>!d.a.paused)){toast('Un morceau joue sur les enceintes : mets les decks en pause pour la préécoute');return false}
  if(!PE)PE=mkPE();PE.ac.resume();return true;
}
async function peLoad(i,item,r){const d=PE.D[i];d.a.pause();d.a.src=URL.createObjectURL(item.f);d.a.playbackRate=1;Object.assign(d,{bpm:r.bpm,off:r.off,grid:true,lp:null});await new Promise(ok=>{d.a.onloadedmetadata=ok;d.a.onerror=ok;d.a.load()})}
function peStop(){if(!PE)return;PE.ab=1;PE.tm.forEach(clearTimeout);PE.tm=[];PE.D.forEach(d=>{d.a.pause();d.lp=null;d.mute=0;d.a.playbackRate=1});['low','mid','hi','flt'].forEach(k=>{PE.D[0].S[k]=.5;PE.D[1].S[k]=.5});PE.xf(0)}
function peTransition(P,ra){
  if(!peReady())return;peStop();PE.ab=0;const A=PE.D[0],B=PE.D[1];
  const q=60/ra.bpm,start=Math.max(0,A.off+Math.floor((P.exit-10-A.off)/q)*q);
  A.a.currentTime=start;B.a.currentTime=P.entry;B.a.pause();A.a.play();
  PE.later(()=>runPlan(PE,P,()=>PE.later(peStop,7000)),Math.max(0,(P.exit-start-1)*1000));
}
function peSolo(i,t){if(!peReady())return;peStop();PE.ab=0;PE.xf(i);const d=PE.D[i];d.a.currentTime=Math.max(0,t);d.a.play();PE.later(peStop,25000)}

/* --- Studio : transition --- */
const ST={A:null,B:null,ra:null,rb:null,P:null,lock:{exit:0,entry:0},duoId:null,loaded:'',alts:[]};
function stTab(id){QA('#studio .tabs button').forEach(b=>b.classList.toggle('on',b.dataset.st==id));QA('#studio .tabp').forEach(p=>p.hidden=p.id!=id);if(id=='st_du')renderDuos();if(id=='st_set')renderSetTab()}
function openStudio(tab,ia,ib){
  openPanel('studio');stFill();stTab(tab||'st_tr');
  if(ia!=null&&ib!=null){$('sA').value=lib.indexOf(itemById(ia));$('sB').value=lib.indexOf(itemById(ib));stAnalyse()}
  (function lp(){if($('studio').hidden)return;stDraw();requestAnimationFrame(lp)})();
}
function stInit(){
  $('st_tr').innerHTML=`<div class="row"><select id="sA" class="sel"></select><span class="mu">→</span><select id="sB" class="sel"></select><button id="stgo" class="on ai">Analyser</button></div><p id="stmsg" class="mu"></p>
<div id="stres" hidden><div id="stsc" class="chips"></div>
<canvas id="tlA" class="tl"></canvas><canvas id="tlB" class="tl"></canvas><p class="mu petit">Touche une courbe pour placer la sortie de A ou l'entrée de B (calé sur la mesure).</p>
<div class="row" id="stpts"></div><div class="row" id="sttech"></div><div class="row" id="stopt"></div>
<div id="stwhy"></div><div id="stiss"></div>
<div class="row"><button id="stplay" class="on ok">▶ Écouter la transition</button><button id="ststop">■ Stop</button><button id="stpa">A seul</button><button id="stpb">B seul</button><button id="stcmp">Comparer les techniques</button></div><div id="stcmpo"></div>
<details><summary>Essayer égaliseurs et effets (préécoute)</summary><div id="sttest"></div></details>
<div class="row"><input id="stname" class="inp" placeholder="Nom du duo"><button id="stsave" class="on ai">Enregistrer le duo</button><button id="stload">Charger sur les decks</button></div></div>`;
  const tt=['low','mid','hi','flt'],nn={low:'Graves',mid:'Médiums',hi:'Aigus',flt:'Filtre'};
  $('sttest').innerHTML=[0,1].map(i=>`<div class="row"><b style="color:${COL[i]};width:20px">${'AB'[i]}</b>`+tt.map(k=>`<label class="mu" style="flex:1;font-size:11px">${nn[k]}<input type="range" class="rg" min="0" max="1" step=".01" value=".5" data-pe="${i}:${k}"></label>`).join('')+'</div>').join('')+`<div class="row"><label class="mu" style="flex:1">Crossfader<input type="range" class="rg" min="0" max="1" step=".01" value="0" data-pe="xf"></label></div><div class="row"><button data-pf="echo">Écho</button><button data-pf="riser">Montée</button><button data-pf="impact">Impact</button><button data-pf="loop">Boucle 4 temps (A)</button></div>`;
  $('st_tr').addEventListener('click',stClick);$('stgo').onclick=stAnalyse;
  $('sttest').addEventListener('input',e=>{const k=e.target.dataset.pe;if(!k||!peReady())return;if(k=='xf')PE.xf(+e.target.value);else{const[i,b]=k.split(':');PE.set(+i,b,+e.target.value)}});
  ['A','B'].forEach((k,i)=>{const cv=$('tl'+k);cv.onpointerdown=e=>{const r=i?ST.rb:ST.ra;if(!r||!ST.P)return;const x=e.clientX-cv.getBoundingClientRect().left,t=x/cv.getBoundingClientRect().width*r.dur,bar=240/r.bpm,s=Math.max(0,r.off+Math.round((t-r.off)/bar)*bar);ST.lock[i?'entry':'exit']=1;stEdit(i?{entry:s}:{exit:s})}});
  $('st_du').innerHTML=`<div class="row"><input id="dq" class="inp" placeholder="Rechercher un duo…"><select id="ds" class="sel"><option value="u">Récents</option><option value="n">Nom</option><option value="s">Compatibilité</option><option value="t">Technique</option></select></div><div id="dlist"></div>`;
  $('dq').oninput=$('ds').onchange=()=>renderDuos();$('dlist').onclick=duoClick;
  QA('#studio .tabs button').forEach(b=>b.onclick=()=>stTab(b.dataset.st));
  $('st_set').addEventListener('input',setInput);$('st_set').addEventListener('change',setChange);$('st_set').addEventListener('click',setClick);
}
function stFill(){const o=lib.map((x,k)=>x.r&&x.r.bpm?`<option value="${k}">${esc(x.name)}</option>`:'').join('');$('sA').innerHTML=o;$('sB').innerHTML=o;if($('sB').options.length>1)$('sB').selectedIndex=1;$('stmsg').textContent=o?'Choisis deux morceaux analysés puis « Analyser ». L\'analyse complète prend quelques secondes.':'Aucun morceau analysé : ouvre « Morceaux » et choisis ton dossier.'}
async function stAnalyse(){
  const A=lib[+$('sA').value],B=lib[+$('sB').value];if(!A||!B||A===B){toast('Choisis deux morceaux différents');return}
  peStop();$('stmsg').textContent='Analyse complète de « '+A.name+' » et « '+B.name+' »…';$('stres').hidden=true;
  try{for(const[it,k]of[[A,'ra'],[B,'rb']]){const buf=await AC.decodeAudioData(await it.f.arrayBuffer());ST[k]=analyseBuf(buf);ST[k].tg=it.r&&it.r.tg}}catch(e){$('stmsg').textContent='Impossible d\'analyser ces fichiers.';return}
  ST.A=A;ST.B=B;ST.ra.gf=famOf(A.r,A.id);ST.rb.gf=famOf(B.r,B.id);ST.loaded='';refreshLib();
  ST.lock={exit:0,entry:0};ST.duoId=null;ST.P=planPair(ST.ra,ST.rb,{propre:PREF.style!='festif',tb:PREF.tb,skipIntro:PREF.si,drop:PREF.da||PREF.amb=='chaud'});
  if(!ST.P){$('stmsg').textContent='Tempo non détecté sur l\'un des deux morceaux.';return}
  $('stmsg').textContent='';$('stres').hidden=false;$('stname').value=A.name+' → '+B.name;stRender();
}
function stEdit(fix){ST.P=refit(ST.ra,ST.rb,ST.P,fix,{tb:PREF.tb,skipIntro:PREF.si,lockExit:ST.lock.exit,lockEntry:ST.lock.entry});stRender()}
const fixTxt=f=>[f.tech?'technique « '+TECH[f.tech]+' »':'',f.tb?f.tb+' temps':'',f.exit!=null?'sortie de A à '+fmt(f.exit):'',f.entry!=null?'entrée de B à '+fmt(f.entry):'',f.eq&&f.eq.midCut?'couper les médiums de A':'',f.eq&&f.eq.lowSwap?'échange des basses':'',f.fx&&f.fx.riser===false?'sans bruit de montée':''].filter(Boolean).join(', ');
function stRender(){
  const P=ST.P,sc=P.sc,pc=v=>v==null?'?':Math.round(v*100)+' %',cl=v=>v==null?'':v>=.7?' g':v>=.45?' a':' r';
  $('stsc').innerHTML=`<span class="chip${cl(sc.total)}"><b>Compatibilité ${pc(sc.total)}</b></span><span class="chip${cl(sc.son)}">Style ${pc(sc.son)}</span><span class="chip${cl(sc.tempo)}">Tempo ${pc(sc.tempo)}</span><span class="chip${cl(sc.key)}">Tonalité ${pc(sc.key)}</span><span class="chip${cl(sc.genre)}">Genre ${pc(sc.genre)}</span><span class="chip${cl(sc.energy)}">Énergie ${pc(sc.energy)}</span><span class="chip${cl(sc.rhythm)}">Rythme ${pc(sc.rhythm)}</span>`+(sc.notes.length?`<small class="mu" style="flex-basis:100%">Non évalué : ${sc.notes.map(esc).join(' · ')}</small>`:'')+
    `<small class="mu" style="flex-basis:100%">Fiabilité : tempo A ${confTxt(ST.ra.bc)}, B ${confTxt(ST.rb.bc)} · tonalité A ${confTxt(ST.ra.key&&ST.ra.key.c)}, B ${confTxt(ST.rb.key&&ST.rb.key.c)}</small>`;
  const nudge=w=>`<button data-nd="${w}:-16">−16</button><button data-nd="${w}:-4">−4</button><button data-nd="${w}:4">+4</button><button data-nd="${w}:16">+16</button>`;
  $('stpts').innerHTML=`<span><b>A</b> sort à ${fmt(P.exit)}</span>${nudge('x')}<span style="margin-left:12px"><b>B</b> entre à ${fmt(P.entry)}</span>${nudge('e')}<small class="mu">(en temps)</small>`;
  $('sttech').innerHTML=Object.entries(TECH).map(([k,n])=>`<button data-tc="${k}"${P.tech==k?' class="on ai"':''}>${n}</button>`).join('')+`<button data-len="1">Durée : ${P.tb} temps</button>`;
  const T=(a,l,k,v)=>`<button data-tg="${a}:${k}"${v?' class="on ok"':''}>${l}</button>`;
  $('stopt').innerHTML=T('eq','Échange des basses','lowSwap',P.eq.lowSwap)+T('eq','Couper les médiums de A','midCut',P.eq.midCut)+T('fx','Bruit de montée','riser',P.fx.riser)+T('fx','Impact','impact',P.fx.impact);
  $('stwhy').innerHTML='<ul class="pl">'+P.why.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>';
  $('stiss').innerHTML=P.issues.length?P.issues.map((s,i)=>`<div class="iss${s.sev=='err'?' err':''}"><b>${s.sev=='err'?'Erreur':'Attention'}</b> · ${esc(s.msg)}${s.fix?`<br><button data-fi="${i}">Appliquer la correction : ${esc(fixTxt(s.fix))}</button>`:'<br><small class="mu">Conseil : choisis un autre morceau.</small>'}</div>`).join(''):'<div class="iss ok">Aucun problème détecté sur ce plan (avec les données mesurées).</div>';
}
async function stPrep(){
  if(!ST.P||!peReady())return false;const key=ST.A.id+'|'+ST.B.id;
  if(ST.loaded!=key){$('stmsg').textContent='Chargement de la préécoute…';await peLoad(0,ST.A,ST.ra);await peLoad(1,ST.B,ST.rb);ST.loaded=key;$('stmsg').textContent=''}return true;
}
async function stClick(e){
  const b=e.target.closest('button');if(!b||(!ST.P&&!b.id))return;const P=ST.P,d=b.dataset;
  if(d.nd){const[w,v]=d.nd.split(':'),r=w=='x'?ST.ra:ST.rb,beat=60/r.bpm;ST.lock[w=='x'?'exit':'entry']=1;stEdit(w=='x'?{exit:Math.max(0,P.exit+v*beat)}:{entry:Math.max(0,P.entry+v*beat)});return}
  if(d.tc){stEdit({tech:d.tc});return}
  if(d.len){choose('Durée de la transition (en temps)',[[4,'4'],[8,'8'],[16,'16'],[32,'32'],[64,'64']],v=>stEdit({tb:+v}));return}
  if(d.tg){const[a,k]=d.tg.split(':');stEdit({[a]:{[k]:!P[a][k]}});return}
  if(d.fi){stEdit(P.issues[+d.fi].fix);return}
  if(d.pf){if(!await stPrep())return;const q=60/ST.ra.bpm;if(d.pf=='echo')PE.echo(0,q);else if(d.pf=='riser')PE.riser(4*q);else if(d.pf=='impact')PE.impact();else{const A=PE.D[0],p=60/A.bpm,s=A.off+Math.round((A.a.currentTime-A.off)/p)*p;A.lp=A.lp?null:[s,s+4*p]}return}
  if(d.cp){const alt=ST.alts[+d.cp];if(d.do=='play'){if(await stPrep())peTransition(alt,ST.ra)}else{ST.P=alt;stRender()}return}
  switch(b.id){
    case'stplay':if(await stPrep())peTransition(ST.P,ST.ra);break;
    case'ststop':peStop();break;
    case'stpa':if(await stPrep())peSolo(0,Math.max(0,ST.P.exit-12));break;
    case'stpb':if(await stPrep())peSolo(1,ST.P.entry);break;
    case'stcmp':ST.alts=planAll(ST.ra,ST.rb,{tb:PREF.tb,skipIntro:PREF.si,fixExit:ST.lock.exit?ST.P.exit:null,fixEntry:ST.lock.entry?ST.P.entry:null,drop:true});
      $('stcmpo').innerHTML=ST.alts.map((a,i)=>`<div class="lr"><span class="wrap"><b>${TECH[a.tech]}</b> · ${a.tb} temps · sortie ${fmt(a.exit)} · entrée ${fmt(a.entry)}<br><small>${a.issues.length?a.issues.length+' problème(s) : '+esc(a.issues[0].msg):'aucun problème détecté'}</small></span><button data-cp="${i}" data-do="play">▶</button><button data-cp="${i}">Choisir</button></div>`).join('');break;
    case'stsave':stSave();break;
    case'stload':if(D.some(x=>!x.a.paused)){toast('Mets les deux decks en pause d\'abord');return}AUTO.SETP[ST.A.id+'>'+ST.B.id]=slimPlan(ST.P);peStop();closePanels();G.xf=0;mix();await chargerDeck(0,ST.A);await chargerDeck(1,ST.B);toast('Chargé : le plan du Studio sera utilisé pour ce mix');break;
  }
}
function stSave(){
  const P=ST.P,name=($('stname').value||'').trim()||ST.A.name+' → '+ST.B.name,now=Date.now();
  let d=ST.duoId&&DUOS.find(x=>x.id==ST.duoId);
  if(d)Object.assign(d,{name,plan:slimPlan(P),score:P.sc.total,updated:now});
  else{d={id:'d'+now.toString(36),name,a:{id:ST.A.id,name:ST.A.name},b:{id:ST.B.id,name:ST.B.name},plan:slimPlan(P),score:P.sc.total,created:now,updated:now};
    DUOS=DUOS.filter(x=>!(x.a.id==d.a.id&&x.b.id==d.b.id));DUOS.push(d);ST.duoId=d.id}
  LS.set('bd_duos',DUOS);toast('Duo enregistré : '+name);
}
function stDraw(){
  [['A',ST.ra,0,ST.P&&ST.P.exit],['B',ST.rb,1,ST.P&&ST.P.entry]].forEach(([k,r,i,m])=>{
    const cv=$('tl'+k);if(!cv||!r||$('stres').hidden)return;const dp=devicePixelRatio||1,W=Math.round(cv.clientWidth*dp),H=Math.round(cv.clientHeight*dp);if(!W||!H)return;if(cv.width!=W)cv.width=W;if(cv.height!=H)cv.height=H;
    const x=cv.getContext('2d'),dur=r.dur;x.clearRect(0,0,W,H);const S=structure(r),X=t=>t/dur*W,C={intro:'#3a4256',build:'#5a4a2a',drop:'#2a5a45',main:'#26324a',break:'#1a1d27',outro:'#3a4256'};
    if(S)for(const s of S){x.fillStyle=C[s.k];x.fillRect(X(s.t0),0,X(s.t1)-X(s.t0),H)}
    x.fillStyle=COL[i]+'cc';const nb=Math.floor(W/3);
    for(let b=0;b<nb;b++){const a=Math.floor(b/nb*r.pk.length),e=Math.floor((b+1)/nb*r.pk.length);let m2=0;for(let j=a;j<e;j++)m2=Math.max(m2,r.pk[j]);const h=Math.max(1,m2*H*.9);x.fillRect(b*3,(H-h)/2,2,h)}
    const ph=60/r.bpm*16;x.fillStyle='#ffffff25';for(let t=r.off;t<dur;t+=ph)x.fillRect(X(t),0,1,H);
    if(m!=null){x.fillStyle='#ffc24b';x.fillRect(X(m)-1.5,0,3,H);x.font=(11*dp)+'px system-ui';x.fillText(i?'entrée':'sortie',Math.min(W-50*dp,X(m)+5),12*dp)}
    if(PE){const a=PE.D[i].a;if(!a.paused&&a.src){x.fillStyle='#fff';x.fillRect(X(a.currentTime)-1,0,2,H)}}
  });
}

/* --- Duos enregistrés --- */
function renderDuos(){
  const q=$('dq').value.toLowerCase(),s=$('ds').value;let L=DUOS.filter(d=>(d.name+d.a.name+d.b.name+TECH[d.plan.tech]).toLowerCase().includes(q));
  L.sort(s=='n'?(a,b)=>a.name.localeCompare(b.name):s=='s'?(a,b)=>b.score-a.score:s=='t'?(a,b)=>a.plan.tech.localeCompare(b.plan.tech):(a,b)=>b.updated-a.updated);
  $('dlist').innerHTML=L.map(d=>`<div class="lr"><span class="wrap"><b>${esc(d.name)}</b><br><small>${esc(d.a.name)} → ${esc(d.b.name)} · ${TECH[d.plan.tech]} · ${d.plan.tb} temps · ${Math.round(d.score*100)} %${itemById(d.a.id)&&itemById(d.b.id)?'':' · morceau absent de la liste'}</small></span><button data-de="${d.id}">Modifier</button><button data-dl="${d.id}">Charger</button><button data-dr="${d.id}">Renommer</button><button data-dx="${d.id}">✕</button></div>`).join('')||'<p class="mu">Aucun duo enregistré. Prépare une transition dans l\'onglet Transition puis « Enregistrer le duo ». Le mode AUTO utilise tes duos automatiquement.</p>';
}
async function duoClick(e){
  const b=e.target.closest('button');if(!b)return;const g=k=>DUOS.find(d=>d.id==b.dataset[k]);
  if(b.dataset.dx){const d=g('dx');if(confirm('Supprimer « '+d.name+' » ?')){DUOS=DUOS.filter(x=>x!==d);LS.set('bd_duos',DUOS);renderDuos()}}
  else if(b.dataset.dr){const d=g('dr'),n=(prompt('Nouveau nom',d.name)||'').trim();if(n){d.name=n;d.updated=Date.now();LS.set('bd_duos',DUOS);renderDuos()}}
  else if(b.dataset.dl){const d=g('dl'),a=itemById(d.a.id),c=itemById(d.b.id);if(!a||!c){toast('Morceau absent de la liste : ouvre ton dossier de musique');return}if(D.some(x=>!x.a.paused)){toast('Mets les deux decks en pause d\'abord');return}closePanels();G.xf=0;mix();await chargerDeck(0,a);await chargerDeck(1,c);toast('Duo chargé')}
  else if(b.dataset.de){const d=g('de'),a=itemById(d.a.id),c=itemById(d.b.id);if(!a||!c){toast('Morceau absent de la liste');return}
    stTab('st_tr');$('sA').value=lib.indexOf(a);$('sB').value=lib.indexOf(c);await stAnalyse();if(!ST.P)return;
    const p=d.plan;ST.lock={exit:1,entry:1};ST.P=refit(ST.ra,ST.rb,ST.P,{tech:p.tech,tb:p.tb,exit:p.exit,entry:p.entry,eq:p.eq,fx:p.fx},{tb:PREF.tb,skipIntro:PREF.si,lockExit:1,lockEntry:1});ST.duoId=d.id;$('stname').value=d.name;stRender()}
}

/* --- Préparation de set --- */
const CURVES={'Progressive':[2,4,6,8,10],'Plateau':[5,6,6,6,5],'Vagues':[3,7,4,9,5],'Pic puis descente':[3,6,10,7,3],'Fin calme':[4,6,8,9,3]};
let SETC=Object.assign({dur:120,gen:[],mode:'mix',bmin:0,bmax:0,curve:CURVES['Fin calme'].slice(),must:{},ban:{}},LS.get('bd_setc',{})),SET={items:[],plans:[]},SETQ='';
const curveAt=f=>{const c=SETC.curve,x=clamp(f)*4,i=Math.min(3,Math.floor(x));return lerp(c[i],c[i+1],x-i)};
const svSetc=()=>LS.set('bd_setc',SETC);
const pcache=new Map();
const pcmp=(a,b)=>{const k=a.id+'|'+b.id+'|'+(a.r.gf||'')+(b.r.gf||'');let v=pcache.get(k);if(!v){v=pairScore(a.r,b.r);pcache.set(k,v)}return v};
function renderSetTab(){
  refreshLib();pcache.clear();
  const fams=[...new Set(lib.filter(x=>x.r&&x.r.gf).map(x=>x.r.gf))],A=lib.filter(x=>x.r&&x.r.bpm&&x.r.v>=ANA_V);
  const h=Math.floor(SETC.dur/60),m=SETC.dur%60;
  $('st_set').innerHTML=`<h3>Durée du set : <b id="sdv" style="color:var(--tx)">${h?h+' h ':''}${m?m+' min':''}</b></h3><input type="range" class="rg" id="sdur" min="30" max="360" step="15" value="${SETC.dur}">
<h3>Genres à jouer ${fams.length?'':'(aucun genre détecté : choisis-les dans les détails des morceaux, sinon tout est utilisé)'}</h3><div class="chips" id="sgen">${fams.map(f=>`<button class="chip${SETC.gen.includes(f)?' a':''}" data-g="${f}">${GFN[f]}</button>`).join('')}</div>
<div class="row"><button id="smode">${SETC.mode=='blocks'?'Styles gardés séparés (par blocs)':'Styles mélangés librement'}</button><label class="mu">BPM mini <input class="inp" id="sbmin" type="number" style="width:80px" value="${SETC.bmin||''}"></label><label class="mu">maxi <input class="inp" id="sbmax" type="number" style="width:80px" value="${SETC.bmax||''}"></label></div>
<h3>Progression de l'énergie (1 calme · 10 intense)</h3><div class="row">${Object.keys(CURVES).map(k=>`<button data-cv="${k}">${k}</button>`).join('')}</div>
<div class="row">${['Début','25 %','Milieu','75 %','Fin'].map((n,i)=>`<label class="mu" style="flex:1;min-width:90px">${n} · <b id="scv${i}">${SETC.curve[i]}</b><input type="range" class="rg" min="1" max="10" step="1" value="${SETC.curve[i]}" data-sc="${i}"></label>`).join('')}</div>
<h3>Morceaux obligatoires (★) ou interdits (⊘)</h3><input class="inp" id="sq" placeholder="Rechercher…" value="${esc(SETQ)}"><div id="smust" style="max-height:170px;overflow:auto">${A.filter(x=>x.name.toLowerCase().includes(SETQ.toLowerCase())).slice(0,60).map(x=>`<div class="lr"><span>${esc(x.name)}</span><small>${Math.round(x.r.bpm)} · N${lvl(x.r)}</small><button data-m="${lib.indexOf(x)}">${SETC.must[x.id]?'★ obligatoire':SETC.ban[x.id]?'⊘ interdit':'neutre'}</button></div>`).join('')}</div>
<div class="row"><button id="sgo" class="on ai">Créer le set</button><select id="ssv" class="sel"><option value="">Sets enregistrés…</option>${Object.keys(LS.get('bd_sets',{})).map(n=>`<option>${esc(n)}</option>`).join('')}</select></div><div id="sres"></div>`;
  renderSetRes();
}
function setInput(e){
  if(e.target.id=='sdur'){SETC.dur=+e.target.value;const h=Math.floor(SETC.dur/60),m=SETC.dur%60;$('sdv').textContent=(h?h+' h ':'')+(m?m+' min':'');svSetc()}
  else if(e.target.dataset.sc!=null){SETC.curve[+e.target.dataset.sc]=+e.target.value;$('scv'+e.target.dataset.sc).textContent=e.target.value;svSetc()}
  else if(e.target.id=='sq'){SETQ=e.target.value;const p=e.target.selectionStart;renderSetTab();$('sq').focus();$('sq').setSelectionRange(p,p)}
}
function setChange(e){
  if(e.target.id=='sbmin'||e.target.id=='sbmax'){SETC.bmin=+$('sbmin').value||0;SETC.bmax=+$('sbmax').value||0;svSetc()}
  else if(e.target.id=='ssv'&&e.target.value){const S=LS.get('bd_sets',{})[e.target.value];if(S){SETC=Object.assign(SETC,S.cfg);SET.items=S.ids.map(itemById).filter(Boolean);SET.plans=[];replanAll();renderSetTab()}}
}
function setClick(e){
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.g){SETC.gen=SETC.gen.includes(d.g)?SETC.gen.filter(x=>x!=d.g):SETC.gen.concat(d.g);svSetc();b.classList.toggle('a')}
  else if(b.id=='smode'){SETC.mode=SETC.mode=='blocks'?'mix':'blocks';svSetc();b.textContent=SETC.mode=='blocks'?'Styles gardés séparés (par blocs)':'Styles mélangés librement'}
  else if(d.cv){SETC.curve=CURVES[d.cv].slice();svSetc();renderSetTab()}
  else if(d.m!=null){const it=lib[+d.m];if(SETC.must[it.id]){delete SETC.must[it.id];SETC.ban[it.id]=1}else if(SETC.ban[it.id])delete SETC.ban[it.id];else SETC.must[it.id]=1;svSetc();b.textContent=SETC.must[it.id]?'★ obligatoire':SETC.ban[it.id]?'⊘ interdit':'neutre'}
  else if(b.id=='sgo')buildSet();
  else if(d.so)setOp(d.so,+d.i);
  else if(b.id=='ssave'){const n=(prompt('Nom du set')||'').trim();if(!n)return;const S=LS.get('bd_sets',{});S[n]={ids:SET.items.map(x=>x.id),cfg:SETC};LS.set('bd_sets',S);toast('Set enregistré');renderSetTab()}
  else if(b.id=='slaunch'){if(!SET.items.length)return;AUTO.SETP={};for(let i=1;i<SET.items.length;i++)if(SET.plans[i])AUTO.SETP[SET.items[i-1].id+'>'+SET.items[i].id]=slimPlan(SET.plans[i]);
    AUTO.queue.length=0;SET.items.forEach(x=>AUTO.queue.push(x));AUTO.played.clear();toast('Set chargé dans la file : '+SET.items.length+' morceaux. Active AUTO pour le jouer.');closePanels()}
}
function buildSet(){
  refreshLib();pcache.clear();const A=lib.filter(x=>x.r&&x.r.bpm&&x.r.v>=ANA_V);
  const must=A.filter(x=>SETC.must[x.id]&&!SETC.ban[x.id]);
  const C=A.filter(x=>!SETC.ban[x.id]&&!SETC.must[x.id]&&(!SETC.gen.length||!x.r.gf||SETC.gen.includes(x.r.gf))&&(!SETC.bmin||x.r.bpm>=SETC.bmin)&&(!SETC.bmax||x.r.bpm<=SETC.bmax));
  if(C.length+must.length<3){toast('Pas assez de morceaux analysés avec ces réglages (3 minimum)');return}
  const slot=x=>Math.max(60,Math.min(x.r.dur||240,PREF.mt>0?PREF.mt+25:(x.r.dur||240)-20)),all=C.concat(must),avg=all.reduce((s,x)=>s+slot(x),0)/all.length;
  const n0=clamp(Math.round(SETC.dur*60/avg),3,80),nb=Math.max(1,Math.min(n0-must.length,C.length));
  const step=(prev,c,k)=>{const T=curveAt(k/Math.max(1,n0-1)),lf=1-Math.abs(lvl(c.r)-T)/9;if(!prev)return 1.2*lf;
    let s=1.1*pcmp(prev,c).total+lf;if(SETC.mode=='blocks'&&prev.r.gf&&c.r.gf)s+=prev.r.gf==c.r.gf?.15:-.25;
    if(prev.r.tg&&c.r.tg&&prev.r.tg.a&&prev.r.tg.a==c.r.tg.a)s-=.3;return s};
  let beam=[{seq:[],used:new Set(),sc:0}];
  for(let k=0;k<nb;k++){const nx=[];
    for(const s of beam){const prev=s.seq[s.seq.length-1],cs=[];for(const c of C)if(!s.used.has(c.id))cs.push([step(prev,c,k),c]);cs.sort((a,b)=>b[0]-a[0]);
      for(const[v,c]of cs.slice(0,6)){const u=new Set(s.used);u.add(c.id);nx.push({seq:s.seq.concat(c),used:u,sc:s.sc+v})}}
    nx.sort((a,b)=>b.sc-a.sc);beam=nx.slice(0,6);if(!beam.length)break}
  let seq=beam[0].seq.slice();
  for(const m of must){let bp=0,bc=1e9;for(let p=0;p<=seq.length;p++){const T=curveAt(p/Math.max(1,seq.length)),c=Math.abs(lvl(m.r)-T)/9+(p?1-pcmp(seq[p-1],m).total:0)+(p<seq.length?1-pcmp(m,seq[p]).total:0);if(c<bc){bc=c;bp=p}}seq.splice(bp,0,m)}
  SET.items=seq;SET.plans=[];replanAll();renderSetRes();toast('Set créé : '+seq.length+' morceaux');
}
function planAt(i){
  if(i<1||i>=SET.items.length)return;const a=SET.items[i-1],b=SET.items[i];a.r.gf=famOf(a.r,a.id);b.r.gf=famOf(b.r,b.id);
  const o={tb:PREF.tb,skipIntro:PREF.si,near:Math.min((a.r.dur||240)*.8,PREF.mt>0?PREF.mt:(a.r.dur||240)-60),tech:PREF.ft||null,drop:PREF.da||PREF.amb=='chaud'};
  let P=planPair(a.r,b.r,o);const sv0=duoFor(a.id,b.id);
  if(P&&sv0&&!P.limited){P=refit(a.r,b.r,P,{tech:sv0.tech,tb:sv0.tb,entry:sv0.entry,exit:sv0.exit,eq:sv0.eq,fx:sv0.fx},o);P.saved=1}
  SET.plans[i]=P;
}
const replanAll=()=>{for(let i=1;i<SET.items.length;i++)planAt(i)};
function setOp(op,i){
  const it=SET.items;
  if(op=='up'&&i>0){[it[i-1],it[i]]=[it[i],it[i-1]];[i-1,i,i+1].forEach(planAt)}
  else if(op=='dn'&&i<it.length-1){[it[i+1],it[i]]=[it[i],it[i+1]];[i,i+1,i+2].forEach(planAt)}
  else if(op=='rm'){it.splice(i,1);SET.plans.splice(i,1);planAt(i)}
  else if(op=='rc')planAt(i);
  else if(op=='sw'){
    const inSet=new Set(it.map(x=>x.id)),prev=it[i-1],next=it[i+1],T=curveAt(i/Math.max(1,it.length-1));
    const c=lib.filter(x=>x.r&&x.r.bpm&&x.r.v>=ANA_V&&!inSet.has(x.id)&&!SETC.ban[x.id]).map(x=>[(prev?pcmp(prev,x).total:.5)+(next?pcmp(x,next).total:.5)+(1-Math.abs(lvl(x.r)-T)/9),x]).sort((a,b)=>b[0]-a[0]).slice(0,8);
    if(!c.length){toast('Aucun remplaçant disponible');return}
    choose('Remplacer « '+it[i].name+' » par',c.map(([s,x])=>[x.id,esc(x.name)+' · '+Math.round(x.r.bpm)+' · N'+lvl(x.r)]),id=>{it[i]=itemById(id);planAt(i);planAt(i+1);renderSetRes()});return;
  }
  renderSetRes();
}
function renderSetRes(){
  const el=$('sres');if(!el)return;const it=SET.items;
  if(!it.length){el.innerHTML='<p class="mu">Règle les paramètres puis « Créer le set ». L\'ordre tient compte du tempo, de la tonalité et du style, et suit ta courbe d\'énergie.</p>';return}
  const tot=it.reduce((s,x)=>s+Math.min(x.r.dur||240,PREF.mt>0?PREF.mt+25:(x.r.dur||240)-20),0);
  el.innerHTML=`<h3>${it.length} morceaux · environ ${Math.round(tot/60)} min</h3>`+it.map((x,i)=>{const P=SET.plans[i],iss=P?P.issues.length:0;
    return`<div class="lr"><span class="wrap">${i+1}. <b>${esc(x.name)}</b> <small>${Math.round(x.r.bpm)} BPM · ${cm(x.r.key)} · N${lvl(x.r)}</small>${i?`<br><small>${P?Math.round(P.sc.total*100)+' % · '+esc(planTxt(P))+(P.saved?' · duo enregistré':''):'plan indisponible'}${iss?' · <span style="color:var(--ai)">⚠ '+esc(P.issues[0].msg)+'</span>':''}</small>`:''}</span><button data-so="up" data-i="${i}">↑</button><button data-so="dn" data-i="${i}">↓</button><button data-so="sw" data-i="${i}">⇄</button>${i?`<button data-so="rc" data-i="${i}">↻</button>`:''}<button data-so="rm" data-i="${i}">✕</button></div>`}).join('')+
  `<div class="row"><button id="slaunch" class="on ok">Jouer ce set (file du mode AUTO)</button><button id="ssave">Enregistrer le set</button></div><p class="mu petit">↑↓ change l'ordre · ⇄ remplace par un morceau compatible · ↻ recalcule la transition.</p>`;
}
