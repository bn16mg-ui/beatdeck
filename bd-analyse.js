'use strict';
/* ===== BeatDeck 5 · analyse musicale locale (rien n'est envoyé sur Internet) ===== */
const ANA_V=7;
const KP=[[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17]];
function keyOf(x,sr){
  const W=16384,ch=new Float32Array(12),w=new Float32Array(W),st=Math.max(0,Math.floor(x.length/2-sr*15)),en=Math.min(x.length,st+sr*30);
  for(let j=0;j<W;j++)w[j]=.5-.5*Math.cos(6.2832*j/W);
  const cs=[];for(let n=0;n<48;n++)cs.push([2*Math.cos(6.2832*130.81*Math.pow(2,n/12)/sr),n%12]);
  for(let p=st;p+W<en;p+=2*W)for(const[c,pc]of cs){let s1=0,s2=0;for(let j=0;j<W;j++){const s0=w[j]*x[p+j]+c*s1-s2;s2=s1;s1=s0}ch[pc]+=Math.sqrt(Math.max(0,s1*s1+s2*s2-c*s1*s2))}
  const all=[];
  for(let m=0;m<2;m++)for(let k=0;k<12;k++){
    const a=[...Array(12)].map((_,i)=>ch[(k+i)%12]),ma=a.reduce((u,v)=>u+v)/12,mp=KP[m].reduce((u,v)=>u+v)/12;
    let nu=0,da=0,db=0;for(let i=0;i<12;i++){const u=a[i]-ma,v=KP[m][i]-mp;nu+=u*v;da+=u*u;db+=v*v}
    all.push({r:nu/Math.sqrt(da*db||1),n:((m?k+3:k)%12*7%12+7)%12+1,b:!m});
  }
  all.sort((a,b)=>b.r-a.r);const best=all[0],sec=all.find(x=>x.n!=best.n);
  return{n:best.n,b:best.b,c:+clamp(((best.r-(sec?sec.r:0))-.02)/.12).toFixed(2)};
}

/* ===== Style du son : empreinte rythmique mesurée dans l'audio =====
   Graves (grosse caisse) et aigus (caisse claire, charleston) relevés sur chaque double croche d'une mesure.
   Sert à reconnaître la famille de rythme (4 temps réguliers, syncopé type dembow, demi-temps…) et à comparer deux sons. */
function rythmeOf(x,sr,bpm,off){
  const H=256,fps=sr/H,n=Math.floor(Math.min(x.length,sr*150)/H);if(n<fps*20||!bpm)return null;
  const kL=1-Math.exp(-6.2832*150/sr),kH=1-Math.exp(-6.2832*2500/sr);let yl=0,yh=0,pl=0,ph=0;
  const oL=new Float32Array(n),oH=new Float32Array(n);
  for(let i=0;i<n;i++){let sl=0,sh=0;const b=i*H;for(let j=0;j<H;j++){const v=x[b+j];yl+=kL*(v-yl);yh+=kH*(v-yh);const h=v-yh;sl+=yl*yl;sh+=h*h}
    const el=Math.sqrt(sl/H),eh=Math.sqrt(sh/H);oL[i]=Math.max(0,el-pl);oH[i]=Math.max(0,eh-ph);pl=el;ph=eh}
  const step=60/bpm/4,K=new Float64Array(16),HH=new Float64Array(16);
  const pk=(o,f)=>{let m=0;for(let q=Math.max(0,f-2);q<=Math.min(n-1,f+2);q++)if(o[q]>m)m=o[q];return m};
  let c=0;for(let t=off;t*fps<n-3;t+=step,c++){const f=Math.round(t*fps),k=c%16;K[k]+=pk(oL,f);HH[k]+=pk(oH,f)}
  const beat=60/bpm;let s3=0,s2=0;for(let t=off;(t+beat)*fps<n-3;t+=beat){s3+=pk(oH,Math.round((t+beat/3)*fps))+pk(oH,Math.round((t+2*beat/3)*fps));s2+=2*pk(oH,Math.round((t+beat/2)*fps))}
  const nz=a=>{const m=Math.max(...a)||1;return[...a].map(v=>+(v/m).toFixed(2))};
  const rk=nz(K),rh=nz(HH),sw=+clamp(s3/((s2+s3)||1)).toFixed(2);
  return Object.assign({rk,rh,sw},familleRythme(rk,rh));
}
const m4=(a,r)=>[0,4,8,12].reduce((s,i)=>s+a[(i+r)%16],0)/4;
function familleRythme(rk,rh){
  const bk=[0,4,8,12].map(i=>rk[i]),reg=Math.min(...bk)/(Math.max(...bk)||1);
  const hK=[0,1,2,3].map(r=>m4(rk,r)),hH=[0,1,2,3].map(r=>m4(rh,r)),mH=Math.max(...hH)||1;
  const p8=[...Array(8)].map((_,i)=>(rh[i]+rh[i+8])/2),m8=Math.max(...p8)||1,sync=Math.max(Math.max(p8[3],p8[7])/m8,hK[3]/(hK[0]||1));
  let rf='autre',c=.4;
  if(reg<.45){rf='demi';c=clamp((.55-reg)*2.5)}
  else if(sync>=.6){rf='syncope';c=clamp((sync-.5)*2.5)}
  else if(reg>=.6&&hK[0]>=1.5*Math.max(hK[1],hK[2],hK[3])){rf='quatre';c=clamp((reg-.5)*2)}
  return{rf,rfc:+c.toFixed(2)};
}
const RFN={quatre:'4 temps réguliers (house, pop, électro, disco)',syncope:'rythme syncopé (dembow, reggaeton, shatta, dancehall, afro)',demi:'rythme lourd en demi-temps (rap, R&B)',autre:'rythme non classé'};
const RFC={quatre:'4 temps',syncope:'syncopé',demi:'demi-temps',autre:'autre'};
function corrP(a,b){const n=a.length;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i]}ma/=n;mb/=n;let nu=0,da=0,db=0;for(let i=0;i<n;i++){const u=a[i]-ma,v=b[i]-mb;nu+=u*v;da+=u*u;db+=v*v}return da&&db?nu/Math.sqrt(da*db):0}
function sim16(a,b){let m=-1;for(const s of[0,4,8,12]){const r=corrP(a,b.map((_,i)=>b[(i+s)%16]));if(r>m)m=r}return(m+1)/2}
/* ressemblance de style entre deux morceaux, de 0 (rien à voir) à 1 (même style) */
function styleSim(ra,rb){
  if(!ra||!rb||!ra.rk||!rb.rk)return null;
  const k=sim16(ra.rk,rb.rk),h=sim16(ra.rh,rb.rh),tim=1-Math.min(1,Math.abs((ra.lw||0)-(rb.lw||0))*2.5+Math.abs((ra.br||0)-(rb.br||0))*4),sw=1-Math.min(1,Math.abs((ra.sw||0)-(rb.sw||0))*3);
  let s=.35*k+.3*h+.2*tim+.15*sw;
  if(familleConflit(ra,rb))s=Math.min(s,.35);
  return s;
}
const familleConflit=(ra,rb)=>!!(ra&&rb&&ra.rf&&rb.rf&&ra.rf!='autre'&&rb.rf!='autre'&&ra.rf!=rb.rf&&(ra.rfc||0)>=.5&&(rb.rfc||0)>=.5&&ra.rk&&rb.rk&&(.5*sim16(ra.rk,rb.rk)+.5*sim16(ra.rh,rb.rh))<.8);


/* ===== Refrains estimés : passages qui se répètent (accords identiques) avec une énergie élevée =====
   Estimation, pas une reconnaissance des paroles. Sert à ne jamais couper un refrain. */
function refrainsOf(x,sr,bpm,off){
  const beat=60/bpm,blk=8*beat,W=8192,nb=Math.floor((x.length/sr-off)/blk)-1;if(nb<8)return null;
  const w=new Float32Array(W);for(let j=0;j<W;j++)w[j]=.5-.5*Math.cos(6.2832*j/W);
  const cs=[];for(let n=0;n<36;n++)cs.push([2*Math.cos(6.2832*110*Math.pow(2,n/12)/sr),(n+9)%12]);
  const C=[],E=[];
  for(let b=0;b<nb;b++){const ch=new Float64Array(12),t0=off+b*blk;let e=0,ce=0;
    for(const f of[.3,.7]){const p=Math.floor((t0+f*blk)*sr)-W/2;if(p<0||p+W>=x.length)continue;
      for(const[c,pc]of cs){let s1=0,s2=0;for(let j=0;j<W;j+=2){const s0=w[j]*x[p+j]+c*s1-s2;s2=s1;s1=s0}ch[pc]+=Math.sqrt(Math.max(0,s1*s1+s2*s2-c*s1*s2))}}
    for(let i=Math.floor(t0*sr),e1=Math.floor((t0+blk)*sr);i<e1&&i<x.length;i+=64){e+=x[i]*x[i];ce++}
    let nn=0;for(const v of ch)nn+=v*v;nn=Math.sqrt(nn)||1;C.push([...ch].map(v=>v/nn));E.push(Math.sqrt(e/(ce||1)));
  }
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),eM=med(E),rep=C.map((c,b)=>{let r=0;for(let j=0;j<nb;j++){if(Math.abs(j-b)<4)continue;const s=(dot(c,C[j])+(b+1<nb&&j+1<nb?dot(C[b+1],C[j+1]):dot(c,C[j])))/2;if(s>.94)r++}return r});
  const eQ=[...E].sort((a,b)=>a-b)[Math.floor(E.length*.6)]||eM,cand=rep.map((r,b)=>r>=1&&E[b]>=eQ),out=[];
  for(let b=0;b<nb;b++){if(!cand[b])continue;let e=b;while(e+1<nb&&cand[e+1])e++;if(e-b>=1)out.push([+(off+b*blk).toFixed(1),+(off+(e+1)*blk).toFixed(1)]);b=e}
  return out.length&&out.length<=8&&out.reduce((s,[a,b])=>s+b-a,0)<.7*(x.length/sr)?out:[];
}
const inRef=(r,t,m=2)=>!!(r&&r.ref&&r.ref.some(([a,b])=>t>a+m&&t<b-m));
const refAt=(r,t)=>r&&r.ref&&r.ref.find(([a,b])=>t>=a&&t<b)||null;

const cumul=pk=>{const c=new Float32Array(pk.length+1);for(let i=0;i<pk.length;i++)c[i+1]=c[i]+pk[i];return c};
const mn=(c,a,b)=>{a=Math.max(0,Math.floor(a*50));b=Math.min(c.length-1,Math.floor(b*50));return b>a?(c[b]-c[a])/(b-a):0};
function exitOf(r){ // fin de phrase (32 temps) juste avant que l'énergie retombe
  const c=cumul(r.pk),Ds=r.pk.length/50,p=60/r.bpm*32;let best=null,bs=-9;
  for(let t=r.off+Math.ceil((.35*Ds-r.off)/p)*p;t<.85*Ds;t+=p){if(t<40)continue;const sc=mn(c,t-8,t)-mn(c,t,t+8);if(sc>bs){bs=sc;best=t}}
  return best==null?Math.max(30,.6*Ds):best;
}
function entryList(r){
  const c=cumul(r.pk),Ds=r.pk.length/50,p=60/r.bpm,L=[];
  for(let k=Math.ceil((8-r.off)/p);r.off+k*p<.8*Ds;k++){const t=r.off+k*p;L.push({t,j:mn(c,t,t+4)-mn(c,t-4,t),a:mn(c,t,t+8)})}
  L.sort((x,y)=>y.j-x.j);const out=[];
  for(const x of L){if(x.j<=.02)break;if(out.every(y=>Math.abs(y.t-x.t)>12))out.push(x);if(out.length>=4)break}
  return out;
}
function introPos(d){
  if(!d.pk)return 0;const pk=d.pk,W=400,n=pk.length;if(n<W*3)return 0;
  const ps=new Float32Array(n+1);for(let i=0;i<n;i++)ps[i+1]=ps[i]+pk[i];
  const m=i=>(ps[i+W]-ps[i])/W;let mx=0;
  for(let i=0;i+W<=n;i+=50)mx=Math.max(mx,m(i));
  for(let i=200;i+W<=n;i+=50)if(m(i)>=.9*mx)return i>200&&i<n*.5?i/50:0;
  return 0;
}
/* Analyse complète d'un morceau décodé.
   Donne aussi un niveau de confiance : bc (tempo) et key.c (tonalité), de 0 (incertain) à 1 (sûr). */
function analyseBuf(buf){
  const x=buf.getChannelData(0),sr=buf.sampleRate,H=256;
  const pk=peaks(buf);let sq=0,cn=0;for(let i=0;i<x.length;i+=64){sq+=x[i]*x[i];cn++}
  const n=Math.floor(Math.min(x.length,sr*120)/H),o=new Float32Array(n);let p=0;
  for(let i=0;i<n;i++){let s=0;for(let j=0;j<H;j++){const v=x[i*H+j];s+=v*v}s=Math.sqrt(s/H);o[i]=Math.max(0,s-p);p=s}
  const fps=sr/H,at=a=>{const i=Math.floor(a),f=a-i;return i>=0&&i+1<n?o[i]*(1-f)+o[i+1]*f:0};
  const sc=b=>{const L=60/b*fps;let s=0,c=0;for(let i=0;i+4*L<n;i++){s+=o[i]*(at(i+L)+at(i+2*L)+at(i+4*L));c++}return c?s/c:0};
  const scores=[];let best=0,bpm=120;for(let b=70;b<=180;b+=.5){const v=sc(b);scores.push([b,v]);if(v>best){best=v;bpm=b}}
  let b2=bpm,bb=0;for(let b=bpm-.6;b<=bpm+.6;b+=.02){const v=sc(b);if(v>bb){bb=v;b2=b}}
  // confiance du tempo : écart avec le meilleur concurrent qui n'est ni le même tempo, ni sa moitié, ni son double
  const rel=b=>[1,2,.5,1.5,2/3].some(k=>Math.abs(b/(bpm*k)-1)<.04);
  const riv=scores.filter(([b])=>!rel(b)).reduce((m,[,v])=>Math.max(m,v),0);
  const bc=+clamp(((best-riv)/(best||1)-.03)/.2).toFixed(2);
  const L=60/b2*fps;let ph=0;best=0;for(let q=0;q<L;q+=.25){let s=0;for(let t=q;t<n-1;t+=L)s+=at(t);if(s>best){best=s;ph=q}}
  const R={v:ANA_V,bpm:Math.round(b2*100)/100,bc,off:ph/fps,pk,norm:Math.min(2,Math.max(.4,.12/(Math.sqrt(sq/cn)||.1))),key:keyOf(x,sr),dur:buf.duration};
  try{R.ex=exitOf(R);R.dr=entryList(R).map(e=>[+e.t.toFixed(2),+e.j.toFixed(3),+e.a.toFixed(3)]);R.en=+mn(cumul(pk),0,pk.length/50).toFixed(3)}catch(e){}
  try{const ry=rythmeOf(x,sr,R.bpm,R.off);if(ry)Object.assign(R,ry)}catch(e){}
  try{R.ref=refrainsOf(x,sr,R.bpm,R.off)||[]}catch(e){R.ref=[]}
  try{const bf=bandFeat(x,sr);if(bf){R.bd=bf.bd;R.lw=bf.lw;R.br=bf.br}R.pc=+(o.reduce((s,v)=>s+v,0)/n/(Math.sqrt(sq/cn)||.1)).toFixed(4);R.bv=tempoSpread(o,fps,b2)}catch(e){}
  return R;
}
const slim=r=>({ref:r.ref,rk:r.rk,rh:r.rh,sw:r.sw,rf:r.rf,rfc:r.rfc,v:r.v,bpm:r.bpm,bc:r.bc,off:r.off,norm:r.norm,key:r.key,dur:r.dur,en:r.en,ex:r.ex,dr:r.dr,bd:r.bd,lw:r.lw,br:r.br,pc:r.pc,bv:r.bv,tg:r.tg});
const confTxt=c=>c==null?'':c>=.6?'sûr':c>=.3?'probable':'incertain';
/* ===== v4 · Analyse réelle des morceaux ===== */
const BC=new WeakMap(),RC=new WeakMap();
const q36=(v,mx)=>Math.min(35,Math.round(35*Math.sqrt(Math.max(0,v)/mx))).toString(36);
/* Énergie par seconde dans 3 bandes (graves <150 Hz, médiums 300–3400 Hz, aigus >3400 Hz) : mesure réelle sur tout le fichier */
function bandFeat(x,sr){
  sr=Math.round(sr);const S=Math.floor(x.length/sr);if(S<8)return null;
  const k1=1-Math.exp(-6.2832*150/sr),k2=1-Math.exp(-6.2832*300/sr),k3=1-Math.exp(-6.2832*3400/sr);
  let y1=0,y2=0,y3=0,tl=0,tm=0,th=0,mx=1e-9;const L=new Float64Array(S),M=new Float64Array(S),H=new Float64Array(S);
  for(let s=0;s<S;s++){let a=0,b=0,c=0;const p=s*sr;
    for(let j=0;j<sr;j++){const v=x[p+j];y1+=k1*(v-y1);y2+=k2*(v-y2);y3+=k3*(v-y3);const m=y3-y2,h=v-y3;a+=y1*y1;b+=m*m;c+=h*h}
    L[s]=Math.sqrt(a/sr);M[s]=Math.sqrt(b/sr);H[s]=Math.sqrt(c/sr);tl+=a;tm+=b;th+=c;mx=Math.max(mx,L[s],M[s],H[s])}
  const tt=tl+tm+th||1;let bd='';for(const A of[L,M,H])for(let s=0;s<S;s++)bd+=q36(A[s],mx);
  return{bd,lw:+(tl/tt).toFixed(3),br:+(th/tt).toFixed(3)};
}
/* Stabilité du tempo : écart de BPM mesuré sur 3 fenêtres successives (2 premières minutes) */
function tempoSpread(o,fps,b2){
  const n=o.length,W=Math.floor(n/3);if(W<fps*20)return 0;
  const at=(a,i)=>{const k=Math.floor(i),f=i-k;return k>=0&&k+1<n?a[k]*(1-f)+a[k+1]*f:0};let lo=1e9,hi=-1e9;
  for(let w=0;w<3;w++){const a=w*W,e=a+W;let best=-1,bb=b2;
    for(let b=b2-1.5;b<=b2+1.5;b+=.05){const L=60/b*fps;let s=0,c=0;for(let i=a;i+4*L<e;i++){s+=o[i]*(at(o,i+L)+at(o,i+2*L)+at(o,i+4*L));c++}s/=c||1;if(s>best){best=s;bb=b}}
    lo=Math.min(lo,bb);hi=Math.max(hi,bb)}
  return +(hi-lo).toFixed(2);
}
function bandsOf(r){
  let c=r&&BC.get(r);if(c)return c;const s=r&&r.bd;if(!s)return null;
  const n=Math.floor(s.length/3),d=i=>{const v=parseInt(s[i],36)/35;return v*v},l=[],m=[],h=[],e=[];
  for(let i=0;i<n;i++){const a=d(i),b=d(n+i),k=d(2*n+i);l.push(a);m.push(b);h.push(k);e.push(Math.sqrt(a*a+b*b+k*k))}
  BC.set(r,c={n,l,m,h,e});return c;
}
function refOf(r){
  let c=RC.get(r);if(c)return c;const B=bandsOf(r);if(!B)return null;
  const p=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length*.8)]||1e-3};
  RC.set(r,c={l:p(B.l),m:p(B.m),h:p(B.h),e:p(B.e),mmed:med(B.m)||1e-3});return c;
}
function winB(r,t0,t1){
  const B=bandsOf(r);if(!B)return null;const a=clamp(Math.floor(t0),0,B.n-1),b=clamp(Math.ceil(t1),a+1,B.n);let l=0,m=0,h=0,e=0;
  for(let i=a;i<b;i++){l+=B.l[i];m+=B.m[i];h+=B.h[i];e+=B.e[i]}const k=b-a;return{l:l/k,m:m/k,h:h/k,e:e/k};
}
/* « Voix probable » : les médiums dépassent nettement leur niveau habituel dans ce morceau. Estimation, pas une détection de voix. */
const voxOf=(w,rf)=>w&&rf?clamp((w.m/rf.mmed-1)/.7):0;
/* Structure : intro / montée / drop / partie principale / break / fin, déduite de l'énergie mesurée */
function structure(r){
  const B=bandsOf(r);if(!B||B.n<20)return null;const n=B.n,sm=[];
  for(let i=0;i<n;i++){let s=0,c=0;for(let j=Math.max(0,i-2);j<=Math.min(n-1,i+2);j++){s+=B.e[j];c++}sm.push(s/c)}
  const P=refOf(r).e,kind=v=>v<P*.45?0:v>=P*.8?2:1;let runs=[];
  for(let i=0;i<n;i++){const k=kind(sm[i]);if(runs.length&&runs[runs.length-1].k==k)runs[runs.length-1].t1=i+1;else runs.push({t0:i,t1:i+1,k})}
  for(let it=0;it<3;it++){const o=[];for(const u of runs){if(o.length&&(u.t1-u.t0<4||o[o.length-1].k==u.k))o[o.length-1].t1=u.t1;else o.push({...u})}runs=o}
  const out=[];
  for(let i=0;i<runs.length;i++){const u=runs[i],len=u.t1-u.t0,pl=out.length?out[out.length-1].k:'',nx=runs[i+1];let k;
    if(u.k==0)k=i==0?'intro':i==runs.length-1?'outro':len>=6?'break':'main';
    else if(u.k==2)k=(pl=='break'||pl=='build')?'drop':'main';
    else k=nx&&nx.k==2?'build':i==0?'intro':i==runs.length-1?'outro':'main';
    out.push({t0:u.t0,t1:u.t1,k})}
  return out;
}
const secAt=(S,t)=>S&&S.find(s=>t>=s.t0&&t<s.t1)||null;
const SECN={intro:'intro',build:'montée',drop:'drop (explosion)',main:'partie principale',break:'pause (break)',outro:'fin'};

/* ===== Genres ===== */
const ID3G='Blues,Classic Rock,Country,Dance,Disco,Funk,Grunge,Hip-Hop,Jazz,Metal,New Age,Oldies,Other,Pop,R&B,Rap,Reggae,Rock,Techno,Industrial,Alternative,Ska,Death Metal,Pranks,Soundtrack,Euro-Techno,Ambient,Trip-Hop,Vocal,Jazz+Funk,Fusion,Trance,Classical,Instrumental,Acid,House,Game,Sound Clip,Gospel,Noise,AlternRock,Bass,Soul,Punk,Space,Meditative,Instrumental Pop,Instrumental Rock,Ethnic,Gothic,Darkwave,Techno-Industrial,Electronic,Pop-Folk,Eurodance,Dream,Southern Rock,Comedy,Cult,Gangsta,Top 40,Christian Rap,Pop/Funk,Jungle,Native American,Cabaret,New Wave,Psychadelic,Rave,Showtunes,Trailer,Lo-Fi,Tribal,Acid Punk,Acid Jazz,Polka,Retro,Musical,Rock & Roll,Hard Rock'.split(',');
const GFAM=[['hiphop','Hip-hop / rap',/\b(rap|hip.?hop|trap|drill|gangsta|boom bap)\b/],['rnb','R&B / soul',/(r&b|rnb|r'n'b|soul)/],['latin','Latino',/(latin|reggaeton|salsa|bachata|dembow|urbano|merengue|cumbia)/],['afro','Afro',/(afro|amapiano|coupe.?decale|zouk|kizomba|highlife|naija)/],['dancehall','Dancehall / reggae',/(dancehall|reggae|ragga)/],['disco','Disco / funk',/(disco|funk)/],['house','House',/(house|garage|deep)/],['techno','Techno / trance',/(techno|trance|minimal|acid|industrial)/],['edm','EDM / électro',/(edm|electro|dance|big room|dubstep|dnb|drum.?and.?bass|jungle|rave|hardstyle|bass)/],['pop','Pop',/(pop|variet|chanson|top 40)/],['rock','Rock',/(rock|metal|punk|grunge|indie)/]];
const GFN=Object.fromEntries(GFAM.map(g=>[g[0],g[1]]));
function genreFam(t){if(!t)return'';t=String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');for(const[k,,re]of GFAM)if(re.test(t))return k;return''}
const GM={'hiphop|rnb':.75,'hiphop|afro':.6,'hiphop|dancehall':.6,'hiphop|latin':.35,'hiphop|pop':.5,'hiphop|edm':.3,'hiphop|house':.3,'hiphop|techno':.15,'hiphop|rock':.2,'hiphop|disco':.4,
'rnb|pop':.7,'rnb|afro':.6,'rnb|latin':.5,'rnb|disco':.6,'rnb|dancehall':.55,'rnb|house':.4,'latin|afro':.65,'latin|dancehall':.75,'latin|pop':.6,'latin|house':.4,'latin|edm':.4,'latin|disco':.45,
'afro|dancehall':.7,'afro|house':.55,'afro|pop':.5,'afro|disco':.5,'dancehall|pop':.45,'dancehall|house':.4,'disco|house':.8,'disco|pop':.6,'disco|edm':.5,'house|techno':.75,'house|edm':.7,'house|pop':.55,
'techno|edm':.7,'techno|pop':.2,'edm|pop':.6,'pop|rock':.5,'rock|techno':.1,'rock|edm':.2,'rock|house':.15};
const gcompat=(a,b)=>!a||!b?null:a==b?1:(GM[a+'|'+b]??GM[b+'|'+a]??.35);

/* ===== Niveau d'énergie 1–10 relatif à la bibliothèque ===== */
let LIBSTAT=null;
function setLibStats(recs){
  const A=recs.filter(r=>r&&r.bpm&&r.v>=3);LIBSTAT={en:A.map(r=>r.en||0).sort((a,b)=>a-b),pc:A.map(r=>r.pc||0).sort((a,b)=>a-b),lw:A.map(r=>r.lw||0).sort((a,b)=>a-b)};
}
const rankIn=(a,v)=>{if(a.length<2)return .5;let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>1;if(a[m]<v)lo=m+1;else hi=m}return lo/(a.length-1)};
function lvl(r){
  if(!r)return 5;const S=LIBSTAT;
  if(!S||S.en.length<5)return Math.round(clamp(1+9*clamp(((r.en||.3)-.15)/.45),1,10));
  return Math.round(clamp(1+9*(.6*rankIn(S.en,r.en||0)+.3*rankIn(S.pc,r.pc||0)+.1*rankIn(S.lw,r.lw||0)),1,10));
}
const lvF=r=>.5+.5*lvl(r)/10;

/* ===== Compatibilité ===== */
const foldR=(a,b)=>{let r=b/a;while(r>1.4)r/=2;while(r<.7)r*=2;return r};
function pairScore(ra,rb,ga,gb){
  if(!ra||!rb||!ra.bpm||!rb.bpm)return{total:0,tempo:0,key:null,genre:null,son:null,energy:null,rhythm:null,ad:99,notes:['Tempo non détecté'],conflit:false};
  const ad=Math.abs(foldR(ra.bpm,rb.bpm)-1)*100,notes=[];
  const tempo=ad<=3?1:ad<=6?.85-(ad-3)*.07:ad<=10?.6-(ad-6)*.12:.1;
  const key=ra.key&&rb.key?kcF(ra.key,rb.key):null;if(key==null)notes.push('Tonalité non détectée');
  const genre=gcompat(ga||ra.gf||'',gb||rb.gf||'');
  const son=styleSim(ra,rb);if(son==null)notes.push('Style du son pas encore analysé');
  const conflit=familleConflit(ra,rb);
  const energy=ra.v>=3&&rb.v>=3?1-Math.min(1,Math.abs(lvl(ra)-lvl(rb))/6):null;
  const rhythm=ra.pc&&rb.pc?1-Math.min(1,Math.abs(rankIn(LIBSTAT?LIBSTAT.pc:[],ra.pc)-rankIn(LIBSTAT?LIBSTAT.pc:[],rb.pc))*1.3):null;
  const W=[[tempo,.25],[son,.3],[key,.15],[genre,.12],[energy,.1],[rhythm,.08]];let s=0,w=0;for(const[v,k]of W)if(v!=null){s+=v*k;w+=k}
  let total=w?s/w:0;
  if(tempo<.3)total=Math.min(total,.4);if(genre!=null&&genre<.3)total=Math.min(total,.45);
  if(son!=null&&son<.45)total=Math.min(total,.45);if(conflit)total=Math.min(total,.35);
  return{total,tempo,key,genre,son,energy,rhythm,ad,notes,conflit};
}
const kcF=(a,b)=>{if(!a||!b)return .5;const d=Math.min((a.n-b.n+12)%12,(b.n-a.n+12)%12);return a.n==b.n?(a.b==b.b?1:.9):d==1&&a.b==b.b?.85:d==2&&a.b==b.b?.4:.1};

/* ===== Passages candidats ===== */
function exitCands(r,o){
  const S=structure(r),p=60/r.bpm*16,dur=r.dur||(bandsOf(r)&&bandsOf(r).n)||0;if(!dur)return[];
  const lo=Math.max(o.min??24,24),hi=Math.min(dur*.94,dur-(o.tail??30)),L=[];
  for(let k=Math.ceil((lo-r.off)/p);r.off+k*p<=hi;k++){
    const t=r.off+k*p,sc=secAt(S,t);let q=.4,cuts=false;
    if(S){const a=winB(r,t-8,t),b=winB(r,t,t+8),rf=refOf(r);if(a&&b)q+=clamp((a.e-b.e)/rf.e,-.3,.5)*.8;
      if(sc){const rest=sc.t1-t;if(sc.k=='outro')q+=.35;else if(sc.k=='break')q+=.2;else if(sc.k=='drop'&&t-sc.t0<12){cuts=true;q-=.3}else if(rest<=4)q+=.2}}
    if(inRef(r,t)){q-=.45;cuts=true}else if(r.ref&&r.ref.some(([a,b])=>Math.abs(t-b)<=3))q+=.3;
    if(o.phrase&&Math.round((t-r.off)/(60/r.bpm))%32!=0)q-=.15;
    L.push({t,q:clamp(q,0,1),cuts});
  }
  return L;
}
function entryCands(r,o){
  const S=structure(r),p=60/r.bpm*16,dur=r.dur||(bandsOf(r)&&bandsOf(r).n)||0,L=[],drops=(r.dr||[]).map(d=>d[0]),hi=Math.min(dur*.5,o.maxT??180);
  for(let k=0;r.off+k*p<=hi;k++){
    const t=r.off+k*p;if(t<0)continue;const sc=secAt(S,t);let q=.35,drop=false;
    if(t<4)q+=.3;
    if(sc){if(Math.abs(t-sc.t0)<=3){q+=.25;if(sc.k=='drop'){q+=.1;drop=true}}else q-=.1;if(sc.k=='break')q-=.25;if(o.skipIntro&&sc.k=='intro')q-=.4}
    if(drops.some(d=>Math.abs(d-t)<3)){q+=.2;drop=true}
    if(inRef(r,t))q-=.3;
    L.push({t,q:clamp(q,0,1),drop});
  }
  for(const d of drops)if(d<=hi&&!L.some(x=>Math.abs(x.t-d)<3)){const bt=60/r.bpm;L.push({t:Math.max(0,r.off+Math.round((d-r.off)/bt)*bt),q:.55,drop:true})}
  return L;
}
const TECH={blend:'Fondu EQ',bassswap:'Échange des basses',filter:'Filtre',echo:'Écho-sortie',cut:'Coupure nette',drop:'Roulement → drop'};
const BLENDISH=['blend','bassswap','filter'];
function winBeats(tech,tbPref,sc){
  const t=tbPref||16;
  if(tech=='echo')return 4;if(tech=='cut')return 1;if(tech=='drop')return 16;
  let b=tech=='filter'?Math.min(t,16):t;if(sc.total<.5||sc.ad>6)b=Math.min(b,8);return b;
}
function buildPlan(ra,rb,tech,o,sc){
  let tb=o.tbForce||winBeats(tech,o.tb,sc);if(o.propre&&!o.tbForce&&BLENDISH.includes(tech)){if(sc.key!=null&&sc.key<.4)tb=Math.min(tb,8);else if(sc.ad<=3&&sc.total>=.65)tb=Math.max(tb,32)}if(o.nomatch&&tech=='echo')tb=4;
  const q=60/ra.bpm,T=Math.max(tb*q,6);
  let ex=o.fixExit!=null?[{t:o.fixExit,q:.5,cuts:false}]:exitCands(ra,{min:o.exitMin,tail:T+12,phrase:o.propre});
  const en=o.fixEntry!=null?[{t:o.fixEntry,q:.5,drop:true}]:entryCands(rb,{skipIntro:o.skipIntro});
  if(o.near!=null&&o.fixExit==null){const f=ex.filter(e=>e.t>=o.near-4&&e.t<=o.near+60);ex=f.length?f:ex.filter(e=>e.t>=o.near-4).slice(0,2).concat(ex.slice(-1)).filter(Boolean)}
  if(!ex.length||!en.length)return null;
  const rA=refOf(ra),rB=refOf(rb);let best=null;
  for(const e of ex)for(const b of en){
    if(tech=='drop'&&!b.drop)continue;
    const w1=winB(ra,e.t,e.t+T),w2=winB(rb,b.t,b.t+T);let c=-(e.q+b.q),bass=0,vo=0,gap=0;
    if(w1&&w2&&rA&&rB){bass=Math.min(w1.l/rA.l,w2.l/rB.l);vo=Math.min(voxOf(w1,rA),voxOf(w2,rB));gap=Math.abs(w1.e/rA.e*lvF(ra)-w2.e/rB.e*lvF(rb));
      c+=(tech=='bassswap'||tech=='drop'?.2:1)*bass*.8+vo*1.1+(tech=='drop'?0:gap*.9)}
    if(o.near!=null)c+=Math.abs(e.t-o.near)*.004;if(e.cuts)c+=.4;
    if(ra.ref&&ra.ref.some(([a])=>a>e.t+1&&a<e.t+T))c+=.3;
    if(!best||c<best.c)best={c,e,b,bass,vo,gap};
  }
  if(!best)return null;
  const P={tech,tb,exit:best.e.t,entry:best.b.t,eq:{lowSwap:tech!='blend',midCut:best.vo>.35&&BLENDISH.includes(tech)},fx:{riser:tech=='drop'&&!o.propre,impact:tech=='drop'&&!o.propre},cost:best.c,sc,metrics:{bass:best.bass,vox:best.vo,gap:best.gap},cuts:best.e.cuts,nomatch:!!o.nomatch};
  P.why=whyOf(ra,rb,P);return P;
}
function whyOf(ra,rb,P){
  const sc=P.sc,w=[],Sa=structure(ra),Sb=structure(rb),sa=secAt(Sa,P.exit),sb=secAt(Sb,P.entry);
  w.push('Tempo : '+ra.bpm.toFixed(1)+' → '+rb.bpm.toFixed(1)+' BPM, écart '+sc.ad.toFixed(1)+' %'+(sc.ad<=3?' (très propre)':sc.ad<=6?' (le suivant sera légèrement ajusté)':' (gros écart)'));
  if(sc.key!=null)w.push('Tonalités '+cmF(ra.key)+' → '+cmF(rb.key)+' : '+(sc.key>=.85?'compatibles':sc.key>=.4?'proches, mélange court':'incompatibles'));
  if(sc.son!=null)w.push('Style du son : '+(sc.son>=.7?'très proche':sc.son>=.5?'assez proche':'différent')+(ra.rf&&rb.rf?' ('+RFC[ra.rf]+' → '+RFC[rb.rf]+')':''));
  if(sc.genre!=null)w.push('Styles : '+(sc.genre>=.7?'cohérents':sc.genre>=.4?'voisins':'éloignés, transition préparée'));
  w.push('Sortie de A à '+fmtF(P.exit)+(sa?' ('+SECN[sa.k]+')':'')+' · entrée de B à '+fmtF(P.entry)+(sb?' ('+SECN[sb.k]+')':''));
  const m=P.metrics;if(BLENDISH.includes(P.tech)){w.push(m.vox>.5?'Voix probables des deux côtés : médiums de A coupés pendant le mélange':m.vox<.3?'Peu de voix qui se chevauchent sur ce passage':'Voix modérées sur le passage')}
  return w;
}
const cmF=k=>k?k.n+(k.b?'B':'A'):'?';

function techPriors(sc,ra,rb,o){
  const pr={blend:0,bassswap:0,filter:.05,echo:.12,cut:.3,drop:.1},bad=(sc.genre!=null&&sc.genre<.4)||(sc.key!=null&&sc.key<.3)||sc.ad>8;
  if(bad){pr.echo-=.2;pr.cut-=.05;pr.blend+=.5;pr.bassswap+=.5;pr.drop+=.3}
  else{if(sc.total>=.75&&sc.ad<=4){pr.bassswap-=.2;pr.blend-=.1}
    const ea=lvl(ra),eb=lvl(rb);if(eb>ea+1)pr.drop-=.15;if(o.drop)pr.drop-=.2}
  if(o.propre){pr.blend-=.1;pr.bassswap-=.2;pr.echo+=.3;pr.filter+=.05}
  const h=Math.floor((ra.bpm*7+rb.bpm*13)*10)%3;pr.blend+=h==0?.02:0;pr.filter+=h==1?-.03:0;pr.bassswap+=h==2?.02:0;
  return pr;
}
/* Génère un plan pour chaque technique possible, avec ses erreurs ; planPair retient le meilleur */
function planAll(ra,rb,o={}){
  if(!ra||!rb||!ra.bpm||!rb.bpm)return[];
  const sc=pairScore(ra,rb,o.ga,o.gb),pr=techPriors(sc,ra,rb,o),L=[];
  // changement de style ou de tempo trop grand : comme un DJ, sortie en écho sans forcer le tempo du suivant
  const saut=o.propre&&!o.tech&&(sc.ad>6||sc.conflit||(sc.son!=null&&sc.son<.45));
  if(saut){o=Object.assign({},o,{nomatch:true});const P=buildPlan(ra,rb,'echo',o,sc);if(P){P.issues=detectIssues(P,ra,rb).filter(i=>!['tempo','style','genre','key','energy'].includes(i.id));P.rank=0;P.why.unshift('Changement de style : sortie en écho sur une fin de phrase, le morceau suivant démarre à son propre tempo (rien n\'est forcé)');return[P]}}
  for(const tech of Object.keys(TECH)){
    if(o.tech&&o.tech!=tech)continue;
    if(o.propre&&!o.tech&&(tech=='drop'||tech=='cut'))continue;
    const P=buildPlan(ra,rb,tech,o,sc);if(!P)continue;
    P.issues=detectIssues(P,ra,rb);const ne=P.issues.filter(i=>i.sev=='err').length,nw=P.issues.filter(i=>i.sev=='warn').length;
    P.rank=P.cost+pr[tech]+ne*.6+nw*.12;L.push(P);
  }
  return L.sort((a,b)=>a.rank-b.rank);
}
function planPair(ra,rb,o={}){
  if(!ra||!rb||!ra.bpm||!rb.bpm)return null;
  if(!bandsOf(ra)||!bandsOf(rb)){ // analyse ancienne : plan minimal honnête
    const sc=pairScore(ra,rb,o.ga,o.gb);return{tech:'blend',tb:o.tb||16,exit:ra.ex||null,entry:(rb.dr&&rb.dr[0]?rb.dr[0][0]:0),eq:{lowSwap:false,midCut:false},fx:{},sc,issues:[],why:['Analyse incomplète : ré-analyse ce morceau pour un plan précis'],limited:true,rank:9};
  }
  return planAll(ra,rb,o)[0]||null;
}

/* ===== Détection d'erreurs de transition ===== */
function detectIssues(P,ra,rb){
  const I=[],sc=P.sc||pairScore(ra,rb),add=(id,sev,msg,fix)=>I.push({id,sev,msg,fix}),bl=BLENDISH.includes(P.tech),q=60/ra.bpm,T=P.tb*q;
  const rA=refOf(ra),rB=refOf(rb),w1=rA&&winB(ra,P.exit,P.exit+Math.max(T,4)),w2=rB&&winB(rb,P.entry,P.entry+Math.max(T,4));
  const vo=w1&&w2?Math.min(voxOf(w1,rA),voxOf(w2,rB)):0,bass=w1&&w2?Math.min(w1.l/rA.l,w2.l/rB.l):0;
  const eA=w1?w1.e/rA.e*lvF(ra):0,eB=w2?w2.e/rB.e*lvF(rb):0;
  if(sc.ad>10&&P.tb>4)add('tempo','err','Écart de tempo de '+sc.ad.toFixed(1)+' % : le titre suivant serait trop accéléré ou ralenti, la voix sonnerait faux.',{tech:'echo'});
  else if(sc.ad>6&&bl&&P.tb>8)add('tempo','warn','Écart de tempo de '+sc.ad.toFixed(1)+' % sur '+P.tb+' temps : les rythmes vont se décaler.',{tb:8});
  if((ra.bv>1.5||rb.bv>1.5)&&bl&&P.tb>8)add('tvar','warn','Tempo instable sur '+(ra.bv>1.5?'A':'B')+' (±'+Math.max(ra.bv,rb.bv).toFixed(1)+' BPM) : un mélange long se désynchroniserait.',{tb:8});
  if(sc.key!=null&&sc.key<.4&&bl&&P.tb>8)add('key','warn','Tonalités '+cmF(ra.key)+' → '+cmF(rb.key)+' peu compatibles : les mélodies vont se battre sur '+P.tb+' temps.',{tb:8,tech:'filter'});
  if(sc.conflit||(sc.son!=null&&sc.son<.45))add('style','warn','Styles très différents ('+(RFC[ra.rf]||'?')+' → '+(RFC[rb.rf]||'?')+') : l\'enchaînement risque de sonner faux, sauf effet de coupure.',{tech:'echo'});
  if(sc.genre!=null&&sc.genre<.4&&bl&&P.tb>8)add('genre','warn','Changement de style ('+(GFN[ra.gf]||'?')+' → '+(GFN[rb.gf]||'?')+') trop marqué pour un long mélange : à préparer avec un écho court ou à éviter.',{tech:'echo'});
  if(bl&&Math.abs(eA-eB)>.35)add('energy','warn',eB>eA?'Montée d\'énergie trop brutale pour un simple fondu.':'Chute d\'énergie trop brutale pour un simple fondu.',eB>eA&&(rb.dr&&rb.dr.length)?{tech:'drop'}:{tech:'echo'});
  if(bl&&vo>.5&&P.tb>4){const alt=bestInstrEntry(rb,P);if(!P.eq.midCut)add('vocal','warn','Voix probables sur les deux titres en même temps pendant le mélange.',{eq:{midCut:true}});else if(vo>.75)add('vocal','warn','Voix très présentes des deux côtés malgré la coupe des médiums.',alt!=null?{entry:alt}:{tech:'echo'})}
  const stepB=60/rb.bpm*16,off=((P.entry-rb.off)%stepB+stepB)%stepB;if(Math.min(off,stepB-off)>60/rb.bpm*.75&&P.tech!='drop')add('entry','warn','L\'entrée de B ne tombe pas sur un début de phrase (16 temps) : elle sonnera décalée.',{entry:Math.max(0,rb.off+Math.round((P.entry-rb.off)/stepB)*stepB)});
  const sb=secAt(structure(rb),P.entry);if(sb&&sb.k=='break'&&P.tech!='drop')add('entry2','warn','B entre en plein break : peu de rythme pour caler le mélange.',{entry:sb.t1});
  if(inRef(ra,P.exit))add('refrain','warn','La sortie coupe un refrain de A (estimé) : mieux vaut attendre la fin du refrain.',{exit:(refAt(ra,P.exit)||[0,P.exit])[1]});
  if(P.cuts)add('cut','warn','La sortie de A tombe juste après un drop : elle coupe une partie forte du morceau.',{exit:P.exit+16*60/ra.bpm});
  if(ra.dur&&P.exit+T+4>ra.dur)add('room','err','Il ne reste pas assez de morceau A pour terminer la transition.',{exit:Math.max(24,ra.dur-T-20),tb:8});
  if(bl&&!P.eq.lowSwap&&bass>.6&&P.tb>4)add('bass','warn','Les basses des deux titres vont se superposer (fondu sans échange des graves).',{tech:'bassswap',eq:{lowSwap:true}});
  if(P.tech=='drop'){const nd=(rb.dr||[]).some(d=>Math.abs(d[0]-P.entry)<3)||(secAt(structure(rb),P.entry)||{}).k=='drop';if(!nd)add('fx','warn','Roulement → drop sans vrai drop dans B à ce point : la montée ne débouche sur rien.',{tech:'blend'})}
  if(P.fx&&P.fx.riser&&P.tech!='drop'&&Math.abs(eA-eB)<.1)add('fx2','warn','Riser inutile : l\'énergie des deux passages est déjà équivalente.',{fx:{riser:false}});
  return I;
}
function bestInstrEntry(rb,P){
  const rB=refOf(rb),T=Math.max(P.tb*60/rb.bpm,4);let best=null,bv=1;
  for(const c of entryCands(rb,{})){const w=winB(rb,c.t,c.t+T),v=voxOf(w,rB);if(v<bv&&v<.35&&c.q>=.3){bv=v;best=c.t}}return best;
}
/* Applique une correction proposée, en recalculant ce qui en dépend */
function refit(ra,rb,P,fix,o={}){
  const m={tech:fix.tech||P.tech,exit:fix.exit??P.exit,entry:fix.entry??P.entry};
  const oo=Object.assign({},o,{tech:null,fixExit:fix.exit!=null||o.lockExit?m.exit:null,fixEntry:fix.entry!=null||o.lockEntry?m.entry:null,tbForce:fix.tb||(fix.tech&&fix.tech!=P.tech?null:P.tb)});
  const sc=P.sc||pairScore(ra,rb,o.ga,o.gb);let N=buildPlan(ra,rb,m.tech,oo,sc);if(!N)return P;
  if(fix.eq)N.eq=Object.assign({},N.eq,fix.eq);else if(m.tech==P.tech)N.eq=Object.assign({},N.eq,P.eq);
  if(fix.fx)N.fx=Object.assign({},N.fx,fix.fx);else if(m.tech==P.tech)N.fx=Object.assign({},P.fx);
  N.issues=detectIssues(N,ra,rb);return N;
}
const planTxtF=P=>!P?'':(TECH[P.tech]||P.tech)+(P.tb>1?' · '+P.tb+' temps':'');
