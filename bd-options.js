'use strict';
/* ===== BeatDeck 6 · options de soirée =====
   1. File d'attente : les demandes (tablette ou téléphone) passent dans l'ordre, chacune avec la meilleure transition.
   2. Enregistrer la soirée : tout ce qui sort des enceintes est enregistré dans un fichier audio.
   3. Sauvegarde : un fichier avec tes musiques, tes duos, tes transitions et tes réglages, pour ne jamais rien perdre. */

/* ---------- 1. FILE D'ATTENTE ---------- */
let FILE=LS.get('bd6_file',[]);
function fileValide(){return FILE.filter(id=>sonDe(id))}
function sauverFile(){LS.set('bd6_file',FILE);rendreFile();telEnvoyerFile();majFile()}
function ajouterFile(id,enTete){
  const s=sonDe(id);if(!s)return 0;
  FILE=FILE.filter(x=>x!=id);if(enTete)FILE.unshift(id);else FILE.push(id);sauverFile();
  return FILE.indexOf(id)+1;
}
function retirerFile(id){FILE=FILE.filter(x=>x!=id);sauverFile()}
function monterFile(id){const k=FILE.indexOf(id);if(k>0){[FILE[k-1],FILE[k]]=[FILE[k],FILE[k-1]];sauverFile()}}
// la 1re musique de la file se prépare tout de suite sur le deck libre (à la place d'une musique choisie automatiquement)
function majFile(){const P=D.find(d=>!d.a.paused&&d.sonId);if(P)proposerDuo(P.i)}
// une musique de la file qui se met à jouer sort de la file
setInterval(()=>{const j=D.filter(d=>!d.a.paused&&d.sonId).map(d=>d.sonId);if(j.some(id=>FILE.includes(id))){FILE=FILE.filter(x=>!j.includes(x));sauverFile()}},1000);
function rendreFile(){
  const el=$('lFile'),t=$('tF');const L=fileValide();if(t)t.textContent=L.length||'';if(!el)return;
  el.innerHTML=L.length?L.map((id,k)=>{const s=sonDe(id);return`<div class="ls" data-fid="${esc(id)}"><b class="num">${k+1}</b><span class="nm">${esc(s.nom)}<small>${esc(infoSon(s))}</small></span>
    ${k?'<button data-fa="haut" title="Monter">↑</button>':''}<button class="sup" data-fa="sup" title="Retirer de la file">✕</button></div>`}).join('')
    :'<p class="vide">La file est vide. Dans « Mes sons », touche ＋📋 sur une musique (ou depuis le téléphone) pour l\'ajouter.</p>';
  $('fileVide').hidden=!L.length;
}

/* ---------- 2. ENREGISTRER LA SOIRÉE ---------- */
// les morceaux d'enregistrement sont rangés au fur et à mesure dans la tablette : même si la page se ferme, rien n'est perdu
const RDB=(()=>{let p=null;
  const ouvrir=()=>p||(p=new Promise((ok,no)=>{const r=indexedDB.open('beatdeck6-enreg',1);
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('m'))db.createObjectStore('m',{keyPath:'k'})};
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
  const tx=async(mode,f)=>{const db=await ouvrir();return new Promise((ok,no)=>{const t=db.transaction('m',mode),r=f(t.objectStore('m'));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})};
  return{tous:()=>tx('readonly',s=>s.getAll()),mettre:v=>tx('readwrite',s=>s.put(v)),enlever:k=>tx('readwrite',s=>s.delete(k))};
})();
const REC={mr:null,sess:null,seq:0,t0:0,taille:0,chaine:Promise.resolve(),dest:null,type:null,timer:null};
function recType(){
  if(!window.MediaRecorder)return null;
  for(const[t,e]of[['audio/mp4;codecs=mp4a.40.2','m4a'],['audio/mp4','m4a'],['audio/webm;codecs=opus','webm'],['audio/webm','webm'],['audio/ogg;codecs=opus','ogg']])
    try{if(MediaRecorder.isTypeSupported(t))return{t,e}}catch(x){}
  return null;
}
const dureeTxt=ms=>{const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s/60)%60;return(h?h+' h '+String(m).padStart(2,'0'):m)+' min '+String(s%60).padStart(2,'0')+' s'};
const hms=t=>{t=Math.floor(t);const h=Math.floor(t/3600),m=Math.floor(t/60)%60,s=t%60;return(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0')};
const moTxt=o=>o>1048576*1000?nf(o/1073741824,1)+' Go':Math.max(1,Math.round(o/1048576))+' Mo';
async function recDemarrer(){
  if(REC.mr)return;const ty=recType();
  if(!ty){toast('Ce navigateur ne sait pas enregistrer le son : utilise Chrome à jour');return}
  try{if(AC.state!='running')await AC.resume()}catch(e){}
  if(!REC.dest){REC.dest=AC.createMediaStreamDestination();BUS.lim.connect(REC.dest)}
  let mr;try{mr=new MediaRecorder(REC.dest.stream,{mimeType:ty.t,audioBitsPerSecond:192000})}catch(e){try{mr=new MediaRecorder(REC.dest.stream)}catch(e2){toast('Enregistrement impossible sur cet appareil');return}}
  const sess=Date.now().toString(36);Object.assign(REC,{mr,sess,seq:0,t0:Date.now(),taille:0,type:{t:mr.mimeType||ty.t,e:ty.e},chaine:Promise.resolve()});
  mr.ondataavailable=e=>{if(!e.data||!e.data.size)return;const m={k:sess+'|'+String(REC.seq++).padStart(7,'0'),sess,type:REC.type.t,ext:REC.type.e,debut:REC.t0,fin:Date.now(),blob:e.data};REC.taille+=e.data.size;
    REC.chaine=REC.chaine.then(()=>RDB.mettre(m)).catch(err=>{console.error(err);toast('⚠ Mémoire pleine : l\'enregistrement s\'arrête');recArreter()})};
  mr.onstop=()=>{const s=REC.sess;REC.chaine.then(()=>{REC.mr=null;majRec();recTelecharger(s,true)})};
  mr.start(5000);majRec();toast('⏺ Enregistrement de la soirée lancé');
  clearInterval(REC.timer);REC.timer=setInterval(majRec,1000);
}
function recArreter(){if(REC.mr&&REC.mr.state!='inactive'){REC.mr.stop();toast('■ Enregistrement arrêté : préparation du fichier…')}clearInterval(REC.timer)}
async function recSessions(){
  let L=[];try{L=await RDB.tous()}catch(e){}
  const S={};for(const m of L){const s=S[m.sess]||(S[m.sess]={sess:m.sess,debut:m.debut,fin:m.fin,ext:m.ext,type:m.type,taille:0,n:0});s.taille+=m.blob.size;s.n++;s.fin=Math.max(s.fin,m.fin)}
  return Object.values(S).sort((a,b)=>b.debut-a.debut);
}
function nomFichierDate(t){const d=new Date(t),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'-'+p(d.getHours())+'h'+p(d.getMinutes())}
function telecharger(blob,nom){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=nom;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),120000)}
async function recTelecharger(sess,auto){
  let L=[];try{L=(await RDB.tous()).filter(m=>m.sess==sess).sort((a,b)=>a.k<b.k?-1:1)}catch(e){}
  if(!L.length){toast('Enregistrement introuvable');return}
  telecharger(new Blob(L.map(m=>m.blob),{type:L[0].type}),'BeatDeck-soiree-'+nomFichierDate(L[0].debut)+'.'+L[0].ext);
  toast(auto?'💾 Enregistrement prêt : il se télécharge (dossier Téléchargements)':'💾 Téléchargement lancé');rendreRec();
}
async function recSupprimer(sess){
  if(!confirm('Supprimer cet enregistrement de la tablette ? (Vérifie d\'abord qu\'il est bien dans tes Téléchargements.)'))return;
  try{for(const m of(await RDB.tous()).filter(m=>m.sess==sess))await RDB.enlever(m.k)}catch(e){}rendreRec();toast('Enregistrement supprimé');
}
function majRec(){
  const b=$('bRec');if(!b)return;const on=!!REC.mr;b.classList.toggle('rec',on);
  b.textContent=on?'⏺ REC '+hms((Date.now()-REC.t0)/1000):'⏺ Enregistrer';
  if(!$('recp').hidden){$('recOn').textContent=on?'■ Arrêter et télécharger':'⏺ Démarrer l\'enregistrement';$('recOn').className=on?'stop':'fort';
    $('recE').textContent=on?'⏺ Enregistrement en cours : '+dureeTxt(Date.now()-REC.t0)+' · '+moTxt(REC.taille):'Pas d\'enregistrement en cours.';$('recE').className='info'+(on?' rec':'')}
}
async function rendreRec(){
  majRec();if($('recp').hidden)return;
  const S=(await recSessions()).filter(s=>!REC.mr||s.sess!=REC.sess);
  $('recL').innerHTML=S.length?'<h3>Enregistrements gardés dans la tablette</h3>'+S.map(s=>`<div class="ls" data-rs="${s.sess}"><span class="nm">Soirée du ${new Date(s.debut).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}<small>${dureeTxt(s.fin-s.debut)} · ${moTxt(s.taille)} · .${s.ext}</small></span>
    <button data-ra="dl" class="fort">💾 Télécharger</button><button data-ra="sup" class="sup">✕</button></div>`).join(''):'';
}

/* ---------- 3. SAUVEGARDE / RESTAURATION ---------- */
const MAGIE='BDSAUV1\n';
async function sauvegarder(complet){
  const el=$('svP');el.hidden=false;el.className='info';el.textContent='💾 Préparation de la sauvegarde…';
  const sons=[],parts=[];let off=0;
  for(const s of SONS){const e={id:s.id,nom:s.nom,taille:s.taille,ajout:s.ajout,meta:s.meta,type:(s.blob&&s.blob.type)||'audio/mpeg'};
    if(complet&&s.blob){e.off=off;e.len=s.blob.size;parts.push(s.blob);off+=s.blob.size}sons.push(e)}
  const ls={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^bd/.test(k)&&k!='bd6_sauv')ls[k]=localStorage.getItem(k)}
  const h=new TextEncoder().encode(JSON.stringify({app:'BeatDeck',v:1,version:VERSION,date:Date.now(),complet,sons,ls}));
  const blob=new Blob([MAGIE,String(h.length).padStart(12,'0'),h,...parts],{type:'application/octet-stream'});
  telecharger(blob,'BeatDeck-sauvegarde-'+(complet?'complete':'legere')+'-'+nomFichierDate(Date.now())+'.beatdeck');
  LS.set('bd6_sauv',Date.now());majSauv();
  el.className='info ok';el.textContent='💾 Sauvegarde '+(complet?'complète':'légère')+' créée ('+moTxt(blob.size)+') : elle est dans tes Téléchargements. Garde-la aussi ailleurs (Google Drive, clé USB, ordinateur).';
}
async function restaurer(f){
  const el=$('svP');el.hidden=false;el.className='info';el.textContent='📂 Lecture de la sauvegarde…';
  let H,base;
  try{if(await f.slice(0,8).text()!=MAGIE)throw 0;const n=+(await f.slice(8,20).text());H=JSON.parse(await f.slice(20,20+n).text());base=20+n;if(H.app!='BeatDeck')throw 0}
  catch(e){el.className='info err';el.textContent='📂 Ce fichier n\'est pas une sauvegarde BeatDeck (fichier qui finit par .beatdeck).';return}
  const avecSons=H.sons.filter(s=>s.len!=null).length;
  if(!confirm('Restaurer la sauvegarde du '+new Date(H.date).toLocaleString('fr-FR')+' ?\n\n• '+(avecSons?avecSons+' musique(s) à remettre (celles déjà présentes sont gardées)':'sauvegarde légère : pas de musiques dedans')+'\n• tes duos et transitions sont ajoutés\n• tes raccourcis, ta platine et tes réglages sont remplacés par ceux de la sauvegarde\n\nL\'appli redémarrera à la fin.'))
    {el.hidden=true;return}
  let aj=0,k=0;
  for(const e of H.sons){k++;if(e.len==null||sonDe(e.id))continue;
    el.textContent='📂 Remise des musiques… '+k+' / '+H.sons.length;
    const s={id:e.id,nom:e.nom,taille:e.taille,ajout:e.ajout,meta:e.meta,blob:f.slice(base+e.off,base+e.off+e.len,e.type)};
    try{await BASE.mettre(s);SONS.push(s);aj++}catch(x){console.error(x);el.className='info err';el.textContent='📂 Mémoire de la tablette pleine : '+aj+' musiques remises, pas les autres.';break}}
  // duos : ceux de la sauvegarde + les tiens qui n'y sont pas
  const B=(()=>{try{return JSON.parse(H.ls.bd6_duos||'[]')}catch(e){return[]}})(),M=B.slice();
  for(const d of DUOS)if(!M.some(x=>x.id==d.id||x.a==d.a))M.push(d);
  for(const[key,v]of Object.entries(H.ls||{}))if(key!='bd6_duos')try{localStorage.setItem(key,v)}catch(e){}
  LS.set('bd6_duos',M);
  const manque=H.sons.filter(e=>e.len==null&&!sonDe(e.id)).length;
  el.className='info ok';el.textContent='📂 Restauration terminée : '+aj+' musique(s) remise(s), '+B.length+' duo(s).'+(manque?' Remets les '+manque+' musique(s) manquante(s) avec « Ajouter des musiques » (les mêmes fichiers) : leurs duos reviendront tout seuls.':'')+' Redémarrage…';
  setTimeout(()=>location.reload(),manque?6000:2500);
}
function majSauv(){
  const e=$('svE');if(!e)return;const t=LS.get('bd6_sauv',0);
  if(!t){e.textContent='Jamais sauvegardé';e.className='mu alerte';return}
  const j=Math.floor((Date.now()-t)/864e5);e.textContent='Dernière sauvegarde : '+(j<1?'aujourd\'hui':j==1?'hier':'il y a '+j+' jours');e.className='mu'+(j>14?' alerte':'');
}

/* ---------- télécommande : la file d'attente sur le téléphone ---------- */
function telEnvoyerFile(c){
  if(typeof TEL=='undefined'||!TEL.conns.size)return;
  const m={t:'file',L:fileValide().map(id=>{const s=sonDe(id);return{id,nom:s.nom,info:infoSon(s)}})};
  if(c)envoyer(c,m);else tous(m);
}

function initOptions(){
  // file
  $('lFile').onclick=e=>{const b=e.target.closest('[data-fa]'),r=e.target.closest('[data-fid]');if(!b||!r)return;
    if(b.dataset.fa=='sup')retirerFile(r.dataset.fid);else if(b.dataset.fa=='haut')monterFile(r.dataset.fid)};
  $('fileVide').onclick=()=>{if(confirm('Vider la file d\'attente ?')){FILE=[];sauverFile()}};
  rendreFile();
  // enregistrement
  $('bRec').onclick=()=>{$('recp').hidden=false;rendreRec()};
  $('recOn').onclick=()=>{if(REC.mr)recArreter();else recDemarrer()};
  $('recL').onclick=e=>{const b=e.target.closest('[data-ra]'),r=e.target.closest('[data-rs]');if(!b||!r)return;
    if(b.dataset.ra=='dl')recTelecharger(r.dataset.rs);else recSupprimer(r.dataset.rs)};
  if(!recType())$('recType').textContent='⚠ Ce navigateur ne sait pas enregistrer : mets Chrome à jour.';
  else $('recType').textContent='Format du fichier : .'+recType().e+(/mp4a/.test(recType().t)?' (lisible partout : téléphone, ordinateur, WhatsApp)':' (lisible avec Chrome, VLC, la plupart des téléphones ; pour WhatsApp, le convertir en MP3 si besoin)');
  recSessions().then(S=>{if(S.length)$('bRec').classList.add('garde')});
  addEventListener('beforeunload',e=>{if(REC.mr){e.preventDefault();e.returnValue=''}});
  // sauvegarde
  $('svC').onclick=()=>sauvegarder(true);$('svL').onclick=()=>sauvegarder(false);
  $('svR').onclick=()=>{const i=document.createElement('input');i.type='file';i.onchange=()=>{if(i.files[0])restaurer(i.files[0])};i.click()};
  majSauv();
  setTimeout(()=>{const t=LS.get('bd6_sauv',0);if(SONS.length>=10&&Date.now()-t>14*864e5)toast('💾 Pense à sauvegarder ta bibliothèque : Bibliothèque → Mes sons → Sauvegarder')},8000);
}
