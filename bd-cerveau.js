'use strict';
/* ===== BeatDeck 6 · le « cerveau DJ » : des transitions pensées pour CHAQUE duo =====
   Pour un duo A → B, il regarde où se trouvent dans chaque morceau les refrains, la voix (estimée), les pauses,
   les montées, l'intro et la fin, puis il essaie des centaines de combinaisons
   (technique × moment de sortie de A × moment d'entrée de B) et les note comme le ferait un DJ :
   - ne jamais faire chanter deux voix en même temps,
   - ne pas couper un refrain, ne pas rater une montée,
   - garder l'énergie (ou la faire redescendre si c'est voulu),
   - mélanger longtemps seulement si tempos et tonalités le permettent,
   - prolonger le dernier mot avec un écho ou une réverb, entrer sur un refrain connu avec une coupure, etc.
   Il garde les meilleures idées, toutes différentes, avec leurs raisons.
   Limite honnête : il repère OÙ quelqu'un chante, il ne comprend pas les paroles. */

const BLENDS={eq_swap8:8,eq_swap:16,mix_long:32,filtre_out:8,filtre_in:16};
const TECHS_IA=['eq_swap8','eq_swap','mix_long','filtre_out','filtre_in','echo_out','reverb_out','coupure','boucle_out','frein'];

// moments où A peut sortir (début de phrase de 16 temps), avec ce qui s'y passe
function sortiesIA(S){
  const L=[];
  for(let p=Math.max(2,Math.ceil(S.P*.35));p<S.P;p++){
    const c={t:+S.t(p).toFixed(3),p,tags:[]};
    const fortAv=S.type[p-1]=='fort',fortIci=S.type[p]=='fort';
    if(fortAv&&S.voix[p-1]&&!(fortIci&&S.voix[p]))c.tags.push('finRefrain');
    if(S.voix[p-1]&&!S.voix[p])c.tags.push('finVoix');
    if(S.voix[p])c.tags.push('voixContinue');
    if(S.breaks.includes(p))c.tags.push('pause');
    if(S.outro!=null&&p>=S.outro)c.tags.push('outro');
    if(fortAv&&fortIci)c.tags.push('dansRefrain');
    if(S.drops.includes(p))c.tags.push('avantDrop');
    if(fortAv)c.tags.push('energieHaute');
    L.push(c);
  }
  return L;
}
// moments où B peut entrer
function entreesIA(S){
  const L=[],ajout=(t,tag,txt)=>{t=+Math.max(0,t).toFixed(3);if(!L.some(e=>Math.abs(e.t-t)<S.beat*2))L.push({t,tag,txt,p:S.pa(t)})};
  ajout(S.tDebut,'debut','par son début');
  const pd=S.drops.find(p=>S.t(p)<S.dur*.55&&p>=1);
  if(pd!=null){ajout(S.t(pd)-16*S.beat,'avantDrop','16 temps avant sa 1re montée');ajout(S.t(pd),'drop','directement sur sa 1re partie forte')}
  const pr=S.type.findIndex((x,p)=>x=='fort'&&S.voix[p]&&S.t(p)<S.dur*.6);if(pr>=0)ajout(S.t(pr),'refrain','directement sur son refrain');
  const pc=S.voix.findIndex((v,p)=>v&&S.type[p]!='fort'&&S.t(p)<S.dur*.5);if(pc>=0)ajout(S.t(pc),'couplet','au début du chant');
  return L;
}
const fen=(S,p,n)=>{const r=[];for(let k=p;k<Math.min(S.P,p+Math.max(1,Math.ceil(n/16)));k++)r.push(k);return r};

function evaluerIA(tech,ex,en,ctx){
  const{SA,SB,g,tonOK,a,b}=ctx,N=BLENDS[tech]||0,blend=N>0,R=[];let s=.5;
  // règles de base : tempo et place
  if(blend){if(g>8||tech=='mix_long'&&g>3||tech=='eq_swap'&&g>6)return null}
  if(ex.t+(TEMPS_A[tech]+4)*SA.beat>SA.dur-2)return null;
  if(tech=='filtre_in'&&en.tag!='avantDrop'&&en.tag!='debut')return null;
  if(blend&&(en.tag=='drop'||en.tag=='refrain'))return null;          // on ne mélange pas longtemps en entrant sur un refrain
  if(!blend&&tech!='filtre_in'&&en.tag=='avantDrop')return null;
  // sortie de A
  if(ex.tags.includes('dansRefrain')){s-=.5;R.push('coupe A en plein refrain')}
  if(ex.tags.includes('avantDrop')){s-=.35;R.push('A allait monter juste là : on raterait sa montée')}
  if(ex.tags.includes('finRefrain')){s+=.3;R.push('A sort juste après son refrain')}
  if(ex.tags.includes('outro')){s+=.2;R.push('A est dans sa partie finale')}
  if(ex.tags.includes('pause')&&(tech=='filtre_in'||tech=='filtre_out'||tech=='reverb_out')){s+=.25;R.push('A entre dans une pause : idéal pour glisser le suivant')}
  if((tech=='echo_out'||tech=='reverb_out')){
    if(ex.tags.includes('finVoix')){s+=.35;R.push((tech=='echo_out'?'l\'écho':'la réverb')+' prolonge le dernier mot de A')}
    else if(ex.tags.includes('voixContinue')){s-=.25;R.push('couperait une phrase chantée de A')}}
  if(tech=='boucle_out'&&ex.tags.includes('finRefrain')){s+=.15;R.push('la boucle répète la fin du refrain pour faire monter l\'attente')}
  const rel=ex.t/SA.dur;s+=.15*clamp(1-Math.abs(rel-.8)*4);if(rel<.5){s-=.2;R.push('on couperait beaucoup de A')}
  // entrée de B
  const eB=SB.PE[en.p]||0,eA=SA.PE[Math.max(0,ex.p-1)]||0;
  if(blend){
    const wa=fen(SA,ex.p,N),wb=fen(SB,en.p,N),vA=wa.some(k=>SA.voix[k]),vB=wb.some(k=>SB.voix[k]);
    if(vA&&vB){s-=.6;R.push('les deux voix se chevaucheraient')}
    else if(!vA&&!vB){s+=.25;R.push('aucune voix pendant le mélange : très propre')}
    else{s+=.08;R.push(vA?'seul A chante pendant le mélange':'seul B chante pendant le mélange')}
    if(tonOK===false){if(tech.startsWith('filtre')){s-=.08;R.push('tonalités différentes, mais le filtre les adoucit')}else if(N>=16){s-=.35;R.push('les tonalités se heurteraient sur '+N+' temps')}else{s-=.12;R.push('tonalités différentes : mélange court')}}
    else if(tonOK&&N>=16){s+=.15;R.push('tonalités compatibles : mélange harmonieux')}
    if(tech.startsWith('eq_swap')||tech=='mix_long'){if(wa.some(k=>SA.basse[k])&&wb.some(k=>SB.basse[k])){s+=.08;R.push('les basses s\'échangent sans se battre')}}
    if(en.tag=='debut'){s+=.15;R.push('B commence par son intro, faite pour mélanger');if(eB<.6&&eA<.75){s+=.12;R.push('deux passages calmes qui se superposent en douceur')}}
    if(eA>=.75&&!ex.tags.includes('outro')){s-=.15;R.push('A est encore très énergique pour un long mélange')}
    if(tech=='mix_long'&&g<=2){s+=.15;R.push('tempos quasi identiques : on peut mélanger longtemps')}
    if(g<=3){s+=.2;R.push('tempos très proches : mélanger est le choix naturel d\'un DJ')}
    if(tech=='filtre_in'&&en.tag=='avantDrop'){s+=.35;R.push('B monte étouffé puis explose sur sa montée au moment où A s\'arrête')}
    if(tech=='filtre_out'&&eB<eA){s+=.12;R.push('fait redescendre l\'ambiance en douceur')}
  }else{
    if(g>8){s+=.2;R.push('tempos trop différents pour mélanger : on enchaîne net')}
    else if(g<=3){s-=.12;R.push('dommage de couper : les tempos permettraient de mélanger')}
    if(en.tag=='drop'||en.tag=='refrain'){let bonus=0;
      if(eA>=.6||ex.tags.includes('finRefrain')){bonus+=.2;R.push('l\'énergie reste au maximum')}
      if(en.tag=='refrain'&&tech=='coupure'){bonus+=.25;R.push('B arrive direct sur son refrain : effet garanti s\'il est connu')}
      if(en.tag=='drop'&&(tech=='coupure'||tech=='boucle_out'||tech=='echo_out')){bonus+=.15;R.push('B explose sur sa partie forte')}
      s+=Math.min(.35,bonus)}
    if(en.tag=='debut'){if(tech=='coupure'){s-=.15;R.push('B démarre doucement après une coupure : moins d\'impact')}else{s+=.05}}
    if(en.tag=='couplet'&&tech=='echo_out'){s+=.08;R.push('B enchaîne directement avec du chant')}
    if(tech=='frein'){if((a.meta.bpm||120)<105){s+=.15;R.push('freinage de vinyle : classique en rap')}else s-=.1}
    if(tech=='reverb_out'&&eA<.6){s+=.12;R.push('fin douce et aérienne')}
  }
  if((tech=='coupure'||tech=='boucle_out')&&en.tag=='drop')R.push('+ montée de bruit (riser) avant l\'entrée');
  const riser=(tech=='coupure'||tech=='boucle_out')&&en.tag=='drop';
  const res=`À ${fmtT(ex.t)} : ${NOMT[tech]}, puis « ${b.nom} » entre ${en.txt} (${fmtT(en.t)})`;
  return{tech,exit:ex.t,entry:en.t,riser,score:s,raisons:R,resume:res,cle:tech+'|'+ex.p+'|'+en.tag};
}

function cerveau(du,o={}){
  const a=sonDe(du.a),b=sonDe(du.b),SA=lireStructure(a),SB=lireStructure(b);if(!SA||!SB)return null;
  const g=Math.abs(foldR(a.meta.bpm,b.meta.bpm)-1)*100;let tonOK=null;
  if(a.meta.key&&b.meta.key){const K=a.meta.key,L=b.meta.key,d=Math.min((K.n-L.n+12)%12,(L.n-K.n+12)%12);tonOK=d==0||(d==1&&K.b==L.b)}
  const ctx={SA,SB,g,tonOK,a,b};
  let EX=sortiesIA(SA);
  if(o.exitFixe!=null){const p=SA.pa(o.exitFixe),base=EX.find(e=>e.p==p)||{p,tags:[]};EX=[Object.assign({},base,{t:+o.exitFixe.toFixed(3)})]}
  const EN=entreesIA(SB),C=[];
  for(const ex of EX)for(const en of EN)for(const tech of TECHS_IA){const r=evaluerIA(tech,ex,en,ctx);if(r)C.push(r)}
  C.sort((x,y)=>y.score-x.score);
  // on garde des idées vraiment différentes : d'abord une par technique, puis d'autres placements
  const out=[],vus=new Set();
  for(const c of C){if(out.length>=6)break;if(vus.has(c.tech))continue;vus.add(c.tech);out.push(c)}
  for(const c of C){if(out.length>=7)break;if(out.some(x=>x.tech==c.tech&&(Math.abs(x.exit-c.exit)<1||Math.abs(x.entry-c.entry)<1)))continue;out.push(c)}
  const entete=['Tempos '+(g<=3?'très proches':g<=8?'proches':'éloignés')+' ('+nf(g,1)+' %)'].concat(tonOK==null?[]:[tonOK?'tonalités compatibles':'tonalités différentes']);
  out.forEach(c=>{c.raisons=entete.concat(c.raisons)});
  return out.sort((x,y)=>y.score-x.score);
}
