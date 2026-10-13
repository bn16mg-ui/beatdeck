'use strict';
/* ===== BeatDeck 6 · ta platine SX1 (MIDI) =====
   Les réglages appris par l'ancienne version sont repris tels quels (même mémoire : « bd5_midi »).
   Si besoin, « Configurer la platine » refait l'apprentissage commande par commande. */
const KIND={rect:'b',round:'b',hidden:'b',knob:'pot',xf:'fader',jog:'jog',enc:'r'};
const kindOf=id=>{const f=PH[id].forme;return f=='enc'?'enc':KIND[f]};
const MIDI={acc:null,map:LS.get('bd5_midi',{phys:{},shift:null}),idx:{},cap:null,der:{},led:{},noms:[]};
// sens inversé appris dans l'ancienne version (ex. ton crossfader) : repris s'il existe
const INV_ANCIEN=(()=>{try{const P=LS.get('bd5_profs',{}),c=LS.get('bd5_prof','');return(P[c]&&P[c].inv)||{}}catch(e){return{}}})();
const inverse=id=>{const m=MIDI.map.phys[id];return m&&m.inv!=null?!!m.inv:!!INV_ANCIEN[id]};
function midiIndex(){const I={};for(const id in MIDI.map.phys){const m=MIDI.map.phys[id];if(!m||m.none||!PH[id])continue;if(m.k)I[m.k]={id,part:'main'};if(m.touch)I[m.touch]={id,part:'touch'};if(m.lsb)I[m.lsb]={id,part:'lsb'}}MIDI.idx=I}
const saveMidi=()=>{LS.set('bd5_midi',MIDI.map);midiIndex()};
midiIndex();
function parseMidi(data){
  let[s,a,b=0]=data,t=s&240,ch=s&15;if(t==128){t=144;b=0}
  if(t==144)return{k:'n:'+ch+':'+a,typ:'n',ch,num:a,v:b,press:b>0};
  if(t==176)return{k:'c:'+ch+':'+a,typ:'c',ch,num:a,v:b,press:b>63};
  if(t==224)return{k:'p:'+ch,typ:'p',ch,num:0,v:b*128+a,press:false};
  return null;
}
const midiTxt=k=>{if(!k)return'—';const[t,ch,n]=k.split(':');return(t=='n'?'note '+n:t=='c'?'contrôle '+n:'roue')+' · canal '+(+ch+1)};

function onMidi(e){
  const m=parseMidi(e.data);if(!m)return;
  if(MIDI.cap){capRecoit(m);return}
  let hit=MIDI.idx[m.k],shiftMat=false;
  // certaines platines envoient un autre numéro quand SHIFT est tenu
  if(!hit&&MIDI.map.shift&&MIDI.map.shift.mode=='decal'&&m.typ=='n'){const s=MIDI.map.shift,k2='n:'+(m.ch-s.dc)+':'+(m.num-s.dn);if(MIDI.idx[k2]){hit=MIDI.idx[k2];shiftMat=true}}
  if(!hit||hit.part!='main')return;
  const id=hit.id,kd=kindOf(id),inv=inverse(id);let ev;
  if(kd=='b'){
    if(m.typ=='c'&&MIDI.der[m.k]!=null&&(MIDI.der[m.k]>63)==m.press){MIDI.der[m.k]=m.v;return}MIDI.der[m.k]=m.v;
    ev={t:m.press?'press':'release'};
    if(shiftMat&&!SHIFT.on&&m.press){SHIFT.tenus.add('_midi');SHIFT.on=true;commande(id,ev);SHIFT.tenus.delete('_midi');SHIFT.on=SHIFT.tenus.size>0;eclat(id);return}
    if(m.press)eclat(id);
  }else if(kd=='pot'||kd=='fader'){let v=m.typ=='p'?m.v/16383:m.v/127;if(inv)v=1-v;ev={t:'value',v}}
  else{const mp=MIDI.map.phys[id]||{},enc=mp.enc||'A',v=m.typ=='p'?m.v/128:m.v,pv=MIDI.der[m.k];let dl;
    if(enc=='C'||m.typ=='p'){dl=pv==null?0:v-pv;if(Math.abs(dl)>64)dl=0}else if(enc=='B')dl=m.v-64;else dl=m.v<64?m.v:m.v-128;
    MIDI.der[m.k]=v;if(!dl)return;if(inv)dl=-dl;ev={t:'delta',v:dl};if(kd=='enc'){VAL[id]+=Math.sign(dl);dessiner(id)}}
  commande(id,ev);
}
function midiInit(){
  if(!navigator.requestMIDIAccess){statut('Platine : utilise Chrome',false);return}
  navigator.requestMIDIAccess({sysex:false}).then(acc=>{
    MIDI.acc=acc;
    const brancher=()=>{const ins=[...acc.inputs.values()];ins.forEach(i=>i.onmidimessage=onMidi);MIDI.noms=ins.map(i=>i.name);
      statut(ins.length?'Platine connectée':'Platine non détectée',ins.length>0);for(const k in MIDI.led)delete MIDI.led[k];
      if(ins.length&&!Object.keys(MIDI.map.phys).length&&!LS.get('bd6_capdeja',false)){LS.set('bd6_capdeja',true);setTimeout(()=>capDebut(),700)}};
    brancher();acc.onstatechange=brancher;
  }).catch(()=>statut('Platine : accès refusé',false));
}
function statut(t,ok){const e=$('plat');if(!e)return;e.textContent=t;e.classList.toggle('ok',!!ok)}

/* voyants de la platine (si elle les accepte) */
setInterval(()=>{
  if(!MIDI.acc||MIDI.cap)return;
  for(const id in MIDI.map.phys){const m=MIDI.map.phys[id];if(!m||!m.k||!PH[id]||kindOf(id)!='b'||!m.k.startsWith('n:'))continue;
    const f=FN[id]&&FN[id].base,on=!!(f&&f.on&&f.on());if(MIDI.led[id]===on)continue;MIDI.led[id]=on;
    const[,ch,n]=m.k.split(':').map(Number);MIDI.acc.outputs.forEach(o=>{try{o.send([144|ch,n,on?127:0])}catch(e){}})}
},250);

/* ===== apprentissage guidé : la platine dit ce que chaque commande envoie ===== */
const CAP_ORDRE=['play0','cue0','sync0','tmpm0','tmpp0','lpm0','lpa0','lpp0','jog0','flt0','fx0','hi0','low0','vol0','vin0','cas0','shf0',
  'play1','cue1','sync1','tmpm1','tmpp1','lpm1','lpa1','lpp1','jog1','flt1','fx1','hi1','low1','vol1','vin1','cas1','shf1',
  'brw','brwp','ld1','ld2','mst','mg','xf'];
const CAPMSG={b:'Appuie une fois sur',pot:'Tourne doucement de la gauche vers la droite',fader:'Fais glisser de la gauche vers la droite',jog:'Tourne la molette (sans appuyer dessus si possible)',enc:'Tourne'};
const REAPP={attente:false};
function capDebut(i,seul){fermerPanneaux();REAPP.attente=false;MIDI.cap={i:i||0,i0:i||0,buf:[],tm:0,ign:0,seul:!!seul,fait:new Set()};capMontre()}
function capFin(msg){MIDI.cap=null;$('cap').hidden=true;QA('.hl').forEach(e=>e.classList.remove('hl'));saveMidi();if(msg)toast(msg)}
function capMontre(){
  const C=MIDI.cap;if(!C)return;QA('.hl').forEach(e=>e.classList.remove('hl'));$('cap').hidden=false;
  if(C.i>=CAP_ORDRE.length||(C.seul&&C.i!=C.i0)){if(C.seul){capFin();return}capShift();return}
  const id=CAP_ORDRE[C.i],p=PH[id],kd=kindOf(id),cur=MIDI.map.phys[id];
  const el=Q('[data-ph="'+(id=='brwp'?'brw':id)+'"]');if(el)el.classList.add('hl');
  $('cap').classList.toggle('haut',p.y>780&&p.x>500&&p.x<1700);
  $('capN').textContent=C.seul?'Réapprendre une commande':'Étape '+(C.i+1)+' sur '+CAP_ORDRE.length+' · '+(p.deck==null?'milieu':'deck '+(p.deck?'droit':'gauche'));
  $('capT').textContent=p.nom;
  $('capH').textContent=(id=='brwp'?'Appuie sur le gros bouton PARCOURIR comme sur un bouton':CAPMSG[kd]+' « '+p.txt+' »')+'.'+(cur?' Actuellement : '+(cur.none?'n\'envoie rien':midiTxt(cur.k)):'');
  $('capR').textContent='';$('capP').style.width=(C.i/CAP_ORDRE.length*100)+'%';$('capB').hidden=C.seul||C.i==0;
}
function capRecoit(m){
  const C=MIDI.cap;if(C.shiftTest){capShiftRecoit(m);return}
  if(performance.now()<C.ign||C.i>=CAP_ORDRE.length)return;
  const id=CAP_ORDRE[C.i],kd=kindOf(id);
  const owner=MIDI.idx[m.k];if(owner&&owner.id!=id&&C.fait.has(owner.id))return;   // déjà attribué pendant cette configuration
  if(m.typ=='n'&&!m.press&&!C.buf.length)return;
  C.buf.push(m);$('capR').textContent='Reçu : '+midiTxt(m.k)+' …';
  if(!C.tm)C.tm=setTimeout(capDecide,kd=='b'?320:kd=='jog'?1100:900);
}
function capDecide(){
  const C=MIDI.cap;if(!C)return;C.tm=0;const id=CAP_ORDRE[C.i],kd=kindOf(id),buf=C.buf;C.buf=[];
  const by={};buf.forEach(m=>{(by[m.k]=by[m.k]||[]).push(m)});const keys=Object.keys(by),notes=keys.filter(k=>k[0]=='n'),ccs=keys.filter(k=>k[0]!='n'),vals=k=>by[k].map(m=>m.v);
  let res=null,warn='';
  if(kd=='b'){const n=notes.find(k=>by[k].some(m=>m.press));
    if(n)res={k:n};else if(ccs.length){const k=ccs.sort((a,b)=>by[b].length-by[a].length)[0],v=vals(k);if(new Set(v).size<=3&&v.some(x=>x>63))res={k};else warn='Ça ressemble à un bouton rotatif ou à une molette, pas à un bouton.'}}
  else if(kd=='pot'||kd=='fader'){
    if(!ccs.length)warn='Ça ressemble à un bouton. Tourne ou fais glisser la commande.';
    else{const cand=ccs.sort((a,b)=>by[b].length-by[a].length);let k=cand[0],lsb=null;const pr=k.split(':');
      const hi=cand.find(x=>{const q=x.split(':');return q[0]=='c'&&q[1]==pr[1]&&+q[2]+32==+pr[2]});
      if(hi){lsb=k;k=hi}else{const lo=cand.find(x=>{const q=x.split(':');return q[0]=='c'&&q[1]==pr[1]&&+q[2]==+pr[2]+32});if(lo)lsb=lo}
      const v=vals(k);if(new Set(v).size<2&&k[0]!='p')warn='Une seule valeur reçue : tourne un peu plus.';
      else res={k,lsb,inv:v[v.length-1]<v[0]}}}   // valeurs qui descendent quand tu vas à droite = commande à l'envers
  else{if(!ccs.length)warn='Je n\'ai reçu qu\'un appui. Tourne la commande.';
    else{const k=ccs.sort((a,b)=>by[b].length-by[a].length)[0],v=vals(k);let enc='C';
      if(k[0]!='p'){if(v.every(x=>x<=30||x>=98))enc='A';else if(v.every(x=>x>=34&&x<=94)&&v.some(x=>x!=64)&&new Set(v).size<=8)enc='B'}
      res={k,enc,touch:notes[0]||null}}}
  if(!res){$('capR').textContent=(warn||'Rien de clair reçu.')+' Recommence.';C.ign=performance.now()+300;return}
  const pris=[];for(const o in MIDI.map.phys){const x=MIDI.map.phys[o];if(o!=id&&x&&(x.k==res.k||x.touch==res.k)){delete MIDI.map.phys[o];pris.push(PH[o]?PH[o].nom:o)}}
  if(pris.length)toast('Ce signal était attribué à « '+pris[0]+' » : retiré de cette commande. Réapprends-la si besoin.');
  MIDI.map.phys[id]=Object.assign({kind:kd},res);C.fait.add(id);midiIndex();
  $('capR').textContent='✓ '+midiTxt(res.k)+(res.inv?' · sens inversé corrigé':'');
  if(C.seul){setTimeout(()=>{if(MIDI.cap===C)capFin(PH[id].nom+' : réapprise')},500);return}
  C.ign=performance.now()+450;setTimeout(()=>{if(MIDI.cap===C){C.i++;capMontre()}},350);
}
function capShift(){
  const C=MIDI.cap;QA('.hl').forEach(e=>e.classList.remove('hl'));const s=MIDI.map.phys.shf0,pl=MIDI.map.phys.play0;
  if(!s||!s.k||!pl||!pl.k){capFin('Configuration terminée');return}
  C.shiftTest=true;C.shiftBas=false;['shf0','play0'].forEach(i=>{const el=Q('[data-ph="'+i+'"]');if(el)el.classList.add('hl')});
  $('capN').textContent='Dernière étape';$('capT').textContent='Maintiens SHIFT (deck gauche) et appuie sur LECTURE (deck gauche)';
  $('capH').textContent='Ça permet de savoir comment ta platine envoie les combinaisons avec SHIFT.';$('capR').textContent='';$('capP').style.width='100%';$('capB').hidden=true;
}
function capShiftRecoit(m){
  const C=MIDI.cap,s=MIDI.map.phys.shf0,pl=MIDI.map.phys.play0;
  if(m.k==s.k){C.shiftBas=m.press;$('capR').textContent=m.press?'SHIFT tenu…':'';return}
  if(!C.shiftBas||!m.press)return;
  if(m.k==pl.k){MIDI.map.shift={mode:'logiciel'};capFin('Configuration terminée');return}
  if(m.typ=='n'){const[,pc,pn]=pl.k.split(':').map(Number);MIDI.map.shift={mode:'decal',dn:m.num-pn,dc:m.ch-pc};capFin('Configuration terminée')}
}
/* réapprendre une seule commande : on la touche à l'écran */
function reapprendre(){fermerPanneaux();REAPP.attente=true;document.body.classList.add('choix');toast('Touche à l\'écran la commande à réapprendre')}
function reapprendreChoisi(id){REAPP.attente=false;document.body.classList.remove('choix');if(id=='brw')id='brw';capDebut(CAP_ORDRE.indexOf(id),true)}

function initPlatine(){
  $('plat').onclick=()=>{$('platp').hidden=false;$('platI').textContent=MIDI.noms.length?'Connectée : '+MIDI.noms.join(', ')+' · '+Object.keys(MIDI.map.phys).length+' commandes reconnues':'Aucune platine détectée. Branche ta SX1 en USB à la tablette, puis ouvre l\'appli dans Chrome.'};
  $('pCap').onclick=()=>capDebut(0);$('pRe').onclick=reapprendre;
  $('capS').onclick=()=>{const C=MIDI.cap;if(!C)return;if(C.shiftTest){capFin('Configuration terminée');return}const id=CAP_ORDRE[C.i];clearTimeout(C.tm);C.tm=0;C.buf=[];MIDI.map.phys[id]={kind:kindOf(id),none:true};midiIndex();if(C.seul){capFin();return}C.i++;capMontre()};
  $('capB').onclick=()=>{const C=MIDI.cap;if(!C||C.i==0)return;clearTimeout(C.tm);C.tm=0;C.buf=[];C.i--;capMontre()};
  $('capX').onclick=()=>capFin('Configuration arrêtée : ce qui a été appris est gardé');
  midiInit();
}
