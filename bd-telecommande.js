'use strict';
/* ===== BeatDeck 6 · télécommande depuis le téléphone (côté tablette) =====
   La tablette garde les musiques et joue le son. Le téléphone envoie seulement des ordres :
   mettre une musique sur le deck 1 ou 2, faire passer une demande ensuite, lancer un duo, lecture / pause.
   Les deux appareils se trouvent par internet grâce à PeerJS (gratuit, sans compte), puis se parlent directement.
   Un code de 6 lettres relie TON téléphone à TA tablette. */
const TEL={peer:null,conns:new Set(),code:LS.get('bd6_telcode',null),on:LS.get('bd6_tel',false),etat:'Désactivée',essai:null};
function telCode(){if(!TEL.code){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';TEL.code=[...Array(6)].map(()=>A[Math.floor(Math.random()*A.length)]).join('');LS.set('bd6_telcode',TEL.code)}return TEL.code}
const lienTel=()=>location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'')+'telecommande.html#'+telCode();
function telEtat(t){TEL.etat=t;telMaj()}
function telDemarrer(){
  clearTimeout(TEL.essai);
  if(typeof Peer=='undefined'){telEtat('Outil de connexion non chargé : vérifie internet puis relance l\'appli');return}
  if(TEL.peer){try{TEL.peer.destroy()}catch(e){}}
  telEtat('Connexion à internet…');
  const p=new Peer('beatdeck-'+telCode().toLowerCase());TEL.peer=p;
  p.on('open',()=>telEtat(TEL.conns.size?'Téléphone connecté':'Prête : en attente du téléphone'));
  p.on('connection',c=>{
    c.on('open',()=>{TEL.conns.add(c);telEnvoyerBib(c);telEnvoyerDecks();telEtat('Téléphone connecté');toast('📱 Téléphone connecté')});
    c.on('data',m=>telRecu(c,m));
    c.on('close',()=>{TEL.conns.delete(c);telEtat(TEL.conns.size?'Téléphone connecté':'Prête : en attente du téléphone')});
    c.on('error',()=>{});
  });
  p.on('disconnected',()=>{if(TEL.on&&TEL.peer===p)TEL.essai=setTimeout(()=>{try{p.reconnect()}catch(e){telDemarrer()}},3000)});
  p.on('error',e=>{
    if(e.type=='unavailable-id'){telEtat('Ce code est déjà utilisé (l\'appli est ouverte ailleurs ?) : nouvel essai dans 10 s');TEL.essai=setTimeout(telDemarrer,10000)}
    else if(['network','server-error','socket-error','socket-closed'].includes(e.type)){telEtat('Pas d\'internet : nouvel essai dans 5 s');TEL.essai=setTimeout(()=>{if(TEL.on)telDemarrer()},5000)}
    else if(e.type!='peer-unavailable')telEtat('Problème de connexion ('+e.type+')');
  });
}
function telArreter(){clearTimeout(TEL.essai);TEL.conns.forEach(c=>{try{c.close()}catch(e){}});TEL.conns.clear();if(TEL.peer){try{TEL.peer.destroy()}catch(e){}}TEL.peer=null;telEtat('Désactivée')}
function setTel(on){TEL.on=on;LS.set('bd6_tel',on);if(on)telDemarrer();else telArreter();telMaj()}

/* --- ce que la tablette envoie au téléphone --- */
const envoyer=(c,m)=>{try{if(c.open)c.send(m)}catch(e){}};
const tous=m=>TEL.conns.forEach(c=>envoyer(c,m));
function telEnvoyerBib(c){
  const m={t:'bib',sons:SONS.map(s=>({id:s.id,nom:s.nom,info:infoSon(s),duo:enDuo(s.id)})).sort((a,b)=>a.nom.localeCompare(b.nom)),
    duos:DUOS.map(d=>({id:d.id,a:(sonDe(d.a)||{}).nom||'?',b:(sonDe(d.b)||{}).nom||'?',trans:d.trans?NOMT[d.trans.tech]:null}))};
  if(c)envoyer(c,m);else tous(m);
}
function telEnvoyerDecks(){
  if(!TEL.conns.size)return;
  tous({t:'decks',auto:!!AUTO.on,decks:D.map(d=>({nom:d.nom||'',joue:!d.a.paused,charge:!!d.a.src,chargement:!!d.chargement,
    reste:d.a.duration?Math.max(0,d.a.duration-posOf(d)):0,bpm:d.bpm?+(d.bpm*rateOf(d)).toFixed(1):0}))});
}
setInterval(telEnvoyerDecks,1000);
let telBibSig='';setInterval(()=>{if(!TEL.conns.size)return;const s=SONS.length+'|'+DUOS.length+'|'+SONS.filter(x=>x.meta).length+'|'+DUOS.filter(d=>d.trans).length;if(s!=telBibSig){telBibSig=s;telEnvoyerBib()}},2000);

/* --- ce que le téléphone demande --- */
async function telRecu(c,m){
  if(!m||typeof m!='object')return;
  const rep=(txt,ok=true)=>envoyer(c,{t:'msg',txt,ok});
  try{
    if(m.t=='deck'){const i=+m.deck,s=sonDe(m.id);if(!s||(i!==0&&i!==1))return;
      if(!D[i].a.paused){rep('Le deck '+(i+1)+' joue : impossible de le remplacer maintenant',false);return}
      const ok=await chargerSon(i,s.id);rep(ok?'« '+s.nom+' » est sur le deck '+(i+1):'Chargement impossible',ok)}
    else if(m.t=='ensuite'){const s=sonDe(m.id);if(!s)return;const i=deckLibre();
      if(i<0){rep('Les deux decks jouent : réessaie après la prochaine transition',false);return}
      const ok=await chargerSon(i,s.id);rep(ok?'« '+s.nom+' » est prête sur le deck '+(i+1)+' : elle passera ensuite':'Chargement impossible',ok);if(ok)toast('📱 Demande : « '+s.nom+' » sur le deck '+(i+1))}
    else if(m.t=='duo'){const d=DUOS.find(x=>x.id==m.id);if(!d)return;const i=deckLibre();
      if(i<0){rep('Les deux decks jouent : réessaie après la prochaine transition',false);return}
      const ok=await chargerSon(i,d.a);rep(ok?'Duo prêt : « '+sonDe(d.a).nom+' » sur le deck '+(i+1)+', le 2e suivra tout seul':'Chargement impossible',ok)}
    else if(m.t=='lecture'){const i=+m.deck;if(i!==0&&i!==1)return;if(!D[i].a.src){rep('Aucune musique sur le deck '+(i+1),false);return}
      if(typeof occupe=='function'&&occupe()){rep('Une transition est en cours : attends la fin',false);return}
      commande('play'+i,{t:'press'});commande('play'+i,{t:'release'})}
    else if(m.t=='coucou'){telEnvoyerBib(c);telEnvoyerDecks()}
  }catch(e){console.error(e);rep('Action impossible',false)}
}

/* --- panneau sur la tablette --- */
function telMaj(){
  const b=$('bTel');if(b)b.classList.toggle('on',TEL.conns.size>0);
  if(!$('telp')||$('telp').hidden)return;
  $('telE').textContent=TEL.etat;$('telE').className='info'+(TEL.conns.size?' ok':'');
  $('telOn').textContent=TEL.on?'Désactiver la télécommande':'Activer la télécommande';$('telOn').classList.toggle('fort',!TEL.on);
  $('telZ').hidden=!TEL.on;
  if(TEL.on){$('telCode').textContent=telCode();$('telLien').textContent=lienTel();
    try{const q=qrcode(0,'M');q.addData(lienTel());q.make();$('telQR').innerHTML=q.createSvgTag({cellSize:5,margin:2})}catch(e){$('telQR').textContent=''}}
}
function initTel(){
  $('bTel').onclick=()=>{$('telp').hidden=false;telMaj()};
  $('telOn').onclick=()=>setTel(!TEL.on);
  $('telNv').onclick=()=>{if(!confirm('Créer un nouveau code ? Le téléphone devra se reconnecter avec le nouveau.'))return;TEL.code=null;LS.set('bd6_telcode',null);telCode();if(TEL.on)telDemarrer();telMaj()};
  if(TEL.on)telDemarrer();
}
