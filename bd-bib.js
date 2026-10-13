'use strict';
/* ===== BeatDeck 5 · bibliothèque de morceaux =====
   Les fichiers audio restent sur ta tablette. Seules les analyses (tempo, tonalité, structure) sont gardées, dans IndexedDB. */
const lib=[];let META={},anaBusy=0,LV=[],navI=0,GENU=LS.get('bd_gen',{}),libQ='';
const AUD=/\.(mp3|m4a|wav|flac|ogg|aac|opus|webm)$/i;
const kid=f=>f.name+'|'+f.size+'|'+f.lastModified;
const cm=k=>k?k.n+(k.b?'B':'A'):'?';
const itemById=id=>lib.find(x=>x.id==id);
const famOf=(r,id)=>GENU[id]||genreFam(r&&r.tg&&r.tg.g)||'';
function sauverMeta(it){META[it.id]=it.r;IDB.put('meta',it.id,it.r).catch(()=>{})}
async function chargerMeta(){
  try{META=await IDB.all('meta')}catch(e){META={}}
  // reprise des anciennes analyses de BeatDeck 4 (stockées dans le navigateur)
  const old=LS.get('bd_meta',null);if(old){LS.del('bd_meta')}
}
function refreshLib(){setLibStats(lib.map(x=>x.r));lib.forEach(x=>{if(x.r)x.r.gf=famOf(x.r,x.id)})}
function prepStatus(){const n=lib.length,d=lib.filter(x=>x.r&&x.r.v>=ANA_V).length,e=$('prep');if(!e)return;e.hidden=!n;e.textContent=d<n?'Analyse '+d+'/'+n:'Prêt · '+d+' morceaux';e.classList.toggle('ok',d>=n)}
async function readTags(f){
  try{const u=new Uint8Array(await f.slice(0,262144).arrayBuffer());if(u[0]!=73||u[1]!=68||u[2]!=51)return null;
    const ver=u[3],sz=((u[6]&127)<<21)|((u[7]&127)<<14)|((u[8]&127)<<7)|(u[9]&127),T={};let p=10;
    const dec=a=>{const e=a[0],b=a.slice(1);try{return new TextDecoder(e==1?'utf-16':e==2?'utf-16be':e==3?'utf-8':'iso-8859-1').decode(b).replace(/\0/g,'').trim()}catch(x){return''}};
    while(p+10<Math.min(u.length,sz+10)){const id=String.fromCharCode(u[p],u[p+1],u[p+2],u[p+3]);if(!/^[A-Z0-9]{4}$/.test(id))break;
      const s=ver==4?((u[p+4]&127)<<21)|((u[p+5]&127)<<14)|((u[p+6]&127)<<7)|(u[p+7]&127):(u[p+4]<<24)|(u[p+5]<<16)|(u[p+6]<<8)|u[p+7];
      if(['TIT2','TPE1','TCON','TYER','TDRC'].includes(id))T[id]=dec(u.slice(p+10,p+10+s));p+=10+s;if(s<=0)break}
    let g=T.TCON||'';g=g.replace(/\((\d+)\)/g,(m,n)=>ID3G[+n]||'').replace(/^(\d+)$/,(m,n)=>ID3G[+n]||m);
    return{t:T.TIT2||'',a:T.TPE1||'',g,y:T.TDRC||T.TYER||''};
  }catch(e){return null}
}
async function analyseFile(f){const buf=await AC.decodeAudioData(await f.arrayBuffer());const r=slim(analyseBuf(buf));r.tg=await readTags(f);return r}
async function addFiles(fs){
  let n0=lib.length;
  for(const f of fs){if(!AUD.test(f.name))continue;const id=kid(f);if(lib.some(x=>x.id==id))continue;const m=META[id];lib.push({id,name:f.name.replace(/\.[^.]+$/,''),f,r:m&&m.v>=ANA_V?m:null})}
  if(lib.length==n0&&!fs.length)return;
  renderLib();prepStatus();if(anaBusy)return;anaBusy=1;let n=0;
  for(const it of lib)if(!it.r){
    while(D.some(d=>!d.a.paused)&&!PREF.anaLive)await sleep(3000);
    $('ls').textContent='Analyse : '+lib.filter(x=>x.r).length+'/'+lib.length+' (tu peux déjà charger les morceaux analysés)';
    try{it.r=await analyseFile(it.f)}catch(x){it.r={v:ANA_V,bpm:0,off:0,norm:1,err:1}}
    sauverMeta(it);prepStatus();if(++n%4==0)renderLib();
  }
  anaBusy=0;renderLib();prepStatus();$('ls').textContent=lib.length+' morceaux prêts';
}
async function walk(h,o){for await(const[n,e]of h.entries()){if(e.kind=='file'){if(AUD.test(n))o.push(await e.getFile())}else await walk(e,o)}}
async function ouvrirDossier(){
  try{
    let h=null;try{h=await IDB.get('divers','dossier')}catch(e){}
    if(!(h&&await h.requestPermission({mode:'read'})=='granted')){h=await showDirectoryPicker({id:'musique'});try{await IDB.put('divers','dossier',h)}catch(e){}}
    $('ls').textContent='Lecture du dossier…';const o=[];await walk(h,o);addFiles(o);
  }catch(e){if(e.name!='AbortError')$('lfd').click()}
}
async function relireDossier(){
  try{const h=await IDB.get('divers','dossier');if(!h)return;$('ld_').textContent='Rouvrir : '+h.name;
    if((await h.queryPermission({mode:'read'}))=='granted'){const o=[];await walk(h,o);addFiles(o)}}catch(e){}
}

/* --- Liste --- */
function renderLib(){
  refreshLib();const el=$('ll');if(!el)return;
  const rd=D.find(d=>!d.a.paused&&d.bpm)||D[live()],cr=rd?recOf(rd):null,q=libQ.toLowerCase();
  LV=lib.map((it,k)=>({it,k,s:cr&&it.r&&it.r.bpm?pairScore(cr,it.r).total:0})).filter(x=>x.it.name.toLowerCase().includes(q)).sort((a,b)=>b.s-a.s||a.it.name.localeCompare(b.it.name));
  navI=clamp(navI,0,Math.max(0,LV.length-1));
  el.innerHTML=LV.map(({it,k,s},i)=>{const r=it.r;return`<div class="lr${i==navI?' sel1':''}"><button class="nm" data-l="${k}" data-d="a">${s>.7?'✓ ':''}${esc(it.name)}</button><small>${r?(r.bpm?Math.round(r.bpm)+(r.bc<.3?'?':'')+' · '+cm(r.key)+' · '+(r.rf?RFC[r.rf]+' · ':'')+'N'+lvl(r)+(r.gf?' · '+GFN[r.gf]:''):'tempo ?'):'…'}</small><button data-l="${k}" data-d="0" class="d0">1</button><button data-l="${k}" data-d="1" class="d1">2</button><button data-l="${k}" data-d="n" title="Ajouter à la file">»</button><button data-tk="${k}" title="Détails">⋯</button></div>`}).join('')||'<p class="mu">Touche « Mon dossier de musique » pour commencer.</p>';
  const A=lib.filter(x=>x.r&&x.r.bpm&&x.r.v>=ANA_V).slice(0,120),T=[];
  for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++){const s=pairScore(A[i].r,A[j].r).total;if(T.length<40||s>T[39][0]){T.push([s,A[i],A[j]]);T.sort((a,b)=>b[0]-a[0]);if(T.length>40)T.pop()}}
  const used=new Set(),Z=T.filter(p=>!used.has(p[1])&&!used.has(p[2])&&used.add(p[1]).add(p[2])).slice(0,5);
  $('dl').innerHTML=Z.map(([s,a,b])=>`<div class="lr"><span>${esc(a.name)} + ${esc(b.name)}</span><small>${Math.round(s*100)} %</small><button data-p="${lib.indexOf(a)},${lib.indexOf(b)}">1 + 2</button></div>`).join('')||'<p class="mu">Les duos apparaissent dès que 2 morceaux sont analysés.</p>';
}
function libClick(e){
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.tk){showTrk(+b.dataset.tk);return}
  if(b.dataset.p){if(D.some(d=>!d.a.paused)){toast('Mets les deux decks en pause d\'abord');return}const[x,y]=b.dataset.p.split(',').map(Number);chargerDeck(0,lib[x]);chargerDeck(1,lib[y]);closePanels();return}
  if(b.dataset.l){const it=lib[+b.dataset.l];let d=b.dataset.d;
    if(d=='n'){AUTO.queue.push(it);toast('File d\'attente ('+AUTO.queue.length+') : '+it.name);return}
    if(d=='a')d=libTarget!=null?libTarget:D[0].a.paused&&live()!=0?0:D[1].a.paused?1:D[0].a.paused?0:-1;
    if(d<0){toast('Les deux decks jouent');return}
    chargerDeck(+d,it).then(ok=>{if(ok)AUTO.played.add(it.id)});closePanels()}
}
let libTarget=null;
function openLib(t){libTarget=t;Q('#libm h2').textContent=t==null?'Morceaux':'Morceau pour le deck '+(t+1);openPanel('libm');renderLib()}
function navScroll(d){if(!LV.length){renderLib();if(!LV.length)return}navI=clamp(navI+Math.sign(d),0,LV.length-1);
  const x=LV[navI];coach('Sélection : '+x.it.name+(x.it.r&&x.it.r.bpm?' · '+Math.round(x.it.r.bpm)+' BPM':''),0,3000);
  QA('#ll .lr').forEach((r,k)=>{r.classList.toggle('sel1',k==navI);if(k==navI)r.scrollIntoView({block:'nearest'})})}
function navLoad(i){if(!LV.length)renderLib();const x=LV[navI];if(!x){toast('Aucun morceau dans la liste');return}chargerDeck(i,x.it).then(ok=>{if(ok){AUTO.played.add(x.it.id);toast('Deck '+(i+1)+' : '+x.it.name)}})}
function recOf(d){const it=d.cur&&d.cur.r&&d.cur.r.v>=ANA_V?d.cur:null,r=d.r&&d.r.v>=ANA_V?d.r:it&&it.r;if(!r||!r.bpm)return null;r.gf=famOf(it?it.r:r,it?it.id:null);return r}
function showTrk(k){
  const it=lib[k],r=it.r;$('trkt').textContent=it.name;let h='';
  if(!r||!r.bpm)h='<p>Ce morceau n\'est pas encore analysé, ou son tempo n\'a pas pu être détecté.</p>';
  else{const S=structure(r),t=r.tg||{};
    h=`<h3>Mesuré sur le fichier</h3><ul class="pl"><li>Tempo : ${nf(r.bpm,1)} BPM · <b>${confTxt(r.bc)}</b>${r.bv?' · variation '+nf(r.bv,1)+' BPM au début':''}</li><li>Tonalité : ${cm(r.key)} · <b>${confTxt(r.key&&r.key.c)}</b> (estimée sur 30 s au milieu)</li><li>Style du rythme : ${r.rf?RFN[r.rf]+' · <b>'+confTxt(r.rfc)+'</b>':'pas encore analysé'}</li><li>Énergie : niveau ${lvl(r)}/10 (par rapport à ta bibliothèque)</li><li>Répartition : graves ${Math.round((r.lw||0)*100)} % · aigus ${Math.round((r.br||0)*100)} %</li></ul>
    <h3>Structure estimée d'après l'énergie</h3><p>${S?S.map(s=>SECN[s.k]+' '+fmt(s.t0)).join(' · '):'Analyse trop courte'}</p>
    <h3>Pas encore disponible</h3><ul class="pl"><li>Paroles et voix : pas de reconnaissance vocale pour l'instant. Seuls les médiums sont mesurés pour estimer les voix qui se chevauchent.</li><li>Genre : lu dans les informations du fichier (${esc(t.g||'aucune')}) ou choisi ci-dessous.</li></ul>
    <h3>Genre (pour éviter les enchaînements incohérents)</h3><div class="chips" id="trkg">${[['','Auto (fichier)']].concat(GFAM.map(g=>[g[0],g[1]])).map(([v,n])=>`<button class="chip${(GENU[it.id]||'')==v?' a':''}" data-g="${v}">${n}</button>`).join('')}</div><p class="mu">Genre retenu : ${GFN[famOf(r,it.id)]||'inconnu'}</p>`}
  $('trkb').innerHTML=h;openPanel('trk',true);
  const g=$('trkg');if(g)g.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.g)GENU[it.id]=b.dataset.g;else delete GENU[it.id];LS.set('bd_gen',GENU);renderLib();showTrk(k)};
}
/* ===== choix du morceau suivant : style du son, tempo, tonalité, énergie =====
   Exigence (palette IA) : stricte = jamais deux styles qui ne vont pas ensemble ; normale ; libre. */
const REFUS=LS.get('bd5_refus',{});
function noterRefus(a,b){if(!a||!b)return;const k=a+'>'+b;REFUS[k]=(REFUS[k]||0)+1;LS.set('bd5_refus',REFUS)}
const SEUILS={stricte:{t:.6,te:.55,so:.55},normale:{t:.48,te:.4,so:.45},libre:{t:0,te:0,so:0}};
function classer(ref,refId){
  refreshLib();
  return lib.filter(it=>it.r&&it.r.bpm&&it.id!==refId).map(it=>{const sc=ref?pairScore(ref,it.r):null;let s=sc?sc.total:Math.random();
    const rf=refId&&REFUS[refId+'>'+it.id];if(rf)s-=.25*Math.min(2,rf);return{it,sc,s,refus:rf||0}}).sort((a,b)=>b.s-a.s);
}
function passe(x,niv){const S=SEUILS[niv]||SEUILS.stricte,sc=x.sc;if(!sc)return true;return x.s>=S.t&&sc.tempo>=S.te&&(sc.son==null||sc.son>=S.so)&&!(niv!='libre'&&sc.conflit)}
function pickNext(cur,again){
  AUTO.warn='';
  if(AUTO.queue.length&&!again){AUTO.lastQ=true;return AUTO.queue.shift()}
  AUTO.lastQ=false;
  const L=classer(cur&&cur.r,cur&&cur.id).filter(x=>!AUTO.played.has(x.it.id)&&!D.some(d=>d.cur===x.it));
  if(!cur||!cur.r){const x=L[Math.floor(Math.random()*Math.min(L.length,5))];return x?x.it:null}
  const niv=PREF.ex||'stricte';
  let ch=L.find(x=>passe(x,niv))||(niv=='stricte'?L.find(x=>passe(x,'normale')):null);
  if(!ch&&!again&&AUTO.played.size){AUTO.played.clear();D.forEach(d=>{if(d.cur)AUTO.played.add(d.cur.id)});return pickNext(cur,true)}
  if(!ch&&L.length){ch=L[0];AUTO.warn='Aucun morceau vraiment du même style : je prends le moins éloigné ('+Math.round(ch.s*100)+' %). Ajoute des morceaux du même style ou choisis toi-même.'}
  return ch?ch.it:null;
}
