import {$, esc, brl} from "../util.js";
import {F, X, periodo, periodoAnterior, rotuloMes, descreverPeriodo} from "./filtros.js";
import {somar, valorDe, mesDe, mesesEntre} from "./dados.js";
import {grafico, COR, brlCurto} from "./graficos.js";
import {tabelaLancamentos} from "./tabela.js";
import {catDe, pct, entradasAplicam, lancsDe, periodoEfetivo, chips, ligarChips, cliqueNoMes} from "./comum.js";

let comparar=false;            // "comparar com ano anterior" no gráfico de evolução
let rolarParaTabela=false;     // depois de um clique num gráfico, desce até a tabela

/* série mensal em competência, com a mesma regra do v_resumo_mes:
   bruto  -> entradas = entradas + parte rateada (a receber), gastos = valor
   líquido-> entradas = só entradas,                         gastos = valor líquido
   (o saldo é o mesmo nos dois modos) */
function serieComp(D,p){
  const meses=mesesEntre(p.de,p.ate);
  const m=Object.fromEntries(meses.map(k=>[k,{g:0,e:0}]));
  lancsDe(D,p).forEach(l=>{ const r=m[mesDe(l.competencia)];
    r.g+=valorDe(l,F); if(!F.liquido) r.e+=Number(l.valor_rateado)||0; });
  const aplica=entradasAplicam();
  if(aplica) D.entradas.forEach(e=>{ const r=m[mesDe(e.competencia)]; if(r) r.e+=Number(e.valor)||0; });
  return meses.map(k=>({mes:k,gastos:m[k].g,entradas:aplica?m[k].e:null,saldo:aplica?m[k].e-m[k].g:null}));
}

/* série mensal em caixa (v_resumo_caixa): o que entrou e saiu da conta no mês */
function serieCaixa(D,p){
  const por=Object.fromEntries(D.resumoCaixa.map(r=>[mesDe(r.mes),r]));
  return mesesEntre(p.de,p.ate).map(k=>{
    const r=por[k];
    const e=r?(+r.entradas_recebidas)+(+r.rateios_recebidos)+(+r.entrada_debito):0, g=r?+r.saidas_total:0;
    return {mes:k,entradas:e,gastos:g,saldo:e-g};
  });
}
const serie=(D,p)=>F.regime==="caixa"?serieCaixa(D,p):serieComp(D,p);

function totais(s){
  const g=somar(s,x=>x.gastos), temE=s.length&&s[0].entradas!=null;
  const e=temE?somar(s,x=>x.entradas):null;
  return {gastos:g,entradas:e,saldo:temE?e-g:null,taxa:temE&&e>0?(e-g)/e:null,
    media:s.length?g/s.length:0,meses:s.length,vazio:!s.some(x=>x.gastos||x.entradas)};
}

/* variação contra o período anterior. bom = "subir é bom?" */
function variacao(atual,antes,{bom=true,pp=false,reais=false}={}){
  if(atual==null||antes==null) return "";
  let txt,dif;
  if(pp){ dif=(atual-antes)*100; if(Math.abs(dif)<0.05) return '<div class="var">= período anterior</div>';
    txt=Math.abs(dif).toLocaleString("pt-BR",{maximumFractionDigits:1})+" p.p."; }
  else if(reais){ dif=atual-antes; if(Math.abs(dif)<0.005) return '<div class="var">= período anterior</div>';
    txt=brl(Math.abs(dif)); }   // saldo: % não faz sentido perto de zero ou trocando de sinal
  else{ if(!antes) return '<div class="var mu">sem base no período anterior</div>';
    dif=(atual-antes)/Math.abs(antes); if(Math.abs(dif)<0.0005) return '<div class="var">= período anterior</div>';
    txt=Math.abs(dif*100).toLocaleString("pt-BR",{maximumFractionDigits:1})+"%"; }
  const cls=(dif>0)===bom?"ok":"er";
  return '<div class="var"><span class="'+cls+'">'+(dif>0?"▲ ":"▼ ")+txt+'</span> vs período anterior</div>';
}

function cartaoKpi(titulo,valor,sub,vari){
  return '<div class="kpiP"><h3>'+titulo+'</h3><div class="big">'+valor+'</div>'+
    (sub?'<div class="sub">'+sub+'</div>':"")+vari+'</div>';
}

/* confere os totais calculados aqui com o v_resumo_mes (a mesma base da tela Mês) */
function divergencias(D,s){
  if(F.regime!=="comp"||F.debito||!entradasAplicam()) return 0;
  const por=Object.fromEntries(D.resumoMes.map(r=>[mesDe(r.competencia),r]));
  const ruins=s.filter(x=>{ const r=por[x.mes];
    const g=r?+(F.liquido?r.gastos_liquido:r.gastos_bruto):0, e=r?+(F.liquido?r.entradas_fixas:r.entradas_total):0;
    return Math.abs(g-x.gastos)>0.005||Math.abs(e-x.entradas)>0.005; });
  if(ruins.length) console.warn("Painel diverge do v_resumo_mes em",ruins.map(x=>x.mes));
  return ruins.length;
}

const notaCaixa=()=>F.regime!=="caixa"?"":
  '<div class="nota">Regime de caixa: os indicadores e a evolução mostram o dinheiro que entrou e saiu no mês '+
  '(inclui débito; não usa categoria, conta, pessoa nem bruto/líquido). O treemap e a tabela seguem em competência.</div>';

/* ======================= seção: visão geral ======================= */
export function visao(D,el,rerender){
  const p=periodo(), pe=periodoEfetivo(p), ant=periodoAnterior(pe);
  const sAtual=serie(D,pe), t=totais(sAtual), tA=totais(serie(D,ant)), semAnt=tA.vazio;
  const caixa=F.regime==="caixa", nDiv=divergencias(D,serie(D,p));
  const v=(a,b,o)=>semAnt?"":variacao(a,b,o);
  const naoAplica='<span class="mu" style="font-size:1rem">—</span>';
  const subNA="não se aplica com filtro de categoria, conta ou pessoa";

  el.innerHTML=
    '<div class="pTitulo"><h1>Visão geral</h1><span class="mu">'+
      (X.mes?rotuloMes(X.mes)+" (filtro do gráfico)":descreverPeriodo())+'</span></div>'+
    notaCaixa()+chips(D)+
    (nDiv?'<div class="nota er">Atenção: os totais diferem da tela Mês em '+nDiv+' mês(es). Veja o console.</div>':"")+
    '<div class="kpiRow">'+
      cartaoKpi(caixa?"Entrou":"Entradas",t.entradas==null?naoAplica:brl(t.entradas),
        t.entradas==null?subNA:(caixa?"recebido no período":F.liquido?"sem rateios":"inclui rateios a receber"),
        v(t.entradas,tA.entradas,{bom:true}))+
      cartaoKpi(caixa?"Saiu":"Gastos",brl(t.gastos),caixa?"pago no período":(F.liquido?"líquidos":"brutos"),
        v(t.gastos,tA.gastos,{bom:false}))+
      cartaoKpi("Saldo",t.saldo==null?naoAplica:'<span class="'+(t.saldo<0?"er":"")+'">'+brl(t.saldo)+'</span>',
        t.saldo==null?subNA:"",v(t.saldo,tA.saldo,{bom:true,reais:true}))+
      cartaoKpi("Taxa de poupança",t.taxa==null?naoAplica:pct(t.taxa),
        t.taxa==null?(t.entradas==null?subNA:"sem entradas"):"saldo ÷ entradas",
        v(t.taxa,tA.taxa,{bom:true,pp:true}))+
      cartaoKpi("Média mensal de "+(caixa?"saídas":"gastos"),brl(t.media),t.meses+" "+(t.meses===1?"mês":"meses"),
        v(t.media,tA.media,{bom:false}))+
    '</div>'+
    '<div class="grade" style="margin-top:16px">'+
      '<div class="cartao"><div class="cabC"><h3>Evolução mensal</h3>'+
        (caixa?"":'<label class="sw mini">Comparar com ano anterior<input type="checkbox" id="vCmp"'+(comparar?" checked":"")+'></label>')+
        '</div><div class="graf" id="gEvol" style="height:330px"></div>'+
        '<div class="dica">Clique numa barra para filtrar o mês. Arraste ou use a roda do mouse para dar zoom.</div></div>'+
      '<div class="cartao"><div class="cabC"><h3>Gastos por categoria</h3><span class="mu" style="font-size:.78rem">'+
        (X.mes?rotuloMes(X.mes):descreverPeriodo())+'</span></div>'+
        '<div class="graf" id="gCat" style="height:340px"></div><div class="dica" id="gCatNota">Clique numa categoria para filtrar.</div></div>'+
      '<div class="cartao" id="cTab"><div class="cabC"><h3>Lançamentos do filtro</h3></div><div id="tabV"></div></div>'+
    '</div>';

  ligarChips(el,rerender);
  const cmp=$("#vCmp"); if(cmp) cmp.onchange=()=>{ comparar=cmp.checked; rerender(); };

  graficoEvolucao(D,p,rerender);
  graficoCategorias(D,pe,rerender);
  tabelaLancamentos($("#tabV"),lancsDe(D,pe));

  if(rolarParaTabela){ rolarParaTabela=false; $("#cTab").scrollIntoView({behavior:"smooth",block:"start"}); }
}

function graficoEvolucao(D,p,rerender){
  const s=serie(D,p), caixa=F.regime==="caixa";
  const voltar12=k=>{ const [a,m]=k.split("-"); return (+a-1)+"-"+m; };
  const sAnt=comparar&&!caixa?serie(D,{de:voltar12(p.de),ate:voltar12(p.ate)}):null;
  const apaga=k=>X.mes&&X.mes!==k?{opacity:.3}:{};
  const barra=(nome,cor,campo)=>({name:nome,type:"bar",barMaxWidth:22,barGap:"8%",
    itemStyle:{color:cor,borderRadius:[4,4,0,0]},
    data:s.map(x=>({value:+x[campo].toFixed(2),itemStyle:apaga(x.mes)}))});
  const series=[];
  if(s[0]?.entradas!=null) series.push(barra(caixa?"Entrou":"Entradas",COR.entradas,"entradas"));
  series.push(barra(caixa?"Saiu":"Gastos",COR.gastos,"gastos"));
  if(s[0]?.saldo!=null) series.push({name:"Saldo",type:"line",symbolSize:8,lineStyle:{width:2},
    itemStyle:{color:COR.saldo,borderColor:COR.s1,borderWidth:2},data:s.map(x=>+x.saldo.toFixed(2))});
  if(sAnt) series.push({name:"Gastos no ano anterior",type:"line",symbol:"circle",symbolSize:7,
    lineStyle:{width:2,type:"dashed"},itemStyle:{color:COR.gastos,opacity:.75},
    // mês sem nenhum gasto no ano anterior fica vazio (em vez de uma linha colada no zero)
    data:sAnt.map(x=>x.gastos?+x.gastos.toFixed(2):null)});
  const muitos=s.length>12;
  grafico($("#gEvol"),{
    grid:{left:8,right:16,top:36,bottom:muitos?48:12,containLabel:true},
    legend:{top:0,right:0,textStyle:{color:COR.tx},itemWidth:14,itemHeight:10},
    tooltip:{trigger:"axis",axisPointer:{type:"shadow",shadowStyle:{color:"#ffffff0d"}},valueFormatter:v=>brl(v)},
    xAxis:{type:"category",data:s.map(x=>rotuloMes(x.mes)),axisLine:{lineStyle:{color:COR.bd}},axisTick:{show:false},
      axisLabel:{color:COR.mu}},
    yAxis:{type:"value",axisLabel:{color:COR.mu,formatter:brlCurto},splitLine:{lineStyle:{color:COR.bd}}},
    dataZoom:muitos?[{type:"inside"},{type:"slider",height:16,bottom:6,borderColor:COR.bd,
      fillerColor:"#7C5CFF33",handleStyle:{color:COR.mu},textStyle:{color:COR.mu},dataBackground:{lineStyle:{color:COR.bd},areaStyle:{color:COR.s2}}}]
      :[{type:"inside"}],
    series}).then(g=>cliqueNoMes(g,s.map(x=>x.mes),k=>{   // a coluna inteira do mês é clicável
      X.mes=X.mes===k?null:k; rolarParaTabela=true; rerender(); }));
}

function graficoCategorias(D,pe,rerender){
  const por=new Map();
  lancsDe(D,pe,{semCategoriaX:true}).forEach(l=>{
    const k=catDe(l), r=por.get(k)||{id:k,nome:l.categoria_nome||"Sem categoria",
      cor:l.categoria_cor||"#555",corTx:l.categoria_cor_texto||COR.tx,valor:0};
    r.valor+=valorDe(l,F); por.set(k,r);
  });
  const todos=[...por.values()], pos=todos.filter(c=>c.valor>0.004).sort((a,b)=>b.valor-a.valor);
  const total=somar(pos,c=>c.valor), neg=todos.filter(c=>c.valor<-0.004);
  if(neg.length) $("#gCatNota").textContent="Clique numa categoria para filtrar. Fora do gráfico (saldo negativo no período): "+
    neg.map(c=>c.nome).join(", ")+".";
  if(!pos.length){ $("#gCat").innerHTML='<div class="vazio">Nenhum gasto no filtro.</div>'; return; }
  grafico($("#gCat"),{
    tooltip:{formatter:i=>esc(i.name)+"<br><b>"+brl(i.value)+"</b> · "+pct(i.value/total)},
    series:[{type:"treemap",roam:false,nodeClick:false,breadcrumb:{show:false},
      left:0,right:0,top:0,bottom:0,
      itemStyle:{borderColor:COR.s1,borderWidth:2,gapWidth:2,borderRadius:6},
      label:{show:true,formatter:i=>i.name+"\n"+brlCurto(i.value),fontSize:12,lineHeight:16},
      data:pos.map(c=>({name:c.nome,value:+c.valor.toFixed(2),id:c.id,
        itemStyle:{color:c.cor,opacity:X.categoria&&X.categoria!==c.id?.3:1},label:{color:c.corTx}}))}]},
    ev=>{ const id=ev.data?.id; if(!id) return;
      X.categoria=X.categoria===id?null:id; rolarParaTabela=true; rerender(); });
}

/* ======================= seção: lançamentos ======================= */
export function lancamentos(D,el,rerender){
  const p=periodo(), pe=periodoEfetivo(p);
  el.innerHTML='<div class="pTitulo"><h1>Lançamentos</h1><span class="mu">'+
      (X.mes?rotuloMes(X.mes):descreverPeriodo())+'</span></div>'+chips(D)+
    '<div class="cartao"><div id="tabL"></div></div>';
  ligarChips(el,rerender);
  tabelaLancamentos($("#tabL"),lancsDe(D,pe),{porPagina:50});
}
