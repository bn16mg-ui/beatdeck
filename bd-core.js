'use strict';
/* ===== BeatDeck 5 · outils communs ===== */
const VERSION='5.3.1';
const $=id=>document.getElementById(id),Q=(s,r=document)=>r.querySelector(s),QA=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,smth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]||0};
const esc=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>isFinite(s)&&s>=0?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'--:--';
const fmtF=fmt;
const nf=(v,d=1)=>Number(v).toFixed(d).replace('.',',');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Stockage léger (réglages) */
const LS={
  get(k,f){try{const v=localStorage.getItem(k);return v==null?f:JSON.parse(v)}catch(e){return f}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){toast('Mémoire du navigateur pleine : réglage non enregistré','err')}},
  del(k){try{localStorage.removeItem(k)}catch(e){}}
};
/* Stockage des analyses et du dossier (IndexedDB) */
const IDB=(()=>{
  let p=null;
  const open=()=>p||(p=new Promise((ok,no)=>{const r=indexedDB.open('beatdeck5',1);
    r.onupgradeneeded=()=>{const db=r.result;['meta','divers'].forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s)})};
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}));
  const tx=async(st,mode,f)=>{const db=await open();return new Promise((ok,no)=>{const t=db.transaction(st,mode),r=f(t.objectStore(st));t.oncomplete=()=>ok(r&&r.result);t.onerror=()=>no(t.error);t.onabort=()=>no(t.error)})};
  return{
    get:(st,k)=>tx(st,'readonly',s=>s.get(k)),
    put:(st,k,v)=>tx(st,'readwrite',s=>s.put(v,k)),
    del:(st,k)=>tx(st,'readwrite',s=>s.delete(k)),
    all:async st=>{const db=await open();return new Promise((ok,no)=>{const out={},t=db.transaction(st,'readonly'),c=t.objectStore(st).openCursor();
      c.onsuccess=()=>{const x=c.result;if(x){out[x.key]=x.value;x.continue()}};t.oncomplete=()=>ok(out);t.onerror=()=>no(t.error)})}
  };
})();

/* Messages courts */
let toastT;
function toast(m,type){const t=$('toast');if(!t)return;t.textContent=m;t.className='on '+(type||'');clearTimeout(toastT);toastT=setTimeout(()=>t.className='',type=='err'?4000:2400)}

/* ===== Automatismes interruptibles =====
   Tout effet, transition ou action programmée passe par un Job.
   L'arrêt d'urgence arrête tous les Jobs : plus aucune minuterie ne peut agir ensuite. */
const JOBS=new Set(),JOBK={};
let majJobs=()=>{};
class Job{
  constructor(nom,o={}){this.nom=nom;this.deck=o.deck;this.auto=!!o.auto;this.dead=false;this.tm=[];this.fin=[];this.cle=o.cle||null;
    if(this.cle){if(JOBK[this.cle])JOBK[this.cle].stop();JOBK[this.cle]=this}JOBS.add(this);majJobs()}
  later(f,ms){const id=setTimeout(()=>{if(this.dead)return;try{f()}catch(e){console.error(e);this.stop()}},Math.max(0,ms||0));this.tm.push(id);return id}
  frame(f){const st=()=>{if(this.dead)return;let r;try{r=f()}catch(e){console.error(e);this.stop();return}if(r!==false)requestAnimationFrame(st)};requestAnimationFrame(st)}
  every(f,ms){const id=setInterval(()=>{if(this.dead){clearInterval(id);return}try{f()}catch(e){console.error(e);this.stop()}},ms);this.tm.push(id);return id}
  onStop(f){this.fin.push(f);return this}
  _close(){if(this.dead)return false;this.dead=true;this.tm.forEach(id=>{clearTimeout(id);clearInterval(id)});JOBS.delete(this);if(this.cle&&JOBK[this.cle]===this)delete JOBK[this.cle];majJobs();return true}
  end(){if(this._close())this.fin.forEach(f=>{try{f(false)}catch(e){console.error(e)}})}
  stop(){if(this._close())this.fin.forEach(f=>{try{f(true)}catch(e){console.error(e)}})}
}
const jobActif=c=>JOBK[c]&&!JOBK[c].dead?JOBK[c]:null;
