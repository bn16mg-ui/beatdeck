'use strict';
/* ===== BeatDeck 5 · profils et démarrage ===== */
let PROFS=LS.get('bd5_profs',{}),CURP=LS.get('bd5_prof','Mon profil'),PROF=null,UI={wave:1,coach:1,size:1};
const clone=o=>JSON.parse(JSON.stringify(o));
function newProf(){return{assign:clone(DEF_ASSIGN),inv:{},fxp:{},prefs:Object.assign({},PREF_DEF),ui:{wave:1,coach:1,size:1}}}
function useProf(p){
  PROF=p;PROF.assign=PROF.assign||{};PROF.inv=PROF.inv||{};PROF.fxp=PROF.fxp||{};
  for(const id in DEF_ASSIGN)if(!PROF.assign[id])PROF.assign[id]=clone(DEF_ASSIGN[id]);
  PREF=Object.assign({},PREF_DEF,PROF.prefs||{});PROF.prefs=PREF;UI=Object.assign({wave:1,coach:1,size:1},PROF.ui||{});PROF.ui=UI;
}
let svT=0;
function saveProf(){clearTimeout(svT);svT=setTimeout(()=>{PROF.prefs=PREF;PROF.ui=UI;PROFS[CURP]=PROF;LS.set('bd5_profs',PROFS);LS.set('bd5_prof',CURP)},150)}
savePref=saveProf;
function switchProf(n){saveProf();CURP=n;useProf(PROFS[n]);LS.set('bd5_prof',n);refreshStage();applyUI();renderSet();toast('Profil : '+n)}
function initProfils(){
  $('pf').onchange=()=>switchProf($('pf').value);
  $('pfn').onclick=()=>{const n=(prompt('Nom du nouveau profil (réglages d\'origine)')||'').trim();if(!n||PROFS[n])return;PROFS[n]=newProf();switchProf(n)};
  $('pfd').onclick=()=>{const n=(prompt('Nom de la copie',CURP+' (copie)')||'').trim();if(!n||PROFS[n])return;PROFS[n]=clone(PROF);switchProf(n)};
  $('pfr').onclick=()=>{const n=(prompt('Nouveau nom',CURP)||'').trim();if(!n||n==CURP||PROFS[n])return;PROFS[n]=PROF;delete PROFS[CURP];CURP=n;saveProf();renderSet()};
  $('pfx').onclick=()=>{if(Object.keys(PROFS).length<2){toast('Il faut garder au moins un profil');return}if(!confirm('Supprimer le profil « '+CURP+' » ?'))return;delete PROFS[CURP];switchProf(Object.keys(PROFS)[0])};
  $('pfe').onclick=()=>{saveProf();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({beatdeck:5,name:CURP,profile:PROF,midi:MIDI.map},null,1)],{type:'application/json'}));a.download='beatdeck-'+CURP.replace(/[^\w-]+/g,'_')+'.json';a.click();toast('Profil exporté')};
  $('pfi').onclick=()=>$('pfif').click();
  $('pfif').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!j.profile||typeof j.profile!='object'||j.beatdeck!=5)throw 0;
    let n=j.name||'Importé',k=n;for(let i=2;PROFS[k];i++)k=n+' ('+i+')';PROFS[k]=j.profile;if(j.midi&&j.midi.phys&&confirm('Importer aussi la configuration MIDI de la platine ?')){MIDI.map=j.midi;saveMidi()}switchProf(k)}catch(x){toast('Fichier de profil invalide','err')}};
}
function initHeader(){
  $('au').onclick=()=>setAuto(!AUTO.on);
  $('stop').onclick=arretUrgence;
  QA('[data-pal]').forEach(b=>b.onclick=()=>{const id=b.dataset.pal;if($(id).hidden)openPanel(id);else $(id).hidden=true});
  $('bLib').onclick=()=>{if($('libm').hidden)openLib(null);else $('libm').hidden=true};
  $('bStudio').onclick=()=>openStudio();
  $('cb').onclick=()=>{const L=live(),a=D[L].cur,b=D[1-L].cur;if(a&&b&&itemById(a.id)&&itemById(b.id))openStudio('st_tr',a.id,b.id);else toast('Charge deux morceaux de ta liste pour ouvrir leur analyse')};
  $('fs').onclick=()=>{const e=document.documentElement;document.fullscreenElement?document.exitFullscreen():e.requestFullscreen&&e.requestFullscreen().then(()=>{try{screen.orientation.lock('landscape')}catch(x){}}).catch(()=>{})};
  QA('.pan').forEach(p=>{p.addEventListener('pointerdown',e=>{if(e.target===p&&p.id!='studio'&&p.id!='calib')p.hidden=true});QA('.x',p).forEach(x=>x.onclick=()=>{p.hidden=true;if(p.id=='studio')peStop()})});
  $('ld_').onclick=ouvrirDossier;$('la').onclick=()=>$('lf').click();
  $('lfd').onchange=$('lf').onchange=e=>addFiles([...e.target.files]);
  $('q').oninput=e=>{libQ=e.target.value;renderLib()};
  $('ll').onclick=libClick;$('dl').onclick=libClick;
}
let ip;addEventListener('beforeinstallprompt',e=>{e.preventDefault();ip=e;const b=$('inst');if(b)b.hidden=false});
let wl=null;const keep=async()=>{try{wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>wl=null)}catch(e){}};
addEventListener('pointerdown',()=>{AC.resume();if(!wl)keep()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'&&!wl)keep()});

async function boot(){
  if(!PROFS[CURP]){CURP=Object.keys(PROFS)[0]||'Mon profil';if(!PROFS[CURP])PROFS[CURP]=newProf()}
  useProf(PROFS[CURP]);saveProf();
  buildStage();initHeader();initTemps();initIA();initFx();initRc();initEditor();initSet();initProfils();stInit();initSugg();initPlus();
  $('inst').onclick=()=>ip&&ip.prompt();
  onDeckLoaded=i=>{if(!AUTO.on&&!D[1-i].cur&&recOf(D[i]))coach('Pour choisir le meilleur morceau suivant : IA → « Meilleurs morceaux pour celui qui joue »',0,8000);if(!$('sugg').hidden)renderSugg()};
  if(LS.get('bd5_cas',false))route(true);
  applyUI();addEventListener('resize',fit);addEventListener('orientationchange',()=>setTimeout(fit,300));document.addEventListener('fullscreenchange',()=>setTimeout(fit,300));
  mix();setAuto(false,true);requestAnimationFrame(frame);
  await chargerMeta();midiInit();relireDossier();renderLib();prepStatus();
  if(!LS.get('bd5_vu',0)){LS.set('bd5_vu',1);openLib(null)}
  if('serviceWorker' in navigator){let rl=0;const had=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!had||rl)return;if(D.some(d=>!d.a.paused)){toast('Nouvelle version prête : elle s\'appliquera au prochain lancement');return}rl=1;location.reload()});navigator.serviceWorker.register('beatdeck-sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{})}
}
boot();
