'use strict';
/* ===== BeatDeck 5 · IA de mix : plans, transitions, mode AUTO ===== */
const PREF_DEF={style:'propre',anim:'discret',bloc:5,retour:true,valider:false,bac:'',ex:'stricte',mt:90,tm:'musical',tb:16,si:false,da:false,fx:false,ap:true,amb:'normal',ft:'',af:true,anaLive:false};
let PREF=Object.assign({},PREF_DEF);
let savePref=()=>{};
const AUTO={on:false,queue:[],played:new Set(),lastQ:false,mixNow:0,plan:[],rafale:0,fromDeck:0,SETP:{},info:null};
const KN={roll:'Roulement → drop',stutter:'Bégaiement → enchaînement',brake:'Freinage → entrée douce',spin:'Accélération → drop',echo:'Écho → drop',cut:'Coupure nette → drop'};
const LEAD=.05,tl=d=>d.a.duration?d.a.duration-d.a.currentTime:999;
const transitionEnCours=()=>!!jobActif('transition');
const tbNow=()=>AUTO.rafale>0?8:PREF.tb;

/* --- Bandeau d'aide --- */
let coachT=0;
function coach(t,tip,ttl){const c=$('coach');if(!c)return;clearTimeout(coachT);c.textContent=t||'';c.classList.toggle('on',!!t);if(ttl)coachT=setTimeout(()=>{c.textContent='';c.classList.remove('on')},ttl)}

/* --- Arrêt d'urgence --- */
function arretUrgence(){
  [...JOBS].forEach(j=>j.stop());
  setAuto(false,true);AUTO.mixNow=0;AUTO.rafale=0;if(typeof GARDE!='undefined'&&GARDE.on){GARDE.on=false;majGarde()}
  D.forEach(d=>{resetDeckFx(d);d.arm=0});mix();
  coach('');toast('Arrêt d\'urgence : tous les automatismes sont coupés, tu as la main');
}
function setAuto(on,quiet){AUTO.on=!!on;const b=$('au');if(b)b.classList.toggle('on',AUTO.on);
  if(!AUTO.on){const j=jobActif('auto-arm');if(j)j.stop();coach('')}
  if(!quiet)toast(AUTO.on?'AUTO activé : je mixe à ta place':'AUTO coupé : tu as la main')}

/* --- Point d'entrée dans le morceau suivant selon le geste --- */
function entryFor(n,kind,o){
  const L=entryList({pk:n.pk,bpm:n.bpm,off:n.off});
  if(!L.length)return{t:introPos(n)||0,why:'début du morceau'};
  if(kind=='brake'){const e0=o.pk?mn(cumul(o.pk),o.a.currentTime-8,o.a.currentTime):.5;L.sort((x,y)=>Math.abs(x.a-e0)-Math.abs(y.a-e0));return{t:L[0].t,why:'entrée douce à '+fmt(L[0].t)}}
  return{t:L[0].t,why:'drop à '+fmt(L[0].t)};
}

/* --- Enchaînements gestuels --- */
function chain(kind,entry,L0){
  if(transitionEnCours()){toast('Une transition est déjà en cours');return false}
  const L=L0!=null?L0:live(),o=D[L],N=1-L,n=D[N];
  if(o.a.paused||!o.grid||!n.grid||!n.a.src||!n.pk){toast('Il faut un morceau qui joue et le suivant chargé (tempo détecté)');return false}
  const p=beatLen(o),wall=wallBeat(o),len=Math.max(4,Math.round(2.5/wall/4)*4),beats={roll:16,stutter:3*len,spin:4,brake:2,echo:2,cut:0}[kind];
  if(tl(o)<(beats+2)*wall+6){toast('Trop près de la fin du morceau');return false}
  if(kind=='stutter'&&o.a.currentTime<(len+1)*p){toast('Trop tôt dans le morceau');return false}
  if(Math.abs(foldR(o.bpm*rateOf(o),n.bpm)-1)<=.08)match(n,o);else{n.rate=1;applyRate(n)}
  const ent=entry!=null?{t:entry,why:'entrée choisie'}:entryFor(n,kind,o),pn=beatLen(n),e=Math.max(0,n.off+Math.round((ent.t-n.off)/pn)*pn);
  const wait=((1-phaseOf(o))%1)*wall*1000;
  const j=new Job(KN[kind],{cle:'transition',auto:true});AUTO.fromDeck=L;
  const restore=()=>{if(o.lp)killLoop(o);o.rateMul=1;o.a.preservesPitch=o.keylock;applyRate(o);delete o.ov.flt;applyDeck(o);setMute(o,0)};
  j.onStop(st=>{if(st)restore()});
  toast(KN[kind]+' sur le prochain temps → '+ent.why);
  j.later(()=>{
    const s=o.off+Math.round((o.a.currentTime-o.off)/p)*p,t0=performance.now(),tot=beats*wall*1000;
    if(kind=='roll'){loopOn(o,4*p,{start:s});j.later(()=>loopOn(o,2*p,{start:s}),8*wall*1000);j.later(()=>loopOn(o,p,{start:s}),12*wall*1000);if(PREF.fx)riser(16*wall)}
    else if(kind=='stutter')loopOn(o,len*p,{start:Math.max(0,s-len*p)});
    else if(kind=='echo'){echoSend(o,{duree:wall});setMute(o,1)}
    else if(kind=='brake'||kind=='spin'){o.a.preservesPitch=false;
      j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/tot);o.rateMul=kind=='spin'?1+.4*k*k:Math.max(.08,1-.92*k*k);applyRate(o);return k<1});
      if(kind=='spin'&&PREF.fx)riser(4*wall)}
    if(PREF.fx&&['roll','spin','stutter'].includes(kind))j.frame(()=>{const k=Math.min(1,(performance.now()-t0)/tot);o.ov.flt=.5+.28*k;applyDeck(o);return k<1});
    j.later(()=>{
      restore();n.ov={};applyDeck(n);n.a.currentTime=e;n.a.play().catch(()=>{});G.xf=N;mix();
      o.a.pause();o.done=1;if(PREF.fx)sfx('impact');j.end();apresTransition(L,N,KN[kind]);
    },Math.max(0,tot-LEAD*1000));
  },wait);
  return true;
}
/* --- Fondu simple --- */
function mixFondu(beats){
  if(transitionEnCours()){toast('Une transition est déjà en cours');return false}
  const x0=G.xf,to=x0<.5?1:0,n=D[to],o=D[1-to];
  if(!n.a.src){toast('Charge un morceau sur le deck '+(to+1));return false}
  if(n.a.paused){if(PREF.si&&n.grid&&n.a.currentTime<1){const p0=introPos(n);if(p0>0)n.a.currentTime=p0}playDeck(n)}
  const dur=(beats||tbNow())*(o.bpm?wallBeat(o):.5)*1000,t0=performance.now(),j=new Job('Fondu vers le deck '+(to+1),{cle:'transition',auto:true});AUTO.fromDeck=1-to;
  j.onStop(()=>{delete o.ov.flt;delete n.ov.flt;applyDeck(o);applyDeck(n)});
  j.frame(()=>{const p=Math.min(1,(performance.now()-t0)/dur);G.xf=x0+(to-x0)*p;
    if(PREF.fx){o.ov.flt=.5+.3*p;n.ov.flt=.5-.22*(1-p)}mix();
    if(p>=1){o.a.pause();o.done=1;j.end();apresTransition(1-to,to,'Fondu');return false}});
  return true;
}

/* --- Plans de transition --- */
function getPlan(o,n,opt={}){
  const ra=recOf(o),rb=recOf(n);if(!ra||!rb)return null;
  const ia=o.cur&&o.cur.id,ib=n.cur&&n.cur.id,saved=ia&&ib&&(duoFor(ia,ib)||AUTO.SETP[ia+'>'+ib]);
  const base={propre:PREF.style!='festif',tb:tbNow(),skipIntro:PREF.si,near:opt.near??undefined,exitMin:o.a.currentTime+4,drop:PREF.da||PREF.amb=='chaud',tech:PREF.ft||null};
  if(opt.fixExit!=null)base.fixExit=opt.fixExit;
  let P=planPair(ra,rb,base);if(!P)return null;
  if(saved&&!PREF.ft&&!P.limited){const ok=saved.exit>o.a.currentTime+3&&opt.fixExit==null;P=refit(ra,rb,P,{tech:saved.tech,tb:saved.tb,entry:saved.entry,exit:ok?saved.exit:undefined,eq:saved.eq,fx:saved.fx},base);P.saved=1}
  P.ra=ra;P.rb=rb;return P;
}
const score=P=>P.issues.reduce((s,i)=>s+(i.sev=='err'?3:1),0);
function autoFixPlan(P,o){
  const fixed=[];if(!PREF.af||P.limited)return{P,fixed};
  for(let g=0;g<3;g++){const e=P.issues.find(x=>x.sev=='err'&&x.fix)||P.issues.find(x=>x.fix);if(!e)break;
    const N=refit(P.ra,P.rb,P,e.fix,{propre:PREF.style!='festif',tb:tbNow(),skipIntro:PREF.si,exitMin:o?o.a.currentTime+4:0});if(score(N)>=score(P))break;N.ra=P.ra;N.rb=P.rb;fixed.push(e.msg);P=N}
  return{P,fixed};
}
const planTxt=P=>planTxtF(P);

/* --- Exécuteur de transitions : même code pour le mix en direct et la préécoute du Studio --- */
function runPlan(E,P,done){
  const L=E.live(),N=1-L,o=E.D[L],n=E.D[N];
  if(!o.grid||!n.grid||!n.a.src){done&&done('nogrid');return false}
  if(P.nomatch)E.native(n);else E.match(n,o);const q=60/o.bpm/o.a.playbackRate,bn=60/n.bpm,tb=Math.max(1,P.tb||16),dur=tb*q*1000,tech=P.tech;
  const ent=Math.max(0,n.off+Math.round(((P.entry??n.off)-n.off)/bn)*bn),set=(i,k,v)=>E.set(i,k,v),B=(i,k)=>E.base(i,k),eq=P.eq||{};
  ['low','mid','hi','flt'].forEach(k=>set(N,k,null));
  if(BLENDISH.includes(tech)){set(N,'low',0);if(eq.midCut)set(N,'mid',.15)}
  let wait;const dt=P.exit==null?9:P.exit-o.a.currentTime;
  if(dt>-.05&&dt<6)wait=Math.max(0,dt/o.a.playbackRate*1000-40);else{const ph=(((o.a.currentTime-o.off)/(60/o.bpm))%1+1)%1;wait=((1-ph)%1)*q*1000}
  const fin=()=>{['low','mid','hi','flt'].forEach(k=>{set(L,k,null);set(N,k,null)});E.loop(L,null);E.mute(L,0);E.xf(N);o.a.pause();E.restore(L);done&&done('ok')};
  const run=fr=>{const t0=performance.now();E.frame(()=>{const p=Math.min(1,(performance.now()-t0)/dur);fr(p);if(p>=1){fin();return false}})};
  E.later(()=>{
    if(tech=='cut'){n.a.currentTime=ent;n.a.play().catch(()=>{});E.xf(N);if(P.fx&&P.fx.impact)E.impact();fin();return}
    if(tech=='drop'){
      const p=60/o.bpm,s=o.off+Math.round((o.a.currentTime-o.off)/p)*p;
      E.loop(L,s,4*p);E.later(()=>E.loop(L,s,2*p),8*q*1000);E.later(()=>E.loop(L,s,p),12*q*1000);if(P.fx&&P.fx.riser)E.riser(16*q);
      E.later(()=>{n.a.currentTime=ent;n.a.play().catch(()=>{});E.xf(N);E.loop(L,null);if(P.fx&&P.fx.impact)E.impact();fin()},Math.max(0,dur-50));
      const t0=performance.now();E.frame(()=>{const k=(performance.now()-t0)/dur;if(k>=1)return false;if(PREF.fx)set(L,'flt',.5+.28*k)});return}
    n.a.currentTime=ent;n.a.play().catch(()=>{});
    if(tech=='echo'){E.echo(L,q);E.mute(L,1);E.xf(N);run(p=>set(N,'low',lerp(.15,B(N,'low'),p)));return}
    run(p=>{
      const e=smth(0,1,p);E.xf(lerp(L,N,tech=='filter'?smth(.25,.85,p):e));
      if(tech=='blend'){set(L,'low',lerp(B(L,'low'),0,smth(.3,.8,p)));set(N,'low',lerp(0,B(N,'low'),smth(.45,.95,p)))}
      else{const s=tech=='bassswap'?.5:.6,w=Math.min(.2,1/tb);set(L,'low',lerp(B(L,'low'),0,smth(s-w/2,s+w/2,p)));set(N,'low',lerp(0,B(N,'low'),smth(s-w/2,s+w/2,p)))}
      if(eq.midCut){set(L,'mid',lerp(B(L,'mid'),.15,smth(.2,.7,p)));set(N,'mid',lerp(.15,B(N,'mid'),smth(.4,.9,p)))}
      if(tech=='filter'){set(L,'flt',.5+.38*e);set(N,'flt',.5-.34*(1-smth(0,.8,p)))}
      set(L,'hi',lerp(B(L,'hi'),B(L,'hi')*.7,p));
    });
  },wait);
  return true;
}
function liveEngine(j){
  return{D,live:()=>live(),match:(n,o)=>match(n,o),native:n=>{n.rate=1;n.rateMul=1;n.syncLock=false;applyRate(n)},
    set:(i,k,v)=>{if(v==null)delete D[i].ov[k];else D[i].ov[k]=v;applyDeck(D[i])},base:(i,k)=>D[i].k[k],
    xf:v=>{G.xf=v;mix()},mute:(i,b)=>setMute(D[i],b),
    loop:(i,s,len)=>{const d=D[i];if(s==null){if(d.lp)killLoop(d)}else loopOn(d,len,{start:s})},
    echo:(i,w)=>echoSend(D[i],{duree:w}),riser:s=>{if(PREF.fx)riser(s)},impact:()=>sfx('impact'),
    restore:i=>{const d=D[i];d.rateMul=1;d.a.preservesPitch=d.keylock;applyRate(d);d.done=1},
    later:(f,ms)=>j.later(f,ms),frame:f=>j.frame(f)};
}
function runLive(P){
  if(transitionEnCours())return false;const L=live();AUTO.fromDeck=L;
  const j=new Job('Transition : '+planTxt(P),{cle:'transition',auto:true});
  j.onStop(st=>{if(st){D.forEach(d=>{d.ov={};applyDeck(d);setMute(d,0);if(d.lp)killLoop(d)})}});
  if(!runPlan(liveEngine(j),P,()=>{j.end();apresTransition(L,1-L,planTxt(P))})){j.stop();return false}return true;
}
function aiMix(man){
  if(transitionEnCours()){toast('Une transition est déjà en cours');return false}
  const L=live(),o=D[L],n=D[1-L];
  if(o.a.paused){toast('Aucun morceau ne joue');return false}
  if(!n.a.src||!n.grid){toast('Le morceau suivant n\'est pas prêt (chargé et tempo détecté)');return false}
  const nb=()=>{const p=beatLen(o);return o.off+Math.ceil((o.a.currentTime-o.off)/p)*p};
  let P=!man&&o.plan&&o.planN===n.cur&&o.plan.exit>o.a.currentTime-.3?o.plan:getPlan(o,n,{fixExit:nb()});
  if(!P||P.limited){toast('Analyse incomplète : fondu simple à la place');return mixFondu()}
  const r=autoFixPlan(P,o);P=r.P;const left=P.issues;
  if(r.fixed.length)coach('Corrigé avant le mix : '+r.fixed[0]+' → '+planTxt(P),0,9000);
  else if(left.length)coach('Attention : '+left[0].msg,0,9000);else coach('Mix : '+planTxt(P),0,6000);
  return runLive(P);
}
function startMix(L,man){
  if(transitionEnCours())return;const n=D[1-L];if(AUTO.rafale>0)AUTO.rafale--;
  if(PREF.ap&&n.grid&&n.bpm&&aiMix(man))return;
  if(!PREF.ap&&PREF.da&&n.grid&&n.bpm&&chain('roll'))return;
  mixFondu();
}
function autreTitre(){
  const N=1-live(),n=D[N];
  if(transitionEnCours()||!n.a.paused){toast('Impossible pendant un mix');return}
  if(n.cur){const o=D[1-N];if(o.cur)noterRefus(o.cur.id,n.cur.id);n.done=1;toast('Noté : je ne referai pas ce duo. Je cherche un autre morceau…')}else toast('Rien à changer pour le moment');
}

/* --- Mode AUTO --- */
const infoOf=it=>it.name+(it.r&&it.r.bpm?' · '+Math.round(it.r.bpm)+' BPM · '+cm(it.r.key):'');
let autoBusy=0;
async function autoTick(){
  if(!AUTO.on||autoBusy)return;autoBusy=1;
  try{
    const L=live(),N=1-L,o=D[L],n=D[N],qn=AUTO.queue.length?' · file : '+AUTO.queue.length:'';
    if(transitionEnCours()){coach('Transition en cours vers le deck '+(1-AUTO.fromDeck+1)+qn);return}
    if(!lib.some(x=>x.r&&x.r.bpm)){coach('Choisis ton dossier de musique (bouton Morceaux), je m\'occupe du reste');return}
    if(!o.cur&&o.a.src&&!o.a.paused)o.cur={name:o.name,id:'m'+L};
    if(!o.cur){const it=pickNext(null);if(!it)return;AUTO.played.add(it.id);coach('Je charge : '+infoOf(it));await chargerDeck(L,it);return}
    if(AUTO.queue.length&&n.cur&&!n.done&&!n.fromQ&&n.a.paused){AUTO.played.delete(n.cur.id);n.cur=null}
    if(!n.cur||n.done||!n.a.src){
      const ro=recOf(o),it=pickNext(ro?{r:ro,id:o.cur&&o.cur.id}:null);if(!it)return;
      const fromQ=AUTO.lastQ;AUTO.played.add(it.id);it.r.gf=famOf(it.r,it.id);
      const s=ro?pairScore(ro,it.r):null;coach(AUTO.warn||('Je prépare : '+infoOf(it)+(s?' · compatibilité '+Math.round(s.total*100)+' %'+(s.son!=null?' · style '+Math.round(s.son*100)+' %':''):'')));
      await chargerDeck(N,it);n.fromQ=fromQ;return}
    if(!n.grid){coach('Je prépare : '+n.name);return}
    if(o.a.ended){G.xf=N;mix();playDeck(n);o.done=1;return}
    if(o.a.paused){coach('Appuie sur lecture du deck '+(L+1)+' pour lancer la soirée'+qn);return}
    if(typeof GARDE!='undefined'&&GARDE.on&&GARDE.deck==L){if(AUTO.mixNow)setGarde(false);else{coach('♥ Je garde ce morceau'+(GARDE.tours?' (tour '+(GARDE.tours+1)+')':'')+' · réappuie sur ♥ GARDER pour repartir'+qn);return}}
    if(jobActif('auto-arm'))return;
    const dur=tbNow()*wallBeat(o);
    if(o.dl==null)o.dl=o.a.currentTime+(AUTO.plan.length?AUTO.plan.shift():(PREF.mt||1e9));
    if(!o.plan||o.planN!==n.cur){
      const prec=PREF.tm=='precis'&&isFinite(o.dl)&&o.dl<1e8;
      const near=Math.min(o.dl,Math.max(o.a.currentTime+5,(o.a.duration||1e9)-dur-40));
      const P0=getPlan(o,n,prec?{fixExit:Math.max(o.a.currentTime+4,snapBeat(o,o.dl))}:{near});
      o.plan=P0;o.planN=n.cur;
      AUTO.info={dl:o.dl,exit:P0&&P0.exit,deck:L};
      if(P0&&P0.exit!=null&&P0.exit>o.a.currentTime+2&&!P0.limited)o.dl=P0.exit}
    const tx=AUTO.mixNow?0:Math.min(tl(o)-dur-14,o.dl-o.a.currentTime);
    if(PREF.valider&&!AUTO.mixNow&&o.valideN!==n.cur&&o.plan){if(tx<=20)ouvrirApercu(L);if(tx<=2.5){o.dl=o.a.currentTime+32*beatLen(o);o.plan=null;coach('J\'attends ta validation : je prolonge de 32 temps');return}}
    if(AUTO.mixNow||tx<=2.5){const man=AUTO.mixNow;AUTO.mixNow=0;coach('Mix imminent…');const j=new Job('Mix programmé',{cle:'auto-arm',auto:true});
      j.later(()=>{j.end();startMix(L,man)},Math.max(0,tx/rateOf(o)-.04)*1000);return}
    coach(tx>25?'Prochain : '+n.name+' (deck '+(N+1)+') · mix dans '+fmt(Math.round(tx))+(o.plan?' · '+planTxt(o.plan):'')+qn:'Mix dans '+Math.round(tx)+' s'+qn);
  }catch(e){console.error(e)}finally{autoBusy=0}
}
setInterval(autoTick,700);
/* durée « ce morceau seulement » */
function dureeCeMorceau(k){
  if(transitionEnCours()||jobActif('auto-arm')){toast('Un mix est en cours, réessaie juste après');return}
  const s=k=='x2'?30:k=='raf'?20:+k,o=D[live()];
  AUTO.plan=k=='x2'?[30]:k=='raf'?[20,20,20]:[];AUTO.rafale=k=='raf'?4:0;
  if(o.a.src&&!o.a.paused){o.dl=s?o.a.currentTime+s:1e9;o.plan=null}else{o.dl=null;if(s)AUTO.plan.unshift(s)}
  AUTO.mixNow=0;toast('Ce morceau : '+lblDur(k));
}
const lblDur=k=>k=='raf'?'rafale (4 morceaux de 20 s)':k=='x2'?'2 × 30 s':+k==0?'jusqu\'à la fin':(+k<60?k+' s':nf(+k/60,+k%60?1:0)+' min');
