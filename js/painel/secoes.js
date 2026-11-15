import {brl} from "../util.js";
import {F, periodo, descreverPeriodo} from "./filtros.js";
import {filtrarLanc, filtrarEntradas, somar, valorDe} from "./dados.js";

/* Cada seção recebe os dados (D) e devolve o HTML do conteúdo.
   Etapa 3: só a estrutura; os gráficos entram a partir da Etapa 4. */
const titulo=(t)=>'<div class="pTitulo"><h1>'+t+'</h1><span class="mu">'+descreverPeriodo()+'</span></div>';
const construcao=etapa=>'<div class="construcao">Em construção ('+etapa+').</div>';

function visao(D){
  const p=periodo(), lancs=filtrarLanc(D,F,p), ents=filtrarEntradas(D,F,p);
  const gastos=somar(lancs,l=>valorDe(l,F)), entradas=somar(ents,e=>Number(e.valor)||0);
  return titulo("Visão geral")+
    '<div class="grade">'+
      '<div class="cartao c4"><h3>Lançamentos no filtro</h3><div class="big">'+lancs.length+'</div>'+
        '<div class="sub">de '+D.lanc.length+' carregados</div></div>'+
      '<div class="cartao c4"><h3>Gastos '+(F.liquido?"líquidos":"brutos")+'</h3><div class="big">'+brl(gastos)+'</div>'+
        '<div class="sub">'+(F.debito?"com":"sem")+' débito/dinheiro</div></div>'+
      '<div class="cartao c4"><h3>Entradas</h3><div class="big">'+brl(entradas)+'</div>'+
        '<div class="sub">'+ents.length+' registros</div></div>'+
    '</div><div style="height:16px"></div>'+construcao("Etapa 4: KPIs, evolução mensal, treemap e tabela");
}

export const SECOES={
  visao:       {nome:"Visão geral",          render:visao},
  fluxo:       {nome:"Fluxo e compromissos", render:()=>titulo("Fluxo e compromissos")+construcao("Etapa 5")},
  patrimonio:  {nome:"Patrimônio",           render:()=>titulo("Patrimônio")+construcao("Etapa 6")},
  pessoas:     {nome:"Pessoas",              render:()=>titulo("Pessoas")+construcao("Etapa 6")},
  lancamentos: {nome:"Lançamentos",          render:()=>titulo("Lançamentos")+construcao("Etapa 4")}};
