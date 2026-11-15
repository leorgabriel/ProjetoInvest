/* 6.5 Exportação em CSV para o Excel em português: separador ";", vírgula decimal,
   BOM UTF-8 (acentos corretos) e quebras de linha CRLF. Sem biblioteca externa. */

const numBR=v=>{ const n=Number(v); return isFinite(n)?n.toFixed(2).replace(".",","):""; };
const dataBR=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
const compBR=d=>d?d.slice(5,7)+"/"+d.slice(0,4):"";

/* texto: aspas quando precisa; prefixa ' em =,+,-,@ para o Excel não tratar como fórmula */
function txt(v){
  let s=String(v??"");
  if(/^[=+\-@\t\r]/.test(s)) s="'"+s;
  return /[";\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}

export function csvLancamentos(linhas,anom){
  const cab=["Competência","Data da compra","Descrição","Parcela","Categoria","Conta","Tipo",
    "Valor","Valor líquido","Fora do padrão"];
  const tipo={avista:"À vista",parcelado:"Parcelado",fixo:"Conta fixa"};
  const corpo=linhas.map(l=>[
    compBR(l.competencia), dataBR(l.data_compra), txt(l.descricao),
    l.parcela_num?l.parcela_num+(l.parcelas_total?"/"+l.parcelas_total:""):"",
    txt(l.categoria_nome||"Sem categoria"), txt(l.conta_nome||""), tipo[l.origem]||txt(l.origem),
    numBR(l.valor), numBR(l.valor_liquido), anom&&anom.has(l.id)?"Sim":""
  ].join(";"));
  return "﻿"+[cab.join(";"),...corpo].join("\r\n")+"\r\n";
}

export function baixar(nome,conteudo){
  const url=URL.createObjectURL(new Blob([conteudo],{type:"text/csv;charset=utf-8"}));
  const a=Object.assign(document.createElement("a"),{href:url,download:nome});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
