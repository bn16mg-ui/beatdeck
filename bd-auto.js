'use strict';
/* ===== BeatDeck 6 · transitions des duos, mode DJ automatique, guide « faire semblant » =====
   1. Pour chaque duo, l'appli lit la structure des deux morceaux et propose plusieurs transitions
      (techniques de ton guide), avec où sortir du 1er, où entrer dans le 2e et pourquoi. Tu écoutes, tu modifies, tu valides.
   2. Mode DJ automatique (3 tapes sur BEATDECK) : seulement avec tes duos. La transition validée part toute seule
      au bon moment, et quelques petits effets arrivent aux bons endroits.
   3. Pendant ce temps, le guide te dit quoi faire avec tes mains pour faire comme si c'était toi.
      Tes gestes ne changent pas le son tant que l'appli a la main, puis chaque commande reprend la main
      dès que tu la ramènes à la bonne position. */

/* ---------- 1. lire la structure d'un morceau ---------- */
const STRC={};
function lireStructure(s){
  const m=s&&s.meta;if(!m||!m.st||!m.bpm)return null;
  const k=s.id+'|'+m.v;if(STRC[k])return STRC[k];
  const{bar,E,L}=m.st,off=m.off,P=Math.floor(E.length/4);if(P<4)return null;
  const moy=(A,p)=>(A[4*p]+A[4*p+1]+A[4*p+2]+A[4*p+3])/4;
  const PE=[],PL=[];for(let p=0;p<P;p++){PE.push(moy(E,p));PL.push(moy(L,p))}
  const tri=[...PE].sort((a,b)=>a-b),q=f=>tri[Math.floor(f*(P-1))],mx=tri[P-1]||1;
  const hi=Math.max(q(.65),.62*mx),lo=Math.min(q(.3),.5*mx);
  const type=PE.map(v=>v>=hi?'fort':v<=lo?'calme':'moyen');
  const t=p=>off+p*4*bar,drops=[],breaks=[];
  for(let p=1;p<P;p++){if(type[p]=='fort'&&type[p-1]!='fort'&&PE[p]>=1.15*PE[p-1])drops.push(p);if(type[p-1]=='fort'&&PE[p]<=.82*PE[p-1])breaks.push(p)}
  let lastFort=-1;type.forEach((x,p)=>{if(x=='fort')lastFort=p});
  let k0=E.findIndex(v=>v>=.25);if(k0<0)k0=0;
  const S={bar,beat:bar/4,off,P,PE,PL,type,t,drops,breaks,outro:lastFort>=0&&lastFort<P-1?lastFort+1:null,tDebut:off+k0*bar,dur:m.dur};
  STRC[k]=S;return S;
}
const fmtT=t=>fmt(Math.max(0,t));

/* ---------- 2. proposer des transitions pour un duo ---------- */
const NOMT={echo_out:'Écho Out',eq_swap:'Échange des basses · 16 temps',mix_long:'Mix long · 32 temps',filtre_out:'Filtre de sortie · 8 temps',coupure:'Coupure nette',boucle_out:'Boucle Out'};
const TEMPS_A={echo_out:6,eq_swap:18,mix_long:34,filtre_out:10,coupure:2,boucle_out:10};   // temps de A utilisés après le point de sortie
// meilleurs points de sortie du 1er morceau (débuts de phrase de 16 temps)
function sorties(S,tech){
  const L=[],n=TEMPS_A[tech],blend=n>=10;
  for(let p=Math.max(1,Math.ceil(S.P*.4));p<S.P;p++){
    const t=S.t(p);if(t+(n+4)*S.beat>S.dur-2)continue;
    let q=0;const r=[];
    if(S.breaks.includes(p)){q+=.5;r.push('juste après une partie forte (le refrain est fini)')}
    else if(S.type[p-1]=='fort'&&S.PE[p]<S.PE[p-1]*.92){q+=.3;r.push('à la fin d\'une partie forte')}
    if(S.outro!=null&&p>=S.outro){q+=.35;r.push('début de la fin du morceau')}
    if(S.type[p]=='fort'&&S.type[p-1]=='fort'){q-=.6;r.push('couperait une partie forte')}
    if(S.drops.includes(p)){q-=.4;r.push('on raterait une montée')}
    if(blend){let e=0,c=0;for(let k=p;k<Math.min(S.P,p+Math.ceil(n/16));k++){e+=S.PE[k];c++}q+=.3*(1-(c?e/c:1))}
    q+=.25*clamp(1-Math.abs(t/S.dur-.8)*4);
    L.push({t:+t.toFixed(3),p,q,r});
  }
  return L.sort((a,b)=>b.q-a.q);
}
// points d'entrée du 2e morceau
function entrees(S){
  const deb={t:+S.tDebut.toFixed(3),q:S.PE[0]<.7?.3:.1,r:'au début du morceau'+(S.PE[0]<.7?' (intro calme, idéale pour mélanger)':'')};
  let p=S.drops.find(p=>S.t(p)<S.dur*.5);if(p==null)p=S.type.findIndex(x=>x=='fort');
  const fort=p!=null&&p>=0&&S.t(p)<S.dur*.5?{t:+S.t(p).toFixed(3),q:.3,r:'directement sur sa 1re partie forte'}:null;
  return{deb,fort};
}
function infosPaire(a,b){
  const A=a.meta,B=b.meta,g=Math.abs(foldR(A.bpm,B.bpm)-1)*100;let ton=null;
  if(A.key&&B.key){const d=Math.min((A.key.n-B.key.n+12)%12,(B.key.n-A.key.n+12)%12);ton=d==0||(d==1&&A.key.b==B.key.b)}
  return{g,ton,plusFort:B.en>A.en*1.15,plusCalme:B.en<A.en*.85};
}
function propositions(du){
  const a=sonDe(du.a),b=sonDe(du.b),SA=lireStructure(a),SB=lireStructure(b);if(!SA||!SB)return null;
  const I=infosPaire(a,b),E=entrees(SB),out=[];
  const essai=(tech,base,ent,riser,pourquoi)=>{
    const ex=sorties(SA,tech)[0];if(!ex)return;
    const r=[...pourquoi];r.push('Sortie de « '+a.nom+' » à '+fmtT(ex.t)+(ex.r.length?' : '+ex.r.join(', '):''));r.push('Entrée de « '+b.nom+' » '+ent.r+' ('+fmtT(ent.t)+')');
    out.push({tech,exit:ex.t,entry:ent.t,riser:!!riser,score:clamp(base+ex.q*.4+ent.q*.3,0,1.5),raisons:r});
  };
  const tTxt='Tempos '+(I.g<=3?'très proches':I.g<=8?'proches':'éloignés')+' ('+nf(I.g,1)+' %)',kTxt=I.ton==null?null:I.ton?'tonalités compatibles':'tonalités qui risquent de se heurter';
  const base=[tTxt].concat(kTxt?[kTxt]:[]);
  if(I.g<=8)essai('eq_swap',(I.g<=3?.85:.65)-(I.ton===false?.25:0),E.deb,false,base.concat(['les basses s\'échangent sur le temps : le classique en house, afro, dance']));
  if(I.g<=3)essai('mix_long',.8-(I.ton===false?.4:0)-(I.plusFort||I.plusCalme?.1:0),E.deb,false,base.concat(['les deux morceaux restent superposés longtemps : très fluide']));
  if(I.g<=8)essai('filtre_out',.55+(I.plusCalme?.12:0),E.deb,false,base.concat(['le 1er s\'étouffe en douceur pendant que le 2e s\'ouvre'+(I.plusCalme?' : parfait pour redescendre l\'ambiance':'')]));
  const ef=E.fort&&E.fort.t<70?E.fort:E.deb;
  essai('echo_out',.6+(I.g>8?.25:0),ef,false,base.concat([I.g>8?'l\'écho cache la différence de tempo : le 2e part à son vrai tempo':'l\'écho termine proprement la voix du 1er']));
  essai('coupure',.5+(I.g>8?.2:0)+(ef===E.fort?.1:0),ef,ef===E.fort,base.concat(['changement net sur le temps'+(ef===E.fort?', avec une montée (riser) juste avant':'')]));
  essai('boucle_out',.5+(ef===E.fort?.1:0)+(I.plusFort?.1:0),ef,ef===E.fort,base.concat(['la boucle qui raccourcit crée l\'attente avant que le 2e explose']));
  return out.sort((x,y)=>y.score-x.score);
}
// transition utilisée pour un duo : celle que tu as validée, sinon la mieux notée
function planDuo(du){if(du.trans)return du.trans;const P=propositions(du);return P&&P[0]?Object.assign({auto:true},P[0]):null}
function prochaineSortie(du,tech,pos){const S=lireStructure(sonDe(du.a));if(!S)return null;const L=sorties(S,tech).filter(e=>e.t>pos+4).sort((x,y)=>x.t-y.t);const ok=L.find(e=>e.q>-.2)||L[0];return ok?ok.t:null}

/* ---------- 3. le guide « faire semblant » ---------- */
const GUIDE={pas:[],t:0};
// retrouve le bouton qui porte un raccourci sur ce deck (ou avec SHIFT)
function boutonDe(cle,deck){
  for(const p of PHYS){if(p.deck!==deck||!estRaccourci(p.id))continue;const r=racc(p.id);if(r.base==cle)return{id:p.id,txt:CAT[cle].nom+' (deck '+(deck+1)+')'};if(r.shift==cle)return{id:p.id,txt:'SHIFT + '+CAT[cle].nom+' (deck '+(deck+1)+')'}}
  return{id:null,txt:CAT[cle]?CAT[cle].nom:cle};
}
const dk=d=>' du deck '+(d.i+1);
function gestesDe(tech,X,O,w){
  const b=wallBeat(X),x=X.i,o=O.i,G=[];const g=(t,ids,txt)=>G.push({t,ids:ids.filter(Boolean),txt});
  if(tech=='echo_out'){const e=boutonDe('echo',x);g(w,[e.id],'Appuie sur '+e.txt);g(w+2*b,['vol'+x,'play'+o,'xf'],'Baisse le VOLUME'+dk(X)+', appuie sur LECTURE'+dk(O)+' et pousse le crossfader vers le deck '+(o+1));}
  else if(tech=='eq_swap'||tech=='mix_long'){const N=tech=='eq_swap'?16:32;
    g(Math.max(0,w-2*b),['low'+o],'Tourne GRAVES'+dk(O)+' tout à gauche');g(w,['play'+o],'Appuie sur LECTURE'+dk(O));
    g(w+b,['xf'],'Pousse doucement le crossfader vers le milieu');g(w+N/2*b-b/2,['low'+x,'low'+o],'Échange les graves : GRAVES'+dk(X)+' à gauche, GRAVES'+dk(O)+' au milieu');
    g(w+N/2*b+b,['xf'],'Finis de pousser doucement le crossfader vers le deck '+(o+1));g(w+N*b,['play'+x],'Arrête le deck '+(x+1)+' (LECTURE)');}
  else if(tech=='filtre_out'){g(w,['play'+o],'Appuie sur LECTURE'+dk(O));g(w+b,['flt'+x,'xf'],'Tourne lentement FILTRE'+dk(X)+' vers la gauche et pousse le crossfader vers le deck '+(o+1));g(w+8*b,['play'+x],'Arrête le deck '+(x+1)+' (LECTURE)');}
  else if(tech=='coupure'){g(Math.max(0,w-4*b),['play'+o,'xf'],'Prépare ta main sur LECTURE'+dk(O)+' et sur le crossfader');g(w,['play'+o,'xf'],'MAINTENANT : LECTURE'+dk(O)+' et crossfader d\'un coup vers le deck '+(o+1));g(w+b,['play'+x],'Arrête le deck '+(x+1)+' (LECTURE)');}
  else if(tech=='boucle_out'){const l=boutonDe('boucle4',x);g(w,[l.id],'Appuie sur '+l.txt);g(w+4*b,[l.id],'Tapote '+l.txt+' à chaque fois que la boucle raccourcit');g(w+8*b,['play'+o,'xf'],'Appuie sur LECTURE'+dk(O)+' et crossfader vers le deck '+(o+1));g(w+8.5*b,['play'+x],'Arrête le deck '+(x+1)+' (LECTURE)');}
  return G;
}
function guider(G,X){const t0=performance.now();GUIDE.pas=G.map(p=>Object.assign({},p,{at:t0+p.t*1000}));GUIDE.deck=X}
function guideEffacer(){GUIDE.pas=[];QA('.guide').forEach(e=>e.classList.remove('guide'));$('guide').hidden=true}
setInterval(()=>{
  const el=$('guide');if(!el)return;const now=performance.now();
  GUIDE.pas=GUIDE.pas.filter(p=>now<p.at+1600);
  QA('.guide').forEach(e=>e.classList.remove('guide'));
  if(!GUIDE.pas.length){if(!el.hidden&&!AUTO.msg)el.hidden=true;if(AUTO.msg){el.hidden=false;el.className='';$('gT').textContent=AUTO.msg;$('gC').textContent=''}return}
  const p=GUIDE.pas[0],dt=(p.at-now)/1000,b=GUIDE.deck?wallBeat(GUIDE.deck):.5;
  el.hidden=false;el.className=dt<=.12?'maint':'';
  $('gC').textContent=dt<=.12?'MAINTENANT':'Dans '+Math.max(1,Math.ceil(dt/b))+' temps';$('gT').textContent=p.txt;
  if(dt<2.5*b)p.ids.forEach(id=>{const e=Q('[data-ph="'+id+'"]');if(e)e.classList.add('guide')});
},90);

/* ---------- 4. mode DJ automatique ---------- */
const AUTO={on:LS.get('bd6_auto',false),job:null,fx:null,decks:[],bloque:0,prise:{},fait:{},alt:0,cool:[0,0],msg:'',ecoute:null};
function setAuto(on){AUTO.on=on;LS.set('bd6_auto',on);$('logo').classList.toggle('auto',on);toast(on?'Mode DJ automatique activé (seulement pour tes duos)':'Mode DJ automatique désactivé');if(!on){AUTO.msg='';guideEffacer()}}
let tapes=[];
function tapeLogo(){const n=performance.now();tapes=tapes.filter(t=>n-t<900);tapes.push(n);if(tapes.length>=3){tapes=[];setAuto(!AUTO.on)}}
// commandes « mimées » : ignorées pendant que l'appli a la main
const MIMEES=/^(xf|vol[01]|low[01]|hi[01]|flt[01]|play[01]|jog[01]|cue[01]|sync[01]|vin[01]|cas[01]|fx[01]|lpa[01]|lpp[01]|lpm[01]|tmpm[01]|tmpp[01])$/;
const occupe=()=>(AUTO.job&&!AUTO.job.mort)||(AUTO.fx&&!AUTO.fx.mort)||performance.now()<AUTO.bloque;
function autoBloque(id,ev){
  if(occupe()&&MIMEES.test(id))return true;
  if(ev.t=='value'&&AUTO.prise[id]){const cur=valeurDe(id);if(cur==null||Math.abs(ev.v-cur)<=.07){delete AUTO.prise[id];return false}return true}
  return false;
}
function valeurDe(id){const m=id.match(/^(vol|low|hi|flt)([01])$/);if(m)return D[+m[2]].k[{vol:'vol',low:'low',hi:'hi',flt:'flt'}[m[1]]];if(id=='xf')return G.xf;if(id=='mg')return G.mg;return null}
function finAuto(){
  AUTO.job=null;AUTO.bloque=performance.now()+3500;
  ['xf','vol0','vol1','low0','low1','hi0','hi1','flt0','flt1'].forEach(id=>AUTO.prise[id]=true);   // chaque commande reprend la main quand tu la ramènes à sa place
  [0,1].forEach(i=>{VAL['vol'+i]=D[i].k.vol;VAL['low'+i]=D[i].k.low;VAL['hi'+i]=D[i].k.hi;VAL['flt'+i]=D[i].k.flt;['vol','low','hi','flt'].forEach(k=>dessiner(k+i))});VAL.xf=G.xf;dessiner('xf');
}
function lancerAuto(X,O,plan,w,ecoute){
  const j=TECH[plan.tech]&&TECH[plan.tech](X,O,w,{entry:plan.entry,riser:plan.riser,silence:true});if(!j)return null;
  AUTO.job=j;AUTO.decks=[X.i,O.i];guider(gestesDe(plan.tech,X,O,w),X);AUTO.msg='';
  if(!ecoute)AUTO.msg='';return j;
}
function autoTick(){
  if(AUTO.job&&AUTO.job.mort)finAuto();
  if(AUTO.fx&&AUTO.fx.mort){AUTO.fx=null;AUTO.bloque=performance.now()+1200}
  if(!AUTO.on&&!AUTO.ecoute)return;
  if(occupe())return;
  if(AUTO.ecoute)return;
  let msg='';
  for(const X of D){
    if(X.a.paused||!X.sonId||X.chargement)continue;const du=duoDe(X.sonId),O=D[1-X.i];if(!du)continue;
    if(O.sonId!=du.b||!O.a.paused||O.chargement){continue}
    const plan=planDuo(du);if(!plan){msg='Analyse du duo en cours…';continue}
    const pos=posOf(X),b=wallBeat(X),rate=rateOf(X);let exit=plan.exit,pl=plan;
    if(pos>exit-.3){const e2=prochaineSortie(du,plan.tech,pos);
      if(e2)exit=e2;else if((X.a.duration||0)-pos<30){pl={tech:'echo_out',entry:plan.entry};exit=nextBeat(X,pos+beatLen(X)*2)}else continue}
    const w=(exit-pos)/rate;
    if(w<=12*b+.2){lancerAuto(X,O,pl,w);return}
    msg='♥ '+NOMT[pl.tech]+' vers « '+((sonDe(du.b)||{}).nom||'')+' » dans '+fmt(w);
  }
  AUTO.msg=msg;
  autoEffets();
}
setInterval(autoTick,200);

/* petits effets pendant les morceaux des duos, juste avant une montée ou une pause */
const dansDuo=id=>DUOS.some(d=>d.a==id||d.b==id);
function autoEffets(){
  for(const X of D){
    if(X.a.paused||!X.sonId||!X.grid||X.lp||!dansDuo(X.sonId))continue;
    const S=lireStructure(sonDe(X.sonId));if(!S)continue;
    const pos=posOf(X),B=beatLen(X),b=wallBeat(X);if(pos<AUTO.cool[X.i])continue;
    // pas d'effet juste avant la transition du duo
    const du=duoDe(X.sonId);if(du){const pl=planDuo(du);if(pl&&pl.exit-pos<24*B&&pl.exit>pos)continue}
    const cle=t=>X.sonId+'@'+Math.round(t);
    for(const p of S.drops){const td=S.t(p),n=(td-pos)/B;if(AUTO.fait[cle(td)])continue;
      // un coup sur deux : filtre qui monte pendant 8 temps, sinon roulement sur le dernier temps
      if(AUTO.alt%2==0&&n>=7.6&&n<8.4){AUTO.fait[cle(td)]=1;AUTO.cool[X.i]=td+48*B;AUTO.alt++;return effetFiltre(X,(td-8*B-pos)/rateOf(X),8*b)}
      if(AUTO.alt%2==1&&n>=.9&&n<1.4){AUTO.fait[cle(td)]=1;AUTO.cool[X.i]=td+48*B;AUTO.alt++;return effetRoulement(X,(td-B-pos)/rateOf(X),b)}}
    for(const p of S.breaks){const tb=S.t(p),n=(tb-pos)/B;if(AUTO.fait[cle(tb)])continue;
      if(n>=.9&&n<1.4){AUTO.fait[cle(tb)]=1;AUTO.cool[X.i]=tb+48*B;return effetEcho(X,(tb-B-pos)/rateOf(X),b)}}
  }
}
function effetFiltre(X,w,dur){
  const j=new Job('auto_fx:'+X.i,[X.i]);AUTO.fx=j;j.onStop(()=>{delete X.ov.flt;applyDeck(X)});
  j.later(()=>ovVers(X,'flt',X.k.flt,.9,dur,j),w*1000);j.later(()=>{delete X.ov.flt;applyDeck(X);j.end()},(w+dur)*1000);
  guider([{t:w,ids:['flt'+X.i],txt:'Tourne doucement FILTRE'+dk(X)+' vers la droite'},{t:w+dur,ids:['flt'+X.i],txt:'Remets FILTRE'+dk(X)+' au milieu d\'un coup'}],X);
}
function effetRoulement(X,w,b){
  const j=new Job('auto_fx:'+X.i,[X.i]);AUTO.fx=j;j.onStop(()=>{if(X.lp&&X.lp.slip)loopOff(X)});
  j.later(()=>loopOn(X,beatLen(X)/2,{slip:true}),w*1000);j.later(()=>{if(X.lp&&X.lp.slip)loopOff(X);j.end()},(w+b)*1000);
  const r=boutonDe('roulement',X.i);guider([{t:w,ids:[r.id],txt:'Appuie et garde le doigt sur '+r.txt},{t:w+b,ids:[r.id],txt:'Lâche'}],X);
}
function effetEcho(X,w,b){
  const j=new Job('auto_fx:'+X.i,[X.i]);AUTO.fx=j;j.onStop(()=>echoSet(X,false));
  j.later(()=>echoSet(X,true),w*1000);j.later(()=>{echoSet(X,false);j.end()},(w+b)*1000);
  const e=boutonDe('echo',X.i);guider([{t:w,ids:[e.id],txt:'Appuie sur '+e.txt},{t:w+b,ids:[e.id],txt:'Rappuie sur '+e.txt}],X);
}

/* ---------- 5. préparer la transition d'un duo (écran) ---------- */
const PREP={du:null,props:[],ouvert:-1};
function ouvrirPrep(id){const du=DUOS.find(d=>d.id==id);if(!du)return;PREP.du=du;PREP.props=propositions(du)||[];PREP.ouvert=-1;$('prep').hidden=false;rendrePrep()}
function etoiles(s){const mx=Math.max(...PREP.props.map(p=>p.score),.01),n=clamp(Math.round(5*s/mx),1,5);return'★'.repeat(n)+'☆'.repeat(5-n)}
function frise(S,mark,col){
  if(!S)return'';const w=100/S.P;
  return`<div class="frise">${S.type.map((t,p)=>`<i class="${t}" style="left:${p*w}%;width:${w}%;height:${Math.round(20+70*S.PE[p])}%"></i>`).join('')}${mark!=null?`<b style="left:${clamp((mark-S.off)/(S.P*4*S.bar))*100}%;background:${col}"></b>`:''}</div>`;
}
function rendrePrep(){
  const du=PREP.du,a=sonDe(du.a),b=sonDe(du.b),SA=lireStructure(a),SB=lireStructure(b);
  $('prT').innerHTML=`<span class="d0">${esc(a.nom)}</span> <i>→</i> <span class="d1">${esc(b.nom)}</span>`;
  if(!SA||!SB){$('prL').innerHTML='<p class="vide">Analyse de ces morceaux en cours… (reviens dans un instant)</p>';$('prV').innerHTML='';return}
  const v=du.trans;
  $('prV').innerHTML=v?`<div class="valide">✓ Transition validée : <b>${esc(NOMT[v.tech])}</b> · sortie à ${fmtT(v.exit)} · entrée à ${fmtT(v.entry)}${v.riser?' · riser':''} <button data-pa="retire">Retirer</button></div>`:'<p class="mu">Aucune transition validée : en mode automatique, l\'appli prendra la 1re de la liste. Écoute-les et valide celle que tu préfères.</p>';
  $('prL').innerHTML=PREP.props.map((P,k)=>{const ok=v&&v.tech==P.tech&&Math.abs(v.exit-P.exit)<.1&&Math.abs(v.entry-P.entry)<.1;
    return`<div class="prop${ok?' ok':''}" data-k="${k}">
      <div class="ph"><b>${esc(NOMT[P.tech])}</b><span class="et">${etoiles(P.score)}</span>${P.perso?'<span class="tag">modifiée</span>':''}${ok?'<span class="tag v">validée</span>':''}</div>
      <div class="fr"><small>${esc(a.nom)} · sortie à ${fmtT(P.exit)}</small>${frise(SA,P.exit,'#ffd27a')}<small>${esc(b.nom)} · entrée à ${fmtT(P.entry)}</small>${frise(SB,P.entry,'#5ef0d2')}</div>
      <ul>${P.raisons.map(r=>'<li>'+esc(r)+'</li>').join('')}${P.riser?'<li>+ montée de bruit (riser) juste avant l\'entrée</li>':''}</ul>
      <div class="row"><button data-pa="ecoute" class="${AUTO.ecoute&&AUTO.ecoute.k==k?'stop':''}">${AUTO.ecoute&&AUTO.ecoute.k==k?'■ Arrêter l\'écoute':'▶ Écouter'}</button><button data-pa="valide" class="fort">✓ Valider</button><button data-pa="modif">✎ Modifier</button></div>
      ${PREP.ouvert==k?`<div class="modif">
        <div class="row"><span>Sortie de « ${esc(a.nom)} » :</span><button data-pa="ex-">− 16 temps</button><b>${fmtT(P.exit)}</b><button data-pa="ex+">+ 16 temps</button></div>
        <div class="row"><span>Entrée de « ${esc(b.nom)} » :</span><button data-pa="en-">− 4 temps</button><b>${fmtT(P.entry)}</b><button data-pa="en+">+ 4 temps</button><button data-pa="en0">Au début</button></div>
        <div class="row"><span>Technique :</span>${Object.keys(NOMT).map(t=>`<button data-pa="tech" data-t="${t}" class="${t==P.tech?'on':''}">${esc(NOMT[t])}</button>`).join('')}</div>
        <label class="chk"><input type="checkbox" data-pa="riser" ${P.riser?'checked':''}> Montée de bruit (riser) juste avant l'entrée</label></div>`:''}
    </div>`}).join('');
}
async function ecouter(k){
  if(AUTO.ecoute){const e=finEcoute();if(e&&e.k==k)return}
  const P=PREP.props[k],du=PREP.du;if(!P)return;
  if(D.some(d=>!d.a.paused)){toast('Mets les deux decks en pause pour écouter la transition');return}
  if(D[0].sonId!=du.a&&!(await chargerSon(0,du.a)))return;
  for(let n=0;n<80&&D.some(d=>d.chargement);n++)await sleep(100);
  if(D[1].sonId!=du.b&&!(await chargerSon(1,du.b)))return;
  for(let n=0;n<80&&D.some(d=>d.chargement);n++)await sleep(100);
  const X=D[0],O=D[1],avant=Math.min(12,P.exit);X.a.currentTime=Math.max(0,P.exit-avant);O.a.currentTime=P.entry;
  G.xf=0;VAL.xf=0;mix();dessiner('xf');
  AUTO.ecoute={k};rendrePrep();
  await X.a.play().catch(()=>{});
  const w=(P.exit-posOf(X))/rateOf(X),j=lancerAuto(X,O,P,Math.max(.1,w),true);
  if(!j){finEcoute();toast('Cette transition n\'est pas possible avec ces deux morceaux');return}
  AUTO.ecoute.t=setTimeout(finEcoute,(w+TEMPS_A[P.tech]*wallBeat(X)+10)*1000);
  toast('Écoute : la transition part dans '+Math.round(w)+' s');
}
function finEcoute(){if(!AUTO.ecoute)return;clearTimeout(AUTO.ecoute.t);const e=AUTO.ecoute;AUTO.ecoute=null;[...JOBS].forEach(j=>j.stop());D.forEach(d=>{pauseDeck(d)});guideEffacer();if(!$('prep').hidden)rendrePrep();return e}
function modifier(k,act,t){
  const P=PREP.props[k],du=PREP.du,SA=lireStructure(sonDe(du.a)),SB=lireStructure(sonDe(du.b));if(!P)return;
  const n=Object.assign({},P,{perso:true});
  if(act=='ex-'||act=='ex+'){const s=act=='ex+'?1:-1,v=+(P.exit+s*16*SA.beat).toFixed(3);if(v<SA.beat*8||v+(TEMPS_A[P.tech]+4)*SA.beat>SA.dur-2){toast('Impossible : trop près du début ou de la fin du morceau');return}n.exit=v}
  if(act=='en-'||act=='en+'){const s=act=='en+'?1:-1,v=+(P.entry+s*4*SB.beat).toFixed(3);if(v<0||v>SB.dur*.8)return;n.entry=v}
  if(act=='en0')n.entry=+SB.tDebut.toFixed(3);
  if(act=='tech'){const I=infosPaire(sonDe(du.a),sonDe(du.b));if((t=='eq_swap'||t=='filtre_out')&&I.g>8||t=='mix_long'&&I.g>8){toast('Tempos trop éloignés pour cette technique ('+nf(I.g,1)+' %)');return}
    n.tech=t;if(P.exit+(TEMPS_A[t]+4)*SA.beat>SA.dur-2)n.exit=+(SA.dur-2-(TEMPS_A[t]+4)*SA.beat).toFixed(3)}
  if(act=='riser')n.riser=!P.riser;
  if(!n.raisons.includes('Modifiée par toi'))n.raisons=['Modifiée par toi'].concat(n.raisons.filter(r=>!/^Sortie de|^Entrée de/.test(r)));
  PREP.props[k]=n;rendrePrep();
}
function initAuto(){
  $('logo').addEventListener('pointerdown',tapeLogo);$('logo').classList.toggle('auto',AUTO.on);
  $('prX').onclick=()=>{finEcoute();$('prep').hidden=true;rendreDuos()};
  $('prep').addEventListener('pointerdown',e=>{if(e.target.id=='prep'){finEcoute();$('prep').hidden=true;rendreDuos()}});
  const clic=e=>{
    const b=e.target.closest('[data-pa]');if(!b)return;const act=b.dataset.pa,c=e.target.closest('[data-k]'),k=c?+c.dataset.k:-1;
    if(act=='retire'){delete PREP.du.trans;sauverDuos();rendrePrep();toast('Transition retirée');return}
    if(act=='ecoute'){ecouter(k);return}
    if(act=='valide'){const P=PREP.props[k];PREP.du.trans={tech:P.tech,exit:P.exit,entry:P.entry,riser:!!P.riser,valide:Date.now()};sauverDuos();rendrePrep();toast('✓ Transition validée pour ce duo');return}
    if(act=='modif'){PREP.ouvert=PREP.ouvert==k?-1:k;rendrePrep();return}
    modifier(k,act,b.dataset.t);
  };
  $('prL').addEventListener('click',clic);$('prV').addEventListener('click',clic);
}
