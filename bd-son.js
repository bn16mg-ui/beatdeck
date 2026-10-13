'use strict';
/* ===== BeatDeck 6 · moteur audio (tout se passe sur la tablette) =====
   Chaque deck : morceau → graves / aigus → filtre → volume → crossfader → volume général → limiteur → sortie.
   Écho et réverb sont branchés APRÈS le volume du deck : quand tu baisses le volume, la traîne d'écho continue (Echo Out). */
const AC=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
const LS={
  get(k,f){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(e){return f}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
let LAT=LS.get('bd5_lat',0);             // retard des enceintes Bluetooth, mesuré dans l'ancienne version (secondes)
const G={xf:.5,mg:.7};                   // crossfader (0 = deck 1, 1 = deck 2) et volume général

/* --- sortie : volume général → limiteur (protège les enceintes des saturations) --- */
const BUS={master:AC.createGain(),lim:AC.createDynamicsCompressor()};
BUS.lim.threshold.value=-3;BUS.lim.knee.value=0;BUS.lim.ratio.value=20;BUS.lim.attack.value=.002;BUS.lim.release.value=.15;
BUS.master.connect(BUS.lim);BUS.lim.connect(AC.destination);

/* --- réverb partagée --- */
const REV={cv:AC.createConvolver(),out:AC.createGain()};
{const n=Math.floor(AC.sampleRate*2.6),b=AC.createBuffer(2,n,AC.sampleRate);for(let c=0;c<2;c++){const x=b.getChannelData(c);for(let i=0;i<n;i++)x[i]=(Math.random()*2-1)*Math.pow(1-i/n,3.2)}REV.cv.buffer=b}
REV.out.gain.value=.8;REV.cv.connect(REV.out);REV.out.connect(BUS.master);

/* --- decks --- */
const D=[];
function mkDeck(i){
  const a=new Audio();a.preservesPitch=true;a.preload='auto';
  const src=AC.createMediaElementSource(a),n=()=>AC.createGain(),bq=t=>{const f=AC.createBiquadFilter();f.type=t;return f};
  const d={i,a,elG:n(),inp:n(),trim:n(),fl:bq('lowshelf'),fh:bq('highshelf'),fi:bq('allpass'),gate:n(),ag:n(),fad:n(),fdl:AC.createDelay(.05),ffb:n(),fw:n(),flfo:AC.createOscillator(),flg:n(),
    eS:n(),dly:AC.createDelay(4),fb:n(),hp:bq('highpass'),wet:n(),rS:n(),
    nom:'',buf:null,pk:null,bpm:0,off:0,grid:false,norm:1,dur:0,cue:0,hc:[null,null],lp:null,loopLen:4,
    rate:1,nudge:1,k:{vol:.8,hi:.5,low:.5,flt:.5},ov:{},flangerOn:false,syncLock:false,echoOn:false,revOn:false,mute:0,chargement:false,url:null,pend:null};
  d.fl.frequency.value=180;d.fh.frequency.value=3200;d.fi.Q.value=.75;
  d.hp.frequency.value=220;d.fb.gain.value=.55;d.wet.gain.value=.85;d.dly.delayTime.value=.375;
  [d.eS,d.rS].forEach(g=>g.gain.value=0);
  src.connect(d.elG);d.elG.connect(d.inp);d.inp.connect(d.trim);d.trim.connect(d.fl);d.fl.connect(d.fh);d.fh.connect(d.fi);
  d.fi.connect(d.gate);d.gate.connect(d.ag);d.ag.connect(d.fad);d.fad.connect(BUS.master);
  // flanger : copie du son très légèrement retardée, le retard oscille doucement
  d.fdl.delayTime.value=.004;d.ffb.gain.value=.55;d.fw.gain.value=0;d.flfo.frequency.value=.22;d.flg.gain.value=.0032;
  d.flfo.connect(d.flg);d.flg.connect(d.fdl.delayTime);d.flfo.start();
  d.fi.connect(d.fdl);d.fdl.connect(d.ffb);d.ffb.connect(d.fdl);d.fdl.connect(d.fw);d.fw.connect(d.gate);
  d.fad.connect(d.eS);d.eS.connect(d.dly);d.dly.connect(d.hp);d.hp.connect(d.fb);d.fb.connect(d.dly);d.dly.connect(d.wet);d.wet.connect(BUS.master);
  d.fad.connect(d.rS);d.rS.connect(REV.cv);
  a.addEventListener('pause',()=>{if(d.lp&&!d.lp.slip)killLoop(d)});
  a.addEventListener('ended',()=>{if(d.lp)killLoop(d)});
  return d;
}
for(let i=0;i<2;i++)D.push(mkDeck(i));

/* --- réglages de son --- */
const kdb=v=>v<=.01?-60:v<.5?(v-.5)*52:(v-.5)*16;   // à gauche on coupe (jusqu'à −26 dB, tout à gauche = coupé), à droite on renforce (+8 dB)
function applyDeck(d){
  const T=AC.currentTime;
  d.trim.gain.setTargetAtTime(d.norm,T,.05);
  const k=x=>d.ov[x]!=null?d.ov[x]:d.k[x];   // un raccourci peut prendre la main un moment (ov), ton réglage revient ensuite
  d.fl.gain.setTargetAtTime(kdb(k('low')),T,.012);
  d.fh.gain.setTargetAtTime(kdb(k('hi')),T,.012);
  const f=k('flt');  // filtre : à gauche passe-bas (son étouffé), à droite passe-haut (son fin), au milieu rien
  if(Math.abs(f-.5)<.03){if(d.fi.type!='allpass')d.fi.type='allpass'}
  else if(f<.5){if(d.fi.type!='lowpass')d.fi.type='lowpass';d.fi.frequency.setTargetAtTime(20000*Math.pow(.01,(.5-f)*2),T,.01)}
  else{if(d.fi.type!='highpass')d.fi.type='highpass';d.fi.frequency.setTargetAtTime(20*Math.pow(60,(f-.5)*2),T,.01)}
}
const xfc=i=>i?Math.sin(G.xf*Math.PI/2):Math.cos(G.xf*Math.PI/2);
function mix(){
  const T=AC.currentTime;BUS.master.gain.setTargetAtTime(G.mg*1.3,T,.03);
  D.forEach((d,i)=>{d.fad.gain.setTargetAtTime(d.k.vol*d.k.vol*xfc(i),T,.02);applyDeck(d)});
}
/* deck qu'on entend le plus (côté du crossfader, et qui joue) */
function live(){const x=G.xf<.5?0:1;if(D[x].a.paused&&!D[1-x].a.paused)return 1-x;return x}

/* --- vitesse et temps musicaux --- */
const rateOf=d=>d.a.playbackRate||1;
function applyRate(d){
  const r=clamp(d.rate*d.nudge,.5,2);d.a.playbackRate=r;
  const L=d.lp;if(L&&L.src){const T=AC.currentTime;if(T>=L.t0){L.off=loopPos(d);L.t0=T}L.rate=r;L.src.playbackRate.setValueAtTime(r,T)}
}
const beatLen=d=>60/(d.bpm||120);
const wallBeat=d=>beatLen(d)/rateOf(d);
const snapBeat=(d,t,div=1)=>{const p=beatLen(d)/div;return d.off+Math.round((t-d.off)/p)*p};
const nextBeat=(d,t,div=1)=>{const p=beatLen(d)/div;return d.off+Math.ceil((t-d.off)/p-1e-6)*p};
function posOf(d){return d.lp&&d.lp.src?loopPos(d):d.a.currentTime}
const heard=d=>Math.max(0,posOf(d)-LAT*rateOf(d));      // ce que tu entends vraiment (retard Bluetooth compensé)
const phaseOf=d=>((((posOf(d)-d.off)/beatLen(d))%1)+1)%1;
const foldR=(a,b)=>{let r=b/a;while(r>1.4)r/=2;while(r<.7)r*=2;return r};

/* --- boucles précises à l'échantillon (lecture depuis le morceau décodé) --- */
function loopPos(d){
  const L=d.lp;if(!L||!L.src)return d.a.currentTime;
  const T=AC.currentTime;if(T<L.t0)return d.a.currentTime;
  return L.s+((((L.off-L.s)+(T-L.t0)*L.rate)%L.len)+L.len)%L.len;
}
function loopOn(d,len,o={}){
  if(!d.a.src||d.a.paused)return false;
  const r=rateOf(d),cur=posOf(d),h=cur-LAT*r;
  let s=o.start!=null?o.start:(d.grid?snapBeat(d,h):h);if(s<0)s=0;
  if(!d.buf){d.lp={s,len,legacy:true,slip:!!o.slip};return true}       // secours si le décodage a échoué
  if(s+len>d.buf.duration)return false;
  const T=AC.currentTime;let t0=T+.008,off;
  if(s>cur){t0=T+(s-cur)/r;off=s}else off=s+((cur-s)%len);
  const src=AC.createBufferSource(),g=AC.createGain();
  src.buffer=d.buf;src.loop=true;src.loopStart=s;src.loopEnd=s+len;src.playbackRate.value=r;
  g.gain.value=0;src.connect(g);g.connect(d.inp);src.start(t0,off);
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(1,t0+.006);
  const prev=d.lp;
  if(prev&&prev.src){prev.g.gain.cancelScheduledValues(T);prev.g.gain.setValueAtTime(1,t0);prev.g.gain.linearRampToValueAtTime(0,t0+.006);try{prev.src.stop(t0+.03)}catch(e){}}
  else{d.elG.gain.cancelScheduledValues(T);d.elG.gain.setValueAtTime(1,t0);d.elG.gain.linearRampToValueAtTime(0,t0+.006)}
  d.lp={s,len,src,g,t0,off,rate:r,slip:prev?prev.slip:!!o.slip};
  return true;
}
function loopOff(d){
  const L=d.lp;if(!L)return;d.lp=null;if(L.legacy)return;
  const T=AC.currentTime,fade=n=>{d.elG.gain.cancelScheduledValues(n);d.elG.gain.setValueAtTime(0,n);d.elG.gain.linearRampToValueAtTime(1,n+.012);
    L.g.gain.cancelScheduledValues(n);L.g.gain.setValueAtTime(1,n);L.g.gain.linearRampToValueAtTime(0,n+.012);try{L.src.stop(n+.05)}catch(e){}};
  if(L.slip||d.a.paused){fade(T);return}   // roulement : le morceau a continué en dessous, on le retrouve là où il en est
  const p=loopPos(d);L.src.loop=false;     // boucle normale : on reprend à l'endroit de la boucle
  let fini=false;const go=()=>{if(fini)return;fini=true;d.a.removeEventListener('seeked',go);fade(AC.currentTime)};
  d.a.addEventListener('seeked',go);setTimeout(go,900);
  d.a.currentTime=Math.min(d.a.duration-.05,p+.06*L.rate);
}
function killLoop(d){const L=d.lp;if(!L)return;d.lp=null;if(L.src){try{L.src.stop()}catch(e){}L.g.disconnect()}
  const T=AC.currentTime;d.elG.gain.cancelScheduledValues(T);d.elG.gain.setValueAtTime(1,T)}
function loopLegacyTick(d){const L=d.lp;if(L&&L.legacy&&!d.a.paused&&d.a.currentTime>=L.s+L.len)d.a.currentTime=L.s+(d.a.currentTime-L.s-L.len)%L.len}

/* --- synchronisation : même tempo et temps alignés --- */
function match(f,l){if(!f.bpm||!l.bpm)return false;f.rate=foldR(f.bpm,l.bpm*rateOf(l)/(l.nudge||1));applyRate(f);return true}
function phaseAlign(f,l){
  if(!f.grid||!l.grid||f.a.paused||l.a.paused)return false;
  let dl=phaseOf(l)-phaseOf(f);dl-=Math.round(dl);f.a.currentTime=Math.max(0,f.a.currentTime+dl*beatLen(f));return true;
}
/* garde un deck synchronisé bien calé (corrige la petite dérive) */
setInterval(()=>{
  D.forEach((f,i)=>{const l=D[1-i];
    if(!f.syncLock||f.a.paused||l.a.paused||!f.grid||!l.grid||f.lp||l.lp||f.nudge!=1)return;
    let r=l.bpm*rateOf(l)/f.bpm/(l.nudge||1),k=1;while(r>1.4){r/=2;k*=2}while(r<.7){r*=2;k/=2}
    let dl=phaseOf(l)*k%1-phaseOf(f);dl-=Math.round(dl);
    if(Math.abs(dl)>.25){f.a.currentTime=Math.max(0,f.a.currentTime+dl*beatLen(f));return}
    f.rate=r*(1+clamp(dl,-.2,.2)*.04);applyRate(f);
  });
},400);

/* --- lecture --- */
function playDeck(d){
  AC.resume();if(!d.a.src){toast('Charge d\'abord un morceau sur le deck '+(d.i+1));return false}
  if(d.pend)return false;const o=D[1-d.i];
  // deck synchronisé : il démarre pile sur le temps de l'autre
  if(d.syncLock&&!o.a.paused&&o.grid&&d.grid&&!d.lp){
    match(d,o);const p=beatLen(d);d.a.currentTime=Math.max(0,d.off+Math.round((d.a.currentTime-d.off)/p)*p);
    const wait=(1-phaseOf(o))%1*wallBeat(o)*1000;
    d.pend=setTimeout(()=>{d.pend=null;d.a.play().catch(()=>{})},Math.max(0,wait-15));return true;
  }
  d.a.play().catch(()=>toast('Lecture impossible'));return true;
}
function pauseDeck(d){if(d.pend){clearTimeout(d.pend);d.pend=null}d.a.pause()}

/* --- effets --- */
function echoSet(d,on){
  d.echoOn=on;const T=AC.currentTime;
  if(on){d.dly.delayTime.setTargetAtTime(Math.min(3.9,wallBeat(d)*.75),T,.02);d.fb.gain.setTargetAtTime(.55,T,.02)}
  d.eS.gain.cancelScheduledValues(T);d.eS.gain.setTargetAtTime(on?1:0,T,.01);   // à l'arrêt, la traîne d'écho s'éteint toute seule
}
function flangerSet(d,on){d.flangerOn=on;const T=AC.currentTime;d.fw.gain.cancelScheduledValues(T);d.fw.gain.setTargetAtTime(on?.75:0,T,.03)}
function noise(sec){const n=Math.max(1,Math.floor(AC.sampleRate*sec)),b=AC.createBuffer(1,n,AC.sampleRate),x=b.getChannelData(0);for(let i=0;i<n;i++)x[i]=Math.random()*2-1;const s=AC.createBufferSource();s.buffer=b;return s}
/* montée de bruit avant un drop (Riser) */
function riser(sec,quand=0){
  const s=noise(sec),f=AC.createBiquadFilter(),g=AC.createGain(),T=AC.currentTime+quand;f.type='highpass';f.frequency.setValueAtTime(300,T);f.frequency.exponentialRampToValueAtTime(8000,T+sec);
  g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(.16,T+sec*.95);g.gain.linearRampToValueAtTime(0,T+sec);s.connect(f);f.connect(g);g.connect(BUS.master);s.start(T);return s;
}
/* volume automatique d'un deck (ne touche pas à ton bouton VOLUME) */
function agVers(d,v,dans=0,duree=.02){const T=AC.currentTime+Math.max(0,dans),g=d.ag.gain;g.cancelScheduledValues(T);g.setValueAtTime(g.value,T);g.linearRampToValueAtTime(v,T+Math.max(.005,duree))}
function agReset(d){const T=AC.currentTime;d.ag.gain.cancelScheduledValues(T);d.ag.gain.setTargetAtTime(1,T,.02)}
function revSet(d,on){d.revOn=on;const T=AC.currentTime;d.rS.gain.cancelScheduledValues(T);d.rS.gain.setTargetAtTime(on?1:0,T,on?.01:.05)}

/* --- analyse du tempo (sur la tablette, rien n'est envoyé sur Internet) --- */
function peaks(buf){
  const x=buf.getChannelData(0),B=Math.floor(buf.sampleRate/50),N=Math.floor(x.length/B),pk=new Float32Array(N);let mx=0;
  for(let k=0;k<N;k++){let m=0;for(let j=0;j<B;j+=16){const v=Math.abs(x[k*B+j]);if(v>m)m=v}pk[k]=m;if(m>mx)mx=m}
  for(let k=0;k<N;k++)pk[k]=Math.pow(pk[k]/(mx||1),.7);return pk;
}
function analyseTempo(buf){
  const x=buf.getChannelData(0),sr=buf.sampleRate,H=256;let sq=0,cn=0;for(let i=0;i<x.length;i+=64){sq+=x[i]*x[i];cn++}
  const n=Math.floor(Math.min(x.length,sr*120)/H),o=new Float32Array(n);let p=0;
  for(let i=0;i<n;i++){let s=0;for(let j=0;j<H;j++){const v=x[i*H+j];s+=v*v}s=Math.sqrt(s/H);o[i]=Math.max(0,s-p);p=s}
  const fps=sr/H,at=a=>{const i=Math.floor(a),f=a-i;return i>=0&&i+1<n?o[i]*(1-f)+o[i+1]*f:0};
  const sc=b=>{const L=60/b*fps;let s=0,c=0;for(let i=0;i+4*L<n;i++){s+=o[i]*(at(i+L)+at(i+2*L)+at(i+4*L));c++}return c?s/c:0};
  let best=0,bpm=120;for(let b=70;b<=180;b+=.5){const v=sc(b);if(v>best){best=v;bpm=b}}
  let b2=bpm,bb=0;for(let b=bpm-.6;b<=bpm+.6;b+=.02){const v=sc(b);if(v>bb){bb=v;b2=b}}
  const L=60/b2*fps;let ph=0;best=0;for(let q=0;q<L;q+=.25){let s=0;for(let t=q;t<n-1;t+=L)s+=at(t);if(s>best){best=s;ph=q}}
  return{bpm:Math.round(b2*100)/100,off:ph/fps,norm:Math.min(2,Math.max(.4,.12/(Math.sqrt(sq/cn)||.1)))};
}

/* --- chargement d'un fichier dans un deck --- */
async function chargerDeck(i,f){
  const d=D[i];if(!f)return false;
  if(!d.a.paused){toast('Le deck '+(i+1)+' joue : mets-le en pause avant de charger un autre morceau');return false}
  killLoop(d);pauseDeck(d);if(d.url)URL.revokeObjectURL(d.url);
  d.url=URL.createObjectURL(f);d.a.src=d.url;
  Object.assign(d,{nom:f.name.replace(/\.[^.]+$/,''),buf:null,pk:null,bpm:0,off:0,grid:false,norm:1,dur:0,cue:0,hc:[null,null],rate:1,nudge:1,syncLock:false,chargement:true,fichier:f,ov:{}});
  if(typeof stopDeckJobs=='function')stopDeckJobs(i);
  echoSet(d,false);revSet(d,false);flangerSet(d,false);agReset(d);applyRate(d);
  try{
    const buf=await AC.decodeAudioData(await f.arrayBuffer());
    if(d.fichier!==f)return false;
    d.buf=buf;d.pk=peaks(buf);d.dur=buf.duration;
    const r=analyseTempo(buf);d.bpm=r.bpm;d.off=r.off;d.norm=r.norm;d.grid=d.bpm>0;
  }catch(e){console.error(e);toast('Tempo non détecté pour « '+d.nom+' » : lecture possible, mais sans boucles ni SYNC')}
  d.chargement=false;mix();return true;
}

/* --- moments musicaux à venir (en secondes réelles d'attente) --- */
const attTemps=(d,n=1)=>{if(!d.grid||d.a.paused)return 0;const p=posOf(d),b=nextBeat(d,p)+(n-1)*beatLen(d);return Math.max(0,(b-p)/rateOf(d))};
const attMesure=d=>{if(!d.grid||d.a.paused)return 0;const p=posOf(d),bar=4*beatLen(d),t=d.off+Math.ceil((p-d.off)/bar-1e-6)*bar;return Math.max(0,(t-p)/rateOf(d))};
