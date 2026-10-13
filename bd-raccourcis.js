'use strict';
/* ===== BeatDeck 6 · les raccourcis =====
   1 appui = une technique complète de DJ, lancée pile sur le temps, puis tout revient à la normale.
   Les techniques viennent de ton guide : Écho Out, Échange des basses (EQ Swap), Mix long, Filtre,
   Coupure nette, Boucle Out, Roulement, Écho, Réverb, Flanger, Riser.
   Un 2e appui sur un raccourci en cours l'arrête. MASTER (par défaut) arrête tous les effets. */

/* ---------- automatismes interruptibles ---------- */
const JOBS=new Set();
class Job{
  constructor(cle,decks){this.cle=cle;this.decks=decks;this.tm=[];this.fin=[];this.mort=false;JOBS.add(this)}
  later(f,ms){const id=setTimeout(()=>{if(!this.mort)try{f()}catch(e){console.error(e);this.stop()}},Math.max(0,ms||0));this.tm.push(id);return id}
  every(f,ms){const id=setInterval(()=>{if(this.mort){clearInterval(id);return}try{f()}catch(e){console.error(e);this.stop()}},ms);this.tm.push(id);return id}
  onStop(f){this.fin.push(f);return this}
  _fermer(){if(this.mort)return false;this.mort=true;this.tm.forEach(id=>{clearTimeout(id);clearInterval(id)});JOBS.delete(this);return true}
  end(){this._fermer()}                                            // fini normalement
  stop(){if(this._fermer())this.fin.forEach(f=>{try{f()}catch(e){console.error(e)}})}  // interrompu : on remet tout en place
}
const jobDe=cle=>[...JOBS].find(j=>j.cle==cle)||null;
function stopDeckJobs(i){[...JOBS].filter(j=>j.decks.includes(i)).forEach(j=>j.stop())}
function stopTout(){
  [...JOBS].forEach(j=>j.stop());
  D.forEach(d=>{if(d.lp)loopOff(d);echoSet(d,false);revSet(d,false);flangerSet(d,false);d.ov={};agReset(d);d.nudge=1;d.a.preservesPitch=true;applyRate(d);applyDeck(d)});
  toast('Tous les effets sont arrêtés');
}

/* ---------- outils communs ---------- */
// qui sort (X) et qui entre (O) : le deck qui joue sort ; si on appuie sur le deck à l'arrêt, c'est lui qui entre
function roles(d){const o=D[1-d.i];if(!d.a.paused)return{X:d,O:o};if(!o.a.paused)return{X:o,O:d};return null}
const tempoProche=(X,O)=>O.grid&&X.grid&&Math.abs(foldR(X.bpm*rateOf(X),O.bpm)-1)<=.08;
// prépare le morceau qui entre : même tempo si c'est proche, départ sur un début de mesure
function preparerEntree(O,X){
  if(!O.a.src||!O.a.paused)return false;const proche=tempoProche(X,O);
  if(proche){O.rate=foldR(O.bpm,X.bpm*rateOf(X)/(X.nudge||1));applyRate(O);const bar=4*beatLen(O);O.a.currentTime=Math.max(0,O.off+Math.round((O.a.currentTime-O.off)/bar)*bar)}
  return proche;
}
function lancerA(O,job,sec,proche){if(!O.a.paused)return;job.later(()=>{O.a.play().catch(()=>{});if(proche)O.syncLock=true},sec*1000-15)}
// déplace le crossfader en douceur (l'écran suit)
function xfVers(v,sec,job){const v0=G.xf,t0=performance.now(),ms=Math.max(30,sec*1000);
  const id=job.every(()=>{const k=clamp((performance.now()-t0)/ms);G.xf=v0+(v-v0)*k;VAL.xf=G.xf;mix();dessiner('xf');if(k>=1)clearInterval(id)},30)}
// fait varier un réglage temporaire (ov) d'un deck
function ovVers(d,cle,de,a,sec,job){const t0=performance.now(),ms=Math.max(30,sec*1000);
  const id=job.every(()=>{const k=clamp((performance.now()-t0)/ms);d.ov[cle]=de+(a-de)*k;applyDeck(d);if(k>=1)clearInterval(id)},30)}
function sortir(X,job){pauseDeck(X);if(X.lp)killLoop(X);delete X.ov.low;delete X.ov.flt;applyDeck(X);agReset(X)}
const cote=O=>O.i?1:0;

/* ---------- le catalogue des raccourcis ---------- */
const CAT={};
function rc(cle,groupe,nom,titre,desc,o){CAT[cle]=Object.assign({cle,groupe,nom,titre,desc},o)}
const enCours=(cle,d)=>!!jobDe(cle+':'+d.i);
// raccourci de transition : on l'annule si on rappuie pendant qu'il tourne
function transition(cle,d,f){
  const j0=[...JOBS].find(j=>j.cle.startsWith(cle+':'));if(j0){j0.stop();toast(CAT[cle].titre+' annulé');return}
  const r=roles(d);if(!r){toast('Lance d\'abord un morceau');return}
  f(r.X,r.O);
}

/* — transitions —
   TECH[cle](X, O, w, o) : X sort, O entre ; la technique démarre dans w secondes.
   o.entry = endroit du morceau O où il démarre (préparé dans le duo) ; o.silence = pas de message. */
const TECH={};
const entree=(O,X,o)=>{if(o.entry!=null&&O.a.src&&O.a.paused){killLoop(O);O.a.currentTime=Math.max(0,o.entry)}return preparerEntree(O,X)};
TECH.echo_out=(X,O,w,o={})=>{
  const j=new Job('echo_out:'+X.i,[X.i,O.i]),b=wallBeat(X),entre=!!O.a.src,proche=entree(O,X,o);
  j.onStop(()=>{echoSet(X,false);agReset(X)});
  j.later(()=>echoSet(X,true),w*1000);
  j.later(()=>{agVers(X,0,0,.03);echoSet(X,false);if(entre){G.xf=cote(O);VAL.xf=G.xf;mix();dessiner('xf')}},(w+2*b)*1000);
  if(entre)lancerA(O,j,w+2*b,proche);
  j.later(()=>{sortir(X);j.end()},(w+2*b+4)*1000);
  if(!o.silence)toast('Écho Out au prochain temps'+(entre?' → le deck '+(O.i+1)+' entre':''));
  return j;
};
const blendTech=(cle,N)=>(X,O,w,o={})=>{
  if(!O.a.src){if(!o.silence)toast('Charge un morceau sur l\'autre deck d\'abord');return null}
  if(!O.a.paused){if(!o.silence)toast('Les deux decks jouent déjà : mets celui qui doit entrer en pause, à l\'endroit où il doit démarrer');return null}
  if(!tempoProche(X,O)){if(!o.silence)toast('Tempos trop différents pour mélanger longtemps : utilise ÉCHO OUT ou COUPURE NETTE');return null}
  const j=new Job(cle+':'+X.i,[X.i,O.i]),b=wallBeat(X),proche=entree(O,X,o);
  O.ov.low=0;applyDeck(O);
  j.onStop(()=>{delete O.ov.low;applyDeck(O);delete X.ov.low;applyDeck(X)});
  lancerA(O,j,w,proche);
  j.later(()=>xfVers(.5,N/2*b,j),w*1000);                                        // 1re moitié : le nouveau monte, sans ses graves
  j.later(()=>{ovVers(X,'low',X.k.low,0,b,j);ovVers(O,'low',0,O.k.low,b,j)},(w+N/2*b-b/2)*1000);  // milieu : on échange les graves
  j.later(()=>{delete O.ov.low;applyDeck(O);xfVers(cote(O),N/2*b,j)},(w+N/2*b+b)*1000);       // 2e moitié : l'ancien s'efface
  j.later(()=>{sortir(X);j.end()},(w+N*b+b*1.5)*1000);
  if(!o.silence)toast(CAT[cle].titre+' : départ à la prochaine mesure ('+N+' temps)');
  return j;
};
TECH.eq_swap=blendTech('eq_swap',16);
TECH.mix_long=blendTech('mix_long',32);
TECH.filtre_out=(X,O,w,o={})=>{
  const j=new Job('filtre_out:'+X.i,[X.i,O.i]),b=wallBeat(X),entre=!!O.a.src&&O.a.paused,proche=entre&&entree(O,X,o);
  j.onStop(()=>{delete X.ov.flt;applyDeck(X);delete O.ov.flt;applyDeck(O)});
  j.later(()=>{ovVers(X,'flt',X.k.flt,.06,8*b,j);if(entre){O.ov.flt=.8;applyDeck(O);ovVers(O,'flt',.8,O.k.flt,8*b,j);xfVers(cote(O),8*b,j)}else agVers(X,0,0,8*b)},w*1000);
  if(entre)lancerA(O,j,w,proche);
  j.later(()=>{delete O.ov.flt;applyDeck(O);sortir(X);j.end()},(w+8*b+.1)*1000);
  if(!o.silence)toast('Filtre de sortie à la prochaine mesure'+(entre?' → le deck '+(O.i+1)+' entre':''));
  return j;
};
TECH.coupure=(X,O,w,o={})=>{
  if(!O.a.src){if(!o.silence)toast('Charge un morceau sur l\'autre deck d\'abord');return null}
  const j=new Job('coupure:'+X.i,[X.i,O.i]),proche=O.a.paused&&entree(O,X,o);
  if(o.riser)j.later(()=>{const s=riser(8*wallBeat(X));j.onStop(()=>{try{s.stop()}catch(e){}})},Math.max(0,(w-8*wallBeat(X))*1000));
  lancerA(O,j,w,proche);
  j.later(()=>{G.xf=cote(O);VAL.xf=G.xf;mix();dessiner('xf');sortir(X);j.end()},w*1000);
  if(!o.silence)toast('Coupure nette à la prochaine mesure');
  return j;
};
TECH.boucle_out=(X,O,w,o={})=>{
  if(!X.grid){if(!o.silence)toast('Tempo non détecté : boucle impossible');return null}
  const j=new Job('boucle_out:'+X.i,[X.i,O.i]),b=wallBeat(X),B=beatLen(X),entre=!!O.a.src&&O.a.paused,proche=entre&&entree(O,X,o);
  const s=posOf(X)+w*rateOf(X);let t=w;
  j.onStop(()=>{if(X.lp)loopOff(X)});
  [4,2,1,.5,.5].forEach(n=>{j.later(()=>loopOn(X,n*B,{start:s}),t*1000);t+=n*b});
  if(o.riser)j.later(()=>{const r=riser(8*b);j.onStop(()=>{try{r.stop()}catch(e){}})},w*1000);
  if(entre){lancerA(O,j,t,proche);j.later(()=>{G.xf=cote(O);VAL.xf=G.xf;mix();dessiner('xf');sortir(X);j.end()},t*1000)}
  else j.later(()=>{loopOff(X);j.end()},t*1000);
  if(!o.silence)toast('Boucle Out'+(entre?' → le deck '+(O.i+1)+' entre à la fin':''));
  return j;
};
TECH.frein=(X,O,w,o={})=>{
  const j=new Job('frein:'+X.i,[X.i,O.i]),dur=Math.max(.5,wallBeat(X)*2),entre=!!O.a.src&&O.a.paused,proche=entre&&entree(O,X,o);
  const fin=()=>{X.nudge=1;X.a.preservesPitch=true;applyRate(X)};j.onStop(fin);
  j.later(()=>{X.a.preservesPitch=false;const t0=performance.now(),id=j.every(()=>{const k=clamp((performance.now()-t0)/(dur*1000));X.nudge=Math.max(.06,1-k);applyRate(X);if(k>=1)clearInterval(id)},25)},w*1000);
  if(entre){lancerA(O,j,w+dur,proche);j.later(()=>{G.xf=cote(O);VAL.xf=G.xf;mix();dessiner('xf')},(w+dur)*1000)}
  j.later(()=>{sortir(X);fin();j.end()},(w+dur)*1000);
  return j;
};
// quand tu appuies sur un raccourci de transition : départ au prochain temps ou à la prochaine mesure
const QUAND={echo_out:attTemps,boucle_out:attTemps,frein:attTemps,eq_swap:attMesure,mix_long:attMesure,filtre_out:attMesure,coupure:attMesure};
const runTrans=cle=>({run(d){transition(cle,d,(X,O)=>TECH[cle](X,O,QUAND[cle](X)))},on:()=>[...JOBS].some(j=>j.cle.startsWith(cle+':'))});
rc('echo_out','Transitions','ÉCHO OUT','Écho Out',
  'Au prochain temps, écho sur le morceau qui joue pendant 2 temps, puis il s\'arrête et laisse traîner l\'écho. Le morceau de l\'autre deck entre pile à ce moment-là (s\'il est chargé). Marche même si les tempos sont très différents.',runTrans('echo_out'));
rc('eq_swap','Transitions','ÉCH. BASSES','Échange des basses (EQ Swap) · 16 temps',
  'Le morceau de l\'autre deck entre calé sur le tempo, sans ses graves. Au milieu, les graves s\'échangent d\'un coup sur le temps, puis l\'ancien morceau s\'efface. Idéal en house, afro, dance quand les tempos sont proches.',runTrans('eq_swap'));
rc('mix_long','Transitions','MIX LONG','Mix long (Beatmix) · 32 temps',
  'Même principe que l\'échange des basses mais sur 32 temps : les deux morceaux restent superposés plus longtemps. Pour un passage très fluide entre deux morceaux qui vont bien ensemble.',runTrans('mix_long'));
rc('filtre_out','Transitions','FILTRE OUT','Filtre de sortie · 8 temps',
  'Le morceau qui joue s\'étouffe petit à petit (filtre) pendant 8 temps pendant que l\'autre entre avec un son fin qui s\'ouvre. Utile pour changer d\'ambiance en douceur.',runTrans('filtre_out'));
rc('coupure','Transitions','COUPURE','Coupure nette (Hard Cut)',
  'À la prochaine mesure, on passe d\'un coup sur l\'autre deck : l\'ancien s\'arrête, le nouveau démarre. Efficace en rap, hip-hop et pour lancer un refrain connu.',runTrans('coupure'));
rc('boucle_out','Transitions','BOUCLE OUT','Boucle Out · 8 temps',
  'Le morceau qui joue répète une boucle qui raccourcit (4, 2, 1, ½ temps) pour créer l\'attente, puis le morceau de l\'autre deck explose sur le temps.',runTrans('boucle_out'));
rc('frein','Transitions','FREIN','Frein vinyle',
  'Le morceau qui joue ralentit jusqu\'à l\'arrêt comme un vinyle qu\'on freine, puis le morceau de l\'autre deck démarre (s\'il est chargé).',runTrans('frein'));

/* — effets sur le deck du bouton — */
const surCeDeck=(d,f)=>{if(!pret(d))return;f()};
rc('echo','Effets','ÉCHO','Écho',
  'Écho calé sur le tempo (¾ de temps). Appuie pour l\'activer, rappuie pour le couper : la traîne s\'éteint toute seule.',
  {run:d=>surCeDeck(d,()=>echoSet(d,!d.echoOn)),on:d=>d.echoOn});
rc('reverb','Effets','RÉVERB','Réverb',
  'Ajoute de l\'espace et de la résonance. À utiliser avec mesure, surtout sur une fin de voix. Rappuie pour couper.',
  {run:d=>surCeDeck(d,()=>revSet(d,!d.revOn)),on:d=>d.revOn});
rc('flanger','Effets','FLANGER','Flanger',
  'Balayage métallique. À réserver à des moments précis pour ne pas surcharger le mix. Rappuie pour couper.',
  {run:d=>surCeDeck(d,()=>flangerSet(d,!d.flangerOn)),on:d=>d.flangerOn});
rc('filtre_monte','Effets','FILTRE ↑','Filtre montant · 8 temps',
  'Le son devient de plus en plus fin pendant 8 temps (on enlève les graves), puis revient d\'un coup sur le temps : crée de la tension avant un refrain ou un drop.',
  {run(d){surCeDeck(d,()=>{const k='filtre_monte:'+d.i,j0=jobDe(k);if(j0){j0.stop();return}if(d.a.paused){toast('Lance le morceau d\'abord');return}
    const j=new Job(k,[d.i]),w=attTemps(d),b=wallBeat(d);j.onStop(()=>{delete d.ov.flt;applyDeck(d)});
    j.later(()=>ovVers(d,'flt',d.k.flt,.93,8*b,j),w*1000);j.later(()=>{delete d.ov.flt;applyDeck(d);j.end()},(w+8*b)*1000)})},on:d=>enCours('filtre_monte',d)});
rc('riser','Effets','RISER','Riser · 8 temps',
  'Montée de bruit pendant 8 temps qui s\'arrête pile sur le temps : prépare l\'arrivée d\'un drop ou d\'un morceau plus énergique.',
  {run(d){surCeDeck(d,()=>{if(d.a.paused){toast('Lance le morceau d\'abord');return}const k='riser:'+d.i;if(jobDe(k))return;const j=new Job(k,[d.i]),w=attTemps(d),sec=8*wallBeat(d),s=riser(sec,w);
    j.onStop(()=>{try{s.stop()}catch(e){}});j.later(()=>j.end(),(w+sec)*1000)})},on:d=>enCours('riser',d)});
rc('roulement','Effets','ROULEMENT','Roulement (Loop Roll)',
  'Répète un demi-temps tant que tu gardes le doigt dessus. Au relâchement, le morceau reprend là où il en serait, sans décalage.',
  {run(d){if(!pret(d,'Tempo non détecté'))return;if(d.a.paused||d.lp)return;loopOn(d,beatLen(d)/2,{slip:true})},up(d){if(d.lp&&d.lp.slip)loopOff(d)},on:d=>!!(d.lp&&d.lp.slip)});
rc('boucle4','Effets','BOUCLE 4','Boucle de 4 temps',
  'Boucle de 4 temps qui démarre pile sur le temps. Rappuie pour sortir de la boucle.',
  {run(d){if(!pret(d,'Tempo non détecté : boucle impossible'))return;if(d.lp){loopOff(d);return}if(d.a.paused){toast('Lance le morceau d\'abord');return}loopOn(d,4*beatLen(d))},on:d=>!!(d.lp&&!d.lp.slip)});

/* — outils — */
rc('sync','Outils','SYNC','Synchroniser',
  'Met ce deck au même tempo que l\'autre et aligne les temps. Rappuie pour désactiver.',
  {run(d){if(!pret(d,'Tempo non détecté sur ce morceau'))return;const o=D[1-d.i];
    if(d.syncLock){d.syncLock=false;toast('SYNC désactivé sur le deck '+(d.i+1));return}
    if(!o.a.src||!o.grid){toast('Charge un morceau sur l\'autre deck pour synchroniser');return}
    match(d,o);phaseAlign(d,o);d.syncLock=true;o.syncLock=false;toast('Deck '+(d.i+1)+' calé : '+nf(d.bpm*rateOf(d),1)+' BPM')},on:d=>d.syncLock});
const repere=k=>({run(d){if(!pret(d))return;if(d.hc[k]==null){d.hc[k]=d.grid?Math.max(0,snapBeat(d,heard(d))):heard(d);toast('Repère '+(k+1)+' posé à '+fmt(d.hc[k]));return}killLoop(d);d.a.currentTime=d.hc[k]},on:d=>d.hc[k]!=null});
rc('repere1','Outils','REPÈRE 1','Repère 1',
  '1er appui : pose un repère à l\'endroit que tu entends (calé sur le temps), par exemple au début du refrain. Ensuite : saute directement à ce repère.',repere(0));
rc('repere2','Outils','REPÈRE 2','Repère 2','Comme le repère 1, pour un 2e endroit du morceau.',repere(1));
rc('efface_rep','Outils','EFFACER REP.','Effacer les repères','Efface les repères 1 et 2 de ce deck.',{run(d){d.hc=[null,null];toast('Repères du deck '+(d.i+1)+' effacés')}});
rc('debut','Outils','DÉBUT','Retour au début','Revient au tout début du morceau.',{run(d){if(!pret(d))return;killLoop(d);d.a.currentTime=0}});
rc('stop_fx','Outils','STOP EFFETS','Arrêter tous les effets','Arrête d\'un coup tous les raccourcis et effets en cours, et remet le son normal. La musique continue.',{run:()=>stopTout()});

/* ---------- quels raccourcis sur quels boutons ---------- */
const RACC_IDS=['cue','sync','vin','cas','fx','lpa','lpp','lpm','tmpm','tmpp'];
const estRaccourci=id=>id=='mst'||RACC_IDS.some(r=>id==r+'0'||id==r+'1');
const CONSEIL={cue:['echo_out','coupure'],sync:['sync',''],vin:['eq_swap','mix_long'],cas:['filtre_out','frein'],fx:['echo','reverb'],
  lpa:['boucle4','boucle_out'],lpp:['roulement','riser'],lpm:['filtre_monte','flanger'],tmpm:['repere1','efface_rep'],tmpp:['repere2','debut'],mst:['stop_fx','']};
let RACC=LS.get('bd6_racc',null);
function racc(id){const r=RACC&&RACC[id];if(r)return r;const c=CONSEIL[id.replace(/[01]$/,'')];return c?{base:c[0],shift:c[1]}:{base:'',shift:''}}
function fnRaccourci(cle,deck){const c=CAT[cle];if(!c)return null;const dk=()=>D[deck==null?live():deck];
  return{nom:c.nom,desc:c.desc,raccourci:true,press:()=>c.run(dk()),release:c.up?()=>c.up(dk()):null,on:c.on?()=>c.on(dk()):null}}
function construireRaccourcis(){
  for(const p of PHYS){if(!estRaccourci(p.id))continue;const r=racc(p.id);
    FN[p.id]={base:fnRaccourci(r.base,p.deck)||{nom:'—',desc:'Aucun raccourci sur ce bouton.'},shift:fnRaccourci(r.shift,p.deck)}}
}
construireRaccourcis();

/* ---------- choisir soi-même ses raccourcis ---------- */
const EDITION={on:false,id:null,couche:'base',deux:true};
function setEdition(on){EDITION.on=on;document.body.classList.toggle('edition',on);$('bEd').classList.toggle('on',on);
  if(on)toast('Touche le bouton (à l\'écran ou sur ta platine) dont tu veux changer le raccourci');else $('rpan').hidden=true}
function editerCommande(id){
  if(id=='brwp')id='brw';
  if(!estRaccourci(id)){toast('« '+(FN[id]&&FN[id].base?FN[id].base.nom:PH[id].txt)+' » reste une commande normale');return}
  EDITION.id=id;EDITION.couche='base';QA('[data-ph].edsel').forEach(e=>e.classList.remove('edsel'));const el=Q('[data-ph="'+id+'"]');if(el)el.classList.add('edsel');
  $('rpan').hidden=false;rendreEditeur();
}
const miroir=id=>/[01]$/.test(id)?id.slice(0,-1)+(id.endsWith('0')?'1':'0'):null;
function rendreEditeur(){
  const id=EDITION.id,p=PH[id],r=racc(id),cur=r[EDITION.couche];
  $('rT').textContent=p.nom;
  QA('#rTabs button').forEach(b=>b.classList.toggle('on',b.dataset.c==EDITION.couche));
  $('rCur').innerHTML='Appui normal : <b>'+esc(CAT[r.base]?CAT[r.base].titre:'aucun')+'</b><br>Avec SHIFT : <b>'+esc(CAT[r.shift]?CAT[r.shift].titre:'aucun')+'</b>';
  $('rDeux').checked=EDITION.deux;$('rDeuxL').hidden=!miroir(id);
  const G={};Object.values(CAT).forEach(c=>(G[c.groupe]=G[c.groupe]||[]).push(c));
  $('rL').innerHTML=Object.keys(G).map(g=>'<h3>'+g+'</h3>'+G[g].map(c=>`<button class="rItem${c.cle==cur?' sel':''}" data-k="${c.cle}"><b>${esc(c.titre)}</b><small>${esc(c.desc)}</small></button>`).join('')).join('')
    +`<h3>Rien</h3><button class="rItem${!cur?' sel':''}" data-k=""><b>Aucun raccourci</b><small>Ce bouton ne fera rien${EDITION.couche=='shift'?' avec SHIFT':''}.</small></button>`;
}
function choisirRaccourci(cle){
  const id=EDITION.id;RACC=RACC||{};
  const poser=x=>{const r=Object.assign({},racc(x));r[EDITION.couche]=cle;RACC[x]=r};
  poser(id);if(EDITION.deux&&miroir(id))poser(miroir(id));
  LS.set('bd6_racc',RACC);construireRaccourcis();etiquettes();rendreEditeur();
  toast((CAT[cle]?CAT[cle].titre:'Aucun raccourci')+(EDITION.couche=='shift'?' (avec SHIFT)':'')+' → '+PH[id].txt+(EDITION.deux&&miroir(id)?' (les deux decks)':''));
}
function initRaccourcis(){
  $('bEd').onclick=()=>setEdition(!EDITION.on);
  $('rTabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;EDITION.couche=b.dataset.c;rendreEditeur()};
  $('rL').onclick=e=>{const b=e.target.closest('[data-k]');if(b)choisirRaccourci(b.dataset.k)};
  $('rDeux').onchange=e=>{EDITION.deux=e.target.checked};
  $('rFin').onclick=()=>setEdition(false);
  $('rReset').onclick=()=>{if(!confirm('Remettre les raccourcis conseillés sur tous les boutons ?'))return;RACC=null;LS.set('bd6_racc',null);construireRaccourcis();etiquettes();if(EDITION.id)rendreEditeur();toast('Raccourcis conseillés remis')};
  $('rpan').addEventListener('pointerdown',e=>{if(e.target.id=='rpan')$('rpan').hidden=true});
}
