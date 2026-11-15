import {descreverPeriodo} from "./filtros.js";
import {visao, lancamentos} from "./visao.js";

/* Cada seção recebe os dados (D), o elemento do conteúdo e rerender()
   (para redesenhar depois de um clique que muda o filtro cruzado). */
const provisoria=(t,etapa)=>(D,el)=>{
  el.innerHTML='<div class="pTitulo"><h1>'+t+'</h1><span class="mu">'+descreverPeriodo()+'</span></div>'+
    '<div class="construcao">Em construção ('+etapa+').</div>';
};

export const SECOES={
  visao:       {nome:"Visão geral",          render:visao},
  fluxo:       {nome:"Fluxo e compromissos", render:provisoria("Fluxo e compromissos","Etapa 5")},
  patrimonio:  {nome:"Patrimônio",           render:provisoria("Patrimônio","Etapa 6")},
  pessoas:     {nome:"Pessoas",              render:provisoria("Pessoas","Etapa 6")},
  lancamentos: {nome:"Lançamentos",          render:lancamentos}};
