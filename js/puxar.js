import {preparados} from "./estado.js";
import {$, sheetAberto} from "./util.js";
import {carregar} from "./nav.js";

/* ---------------- puxar para atualizar ---------------- */
(function(){
  const ind=document.createElement("div");
  ind.id="puxar"; ind.innerHTML="<span>Solte para atualizar</span>";
  document.body.appendChild(ind);
  let y0=null, pronto=false;
  document.addEventListener("touchstart",e=>{
    y0=(window.scrollY<=0 && !sheetAberto() && !$("#app").classList.contains("hide"))
       ? e.touches[0].clientY : null;
    pronto=false;},{passive:true});
  document.addEventListener("touchmove",e=>{
    if(y0===null) return;
    pronto=(e.touches[0].clientY-y0)>75 && window.scrollY<=0;
    ind.style.opacity=pronto?"1":"0";},{passive:true});
  document.addEventListener("touchend",()=>{
    if(pronto){
      ind.querySelector("span").textContent="Atualizando…";
      preparados.clear(); carregar();
      setTimeout(()=>{ind.style.opacity="0";
        ind.querySelector("span").textContent="Solte para atualizar";},900);
    } else ind.style.opacity="0";
    y0=null; pronto=false;});
})();
