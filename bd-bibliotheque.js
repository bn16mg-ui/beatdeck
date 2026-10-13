'use strict';
/* ===== BeatDeck 6 · bibliothèque : « Mes sons » et « Mes duos » =====
   Tes musiques sont copiées DANS l'appli (mémoire du navigateur de la tablette) :
   plus besoin de les rechoisir à chaque lancement. Rien n'est envoyé sur Internet.
   Chaque morceau est analysé une seule fois : tempo, tonalité, énergie, durée. */

/* ---------- stockage (IndexedDB) ---------- */
const BASE=(()=>{let p=null;
  const ouvrir=()=>p||(p=new Promise((ok,no)=>{const r=indexedDB.open('beatdeck6',1);
    r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('sons'))db.createObjectStore('sons',{keyPath:'id'})};
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
  const tx=async(mode,f)=>{const db=await ouvrir();return new Promise((ok,no)=>{const t=db.transaction('sons',mode),r=f(t.objectStore('sons'));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})};
  return{tous:()=>tx('readonly',s=>s.getAll()),mettre:v=>tx('readwrite',s=>s.put(v)),enlever:id=>tx('readwrite',s=>s.delete(id))};
})();

let SONS=[];                                  // {id, nom, taille, ajout, blob, meta}
let DUOS=LS.get('bd6_duos',[]);               // {id, a, b, cree}
const sonDe=id=>SONS.find(s=>s.id==id)||null;
const nomPropre=n=>n.replace(/\.[^.]+$/,'').replace(/_/g,' ').trim();
const camelot=k=>k?k.n+(k.b?'B':'A'):'?';
const sauverDuos=()=>LS.set('bd6_duos',DUOS);

/* ---------- ajout de musiques ---------- */
const AUDIO=/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|mp4)$/i;
async function ajouterFichiers(liste){
  const fs=[...liste].filter(f=>AUDIO.test(f.name)||/^audio\//.test(f.type));
  if(!fs.length){toast('Aucune musique trouvée dans ce choix');return}
  try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist()}catch(e){}
  let n=0;
  for(const f of fs){const id=f.name+'|'+f.size;if(sonDe(id))continue;
    const s={id,nom:nomPropre(f.name),taille:f.size,ajout:Date.now(),blob:f,meta:null};
    try{await BASE.mettre(s);SONS.push(s);n++}catch(e){console.error(e);toast('Mémoire pleine : '+n+' musiques ajoutées, les autres non');break}}
  toast(n?n+' musique'+(n>1?'s':'')+' ajoutée'+(n>1?'s':'')+' : analyse en cours…':'Ces musiques sont déjà dans ta bibliothèque');
  rendreSons();analyserTout();
}
function choisirMusiques(dossier){
  const inp=document.createElement('input');inp.type='file';inp.multiple=true;
  if(dossier)inp.webkitdirectory=true;else inp.accept='audio/*';
  inp.onchange=()=>ajouterFichiers(inp.files);inp.click();
}
async function supprimerSon(id){
  const s=sonDe(id);if(!s)return;
  const nd=DUOS.filter(d=>d.a==id||d.b==id).length;
  if(!confirm('Retirer « '+s.nom+' » de ta bibliothèque ?'+(nd?' ('+nd+' duo'+(nd>1?'s':'')+' seront aussi supprimés)':'')))return;
  await BASE.enlever(id);SONS=SONS.filter(x=>x!==s);DUOS=DUOS.filter(d=>d.a!=id&&d.b!=id);sauverDuos();rendreSons();rendreDuos();
}

/* ---------- analyse (une seule fois par morceau, en arrière-plan) ---------- */
let ANA={en:false,fait:0,total:0};
async function analyserTout(){
  if(ANA.en)return;ANA.en=true;
  const a=SONS.filter(s=>!s.meta);ANA.fait=0;ANA.total=a.length;
  for(const s of a){
    etatBib();
    try{const buf=await AC.decodeAudioData(await s.blob.arrayBuffer());s.meta=analyseSon(buf)}catch(e){console.error(e);s.meta={v:1,erreur:true}}
    try{await BASE.mettre(s)}catch(e){}
    ANA.fait++;rendreSons();rendreDuos();await sleep(30);
  }
  ANA.en=false;etatBib();
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ---------- charger un morceau de la bibliothèque sur un deck ---------- */
async function chargerSon(i,id){
  const s=sonDe(id);if(!s)return false;
  if(!D[i].a.paused){toast('Le deck '+(i+1)+' joue : mets-le en pause avant de charger');return false}
  const f=s.blob instanceof File?s.blob:new File([s.blob],s.nom+'.mp3',{type:s.blob.type});
  const ok=await chargerDeck(i,f,{id:s.id,meta:s.meta&&!s.meta.erreur?s.meta:null});
  if(ok)D[i].nom=s.nom;return ok;
}
// deck libre pour charger : celui qui ne joue pas (de préférence vide ou déjà joué)
function deckLibre(){const L=D.filter(d=>d.a.paused);if(!L.length)return -1;const v=L.find(d=>!d.a.src||d.joue);return(v||L[0]).i}

/* ---------- duos : le 2e morceau se charge tout seul ---------- */
const duoDe=id=>DUOS.find(d=>d.a==id)||null;
function apresChargement(i){proposerDuo(i)}
function proposerDuo(i){
  const d=D[i],o=D[1-i];if(!d.sonId)return;const du=duoDe(d.sonId);if(!du)return;
  if(o.sonId==du.b)return;                                   // déjà en place
  if(!o.a.paused){d.duoAttente=du.b;return}                  // l'autre deck joue : on attendra qu'il soit libre
  if(o.a.src&&!o.joue&&o.sonId){d.duoAttente=du.b;return}    // tu viens d'y charger autre chose : on ne l'écrase pas
  d.duoAttente=null;const b=sonDe(du.b);if(!b)return;
  chargerSon(o.i,b.id).then(ok=>{if(ok)toast('♥ Duo : « '+b.nom+' » est prêt sur le deck '+(o.i+1))});
}
// si le 2e morceau attendait (l'autre deck jouait encore), on le charge dès que ce deck est libre
setInterval(()=>{D.forEach((d,i)=>{const o=D[1-i];if(d.duoAttente&&o.a.paused&&!o.chargement&&(!o.a.src||o.joue))proposerDuo(i)})},1000);

/* ---------- compatibilité d'un duo (estimation à partir de l'analyse) ---------- */
function avisDuo(a,b){
  const A=a&&a.meta,B=b&&b.meta;if(!A||!B||!A.bpm||!B.bpm)return null;
  const r=foldR(A.bpm,B.bpm),ecart=Math.abs(r-1)*100,av=[];
  let tempo,conseil;
  if(ecart<=3){tempo='Tempos très proches ('+nf(ecart,1)+' %)';conseil='Mix long ou échange des basses'}
  else if(ecart<=8){tempo='Tempos proches ('+nf(ecart,1)+' %) : le 2e sera un peu accéléré ou ralenti';conseil='Échange des basses ou filtre de sortie'}
  else{tempo='Tempos éloignés ('+nf(ecart,1)+' %)';conseil='Écho Out ou coupure nette (pas de long mélange)'}
  av.push(tempo);
  let ton='Tonalités inconnues';
  if(A.key&&B.key){const d=Math.min((A.key.n-B.key.n+12)%12,(B.key.n-A.key.n+12)%12),meme=A.key.b==B.key.b;
    const ok=(d==0)||(d==1&&meme);ton='Tonalités '+camelot(A.key)+' → '+camelot(B.key)+' : '+(d==0&&meme?'identiques':ok?'compatibles':'risquent de se heurter sur un long mélange');
    if(!ok&&ecart<=8)conseil='Échange des basses court ou filtre de sortie (pas de long mélange à cause des tonalités)';if(Math.min(A.key.c,B.key.c)<.3)ton+=' (estimation peu sûre)'}
  av.push(ton);
  const ea=A.en,eb=B.en;if(ea&&eb)av.push(eb>ea*1.2?'Le 2e est plus énergique : ça fait monter l\'ambiance':eb<ea*.8?'Le 2e est plus calme : ça fait redescendre l\'ambiance':'Énergie proche');
  return{av,conseil};
}

/* ---------- affichage ---------- */
const BIB={onglet:'sons',q:'',sel:null,creation:null};
function ouvrirBib(onglet){if(onglet)BIB.onglet=onglet;$('bib').hidden=false;rendreOnglets();rendreSons();rendreDuos();etatBib()}
function fermerBib(){$('bib').hidden=true;if(BIB.creation){BIB.creation=null;rendreDuos()}}
function rendreOnglets(){QA('#bibTabs button').forEach(b=>b.classList.toggle('on',b.dataset.o==BIB.onglet));$('bSons').hidden=BIB.onglet!='sons';$('bDuos').hidden=BIB.onglet!='duos';
  $('tS').textContent=SONS.length;$('tD').textContent=DUOS.length}
function etatBib(){const e=$('bibE');if(!e)return;let t=SONS.length+' musique'+(SONS.length>1?'s':'');if(ANA.en)t+=' · analyse '+(ANA.fait+1)+' sur '+ANA.total+'…';e.textContent=t;
  if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(s=>{if(s.usage!=null&&!ANA.en)e.textContent=t+' · '+Math.round(s.usage/1048576)+' Mo utilisés'}).catch(()=>{})}
const infoSon=s=>{const m=s.meta;if(!m)return'analyse en attente…';if(m.erreur)return'fichier illisible';return(m.bpm?nf(m.bpm,0)+' BPM':'tempo ?')+' · '+camelot(m.key)+' · '+fmt(m.dur)};
const enDuo=id=>DUOS.some(d=>d.a==id||d.b==id);
function listeFiltree(){const q=BIB.q.toLowerCase();return SONS.filter(s=>s.nom.toLowerCase().includes(q)).sort((a,b)=>a.nom.localeCompare(b.nom))}
function rendreSons(){
  const el=$('lSons');if(!el)return;rendreOnglets();const L=listeFiltree();
  el.innerHTML=L.map(s=>`<div class="ls${s.id==BIB.sel?' sel':''}" data-id="${esc(s.id)}"><span class="nm">${enDuo(s.id)?'<i class="coeur">♥</i>':''}${esc(s.nom)}<small>${esc(infoSon(s))}</small></span>
    <button class="d0" data-ch="0">1</button><button class="d1" data-ch="1">2</button><button class="sup" data-sup="1" title="Retirer de la bibliothèque">✕</button></div>`).join('')
    ||`<p class="vide">${SONS.length?'Aucune musique avec ce nom.':'Ta bibliothèque est vide. Touche « Ajouter des musiques » et choisis les musiques de ta tablette (tu peux en sélectionner plusieurs d\'un coup).'}</p>`;
}
function rendreDuos(){
  const el=$('lDuos');if(!el)return;rendreOnglets();const C=BIB.creation;
  $('duoNv').textContent=C?'Annuler':'＋ Créer un duo';
  if(C){
    const q=(C.q||'').toLowerCase(),L=SONS.filter(s=>s.nom.toLowerCase().includes(q)&&s.id!=C.a).sort((a,b)=>a.nom.localeCompare(b.nom));
    el.innerHTML=`<p class="info"><b>${C.a?'2. Choisis le morceau qui vient APRÈS « '+esc(sonDe(C.a).nom)+' »':'1. Choisis le PREMIER morceau du duo'}</b></p>
      <input class="inp" id="duoQ" placeholder="Rechercher…" value="${esc(C.q||'')}">
      ${L.map(s=>`<button class="pick" data-pk="${esc(s.id)}">${esc(s.nom)}<small>${esc(infoSon(s))}</small></button>`).join('')||'<p class="vide">Ajoute d\'abord des musiques dans « Mes sons ».</p>'}`;
    const q2=$('duoQ');q2.oninput=()=>{C.q=q2.value;const p=q2.selectionStart;rendreDuos();const n=$('duoQ');n.focus();n.setSelectionRange(p,p)};return;
  }
  el.innerHTML=DUOS.slice().reverse().map(d=>{const a=sonDe(d.a),b=sonDe(d.b);if(!a||!b)return'';const av=avisDuo(a,b);
    return`<div class="duo" data-du="${d.id}"><div class="dt"><span class="d0">${esc(a.nom)}</span><i>→</i><span class="d1">${esc(b.nom)}</span></div>
      <div class="dm"><small>${esc(infoSon(a))}</small><small>${esc(infoSon(b))}</small></div>
      ${av?`<ul>${av.av.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul><p class="cons">Transition conseillée : <b>${esc(av.conseil)}</b> <span class="mu">(estimation d'après l'analyse)</span></p>`:'<p class="mu">Analyse en cours…</p>'}
      <div class="row"><button data-act="charge" class="fort">Charger : 1er sur le deck 1, 2e sur le deck 2</button><button data-act="inv">⇄ Inverser l'ordre</button><button data-act="sup">✕ Supprimer</button></div></div>`}).join('')
    ||'<p class="vide">Aucun duo pour l\'instant. Touche « ＋ Créer un duo », puis choisis le 1er morceau et celui qui vient après. Quand tu chargeras le 1er sur un deck, le 2e se chargera tout seul sur l\'autre.</p>';
}

/* ---------- PARCOURIR, CHARGER 1 / 2 sur la platine ---------- */
function parcourir(dl){
  if($('bib').hidden)ouvrirBib('sons');if(BIB.onglet!='sons'){BIB.onglet='sons';rendreOnglets()}
  const L=listeFiltree();if(!L.length)return;let k=L.findIndex(s=>s.id==BIB.sel);k=k<0?0:clamp(k+Math.sign(dl),0,L.length-1);
  BIB.sel=L[k].id;rendreSons();const r=Q('#lSons .ls.sel');if(r)r.scrollIntoView({block:'nearest'});
}
function chargerSelection(i){
  if(!BIB.sel||$('bib').hidden){ouvrirBib('sons');toast('Choisis une musique (tourne PARCOURIR ou touche son nom), puis CHARGER 1 ou 2');return}
  if(i==null)i=deckLibre();if(i<0){toast('Les deux decks jouent');return}
  chargerSon(i,BIB.sel).then(ok=>{if(ok){toast('Deck '+(i+1)+' : '+sonDe(BIB.sel).nom);fermerBib()}});
}
FN.brw={base:{nom:'PARCOURIR',desc:'Tourne pour te déplacer dans ta bibliothèque, appuie pour charger la musique choisie sur le deck libre.',delta:parcourir},normal:true};
FN.brwp={base:{nom:'PARCOURIR',desc:'Charge la musique choisie sur le deck libre.',press:()=>chargerSelection(null)},normal:true};
FN.ld1={base:{nom:'CHARGER 1',desc:'Charge sur le deck 1 la musique choisie dans la bibliothèque (ou ouvre la bibliothèque).',press:()=>chargerSelection(0)},normal:true};
FN.ld2={base:{nom:'CHARGER 2',desc:'Charge sur le deck 2 la musique choisie dans la bibliothèque (ou ouvre la bibliothèque).',press:()=>chargerSelection(1)},normal:true};

/* ---------- démarrage ---------- */
async function initBib(){
  $('bBib').onclick=()=>$('bib').hidden?ouvrirBib():fermerBib();
  $('bibX').onclick=fermerBib;
  $('bib').addEventListener('pointerdown',e=>{if(e.target.id=='bib')fermerBib()});
  $('bibTabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;BIB.onglet=b.dataset.o;rendreOnglets()};
  $('ajF').onclick=()=>choisirMusiques(false);$('ajD').onclick=()=>choisirMusiques(true);
  $('bibQ').oninput=e=>{BIB.q=e.target.value;rendreSons()};
  $('lSons').onclick=e=>{const r=e.target.closest('.ls');if(!r)return;const id=r.dataset.id,b=e.target.closest('button');
    if(b&&b.dataset.sup){supprimerSon(id);return}
    if(b&&b.dataset.ch){chargerSon(+b.dataset.ch,id).then(ok=>{if(ok){toast('Deck '+(+b.dataset.ch+1)+' : '+sonDe(id).nom);fermerBib()}});return}
    BIB.sel=id;rendreSons()};
  $('duoNv').onclick=()=>{BIB.creation=BIB.creation?null:{a:null,q:''};rendreDuos()};
  $('lDuos').onclick=e=>{
    const pk=e.target.closest('[data-pk]');
    if(pk&&BIB.creation){const C=BIB.creation;if(!C.a){C.a=pk.dataset.pk;C.q='';rendreDuos();return}
      const ex=DUOS.find(d=>d.a==C.a&&d.b==pk.dataset.pk);
      if(!ex){if(DUOS.some(d=>d.a==C.a)&&!confirm('« '+sonDe(C.a).nom+' » a déjà un duo. Le remplacer par celui-ci ?')){return}
        DUOS=DUOS.filter(d=>d.a!=C.a);DUOS.push({id:'d'+Date.now().toString(36),a:C.a,b:pk.dataset.pk,cree:Date.now()});sauverDuos();toast('♥ Duo enregistré')}
      BIB.creation=null;rendreDuos();rendreSons();return}
    const b=e.target.closest('[data-act]'),c=e.target.closest('[data-du]');if(!b||!c)return;const d=DUOS.find(x=>x.id==c.dataset.du);if(!d)return;
    if(b.dataset.act=='sup'){if(confirm('Supprimer ce duo ?')){DUOS=DUOS.filter(x=>x!==d);sauverDuos();rendreDuos();rendreSons()}}
    else if(b.dataset.act=='inv'){if(DUOS.some(x=>x!==d&&x.a==d.b)){toast('« '+sonDe(d.b).nom+' » a déjà son propre duo');return}[d.a,d.b]=[d.b,d.a];sauverDuos();rendreDuos()}
    else if(b.dataset.act=='charge'){if(D.some(x=>!x.a.paused)){toast('Mets les deux decks en pause d\'abord');return}
      chargerSon(0,d.a).then(()=>chargerSon(1,d.b)).then(()=>{toast('Duo chargé');fermerBib()})}
  };
  try{SONS=await BASE.tous()||[]}catch(e){console.error(e);SONS=[]}
  rendreSons();rendreDuos();etatBib();if(SONS.some(s=>!s.meta))analyserTout();
}
