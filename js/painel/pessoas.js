import {$, esc, brl} from "../util.js";
import {F, periodo, rotuloMes, descreverPeriodo} from "./filtros.js";
import {somar, mesDe, mesesEntre} from "./dados.js";
import {grafico, COR, brlCurto} from "./graficos.js";

/* Seção Pessoas: rateios (quanto cada pessoa deve pelos gastos divididos).
   O resumo por pessoa vale para todo o histórico; o gráfico e a lista seguem o período
   e o filtro de pessoa. Inclui rateios de qualquer forma de pagamento (débito também),
   porque o valor a receber existe independente de onde o gasto foi pago. */
const parteRateio=(r,l)=>r.valor!=null?+r.valor:(+l.valor)*(+r.percentual)/100;
/* recebido com outro valor: vale o que realmente entrou */
const valorRateio=(r,l)=>r.recebido&&r.valor_recebido!=null?+r.valor_recebido:parteRateio(r,l);
const dataBR=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(2,4):"";

export function pessoas(D,el){
  const p=periodo();
  const lancPorId=new Map(D.lanc.map(l=>[l.id,l]));
  const nome=id=>D.pessoas.find(x=>x.id===id)?.nome||"—";
  const itens=D.rateio.map(r=>{ const l=lancPorId.get(r.lancamento_id);
      return l?{r,l,pessoa:r.pessoa_id,mes:mesDe(l.competencia),valor:valorRateio(r,l)}:null; })
    .filter(Boolean).filter(x=>!F.pessoa||x.pessoa===F.pessoa);
  const noPeriodo=itens.filter(x=>x.mes>=p.de&&x.mes<=p.ate);
  const resumo=D.aReceberPessoa.filter(x=>!F.pessoa||x.pessoa_id===F.pessoa)
    .sort((a,b)=>(+b.pendente)-(+a.pendente)||(+b.recebido)-(+a.recebido));
  const filtrosIgnorados=F.categoria||F.conta;

  el.innerHTML=
    '<div class="pTitulo"><h1>Pessoas</h1><span class="mu">'+descreverPeriodo()+'</span></div>'+
    (filtrosIgnorados?'<div class="nota">Os filtros de categoria e conta não se aplicam a esta seção.</div>':"")+
    '<div class="pessoasRow">'+(resumo.length?resumo.map(x=>{
      const pend=+x.pendente;
      return '<div class="kpiP"><h3>'+esc(x.pessoa)+'</h3>'+
        '<div class="big '+(pend>0.004?"wr":"ok")+'">'+brl(pend)+'</div>'+
        '<div class="sub">'+(pend>0.004?"a receber · "+x.itens+" ite"+(+x.itens===1?"m":"ns")+
          (x.desde?" desde "+rotuloMes(mesDe(x.desde)):""):"nada pendente")+'</div>'+
        '<div class="var">já recebido: '+brl(x.recebido)+'</div></div>';
    }).join(""):'<div class="kpiP"><h3>Pessoas</h3><div class="sub">Nenhum gasto dividido ainda.</div></div>')+'</div>'+
    '<div class="grade" style="margin-top:16px">'+
      '<div class="cartao"><div class="cabC"><h3>Dividido por mês</h3><span class="mu" style="font-size:.78rem">'+
        descreverPeriodo()+'</span></div>'+
        '<div class="graf" id="gPesMes" style="height:300px"></div>'+
        '<div class="dica">Pelo mês do gasto (competência). Parte cheia: já recebido; parte clara: ainda pendente.</div></div>'+
      '<div class="cartao"><div class="cabC"><h3>Pendentes</h3><span class="mu" style="font-size:.78rem">todo o histórico, mais antigos primeiro</span></div>'+
        '<div id="tabPes"></div></div>'+
    '</div>';

  graficoMes(noPeriodo,p,nome);
  tabelaPendentes(itens.filter(x=>!x.r.recebido),nome);
}

function graficoMes(itens,p,nome){
  if(!itens.length){ $("#gPesMes").innerHTML='<div class="vazio">Nenhum gasto dividido no período.</div>'; return; }
  const meses=mesesEntre(p.de,p.ate);
  const ids=[...new Set(itens.map(x=>x.pessoa))].sort((a,b)=>nome(a).localeCompare(nome(b)));
  const cores=[COR.entradas,COR.gastos,COR.saldo,"#b25bd6","#d6a13a","#4fb3c9"];
  const series=[];
  ids.forEach((id,k)=>{
    const cor=cores[k%cores.length];
    const soma=rec=>meses.map(m=>+somar(itens.filter(x=>x.pessoa===id&&x.mes===m&&!!x.r.recebido===rec),x=>x.valor).toFixed(2));
    series.push({name:nome(id)+" · recebido",type:"bar",stack:id,barMaxWidth:26,itemStyle:{color:cor},data:soma(true)});
    series.push({name:nome(id)+" · pendente",type:"bar",stack:id,barMaxWidth:26,
      itemStyle:{color:cor,opacity:.35,borderRadius:[4,4,0,0]},data:soma(false)});
  });
  grafico($("#gPesMes"),{
    grid:{left:8,right:16,top:36,bottom:12,containLabel:true},
    legend:{top:0,right:0,textStyle:{color:COR.tx},itemWidth:14,itemHeight:10},
    tooltip:{trigger:"axis",axisPointer:{type:"shadow",shadowStyle:{color:"#ffffff0d"}},valueFormatter:v=>brl(v)},
    xAxis:{type:"category",data:meses.map(rotuloMes),axisLine:{lineStyle:{color:COR.bd}},axisTick:{show:false},axisLabel:{color:COR.mu}},
    yAxis:{type:"value",axisLabel:{color:COR.mu,formatter:brlCurto},splitLine:{lineStyle:{color:COR.bd}}},
    series});
}

function tabelaPendentes(itens,nome){
  if(!itens.length){ $("#tabPes").innerHTML='<div class="vazio">Nada pendente.</div>'; return; }
  const ord=[...itens].sort((a,b)=>a.mes.localeCompare(b.mes)||(a.l.data_compra||"").localeCompare(b.l.data_compra||""));
  const total=somar(ord,x=>x.valor);
  $("#tabPes").innerHTML='<div class="tabRolo"><table class="tabL"><thead><tr>'+
    '<th>Competência</th><th>Compra</th><th>Descrição</th><th>Pessoa</th><th class="n">Parte</th><th class="n">Valor do gasto</th></tr></thead><tbody>'+
    ord.map(x=>'<tr><td>'+rotuloMes(x.mes)+'</td><td>'+dataBR(x.l.data_compra)+'</td><td>'+esc(x.l.descricao)+
      (x.l.parcela_num&&x.l.parcelas_total>1?' <span class="bdg">'+x.l.parcela_num+"/"+x.l.parcelas_total+'</span>':"")+'</td>'+
      '<td>'+esc(nome(x.pessoa))+'</td>'+
      '<td class="n"><b>'+brl(x.valor)+'</b>'+(x.r.percentual!=null&&x.r.valor==null?' <span class="mu">('+(+x.r.percentual)+'%)</span>':"")+'</td>'+
      '<td class="n">'+brl(x.l.valor)+'</td></tr>').join("")+
    '</tbody></table></div><div class="tabRodape"><span>'+ord.length+' pendente'+(ord.length===1?"":"s")+' · '+brl(total)+
    '</span><span class="mu">Marque como recebido pelo app, em A receber.</span></div>';
}
