import {esc} from "../util.js";
import {F, X, rotuloMes} from "./filtros.js";
import {filtrarLanc} from "./dados.js";

/* Peças usadas por mais de uma seção do painel. */
export const SEM_CAT="nula";
export const catDe=l=>l.categoria_id||SEM_CAT;
export const pct=v=>v==null||!isFinite(v)?"—":(v*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%";

/* Entradas (e por consequência saldo, poupança e renda) só fazem sentido sem recorte de
   categoria, conta ou pessoa: as entradas não pertencem a nenhum desses. */
export const entradasAplicam=()=>!F.categoria&&!F.conta&&!F.pessoa&&!X.categoria;

/* lançamentos dos filtros globais + filtro cruzado de categoria (opcionalmente ignorado,
   para o próprio gráfico que define a categoria continuar mostrando todas) */
export function lancsDe(D,p,{semCategoriaX=false}={}){
  return filtrarLanc(D,F,p).filter(l=>semCategoriaX||!X.categoria||catDe(l)===X.categoria);
}

/* período efetivo: o mês do filtro cruzado, se houver, senão o período dos filtros */
export const periodoEfetivo=p=>X.mes?{de:X.mes,ate:X.mes}:p;

/* chips do filtro cruzado */
export function chips(D){
  const c=[];
  if(X.mes) c.push(["mes","Mês: "+rotuloMes(X.mes)]);
  if(X.categoria){ const cat=D.categorias.find(k=>k.id===X.categoria);
    c.push(["categoria","Categoria: "+(cat?cat.nome:"Sem categoria")]); }
  if(!c.length) return "";
  return '<div class="chipsX"><span class="mu">Filtro dos gráficos:</span>'+c.map(x=>
    '<button type="button" class="chip on" data-x="'+x[0]+'">'+esc(x[1])+' <b>×</b></button>').join("")+'</div>';
}
export function ligarChips(el,rerender){
  el.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{ X[b.dataset.x]=null; rerender(); });
}

/* clique em qualquer ponto da coluna de um mês num gráfico de eixo de categorias (meses) */
export function cliqueNoMes(g,meses,aoEscolher){
  if(!g) return;
  const zr=g.getZr();
  zr.on("click",ev=>{
    if(!g.containPixel("grid",[ev.offsetX,ev.offsetY])) return;
    const i=Math.round(g.convertFromPixel({gridIndex:0},[ev.offsetX,ev.offsetY])[0]);
    if(meses[i]) aoEscolher(meses[i]);
  });
  zr.on("mousemove",ev=>zr.setCursorStyle(g.containPixel("grid",[ev.offsetX,ev.offsetY])?"pointer":"default"));
}
