import {sb} from "./supabase-client.js";
import {MESES, S} from "./estado.js";
import {$, esc, brl, comp, mesCorrente, hojeISO, num, toast, erro, sheet, fechar} from "./util.js";
import {telaMes, linha, ligarSwipe, sheetItem, confirmarExclusao, formHTML, formEventos} from "./mes.js";
import {abrir} from "./nav.js";

/* Débito e caixa: sub-visão da tela Mês. Nada aqui altera Mês, Ano, projeção ou orçamento. */

const SEM_FATURA=["debito","dinheiro"];
const ehDebito=especie=>SEM_FATURA.includes(especie);
export const contaEhDebito=id=>!!id && ehDebito((S.cad?.todasContas||[]).find(c=>c.id===id)?.especie);

/* seletor Mês | Débito e caixa, fora dos cards */
export function segVisao(){
  const d=S.visaoMes==="debito";
  return '<div class="seg visao"><button data-vm="mes"'+(d?"":' class="on"')+'>Mês</button>'+
    '<button data-vm="debito"'+(d?' class="on"':"")+'>Débito e caixa</button></div>';
}
export function ligarVisao(raiz){
  raiz.querySelectorAll("[data-vm]").forEach(b=>b.onclick=()=>{
    if(S.visaoMes===b.dataset.vm) return;
    S.visaoMes=b.dataset.vm; window.scrollTo({top:0}); telaMes();});
}

const mesCurto=c=>MESES[+c.slice(5,7)-1].slice(0,3).toLowerCase()+"/"+c.slice(2,4);
const v0=x=>Number(x)||0;

export async function telaDebito(){
  const c=comp(), alvo=$("#t-mes"), caixa=S.regime==="caixa";
  const temConta=(S.cad?.todasContas||[]).some(x=>ehDebito(x.especie));

  const [l,cx,pend,ac]=await Promise.all([
    sb.from("v_lancamento").select("*").eq("competencia",c).in("conta_especie",SEM_FATURA)
      .order("data_compra",{ascending:false,nullsFirst:false}).order("criado_em",{ascending:false}),
    sb.from("v_resumo_caixa").select("*").eq("mes",c).maybeSingle(),
    sb.from("v_gastos_conta").select("*").lte("competencia",c).not("especie","in","(debito,dinheiro)")
      .or("pago.is.null,pago.eq.false"),
    sb.from("v_caixa_acumulado").select("*").order("mes")
  ]);
  if(l.error) return erro(l.error);
  if(cx.error) return erro(cx.error);
  const lanc=l.data||[];
  const X=cx.data||{};
  const abertas=(pend.data||[]).filter(x=>Math.abs(v0(x.valor))>0.004);
  const totAbertas=abertas.reduce((s,x)=>s+v0(x.valor),0);

  const seg='<div class="seg"><button data-rg="comp"'+(caixa?"":' class="on"')+'>Competência</button>'+
    '<button data-rg="caixa"'+(caixa?' class="on"':"")+'>Caixa</button></div>';
  let h=segVisao();

  if(!caixa){
    const ent=-lanc.filter(x=>v0(x.valor)<0).reduce((s,x)=>s+v0(x.valor),0);
    const sai=lanc.filter(x=>v0(x.valor)>0).reduce((s,x)=>s+v0(x.valor),0);
    const res=ent-sai;
    h+='<div class="hero"><div class="lbl"><span>Débito de '+MESES[S.mes]+'</span>'+seg+'</div>'+
      '<div class="val '+(res<0?"er":res>0?"ok":"")+'">'+(res>0?"+":"")+brl(res)+'</div><div class="duo">'+
      '<div><small>Entradas</small><b class="ok">+'+brl(ent)+'</b></div>'+
      '<div><small>Saídas</small><b class="er">'+brl(sai)+'</b></div></div>'+
      '<div class="mu nota">Competência: '+lanc.length+(lanc.length===1?" lançamento":" lançamentos")+
      ' no débito com data em '+MESES[S.mes]+'. Eles não entram na tela Mês, que mostra cartões, boletos e contas.</div></div>';
  } else {
    const entrou=v0(X.entradas_recebidas)+v0(X.rateios_recebidos)+v0(X.entrada_debito);
    const A=ac.data||[], ini=A[0]?.inicio||"2026-11-01", s0=v0(A[0]?.saldo_inicial);
    const linhaA=A.find(x=>x.mes===c), antes=c<ini;
    const cart=antes?null:(linhaA?v0(linhaA.acumulado):(A.length?v0(A[A.length-1].acumulado):s0));
    const fluxo=v0(X.saldo_caixa);
    h+='<div class="hero"><div class="lbl"><span>Carteira ao fim de '+MESES[S.mes]+'</span>'+seg+'</div>'+
      (antes
        ?'<div class="val mu">—</div><div class="mu nota" style="margin:-6px 0 12px">Antes do início da carteira ('+
          mesCurto(ini)+'). Resultado do mês: <b style="color:var(--tx);white-space:nowrap">'+brl(fluxo)+'</b></div>'
        :'<div class="val '+(cart<0?"er":"")+'">'+brl(cart)+'</div>'+
          (linhaA&&Math.abs(v0(linhaA.fluxo_fora))>0.004?'<div class="mu nota" style="margin:-6px 0 12px">'+
            '<b style="color:var(--tx);white-space:nowrap">'+brl(linhaA.fluxo_fora)+'</b> pagos ou recebidos neste mês são de '+
            'antes de '+mesCurto(ini)+' e já estão no saldo inicial, por isso não entram na carteira.</div>':''))+
      '<div class="duo">'+
      '<div><small>Entrou no mês</small><b class="ok">'+brl(entrou)+'</b></div>'+
      '<div><small>Saiu no mês</small><b>'+brl(X.saidas_total)+'</b></div></div>'+
      '<div class="mu nota">Começa em '+brl(s0)+' em '+mesCurto(ini)+' e soma, mês a mês, o que foi pago ou '+
      'recebido de '+mesCurto(ini)+' em diante. '+
      '<button class="lnk" id="dIni">Mudar início</button></div></div>';
  }

  if(caixa && abertas.length){
    h+='<div class="alerta"><span class="ic">&#129534;</span><span><b>'+abertas.length+
      (abertas.length>1?" faturas em aberto":" fatura em aberto")+' até '+mesCurto(c)+' · '+brl(totAbertas)+'</b>'+
      'Não entram no caixa até serem marcadas como pagas. '+
      '<button class="lnk" id="dLote">Revisar e marcar</button></span></div>';
  }

  if(caixa){
    const linhas=[["Débito e dinheiro",X.saida_debito],["Pix e boleto",X.saida_pix_boleto],
      ["Faturas de cartão",X.saida_cartao],["Empréstimo",X.saida_emprestimo],["Sem forma de pagamento",X.saida_outros]]
      .filter(([,v])=>Math.abs(v0(v))>0.004);
    const ent=[["Entradas recebidas",X.entradas_recebidas],["Devolvido por outras pessoas",X.rateios_recebidos],
      ["Entradas no débito",X.entrada_debito]]
      .filter(([,v])=>Math.abs(v0(v))>0.004);
    const it=(n,v,cls)=>'<div class="item"><span class="ct"><span class="nm">'+n+'</span></span>'+
      '<span class="vl'+(cls?" "+cls:"")+'">'+brl(v)+'</span></div>';
    h+='<h2>Para onde foi o dinheiro</h2><div class="lista">'+
      (linhas.length||ent.length
        ? ent.map(([n,v])=>it(n,v,"ok")).join("")+linhas.map(([n,v])=>it(n,v)).join("")
        : '<div class="vazio">Nada pago nem recebido em '+MESES[S.mes]+' ainda.<br>'+
          'Marque faturas como pagas e entradas como recebidas na tela Mês.</div>')+'</div>';
  }

  h+='<h2>Movimentações no débito</h2>';
  if(!temConta){
    h+='<div class="lista"><div class="vazio">Você ainda não tem uma conta de débito.<br>'+
      'Cadastre uma em Ajustes, com espécie <b>Débito</b>, e escolha ela como forma de pagamento ao lançar.'+
      '<div style="height:12px"></div><button class="btn sec" id="dCad">Ir para Ajustes</button></div></div>';
  } else if(!lanc.length){
    h+='<div class="lista"><div class="vazio">Nenhuma movimentação no débito em'+MESES[S.mes]+'.</div></div>';
  } else {
    h+='<div class="lista">'+lanc.map(x=>linha(x,true)).join("")+'</div>';
  }
  h+='<div style="height:30px"></div>';
  alvo.innerHTML=h;

  ligarVisao(alvo);
  alvo.querySelectorAll("[data-rg]").forEach(b=>b.onclick=()=>{S.regime=b.dataset.rg;telaDebito();});
  const acha=id=>lanc.find(x=>x.id===id);
  alvo.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>sheetItem(acha(b.dataset.id)));
  ligarSwipe(alvo,id=>formEventos(sheet("Editar",formHTML(acha(id))),acha(id)),id=>confirmarExclusao(acha(id)));
  const bc=alvo.querySelector("#dCad"); if(bc) bc.onclick=()=>abrir("cadastros");
  const bl=alvo.querySelector("#dLote"); if(bl) bl.onclick=()=>sheetLote(abertas);
  const bi=alvo.querySelector("#dIni"); if(bi) bi.onclick=()=>sheetInicio(ac.data?.[0]);
}

/* marco zero da carteira */
function sheetInicio(a){
  const ini=(a?.inicio||"2026-11-01").slice(0,7), s0=v0(a?.saldo_inicial);
  const bg=sheet("Início da carteira",
    '<div class="mu" style="margin:-6px 0 14px;font-size:.82rem;line-height:1.5">A carteira parte deste mês com o '+
    'saldo informado e soma o que entrou e saiu de cada mês seguinte. Use 0 para começar do zero.</div>'+
    '<div class="linha2"><label class="campo"><span>A partir de</span><input class="inp" type="month" id="iMes" value="'+ini+'"></label>'+
    '<label class="campo"><span>Saldo inicial</span><input class="inp" id="iSaldo" inputmode="decimal" value="'+
    s0.toFixed(2).replace(".",",")+'"></label></div>'+
    '<div style="height:14px"></div><button class="btn" id="iOk">Salvar</button>');
  bg.querySelector("#iOk").onclick=async e=>{
    const mes=bg.querySelector("#iMes").value, v=num(bg.querySelector("#iSaldo").value);
    if(!mes) return toast("Escolha o mês de início.","e");
    if(isNaN(v)) return toast("Informe o saldo inicial (pode ser 0).","e");
    const btn=e.currentTarget; btn.disabled=true; btn.textContent="Salvando…";
    const {error}=await sb.from("config_usuario").upsert({caixa_inicio:mes+"-01",caixa_saldo_inicial:v,
      atualizado_em:new Date().toISOString()},{onConflict:"user_id"});
    btn.disabled=false; btn.textContent="Salvar";
    if(error) return erro(error);
    fechar(); toast("Início da carteira salvo."); telaDebito();
  };
}

/* marcar faturas em aberto em lote */
function sheetLote(abertas){
  const mc=mesCorrente();
  const dataPg=f=>f.competencia<mc
    ? f.competencia.slice(0,8)+String(new Date(+f.competencia.slice(0,4),+f.competencia.slice(5,7),0).getDate())
    : hojeISO();
  const ord=[...abertas].sort((a,b)=>a.competencia<b.competencia?-1:1);
  const bg=sheet("Faturas em aberto",
    '<div class="mu" style="margin:-6px 0 12px;font-size:.82rem;line-height:1.5">Meses anteriores vêm marcados; o mês atual, não. Ajuste antes de confirmar. '+
    'Meses anteriores ficam com data de pagamento no último dia do mês; o mês atual, com a data de hoje.</div>'+
    '<div class="lista" style="max-height:48dvh;overflow:auto">'+ord.map((f,i)=>
      '<label class="item"><input type="checkbox" data-i="'+i+'"'+(f.competencia<mc?" checked":"")+' style="width:22px;height:22px;accent-color:#7C5CFF">'+
      '<span class="ct"><span class="nm">'+esc(f.conta)+'</span><span class="mt">'+mesCurto(f.competencia)+
      ' · pago em '+dataPg(f).split("-").reverse().join("/")+'</span></span>'+
      '<span class="vl">'+brl(f.valor)+'</span></label>').join("")+'</div>'+
    '<div style="height:14px"></div><button class="btn" id="lOk">Marcar como pagas</button>');
  bg.querySelector("#lOk").onclick=async e=>{
    const sel=[...bg.querySelectorAll("[data-i]")].filter(ch=>ch.checked).map(ch=>ord[+ch.dataset.i]);
    if(!sel.length) return toast("Nada selecionado.","e");
    const btn=e.currentTarget; btn.disabled=true; btn.textContent="Marcando…";
    const {error}=await sb.from("fatura").upsert(sel.map(f=>({conta_id:f.conta_id,competencia:f.competencia,
      pago:true,data_pagamento:dataPg(f)})),{onConflict:"conta_id,competencia"});
    btn.disabled=false; btn.textContent="Marcar como pagas";
    if(error) return erro(error);
    fechar();
    toast(sel.length+(sel.length>1?" faturas marcadas como pagas.":" fatura marcada como paga.")); telaDebito();
  };
}
