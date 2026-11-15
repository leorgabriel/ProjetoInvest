import {$, esc, brl} from "../util.js";
import {F, periodo, rotuloMes, descreverPeriodo} from "./filtros.js";
import {somar, mesDe, mesesEntre} from "./dados.js";
import {grafico, COR, brlCurto} from "./graficos.js";
import {pct} from "./comum.js";

/* Seção Patrimônio: investimentos (v_investimento + movimento_investimento) e a carteira
   de caixa acumulada (v_caixa_acumulado). Não usa categoria, conta, pessoa nem bruto/líquido. */
const TIPOS={reserva:"Reserva",caixinha:"Caixinha",renda_fixa:"Renda fixa",fii:"FII",
  renda_variavel:"Renda variável",cripto:"Cripto",previdencia:"Previdência",outro:"Outro"};
const PALETA=["#3987e5","#d95926","#199e70","#b25bd6","#d6a13a","#4fb3c9","#e0607e","#8a8f99"];
/* efeito de cada tipo de movimento no saldo (mesma regra do v_investimento) */
const SINAL={aporte:1,rendimento:1,ajuste:1,resgate:-1};

export function patrimonio(D,el){
  const p=periodo();
  const ativos=D.investimentos.filter(i=>i.ativo);
  const investido=somar(ativos,i=>+i.saldo);
  const aportado=somar(D.investimentos,i=>+i.total_aportado-(+i.total_resgatado));
  const rendeu=somar(D.movInv.filter(m=>m.tipo==="rendimento"||m.tipo==="ajuste"),m=>+m.valor);
  const ac=D.caixaAcum, atual=ac.find(x=>mesDe(x.mes)===p.ate)||ac.filter(x=>mesDe(x.mes)<=p.ate).pop()||null;
  const carteira=atual?+atual.acumulado:null;
  const filtrosIgnorados=F.categoria||F.conta||F.pessoa;

  el.innerHTML=
    '<div class="pTitulo"><h1>Patrimônio</h1><span class="mu">'+descreverPeriodo()+'</span></div>'+
    (filtrosIgnorados?'<div class="nota">Os filtros de categoria, conta e pessoa não se aplicam a esta seção.</div>':"")+
    '<div class="kpiRow k4">'+
      kpi("Total investido",brl(investido),ativos.length+" aplica"+(ativos.length===1?"ção ativa":"ções ativas"))+
      kpi("Aportado líquido",brl(aportado),"aportes menos resgates")+
      kpi("Rendimentos",'<span class="'+(rendeu<0?"er":rendeu>0?"ok":"")+'">'+brl(rendeu)+'</span>',"rendimentos e ajustes lançados")+
      kpi("Carteira (caixa)",carteira==null?'<span class="mu" style="font-size:1rem">—</span>':
        '<span class="'+(carteira<0?"er":"")+'">'+brl(carteira)+'</span>',
        carteira==null?"antes do início da carteira":"acumulado até "+rotuloMes(mesDe(atual.mes)))+
    '</div>'+
    '<div class="grade" style="margin-top:16px">'+
      '<div class="cartao c8"><div class="cabC"><h3>Evolução do investido</h3></div>'+
        '<div class="graf" id="gInvEvol" style="height:320px"></div>'+
        '<div class="dica">Saldo ao fim de cada mês (linha) e o que entrou ou saiu no mês (barras).</div></div>'+
      '<div class="cartao c4"><div class="cabC"><h3>Distribuição por tipo</h3></div>'+
        '<div class="graf" id="gInvTipo" style="height:320px"></div></div>'+
      '<div class="cartao"><div class="cabC"><h3>Aplicações</h3></div><div id="tabInv"></div></div>'+
      '<div class="cartao"><div class="cabC"><h3>Carteira de caixa acumulada</h3></div>'+
        '<div class="graf" id="gCarteira" style="height:280px"></div><div class="dica" id="gCarteiraNota"></div></div>'+
    '</div>';

  graficoEvolucao(D,p);
  graficoTipos(ativos,investido);
  tabelaAplicacoes(D,investido);
  graficoCarteira(D,p);
}

const kpi=(t,v,sub)=>'<div class="kpiP"><h3>'+t+'</h3><div class="big">'+v+'</div><div class="sub">'+sub+'</div></div>';
const vazio=(id,txt)=>{ const e=$(id); if(e) e.innerHTML='<div class="vazio">'+txt+'</div>'; };

/* saldo acumulado até o fim de cada mês do período + movimento líquido do mês */
function graficoEvolucao(D,p){
  if(!D.movInv.length) return vazio("#gInvEvol","Nenhum movimento de investimento lançado ainda.");
  const meses=mesesEntre(p.de,p.ate);
  let antes=0; const mov=Object.fromEntries(meses.map(k=>[k,0]));
  D.movInv.forEach(m=>{ const k=mesDe(m.data), v=(SINAL[m.tipo]||0)*(+m.valor);
    if(k<p.de) antes+=v; else if(k<=p.ate) mov[k]+=v; });
  let acc=antes;
  const saldo=meses.map(k=>(acc+=mov[k],+acc.toFixed(2)));
  if(!saldo.some(v=>Math.abs(v)>0.004)&&!meses.some(k=>mov[k]))
    return vazio("#gInvEvol","Nenhum investimento no período. O primeiro movimento é de "+
      rotuloMes(mesDe(D.movInv[0].data))+".");
  grafico($("#gInvEvol"),{
    grid:{left:8,right:16,top:36,bottom:12,containLabel:true},
    legend:{top:0,right:0,textStyle:{color:COR.tx},itemWidth:14,itemHeight:10},
    tooltip:{trigger:"axis",valueFormatter:v=>brl(v)},
    xAxis:{type:"category",data:meses.map(rotuloMes),axisLine:{lineStyle:{color:COR.bd}},axisTick:{show:false},axisLabel:{color:COR.mu}},
    yAxis:{type:"value",axisLabel:{color:COR.mu,formatter:brlCurto},splitLine:{lineStyle:{color:COR.bd}}},
    series:[
      {name:"Movimento do mês",type:"bar",barMaxWidth:22,
        data:meses.map(k=>({value:+mov[k].toFixed(2),itemStyle:{color:mov[k]<0?COR.gastos:COR.entradas,borderRadius:[4,4,0,0]}}))},
      {name:"Saldo investido",type:"line",symbolSize:8,lineStyle:{width:2},
        itemStyle:{color:COR.saldo,borderColor:COR.s1,borderWidth:2},data:saldo}]});
}

function graficoTipos(ativos,total){
  const por=new Map();
  ativos.forEach(i=>{ const v=+i.saldo; if(v>0.004) por.set(i.tipo,(por.get(i.tipo)||0)+v); });
  const dados=[...por.entries()].sort((a,b)=>b[1]-a[1]);
  if(!dados.length) return vazio("#gInvTipo","Nenhuma aplicação com saldo.");
  grafico($("#gInvTipo"),{
    tooltip:{formatter:i=>esc(i.name)+"<br><b>"+brl(i.value)+"</b> · "+pct(i.value/total)},
    legend:{bottom:0,textStyle:{color:COR.tx},itemWidth:12,itemHeight:10},
    series:[{type:"pie",radius:["48%","72%"],center:["50%","44%"],avoidLabelOverlap:true,
      itemStyle:{borderColor:COR.s1,borderWidth:2,borderRadius:6},
      label:{color:COR.tx,formatter:i=>pct(i.value/total)},
      data:dados.map(([t,v],k)=>({name:TIPOS[t]||t,value:+v.toFixed(2),itemStyle:{color:PALETA[k%PALETA.length]}}))}]});
}

function tabelaAplicacoes(D,total){
  const lista=[...D.investimentos].sort((a,b)=>(b.ativo-a.ativo)||(+b.saldo-(+a.saldo)));
  if(!lista.length) return vazio("#tabInv","Nenhuma aplicação cadastrada. Cadastre pelo app, em Investimentos.");
  const n=v=>'<td class="n">'+brl(v)+'</td>';
  $("#tabInv").innerHTML='<div class="tabRolo"><table class="tabL"><thead><tr>'+
    '<th>Aplicação</th><th>Tipo</th><th>Instituição</th><th class="n">Aportado</th><th class="n">Resgatado</th>'+
    '<th class="n">Rendimentos</th><th class="n">Saldo</th><th class="n">% do total</th><th>Objetivo</th></tr></thead><tbody>'+
    lista.map(i=>{
      const obj=+i.objetivo_valor>0?Math.min(100,Math.round(+i.saldo/(+i.objetivo_valor)*100)):null;
      return '<tr'+(i.ativo?"":' class="inativa"')+'><td>'+esc(i.nome)+(i.ativo?"":' <span class="bdg">desativada</span>')+'</td>'+
        '<td>'+esc(TIPOS[i.tipo]||i.tipo)+'</td><td>'+esc(i.instituicao||"—")+'</td>'+
        n(i.total_aportado)+n(i.total_resgatado)+n(i.total_rendimento)+
        '<td class="n"><b>'+brl(i.saldo)+'</b></td>'+
        '<td class="n">'+(i.ativo&&total>0?pct(+i.saldo/total):"—")+'</td>'+
        '<td>'+(obj==null?'<span class="mu">—</span>':'<div class="objBar"><i style="width:'+Math.max(2,obj)+'%"></i></div>'+
          '<span class="mu" style="font-size:.74rem">'+obj+'% de '+brl(i.objetivo_valor)+'</span>')+'</td></tr>';
    }).join("")+'</tbody></table></div>';
}

/* v_caixa_acumulado: só existe do início da carteira em diante */
function graficoCarteira(D,p){
  const ac=D.caixaAcum.filter(x=>{ const k=mesDe(x.mes); return k>=p.de&&k<=p.ate; });
  const ini=D.caixaAcum[0];
  $("#gCarteiraNota").textContent=ini?"Começa em "+brl(ini.saldo_inicial)+" em "+rotuloMes(mesDe(ini.inicio))+
    " e soma o que foi pago ou recebido de lá em diante (configure em Débito e caixa, no app).":"";
  if(!ac.length) return vazio("#gCarteira","A carteira começa em "+(ini?rotuloMes(mesDe(ini.inicio)):"um mês posterior")+
    ", fora do período escolhido.");
  grafico($("#gCarteira"),{
    grid:{left:8,right:16,top:16,bottom:12,containLabel:true},
    tooltip:{trigger:"axis",valueFormatter:v=>brl(v)},
    xAxis:{type:"category",data:ac.map(x=>rotuloMes(mesDe(x.mes))),axisLine:{lineStyle:{color:COR.bd}},axisTick:{show:false},axisLabel:{color:COR.mu}},
    yAxis:{type:"value",axisLabel:{color:COR.mu,formatter:brlCurto},splitLine:{lineStyle:{color:COR.bd}}},
    series:[
      {name:"Resultado do mês",type:"bar",barMaxWidth:22,
        data:ac.map(x=>({value:+(+x.fluxo).toFixed(2),itemStyle:{color:+x.fluxo<0?COR.gastos:COR.entradas,borderRadius:[4,4,0,0]}}))},
      {name:"Carteira",type:"line",symbolSize:8,lineStyle:{width:2},itemStyle:{color:COR.saldo,borderColor:COR.s1,borderWidth:2},
        data:ac.map(x=>+(+x.acumulado).toFixed(2))}]});
}
