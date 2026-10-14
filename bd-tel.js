'use strict';
/* ===== BeatDeck 6 · télécommande (côté téléphone) =====
   Envoie des ordres à la tablette : musique sur le deck 1 / 2, demande à passer ensuite, duo, lecture / pause. */
const $=id=>document.getElementById(id);
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>isFinite(s)&&s>=0?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
const LSg=(k,f)=>{try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(e){return f}},LSs=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
let tT;function toast(m,ok){const t=$('toast');t.textContent=m;t.className='on '+(ok===false?'err':ok?'ok':'');clearTimeout(tT);tT=setTimeout(()=>t.className='',3000)}

const T={peer:null,conn:null,code:'',file:[],bib:{sons:[],duos:[]},onglet:'sons',q:'',essai:null,voulu:false};
function etat(t,ok){$('etat').textContent=t;$('etat').classList.toggle('ok',!!ok)}

function connecter(code){
  code=(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!=6){$('coMsg').textContent='Le code fait 6 caractères';return}
  T.code=code;T.voulu=true;LSs('bd6_tel_code',code);$('coMsg').textContent='Connexion…';etat('Connexion…');
  if(typeof Peer=='undefined'){$('coMsg').textContent='Outil de connexion non chargé : vérifie internet puis recharge la page';return}
  if(!T.peer||T.peer.destroyed){T.peer=new Peer();T.peer.on('error',e=>{
    if(e.type=='peer-unavailable'){$('coMsg').textContent='Tablette introuvable : vérifie le code et que la télécommande est activée sur la tablette';etat('Tablette introuvable')}
    else{$('coMsg').textContent='Problème de connexion ('+e.type+')';etat('Hors ligne')}
    rejouer()});T.peer.on('open',()=>ouvrir());T.peer.on('disconnected',()=>{try{T.peer.reconnect()}catch(e){}})}
  else if(T.peer.open)ouvrir();
}
function ouvrir(){
  if(T.conn){try{T.conn.close()}catch(e){}}
  const c=T.peer.connect('beatdeck-'+T.code.toLowerCase(),{reliable:true});T.conn=c;
  c.on('open',()=>{etat('Connectée',true);$('ecCo').hidden=true;$('ecApp').hidden=false;c.send({t:'coucou'})});
  c.on('data',recu);
  c.on('close',()=>{etat('Déconnectée');toast('Tablette déconnectée : nouvelle tentative…',false);rejouer()});
}
function rejouer(){clearTimeout(T.essai);if(T.voulu)T.essai=setTimeout(()=>{if(!T.conn||!T.conn.open)connecter(T.code)},4000)}
const envoyer=m=>{if(T.conn&&T.conn.open)T.conn.send(m);else toast('Pas connectée à la tablette',false)};

function recu(m){
  if(!m||typeof m!='object')return;
  if(m.t=='bib'){T.bib=m;rendre()}
  else if(m.t=='file'){T.file=m.L||[];rendre()}
  else if(m.t=='decks'){m.decks.forEach((d,i)=>{const el=$('dk'+i);el.querySelector('.nm').textContent=d.nom||'Aucune musique';
    el.querySelector('.inf').textContent=d.chargement?'chargement…':d.charge?(d.joue?'▶ ':'⏸ ')+'-'+fmt(d.reste)+(d.bpm?' · '+d.bpm+' BPM':''):'';
    el.querySelector('button').textContent=d.joue?'⏸':'▶';el.classList.toggle('joue',d.joue)})}
  else if(m.t=='msg')toast(m.txt,m.ok);
}
function rendre(){
  QA('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.o==T.onglet));$('nF').textContent=T.file.length||'';$('q').hidden=T.onglet=='file';
  const q=T.q.toLowerCase(),el=$('liste');
  if(T.onglet=='sons'){const L=T.bib.sons.filter(s=>s.nom.toLowerCase().includes(q));
    el.innerHTML=L.map(s=>`<div class="ligne" data-id="${esc(s.id)}"><div class="t"><div>${s.duo?'<span class="coeur">♥</span>':''}${esc(s.nom)}</div><small>${esc(s.info)}</small></div>
      <button class="b0" data-a="deck" data-d="0">1</button><button class="b1" data-a="deck" data-d="1">2</button><button class="ens" data-a="ensuite">Ensuite</button><button class="fi" data-a="file" title="Ajouter à la file d'attente">＋📋</button></div>`).join('')
      ||`<p class="vide">${T.bib.sons.length?'Aucune musique avec ce nom.':'Aucune musique dans la bibliothèque de la tablette.'}</p>`}
  else if(T.onglet=='file'){
    el.innerHTML=T.file.map((s,k)=>`<div class="ligne" data-id="${esc(s.id)}"><b class="num">${k+1}</b><div class="t"><div>${esc(s.nom)}</div><small>${esc(s.info)}</small></div>${k?'<button data-a="fileHaut">↑</button>':''}<button data-a="fileSup">✕</button></div>`).join('')
      ||'<p class="vide">La file d\'attente est vide. Dans « Sons », touche ＋📋 pour ajouter une demande.</p>'}
  else{const L=T.bib.duos.filter(d=>(d.a+' '+d.b).toLowerCase().includes(q));
    el.innerHTML=L.map(d=>`<div class="ligne duo" data-id="${esc(d.id)}"><div class="t"><div>${esc(d.a)} <span>→</span> ${esc(d.b)}</div><small>${d.trans?'Transition : '+esc(d.trans):'Transition pas encore validée'}</small></div><button class="ens" data-a="duo">Lancer ensuite</button></div>`).join('')
      ||'<p class="vide">Aucun duo : crée-les sur la tablette (Bibliothèque → Mes duos).</p>'}
}
const QA=(s,r=document)=>[...r.querySelectorAll(s)];

$('go').onclick=()=>connecter($('code').value);
$('code').addEventListener('keydown',e=>{if(e.key=='Enter')connecter($('code').value)});
document.querySelector('.tabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;T.onglet=b.dataset.o;rendre()};
$('q').oninput=e=>{T.q=e.target.value;rendre()};
$('liste').onclick=e=>{const b=e.target.closest('[data-a]'),l=e.target.closest('[data-id]');if(!b||!l)return;const id=l.dataset.id;
  if(b.dataset.a=='deck')envoyer({t:'deck',id,deck:+b.dataset.d});else if(b.dataset.a=='ensuite')envoyer({t:'ensuite',id});else if(b.dataset.a=='duo')envoyer({t:'duo',id});
  else if(b.dataset.a=='file')envoyer({t:'file',id});else if(b.dataset.a=='fileSup')envoyer({t:'fileSup',id});else if(b.dataset.a=='fileHaut')envoyer({t:'fileHaut',id})};
$('suiv').onclick=()=>envoyer({t:'passer'});
QA('[data-lec]').forEach(b=>b.onclick=()=>envoyer({t:'lecture',deck:+b.dataset.lec}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible'&&T.voulu&&(!T.conn||!T.conn.open))connecter(T.code)});

// code dans le lien (QR code) ou dernier code utilisé
const h=(location.hash||'').replace('#','')||LSg('bd6_tel_code','');
if(h){$('code').value=h.toUpperCase();connecter(h)}
