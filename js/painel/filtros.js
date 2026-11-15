import {$, esc} from "../util.js";
import {MESES} from "../estado.js";

/* Filtros globais do painel. A última escolha fica no localStorage deste navegador. */
const CHAVE="painel.filtros";
const PADRAO={periodo:"12m",de:"",ate:"",categoria:"",conta:"",pessoa:"",
  liquido:false,regime:"comp",debito:false};
const PERIODOS=[["mes","Mês atual"],["3m","Últimos 3 meses"],["6m","Últimos 6 meses"],
  ["12m","Últimos 12 meses"],["ano","Este ano"],["custom","Personalizado"]];

function ler(){ try{ return JSON.parse(localStorage.getItem(CHAVE))||{}; }catch{ return {}; } }
function gravar(){ try{ localStorage.setItem(CHAVE,JSON.stringify(F)); }catch{} }

export const F={...PADRAO,...ler()};

/* filtro cruzado: vem de cliques nos gráficos, vale para a seção toda e não é salvo.
   categoria usa "nula" para "Sem categoria". */
export const X={mes:null,categoria:null};
export const limparX=()=>{ X.mes=null; X.categoria=null; };

const doisDig=n=>String(n).padStart(2,"0");
export function mesAtual(){ const d=new Date(); return d.getFullYear()+"-"+doisDig(d.getMonth()+1); }
function voltaMeses(mes,n){ let [a,m]=mes.split("-").map(Number); m-=n;
  while(m<1){m+=12;a--;} return a+"-"+doisDig(m); }
export const rotuloMes=k=>MESES[+k.slice(5,7)-1].slice(0,3)+"/"+k.slice(2,4);

/* {de, ate} em "AAAA-MM", inclusive. Os presets terminam no mês atual. */
export function periodo(){
  const ate=mesAtual();
  switch(F.periodo){
    case "mes": return {de:ate,ate};
    case "3m":  return {de:voltaMeses(ate,2),ate};
    case "6m":  return {de:voltaMeses(ate,5),ate};
    case "ano": return {de:ate.slice(0,4)+"-01",ate};
    case "custom":{
      const de=F.de||voltaMeses(ate,11), fim=F.ate||ate;
      return de<=fim?{de,ate:fim}:{de:fim,ate:de};
    }
    default:    return {de:voltaMeses(ate,11),ate};
  }
}

/* período anterior de mesmo tamanho (para as variações dos KPIs) */
export function periodoAnterior({de,ate}){
  const [a1,m1]=de.split("-").map(Number), [a2,m2]=ate.split("-").map(Number);
  const n=(a2-a1)*12+(m2-m1)+1;
  return {de:voltaMeses(de,n),ate:voltaMeses(de,1)};
}

export function descreverPeriodo(){
  const {de,ate}=periodo();
  return de===ate?rotuloMes(de):rotuloMes(de)+" a "+rotuloMes(ate);
}

/* monta a faixa de filtros; aoMudar() é chamado a cada alteração */
export function montarFiltros(D,aoMudar){
  // descarta filtros que apontam para cadastros que não existem mais
  if(F.categoria&&!D.categorias.some(c=>c.id===F.categoria)) F.categoria="";
  if(F.conta&&!D.contas.some(c=>c.id===F.conta)) F.conta="";
  if(F.pessoa&&!D.pessoas.some(p=>p.id===F.pessoa)) F.pessoa="";

  const opc=(lista,sel,rot)=>'<option value="">'+rot+'</option>'+lista.map(x=>
    '<option value="'+x.id+'"'+(x.id===sel?" selected":"")+'>'+esc(x.nome)+(x.ativo===false?" (inativa)":"")+'</option>').join("");
  const seg=(id,ops,val)=>'<div class="seg" id="'+id+'">'+ops.map(o=>
    '<button type="button" data-v="'+o[0]+'"'+(o[0]===val?' class="on"':"")+'>'+o[1]+'</button>').join("")+'</div>';
  const {de,ate}=periodo();

  $("#filtros").innerHTML=
    '<label class="campo"><span>Período</span><select class="inp" id="fPer">'+
      PERIODOS.map(p=>'<option value="'+p[0]+'"'+(p[0]===F.periodo?" selected":"")+'>'+p[1]+'</option>').join("")+
    '</select></label>'+
    (F.periodo==="custom"?
      '<label class="campo"><span>De</span><input class="inp" type="month" id="fDe" value="'+de+'"></label>'+
      '<label class="campo"><span>Até</span><input class="inp" type="month" id="fAte" value="'+ate+'"></label>':"")+
    '<label class="campo"><span>Categoria</span><select class="inp" id="fCat">'+opc(D.categorias,F.categoria,"Todas")+'</select></label>'+
    '<label class="campo"><span>Conta / cartão</span><select class="inp" id="fConta">'+opc(D.contas,F.conta,"Todas")+'</select></label>'+
    '<label class="campo"><span>Pessoa (rateio)</span><select class="inp" id="fPessoa">'+opc(D.pessoas,F.pessoa,"Todas")+'</select></label>'+
    '<div class="grupoF"><span>Valor</span>'+seg("fLiq",[["bruto","Bruto"],["liquido","Líquido"]],F.liquido?"liquido":"bruto")+'</div>'+
    '<div class="grupoF"><span title="Caixa vale só para os KPIs e a evolução mensal">Regime</span>'+
      seg("fReg",[["comp","Competência"],["caixa","Caixa"]],F.regime)+'</div>'+
    '<label class="sw">Incluir débito<input type="checkbox" id="fDeb"'+(F.debito?" checked":"")+'></label>'+
    '<button type="button" class="limpar" id="fLimpar">Limpar filtros</button>';

  const muda=(campo,v)=>{ F[campo]=v; gravar(); montarFiltros(D,aoMudar); aoMudar(); };
  $("#fPer").onchange=e=>{
    if(e.target.value==="custom"&&!F.de){ const p=periodo(); F.de=p.de; F.ate=p.ate; }
    muda("periodo",e.target.value);
  };
  if($("#fDe")){
    $("#fDe").onchange=e=>e.target.value&&muda("de",e.target.value);
    $("#fAte").onchange=e=>e.target.value&&muda("ate",e.target.value);
  }
  $("#fCat").onchange=e=>muda("categoria",e.target.value);
  $("#fConta").onchange=e=>muda("conta",e.target.value);
  $("#fPessoa").onchange=e=>muda("pessoa",e.target.value);
  $("#fLiq").querySelectorAll("button").forEach(b=>b.onclick=()=>muda("liquido",b.dataset.v==="liquido"));
  $("#fReg").querySelectorAll("button").forEach(b=>b.onclick=()=>muda("regime",b.dataset.v));
  $("#fDeb").onchange=e=>muda("debito",e.target.checked);
  $("#fLimpar").onclick=()=>{ Object.assign(F,PADRAO); gravar(); montarFiltros(D,aoMudar); aoMudar(); };
}
