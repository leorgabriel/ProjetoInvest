import {esc, brl} from "../util.js";
import {rotuloMes} from "./filtros.js";
import {mesDe} from "./dados.js";
import {csvLancamentos, baixar} from "./exportar.js";

/* Tabela de lançamentos: ordenação por coluna, busca e paginação.
   O estado (ordem/busca/página) sobrevive às re-renderizações enquanto a página estiver aberta. */
const est={col:"competencia",asc:false,busca:"",pagina:1,soAnom:false};
const dataBR=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(2,4):"";
const norm=s=>String(s??"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();

const COLUNAS=[
  {k:"competencia",  t:"Competência", v:l=>l.competencia,          h:l=>rotuloMes(mesDe(l.competencia))},
  {k:"data_compra",  t:"Compra",      v:l=>l.data_compra||"",      h:l=>dataBR(l.data_compra)},
  {k:"descricao",    t:"Descrição",   v:l=>norm(l.descricao),      h:(l,ctx)=>esc(l.descricao)+
      (l.parcelas_total>1&&l.parcela_num?' <span class="bdg">'+l.parcela_num+"/"+l.parcelas_total+"</span>":"")+
      seloAnom(ctx.anom&&ctx.anom.get(l.id))},
  {k:"categoria_nome",t:"Categoria",  v:l=>norm(l.categoria_nome), h:l=>'<span class="dotT" style="background:'+
      esc(l.categoria_cor||"#555")+'"></span>'+esc(l.categoria_nome||"Sem categoria")},
  {k:"conta_nome",   t:"Conta",       v:l=>norm(l.conta_nome),     h:l=>esc(l.conta_nome||"—")},
  {k:"valor",        t:"Valor",       v:l=>+l.valor,               h:l=>brl(l.valor),         num:true},
  {k:"valor_liquido",t:"Líquido",     v:l=>+l.valor_liquido,       h:l=>brl(l.valor_liquido), num:true}];

/* selo "fora do padrão" com a explicação no title */
function seloAnom(a){
  if(!a) return "";
  return ' <span class="bdg anom" title="'+esc("Acima de média + 2 desvios da categoria nos 12 meses anteriores: média "+
    brl(a.media)+", limite "+brl(a.limite)+", base de "+a.base+" lançamentos.")+'">fora do padrão</span>';
}

/* anomalias: Map(id -> info) de anomalias.js; arquivo: nome do CSV exportado */
export function tabelaLancamentos(el,linhas,{porPagina=25,anomalias=null,arquivo="lancamentos.csv"}={}){
  if(!el) return;
  const ctx={anom:anomalias};
  const nAnom=anomalias?linhas.filter(l=>anomalias.has(l.id)).length:0;
  if(!nAnom) est.soAnom=false;
  const visiveis=()=>{
    const q=norm(est.busca).trim();
    let vis=q?linhas.filter(l=>[l.descricao,l.categoria_nome,l.conta_nome,l.observacao]
      .some(x=>norm(x).includes(q))):linhas;
    if(est.soAnom) vis=vis.filter(l=>anomalias.has(l.id));
    const col=COLUNAS.find(c=>c.k===est.col)||COLUNAS[0], s=est.asc?1:-1;
    const ord=[...vis].sort((a,b)=>{ const x=col.v(a),y=col.v(b);
      return (x<y?-1:x>y?1:0)*s || (a.data_compra||"").localeCompare(b.data_compra||"")*-1; });
    return ord;
  };
  const desenhar=()=>{
    const ord=visiveis();
    const paginas=Math.max(1,Math.ceil(ord.length/porPagina));
    est.pagina=Math.min(Math.max(1,est.pagina),paginas);
    const pag=ord.slice((est.pagina-1)*porPagina,est.pagina*porPagina);
    const total=ord.reduce((a,l)=>a+ +l.valor,0), totalLiq=ord.reduce((a,l)=>a+ +l.valor_liquido,0);

    el.querySelector("tbody").innerHTML=pag.length?pag.map(l=>"<tr>"+COLUNAS.map(c=>
      '<td class="'+(c.num?"n":"")+(c.num&&+l[c.k]<0?" ok":"")+'">'+c.h(l,ctx)+"</td>").join("")+"</tr>").join("")
      :'<tr><td colspan="'+COLUNAS.length+'" class="vazio">Nenhum lançamento.</td></tr>';
    el.querySelectorAll("th").forEach(th=>{
      th.classList.toggle("on",th.dataset.k===est.col);
      th.dataset.dir=th.dataset.k===est.col?(est.asc?"▲":"▼"):"";
    });
    el.querySelector(".tabRodape").innerHTML=
      '<span>'+ord.length+" lançamento"+(ord.length===1?"":"s")+" · "+brl(total)+
        ' <span class="mu">(líquido '+brl(totalLiq)+')</span></span>'+
      '<span class="pag"><button type="button" data-p="-1"'+(est.pagina<=1?" disabled":"")+'>‹</button>'+
        est.pagina+" / "+paginas+
        '<button type="button" data-p="1"'+(est.pagina>=paginas?" disabled":"")+'>›</button></span>';
    el.querySelectorAll(".pag button").forEach(b=>b.onclick=()=>{ est.pagina+=+b.dataset.p; desenhar(); });
  };

  el.innerHTML=
    '<div class="tabTopo"><input class="inp" type="search" placeholder="Buscar descrição, categoria, conta…" value="'+
      esc(est.busca)+'">'+
      (nAnom?'<label class="sw mini anomF">Só fora do padrão ('+nAnom+')<input type="checkbox" class="soAnom"'+
        (est.soAnom?" checked":"")+'></label>':'')+
      '<button type="button" class="chip exportar" title="Exporta o que está filtrado, todas as páginas">Exportar CSV</button></div>'+
    '<div class="tabRolo"><table class="tabL"><thead><tr>'+COLUNAS.map(c=>
      '<th data-k="'+c.k+'" class="'+(c.num?"n":"")+'">'+c.t+"</th>").join("")+
    "</tr></thead><tbody></tbody></table></div><div class=\"tabRodape\"></div>";
  el.querySelectorAll("th").forEach(th=>th.onclick=()=>{
    const k=th.dataset.k, c=COLUNAS.find(x=>x.k===k);
    // texto começa em A→Z; valores e datas começam do maior/mais recente
    if(est.col===k) est.asc=!est.asc; else { est.col=k; est.asc=!c.num&&k!=="competencia"&&k!=="data_compra"; }
    est.pagina=1; desenhar();
  });
  const busca=el.querySelector("input[type=search]");
  busca.oninput=()=>{ est.busca=busca.value; est.pagina=1; desenhar(); };
  const so=el.querySelector(".soAnom");
  if(so) so.onchange=()=>{ est.soAnom=so.checked; est.pagina=1; desenhar(); };
  el.querySelector(".exportar").onclick=()=>baixar(arquivo,csvLancamentos(visiveis(),anomalias));
  desenhar();
}
