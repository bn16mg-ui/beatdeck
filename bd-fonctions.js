'use strict';
/* ===== BeatDeck 5 · catalogue des fonctions =====
   Une fonction ne dépend jamais de la commande physique qui la déclenche :
   n'importe quelle commande compatible peut recevoir n'importe quelle fonction. */
const CAT={},CATS=[];
const K={b:'Bouton',m:'Maintenu',c:'Réglage continu',r:'Rotation'};
/* paramètres : [clé, nom, défaut, options]  options = {o:[[valeur,libellé],…]} ou {min,max,pas,u} */
const TEMPS=[[.125,'1/8 de temps'],[.25,'1/4 de temps'],[.5,'1/2 temps'],[1,'1 temps'],[2,'2 temps'],[4,'4 temps (1 mesure)'],[8,'8 temps'],[16,'16 temps'],[32,'32 temps']];
const OUINON=[[1,'Oui'],[0,'Non']];
function F(cat,id,nom,court,k,desc,p,impl){const f=Object.assign({id,cat,nom,court,k,desc,p:p||[]},impl);CAT[id]=f;let c=CATS.find(x=>x.n==cat);if(!c)CATS.push(c={n:cat,l:[]});c.l.push(f);return f}
const par=(f,b)=>{const o={};(f.p||[]).forEach(([k,,v])=>o[k]=v);return Object.assign(o,(b&&b.p)||{})};
const deckReady=(d,msg)=>{if(!d.a.src){toast('Aucun morceau sur le deck '+(d.i+1));return false}if(msg&&d.a.paused){toast('Lance le deck '+(d.i+1)+' d\'abord');return false}return true};
const durMs=(d,p)=>(p.unite=='sec'?p.duree:p.duree*wallBeat(d))*1000;

/* ---------- Lecture ---------- */
F('Lecture','lecture','Lecture / pause','LECTURE','b','Lance ou arrête le morceau.',[],{
  run:c=>{if(c.d.a.paused&&!c.d.pend)playDeck(c.d);else pauseDeck(c.d)},on:c=>!c.d.a.paused});
F('Lecture','pause','Pause seulement','PAUSE','b','Arrête le morceau (ne relance jamais).',[],{run:c=>pauseDeck(c.d)});
F('Lecture','cue','Repère (CUE)','CUE','b','En lecture : arrête et revient au repère. À l\'arrêt : pose le repère à cet endroit.',[],{
  run:c=>{const d=c.d;if(!deckReady(d))return;if(!d.a.paused){pauseDeck(d);d.a.currentTime=d.cue}else{d.cue=d.grid?Math.max(0,snapBeat(d,d.a.currentTime)):d.a.currentTime;d.a.currentTime=d.cue;toast('Repère posé à '+fmt(d.cue))}}});
F('Lecture','debut','Retour au début','DÉBUT','b','Revient au premier temps du morceau.',[],{run:c=>{if(deckReady(c.d))c.d.a.currentTime=c.d.grid?Math.max(0,c.d.off):0}});
[0,1,2].forEach(k=>F('Lecture','hc'+(k+1),'Repère rapide '+(k+1)+' (hot cue)','REPÈRE '+(k+1),'b','Premier appui : pose le repère. Ensuite : saute dessus. Les repères 1 et 2 sont placés automatiquement sur les drops, le 3 sur la fin de phrase.',[],{
  run:c=>{const d=c.d;if(!deckReady(d))return;if(d.hc[k]==null){d.hc[k]=d.grid?Math.max(0,snapBeat(d,heard(d))):d.a.currentTime;toast('Repère '+(k+1)+' posé à '+fmt(d.hc[k]))}else{if(d.lp)killLoop(d);d.a.currentTime=d.hc[k]}},on:c=>c.d.hc[k]!=null}));
F('Lecture','hc_eff','Effacer les repères rapides','EFFACER','b','Efface les 3 repères rapides du deck.',[],{run:c=>{c.d.hc=[null,null,null];toast('Repères effacés')}});
F('Lecture','sauter','Saut en avant / en arrière','SAUT','b','Saute d\'un nombre de temps, en restant calé.',[['n','Saut',8,{o:[[-32,'−32 temps'],[-16,'−16 temps'],[-8,'−8 temps'],[-4,'−4 temps'],[-1,'−1 temps'],[1,'+1 temps'],[4,'+4 temps'],[8,'+8 temps'],[16,'+16 temps'],[32,'+32 temps']]}]],{
  run:c=>{const d=c.d;if(!deckReady(d)||!d.grid)return;if(d.lp)killLoop(d);d.a.currentTime=clamp(d.a.currentTime+c.p.n*beatLen(d),0,(d.a.duration||1)-3)}});

/* ---------- Tempo ---------- */
F('Tempo','sync','Synchroniser (SYNC)','SYNC','b','Cale le tempo sur l\'autre deck, aligne les temps et garde la synchro. Appuie encore pour la couper.',[],{
  run:c=>{const d=c.d,o=D[1-c.i];if(d.syncLock){d.syncLock=false;toast('Synchro coupée');return}
    if(!d.grid||!o.grid){toast('Tempo non détecté sur un des deux decks','err');return}match(d,o);phaseAlign(d,o);d.syncLock=true;toast('Deck '+(c.i+1)+' synchronisé')},on:c=>c.d.syncLock});
F('Tempo','caler','Caler sur les temps de l\'autre deck','CALER','b','Réaligne les temps sans changer le tempo (quand les kicks se décalent).',[],{run:c=>{if(!phaseAlign(c.d,D[1-c.i]))toast('Il faut deux morceaux qui jouent')}});
F('Tempo','tempo_p','Tempo +','TEMPO +','b','Accélère le morceau.',[['pas','Pas',.5,{o:[[.1,'0,1 %'],[.5,'0,5 %'],[1,'1 %'],[2,'2 %']]}]],{run:c=>{c.d.syncLock=false;c.d.rate=clamp(c.d.rate+c.p.pas/100,.5,2);applyRate(c.d)}});
F('Tempo','tempo_m','Tempo −','TEMPO −','b','Ralentit le morceau.',[['pas','Pas',.5,{o:[[.1,'0,1 %'],[.5,'0,5 %'],[1,'1 %'],[2,'2 %']]}]],{run:c=>{c.d.syncLock=false;c.d.rate=clamp(c.d.rate-c.p.pas/100,.5,2);applyRate(c.d)}});
F('Tempo','tempo_0','Tempo d\'origine','TEMPO 0','b','Remet la vitesse d\'origine du morceau.',[],{run:c=>{c.d.syncLock=false;c.d.rate=1;applyRate(c.d)}});
F('Tempo','bend_p','Accélérer tant que maintenu','POUSSER +','m','Rattrape l\'autre morceau à l\'oreille.',[['force','Force',4,{o:[[1,'1 %'],[2,'2 %'],[4,'4 %'],[8,'8 %']]}]],{run:c=>{c.d.nudge=1+c.p.force/100;applyRate(c.d)},up:c=>{c.d.nudge=1;applyRate(c.d)}});
F('Tempo','bend_m','Ralentir tant que maintenu','FREINER −','m','Laisse l\'autre morceau rattraper.',[['force','Force',4,{o:[[1,'1 %'],[2,'2 %'],[4,'4 %'],[8,'8 %']]}]],{run:c=>{c.d.nudge=1-c.p.force/100;applyRate(c.d)},up:c=>{c.d.nudge=1;applyRate(c.d)}});
F('Tempo','tonalite','Garder la tonalité (on / off)','TONALITÉ','b','Allumé : la voix ne change pas de hauteur quand le tempo change. Éteint : le son monte ou descend comme un vinyle.',[],{
  run:c=>{c.d.keylock=!c.d.keylock;c.d.a.preservesPitch=c.d.keylock;toast(c.d.keylock?'Tonalité gardée':'Tonalité libre (comme un vinyle)')},on:c=>c.d.keylock});

/* ---------- Boucles ---------- */
F('Boucles','boucle','Boucle (on / off)','BOUCLE','b','Boucle calée sur les temps, de la longueur choisie avec Boucle ×2 et ÷2 (4 temps au départ).',[],{
  run:c=>{const d=c.d;if(d.lp){loopOff(d);return}if(!deckReady(d,1))return;if(loopOn(d,(d.grid?d.loopLen:d.loopLen*.5)*beatLen(d)))toast('Boucle de '+lenTxt(d.loopLen))},on:c=>!!c.d.lp});
const lenTxt=n=>n<1?'1/'+Math.round(1/n)+' temps':n+(n>1?' temps':' temps');
F('Boucles','boucle_x2','Boucle ×2 (plus longue)','BOUCLE ×2','b','Double la longueur de la boucle.',[],{run:c=>{const d=c.d;d.loopLen=Math.min(32,d.loopLen*2);if(d.lp)loopOn(d,d.loopLen*beatLen(d),{start:d.lp.s});toast('Boucle : '+lenTxt(d.loopLen))}});
F('Boucles','boucle_d2','Boucle ÷2 (plus courte)','BOUCLE ÷2','b','Divise la boucle par deux.',[],{run:c=>{const d=c.d;d.loopLen=Math.max(1/8,d.loopLen/2);if(d.lp)loopOn(d,d.loopLen*beatLen(d),{start:d.lp.s});toast('Boucle : '+lenTxt(d.loopLen))}});
F('Boucles','boucle_sortir','Sortir de la boucle','SORTIR','b','Sort de la boucle et reprend le morceau.',[],{run:c=>loopOff(c.d)});
F('Boucles','boucle_m','Boucle tant que maintenu','BOUCLE ⟳','m','Boucle pendant que tu tiens la touche ; au relâchement, le morceau reprend là où il serait arrivé.',[['temps','Longueur',1,{o:TEMPS}]],{
  run:c=>{if(deckReady(c.d,1))loopOn(c.d,c.p.temps*beatLen(c.d),{slip:true,start:gridStart(c.d,c.p.temps)})},up:c=>loopOff(c.d)});
function gridStart(d,beats){const h=heard(d);if(!d.grid)return h;const L=beats*beatLen(d);return d.off+Math.floor((h-d.off)/L)*L}

/* ---------- Effets rythmiques ---------- */
F('Effets rythmiques','begaiement','Bégaiement (stutter)','BÉGAIEMENT','m','Répète un tout petit morceau du son en boucle. Durée réglable en temps ou en secondes ; « tant que maintenu » ou durée fixe.',[
  ['unite','Unité','temps',{o:[['temps','Temps musicaux'],['sec','Secondes']]}],['longueur','Longueur répétée',.5,{min:.05,max:4,pas:.05,u:'(temps ou s)'}],['duree','Durée de l\'effet',0,{o:[[0,'Tant que maintenu'],[1,'1 temps'],[2,'2 temps'],[4,'1 mesure'],[8,'2 mesures']]}]],{
  run:c=>{const d=c.d,p=c.p;if(!deckReady(d,1))return;
    const len=p.unite=='sec'?p.longueur*rateOf(d):p.longueur*beatLen(d),s=p.unite=='sec'||!d.grid?heard(d)-len:gridStart(d,p.longueur);
    if(!loopOn(d,len,{slip:true,start:Math.max(0,s)}))return;
    const j=new Job('Bégaiement',{cle:'rythme'+c.i,deck:c.i});j.onStop(()=>{if(d.lp)loopOff(d)});
    if(p.duree>0)j.later(()=>j.end(),p.duree*wallBeat(d)*1000)},
  up:c=>{if(!c.p.duree){const j=jobActif('rythme'+c.i);if(j)j.end()}}});
F('Effets rythmiques','repetition','Répétition rythmique (beat repeat)','RÉPÉTITION','b','Répète le dernier passage plusieurs fois, puis le morceau reprend comme si de rien n\'était.',[
  ['temps','Passage répété',1,{o:TEMPS}],['fois','Nombre de répétitions',4,{o:[[2,'2'],[3,'3'],[4,'4'],[6,'6'],[8,'8']]}]],{
  run:c=>{const d=c.d,p=c.p;if(!deckReady(d,1))return;const len=p.temps*beatLen(d);if(!loopOn(d,len,{slip:true,start:Math.max(0,gridStart(d,p.temps))}))return;
    const j=new Job('Répétition',{cle:'rythme'+c.i,deck:c.i});j.onStop(()=>{if(d.lp)loopOff(d)});j.later(()=>j.end(),p.temps*p.fois*wallBeat(d)*1000)}});
F('Effets rythmiques','roll','Roulement (boucle qui se raccourcit)','ROULEMENT','b','La boucle se raccourcit (1 temps → 1/2 → 1/4 → 1/8) pour faire monter la tension, puis le morceau reprend.',[
  ['duree','Durée',8,{o:[[4,'4 temps'],[8,'8 temps'],[16,'16 temps']]}],['filtre','Filtre qui monte',1,{o:OUINON}],['bruit','Bruit de montée',0,{o:OUINON}]],{
  run:c=>{const d=c.d,p=c.p;if(!deckReady(d,1))return;const st=[1,.5,.25,.125],q=wallBeat(d)*1000,seg=p.duree/4*q,s0=gridStart(d,1);
    if(!loopOn(d,beatLen(d),{slip:true,start:Math.max(0,s0)}))return;
    const j=new Job('Roulement',{cle:'rythme'+c.i,deck:c.i}),t0=performance.now();
    j.onStop(()=>{if(d.lp)loopOff(d);delete d.ov.flt;applyDeck(d)});
    st.forEach((L,k)=>{if(k)j.later(()=>{if(d.lp)loopOn(d,L*beatLen(d),{start:d.lp.s})},k*seg)});
    if(p.bruit)riser(p.duree*wallBeat(d));
    if(p.filtre)j.frame(()=>{const k=(performance.now()-t0)/(4*seg);if(k>=1)return false;d.ov.flt=.5+.3*k;applyDeck(d)});
    j.later(()=>j.end(),4*seg)}});
F('Effets rythmiques','gate','Hachage rythmique (gate)','HACHAGE','b','Coupe et rend le son en rythme pendant quelques temps.',[
  ['div','Vitesse',.25,{o:[[.5,'Croches (1/2 temps)'],[.25,'Doubles (1/4 temps)'],[.125,'Très rapide (1/8 temps)']]}],['duree','Durée',4,{o:[[2,'2 temps'],[4,'1 mesure'],[8,'2 mesures']]}]],{
  run:c=>{const d=c.d,p=c.p;if(!deckReady(d,1))return;const w=wallBeat(d),T0=AC.currentTime+((nextBeat(d,posOf(d),1/p.div)-posOf(d))/rateOf(d)),g=d.gate.gain,step=w*p.div,n=Math.round(p.duree/p.div);
    g.cancelScheduledValues(AC.currentTime);g.setValueAtTime(1,AC.currentTime);
    for(let k=0;k<n;k++){const t=T0+k*step;g.setValueAtTime(1,t);g.linearRampToValueAtTime(k%2?0:1,t+.003);g.setValueAtTime(k%2?0:1,t+step-.003)}
    g.setValueAtTime(1,T0+n*step);
    const j=new Job('Hachage',{cle:'rythme'+c.i,deck:c.i});j.onStop(()=>{g.cancelScheduledValues(AC.currentTime);g.setTargetAtTime(d.mute?0:1,AC.currentTime,.005)});j.later(()=>j.end(),(T0-AC.currentTime+n*step)*1000+50)}});
F('Effets rythmiques','coupure','Coupure brève','COUPURE','b','Coupe le son un court instant puis le rend : petite rupture.',[['duree','Durée',1,{o:[[.5,'1/2 temps'],[1,'1 temps'],[2,'2 temps'],[4,'1 mesure']]}]],{
  run:c=>{const d=c.d;if(!deckReady(d,1))return;setMute(d,1);const j=new Job('Coupure',{cle:'mute'+c.i,deck:c.i});j.onStop(()=>setMute(d,0));j.later(()=>j.end(),c.p.duree*wallBeat(d)*1000)}});

/* ---------- Vitesse ---------- */
const VIT_P=(def)=>[['duree','Durée',def.d,{min:.5,max:64,pas:.5,u:''}],['unite','Unité de la durée','temps',{o:[['temps','Temps musicaux'],['sec','Secondes']]}],
  [def.k,def.n,def.v,{min:def.min,max:def.max,pas:5,u:'% de la vitesse'}],['courbe','Courbe','douce',{o:[['douce','Douce (lente au début)'],['lineaire','Régulière'],['forte','Forte (rapide au début)']]}],
  ['vinyle','Son qui change de hauteur (effet vinyle)',1,{o:OUINON}],['apres','À la fin','reprise',{o:[['reprise','Revenir à la vitesse normale'],['arret','Arrêter le morceau'],['garder','Garder cette vitesse (appuie encore pour revenir)']]}],
  ['retour','Durée du retour (temps)',2,{min:0,max:16,pas:1,u:''}]];
function vitesse(c,cible,nom){
  const d=c.d,p=c.p;if(!deckReady(d,1))return;
  const prev=jobActif('vit'+c.i);if(prev){prev.stop();return}
  const j=new Job(nom,{cle:'vit'+c.i,deck:c.i}),T=durMs(d,p),t0=performance.now(),fin=cible/100;
  const cur=k=>p.courbe=='lineaire'?k:p.courbe=='forte'?1-(1-k)*(1-k):k*k;
  if(p.vinyle)d.a.preservesPitch=false;
  j.onStop(()=>{d.rateMul=1;d.a.preservesPitch=d.keylock;applyRate(d)});
  j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/T);d.rateMul=lerp(1,fin,cur(k));applyRate(d);if(k<1)return;
    if(p.apres=='arret'){pauseDeck(d);j.stop()}
    else if(p.apres=='reprise'){const R=p.retour*beatLen(d)/d.rate*1000,t1=performance.now();
      if(R<=0){j.stop();return false}
      j.frame(()=>{const q=Math.min(1,(performance.now()-t1)/R);d.rateMul=lerp(fin,1,q*q*(3-2*q));applyRate(d);if(q>=1){j.stop();return false}})}
    return false});
}
F('Vitesse','freinage','Ralentissement progressif','RALENTI','b','Ralentit le morceau peu à peu, comme un disque qu\'on freine. Durée, vitesse minimale, courbe et suite réglables.',VIT_P({d:4,k:'mini',n:'Vitesse minimale',v:25,min:5,max:95}),{run:c=>vitesse(c,c.p.mini,'Ralentissement'),on:c=>!!jobActif('vit'+c.i)});
F('Vitesse','acceleration','Accélération progressive','ACCÉLÈRE','b','Accélère le morceau peu à peu (effet « spin »).',VIT_P({d:4,k:'maxi',n:'Vitesse maximale',v:150,min:105,max:300}),{run:c=>vitesse(c,c.p.maxi,'Accélération'),on:c=>!!jobActif('vit'+c.i)});

/* ---------- Filtres et égaliseur ---------- */
function sweep(c,dir){const d=c.d,p=c.p;if(!deckReady(d,1))return;const T=p.duree*wallBeat(d)*1000,t0=performance.now(),tg=dir<0?.5-.5*p.prof:.5+.45*p.prof;
  const j=new Job('Balayage',{cle:'flt'+c.i,deck:c.i});j.onStop(()=>{delete d.ov.flt;applyDeck(d)});
  j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/T),w=p.forme=='ar'?Math.sin(Math.PI*k):k;d.ov.flt=lerp(.5,tg,w);applyDeck(d);if(k>=1){j.end();return false}})}
const SW_P=[['duree','Durée',8,{o:[[4,'4 temps'],[8,'8 temps'],[16,'16 temps'],[32,'32 temps']]}],['prof','Profondeur',.8,{min:.1,max:1,pas:.05,u:''}],['forme','Forme','ar',{o:[['ar','Aller-retour'],['a','Aller puis retour net']]}]];
F('Filtres','balayage_bas','Balayage passe-bas (son étouffé)','PASSE-BAS','b','Le son devient sourd, « sous l\'eau », puis revient.',SW_P,{run:c=>sweep(c,-1)});
F('Filtres','balayage_haut','Balayage passe-haut (son fin)','PASSE-HAUT','b','Le son perd ses graves et devient fin, puis revient.',SW_P,{run:c=>sweep(c,1)});
function holdFlt(c,v){const d=c.d,t0=performance.now(),j=new Job('Filtre maintenu',{cle:'flt'+c.i,deck:c.i});j.onStop(()=>{delete d.ov.flt;applyDeck(d)});
  j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/150);d.ov.flt=lerp(.5,v,k);applyDeck(d);if(k>=1)return false})}
F('Filtres','pb_m','Passe-bas tant que maintenu','PASSE-BAS','m','Étouffe le son pendant que tu tiens la touche.',[['prof','Profondeur',.75,{min:.1,max:1,pas:.05,u:''}]],{run:c=>holdFlt(c,.5-.5*c.p.prof),up:c=>{const j=jobActif('flt'+c.i);if(j)j.stop()}});
F('Filtres','ph_m','Passe-haut tant que maintenu','PASSE-HAUT','m','Retire les graves pendant que tu tiens la touche.',[['prof','Profondeur',.75,{min:.1,max:1,pas:.05,u:''}]],{run:c=>holdFlt(c,.5+.45*c.p.prof),up:c=>{const j=jobActif('flt'+c.i);if(j)j.stop()}});
[['low','graves','GRAVES'],['mid','médiums','MÉDIUMS'],['hi','aigus','AIGUS']].forEach(([k,n,s])=>{
  F('Filtres','kill_'+k,'Couper / rendre les '+n,s+' ✕','b','Coupe complètement les '+n+' ; appuie encore pour les rendre.',[],{run:c=>{c.d.kill[k]=c.d.kill[k]?0:1;applyDeck(c.d)},on:c=>!!c.d.kill[k]});
  F('Filtres','killm_'+k,'Couper les '+n+' tant que maintenu',s+' ✕','m','Coupe les '+n+' pendant que tu tiens la touche.',[],{run:c=>{c.d.kill[k]=1;applyDeck(c.d)},up:c=>{c.d.kill[k]=0;applyDeck(c.d)}});
});

/* ---------- Écho et réverbération ---------- */
const ECHO_P=[['retard','Écart entre les répétitions',.75,{o:[[.25,'1/4 de temps'],[.5,'1/2 temps'],[.75,'3/4 de temps'],[1,'1 temps'],[1.5,'1 temps et demi']]}],['retour','Nombre de répétitions',.55,{o:[[.3,'Peu'],[.55,'Moyen'],[.75,'Beaucoup']]}]];
F('Écho','echo','Écho (on / off)','ÉCHO','b','Ajoute un écho calé sur le tempo. Appuie encore pour l\'enlever.',ECHO_P,{
  run:c=>{const d=c.d;if(d.echoOn){d.echoOn=false;echoStop(d)}else{d.echoOn=true;echoSend(d,c.p)}},on:c=>c.d.echoOn});
F('Écho','echo_m','Écho tant que maintenu','ÉCHO','m','Écho pendant que tu tiens la touche ; la queue de l\'écho se termine toute seule.',ECHO_P,{run:c=>echoSend(c.d,c.p),up:c=>{if(!c.d.echoOn)echoStop(c.d)}});
F('Écho','echo_sortie','Sortie en écho','ÉCHO SORTIE','b','Le morceau part en écho et disparaît. Sortie propre sur une fin de phrase.',[...ECHO_P,['queue','Durée de la queue',4,{o:[[2,'2 temps'],[4,'1 mesure'],[8,'2 mesures']]}]],{
  run:c=>{const d=c.d;if(!deckReady(d,1))return;const w=wallBeat(d);echoSend(d,Object.assign({},c.p,{duree:w}));const j=new Job('Sortie en écho',{cle:'sortie'+c.i,deck:c.i});
    j.later(()=>setMute(d,1),w*1000);j.onStop(st=>{setMute(d,0);if(!st)pauseDeck(d);echoStop(d)});j.later(()=>j.end(),c.p.queue*w*1000+w*1000)}});
F('Écho','reverb_sortie','Sortie en réverbération','RÉVERB SORTIE','b','Le morceau part dans une grande réverbération puis s\'arrête.',[['queue','Durée',4,{o:[[2,'2 temps'],[4,'1 mesure'],[8,'2 mesures']]}]],{
  run:c=>{const d=c.d;if(!deckReady(d,1))return;const w=wallBeat(d);revSend(d,1,w);const j=new Job('Sortie en réverbération',{cle:'sortie'+c.i,deck:c.i});
    j.later(()=>setMute(d,1),w*1000);j.onStop(st=>{setMute(d,0);if(!st)pauseDeck(d);revStop(d)});j.later(()=>j.end(),c.p.queue*w*1000+w*1000)}});
F('Écho','reverb_m','Réverbération tant que maintenu','RÉVERB','m','Ajoute de la réverbération pendant que tu tiens la touche.',[],{run:c=>revSend(c.d,.8),up:c=>revStop(c.d)});

/* ---------- Volume ---------- */
F('Volume','fondu','Fondu de sortie','FONDU','b','Baisse le volume peu à peu puis arrête le morceau.',[['duree','Durée',8,{o:[[4,'4 temps'],[8,'8 temps'],[16,'16 temps'],[32,'32 temps']]}]],{
  run:c=>{const d=c.d;if(!deckReady(d,1))return;const T=c.p.duree*wallBeat(d)*1000,t0=performance.now(),j=new Job('Fondu de sortie',{cle:'sortie'+c.i,deck:c.i});
    j.onStop(st=>{d.autoV=1;mix()});j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/T);d.autoV=1-k;mix();if(k>=1){pauseDeck(d);j.end();return false}})}});
F('Volume','muet','Couper / rendre le son','MUET','b','Coupe tout le son du deck ; appuie encore pour le rendre.',[],{run:c=>setMute(c.d,!c.d.mute),on:c=>!!c.d.mute});
F('Volume','relance','Relance (filtre + aigus)','RELANCE','b','Ouvre le filtre et les aigus pendant 8 temps puis revient : relance l\'énergie sans changer de morceau.',[['duree','Durée',8,{o:[[4,'4 temps'],[8,'8 temps'],[16,'16 temps']]}]],{
  run:c=>{const d=c.d;if(!deckReady(d,1))return;const T=c.p.duree*wallBeat(d)*1000,t0=performance.now(),j=new Job('Relance',{cle:'flt'+c.i,deck:c.i});
    j.onStop(()=>{delete d.ov.flt;delete d.ov.hi;applyDeck(d)});j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/T),w=Math.sin(Math.PI*k);d.ov.flt=.5+.28*w;d.ov.hi=Math.min(1,d.k.hi+.2*w);applyDeck(d);if(k>=1){j.end();return false}})}});

/* ---------- Mixage (réglages continus) ---------- */
[['volume','vol','Volume du deck','VOLUME'],['gain','gain','Gain (niveau d\'entrée)','GAIN'],['graves','low','Graves','GRAVES'],['medium','mid','Médiums','MÉDIUMS'],['aigus','hi','Aigus','AIGUS'],['filtre','flt','Filtre (gauche : étouffé, droite : fin)','FILTRE']].forEach(([id,k,n,s])=>
  F('Mixage',id,n,s,'c',n+' du deck.',[],{set:(c,v)=>{c.d.k[k]=v;mix()},val:c=>c.d.k[k]}));
F('Mixage','crossfader','Crossfader (passage d\'un deck à l\'autre)','CROSSFADER','c','Gauche : deck 1. Droite : deck 2.',[],{set:(c,v)=>{G.xf=v;mix()},val:()=>G.xf});
F('Mixage','volume_general','Volume général','VOL. GÉNÉRAL','c','Volume de sortie (protégé contre les pics).',[],{set:(c,v)=>{G.mg=v;mix()},val:()=>G.mg});
F('Mixage','tempo_pot','Tempo (potentiomètre)','TEMPO','c','Règle la vitesse du deck de −8 % à +8 %.',[['plage','Plage',8,{o:[[4,'±4 %'],[8,'±8 %'],[16,'±16 %']]}]],{set:(c,v)=>{c.d.syncLock=false;c.d.rate=1+(v-.5)*2*c.p.plage/100;applyRate(c.d)},val:c=>clamp(.5+(c.d.rate-1)*100/16)});
F('Mixage','casque','Pré-écoute au casque (on / off)','CASQUE','b','Envoie ce deck dans le casque branché sur la platine. Fonctionne seulement si le « casque séparé » est actif (⚙ Réglages).',[],{
  run:c=>{const d=c.d;d.cueOn=!d.cueOn;d.cS.gain.setTargetAtTime(d.cueOn?1:0,AC.currentTime,.01);if(!BUS.split)toast('Casque séparé non actif : voir ⚙ Réglages → Casque')},on:c=>c.d.cueOn});

/* ---------- Molettes ---------- */
const JOGS=[{acc:0,t:0,tm:0},{acc:0,t:0,tm:0}];
F('Molette','molette','Molette (ralentir / accélérer ; recherche à l\'arrêt)','MOLETTE','r','En lecture : un petit tour ralentit ou accélère pour recaler à l\'oreille. À l\'arrêt : avance ou recule dans le morceau.',[['sens','Sensibilité',1,{o:[[.5,'Faible'],[1,'Normale'],[2,'Forte']]}]],{
  turn:(c,dl)=>{const d=c.d,g=JOGS[c.i],now=performance.now();if(!d.a.src)return;
    if(d.a.paused){d.a.currentTime=clamp(d.a.currentTime+dl*.012*c.p.sens,0,d.a.duration||0);return}
    if(now-g.t>300)g.acc=0;g.t=now;g.acc=clamp(g.acc+dl,-60,60);d.nudge=1+clamp(g.acc*.006*c.p.sens,-.5,.5);applyRate(d);
    clearTimeout(g.tm);g.tm=setTimeout(()=>{g.acc=0;d.nudge=1;applyRate(d)},180)}});
F('Molette','recherche','Recherche rapide','RECHERCHE','r','Avance ou recule vite dans le morceau.',[['sens','Sensibilité',1,{o:[[.5,'Faible'],[1,'Normale'],[2,'Forte']]}]],{
  turn:(c,dl)=>{const d=c.d;if(!d.a.src)return;if(d.lp)killLoop(d);d.a.currentTime=clamp(d.a.currentTime+dl*.25*c.p.sens,0,(d.a.duration||1)-1)}});

/* ---------- Navigation ---------- */
F('Navigation','parcourir','Parcourir la liste des morceaux','PARCOURIR','r','Tourne pour descendre ou monter dans la liste.',[],{turn:(c,dl)=>navScroll(dl)});
F('Navigation','sel_suiv','Morceau suivant dans la liste','SUIVANT','b','',[],{run:()=>navScroll(1)});
F('Navigation','sel_prec','Morceau précédent dans la liste','PRÉCÉDENT','b','',[],{run:()=>navScroll(-1)});
F('Navigation','charger_1','Charger la sélection sur le deck 1','CHARGER 1','b','',[],{run:()=>navLoad(0)});
F('Navigation','charger_2','Charger la sélection sur le deck 2','CHARGER 2','b','',[],{run:()=>navLoad(1)});
F('Navigation','charger_ici','Charger la sélection sur ce deck','CHARGER','b','',[],{run:c=>navLoad(c.i)});
F('Navigation','charger_libre','Charger la sélection sur le deck à l\'arrêt','CHARGER','b','',[],{run:()=>{const i=D[0].a.paused&&live()!=0?0:D[1].a.paused?1:D[0].a.paused?0:-1;if(i<0)toast('Les deux decks jouent');else navLoad(i)}});
F('Navigation','ouvrir_liste','Ouvrir / fermer la liste des morceaux','MORCEAUX','b','',[],{run:()=>togglePanel('libm')});

/* ---------- Enchaînements (d'un deck à l'autre) ---------- */
F('Enchaînements','mix_ia','Transition IA (plan prévu pour ces deux morceaux)','MIX IA','b','Lance tout de suite la transition calculée pour ce duo : effet, durée, point d\'entrée.',[],{run:()=>aiMix(true)});
F('Enchaînements','mix_fondu','Fondu vers l\'autre deck','MIX','b','Fondu classique et propre vers le morceau suivant.',[['duree','Durée',16,{o:[[8,'8 temps'],[16,'16 temps'],[32,'32 temps']]}]],{run:c=>mixFondu(c.p.duree)});
[['roll','mix_drop','Roulement puis drop','ROUL. → DROP','La boucle se raccourcit avec un filtre et un bruit de montée, puis le morceau suivant tombe sur son drop.'],
 ['brake','mix_frein','Freinage puis entrée douce','FREIN → MIX','Le morceau ralentit comme un disque qu\'on freine, puis le suivant entre en douceur.'],
 ['echo','mix_echo','Écho puis drop','ÉCHO → DROP','Le morceau part en écho, le suivant arrive sur son drop.'],
 ['cut','mix_coupe','Coupure nette puis drop','COUPE → DROP','Coupe net le morceau en cours, le suivant tombe sur son drop.'],
 ['spin','mix_spin','Accélération puis drop','ACCÉL → DROP','Le morceau s\'emballe puis le suivant tombe sur son drop.'],
 ['stutter','mix_begai','Bégaiement puis enchaînement','BÉGAI → MIX','Répète les derniers temps comme un bégaiement puis enchaîne.']].forEach(([k,id,n,s,ds])=>F('Enchaînements',id,n,s,'b',ds,[],{run:()=>chain(k)}));
F('Enchaînements','lancer_autre','Lancer l\'autre deck sur le temps','LANCER','b','Démarre l\'autre deck pile sur le temps, calé sur le tempo qui joue.',[],{run:()=>{const n=D[1-live()];if(n.a.paused)playDeck(n)}});
F('Enchaînements','autre_drop','Placer l\'autre deck sur son drop','SUR LE DROP','b','Positionne le morceau suivant sur son meilleur drop.',[],{run:()=>{const n=D[1-live()];if(!n.pk||!n.grid){toast('Aucun morceau suivant prêt');return}const e=entryFor(n,'spin',D[live()]);n.a.currentTime=e.t;toast('Suivant placé : '+e.why)}});
F('Enchaînements','autre_titre','Changer le morceau préparé','AUTRE TITRE','b','L\'IA prépare un autre morceau compatible avec celui qui joue.',[],{run:()=>autreTitre()});

/* ---------- Sons ---------- */
[['klaxon','Klaxon','KLAXON'],['sirene','Sirène','SIRÈNE'],['laser','Laser','LASER'],['caisse','Caisse claire','CAISSE'],['impact','Impact (à lâcher sur un drop)','IMPACT']].forEach(([k,n,s])=>F('Sons','son_'+k,n,s,'b','',[],{run:()=>sfx(k)}));
F('Sons','son_montee','Bruit de montée (avant un drop)','MONTÉE','b','Montée de tension calée sur le tempo.',[['duree','Durée',4,{o:[[2,'2 temps'],[4,'4 temps'],[8,'8 temps'],[16,'16 temps']]}]],{run:c=>riser(c.p.duree*wallBeat(c.d))});

/* ---------- Système ---------- */
F('Système','shift','SHIFT (donne une 2e fonction aux autres touches)','SHIFT','m','Tant que tu le tiens, les autres touches utilisent leur fonction « avec SHIFT ».',[],{run:()=>setShift(1),up:()=>setShift(0),on:()=>SHIFT.on});
F('Système','arret','Arrêt d\'urgence des automatismes','ARRÊT','b','Arrête immédiatement toutes les transitions, effets et le mode AUTO. La musique continue, tu reprends la main.',[],{run:()=>arretUrgence()});
F('Système','auto_onoff','Mode AUTO (on / off)','AUTO','b','L\'IA enchaîne les morceaux à ta place.',[],{run:()=>setAuto(!AUTO.on),on:()=>AUTO.on});
F('Système','effets_auto','Effets automatiques des transitions (on / off)','EFFETS AUTO','b','Filtres et bruits de montée ajoutés par l\'IA pendant les transitions.',[],{run:()=>{PREF.fx=!PREF.fx;savePref();toast(PREF.fx?'Effets automatiques activés':'Effets automatiques coupés')},on:()=>PREF.fx});
F('Système','aucune','Aucune fonction','—','b','Cette commande ne fait rien.',[],{run:()=>{}});

/* ===== Exécution d'une fonction attribuée ===== */
const SHIFT={on:0};
function setShift(v){SHIFT.on=v;document.body.classList.toggle('shift',!!v)}
function deckOf(b,physDeck){const t=b.deck||'commande';return t=='1'?0:t=='2'?1:t=='actif'?live():t=='autre'?1-live():(physDeck!=null?physDeck:live())}
function ctxOf(b,physDeck){const f=CAT[b.fn];if(!f)return null;const i=deckOf(b,physDeck);return{f,i,d:D[i],p:par(f,b),b}}
/* ev : {t:'press'|'release'|'value'|'delta', v} */
function runBinding(b,physDeck,ev){
  if(!b||!b.fn)return;const c=ctxOf(b,physDeck);if(!c)return;const f=c.f;AC.resume();
  try{
    if(ev.t=='press'){if(f.run)f.run(c);else if(f.set)f.set(c,1)}
    else if(ev.t=='release'){if(f.up)f.up(c)}
    else if(ev.t=='value'){if(f.set)f.set(c,ev.v);else if(f.run&&ev.v>.5&&!(ev.prev>.5))f.run(c)}
    else if(ev.t=='delta'){if(f.turn)f.turn(c,ev.v);else if(f.set){const v=clamp((f.val?f.val(c):.5)+ev.v/128);f.set(c,v)}}
  }catch(e){console.error(e);toast('Action impossible : '+f.nom,'err')}
}
function bindingOn(b,physDeck){const c=b&&ctxOf(b,physDeck);return!!(c&&c.f.on&&c.f.on(c))}
function bindingVal(b,physDeck){const c=b&&ctxOf(b,physDeck);return c&&c.f.val?c.f.val(c):null}
