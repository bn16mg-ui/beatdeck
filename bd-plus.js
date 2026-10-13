'use strict';
/* ===== BeatDeck 5.2 · macros, mode guidé, aperçu, enregistrement, historique, bacs, corrections, notes ===== */
const stamp=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())};
const heure=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};

/* ---------- corrections manuelles de l'analyse ---------- */
const CORR=LS.get('bd5_corr',{});
function corrOf(id,r){if(!r)return r;const c=CORR[id];if(c){Object.assign(r,c);r.corr=1}return r}
function sauverCorr(it,c){
  CORR[it.id]=Object.assign(CORR[it.id]||{},c);LS.set('bd5_corr',CORR);corrOf(it.id,it.r);sauverMeta(it);
  D.forEach(d=>{if(d.cur===it){d.r=it.r;if(c.bpm){d.bpm=c.bpm;d.grid=true}if(c.off!=null)d.off=c.off;if(c.key)d.key=c.key;d.plan=null}});
  renderLib();
}
async function annulerCorr(it){delete CORR[it.id];LS.set('bd5_corr',CORR);toast('Nouvelle analyse de « '+it.name+' »…');
  try{it.r=await analyseFile(it.f)}catch(e){return}sauverMeta(it);D.forEach(d=>{if(d.cur===it){d.r=it.r;d.bpm=it.r.bpm;d.off=it.r.off;d.key=it.r.key;d.grid=d.bpm>0}});renderLib();toast('Analyse automatique rétablie')}

/* ---------- bacs de morceaux ---------- */
let BACS=LS.get('bd5_bacs',{}),LIBBAC=null;
const saveBacs=()=>LS.set('bd5_bacs',BACS);
const dansBac=it=>!PREF.bac||!BACS[PREF.bac]||BACS[PREF.bac].includes(it.id);
function choisirBac(it){
  const opts=Object.keys(BACS).map(n=>[n,(BACS[n].includes(it.id)?'✓ ':'')+esc(n)]).concat([['__new','+ Nouveau bac…']]);
  choose('Bac pour « '+it.name+' »',opts,v=>{
    if(v=='__new'){const n=(prompt('Nom du bac (ex. Chauffe, Shatta, Fin de soirée)')||'').trim();if(!n)return;BACS[n]=BACS[n]||[];v=n}
    const L=BACS[v];const k=L.indexOf(it.id);if(k>=0){L.splice(k,1);toast('Retiré du bac « '+v+' »')}else{L.push(it.id);toast('Ajouté au bac « '+v+' »')}
    saveBacs();renderLib()});
}
function renderBacs(){
  const el=$('bacs');if(!el)return;
  el.innerHTML=`<button data-bv=""${!LIBBAC?' class="on ai"':''}>Tous</button>`+Object.keys(BACS).map(n=>`<button data-bv="${esc(n)}"${LIBBAC==n?' class="on ai"':''}>${esc(n)} (${BACS[n].length})</button>`).join('')+`<button data-bv="__new">+ Nouveau bac</button>`+(LIBBAC?`<button data-bx="1">Supprimer ce bac</button>`:'');
}

/* ---------- likes / historique / notes ---------- */
const LIKES=LS.get('bd5_like',{});
let HIST=LS.get('bd5_hist',[]);
const saveHist=()=>{if(HIST.length>300)HIST=HIST.slice(-300);LS.set('bd5_hist',HIST)};
function logLecture(d){
  if(!d.cur||d.logged)return;d.logged=true;const o=D[1-d.i];
  if(typeof AUTO!='undefined')AUTO.played.add(d.cur.id);HIST.push({t:Date.now(),id:d.cur.id,name:d.name,deck:d.i+1,bpm:d.bpm?+(d.bpm*rateOf(d)).toFixed(1):0,prev:o.cur&&!o.a.paused?{id:o.cur.id,name:o.name}:null,tech:null,note:0});saveHist();
}
let noteT=0,noteCtx=null;
function apresTransition(L,N,nom){
  const a=D[L],b=D[N];AUTO.lastTech=nom;retourTempo(N);
  const h=[...HIST].reverse().find(x=>b.cur&&x.id==b.cur.id&&Date.now()-x.t<120000);
  if(h){h.tech=nom;if(!h.prev&&a.cur)h.prev={id:a.cur.id,name:a.name};saveHist()}
  if(!a.cur||!b.cur)return;
  noteCtx={a:a.cur.id,b:b.cur.id,h};const el=$('note');
  el.innerHTML=`<span>Cet enchaînement ?</span><button data-nt="1">👍</button><button data-nt="-1">👎</button>`;el.hidden=false;
  clearTimeout(noteT);noteT=setTimeout(()=>{el.hidden=true;noteCtx=null},25000);
}
function noter(v){
  const c=noteCtx;if(!c)return;$('note').hidden=true;clearTimeout(noteT);
  if(v>0){const k=c.a+'>'+c.b;LIKES[k]=(LIKES[k]||0)+1;LS.set('bd5_like',LIKES);toast('Noté 👍 : je referai ce genre d\'enchaînement')}
  else{noterRefus(c.a,c.b);toast('Noté 👎 : je ne referai pas ce duo')}
  if(c.h){c.h.note=v;saveHist()}noteCtx=null;
}
function renderHist(){
  const L=[...HIST].reverse();
  $('hiL').innerHTML=L.length?L.map((h,k)=>`<div class="lr"><span class="wrap"><b>${heure(h.t)}</b> · ${esc(h.name)} <small class="mu">deck ${h.deck}${h.bpm?' · '+nf(h.bpm,1)+' BPM':''}</small>${h.prev?`<br><small class="mu">après « ${esc(h.prev.name)} »${h.tech?' · '+esc(h.tech):''}${h.note>0?' · 👍':h.note<0?' · 👎':''}</small>`:''}</span>${h.prev&&itemById(h.prev.id)&&itemById(h.id)?`<button data-hr="${L.length-1-k}">Recharger ce duo</button>`:''}</div>`).join(''):'<p class="mu">Aucun morceau joué pour l\'instant.</p>';
}

/* ---------- enregistrement du mix ---------- */
const REC={r:null,ch:[],t0:0,dest:null};
function recToggle(){
  if(REC.r){REC.r.stop();return}
  if(!window.MediaRecorder){toast('Enregistrement impossible avec ce navigateur','err');return}
  AC.resume();REC.dest=REC.dest||AC.createMediaStreamDestination();BUS.lim.connect(REC.dest);
  const mt=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||'';
  let r;try{r=new MediaRecorder(REC.dest.stream,mt?{mimeType:mt,audioBitsPerSecond:192000}:{})}catch(e){toast('Enregistrement impossible : '+e.message,'err');return}
  REC.ch=[];r.ondataavailable=e=>{if(e.data&&e.data.size)REC.ch.push(e.data)};
  r.onstop=()=>{const b=new Blob(REC.ch,{type:r.mimeType||'audio/webm'}),ext=/mp4/.test(b.type)?'m4a':/ogg/.test(b.type)?'ogg':'webm',a=document.createElement('a');
    a.href=URL.createObjectURL(b);a.download='mix-'+stamp()+'.'+ext;document.body.appendChild(a);a.click();a.remove();REC.r=null;try{BUS.lim.disconnect(REC.dest)}catch(e){}
    toast('Mix enregistré : '+a.download+' (dans Téléchargements)');majRec()};
  r.start(1000);REC.r=r;REC.t0=Date.now();toast('Enregistrement du mix lancé');majRec();
}
function majRec(){const b=$('rec');if(!b)return;b.classList.toggle('on',!!REC.r);b.textContent=REC.r?'● '+fmt((Date.now()-REC.t0)/1000):'● REC'}

/* ---------- mode soirée ---------- */
let VERROU=false;
function setVerrou(v){VERROU=v;document.body.classList.toggle('verrou',v);$('lock').classList.toggle('on',v);if(v){keep&&keep();toast('Mode soirée : écran toujours allumé, commandes à l\'écran verrouillées (la platine marche)')}else toast('Écran déverrouillé')}

/* ---------- tempo au doigt ---------- */
const TAPS=[[],[]];
function tapTempo(i){
  const d=D[i];if(!d.a.src||d.a.paused){toast('Lance le morceau puis tape en rythme');return}
  const T=TAPS[i],now=performance.now(),pos=heard(d);if(T.length&&now-T[T.length-1].t>2000)T.length=0;T.push({t:now,pos});
  if(T.length<4){toast('Tempo au doigt : continue ('+T.length+'/4)');return}
  const dp=[];for(let k=1;k<T.length;k++)dp.push(T[k].pos-T[k-1].pos);let bpm=60/med(dp);while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;bpm=Math.round(bpm*10)/10;
  const beat=60/bpm,off=((T[T.length-1].pos%beat)+beat)%beat;
  d.bpm=bpm;d.off=off;d.grid=true;if(d.cur)sauverCorr(d.cur,{bpm,off});
  toast('Tempo au doigt : '+nf(bpm,1)+' BPM, grille recalée'+(T.length>=8?' (précis)':' (continue pour affiner)'));
}

/* ---------- fonctions supplémentaires du catalogue ---------- */
F('Mixage','xf_vers','Glisser le crossfader vers un deck','CROSSFADER →','b','Déplace le crossfader tout seul, en douceur.',[['vers','Vers','autre',{o:[['autre','L\'autre deck'],['1','Deck 1'],['2','Deck 2']]}],['duree','Durée',8,{o:[[0,'D\'un coup'],[4,'4 temps'],[8,'8 temps'],[16,'16 temps'],[32,'32 temps']]}]],{
  run:c=>{const tg=c.p.vers=='autre'?1-live():+c.p.vers-1,x0=G.xf,o=D[live()],T=c.p.duree*(o.bpm&&!o.a.paused?wallBeat(o):.5)*1000;
    if(!T){G.xf=tg;mix();return}const t0=performance.now(),j=new Job('Crossfader',{cle:'xf',auto:true});j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/T);G.xf=lerp(x0,tg,smth(0,1,k));mix();if(k>=1){j.end();return false}})}});
F('Enchaînements','autre_entree','Placer l\'autre deck à un moment précis','PLACER','b','Positionne le deck en attente sur un moment choisi (en secondes).',[['t','Moment (secondes)',0,{min:0,max:900,pas:.1,u:'s'}]],{run:c=>{const n=D[1-live()];if(!n.a.src)return;n.a.currentTime=n.grid?Math.max(0,snapBeat(n,c.p.t)):c.p.t}});
F('Tempo','tap_tempo','Tempo au doigt (tape en rythme)','TAP','b','Tape au moins 4 fois en rythme pendant que le morceau joue : le tempo et la grille sont corrigés.',[],{run:c=>tapTempo(c.i)});
F('Macros','macro','Lancer une macro','MACRO','b','Lance une suite d\'actions que tu as créée (Effets → Mes macros).',[['id','Macro','',{dyn:'macros'}]],{run:c=>{const m=(PROF.macros||[]).find(x=>x.id==c.p.id);if(!m){toast('Choisis la macro dans les réglages de la commande');return}lancerMacro(m)},on:c=>!!jobActif('macro')});
F('Système','guide_onoff','Mode guidé (on / off)','GUIDE','b','L\'IA t\'indique quoi faire et quand, pendant que tu mixes.',[],{run:()=>setGuide(!GUIDE.on),on:()=>GUIDE.on});
F('Système','rec_onoff','Enregistrer le mix (on / off)','REC','b','Enregistre ce qui sort des enceintes dans un fichier.',[],{run:()=>recToggle(),on:()=>!!REC.r});
F('Système','verrou_onoff','Mode soirée (verrouiller l\'écran)','VERROU','b','Garde l\'écran allumé et ignore les appuis à l\'écran. La platine continue de marcher.',[],{run:()=>setVerrou(!VERROU),on:()=>VERROU});

/* ---------- macros ---------- */
const MDECK=[['A','Le deck qui joue au lancement'],['B','L\'autre deck'],['1','Deck 1'],['2','Deck 2']];
function lancerMacro(m){
  if(!m||!m.etapes||!m.etapes.length){toast('Macro vide');return}
  if(jobActif('macro')){jobActif('macro').stop()}
  const A=live(),B=1-A,o=D[A],wb=o.bpm&&!o.a.paused?wallBeat(o):.5,wait=o.grid&&!o.a.paused?((1-phaseOf(o))%1)*wb*1000:0;
  const j=new Job('Macro : '+m.nom,{cle:'macro',auto:true}),dk=t=>t=='A'?String(A+1):t=='B'?String(B+1):t;
  m.etapes.forEach(e=>{const f=CAT[e.fn];if(!f)return;const b={fn:e.fn,deck:dk(e.deck||'A'),p:e.p||{}};
    j.later(()=>{runBinding(b,null,{t:'press'});if(f.k=='m')j.later(()=>runBinding(b,null,{t:'release'}),Math.max(60,(e.tenir||1)*wb*1000))},wait+(e.at||0)*wb*1000)});
  const tot=Math.max(...m.etapes.map(e=>(e.at||0)+(CAT[e.fn]&&CAT[e.fn].k=='m'?(e.tenir||1):0)))*wb*1000+wait+300;
  j.later(()=>{j.end();if(!D[B].a.paused&&D[A].a.paused)apresTransition(A,B,'Macro « '+m.nom+' »')},tot);toast('Macro « '+m.nom+' » sur le prochain temps');
}
function macroDuPlan(P){
  const tb=P.tb,e=[{at:0,fn:'autre_entree',deck:'A',p:{t:+P.entry.toFixed(2)}}];
  if(P.tech=='drop')e.push({at:0,fn:'roll',deck:'A',p:{duree:8,filtre:1,bruit:1}},{at:8,fn:'lancer_autre',deck:'A'},{at:8,fn:'xf_vers',deck:'A',p:{vers:'autre',duree:0}},{at:8,fn:'pause',deck:'A'},{at:8,fn:'son_impact',deck:'A'});
  else if(P.tech=='echo')e.push({at:0,fn:'echo_sortie',deck:'A',p:{queue:4}},{at:1,fn:'lancer_autre',deck:'A'},{at:1,fn:'xf_vers',deck:'A',p:{vers:'autre',duree:0}});
  else if(P.tech=='cut')e.push({at:0,fn:'lancer_autre',deck:'A'},{at:0,fn:'xf_vers',deck:'A',p:{vers:'autre',duree:0}},{at:0,fn:'pause',deck:'A'});
  else if(P.tech=='filter')e.push({at:0,fn:'lancer_autre',deck:'A'},{at:0,fn:'balayage_haut',deck:'A',p:{duree:tb,prof:.8,forme:'a'}},{at:0,fn:'xf_vers',deck:'A',p:{vers:'autre',duree:tb}},{at:tb,fn:'pause',deck:'A'});
  else e.push({at:0,fn:'lancer_autre',deck:'A'},{at:0,fn:'killm_low',deck:'B',tenir:tb/2},{at:tb/2,fn:'kill_low',deck:'A'},{at:0,fn:'xf_vers',deck:'A',p:{vers:'autre',duree:tb}},{at:tb,fn:'pause',deck:'A'},{at:tb,fn:'kill_low',deck:'A'});
  return e;
}
let MSEL=null;
function renderMacros(){
  const M=PROF.macros=PROF.macros||[];if(!M.find(m=>m.id==MSEL))MSEL=M[0]&&M[0].id;
  const m=M.find(x=>x.id==MSEL);
  $('mcSel').innerHTML=M.map(x=>`<option value="${x.id}"${x.id==MSEL?' selected':''}>${esc(x.nom)}</option>`).join('')||'<option>Aucune macro</option>';
  const fns=Object.values(CAT).filter(f=>(f.k=='b'||f.k=='m')&&!['macro','shift','aucune'].includes(f.id));
  if(!m){$('mcE').innerHTML='<p class="mu">Crée une macro avec « Nouvelle », ou demande à l\'IA d\'en proposer une pour les deux morceaux chargés.</p>';return}
  $('mcE').innerHTML='<p class="mu petit">« À » = nombre de temps après le lancement (la macro démarre sur le prochain temps). « A » = le deck qui joue au lancement, « B » = l\'autre.</p>'+m.etapes.map((e,k)=>{const f=CAT[e.fn];
    return`<div class="lr mstep"><label class="mu">À <input class="inp" type="number" min="0" max="128" step=".5" value="${e.at||0}" data-ma="${k}" style="width:70px"> temps</label>
    <select class="sel" data-mf="${k}">${fns.map(x=>`<option value="${x.id}"${x.id==e.fn?' selected':''}>${esc(x.nom)}</option>`).join('')}</select>
    <select class="sel" data-md="${k}" style="max-width:120px">${MDECK.map(([v,n])=>`<option value="${v}"${(e.deck||'A')==v?' selected':''}>${v=='A'||v=='B'?'Deck '+v:n}</option>`).join('')}</select>
    ${f&&f.k=='m'?`<label class="mu">tenir <input class="inp" type="number" min=".25" max="64" step=".25" value="${e.tenir||1}" data-mt="${k}" style="width:64px"></label>`:''}
    ${f&&f.p.length?`<button data-mp="${k}">Réglages</button>`:''}<button data-mu="${k}">↑</button><button data-mx="${k}">✕</button></div>`}).join('')+'<div class="row"><button id="mcAdd">+ Ajouter une étape</button></div>';
}
function initMacros(){
  const M=()=>PROF.macros=PROF.macros||[],cur=()=>M().find(x=>x.id==MSEL);
  $('mcSel').onchange=e=>{MSEL=e.target.value;renderMacros()};
  $('mcNew').onclick=()=>{const n=(prompt('Nom de la macro','Ma transition')||'').trim();if(!n)return;const m={id:'m'+Date.now().toString(36),nom:n,etapes:[]};M().push(m);MSEL=m.id;saveProf();renderMacros()};
  $('mcRen').onclick=()=>{const m=cur();if(!m)return;const n=(prompt('Nouveau nom',m.nom)||'').trim();if(n){m.nom=n;saveProf();renderMacros()}};
  $('mcDel').onclick=()=>{const m=cur();if(!m||!confirm('Supprimer la macro « '+m.nom+' » ?'))return;PROF.macros=M().filter(x=>x!==m);saveProf();renderMacros()};
  $('mcTry').onclick=()=>{const m=cur();if(m){$('macros').hidden=true;lancerMacro(m)}};
  $('mcAsg').onclick=()=>{const m=cur();if(!m)return;LEARN={fn:'macro',p:{id:m.id}};$('macros').hidden=true;$('lnT').textContent='Attribuer la macro « '+m.nom+' »';$('learn').hidden=false};
  $('mcIA').onclick=()=>{const L=live(),o=D[L],n=D[1-L];if(!o.a.src||!n.a.src){toast('Charge un morceau sur chaque deck');return}
    const P=getPlan(o,n,{near:Math.max(o.a.currentTime+20,(o.a.duration||200)*.6)});if(!P){toast('Tempo non détecté : impossible de proposer');return}
    const m={id:'m'+Date.now().toString(36),nom:'IA · '+(o.name||'A').slice(0,14)+' → '+(n.name||'B').slice(0,14),etapes:macroDuPlan(P)};M().push(m);MSEL=m.id;saveProf();renderMacros();
    toast('Macro proposée d\'après le plan : '+planTxt(P)+'. Lance-la au moment voulu.')};
  $('mcE').addEventListener('change',e=>{const m=cur();if(!m)return;const t=e.target,d=t.dataset;
    if(d.ma!=null)m.etapes[+d.ma].at=+String(t.value).replace(',','.')||0;else if(d.mf!=null){m.etapes[+d.mf].fn=t.value;m.etapes[+d.mf].p={}}else if(d.md!=null)m.etapes[+d.md].deck=t.value;else if(d.mt!=null)m.etapes[+d.mt].tenir=+String(t.value).replace(',','.')||1;
    m.etapes.sort((a,b)=>(a.at||0)-(b.at||0));saveProf();renderMacros()});
  $('mcE').addEventListener('click',e=>{const m=cur();if(!m)return;const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(b.id=='mcAdd'){const last=m.etapes[m.etapes.length-1];m.etapes.push({at:last?last.at:0,fn:'begaiement',deck:'A',p:{}});saveProf();renderMacros()}
    else if(d.mx!=null){m.etapes.splice(+d.mx,1);saveProf();renderMacros()}
    else if(d.mu!=null){const k=+d.mu;if(k>0){[m.etapes[k-1],m.etapes[k]]=[m.etapes[k],m.etapes[k-1]];const t=m.etapes[k-1].at;m.etapes[k-1].at=m.etapes[k].at;m.etapes[k].at=t;saveProf();renderMacros()}}
    else if(d.mp!=null){const st=m.etapes[+d.mp],f=CAT[st.fn],P=Object.assign({},st.p||{});
      $('pkT').textContent='Réglages de l\'étape : '+f.nom;$('pkSub').textContent='';$('pkQ').hidden=true;$('pkL').innerHTML='';
      $('pkForm').innerHTML=paramsHtml(f,P)+'<div class="row"><button id="pkOk" class="on ok">Enregistrer</button></div>';openPanel('pick',true);
      $('pkOk').onclick=()=>{readParams(f,P);st.p=P;saveProf();$('pick').hidden=true;renderMacros()}}});
}

/* ---------- aperçu avant un mix automatique ---------- */
function descPlan(P,L){
  const N=1-L,A='deck '+(L+1),B='deck '+(N+1),tb=P.tb,eq=P.eq||{},fx=P.fx||{},L2=[];
  L2.push('Le '+B+' démarre à '+fmt(P.entry)+' de son morceau, calé sur le tempo');
  if(P.tech=='drop')L2.push('Roulement sur le '+A+' pendant 16 temps'+(fx.riser?' avec bruit de montée':''),'Le '+B+' tombe sur son drop'+(fx.impact?' avec un impact':''));
  else if(P.tech=='echo')L2.push('Le '+A+' part en écho et disparaît','Crossfader d\'un coup vers le '+B);
  else if(P.tech=='cut')L2.push('Coupure nette : crossfader d\'un coup vers le '+B);
  else{L2.push('Crossfader du '+A+' vers le '+B+' sur '+tb+' temps');if(P.tech=='filter')L2.push('Filtre du '+A+' qui monte pendant le passage');if(eq.lowSwap||P.tech!='blend')L2.push('Échange des graves à mi-chemin');else L2.push('Graves du '+A+' baissés progressivement');if(eq.midCut)L2.push('Médiums du '+A+' baissés pour éviter deux voix en même temps')}
  L2.push('Le '+A+' s\'arrête à la fin');return L2;
}
let APC=null;
function ouvrirApercu(L){
  const o=D[L],n=D[1-L];if(!o.plan)return;if(APC&&APC.L==L&&APC.N===n.cur&&!$('apercu').hidden)return;
  APC={L,N:n.cur,alts:null,k:0,P:o.plan};openPanel('apercu',true);renderApercu();
}
function renderApercu(){
  if(!APC)return;const L=APC.L,o=D[L],n=D[1-L],P=APC.P;if(!P)return;
  const tx=(P.exit-o.a.currentTime)/rateOf(o);
  $('apI').innerHTML=`<b>${esc(o.name)}</b> → <b>${esc(n.name)}</b><br>Technique : <b>${esc(TECH[P.tech])}</b> · ${P.tb} temps (${Math.round(P.tb*wallBeat(o))} s) · départ dans <b>${fmt(Math.max(0,tx))}</b> (à ${fmt(P.exit)})`+(P.sc?' · compatibilité '+Math.round(P.sc.total*100)+' %':'');
  $('apL').innerHTML='<ol class="pl">'+descPlan(P,L).map(t=>'<li>'+esc(t)+'</li>').join('')+'</ol>'+(P.issues&&P.issues.length?P.issues.map(s=>`<div class="iss${s.sev=='err'?' err':''}">${esc(s.msg)}</div>`).join(''):'');
  apDraw();
}
function apDraw(){
  const cv=$('apC');if(!cv||!APC)return;const L=APC.L,o=D[L],n=D[1-L],P=APC.P,dp=devicePixelRatio||1,W=Math.round(cv.clientWidth*dp),H=Math.round(cv.clientHeight*dp);if(!W)return;cv.width=W;cv.height=H;
  const x=cv.getContext('2d'),S=60,h=H/2-4,tr=(P.tb||8)*beatLen(o);x.clearRect(0,0,W,H);
  const bars=(pk,t0,y,col)=>{if(!pk)return;x.fillStyle=col;for(let px=0;px<W;px+=3){const k=Math.floor((t0+px/W*S)*50);if(k<0||k>=pk.length)continue;const v=pk[k]*h*.9;x.fillRect(px,y+(h-v)/2,2,v)}};
  const a0=P.exit-S/2;bars(o.pk,a0,0,COL[L]+'cc');bars(n.pk,P.entry-S/2,h+8,COL[1-L]+'cc');
  x.fillStyle='#ffc24b33';x.fillRect(W/2,0,tr/S*W,H);x.fillStyle='#ffc24b';x.fillRect(W/2-1,0,2,H);
  const now=(o.a.currentTime-a0)/S*W;if(now>0&&now<W){x.fillStyle='#fff';x.fillRect(now-1,0,2,h)}
}
setInterval(()=>{if(APC&&!$('apercu').hidden)renderApercu()},500);
function initApercu(){
  $('apOk').onclick=()=>{const o=D[APC.L],n=D[1-APC.L];o.plan=APC.P;o.planN=n.cur;o.valideN=n.cur;o.dl=APC.P.exit;$('apercu').hidden=true;toast('Transition validée')};
  $('apAlt').onclick=()=>{const o=D[APC.L],n=D[1-APC.L];if(!APC.alts){const ra=recOf(o),rb=recOf(n);APC.alts=ra&&rb?planAll(ra,rb,{tb:tbNow(),skipIntro:PREF.si,fixExit:APC.P.exit}):[];APC.alts.forEach(p=>{p.ra=ra;p.rb=rb})}
    if(!APC.alts.length)return;APC.k=(APC.k+1)%APC.alts.length;APC.P=APC.alts[APC.k];renderApercu()};
  $('apNo').onclick=()=>{const o=D[APC.L];o.dl=o.a.currentTime+32*beatLen(o);o.plan=null;o.valideN=null;$('apercu').hidden=true;toast('Transition repoussée de 32 temps')};
}

/* ---------- mode guidé ---------- */
const GUIDE={on:false,P:null,N:null,A:null,steps:[],busy:0};
function setGuide(on){GUIDE.on=on;GUIDE.P=null;if(on&&AUTO.on)setAuto(false,true);$('gu').classList.toggle('on',on);
  QA('.hlg').forEach(e=>e.classList.remove('hlg','hl'));if(!on){$('coach').classList.remove('guide','now');coach('')}
  toast(on?'Mode guidé : je t\'indique quoi faire et quand':'Mode guidé coupé')}
function physFor(fn,deck){
  for(const p of PHYS){const A=PROF.assign[p.id]||{};for(const ly of['base','shift']){const b=A[ly];if(!b||b.fn!=fn)continue;
    const dk=deckOf(b,p.deck);if(deck!=null&&dk!=deck&&!(b.deck=='actif'||b.deck=='autre'))continue;return{id:p.id,txt:'« '+p.impr+' »'+(p.deck!=null?' du deck '+SIDE[p.deck]:'')+(ly=='shift'?' avec SHIFT':'')}}}
  return null;
}
function stepsGuide(P,A,B){
  const tb=P.tb,S=[],pf=(fn,dk)=>physFor(fn,dk),act=(at,txt,ph)=>S.push({at,txt:txt+(ph?' — '+ph.txt:''),ph:ph&&ph.id});
  const dA='deck '+(A+1),dB='deck '+(B+1);
  if(P.tech=='drop'){const r=pf('roll',A)||pf('mix_drop');act(-16,'Roulement sur le '+dA+(r?'':' (fonction « Roulement » non attribuée : Effets → Attribuer)'),r);act(0,'Lance le '+dB+' et crossfader d\'un coup vers lui : le drop tombe',pf('lecture',B))}
  else if(P.tech=='echo'){act(-4,'Prépare-toi : sortie en écho sur le '+dA);const e=pf('echo_sortie',A);act(0,'Sortie en écho sur le '+dA+(e?'':' (attribue « Sortie en écho » à un bouton)'),e);act(1,'Lance le '+dB+' et crossfader d\'un coup vers lui',pf('lecture',B))}
  else if(P.tech=='cut'){act(-4,'Prépare-toi : coupure nette');act(0,'En même temps : lance le '+dB+' et crossfader d\'un coup vers lui',pf('lecture',B))}
  else{
    act(-8,'Mets les graves (LOW) du '+dB+' au minimum',pf('graves',B));
    act(0,'Lance le '+dB,pf('lecture',B));
    act(.5,'Monte le crossfader vers le '+dB+' doucement, sur '+tb+' temps'+(P.tech=='filter'?', en tournant le FILTRE du '+dA+' vers la droite':''),pf(P.tech=='filter'?'filtre':'crossfader',P.tech=='filter'?A:null));
    act(tb/2,'Échange des graves : LOW du '+dA+' au minimum, LOW du '+dB+' au milieu',pf('graves',A));
    act(tb,'Arrête le '+dA+' et remets ses réglages au milieu',pf('lecture',A));
  }
  return S.sort((a,b)=>a.at-b.at);
}
async function guideTick(){
  if(!GUIDE.on||GUIDE.busy)return;if(AUTO.on){setGuide(false);return}
  const A=live(),B=1-A,o=D[A],n=D[B],cc=$('coach');cc.classList.add('guide');
  const show=(t,now)=>{cc.classList.toggle('now',!!now);coach(t)};
  if(o.a.paused||!o.cur){show('Mode guidé : lance un morceau, je t\'accompagne dès qu\'il joue');return}
  if(!n.cur||n.done||!n.a.src){GUIDE.busy=1;try{const ro=recOf(o),it=pickNext(ro?{r:ro,id:o.cur.id}:null);if(it){AUTO.played.add(it.id);show('Je prépare sur le deck '+(B+1)+' : '+it.name);await chargerDeck(B,it)}else show('Choisis le morceau suivant (IA → Meilleurs morceaux)')}finally{GUIDE.busy=0}return}
  if(!n.grid||!o.grid){show('Tempo non détecté : mixe à l\'oreille ou corrige le tempo (détails du morceau)');return}
  if(!GUIDE.P||GUIDE.N!==n.cur||GUIDE.A!==o.cur){
    if(o.dl==null)o.dl=o.a.currentTime+(PREF.mt||1e9);
    const dur=tbNow()*wallBeat(o),near=Math.min(o.dl,Math.max(o.a.currentTime+20,(o.a.duration||1e9)-dur-30));
    let P=getPlan(o,n,{near});if(!P||P.limited){show('Plan impossible : utilise un fondu simple');return}P=autoFixPlan(P,o).P;
    GUIDE.P=P;GUIDE.N=n.cur;GUIDE.A=o.cur;GUIDE.steps=stepsGuide(P,A,B);
    if(n.a.paused){match(n,o);n.a.currentTime=P.entry}
  }
  const P=GUIDE.P,rel=(heard(o)-P.exit)/beatLen(o),S=GUIDE.steps;
  QA('.hlg').forEach(e=>e.classList.remove('hlg','hl'));
  if(!n.a.paused&&rel>(S[S.length-1].at+2)){GUIDE.P=null;o.dl=null;show('Transition faite. Le guide prépare la suite.');return}
  if(n.a.paused&&rel>4){GUIDE.P=null;o.dl=o.a.currentTime+16*beatLen(o);show('Moment passé : je recalcule un nouveau point de transition');return}
  const k=S.findIndex(s=>s.at>rel-.75),s=S[k];
  if(!s){show('Termine la transition à ton rythme');return}
  const dt=s.at-rel,nx=S[k+1];
  if(s.ph&&dt<6){const el=Q('[data-ph="'+s.ph+'"]');if(el)el.classList.add('hl','hlg')}
  show((dt>.75?'Dans '+Math.ceil(dt)+' temps : ':'MAINTENANT : ')+s.txt+(nx?'   ·   ensuite : '+nx.txt.split(' — ')[0]:''),dt<=.75);
}
setInterval(guideTick,200);

/* ---------- alerte fin de morceau ---------- */
setInterval(()=>{
  QA('.jog.alerte').forEach(e=>e.classList.remove('alerte'));if(AUTO.on)return;
  const L=live(),o=D[L],n=D[1-L];if(o.a.paused||!o.a.duration)return;const rem=(o.a.duration-o.a.currentTime)/rateOf(o);
  if(rem<30&&(n.a.paused||!n.a.src)){const el=Q('[data-ph="jog'+L+'"]');if(el)el.classList.add('alerte');
    if(!GUIDE.on&&!transitionEnCours())coach('⚠ Plus que '+Math.ceil(rem)+' s sur le deck '+(L+1)+(n.a.src?' : lance le mix !':' et rien n\'est prêt sur le deck '+(2-L)))}
},500);
setInterval(majRec,1000);

/* ---------- branchements ---------- */
/* ===== « Garder ce morceau » : le public aime, on reste dessus aussi longtemps que tu veux =====
   Avant la fin du morceau (ou avant son outro), l'appli revient au début du dernier refrain,
   sur une fin de phrase (16 temps), pour que le saut tombe en rythme. Autant de tours que tu veux. */
const GARDE={on:false,deck:-1,id:null,tours:0};
function majGarde(){const b=$('garde');if(!b)return;b.classList.toggle('on',GARDE.on);b.textContent=GARDE.on?'♥ GARDÉ'+(GARDE.tours?' ×'+(GARDE.tours+1):''):'♥ GARDER'}
function setGarde(on){
  if(on){
    if(transitionEnCours()){toast('Une transition est en cours : réessaie juste après');return}
    const L=live(),d=D[L];if(!d.cur||d.a.paused||!d.grid){toast('Lance d\'abord un morceau');return}
    const j=jobActif('auto-arm');if(j)j.stop();
    Object.assign(GARDE,{on:true,deck:L,id:d.cur.id,tours:0});d.plan=null;
    toast('Je garde « '+d.name+' » : avant la fin, je reviens au refrain en rythme. Réappuie pour repartir.');
  }else if(GARDE.on){
    GARDE.on=false;const g=jobActif('garde');if(g)g.stop();const o=D[GARDE.deck];
    if(o&&o.cur&&!o.a.paused){o.dl=o.a.currentTime+32*beatLen(o);o.plan=null;o.valideN=null}
    toast(AUTO.on?'C\'est reparti : le mix vers le suivant part au prochain bon moment':'Morceau libéré : il ira jusqu\'à sa fin');
  }
  majGarde();
}
function gardePoints(d){
  const r=d.r,beat=beatLen(d),ph=16*beat,dur=d.a.duration||(r&&r.dur)||0;if(!dur||!beat)return null;
  const S=r&&r.bpm?structure(r):null;
  let lim=dur-20;const out=S&&S.find(s=>s.k=='outro'&&s.t0>dur*.6);if(out)lim=Math.min(lim,out.t0);
  let tgt=null,quoi='refrain';
  if(r&&r.ref&&r.ref.length){const R=r.ref.filter(([a])=>a<lim-2*ph);if(R.length)tgt=R[R.length-1][0]}
  if(tgt==null&&S){const s=S.filter(s=>(s.k=='drop'||s.k=='main')&&s.t0<lim-2*ph);if(s.length){tgt=s[s.length-1].t0;quoi='passage fort'}}
  if(tgt==null){tgt=dur*.3;quoi='milieu du morceau'}
  tgt=snapBeat(d,tgt);const k=Math.floor((lim-tgt)/ph);if(k<2)return null;
  return{tgt,src:tgt+k*ph,quoi};
}
setInterval(()=>{
  if(!GARDE.on)return;const d=D[GARDE.deck];
  if(!d||!d.cur||d.cur.id!==GARDE.id){GARDE.on=false;majGarde();return}
  if(d.a.paused||!d.grid||jobActif('garde'))return;
  const g=gardePoints(d);if(!g)return;
  const pos=posOf(d),bar=4*beatLen(d);let src=g.src;
  if(pos>src-.3){src=d.off+Math.ceil((pos-d.off)/bar+.05)*bar} // activé trop tard : saut à la prochaine mesure
  if(src-pos>6)return;
  const w=(src-pos)/rateOf(d)*1000,j=new Job('Garder ce morceau',{cle:'garde',deck:d.i});
  j.later(()=>{if(!GARDE.on){j.end();return}if(d.lp)killLoop(d);d.a.currentTime=g.tgt;d.plan=null;GARDE.tours++;majGarde();coach('♥ Je reviens au '+g.quoi+' (tour '+(GARDE.tours+1)+')',0,4000);j.end()},Math.max(0,w-10));
},250);
F('Soirée','garder','Garder ce morceau (le public aime)','GARDER','b','Reste sur le morceau aussi longtemps que tu veux : le mode AUTO ne change plus de morceau, et avant la fin l\'appli revient au refrain en rythme. Réappuie pour repartir vers le morceau suivant.',[],{run:()=>setGarde(!GARDE.on),on:()=>GARDE.on});

function initPlus(){
  $('garde').onclick=()=>setGarde(!GARDE.on);majGarde();
  $('gu').onclick=()=>setGuide(!GUIDE.on);$('rec').onclick=recToggle;$('lock').onclick=()=>setVerrou(!VERROU);
  $('note').onclick=e=>{const b=e.target.closest('button');if(b)noter(+b.dataset.nt)};
  $('waves').addEventListener('click',e=>{const b=e.target.closest('[data-tap]');if(b)tapTempo(+b.dataset.tap)});
  $('bacs').onclick=e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.bx){if(confirm('Supprimer le bac « '+LIBBAC+' » ? (les morceaux restent)')){delete BACS[LIBBAC];if(PREF.bac==LIBBAC){PREF.bac='';savePref()}LIBBAC=null;saveBacs();renderLib()}return}
    const v=b.dataset.bv;if(v=='__new'){const n=(prompt('Nom du bac (ex. Chauffe, Shatta, Fin de soirée)')||'').trim();if(!n)return;BACS[n]=BACS[n]||[];saveBacs();LIBBAC=n}else LIBBAC=v||null;renderLib()};
  $('hiB').onclick=()=>{openPanel('hist',true);renderHist()};
  $('hiC').onclick=()=>{if(confirm('Effacer tout l\'historique ?')){HIST=[];saveHist();renderHist()}};
  $('hiX').onclick=()=>{const t=HIST.map(h=>heure(h.t)+'  '+h.name+(h.prev?'  (après '+h.prev.name+(h.tech?', '+h.tech:'')+')':'')).join('\n');try{navigator.clipboard.writeText(t);toast('Liste copiée')}catch(e){toast('Copie impossible','err')}};
  $('hiL').onclick=e=>{const b=e.target.closest('[data-hr]');if(!b)return;const h=HIST[+b.dataset.hr],a=itemById(h.prev.id),c=itemById(h.id);if(D.some(d=>!d.a.paused)){toast('Mets les deux decks en pause d\'abord');return}closePanels();G.xf=0;mix();chargerDeck(0,a);chargerDeck(1,c)};
  $('mcB').onclick=()=>{openPanel('macros');renderMacros()};
  initMacros();initApercu();
  D.forEach(d=>d.a.addEventListener('playing',()=>logLecture(d)));
  renderBacs();
}

/* ===== 5.3 · comme un vrai DJ ===== */
/* retour progressif au tempo d'origine après une transition (évite de rester accéléré toute la soirée) */
function retourTempo(N){
  const d=D[N],r0=d.rate;if(!PREF.retour||Math.abs(r0-1)<.004||Math.abs(r0-1)>.08)return;
  const j=new Job('Retour au tempo d\'origine',{cle:'glide'+N,deck:N,auto:true}),t0=performance.now(),T=64*wallBeat(d)*1000;d.syncLock=false;
  j.frame(()=>{if(!D[1-N].a.paused){j.end();return false}const k=Math.min(1,(performance.now()-t0)/T);d.rate=lerp(r0,1,smth(0,1,k));applyRate(d);if(k>=1){j.end();return false}});
}
/* animation pendant les morceaux (mode AUTO) : seulement aux moments musicaux qui s'y prêtent, jamais pendant un refrain */
const ANIM={last:0};
setInterval(()=>{
  if(!AUTO.on||PREF.anim=='non'||transitionEnCours()||jobActif('anim')||jobActif('auto-arm'))return;
  const L=live(),d=D[L];if(d.a.paused||!d.grid||!d.r||d.lp)return;
  const r=d.r,S=structure(r);if(!S)return;const pos=posOf(d),beat=beatLen(d),now=performance.now();
  if(now-ANIM.last<(PREF.anim=='normal'?25000:45000))return;
  if(d.plan&&d.plan.exit&&d.plan.exit-pos<25&&d.plan.exit-pos>-5)return;
  if(inRef(r,pos,0))return;
  d.animDone=d.animDone||new Set();
  const nb=nextBeat(d,pos),wait=Math.max(0,(nb-pos)/rateOf(d)*1000),fire=(nom,f)=>{ANIM.last=now;const j=new Job(nom,{cle:'anim',deck:L,auto:true});j.later(()=>{f(j)},wait);j.later(()=>j.end(),wait+20*wallBeat(d)*1000)};
  for(let k=1;k<S.length;k++){const s=S[k],ah=(s.t0-pos)/beat;
    if(s.k=='drop'&&S[k-1].k!='drop'&&ah>7.5&&ah<=10&&!d.animDone.has('d'+s.t0)){d.animDone.add('d'+s.t0);const n=Math.max(4,Math.round((s.t0-nb)/beat));
      fire('Montée avant le drop',()=>{runBinding({fn:'balayage_haut',deck:String(L+1),p:{duree:n,prof:.55,forme:'a'}},null,{t:'press'});if(PREF.anim=='normal')riser(n*wallBeat(d))});return}
    if(PREF.anim=='normal'&&s.k=='break'&&ah>1&&ah<=2.6&&!d.animDone.has('b'+s.t0)){d.animDone.add('b'+s.t0);fire('Écho sur le break',()=>echoSend(d,{duree:wallBeat(d),retard:.75,retour:.5}));return}
  }
  if(PREF.anim=='normal'){const sc=secAt(S,pos),ph=Math.round((pos-d.off)/beat)%64,ah=64-ph;
    if(sc&&sc.k=='main'&&ah>=2&&ah<=3&&!d.animDone.has('g'+Math.round(pos/10))){d.animDone.add('g'+Math.round(pos/10));fire('Hachage en fin de phrase',()=>runBinding({fn:'gate',deck:String(L+1),p:{div:.25,duree:2}},null,{t:'press'}))}}
},300);

/* fonctions « soirée » à mettre sur tes touches */
F('Soirée','chant_public','Laisser chanter le public','CHANTEZ !','b','Coupe le son (ou ne garde que les voix, approximativement) pendant 1 ou 2 mesures, à partir de la prochaine mesure, puis revient pile sur le temps.',[['mesures','Durée',1,{o:[[1,'1 mesure'],[2,'2 mesures'],[4,'4 mesures']]}],['mode','Ce qu\'on coupe','tout',{o:[['tout','Tout le son'],['voix','Graves et aigus (garde surtout les voix)']]}]],{
  run:c=>{const d=c.d;if(!deckReady(d,1)||!d.grid)return;const bar=4*beatLen(d),pos=posOf(d),nb=d.off+Math.ceil((pos-d.off)/bar-1e-6)*bar,w=(nb-pos)/rateOf(d)*1000,len=c.p.mesures*bar/rateOf(d)*1000;
    const j=new Job('Laisser chanter',{cle:'mute'+c.i,deck:c.i}),on=v=>{if(c.p.mode=='voix'){d.kill.low=v;d.kill.hi=v;applyDeck(d)}else setMute(d,v)};
    j.onStop(()=>on(0));j.later(()=>on(1),w);j.later(()=>j.end(),w+len);toast('Coupure pour le public à la prochaine mesure')}});
F('Soirée','effet_auto','Effet intelligent (choisi selon le moment)','EFFET IA','b','L\'appli choisit l\'effet qui colle au passage : montée de filtre si un drop arrive, écho si un break arrive, sinon un court hachage en rythme.',[],{
  run:c=>{const d=c.d;if(!deckReady(d,1)||!d.grid)return;const r=d.r,S=r&&structure(r),pos=posOf(d),beat=beatLen(d),dk=String(c.i+1);
    const nx=S&&S.find(s=>s.t0>pos+beat&&s.t0<pos+16*beat&&(s.k=='drop'||s.k=='break'));
    if(nx&&nx.k=='drop'){const n=Math.max(2,Math.round((nx.t0-nextBeat(d,pos))/beat));runBinding({fn:'balayage_haut',deck:dk,p:{duree:n,prof:.6,forme:'a'}},null,{t:'press'});toast('Montée de filtre jusqu\'au drop ('+n+' temps)')}
    else if(nx&&nx.k=='break'&&(nx.t0-pos)/beat<=4){const w=Math.max(0,(nx.t0-beat-pos)/rateOf(d)*1000),j=new Job('Écho avant le break',{cle:'fxia'+c.i,deck:c.i});j.later(()=>{echoSend(d,{duree:wallBeat(d),retard:.75});j.end()},w);toast('Écho sur le dernier temps avant le break')}
    else{runBinding({fn:'gate',deck:dk,p:{div:.25,duree:2}},null,{t:'press'});toast('Hachage en rythme sur 2 temps')}}});
F('Soirée','refrain_rejouer','Rejouer le refrain','RE-REFRAIN','b','Au prochain temps fort, revient au début du refrain (estimé) pour rester sur la chanson.',[],{
  run:c=>{const d=c.d,r=d.r;if(!deckReady(d,1)||!d.grid)return;if(!r||!r.ref||!r.ref.length){toast('Aucun refrain repéré dans ce morceau');return}
    const pos=posOf(d),R=[...r.ref].reverse().find(([a])=>a<pos-4)||r.ref[0],bar=4*beatLen(d),nb=d.off+Math.ceil((pos-d.off)/bar-1e-6)*bar,w=(nb-pos)/rateOf(d)*1000;
    const j=new Job('Rejouer le refrain',{cle:'saut'+c.i,deck:c.i});j.later(()=>{if(d.lp)killLoop(d);d.a.currentTime=snapBeat(d,R[0]);if(d.plan){d.plan=null;d.dl=null}j.end()},w-10);toast('Je rejoue le refrain au prochain temps fort')}});
F('Soirée','prolonger','Rester sur ce morceau (AUTO)','PROLONGER','b','Le mode AUTO reste 32 temps de plus sur le morceau en cours, sans couper le refrain.',[],{
  run:c=>{const d=D[live()];if(d.a.paused)return;d.dl=(d.dl&&d.dl<1e8?Math.max(d.dl,d.a.currentTime):d.a.currentTime)+32*beatLen(d);d.plan=null;d.valideN=null;const j=jobActif('auto-arm');if(j)j.stop();toast('Je reste sur ce morceau 32 temps de plus')}});
