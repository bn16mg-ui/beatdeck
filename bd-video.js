'use strict';
/* ===== BeatDeck 6 · copier la transition d'un DJ depuis une vidéo =====
   1. On extrait le son de la vidéo et celui de tes deux musiques (sur la tablette, rien n'est envoyé).
   2. On compare leurs « empreintes harmoniques » (chroma : les notes présentes) toutes les ~0,1 s,
      en essayant plusieurs vitesses (le DJ a pu accélérer ou ralentir un morceau).
   3. On retrouve, seconde par seconde, quelle partie de chaque musique on entend dans la vidéo.
   4. On en déduit la transition : où le 1er morceau sort, où le 2e entre, combien de temps ils jouent ensemble,
      si le 2e arrive étouffé (filtre) puis s'ouvre, si le DJ garde seulement la voix du 1er, s'il coupe net.
   Limites : il faut la même version des musiques que dans la vidéo, et un son assez clair.
   Les effets (écho, réglages précis du filtre) sont estimés, pas mesurés exactement. */

const VSR=22050,VNF=4096,VHOP=2048,VDT=VHOP/VSR;
async function resample(buf){
  const n=Math.ceil(buf.duration*VSR),oc=new OfflineAudioContext(1,n,VSR),s=oc.createBufferSource();s.buffer=buf;s.connect(oc.destination);s.start();
  return(await oc.startRendering()).getChannelData(0);
}
const CHB=(()=>{const m=new Int8Array(VNF/2+1).fill(-1);for(let q=1;q<=VNF/2;q++){const f=q*VSR/VNF;if(f>80&&f<5000)m[q]=((Math.round(69+12*Math.log2(f/440))%12)+12)%12}return m})();
// empreinte harmonique : 12 notes par trame, normalisée
function chromaDe(x){
  const n=Math.floor((x.length-VNF)/VHOP)+1,out=new Float32Array(Math.max(0,n)*12),re=new Float32Array(VNF),im=new Float32Array(VNF),han=new Float32Array(VNF);
  for(let i=0;i<VNF;i++)han[i]=.5-.5*Math.cos(2*Math.PI*i/VNF);
  for(let k=0;k<n;k++){const o=k*VHOP;for(let i=0;i<VNF;i++){re[i]=x[o+i]*han[i];im[i]=0}fft(re,im);
    const c=new Float64Array(12);for(let q=1;q<=VNF/2;q++){const b=CHB[q];if(b>=0)c[b]+=Math.hypot(re[q],im[q])}
    let m=0;for(let b=0;b<12;b++){c[b]=Math.log1p(c[b]*10);m+=c[b]}m/=12;let nn=0;for(let b=0;b<12;b++){c[b]-=m;nn+=c[b]*c[b]}nn=Math.sqrt(nn)+1e-9;
    for(let b=0;b<12;b++)out[k*12+b]=c[b]/nn}
  return{C:out,n};
}
// pour chaque moment de la vidéo : où en est la musique, et à quelle vitesse
function suivre(V,S){
  const W=Math.round(2/VDT),pas=Math.max(1,Math.round(.5/VDT)),rates=[];for(let r=.92;r<=1.081;r+=.02)rates.push(+r.toFixed(2));
  const nV=V.n,nS=S.n,Dm=new Float32Array(nV*nS);
  for(let i=0;i<nV;i++)for(let j=0;j<nS;j++){let s=0;for(let b=0;b<12;b++)s+=V.C[i*12+b]*S.C[j*12+b];Dm[i*nS+j]=s}
  const out=[];
  for(let s=0;s+W<nV;s+=pas){let best=[-1,0,1];
    for(const r of rates){const idx=[];for(let i=0;i<W;i++)idx.push(Math.round(i*r));const n=nS-idx[W-1]-1;if(n<=0)continue;
      const sc=new Float32Array(n);for(let i=0;i<W;i++){const row=(s+i)*nS+idx[i];for(let o=0;o<n;o++)sc[o]+=Dm[row+o]}
      let o=0;for(let k=1;k<n;k++)if(sc[k]>sc[o])o=k;const v=sc[o]/W;if(v>best[0])best=[v,o*VDT,r]}
    out.push({t:s*VDT+1,sc:best[0],pos:best[1],r:best[2]})}
  return out;
}
// la musique avance-t-elle régulièrement dans la vidéo ? (droite position = p0 + r × temps)
function droite(tr){
  const q=[...tr.map(x=>x.sc)].sort((a,b)=>a-b),thr=Math.max(.42,(q[Math.floor(q.length*.9)]||0)*.72),P=tr.filter(x=>x.sc>=thr);let best=null;
  for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const dt=P[j].t-P[i].t;if(dt<1.5)continue;const r=(P[j].pos-P[i].pos)/dt;if(r<.88||r>1.12)continue;
    const p0=P[i].pos-r*P[i].t,inl=tr.map(x=>Math.abs(x.pos-(p0+r*x.t))<.8&&x.sc>=thr*.75),n=tr.filter((x,k)=>inl[k]&&x.sc>=.5).length;
    if(!best||n>best.n||(n==best.n&&p0<best.p0))best={n,p0,r,inl}}
  return best&&best.n>=4?best:null;
}
// si le navigateur ne sait pas extraire le son directement, on lit la vidéo une fois (sans le son dans les enceintes) et on l'enregistre
function ecouterVideo(fichier,etape){
  return new Promise((ok,ko)=>{
    const v=document.createElement('video'),url=URL.createObjectURL(fichier);v.src=url;v.playsInline=true;v.preload='auto';
    let src,sp,zero,blocs=[],fini=false,tick;
    const fin=err=>{if(fini)return;fini=true;clearInterval(tick);try{v.pause();sp.disconnect();src.disconnect();zero.disconnect()}catch(e){}URL.revokeObjectURL(url);
      if(err)return ko(err);const n=blocs.reduce((a,b)=>a+b.length,0);if(n<AC.sampleRate*2)return ko(new Error('pas de son'));
      const buf=AC.createBuffer(1,n,AC.sampleRate),d=buf.getChannelData(0);let o=0;for(const b of blocs){d.set(b,o);o+=b.length}ok(buf)};
    v.onerror=()=>fin(new Error('vidéo illisible'));
    v.onloadedmetadata=async()=>{
      if(!(v.duration>0))return fin(new Error('durée inconnue'));if(v.duration>240)return fin(new Error('trop longue'));
      try{src=AC.createMediaElementSource(v);sp=AC.createScriptProcessor(4096,2,1);zero=AC.createGain();zero.gain.value=0;
        sp.onaudioprocess=e=>{if(v.paused||v.ended)return;const L=e.inputBuffer.getChannelData(0),R=e.inputBuffer.numberOfChannels>1?e.inputBuffer.getChannelData(1):L,m=new Float32Array(L.length);for(let i=0;i<L.length;i++)m[i]=(L[i]+R[i])/2;blocs.push(m)};
        src.connect(sp);sp.connect(zero);zero.connect(AC.destination);
        if(AC.state!='running')await AC.resume();await v.play()}catch(e){return fin(e)}
      tick=setInterval(()=>etape('Écoute de la vidéo… '+Math.round(v.currentTime)+' / '+Math.round(v.duration)+' s'),500)};
    v.onended=()=>fin();
  });
}
const EMPREINTES={};
async function empreinteSon(s){
  if(EMPREINTES[s.id])return EMPREINTES[s.id];
  const buf=await AC.decodeAudioData(await s.blob.arrayBuffer()),e=chromaDe(await resample(buf));EMPREINTES[s.id]=e;return e;
}
async function analyserVideo(fichier,du,etape){
  const a=sonDe(du.a),b=sonDe(du.b);
  etape('Lecture du son de la vidéo…');let bufV;
  try{if(window.VFORCE)throw 0;bufV=await AC.decodeAudioData(await fichier.arrayBuffer())}
  catch(e){try{bufV=await ecouterVideo(fichier,etape)}catch(e2){console.error(e2);return{erreur:'Impossible de lire le son de cette vidéo. Essaie une vidéo MP4 enregistrée sur ta tablette.'}}}
  if(bufV.duration<4)return{erreur:'Vidéo trop courte.'};if(bufV.duration>240)return{erreur:'Vidéo trop longue : garde seulement le passage de la transition (moins de 4 minutes).'};
  const V=chromaDe(await resample(bufV));await sleep(20);
  etape('Empreinte de « '+a.nom+' »…');const SA=await empreinteSon(a);await sleep(20);
  etape('Empreinte de « '+b.nom+' »…');const SB=await empreinteSon(b);await sleep(20);
  etape('Comparaison avec « '+a.nom+' »…');const trA=suivre(V,SA);await sleep(20);
  etape('Comparaison avec « '+b.nom+' »…');const trB=suivre(V,SB);
  const LA=droite(trA),LB=droite(trB),manque=[];
  if(!LA)manque.push('« '+a.nom+' »');if(!LB)manque.push('« '+b.nom+' »');
  if(manque.length)return{erreur:'Je ne retrouve pas '+manque.join(' ni ')+' dans la vidéo. Vérifie que c\'est bien la même version de la musique (pas un remix ni une autre musique au nom proche), et que le son de la vidéo est assez clair.'};
  // présence de chaque musique dans le temps
  const pres=(tr,L)=>tr.map((x,k)=>L.inl[k]||x.sc>=.55?x.sc:0),pA=pres(trA,LA),pB=pres(trB,LB),T=trA.map(x=>x.t);
  const mA=Math.max(...pA),mB=Math.max(...pB),idx=(p,f)=>p.map((v,k)=>v>=f?k:-1).filter(k=>k>=0);
  const fA=idx(pA,.75*mA),fB=idx(pB,.75*mB),wA=idx(pA,.45*mA),wB=idx(pB,.45*mB);
  if(!fA.length||!fB.length)return{erreur:'La transition n\'est pas assez nette dans la vidéo.'};
  if(T[fB[0]]<T[fA[0]])return{erreur:'Dans la vidéo, « '+b.nom+' » passe avant « '+a.nom+' ». Inverse l\'ordre du duo (⇄) puis recommence.'};
  const finFortA=T[Math.max(...fA.filter(k=>k<fB[0]).concat([fA[0]]))],debFortB=T[fB[0]];
  const finA=T[Math.max(...wA.filter(k=>T[k]<=T[fB[fB.length-1]]))],debB=T[Math.min(...wB.filter(k=>T[k]>=finFortA-6))];
  // chaque mesure couvre 2 s de vidéo : on corrige les bords (fin réelle de A un peu après, début réel de B un peu avant)
  const BORD=.7,aFinFort=finFortA+BORD,aEnd=finA+BORD,bStart=Math.max(0,debB-BORD),posA=t=>LA.p0+LA.r*t,posB=t=>LB.p0+LB.r*t;
  const voix=finA-finFortA>1.5&&finA>debB;let t0,c;
  if(!voix&&bStart>=aEnd-.3&&bStart-aEnd<2.5){const tc=(aEnd+bStart)/2;t0=tc;c={bDebut:0,montee:0,aFin:0,aMode:'coupe',filtreB:false,echo:false}}   // coupure nette
  else{t0=Math.min(aFinFort,bStart);
    c={bDebut:+Math.max(0,bStart-t0).toFixed(2),montee:+Math.max(0,debFortB-bStart).toFixed(2),aFin:+Math.max(0,aEnd-t0).toFixed(2)};
    c.aMode=voix?'voix':'coupe';c.filtreB=c.montee>1.5;c.echo=voix&&Math.abs(finA-debFortB)<2}
  const exit=+Math.max(0,posA(t0)).toFixed(2),entry=+Math.max(0,posB(t0+c.bDebut)).toFixed(2);
  const R=['Copiée de ta vidéo (estimation)'],res=[];
  res.push('Le DJ sort de « '+a.nom+' » à '+fmt(exit));
  if(c.aMode=='voix')R.push('il garde surtout la voix de « '+a.nom+' » (graves coupés) pendant '+nf(c.aFin,1)+' s');
  if(c.bDebut<.3&&c.aFin<.4&&!c.filtreB)R.push('coupure nette : « '+b.nom+' » démarre d\'un coup');
  else R.push('« '+b.nom+' » démarre '+(c.bDebut>0?nf(c.bDebut,1)+' s après':'au même moment')+(c.filtreB?', étouffé, et s\'ouvre en '+nf(c.montee,1)+' s':''));
  R.push('« '+b.nom+' » entre à '+fmt(entry)+' de son morceau');
  if(c.echo)R.push('écho probable sur la fin de « '+a.nom+' »');
  if(Math.abs(LB.r-1)>.02||Math.abs(LA.r-1)>.02)R.push('le DJ avait changé la vitesse : '+(Math.abs(LA.r-1)>.02?'« '+a.nom+' » '+(LA.r>1?'+':'')+nf((LA.r-1)*100,0)+' % ':'')+(Math.abs(LB.r-1)>.02?'« '+b.nom+' » '+(LB.r>1?'+':'')+nf((LB.r-1)*100,0)+' %':''));
  const conf=Math.min(LA.n,LB.n)>=10?'bonne':'moyenne';R.push('Confiance de la reconnaissance : '+conf);
  return{plan:{tech:'copie',exit,entry,riser:false,copie:c,score:9,raisons:R,resume:'À '+fmt(exit)+' : transition du DJ de la vidéo, « '+b.nom+' » entre à '+fmt(entry)+(c.filtreB?' étouffé puis s\'ouvre':'')+(c.aMode=='voix'?', voix de « '+a.nom+' » isolée':'')+(c.echo?', écho à la fin':''),video:true}};
}

/* --- la transition copiée, rejouée avec tes fichiers --- */
TECH.copie=(X,O,w,o={})=>{
  const c=o.copie||{bDebut:0,montee:0,aFin:0,aMode:'coupe'};
  if(!O.a.src){if(!o.silence)toast('Charge le 2e morceau d\'abord');return null}
  const j=new Job('copie:'+X.i,[X.i,O.i]),b=wallBeat(X),proche=O.a.paused&&entree(O,X,o),tf=w+Math.max(c.aFin,c.bDebut);
  j.onStop(()=>{['low','flt'].forEach(k=>{delete X.ov[k];delete O.ov[k]});applyDeck(X);applyDeck(O);echoSet(X,false);agReset(X)});
  if(c.aMode=='voix')j.later(()=>{ovVers(X,'low',X.k.low,0,.6,j);ovVers(X,'flt',X.k.flt,.66,1.2,j)},w*1000);
  if(c.filtreB){O.ov.flt=.12;applyDeck(O)}
  lancerA(O,j,w+c.bDebut,proche);
  j.later(()=>{if(c.filtreB)ovVers(O,'flt',.12,O.k.flt,Math.max(.3,c.montee),j);if(c.aFin>c.bDebut+.4)xfVers(.5,Math.max(.3,Math.min(c.montee||1,c.aFin-c.bDebut)*.6),j)},(w+c.bDebut)*1000);
  if(c.echo)j.later(()=>echoSet(X,true),Math.max(w,tf-b)*1000);
  j.later(()=>{echoSet(X,false);agVers(X,0,0,c.echo?.05:.1);G.xf=cote(O);VAL.xf=G.xf;mix();dessiner('xf');if(c.montee<=c.aFin-c.bDebut){delete O.ov.flt;applyDeck(O)}},tf*1000);
  j.later(()=>{delete O.ov.flt;applyDeck(O);sortir(X);delete X.ov.flt;delete X.ov.low;applyDeck(X);j.end()},(tf+Math.max(c.echo?3:.3,c.bDebut+c.montee-(tf-w)))*1000);
  return j;
};
function gestesCopie(X,O,w,c){
  const G=[],g=(t,ids,txt)=>G.push({t,ids:ids.filter(Boolean),txt}),x=X.i,o=O.i,b=wallBeat(X),tf=w+Math.max(c.aFin,c.bDebut);
  if(c.aMode=='voix')g(w,['low'+x,'flt'+x],'Tourne GRAVES'+dk(X)+' à gauche et FILTRE un peu vers la droite (on garde la voix)');
  g(w+c.bDebut,['play'+o].concat(c.filtreB?['flt'+o]:[]),'Appuie sur LECTURE'+dk(O)+(c.filtreB?' avec son FILTRE tout à gauche':''));
  if(c.filtreB)g(w+c.bDebut+.6,['flt'+o],'Ouvre doucement le FILTRE'+dk(O)+' jusqu\'au milieu');
  if(c.echo){const e=boutonDe('echo',x);g(tf-b,[e.id],'Appuie sur '+e.txt)}
  g(tf,['xf','play'+x],'Crossfader vers le deck '+(o+1)+' et arrête le deck '+(x+1));
  return G;
}

/* --- écran : bouton dans « Préparer la transition » --- */
function copierVideo(){
  const du=PREP.du;if(!du)return;
  const inp=document.createElement('input');inp.type='file';inp.accept='video/*,audio/*';
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;const el=$('prVid');el.hidden=false;el.className='info';
    const etape=t=>{el.textContent='🎬 '+t};etape('Analyse de la vidéo…');
    try{const r=await analyserVideo(f,du,etape);
      if(r.erreur){el.className='info err';el.textContent='🎬 '+r.erreur;return}
      PREP.props=PREP.props.filter(p=>!p.video);PREP.props.unshift(r.plan);PREP.ouvert=-1;el.hidden=true;rendrePrep();
      toast('🎬 Transition de la vidéo retrouvée : écoute-la puis valide-la')}
    catch(e){console.error(e);el.className='info err';el.textContent='🎬 Analyse impossible : '+(e.message||e)}};
  inp.click();
}

function initVideo(){$('prVidB').onclick=copierVideo}
