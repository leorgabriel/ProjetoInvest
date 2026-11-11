import {sb} from "./supabase-client.js";
import {MESES, S} from "./estado.js";
import {$, esc, brl} from "./util.js";

/* ---------------- tela: ano ---------------- */
export async function telaAno(){
  const [r,pf,cp]=await Promise.all([
    sb.from("v_resumo_mes").select("*").gte("competencia",S.ano+"-01-01")
      .lte("competencia",S.ano+"-12-01").order("competencia"),
    sb.from("v_parcelas_futuras").select("*").order("competencia").limit(200),
    sb.from("v_comprometido").select("*").order("competencia").limit(24)]);
  const ms=r.data||[];
  const tot=ms.reduce((a,m)=>({e:a.e+ +m.entradas_total,g:a.g+ +m.gastos_bruto,
    gl:a.gl+ +m.gastos_liquido,s:a.s+ +m.saldo}),{e:0,g:0,gl:0,s:0});

  const maxGasto=Math.max(1,...ms.map(m=>+m.gastos_bruto));
  let h='<div class="hero" style="margin-top:16px"><div class="lbl"><span>Gastos por mês em '+S.ano+'</span></div>'+
    '<div class="graf" id="anoGraf">'+ms.map(m=>{
      const i=+m.competencia.slice(5,7)-1;
      const alt=Math.max(3,Math.round(+m.gastos_bruto/maxGasto*120));
      return '<button type="button" class="col'+(i===S.mes?" at":"")+'" data-i="'+i+'" data-v="'+m.gastos_bruto+'">'+
        '<span class="barraM" style="height:'+alt+'px"></span><span class="lbl">'+MESES[i].slice(0,3)+'</span></button>';
    }).join("")+'</div>'+
    '<div class="grafCap" id="anoGrafCap">Toque em um mês para ver o valor.</div></div>';

  const comGasto=ms.filter(m=>+m.gastos_bruto>0);
  if(comGasto.length){
    const pior=comGasto.reduce((a,m)=>+m.gastos_bruto>+a.gastos_bruto?m:a);
    const cat=await sb.from("v_gastos_categoria").select("categoria,valor_bruto")
      .gte("competencia",S.ano+"-01-01").lte("competencia",S.ano+"-12-01");
    const porCat={};
    (cat.data||[]).forEach(x=>porCat[x.categoria]=(porCat[x.categoria]||0)+ +x.valor_bruto);
    const top=Object.entries(porCat).sort((a,b)=>b[1]-a[1])[0];
    h+='<h2>Fechamento do ano</h2><div class="kpis" style="margin-top:0">'+
      '<div class="kpi"><small>Média mensal de gastos</small><b>'+brl(tot.g/comGasto.length)+'</b></div>'+
      '<div class="kpi"><small>Total gasto no ano</small><b>'+brl(tot.gl)+'</b></div>'+
      '<div class="kpi"><small>Mês mais caro</small><b>'+MESES[+pior.competencia.slice(5,7)-1]+'</b>'+
      '<small style="margin-top:2px">'+brl(pior.gastos_bruto)+'</small></div>'+
      (top?'<div class="kpi"><small>Maior categoria</small><b>'+esc(top[0])+'</b>'+
      '<small style="margin-top:2px">'+brl(top[1])+'</small></div>':'')+'</div>';
  }

  h+='<h2>Mês a mês</h2><div class="lista" style="padding:4px 14px 10px"><table>'+
    "<tr><th>Mês</th><th>Entradas</th><th>Gastos</th><th>Saldo</th></tr>"+
    ms.map(m=>{const i=+m.competencia.slice(5,7)-1;
      return "<tr"+(i===S.mes?' class="at"':"")+"><td>"+MESES[i].slice(0,3)+"</td><td>"+brl(m.entradas_total)+
        "</td><td>"+brl(m.gastos_bruto)+'</td><td class="'+(m.saldo<0?"er":"ok")+'">'+brl(m.saldo)+"</td></tr>";
    }).join("")+"</table></div>";

  const cps=cp.data||[];
  if(cps.length){
    h+='<h2>Já comprometido à frente</h2><div class="mu" style="font-size:.76rem;margin:-4px 0 8px">'+
      'Parcelas e contas fixas já lançadas nos próximos meses — antes de qualquer gasto novo.</div>'+
      '<div class="lista" style="padding:4px 14px 10px"><table>'+
      '<tr><th>Mês</th><th>Parcelas</th><th>Fixos</th><th>Total</th></tr>'+
      cps.map(m=>'<tr><td>'+MESES[+m.competencia.slice(5,7)-1].slice(0,3)+"/"+m.competencia.slice(2,4)+
        '</td><td>'+brl(m.parcelas)+'</td><td>'+brl(m.fixos)+'</td><td><b>'+brl(m.total)+
        '</b></td></tr>').join("")+'</table></div>';
  }

  const fut={}; (pf.data||[]).forEach(p=>{(fut[p.competencia]=fut[p.competencia]||[]).push(p);});
  const chaves=Object.keys(fut).sort();
  h+="<h2>Parcelas futuras</h2>";
  if(!chaves.length) h+='<div class="lista"><div class="vazio">Nenhuma parcela à frente.</div></div>';
  else h+=chaves.map(k=>{const its=fut[k],s=its.reduce((a,b)=>a+ +b.valor,0);
    return '<details class="lista" style="margin-bottom:8px"><summary style="padding:13px 14px;display:flex;'+
      'justify-content:space-between;cursor:pointer;list-style:none"><span>'+
      MESES[+k.slice(5,7)-1]+"/"+k.slice(2,4)+' <span class="mu">('+its.length+")</span></span><b>"+brl(s)+"</b></summary>"+
      its.map(i=>'<div class="item"><span class="dot"></span><span class="ct"><span class="nm">'+
        esc(i.descricao)+'<span class="bdg">'+i.parcela_num+"/"+i.parcelas_total+'</span></span>'+
        '<span class="mt">'+esc(i.conta||"")+'</span></span><span class="vl">'+brl(i.valor)+
        "</span></div>").join("")+"</details>";}).join("");
  h+='<div style="height:30px"></div>';
  $("#t-ano").innerHTML=h;

  const graf=$("#anoGraf"), cap=$("#anoGrafCap");
  if(graf) graf.querySelectorAll(".col").forEach(b=>b.onclick=()=>{
    graf.querySelectorAll(".col").forEach(o=>o.classList.toggle("sel",o===b));
    cap.textContent=MESES[+b.dataset.i]+": "+brl(+b.dataset.v)+" em gastos.";
  });
}
