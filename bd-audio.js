'use strict';
/* ===== BeatDeck 5 · moteur audio =====
   Chaque deck : élément <audio> (lecture longue, tempo sans changer la tonalité)
   + lecture depuis l'audio décodé pour les boucles, bégaiements et répétitions (précision à l'échantillon). */
const AC=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
const COL=['#3ab4ff','#ff4f93'];
let LAT=LS.get('bd5_lat',0);           // retard de sortie mesuré (secondes), ex. enceintes Bluetooth
const G={xf:0,mg:.8,egal:LS.get('bd5_egal',true)};

/* --- Bus de sortie : volume général → limiteur anti-pics → sortie --- */
const BUS={master:AC.createGain(),lim:AC.createDynamicsCompressor(),cue:AC.createGain(),cueLim:AC.createDynamicsCompressor(),split:false,nodes:[]};
[BUS.lim,BUS.cueLim].forEach(c=>{c.threshold.value=-3;c.knee.value=0;c.ratio.value=20;c.attack.value=.002;c.release.value=.15});
BUS.master.connect(BUS.lim);BUS.cue.connect(BUS.cueLim);BUS.cue.gain.value=1;
function route(split){
  try{BUS.lim.disconnect()}catch(e){}try{BUS.cueLim.disconnect()}catch(e){}
  BUS.nodes.forEach(n=>{try{n.disconnect()}catch(e){}});BUS.nodes=[];
  const d=AC.destination;
  if(split&&d.maxChannelCount>=4){
    d.channelCount=4;d.channelCountMode='explicit';d.channelInterpretation='discrete';
    const m=AC.createChannelMerger(4),a=AC.createChannelSplitter(2),b=AC.createChannelSplitter(2);
    BUS.lim.connect(a);a.connect(m,0,0);a.connect(m,1,1);BUS.cueLim.connect(b);b.connect(m,0,2);b.connect(m,1,3);m.connect(d);
    BUS.nodes=[m,a,b];BUS.split=true;
  }else{
    try{d.channelCount=2;d.channelInterpretation='speakers'}catch(e){}
    BUS.lim.connect(d);BUS.split=false;
  }
  return BUS.split;
}
route(false);

/* --- Écho (délai avec retour filtré) et réverbération partagés --- */
const FX={dly:AC.createDelay(4),fb:AC.createGain(),hp:AC.createBiquadFilter(),wet:AC.createGain(),cv:AC.createConvolver(),rv:AC.createGain()};
FX.fb.gain.value=.5;FX.wet.gain.value=.85;FX.hp.type='highpass';FX.hp.frequency.value=220;FX.dly.delayTime.value=.375;
FX.dly.connect(FX.hp);FX.hp.connect(FX.fb);FX.fb.connect(FX.dly);FX.dly.connect(FX.wet);FX.wet.connect(BUS.master);
{const n=Math.floor(AC.sampleRate*2.8),b=AC.createBuffer(2,n,AC.sampleRate);for(let c=0;c<2;c++){const x=b.getChannelData(c);for(let i=0;i<n;i++)x[i]=(Math.random()*2-1)*Math.pow(1-i/n,3.2)}FX.cv.buffer=b}
FX.rv.gain.value=.9;FX.cv.connect(FX.rv);FX.rv.connect(BUS.master);

/* --- Decks --- */
const D=[];
function mkDeck(i){
  const a=new Audio();a.preservesPitch=true;a.preload='auto';
  const src=AC.createMediaElementSource(a),n=()=>AC.createGain(),bq=t=>{const f=AC.createBiquadFilter();f.type=t;return f};
  const d={i,a,elG:n(),inp:n(),trim:n(),fl:bq('lowshelf'),fm:bq('peaking'),fh:bq('highshelf'),fi:bq('allpass'),gate:n(),fad:n(),an:AC.createAnalyser(),eS:n(),rS:n(),cS:n(),
    buf:null,pk:null,bpm:0,off:0,grid:false,r:null,key:null,norm:1,cue:0,hc:[null,null,null],lp:null,loopLen:4,
    rate:1,rateMul:1,nudge:1,keylock:true,k:{vol:.8,gain:.5,low:.5,mid:.5,hi:.5,flt:.5},ov:{},kill:{low:0,mid:0,hi:0},autoV:1,mute:0,
    cueOn:false,echoOn:false,syncLock:false,cur:null,done:0,name:'',url:null,loading:false,vb:new Uint8Array(256),pend:null};
  d.fl.frequency.value=180;d.fm.frequency.value=1000;d.fm.Q.value=.7;d.fh.frequency.value=3200;d.fi.Q.value=.75;d.an.fftSize=256;
  [d.eS,d.rS,d.cS].forEach(g=>g.gain.value=0);
  src.connect(d.elG);d.elG.connect(d.inp);d.inp.connect(d.trim);d.trim.connect(d.fl);d.fl.connect(d.fm);d.fm.connect(d.fh);d.fh.connect(d.fi);
  d.fi.connect(d.gate);d.gate.connect(d.fad);d.fad.connect(BUS.master);d.fad.connect(d.an);
  d.fi.connect(d.eS);d.eS.connect(FX.dly);d.fi.connect(d.rS);d.rS.connect(FX.cv);d.fi.connect(d.cS);d.cS.connect(BUS.cue);
  a.addEventListener('pause',()=>{if(d.lp)killLoop(d)});
  a.addEventListener('ended',()=>{if(d.lp)killLoop(d)});
  return d;
}
for(let i=0;i<2;i++)D.push(mkDeck(i));

/* --- Mixage --- */
const kdb=v=>v<=.004?-40:v<.5?(v-.5)*60:(v-.5)*18;
const eqv=(d,k)=>d.ov[k]!=null?d.ov[k]:d.k[k];
function applyDeck(d){
  const T=AC.currentTime;
  d.trim.gain.setTargetAtTime(Math.pow(10,(d.k.gain-.5)*24/20),T,.02);
  d.fl.gain.setTargetAtTime(d.kill.low?-40:kdb(eqv(d,'low')),T,.012);
  d.fm.gain.setTargetAtTime(d.kill.mid?-40:kdb(eqv(d,'mid')),T,.012);
  d.fh.gain.setTargetAtTime(d.kill.hi?-40:kdb(eqv(d,'hi')),T,.012);
  const f=eqv(d,'flt');
  if(Math.abs(f-.5)<.02){if(d.fi.type!='allpass')d.fi.type='allpass'}
  else if(f<.5){if(d.fi.type!='lowpass')d.fi.type='lowpass';d.fi.frequency.setTargetAtTime(20000*Math.pow(.01,(.5-f)*2),T,.01)}
  else{if(d.fi.type!='highpass')d.fi.type='highpass';d.fi.frequency.setTargetAtTime(20*Math.pow(60,(f-.5)*2),T,.01)}
}
const xfc=i=>i?Math.sin(G.xf*Math.PI/2):Math.cos(G.xf*Math.PI/2);
function mix(){
  const T=AC.currentTime;BUS.master.gain.setTargetAtTime(G.mg*1.25,T,.03);
  D.forEach((d,i)=>{d.fad.gain.setTargetAtTime(d.k.vol*xfc(i)*d.autoV*(G.egal?d.norm:1),T,.025);d.gate.gain.setTargetAtTime(d.mute?0:1,T,.006);applyDeck(d)});
}
function live(){const x=G.xf<.5?0:1;if(D[x].a.paused&&!D[1-x].a.paused)return 1-x;return x}

/* --- Vitesse --- */
function applyRate(d){
  const r=clamp(d.rate*d.rateMul*d.nudge,.0625,4);d.a.playbackRate=r;
  const L=d.lp;if(L&&L.src){const T=AC.currentTime;if(T>=L.t0){L.off=loopPos(d);L.t0=T}L.rate=r;L.src.playbackRate.setValueAtTime(r,T)}
}
const rateOf=d=>d.a.playbackRate||1;

/* --- Temps musicaux --- */
const beatLen=d=>60/(d.bpm||120);
const snapBeat=(d,t,div=1)=>{const p=beatLen(d)/div;return d.off+Math.round((t-d.off)/p)*p};
const nextBeat=(d,t,div=1)=>{const p=beatLen(d)/div;return d.off+Math.ceil((t-d.off)/p-1e-6)*p};
const wallBeat=d=>beatLen(d)/rateOf(d);
function posOf(d){return d.lp&&d.lp.src?loopPos(d):d.a.currentTime}
const heard=d=>posOf(d)-LAT*rateOf(d);  // ce que tu entends réellement (retard Bluetooth compensé)
const phaseOf=d=>((((posOf(d)-d.off)/beatLen(d))%1)+1)%1;

/* --- Boucles précises (audio décodé) --- */
function loopPos(d){
  const L=d.lp;if(!L||!L.src)return d.a.currentTime;
  const T=AC.currentTime;if(T<L.t0)return d.a.currentTime;
  return L.s+((((L.off-L.s)+(T-L.t0)*L.rate)%L.len)+L.len)%L.len;
}
function loopOn(d,len,o={}){
  if(!d.a.src||d.a.paused){toast('Lance le morceau d\'abord');return false}
  const r=rateOf(d),cur=posOf(d),h=cur-LAT*r;
  let s=o.start!=null?o.start:(d.grid?snapBeat(d,h):h);
  if(s<0)s=0;
  if(!d.buf){ // secours : boucle par repositionnement
    d.lp={s,len,legacy:true,slip:!!o.slip,back:d.a.currentTime};return true;
  }
  if(s+len>d.buf.duration)return false;
  const T=AC.currentTime;let t0=T+.008,off;
  if(s>cur){t0=T+(s-cur)/r;off=s}else off=s+((cur-s)%len);
  const src=AC.createBufferSource(),g=AC.createGain();
  src.buffer=d.buf;src.loop=true;src.loopStart=s;src.loopEnd=s+len;src.playbackRate.value=r;
  g.gain.value=0;src.connect(g);g.connect(d.inp);src.start(t0,off);
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(1,t0+.006);
  const prev=d.lp;
  if(prev&&prev.src){prev.g.gain.cancelScheduledValues(T);prev.g.gain.setValueAtTime(1,t0);prev.g.gain.linearRampToValueAtTime(0,t0+.006);try{prev.src.stop(t0+.03)}catch(e){}}
  else{d.elG.gain.cancelScheduledValues(T);d.elG.gain.setValueAtTime(1,T);d.elG.gain.setValueAtTime(1,t0);d.elG.gain.linearRampToValueAtTime(0,t0+.006)}
  d.lp={s,len,src,g,t0,off,rate:r,slip:prev?prev.slip:!!o.slip};
  return true;
}
function loopOff(d){
  const L=d.lp;if(!L)return;d.lp=null;
  if(L.legacy)return;
  const T=AC.currentTime,fade=(n)=>{d.elG.gain.cancelScheduledValues(n);d.elG.gain.setValueAtTime(0,n);d.elG.gain.linearRampToValueAtTime(1,n+.012);
    L.g.gain.cancelScheduledValues(n);L.g.gain.setValueAtTime(1,n);L.g.gain.linearRampToValueAtTime(0,n+.012);try{L.src.stop(n+.05)}catch(e){}};
  if(L.slip||d.a.paused){fade(T);return}
  // Reprise depuis la position dans la boucle : la lecture décodée continue pendant que la lecture principale se recale
  const p=loopPos(d);L.src.loop=false;
  let fini=false;const go=()=>{if(fini)return;fini=true;d.a.removeEventListener('seeked',go);fade(AC.currentTime)};
  d.a.addEventListener('seeked',go);setTimeout(go,900);
  d.a.currentTime=Math.min(d.a.duration-.05,p+.06*L.rate);
}
function killLoop(d){const L=d.lp;if(!L)return;d.lp=null;if(L.src){try{L.src.stop()}catch(e){}L.g.disconnect()}
  const T=AC.currentTime;d.elG.gain.cancelScheduledValues(T);d.elG.gain.setValueAtTime(1,T)}
function loopLegacyTick(d){const L=d.lp;if(L&&L.legacy&&!d.a.paused&&d.a.currentTime>=L.s+L.len)d.a.currentTime=L.s+(d.a.currentTime-L.s-L.len)%L.len}

/* --- Tempo et synchronisation --- */
function match(f,l){ // cale le tempo de f sur l
  if(!f.bpm||!l.bpm)return false;
  let r=l.bpm*rateOf(l)/f.bpm;while(r>1.4)r/=2;while(r<.7)r*=2;
  f.rate=r;f.rateMul=1;applyRate(f);return true;
}
function phaseAlign(f,l){
  if(!f.grid||!l.grid||f.a.paused||l.a.paused)return false;
  const pl=phaseOf(l),pf=phaseOf(f);let dl=pl-pf;dl-=Math.round(dl);
  f.a.currentTime=Math.max(0,f.a.currentTime+dl*beatLen(f));return true;
}
/* une seule correction de dérive, uniquement pour un deck synchronisé */
setInterval(()=>{
  D.forEach((f,i)=>{const l=D[1-i];
    if(!f.syncLock||f.a.paused||l.a.paused||!f.grid||!l.grid||f.lp||l.lp||f.rateMul!=1||l.rateMul!=1)return;
    let r=l.bpm*rateOf(l)/f.bpm/(f.nudge||1);let k=1;while(r>1.4){r/=2;k*=2}while(r<.7){r*=2;k/=2}
    let dl=phaseOf(l)*k%1-phaseOf(f);dl-=Math.round(dl);
    if(Math.abs(dl)>.25){f.a.currentTime=Math.max(0,f.a.currentTime+dl*beatLen(f));return}
    f.rate=r*(1+clamp(dl,-.2,.2)*.04);applyRate(f);
  });
},400);

/* --- Lecture --- */
let CALAGE=LS.get('bd5_calage',true);
function playDeck(d,quiet){
  AC.resume();if(!d.a.src){if(!quiet)toast('Charge un morceau sur ce deck');return false}
  const o=D[1-d.i];if(d.pend)return false;
  if(CALAGE&&!o.a.paused&&o.grid&&d.grid&&!d.lp){
    match(d,o);const p=beatLen(d);
    d.a.currentTime=Math.max(0,d.off+Math.round((d.a.currentTime-d.off)/p)*p);
    const wait=(1-phaseOf(o))%1*wallBeat(o)*1000;
    const j=new Job('Démarrage calé',{cle:'start'+d.i,deck:d.i});d.pend=j;
    j.onStop(()=>{d.pend=null});j.later(()=>{d.pend=null;d.a.play().catch(()=>{});j.end()},wait-15);return true;
  }
  d.a.play().catch(()=>toast('Lecture impossible','err'));return true;
}
function pauseDeck(d){if(d.pend){d.pend.stop()}d.a.pause()}

/* --- Effets de base réutilisables --- */
function echoSend(d,o={}){ // envoie le deck dans l'écho
  const T=AC.currentTime,w=wallBeat(d);
  FX.dly.delayTime.setTargetAtTime(Math.min(3.9,w*(o.retard||.75)),T,.02);FX.fb.gain.setTargetAtTime(clamp(o.retour??.55,0,.9),T,.02);
  d.eS.gain.cancelScheduledValues(T);d.eS.gain.setTargetAtTime(o.niveau??1,T,.01);
  if(o.duree){d.eS.gain.setTargetAtTime(0,T+o.duree,.01)}
}
function echoStop(d){const T=AC.currentTime;d.eS.gain.cancelScheduledValues(T);d.eS.gain.setTargetAtTime(0,T,.02)}
function revSend(d,niveau=1,duree){const T=AC.currentTime;d.rS.gain.cancelScheduledValues(T);d.rS.gain.setTargetAtTime(niveau,T,.01);if(duree)d.rS.gain.setTargetAtTime(0,T+duree,.02)}
function revStop(d){const T=AC.currentTime;d.rS.gain.cancelScheduledValues(T);d.rS.gain.setTargetAtTime(0,T,.03)}
function setMute(d,m){d.mute=m?1:0;const T=AC.currentTime;d.gate.gain.cancelScheduledValues(T);d.gate.gain.setTargetAtTime(d.mute?0:1,T,.006)}
function noise(sec){const n=Math.max(1,Math.floor(AC.sampleRate*sec)),b=AC.createBuffer(1,n,AC.sampleRate),x=b.getChannelData(0);for(let i=0;i<n;i++)x[i]=Math.random()*2-1;const s=AC.createBufferSource();s.buffer=b;return s}
function riser(sec){
  const s=noise(sec),f=AC.createBiquadFilter(),g=AC.createGain(),T=AC.currentTime;f.type='highpass';f.frequency.setValueAtTime(300,T);f.frequency.exponentialRampToValueAtTime(7000,T+sec);
  g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(.16,T+sec*.95);g.gain.linearRampToValueAtTime(0,T+sec);s.connect(f);f.connect(g);g.connect(BUS.master);s.start();
}
function sfx(kind){
  AC.resume();const T=AC.currentTime,g=AC.createGain();g.connect(BUS.master);
  if(kind=='klaxon'){[466,587,698].forEach(f=>{const o=AC.createOscillator();o.type='sawtooth';o.frequency.value=f;o.connect(g);o.start(T);o.stop(T+.9)});g.gain.setValueAtTime(0,T);g.gain.linearRampToValueAtTime(.18,T+.02);g.gain.setValueAtTime(.18,T+.7);g.gain.linearRampToValueAtTime(0,T+.9)}
  else if(kind=='sirene'){const o=AC.createOscillator(),l=AC.createOscillator(),lg=AC.createGain();o.frequency.value=900;l.frequency.value=2.2;lg.gain.value=350;l.connect(lg);lg.connect(o.frequency);o.connect(g);o.start(T);l.start(T);o.stop(T+2.4);l.stop(T+2.4);g.gain.setValueAtTime(.16,T);g.gain.linearRampToValueAtTime(0,T+2.4)}
  else if(kind=='laser'){const o=AC.createOscillator();o.type='square';o.frequency.setValueAtTime(2400,T);o.frequency.exponentialRampToValueAtTime(180,T+.35);o.connect(g);g.gain.setValueAtTime(.11,T);g.gain.exponentialRampToValueAtTime(.001,T+.4);o.start(T);o.stop(T+.45)}
  else if(kind=='caisse'){const s=noise(.25),f=AC.createBiquadFilter();f.type='highpass';f.frequency.value=1500;s.connect(f);f.connect(g);g.gain.setValueAtTime(.3,T);g.gain.exponentialRampToValueAtTime(.001,T+.22);s.start(T)}
  else{const s=noise(1.4),f=AC.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(9000,T);f.frequency.exponentialRampToValueAtTime(300,T+1.3);s.connect(f);f.connect(g);g.gain.setValueAtTime(.22,T);g.gain.exponentialRampToValueAtTime(.001,T+1.4);s.start(T);
    const o=AC.createOscillator(),og=AC.createGain();o.frequency.setValueAtTime(120,T);o.frequency.exponentialRampToValueAtTime(40,T+.4);og.gain.setValueAtTime(.5,T);og.gain.exponentialRampToValueAtTime(.001,T+.5);o.connect(og);og.connect(BUS.master);o.start(T);o.stop(T+.6)}
}

/* --- Remise à zéro de tous les effets (arrêt d'urgence) --- */
function resetDeckFx(d){
  if(d.pend)d.pend.stop();
  if(d.lp)loopOff(d);
  d.rateMul=1;d.nudge=1;d.a.preservesPitch=d.keylock;applyRate(d);
  d.ov={};d.kill={low:0,mid:0,hi:0};d.autoV=1;d.mute=0;d.echoOn=false;
  const T=AC.currentTime;[d.eS,d.rS].forEach(g=>{g.gain.cancelScheduledValues(T);g.gain.setTargetAtTime(0,T,.03)});
  d.gate.gain.cancelScheduledValues(T);d.gate.gain.setTargetAtTime(1,T,.01);
}

/* --- Chargement d'un morceau dans un deck --- */
function peaks(buf){
  const x=buf.getChannelData(0),sr=buf.sampleRate,B=Math.floor(sr/50),N=Math.floor(x.length/B),pk=new Float32Array(N);let mx=0;
  for(let k=0;k<N;k++){let m=0;for(let j=0;j<B;j+=16){const v=Math.abs(x[k*B+j]);if(v>m)m=v}pk[k]=m;if(m>mx)mx=m}
  for(let k=0;k<N;k++)pk[k]=Math.pow(pk[k]/(mx||1),.7);return pk;
}
let onDeckLoaded=()=>{};
async function chargerDeck(i,it,force){
  const d=D[i];
  if(!it||!it.f)return false;
  if(!d.a.paused&&!force){toast('Le deck '+(i+1)+' joue : mets-le en pause avant de charger un autre morceau','err');return false}
  [...JOBS].forEach(j=>{if(j.deck===i)j.stop()});
  killLoop(d);d.a.pause();if(d.url)URL.revokeObjectURL(d.url);
  d.url=URL.createObjectURL(it.f);d.a.src=d.url;
  Object.assign(d,{cur:it,done:0,name:it.name,buf:null,pk:null,bpm:0,off:0,grid:false,r:null,key:null,norm:1,cue:0,hc:[null,null,null],rate:1,rateMul:1,nudge:1,syncLock:false,loading:true,logged:false,valideN:null,dl:null,plan:null,planN:null,fromQ:false,loopLen:4,ov:{},autoV:1});
  applyRate(d);
  try{
    const buf=await AC.decodeAudioData(await it.f.arrayBuffer());
    if(d.cur!==it)return false;
    d.buf=buf;d.pk=peaks(buf);
    let r=it.r&&it.r.v>=ANA_V?it.r:null;
    if(!r){r=analyseBuf(buf);it.r=corrOf(it.id,slim(r));sauverMeta(it)}r=it.r;
    d.r=r;d.bpm=r.bpm||0;d.off=r.off||0;d.key=r.key;d.norm=r.norm||1;d.grid=d.bpm>0;
    if(r.dr&&r.dr[0])d.hc[0]=r.dr[0][0];if(r.dr&&r.dr[1])d.hc[1]=r.dr[1][0];if(r.ex)d.hc[2]=r.ex;
  }catch(e){console.error(e);toast('Impossible d\'analyser « '+it.name+' » : lecture possible, mais sans tempo','err')}
  d.loading=false;mix();onDeckLoaded(i);return true;
}
