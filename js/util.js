import {S} from "./estado.js";

export const $=s=>document.querySelector(s);
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
export const brl=n=>(Number(n)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export const comp=()=>S.ano+"-"+String(S.mes+1).padStart(2,"0")+"-01";
export const mesCorrente=()=>{const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01";};
export const hojeISO=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);

export function num(v){ if(typeof v==="number")return v; let s=String(v??"").replace(/[^\d.,-]/g,""); if(!s)return NaN;
  const neg=s[0]==="-"; s=s.replace(/-/g,""); const vi=s.lastIndexOf(","),po=s.lastIndexOf(".");
  let int=s,dec="";
  if(vi>-1&&po>-1){const p=Math.max(vi,po);int=s.slice(0,p);dec=s.slice(p+1);}
  else if(vi>-1||po>-1){const sep=vi>-1?",":".",p=Math.max(vi,po),q=s.split(sep).length-1,d=s.length-p-1;
    if(!(d===3&&(q>1||sep==="."))){int=s.slice(0,p);dec=s.slice(p+1);}}
  const n=parseFloat(int.replace(/[.,]/g,"")+(dec?"."+dec:"")); return isNaN(n)?NaN:(neg?-n:Math.round(n*100)/100); }

let tT;
export function toast(m,t){const e=$("#toast");clearTimeout(tT);e.textContent=m;e.className="on "+(t==="e"?"e":"s");
  tT=setTimeout(()=>e.className="",t==="e"?7000:3500);}
export function erro(e){toast(e?.message||String(e),"e");}

/* ---------------- sheet ---------------- */
let sheetEl=null;
export function sheet(titulo,html,onMount){
  fechar();
  const bg=document.createElement("div"); bg.className="bg";
  bg.innerHTML='<div class="sheet"><div class="grab"></div><h3>'+esc(titulo)+'</h3><div class="corpo"></div></div>';
  bg.querySelector(".corpo").innerHTML=html;
  bg.addEventListener("click",e=>{if(e.target===bg)fechar();});
  document.body.appendChild(bg); sheetEl=bg;
  onMount&&onMount(bg);
  return bg;
}
export function fechar(){ if(sheetEl){sheetEl.remove();sheetEl=null;} }
export function sheetAberto(){ return !!sheetEl; }
