/* ECharts, carregado sob demanda (só o painel usa). Versão fixa. */
const URL_ECHARTS="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.esm.min.js";
let echartsP=null;
const carregarEcharts=()=>echartsP||(echartsP=import(URL_ECHARTS));

/* cores: as do app (:root de estilo.css) + séries validadas para o fundo escuro
   (azul, laranja, verde-água: passam nas checagens de daltonismo e contraste) */
export const COR={tx:"#ECEDF0",mu:"#8B909C",bd:"#272A33",s1:"#131419",s2:"#1C1E26",
  entradas:"#3987e5",gastos:"#d95926",saldo:"#199e70"};

const BASE={
  backgroundColor:"transparent",
  textStyle:{color:COR.mu,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'},
  animationDuration:300,
  tooltip:{backgroundColor:COR.s2,borderColor:COR.bd,textStyle:{color:COR.tx,fontSize:12},
    extraCssText:"border-radius:10px;box-shadow:0 8px 24px #0008"}};

/* valor curto para eixos: R$ 1,2 mil / R$ 3 mi */
export function brlCurto(v){
  const a=Math.abs(v), s=v<0?"-":"";
  if(a>=1e6) return s+"R$ "+(a/1e6).toLocaleString("pt-BR",{maximumFractionDigits:1})+" mi";
  if(a>=1e3) return s+"R$ "+(a/1e3).toLocaleString("pt-BR",{maximumFractionDigits:1})+" mil";
  return s+"R$ "+a.toLocaleString("pt-BR",{maximumFractionDigits:0});
}

let ativos=[];
/* descarta os gráficos da renderização anterior (o HTML é recriado a cada mudança) */
export function limparGraficos(){ ativos.forEach(g=>g.dispose()); ativos=[]; }
window.addEventListener("resize",()=>ativos.forEach(g=>g.resize()));

/* cria um gráfico em el; aoClicar(params) recebe o clique numa marca */
export async function grafico(el,opcao,aoClicar){
  if(!el) return null;
  let echarts;
  try{ echarts=await carregarEcharts(); }
  catch(e){ el.innerHTML='<div class="vazio er">Não foi possível carregar a biblioteca de gráficos.</div>'; return null; }
  if(!el.isConnected) return null;              // a tela mudou enquanto carregava
  const g=echarts.init(el,null,{renderer:"canvas"});
  g.setOption({...BASE,...opcao,tooltip:{...BASE.tooltip,...(opcao.tooltip||{})}});
  if(aoClicar) g.on("click",aoClicar);
  ativos.push(g);
  return g;
}
