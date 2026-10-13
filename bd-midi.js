'use strict';
/* ===== BeatDeck 5 · platine The Next Beat by Tiësto SX1 =====
   PHYS : commandes physiques réelles (position calquée sur ta platine, en unités de l'écran 2200×1240). */
const PHYS=[],PH={};
const PK={b:['b','m'],pot:['c'],fader:['c'],jog:['r'],enc:['r']};
function ph(id,deck,kind,nom,impr,x,y,w,h,shape){const p={id,deck,kind,nom,impr,x,y,w,h:h||w,shape:shape||kind};PHYS.push(p);PH[id]=p;return p}
const SIDE=['gauche','droit'];
[0,1].forEach(i=>{
  const s=' (deck '+SIDE[i]+')',X=x=>i?2200-x:x;
  ph('tmpm'+i,i,'b','Bouton TEMPO −'+s,'TEMPO −',X(i?300:220),412,78,58,'rect');
  ph('tmpp'+i,i,'b','Bouton TEMPO +'+s,'TEMPO +',X(i?220:300),412,78,58,'rect');
  ph('lpp'+i,i,'b','Bouton boucle +'+s,'+',X(175),492,56,56,'round');
  ph('lpa'+i,i,'b','Bouton AUTO LOOP (boucle auto)'+s,'AUTO LOOP',X(175),556,62,58,'rect');
  ph('lpm'+i,i,'b','Bouton boucle −'+s,'−',X(175),620,56,56,'round');
  ph('cue'+i,i,'b','Bouton CUE'+s,'CUE',X(172),905,96,92,'rect');
  ph('play'+i,i,'b','Bouton lecture ▶/II'+s,'▶/II',X(172),1012,96,92,'rect');
  ph('jog'+i,i,'jog','Molette'+s,'MOLETTE',X(520),690,600,600,'jog');
  ph('sync'+i,i,'b','Bouton SYNC'+s,'SYNC',X(752),380,58,58,'round');
  ph('flt'+i,i,'pot','Potentiomètre FILTER FX'+s,'FILTER FX',X(836),388,72,72,'knob');
  ph('fx'+i,i,'b','Bouton FX ON'+s,'FX ON',X(842),474,52,52,'round');
  ph('hi'+i,i,'pot','Potentiomètre HI (aigus)'+s,'HI',X(944),390,72,72,'knob');
  ph('low'+i,i,'pot','Potentiomètre LOW (graves)'+s,'LOW',X(944),498,72,72,'knob');
  ph('vol'+i,i,'pot','Potentiomètre VOL (volume)'+s,'VOL',X(944),606,72,72,'knob');
  ph('vin'+i,i,'b','Bouton VINYL'+s,'VINYL',X(944),706,84,56,'rect');
  ph('cas'+i,i,'b','Bouton casque'+s,'🎧',X(944),786,84,56,'rect');
  ph('shf'+i,i,'b','Bouton SHIFT '+(i+1)+s,'SHIFT '+(i+1),X(944),874,84,56,'rect');
});
ph('brw',null,'enc','Bouton BROWSE (rotation)','BROWSE',1100,404,96,96,'enc');
ph('brwp',null,'b','Bouton BROWSE (appui)','BROWSE ↓',1100,404,1,1,'hidden');
ph('mst',null,'b','Bouton MASTER / FOLDER OUT','MASTER',1100,528,74,56,'rect');
ph('ld1',null,'b','Bouton de chargement 1','1',1036,606,62,56,'rect');
ph('ld2',null,'b','Bouton de chargement 2','2',1164,606,62,56,'rect');
ph('mg',null,'pot','Potentiomètre MASTER GAIN','MASTER GAIN',1100,700,72,72,'knob');
ph('xf',null,'fader','Crossfader','CROSSFADER',1100,980,330,60,'xf');
const CAP_ORDER=['play0','cue0','sync0','tmpm0','tmpp0','lpm0','lpa0','lpp0','jog0','flt0','fx0','hi0','low0','vol0','vin0','cas0','shf0',
  'play1','cue1','sync1','tmpm1','tmpp1','lpm1','lpa1','lpp1','jog1','flt1','fx1','hi1','low1','vol1','vin1','cas1','shf1',
  'brw','brwp','ld1','ld2','mst','mg','xf'];

/* Fonctions par défaut (inspirées de ce qui est imprimé sur ta platine) */
const DEF_ASSIGN=(()=>{const A={},b=(fn,o)=>Object.assign({fn,deck:'commande'},o||{});
  [0,1].forEach(i=>{
    A['play'+i]={base:b('lecture')};A['cue'+i]={base:b('cue'),shift:b('debut')};A['sync'+i]={base:b('sync'),shift:b('caler')};
    A['tmpm'+i]={base:b('tempo_m'),shift:b('tonalite')};A['tmpp'+i]={base:b('tempo_p'),shift:b('tonalite')};
    A['lpm'+i]={base:b('boucle_d2'),shift:b('hc1')};A['lpa'+i]={base:b('boucle'),shift:b('hc2')};A['lpp'+i]={base:b('boucle_x2'),shift:b('hc3')};
    A['jog'+i]={base:b('molette'),shift:b('recherche')};A['flt'+i]={base:b('filtre')};A['fx'+i]={base:b('echo'),shift:b('echo_sortie')};
    A['hi'+i]={base:b('aigus')};A['low'+i]={base:b('graves')};A['vol'+i]={base:b('volume')};
    A['vin'+i]={base:b('begaiement'),shift:b(i?'son_laser':'son_klaxon')};A['cas'+i]={base:b('casque'),shift:b(i?'son_caisse':'son_sirene')};
    A['shf'+i]={base:b('shift')};
  });
  A.brw={base:b('parcourir')};A.brwp={base:b('charger_libre')};A.ld1={base:b('charger_1')};A.ld2={base:b('charger_2')};
  A.mst={base:b('mix_ia'),shift:b('arret')};A.mg={base:b('volume_general')};A.xf={base:b('crossfader')};
  return A})();

/* ===== MIDI ===== */
const MIDI={acc:null,map:LS.get('bd5_midi',{phys:{},shift:null,nom:''}),idx:{},cap:null,test:false,testRun:false,lastV:{},led:{},devs:[]};
function midiIndex(){const I={};for(const id in MIDI.map.phys){const m=MIDI.map.phys[id];if(!m||m.none)continue;if(m.k)I[m.k]={id,part:'main'};if(m.touch)I[m.touch]={id,part:'touch'};if(m.lsb)I[m.lsb]={id,part:'lsb'}}MIDI.idx=I}
const saveMidi=()=>{LS.set('bd5_midi',MIDI.map);midiIndex()};
midiIndex();
function parseMidi(data){
  let[s,a,b=0]=data,t=s&240,ch=s&15;
  if(t==128){t=144;b=0}
  if(t==144)return{k:'n:'+ch+':'+a,typ:'n',ch,num:a,v:b,press:b>0};
  if(t==176)return{k:'c:'+ch+':'+a,typ:'c',ch,num:a,v:b,press:b>63};
  if(t==224)return{k:'p:'+ch,typ:'p',ch,num:0,v:b*128+a,press:false};
  return null;
}
const physLabel=k=>{if(!k)return'—';const[t,ch,n]=k.split(':');return(t=='n'?'Note '+n:t=='c'?'Contrôle '+n:'Roue de hauteur')+' · canal '+(+ch+1)};

function onMidi(e){
  const m=parseMidi(e.data);if(!m)return;
  if(MIDI.cap){capFeed(m);return}
  let hit=MIDI.idx[m.k],layer='base';
  if(!hit&&SHIFT.on&&MIDI.map.shift&&MIDI.map.shift.mode=='decal'&&m.typ=='n'){const s=MIDI.map.shift,k2='n:'+(m.ch-s.dc)+':'+(m.num-s.dn);if(MIDI.idx[k2]){hit=MIDI.idx[k2];layer='shift'}}
  if(MIDI.test)testShow(m,hit);
  if(!hit||hit.part!='main')return;
  if(MIDI.test&&!MIDI.testRun){uiFlash(hit.id);return}
  if(LEARN||EDIT){const A=PROF.assign[hit.id];if(A&&A.base&&A.base.fn=='shift'){physEvent(hit.id,m,'base');return}
    const p=PH[hit.id];if(p.kind!='b'||m.press){if(LEARN)learnPick(hit.id);else if($('pick').hidden)openEditor(hit.id,SHIFT.on?'shift':'base')}
    return}
  physEvent(hit.id,m,layer);
}
/* traduit un message en action sur la commande physique */
function physEvent(id,m,layer){
  const p=PH[id],mp=MIDI.map.phys[id]||{},A=PROF.assign[id]||{};
  const baseFn=A.base&&A.base.fn;
  if(baseFn=='shift')layer='base';else if(SHIFT.on)layer='shift';
  const b=layer=='shift'&&A.shift&&A.shift.fn?A.shift:A.base;if(!b)return;
  const inv=PROF.inv[id];let ev;
  if(p.kind=='b'){ev={t:m.press?'press':'release'};if(m.typ=='c'&&MIDI.lastV[m.k]!=null&&(MIDI.lastV[m.k]>63)==m.press){MIDI.lastV[m.k]=m.v;return}MIDI.lastV[m.k]=m.v}
  else if(p.kind=='pot'||p.kind=='fader'){let v=m.typ=='p'?m.v/16383:m.v/127;if(inv)v=1-v;ev={t:'value',v,prev:MIDI.lastV[m.k]};MIDI.lastV[m.k]=v;uiVal(id,v)}
  else{let dl=0;const enc=mp.enc||'A',v=m.typ=='p'?m.v/128:m.v,pv=MIDI.lastV[m.k];
    if(enc=='C'||m.typ=='p'){dl=pv==null?0:v-pv;if(Math.abs(dl)>64)dl=0}else if(enc=='B')dl=m.v-64;else dl=m.v<64?m.v:m.v-128;
    MIDI.lastV[m.k]=v;if(!dl)return;if(inv)dl=-dl;ev={t:'delta',v:dl};uiTurn(id,dl)}
  if(ev.t=='press')uiFlash(id);
  runBinding(b,p.deck,ev);
}
function midiInit(){
  if(!navigator.requestMIDIAccess){majStatut('MIDI indisponible : utilise Chrome');return}
  navigator.requestMIDIAccess({sysex:false}).then(acc=>{
    MIDI.acc=acc;
    const hook=()=>{const ins=[...acc.inputs.values()];ins.forEach(i=>i.onmidimessage=onMidi);MIDI.devs=ins.map(i=>i.name);
      majStatut(ins.length?ins.map(i=>i.name).join(', ')+' · connectée':'Platine non détectée',ins.length>0);
      for(const k in MIDI.led)delete MIDI.led[k];
      if(ins.length&&!Object.keys(MIDI.map.phys).length&&!LS.get('bd5_capdeja',false)){LS.set('bd5_capdeja',true);setTimeout(()=>capStart(),600)}};
    hook();acc.onstatechange=hook;
  }).catch(()=>majStatut('Accès MIDI refusé : autorise-le dans Chrome'));
}
/* voyants de la platine (si elle les accepte) */
setInterval(()=>{
  if(!MIDI.acc||MIDI.cap)return;
  for(const id in MIDI.map.phys){const m=MIDI.map.phys[id],p=PH[id];if(!m||!m.k||!p||p.kind!='b'||!m.k.startsWith('n:'))continue;
    const A=PROF.assign[id]||{},on=bindingOn(A.base,p.deck);if(MIDI.led[id]===on)continue;MIDI.led[id]=on;
    const[,ch,n]=m.k.split(':').map(Number);MIDI.acc.outputs.forEach(o=>{try{o.send([144|ch,n,on?127:0])}catch(e){}})}
},250);

/* ===== Capture guidée : la platine apprend toute seule ce que chaque commande envoie ===== */
const CAPMSG={b:'Appuie une fois sur',pot:'Tourne doucement de gauche à droite',fader:'Fais glisser d\'un bout à l\'autre',jog:'Tourne la molette (sans appuyer dessus si possible)',enc:'Tourne'};
function capStart(from){
  closePanels();MIDI.cap={i:from||0,buf:[],tm:0,ign:0,shiftTest:false,shiftDown:false};capShow();
}
function capStop(msg){MIDI.cap=null;$('cap').hidden=true;QA('.hl').forEach(e=>e.classList.remove('hl'));saveMidi();refreshStage();if(msg)toast(msg)}
function capShow(){
  const C=MIDI.cap;if(!C)return;QA('.hl').forEach(e=>e.classList.remove('hl'));$('cap').hidden=false;
  if(C.i>=CAP_ORDER.length){capShiftStep();return}
  const id=CAP_ORDER[C.i],p=PH[id],cur=MIDI.map.phys[id];
  const el=Q('[data-ph="'+id+'"]');if(el)el.classList.add('hl');$('cap').classList.toggle('haut',p.y>780&&p.x>500&&p.x<1700);
  $('capN').textContent='Étape '+(C.i+1)+' sur '+CAP_ORDER.length+' · '+(p.deck==null?'Centre':'Deck '+SIDE[p.deck]);
  $('capT').textContent=p.nom;
  $('capH').textContent=CAPMSG[p.kind]+' « '+p.impr+' »'+(id=='brwp'?' (appuie sur le gros bouton rond comme sur un bouton)':'')+'.'+(cur?' Actuellement : '+(cur.none?'n\'envoie rien':physLabel(cur.k)):'');
  $('capR').textContent='';$('capP').style.width=(C.i/CAP_ORDER.length*100)+'%';
}
function capFeed(m){
  const C=MIDI.cap;
  if(C.shiftTest){capShiftFeed(m);return}
  if(performance.now()<C.ign||C.i>=CAP_ORDER.length)return;
  const id=CAP_ORDER[C.i],p=PH[id];
  // ignore les messages déjà attribués à une autre commande pendant cette capture
  const owner=MIDI.idx[m.k];if(owner&&owner.id!=id&&C.done&&C.done.has(owner.id))return;
  if(m.typ=='n'&&!m.press&&!C.buf.length)return;
  C.buf.push(m);$('capR').textContent='Reçu : '+physLabel(m.k)+' …';
  if(!C.tm)C.tm=setTimeout(capDecide,p.kind=='b'?320:p.kind=='jog'?1100:900);
}
function capDecide(){
  const C=MIDI.cap;if(!C)return;C.tm=0;const id=CAP_ORDER[C.i],p=PH[id],buf=C.buf;C.buf=[];
  const by={};buf.forEach(m=>{(by[m.k]=by[m.k]||[]).push(m)});const keys=Object.keys(by);
  const notes=keys.filter(k=>k[0]=='n'),ccs=keys.filter(k=>k[0]!='n');
  const vals=k=>by[k].map(m=>m.v);let res=null,warn='';
  if(p.kind=='b'){
    const n=notes.find(k=>by[k].some(m=>m.press));
    if(n)res={k:n};else if(ccs.length){const k=ccs.sort((a,b)=>by[b].length-by[a].length)[0],v=vals(k);if(new Set(v).size<=3&&v.some(x=>x>63))res={k};else warn='Ça ressemble à un potentiomètre ou à une molette, pas à un bouton.'}
  }else if(p.kind=='pot'||p.kind=='fader'){
    if(!ccs.length)warn='Ça ressemble à un bouton. Tourne ou fais glisser la commande.';
    else{let cand=ccs.sort((a,b)=>by[b].length-by[a].length);let k=cand[0],lsb=null;
      const pr=k.split(':');const hi=cand.find(x=>{const q=x.split(':');return q[0]=='c'&&q[1]==pr[1]&&+q[2]+32==+pr[2]});
      if(hi){lsb=k;k=hi}else{const lo=cand.find(x=>{const q=x.split(':');return q[0]=='c'&&q[1]==pr[1]&&+q[2]==+pr[2]+32});if(lo)lsb=lo}
      if(new Set(vals(k)).size<2&&k[0]!='p')warn='Une seule valeur reçue : tourne un peu plus.';else res={k,lsb}}
  }else{
    if(!ccs.length)warn='Je n\'ai reçu qu\'un appui. Tourne la commande.';
    else{const k=ccs.sort((a,b)=>by[b].length-by[a].length)[0],v=vals(k);let enc='C';
      if(k[0]!='p'){if(v.every(x=>x<=30||x>=98))enc='A';else if(v.every(x=>x>=34&&x<=94)&&v.some(x=>x!=64)&&new Set(v).size<=8)enc='B'}
      res={k,enc,touch:notes[0]||null}}
  }
  if(!res){$('capR').textContent=(warn||'Rien de clair reçu.')+' Recommence.';C.ign=performance.now()+300;return}
  // retire ce message d'une autre commande s'il y était
  for(const o in MIDI.map.phys){const x=MIDI.map.phys[o];if(o!=id&&x&&(x.k==res.k||x.touch==res.k))delete MIDI.map.phys[o]}
  MIDI.map.phys[id]=Object.assign({kind:p.kind},res);(C.done=C.done||new Set()).add(id);midiIndex();
  $('capR').textContent='✓ '+physLabel(res.k)+(res.enc?' · molette type '+res.enc:'');
  C.ign=performance.now()+450;setTimeout(()=>{if(MIDI.cap===C){C.i++;capShow()}},350);
}
function capShiftStep(){
  const C=MIDI.cap;QA('.hl').forEach(e=>e.classList.remove('hl'));
  const s=MIDI.map.phys.shf0,pl=MIDI.map.phys.play0;
  if(!s||!s.k||!pl||!pl.k){capStop('Configuration terminée');return}
  C.shiftTest=true;C.shiftDown=false;['shf0','play0'].forEach(i=>{const el=Q('[data-ph="'+i+'"]');if(el)el.classList.add('hl')});
  $('capN').textContent='Dernière étape · combinaisons SHIFT';$('capT').textContent='Maintiens SHIFT 1 et appuie sur lecture ▶/II (deck gauche)';
  $('capH').textContent='Ça permet de savoir comment ta platine envoie les combinaisons SHIFT. Tu peux passer cette étape.';$('capR').textContent='';$('capP').style.width='100%';
}
function capShiftFeed(m){
  const C=MIDI.cap,s=MIDI.map.phys.shf0,pl=MIDI.map.phys.play0;
  if(m.k==s.k){C.shiftDown=m.press;$('capR').textContent=m.press?'SHIFT tenu…':'';return}
  if(!C.shiftDown||!m.press)return;
  if(m.k==pl.k){MIDI.map.shift={mode:'logiciel'};capStop('Configuration terminée · SHIFT géré par l\'application');return}
  if(m.typ=='n'){const[,pc,pn]=pl.k.split(':').map(Number);MIDI.map.shift={mode:'decal',dn:m.num-pn,dc:m.ch-pc};capStop('Configuration terminée · combinaisons SHIFT reconnues');return}
}
/* écran de test : affiche ce que la platine envoie */
function testShow(m,hit){
  const p=hit&&PH[hit.id],A=p&&PROF.assign[p.id],b=A&&(SHIFT.on&&A.shift?A.shift:A.base);
  $('testL').innerHTML='<b>'+esc(physLabel(m.k))+'</b> · valeur '+m.v+'<br>'+(p?esc(p.nom)+(hit.part=='touch'?' (toucher)':'')+' → <b>'+esc(b&&CAT[b.fn]?CAT[b.fn].nom:'aucune fonction')+'</b>':'<span class="mu">Commande inconnue : lance « Configurer la platine »</span>');
  if(hit)uiFlash(hit.id);
}
