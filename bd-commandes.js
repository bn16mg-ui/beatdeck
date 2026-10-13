'use strict';
/* ===== BeatDeck 6 · les commandes qui marchent comme une platine normale =====
   LECTURE, VOLUME, VOL. GÉNÉRAL, CROSSFADER, AIGUS, GRAVES, FILTRE, MOLETTES, SHIFT, CHARGER.
   Tous les autres boutons sont des raccourcis (voir bd-raccourcis.js). */

const SHIFT={on:false,tenus:new Set()};
function setShift(id,on){if(on)SHIFT.tenus.add(id);else SHIFT.tenus.delete(id);const v=SHIFT.tenus.size>0;if(v!=SHIFT.on){SHIFT.on=v;document.body.classList.toggle('shift',v)}}

const pret=(d,msg)=>{if(!d.a.src){toast('Charge d\'abord un morceau sur le deck '+(d.i+1)+' (bouton CHARGER '+(d.i+1)+')');return false}if(msg&&!d.grid){toast(msg);return false}return true};

/* molette : petite accélération / ralentissement qui revient tout seul */
const NUDGE={};
function nudgeDe(d,dl){d.nudge=1+clamp(dl*.006,-.12,.12);applyRate(d);clearTimeout(NUDGE[d.i]);NUDGE[d.i]=setTimeout(()=>{d.nudge=1;applyRate(d)},110)}

/* --- fonctions normales, par commande --- */
const FN={};
function fn(id,base,shift){FN[id]={base,shift,normal:true}}
[0,1].forEach(i=>{
  const d=D[i];
  fn('play'+i,{nom:'LECTURE',desc:'Lance ou met en pause le morceau.',
    press(){if(!pret(d))return;if(d.a.paused&&!d.pend)playDeck(d);else{stopDeckJobs(i);pauseDeck(d)}},on:()=>!d.a.paused});
  fn('jog'+i,{nom:'MOLETTE',desc:'Pendant la lecture : accélère ou freine un instant pour recaler les temps. À l\'arrêt : avance ou recule dans le morceau.',
      delta(dl){if(!d.a.src)return;if(d.a.paused){killLoop(d);d.a.currentTime=clamp(d.a.currentTime+dl*.012,0,(d.a.duration||1)-.05)}else nudgeDe(d,dl)}},
    {nom:'RECHERCHE',desc:'Avance ou recule vite dans le morceau.',delta(dl){if(!d.a.src)return;killLoop(d);d.a.currentTime=clamp(d.a.currentTime+dl*.4,0,(d.a.duration||1)-.05)}});
  fn('flt'+i,{nom:'FILTRE',desc:'À gauche : son étouffé (on enlève les aigus). À droite : son fin (on enlève les graves). Au milieu : rien.',val(v){d.k.flt=v;applyDeck(d)}});
  fn('hi'+i,{nom:'AIGUS',desc:'Aigus du deck. Tout à gauche : coupés.',val(v){d.k.hi=v;applyDeck(d)}});
  fn('low'+i,{nom:'GRAVES',desc:'Graves du deck. Tout à gauche : coupés.',val(v){d.k.low=v;applyDeck(d)}});
  fn('vol'+i,{nom:'VOLUME',desc:'Volume du deck.',val(v){d.k.vol=v;mix()}});
  fn('shf'+i,{nom:'SHIFT',desc:'Maintiens-le pour utiliser les raccourcis écrits en jaune.',press:()=>setShift('shf'+i,true),release:()=>setShift('shf'+i,false),on:()=>SHIFT.on});
});
fn('brw',{nom:'PARCOURIR',desc:'Servira à naviguer dans ta bibliothèque (prochaine étape).',delta(){},press(){toast('La bibliothèque arrive à la prochaine étape')}});
fn('brwp',{nom:'PARCOURIR',desc:'Appui sur PARCOURIR.',press(){toast('La bibliothèque arrive à la prochaine étape')}});
fn('ld1',{nom:'CHARGER 1',desc:'Choisis une musique de ta tablette pour le deck 1 (en attendant la bibliothèque).',press:()=>choisirFichier(0)});
fn('ld2',{nom:'CHARGER 2',desc:'Choisis une musique de ta tablette pour le deck 2 (en attendant la bibliothèque).',press:()=>choisirFichier(1)});
fn('mg',{nom:'VOL. GÉNÉRAL',desc:'Volume de tout le mix.',val(v){G.mg=v;mix()}});
fn('xf',{nom:'CROSSFADER',desc:'À gauche : deck 1. À droite : deck 2. Au milieu : les deux.',val(v){G.xf=v;mix()}});

/* choix d'un fichier (temporaire, remplacé par la bibliothèque à l'étape 3) */
function choisirFichier(i){
  if(!D[i].a.paused){toast('Le deck '+(i+1)+' joue : mets-le en pause avant de charger');return}
  const inp=document.createElement('input');inp.type='file';inp.accept='audio/*';
  inp.onchange=()=>{const f=inp.files[0];if(f)chargerDeck(i,f)};inp.click();
}

/* --- aiguillage : une commande (écran ou platine) → sa fonction --- */
function fonctionDe(id){const F=FN[id];if(!F)return null;return SHIFT.on&&F.shift&&!/^shf/.test(id)?F.shift:F.base}
function commande(id,ev){
  AC.resume();
  if(typeof REAPP!='undefined'&&REAPP.attente){if(ev.t!='release')reapprendreChoisi(id);return}
  if(typeof EDITION!='undefined'&&EDITION.on){if(ev.t=='press'||ev.t=='value'||ev.t=='delta')editerCommande(id);return}
  if(typeof autoBloque=='function'&&autoBloque(id,ev))return;
  const F=FN[id];if(!F)return;
  // au relâchement, on prévient la fonction qui a reçu l'appui (même si SHIFT a été lâché entre-temps)
  if(ev.t=='release'){const f=F._appui||F.base;F._appui=null;if(f&&f.release)f.release();return}
  const f=fonctionDe(id);if(!f)return;
  try{
    if(ev.t=='press'){F._appui=f;if(f.press)f.press()}
    else if(ev.t=='value'){if(f.val){f.val(ev.v);VAL[id]=ev.v;dessiner(id)}}
    else if(ev.t=='delta'){if(f.delta)f.delta(ev.v)}
  }catch(e){console.error(e);toast('Action impossible : '+f.nom)}
}
