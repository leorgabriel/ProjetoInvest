import {$, esc, brl} from "../util.js";
import {MESES} from "../estado.js";
import {F, X, periodo, mesAtual, rotuloMes, descreverPeriodo} from "./filtros.js";
import {filtrarLanc, somar, valorDe, mesDe, mesesEntre} from "./dados.js";
import {grafico, COR, brlCurto} from "./graficos.js";
import {SEM_CAT, catDe, pct, entradasAplicam, lancsDe, periodoEfetivo, chips, ligarChips, cliqueNoMes} from "./comum.js";

const OUTRAS="#5a5f6b";        // cinza neutro para "Outras"
const MAX_CAT_AREA=7;          // categorias nomeadas na área empilhada; o resto vira "Outras"
const MAX_CAT_ORC=12;          // categorias no orçamento × realizado
const MESES_MEDIA=6;           // janela da média histórica (orçamento e renda de referência)

function somaMeses(mes,n){ let [a,m]=mes.split("-").map(Number); m+=n;
  while(m>12){m-=12;a++;} while(m<1){m+=12;a--;} return a+"-"+String(m).padStart(2,"0"); }
const nomeCat=(D,id)=>id===SEM_CAT?"Sem categoria":(D.categorias.find(c=>c.id===id)?.nome||"Sem categoria");
const corCat=(D,id)=>D.categorias.find(c=>c.id===id)?.cor_fundo||"#555";
const alternarCategoria=(id,rerender)=>{ X.categoria=X.categoria===id?null:id; rerender(); };

/* ======================= seção: fluxo e compromissos ======================= */
export function fluxo(D,el,rerender){
  const p=periodo(), pe=periodoEfetivo(p);
  el.innerHTML=
    '<div class="pTitulo"><h1>Fluxo e compromissos</h1><span class="mu">'+
      (X.mes?rotuloMes(X.mes)+" (filtro do gráfico)":descreverPeriodo())+'</span></div>'+
    (F.regime==="caixa"?'<div class="nota">Esta seção usa sempre competência (o regime de caixa vale só para a Visão geral).</div>':"")+
    chips(D)+
    '<div class="grade">'+
      '<div class="cartao"><div class="cabC"><h3>Para onde foi o dinheiro</h3><span class="mu" style="font-size:.78rem">'+
        (X.mes?rotuloMes(X.mes):descreverPeriodo())+'</span></div>'+
        '<div class="graf" id="gSankey" style="height:480px"></div><div class="dica" id="gSankeyNota"></div></div>'+
      '<div class="cartao c7"><div class="cabC"><h3>Gastos por categoria ao longo do tempo</h3></div>'+
        '<div class="graf" id="gArea" style="height:360px"></div>'+
        '<div class="dica">Clique num mês para filtrar. As '+MAX_CAT_AREA+' maiores categorias do período aparecem; o resto soma em "Outras".</div></div>'+
      '<div class="cartao c5"><div class="cabC"><h3>Realizado × referência</h3></div>'+
        '<div class="graf" id="gOrc" style="height:360px"></div><div class="dica" id="gOrcNota"></div></div>'+
      '<div class="cartao"><div class="cabC"><h3>Já comprometido nos próximos 24 meses</h3></div>'+
        '<div class="resumoLinha" id="gCompResumo"></div>'+
        '<div class="graf" id="gComp" style="height:340px"></div><div class="dica" id="gCompNota"></div></div>'+
      '<div class="cartao"><div class="cabC"><h3>Gastos por dia da compra</h3><span class="mu" style="font-size:.78rem">'+
        (X.mes?rotuloMes(X.mes):descreverPeriodo())+'</span></div>'+
        '<div class="resumoLinha" id="gCalResumo"></div>'+
        '<div class="graf" id="gCal"></div>'+
        '<div class="dica">Pela data da compra: parcelados contam o valor total no dia em que foram comprados; '+
        'contas fixas não têm data de compra e ficam de fora.</div></div>'+
    '</div>';
  ligarChips(el,rerender);
  graficoSankey(D,pe,rerender);
  graficoArea(D,p,rerender);
  graficoOrcamento(D,pe,rerender);
  graficoComprometido(D);
  graficoCalendario(D,pe);
}

/* ---------- 5.1 sankey: fontes → total → contas → categorias ---------- */
function graficoSankey(D,pe,rerender){
  const lancs=lancsDe(D,pe);
  const porConta=new Map(), porPar=new Map(), rotulo={}, cor={};
  const no=(id,nome,c)=>{ rotulo[id]=nome; if(c) cor[id]=c; return id; };
  lancs.forEach(l=>{
    const v=valorDe(l,F), c="c:"+(l.conta_id||"nenhuma"), k="k:"+catDe(l);
    no(c,l.conta_nome||"Sem conta"); no(k,l.categoria_nome||"Sem categoria",l.categoria_cor||"#555");
    porConta.set(c,(porConta.get(c)||0)+v);
    porPar.set(c+"|"+k,(porPar.get(c+"|"+k)||0)+v);
  });
  const contas=[...porConta.entries()].filter(e=>e[1]>0.004);
  const gastos=somar(contas,e=>e[1]);
  const fora=[...porConta.entries()].filter(e=>e[1]<-0.004).map(e=>rotulo[e[0]]);
  if(gastos<=0){ $("#gSankey").innerHTML='<div class="vazio">Nenhum gasto no filtro.</div>'; return; }

  const links=[];
  const T=no("t",entradasAplicam()?"Entradas do período":"Gastos do período",COR.entradas);
  if(entradasAplicam()){
    // fontes: entradas por descrição (5 maiores + outras) e, no modo bruto, os rateios a receber
    const porDesc=new Map();
    D.entradas.forEach(e=>{ const m=mesDe(e.competencia); if(m<pe.de||m>pe.ate) return;
      const d=(e.descricao||"Entrada").trim(); porDesc.set(d,(porDesc.get(d)||0)+(Number(e.valor)||0)); });
    const fontes=[...porDesc.entries()].filter(e=>e[1]>0.004).sort((a,b)=>b[1]-a[1]);
    const top=fontes.slice(0,5), resto=somar(fontes.slice(5),e=>e[1]);
    top.forEach(([d,v])=>links.push({source:no("f:"+d,d,COR.entradas),target:T,value:v}));
    if(resto>0.004) links.push({source:no("f:outras","Outras entradas",COR.entradas),target:T,value:resto});
    if(!F.liquido){ const rat=somar(lancs,l=>Number(l.valor_rateado)||0);
      if(rat>0.004) links.push({source:no("f:rateio","Rateios a receber",COR.entradas),target:T,value:rat}); }
    const entradas=somar(links,x=>x.value);
    if(entradas>gastos+0.004) links.push({source:T,target:no("sobra","Sobra",COR.saldo),value:entradas-gastos});
    if(gastos>entradas+0.004) links.push({source:no("deficit","Déficit (gastou mais do que entrou)",COR.gastos),target:T,value:gastos-entradas});
  }
  contas.forEach(([c,v])=>links.push({source:T,target:c,value:v}));
  porPar.forEach((v,par)=>{ const [c,k]=par.split("|"); if(v>0.004&&porConta.get(c)>0.004) links.push({source:c,target:k,value:v}); });

  const usados=new Set(links.flatMap(l=>[l.source,l.target]));
  const nos=[...usados].map(id=>({name:id,itemStyle:{color:cor[id]||"#8B909C",borderColor:COR.s1}}));
  $("#gSankeyNota").textContent=(X.categoria?"":"Clique numa categoria para filtrar. ")+
    (fora.length?"Fora do gráfico (saldo negativo no período): "+fora.join(", ")+".":"");

  grafico($("#gSankey"),{
    tooltip:{trigger:"item",formatter:i=>i.dataType==="edge"
      ?esc(rotulo[i.data.source])+" → "+esc(rotulo[i.data.target])+"<br><b>"+brl(i.data.value)+"</b>"
      :esc(rotulo[i.name])+"<br><b>"+brl(i.value)+"</b>"},
    series:[{type:"sankey",left:4,right:150,top:8,bottom:8,nodeGap:10,nodeWidth:12,
      nodeAlign:"justify",layoutIterations:64,draggable:false,
      emphasis:{focus:"adjacency"},
      label:{color:COR.tx,fontSize:12,formatter:i=>rotulo[i.name]+"  "+brlCurto(i.value)},
      lineStyle:{color:"source",opacity:.28,curveness:.5},
      data:nos,links}]},
    ev=>{ if(ev.dataType==="node"&&ev.name.startsWith("k:")) alternarCategoria(ev.name.slice(2),rerender); });
}

/* ---------- 5.3 área empilhada por categoria ---------- */
function graficoArea(D,p,rerender){
  const meses=mesesEntre(p.de,p.ate), idx=Object.fromEntries(meses.map((m,i)=>[m,i]));
  const porCat=new Map();
  lancsDe(D,p,{semCategoriaX:true}).forEach(l=>{
    const k=catDe(l); if(!porCat.has(k)) porCat.set(k,meses.map(()=>0));
    porCat.get(k)[idx[mesDe(l.competencia)]]+=valorDe(l,F);
  });
  const total=v=>somar(v,x=>Math.max(0,x));
  const ordem=[...porCat.entries()].filter(e=>total(e[1])>0.004).sort((a,b)=>total(b[1])-total(a[1]));
  if(!ordem.length){ $("#gArea").innerHTML='<div class="vazio">Nenhum gasto no filtro.</div>'; return; }
  const nomeadas=ordem.slice(0,MAX_CAT_AREA), resto=ordem.slice(MAX_CAT_AREA);
  const serie=(nome,cor,vals,id)=>({name:nome,type:"line",stack:"total",smooth:false,symbol:"none",
    lineStyle:{width:1.5,color:COR.s1},itemStyle:{color:cor},
    areaStyle:{color:cor,opacity:X.categoria&&X.categoria!==id?.25:.92},
    emphasis:{focus:"series"},data:vals.map(v=>+Math.max(0,v).toFixed(2)),id});
  const series=nomeadas.map(([k,v])=>serie(nomeCat(D,k),corCat(D,k),v,k));
  if(resto.length) series.push(serie("Outras",OUTRAS,meses.map((_,i)=>somar(resto,e=>Math.max(0,e[1][i]))),"outras"));
  grafico($("#gArea"),{
    grid:{left:8,right:12,top:56,bottom:8,containLabel:true},
    legend:{type:"scroll",top:0,left:0,right:0,textStyle:{color:COR.tx},itemWidth:12,itemHeight:10,
      pageIconColor:COR.mu,pageTextStyle:{color:COR.mu}},
    tooltip:{trigger:"axis",order:"valueDesc",valueFormatter:v=>brl(v)},
    xAxis:{type:"category",boundaryGap:false,data:meses.map(rotuloMes),axisLine:{lineStyle:{color:COR.bd}},
      axisTick:{show:false},axisLabel:{color:COR.mu}},
    yAxis:{type:"value",axisLabel:{color:COR.mu,formatter:brlCurto},splitLine:{lineStyle:{color:COR.bd}}},
    series},
    ev=>{ if(ev.componentType==="series"&&ev.seriesId&&ev.seriesId!=="outras") alternarCategoria(ev.seriesId,rerender); })
  .then(g=>cliqueNoMes(g,meses,k=>{ X.mes=X.mes===k?null:k; rerender(); }));
}

/* ---------- 5.2 realizado × referência (orçamento, senão média dos 6 meses anteriores) ---------- */
function graficoOrcamento(D,pe,rerender){
  const meses=mesesEntre(pe.de,pe.ate), naJanela=new Set(meses);
  const lancs=lancsDe(D,pe,{semCategoriaX:true});
  const realPorCatMes=new Map();
  lancs.forEach(l=>{ const k=catDe(l)+"|"+mesDe(l.competencia); realPorCatMes.set(k,(realPorCatMes.get(k)||0)+valorDe(l,F)); });
  const cats=[...new Set(lancs.map(catDe))];

  // média histórica: os 6 meses anteriores ao período
  const hist={de:somaMeses(pe.de,-MESES_MEDIA),ate:somaMeses(pe.de,-1)};
  const histPorCat=new Map();
  lancsDe(D,hist,{semCategoriaX:true}).forEach(l=>histPorCat.set(catDe(l),(histPorCat.get(catDe(l))||0)+valorDe(l,F)));

  const linhas=cats.map(k=>{
    const orc=D.orcamento.filter(o=>o.categoria_id===k&&naJanela.has(mesDe(o.competencia))&&o.valor_esperado!=null);
    let ref,real,tipo;
    if(orc.length){                       // compara só os meses que têm orçamento
      const comOrc=new Set(orc.map(o=>mesDe(o.competencia)));
      ref=somar(orc,o=>+o.valor_esperado); tipo="orçamento";
      real=somar([...comOrc],m=>realPorCatMes.get(k+"|"+m)||0);
    } else {
      ref=(histPorCat.get(k)||0)/MESES_MEDIA*meses.length; tipo="média de "+MESES_MEDIA+" meses";
      real=somar(meses,m=>realPorCatMes.get(k+"|"+m)||0);
    }
    return {id:k,nome:nomeCat(D,k),real,ref,tipo};
  }).filter(r=>r.real>0.004||r.ref>0.004).sort((a,b)=>b.real-a.real).slice(0,MAX_CAT_ORC).reverse();

  const usaOrc=linhas.some(r=>r.tipo==="orçamento"), usaMedia=linhas.some(r=>r.tipo!=="orçamento");
  $("#gOrcNota").textContent="Referência: "+(usaOrc&&usaMedia?"orçamento quando a categoria tem um; senão, ":usaOrc?"orçamento definido no app.":"")+
    (usaMedia?"média da categoria nos "+MESES_MEDIA+" meses anteriores ao período ("+rotuloMes(hist.de)+" a "+rotuloMes(hist.ate)+")"+
      (meses.length>1?", vezes "+meses.length+" meses":"")+".":"")+" Clique para filtrar.";
  if(!linhas.length){ $("#gOrc").innerHTML='<div class="vazio">Nenhum gasto no filtro.</div>'; return; }

  const acima=r=>r.ref>0.004&&r.real>r.ref+0.004;
  grafico($("#gOrc"),{
    grid:{left:8,right:56,top:28,bottom:8,containLabel:true},
    legend:{top:0,right:0,textStyle:{color:COR.tx},itemWidth:12,itemHeight:10,
      data:[{name:"Realizado"},{name:"Acima da referência"},{name:"Referência",icon:"rect"}]},
    tooltip:{trigger:"axis",axisPointer:{type:"shadow",shadowStyle:{color:"#ffffff0d"}},
      formatter:ps=>{ const r=linhas[ps[0].dataIndex], dif=r.real-r.ref;
        return "<b>"+esc(r.nome)+"</b><br>Realizado: "+brl(r.real)+"<br>Referência ("+r.tipo+"): "+brl(r.ref)+
          (r.ref>0.004?"<br>"+(dif>0?"Acima":"Abaixo")+": "+brl(Math.abs(dif))+" ("+pct(Math.abs(dif)/r.ref)+")":""); }},
    xAxis:{type:"value",splitNumber:3,axisLabel:{color:COR.mu,formatter:brlCurto,hideOverlap:true},splitLine:{lineStyle:{color:COR.bd}}},
    yAxis:{type:"category",data:linhas.map(r=>r.nome),axisLine:{lineStyle:{color:COR.bd}},axisTick:{show:false},
      axisLabel:{color:COR.tx,width:110,overflow:"truncate"}},
    series:[
      {name:"Realizado",type:"bar",stack:"r",barMaxWidth:14,itemStyle:{color:COR.entradas,borderRadius:[0,4,4,0]},
        data:linhas.map(r=>acima(r)?null:{value:+r.real.toFixed(2),itemStyle:{opacity:X.categoria&&X.categoria!==r.id?.3:1}})},
      {name:"Acima da referência",type:"bar",stack:"r",barMaxWidth:14,itemStyle:{color:COR.gastos,borderRadius:[0,4,4,0]},
        label:{show:true,position:"right",color:COR.tx,fontSize:11,formatter:i=>{ const r=linhas[i.dataIndex];
          return "+"+pct((r.real-r.ref)/r.ref); }},
        data:linhas.map(r=>acima(r)?{value:+r.real.toFixed(2),itemStyle:{opacity:X.categoria&&X.categoria!==r.id?.3:1}}:null)},
      {name:"Referência",type:"scatter",symbol:"rect",symbolSize:[3,20],z:5,itemStyle:{color:COR.tx},
        data:linhas.map(r=>r.ref>0.004?+r.ref.toFixed(2):null)}]},
    ev=>{ const r=linhas[ev.dataIndex]; if(r) alternarCategoria(r.id,rerender); });
}

/* ---------- 5.4 comprometido nos próximos 24 meses ---------- */
function graficoComprometido(D){
  const ini=somaMeses(mesAtual(),1), fim=somaMeses(ini,23), meses=mesesEntre(ini,fim);
  const idx=Object.fromEntries(meses.map((m,i)=>[m,i]));
  const tipos=[["parcelado","Parcelas",COR.entradas],["fixo","Contas fixas",COR.gastos],["avista","À vista",COR.saldo]];
  const val=Object.fromEntries(tipos.map(t=>[t[0],meses.map(()=>0)]));
  const rateioMes=meses.map(()=>0);
  lancsDe(D,{de:ini,ate:fim}).forEach(l=>{ const i=idx[mesDe(l.competencia)];
    (val[l.origem]||val.avista)[i]+=valorDe(l,F); rateioMes[i]+=Number(l.valor_rateado)||0; });
  const total=meses.map((_,i)=>somar(tipos,t=>val[t[0]][i]));

  // renda de referência: entradas já cadastradas para o mês; sem nenhuma, a média dos 6 meses até o atual.
  // No modo bruto soma os rateios a receber, como no saldo do app.
  let renda=null, usouMedia=meses.map(()=>false), media=null;
  if(entradasAplicam()){
    const entMes=new Map(); D.entradas.forEach(e=>{ const m=mesDe(e.competencia); entMes.set(m,(entMes.get(m)||0)+(Number(e.valor)||0)); });
    const jan={de:somaMeses(mesAtual(),-(MESES_MEDIA-1)),ate:mesAtual()};
    const ratHist=F.liquido?0:somar(lancsDe(D,jan),l=>Number(l.valor_rateado)||0);
    media=(somar(mesesEntre(jan.de,jan.ate),m=>entMes.get(m)||0)+ratHist)/MESES_MEDIA;
    renda=meses.map((m,i)=>{ if(entMes.has(m)) return entMes.get(m)+(F.liquido?0:rateioMes[i]);
      usouMedia[i]=true; return media; });
  }

  const pico=total.reduce((b,v,i)=>v>total[b]?i:b,0);
  const somaN=n=>somar(total.slice(0,n),v=>v);
  $("#gCompResumo").innerHTML=
    '<span>Próximos 3 meses: <b>'+brl(somaN(3))+'</b></span><span>12 meses: <b>'+brl(somaN(12))+'</b></span>'+
    '<span>24 meses: <b>'+brl(somaN(24))+'</b></span>'+
    (total[pico]>0?'<span>Mês mais comprometido: <b>'+rotuloMes(meses[pico])+'</b> ('+brl(total[pico])+
      (renda?", "+pct(total[pico]/renda[pico])+" da renda":"")+')</span>':"");
  $("#gCompNota").textContent=renda
    ?"Renda de referência: entradas já cadastradas para cada mês"+(F.liquido?"":" mais rateios a receber")+
      "; meses sem nenhuma entrada usam a média dos últimos "+MESES_MEDIA+" meses ("+brl(media)+", ponto vazado)."
    :"Sem renda de referência com filtro de categoria, conta ou pessoa.";
  if(!total.some(v=>v>0.004)){ $("#gComp").innerHTML='<div class="vazio">Nada lançado à frente no filtro.</div>'; return; }

  const series=tipos.map(([k,nome,cor],j)=>({name:nome,type:"bar",stack:"c",barMaxWidth:22,
    itemStyle:{color:cor,borderRadius:j===tipos.length-1?[4,4,0,0]:0,borderColor:COR.s1,borderWidth:1},
    data:val[k].map(v=>+v.toFixed(2))}));
  if(renda) series.push({name:"Renda de referência",type:"line",step:false,symbolSize:8,lineStyle:{width:2,color:COR.tx,type:"dashed"},
    itemStyle:{color:COR.tx},
    data:renda.map((v,i)=>({value:+v.toFixed(2),itemStyle:usouMedia[i]?{color:COR.s1,borderColor:COR.tx,borderWidth:2}:{}}))});
  grafico($("#gComp"),{
    grid:{left:8,right:16,top:36,bottom:8,containLabel:true},
    legend:{top:0,right:0,textStyle:{color:COR.tx},itemWidth:14,itemHeight:10},
    tooltip:{trigger:"axis",axisPointer:{type:"shadow",shadowStyle:{color:"#ffffff0d"}},
      formatter:ps=>{ const i=ps[0].dataIndex;
        return "<b>"+MESES[+meses[i].slice(5,7)-1]+" "+meses[i].slice(0,4)+"</b><br>"+
          tipos.map(t=>t[1]+": "+brl(val[t[0]][i])).join("<br>")+"<br><b>Total: "+brl(total[i])+"</b>"+
          (renda?"<br>Renda"+(usouMedia[i]?" (média)":"")+": "+brl(renda[i])+"<br><b>"+pct(total[i]/renda[i])+" comprometido</b>":""); }},
    xAxis:{type:"category",data:meses.map(rotuloMes),axisLine:{lineStyle:{color:COR.bd}},axisTick:{show:false},axisLabel:{color:COR.mu}},
    yAxis:{type:"value",axisLabel:{color:COR.mu,formatter:brlCurto},splitLine:{lineStyle:{color:COR.bd}}},
    series});
}

/* ---------- 5.5 calendário: gasto por dia da compra ---------- */
function graficoCalendario(D,pe){
  const ini=pe.de+"-01", ultimo=new Date(Date.UTC(+pe.ate.slice(0,4),+pe.ate.slice(5,7),0)).toISOString().slice(0,10);
  // sem recorte de competência: cada parcela guarda a data da compra original, então somar todas
  // as parcelas dá o valor total da compra no dia em que ela foi feita
  const todos=filtrarLanc(D,F,{de:"0000-00",ate:"9999-99"}).filter(l=>!X.categoria||catDe(l)===X.categoria);
  const dia=new Map(), compras=new Map();
  todos.forEach(l=>{ const d=l.data_compra; if(!d||d<ini||d>ultimo) return;
    dia.set(d,(dia.get(d)||0)+valorDe(l,F));
    (compras.get(d)||compras.set(d,new Set()).get(d)).add(l.compra_id||l.id); });
  const vals=[...dia.values()].filter(v=>v>0).sort((a,b)=>a-b);
  if(!vals.length){ $("#gCal").innerHTML='<div class="vazio">Nenhuma compra com data no período.</div>';
    $("#gCalResumo").innerHTML=""; return; }
  const teto=vals[Math.floor(vals.length*.95)]||vals[vals.length-1];

  // resumo: dia mais caro e média por dia da semana
  const [dMax,vMax]=[...dia.entries()].reduce((a,b)=>b[1]>a[1]?b:a);
  const semana=["dom","seg","ter","qua","qui","sex","sáb"], porDow=semana.map(()=>0);
  dia.forEach((v,d)=>porDow[new Date(d+"T12:00:00").getDay()]+=v);
  const dowMax=porDow.reduce((b,v,i)=>v>porDow[b]?i:b,0);
  const fmt=d=>d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4);
  $("#gCalResumo").innerHTML='<span>Dia mais caro: <b>'+fmt(dMax)+'</b> ('+brl(vMax)+')</span>'+
    '<span>Dia da semana com mais gastos: <b>'+semana[dowMax]+'</b> ('+pct(porDow[dowMax]/somar(porDow,v=>v))+' do total)</span>'+
    '<span>'+dia.size+' dias com compras</span>';

  // um calendário por ano do período
  const anos=[]; for(let a=+ini.slice(0,4);a<=+ultimo.slice(0,4);a++) anos.push(a);
  const ALT=150, ESQ=40;
  $("#gCal").style.height=(anos.length*ALT+44)+"px";
  const faixas=anos.map(a=>[a===+ini.slice(0,4)?ini:a+"-01-01",a===+ultimo.slice(0,4)?ultimo:a+"-12-31"]);
  // mesma largura de célula em todos os anos (um ano com só um mês não estica)
  const semanas=faixas.map(([d1,d2])=>Math.ceil(((Date.parse(d2)-Date.parse(d1))/864e5+1+new Date(d1+"T12:00:00").getDay())/7));
  const cel=Math.max(8,Math.min(22,Math.floor(($("#gCal").clientWidth-ESQ-16)/Math.max(...semanas))));
  const calendarios=anos.map((a,i)=>({top:44+i*ALT,left:ESQ,cellSize:[cel,15],
    range:faixas[i],
    itemStyle:{color:COR.s2,borderColor:COR.s1,borderWidth:2},splitLine:{lineStyle:{color:COR.bd,width:1}},
    dayLabel:{firstDay:0,nameMap:["D","S","T","Q","Q","S","S"],color:COR.mu,fontSize:10},
    monthLabel:{nameMap:MESES.map(m=>m.slice(0,3)),color:COR.mu},
    yearLabel:{show:anos.length>1,color:COR.mu,position:"left",margin:24}}));
  const dados=[...dia.entries()].map(([d,v])=>[d,+Math.max(0,v).toFixed(2),+v.toFixed(2)]);
  grafico($("#gCal"),{
    tooltip:{formatter:i=>{ const d=i.value[0], dt=new Date(d+"T12:00:00");
      return "<b>"+fmt(d)+"</b> ("+semana[dt.getDay()]+")<br>"+brl(i.value[2])+" · "+compras.get(d).size+
        " compra"+(compras.get(d).size===1?"":"s"); }},
    visualMap:{type:"continuous",dimension:1,min:0,max:+teto.toFixed(2),calculable:false,orient:"horizontal",right:16,top:0,
      itemWidth:10,itemHeight:140,text:["mais","menos"],textStyle:{color:COR.mu},
      inRange:{color:["#2b2547","#4a3a96","#7C5CFF","#c9b8ff"]},formatter:v=>brlCurto(v)},
    calendar:calendarios,
    series:anos.map((a,i)=>({type:"heatmap",coordinateSystem:"calendar",calendarIndex:i,
      data:dados.filter(x=>+x[0].slice(0,4)===a)}))});
}
