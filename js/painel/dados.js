import {sb} from "../supabase-client.js";

/* Busca única de tudo o que o painel usa. Os filtros recalculam no navegador, sem nova consulta.
   O PostgREST devolve no máximo 1000 linhas por vez, então cada consulta é paginada
   (com ordenação por chave única, para as páginas não se sobreporem). */
const PAGINA=1000;
async function tudo(consulta){
  const linhas=[];
  for(let de=0;;de+=PAGINA){
    const {data,error}=await consulta().range(de,de+PAGINA-1);
    if(error) throw error;
    linhas.push(...data);
    if(data.length<PAGINA) return linhas;
  }
}

const CONSULTAS={
  lanc:          ()=>sb.from("v_lancamento").select("*").order("competencia").order("id"),
  entradas:      ()=>sb.from("entrada").select("*").order("competencia").order("id"),
  resumoMes:     ()=>sb.from("v_resumo_mes").select("*").order("competencia"),
  gastosCat:     ()=>sb.from("v_gastos_categoria").select("*").order("competencia").order("categoria_id",{nullsFirst:true}),
  comprometido:  ()=>sb.from("v_comprometido").select("*").order("competencia"),
  resumoCaixa:   ()=>sb.from("v_resumo_caixa").select("*").order("mes"),
  caixaAcum:     ()=>sb.from("v_caixa_acumulado").select("*").order("mes"),
  investimentos: ()=>sb.from("v_investimento").select("*").order("ordem").order("id"),
  movInv:        ()=>sb.from("movimento_investimento").select("*").order("data").order("id"),
  aReceberPessoa:()=>sb.from("v_a_receber_pessoa").select("*").order("pessoa_id"),
  rateio:        ()=>sb.from("rateio").select("*").order("id"),
  categorias:    ()=>sb.from("categoria").select("*").order("ordem").order("nome").order("id"),
  contas:        ()=>sb.from("conta_pagamento").select("*").order("ordem").order("nome").order("id"),
  pessoas:       ()=>sb.from("pessoa").select("*").order("nome").order("id")};

export async function carregar(){
  const chaves=Object.keys(CONSULTAS);
  const res=await Promise.all(chaves.map(k=>tudo(CONSULTAS[k])));
  return Object.fromEntries(chaves.map((k,i)=>[k,res[i]]));
}

/* ---------------- agregações puras ---------------- */
export const DEBITO=new Set(["debito","dinheiro"]);
export const mesDe=d=>String(d).slice(0,7);              // "2026-11-01" -> "2026-11"
export const valorDe=(l,F)=>Number(F.liquido?l.valor_liquido:l.valor)||0;

/* lançamentos dentro do período e dos filtros de categoria, conta, pessoa e débito */
export function filtrarLanc(D,F,{de,ate}){
  const daPessoa=F.pessoa?new Set(D.rateio.filter(r=>r.pessoa_id===F.pessoa).map(r=>r.lancamento_id)):null;
  return D.lanc.filter(l=>{
    const m=mesDe(l.competencia);
    if(m<de||m>ate) return false;
    if(!F.debito&&DEBITO.has(l.conta_especie)) return false;
    if(F.categoria&&l.categoria_id!==F.categoria) return false;
    if(F.conta&&l.conta_id!==F.conta) return false;
    if(daPessoa&&!daPessoa.has(l.id)) return false;
    return true;
  });
}

/* entradas só respondem ao período e à pessoa */
export function filtrarEntradas(D,F,{de,ate}){
  return D.entradas.filter(e=>{
    const m=mesDe(e.competencia);
    return m>=de&&m<=ate&&(!F.pessoa||e.pessoa_id===F.pessoa);
  });
}

export const somar=(lista,fn)=>lista.reduce((s,x)=>s+fn(x),0);

/* agrupa e soma; devolve [[chave, total], ...] na ordem das chaves */
export function agrupar(lista,chave,valor){
  const m=new Map();
  lista.forEach(x=>{ const k=chave(x); m.set(k,(m.get(k)||0)+valor(x)); });
  return [...m.entries()].sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
}

/* lista contínua de meses "AAAA-MM" de de até ate */
export function mesesEntre(de,ate){
  const out=[]; let [a,m]=de.split("-").map(Number);
  for(;;){ const k=a+"-"+String(m).padStart(2,"0"); if(k>ate) return out; out.push(k); if(++m>12){m=1;a++;} }
}
