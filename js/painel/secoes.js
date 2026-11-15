import {visao, lancamentos} from "./visao.js";
import {fluxo} from "./fluxo.js";
import {patrimonio} from "./patrimonio.js";
import {pessoas} from "./pessoas.js";

/* Cada seção recebe os dados (D), o elemento do conteúdo e rerender()
   (para redesenhar depois de um clique que muda o filtro cruzado). */
export const SECOES={
  visao:       {nome:"Visão geral",          render:visao},
  fluxo:       {nome:"Fluxo e compromissos", render:fluxo},
  patrimonio:  {nome:"Patrimônio",           render:patrimonio},
  pessoas:     {nome:"Pessoas",              render:pessoas},
  lancamentos: {nome:"Lançamentos",          render:lancamentos}};
