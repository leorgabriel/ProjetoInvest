import {sb} from "./supabase-client.js";
import {S, MESES} from "./estado.js";
import {$, esc, brl, toast, erro} from "./util.js";

/* Sandbox Open Finance (Pluggy). Só leitura: nada daqui vai para os lançamentos.
   A proteção real é o RLS de pluggy_transacao e a checagem na Edge Function;
   o DONO aqui só decide se o botão aparece. */
export const DONO="84591a7c-ebfc-4330-9d74-c09301009d11";

export async function souDono(){
  const {data}=await sb.auth.getSession();
  return data.session?.user?.id===DONO;
}

export async function telaOF(){
  const alvo=$("#t-of");
  if(!(await souDono())){ alvo.innerHTML='<div class="vazio">Indisponível.</div>'; return; }
  const ini=S.ano+"-"+String(S.mes+1).padStart(2,"0")+"-01";
  const fimD=new Date(S.ano,S.mes+1,1);
  const fim=fimD.getFullYear()+"-"+String(fimD.getMonth()+1).padStart(2,"0")+"-01";
  const COLS="pluggy_id,conta_nome,conta_tipo,data,competencia,descricao,valor,parcela_num,parcelas_total,status,categoria,op:payload->>operationType";
  // Cartão: pela fatura (competência = vencimento - 1 mês), mais a seguinte, cujo maior
  // pagamento é a quitação desta. Conta corrente: pelo mês do calendário.
  const [rc,rb]=await Promise.all([
    sb.from("pluggy_transacao").select(COLS).eq("conta_tipo","CREDIT")
      .in("competencia",[ini,fim]).order("data",{ascending:false}),
    sb.from("pluggy_transacao").select(COLS).neq("conta_tipo","CREDIT")
      .gte("data",ini).lt("data",fim).order("data",{ascending:false})]);
  const error=rc.error||rb.error;
  if(error){ alvo.innerHTML='<div class="vazio">'+esc(error.message)+'</div>'; return; }
  const seguintes=rc.data.filter(t=>t.competencia===fim);
  const data=[...rc.data.filter(t=>t.competencia===ini),...rb.data];
  const ult=(await sb.from("pluggy_transacao").select("sincronizado_em").eq("user_id",DONO)
    .order("sincronizado_em",{ascending:false}).limit(1)).data?.[0]?.sincronizado_em;

  const linha=t=>
    '<div class="item"><span class="dot" style="background:'+(t.status==="PENDING"?"var(--wr)":"var(--ok)")+'"></span>'+
    '<span class="ct"><span class="nm">'+esc(t.descricao)+
    (t.parcelas_total?' <i>'+t.parcela_num+'/'+t.parcelas_total+'</i>':'')+'</span>'+
    '<span class="mt">'+t.data.split("-").reverse().join("/")+' · '+esc(t.categoria||"sem categoria")+
    (t.status==="PENDING"?' · pendente':'')+'</span></span>'+
    '<b>'+brl(t.valor)+'</b></div>';
  const soma=ts=>ts.reduce((s,t)=>s+Number(t.valor),0);
  const secao=(titulo,ts)=>!ts.length?'':
    '<div class="grupo"><span>'+titulo+' <i>'+ts.length+'</i></span><b>'+brl(soma(ts))+'</b></div>'+
    '<div class="lista">'+ts.map(linha).join("")+'</div>';
  // Pagamento de fatura: no cartão vem como PAGAMENTO_FATURA / "Credit card payment";
  // na conta, como "Pagamento de fatura".
  const ehPagto=t=>t.op==="PAGAMENTO_FATURA" || t.categoria==="Credit card payment" ||
    /^pagamento de fatura/i.test(t.descricao||"");

  const porConta={};
  for(const t of data){ (porConta[t.conta_nome||"Conta"] ||= []).push(t); }
  const blocos=Object.entries(porConta).map(([nome,ts])=>{
    const pagtos=ts.filter(ehPagto), resto=ts.filter(t=>!ehPagto(t));
    const cartao=ts[0].conta_tipo==="CREDIT";
    if(cartao){
      const compras=resto.filter(t=>Number(t.valor)>0), estornos=resto.filter(t=>Number(t.valor)<=0);
      // O maior pagamento do ciclo quita a fatura anterior; os demais são antecipações desta.
      const maior=ts=>ts.reduce((m,t)=>Math.max(m,-Number(t.valor)),0);
      const quitAnt=maior(pagtos), antecip=Math.max(0,-soma(pagtos)-quitAnt);
      const total=soma(resto)-antecip;
      // Fatura fechada: o maior pagamento do ciclo seguinte é o valor que o Nubank cobrou.
      const pago=maior(seguintes.filter(t=>t.conta_nome===nome && ehPagto(t)));
      return '<div class="hero" style="margin-top:18px"><div class="lbl"><span>'+esc(nome)+
        ' · fatura '+MESES[S.mes].toLowerCase()+'</span></div>'+
        '<div class="val">'+brl(total)+'</div>'+
        (pago?'<div class="mu" style="font-size:.78rem;margin:-8px 0 12px">Valor pago ao Nubank: <b>'+brl(pago)+'</b>'+
          (Math.abs(pago-total)>=0.05?' · diferença '+brl(pago-total):' ✓')+'</div>':'')+
        '<div class="duo"><div><small>Compras</small><b>'+brl(soma(compras))+'</b></div>'+
        '<div><small>Estornos e créditos</small><b>'+brl(soma(estornos))+'</b></div>'+
        '<div><small>Antecipações</small><b>'+brl(-antecip)+'</b></div>'+
        '<div><small>Fatura anterior paga</small><b>'+brl(-quitAnt)+'</b></div></div></div>'+
        secao("Compras",compras)+secao("Estornos e créditos",estornos)+
        secao("Pagamentos de fatura",pagtos);
    }
    return '<div class="hero" style="margin-top:18px"><div class="lbl"><span>'+esc(nome)+'</span></div>'+
      '<div class="val">'+brl(soma(resto))+'</div>'+
      '<div class="mu" style="font-size:.78rem">Movimentações, sem pagamento de fatura</div></div>'+
      secao("Movimentações",resto)+secao("Pagamentos de fatura",pagtos);
  }).join("");

  alvo.innerHTML=
    '<div class="hero" style="margin-top:16px"><div class="lbl"><span>Open Finance (teste)</span></div>'+
    '<div class="mu" style="font-size:.82rem;line-height:1.5;margin-top:6px">'+
    'Transações recebidas da Pluggy em '+MESES[S.mes]+' '+S.ano+' (cartão pela fatura, conta pelo mês). '+
    'Só leitura: não alteram seus lançamentos.<br>'+
    'Última sincronização: '+(ult?new Date(ult).toLocaleString("pt-BR"):"nunca")+'</div></div>'+
    '<button class="btn" id="bSyncOF" style="margin-top:14px">Sincronizar agora</button>'+
    (blocos||'<div class="vazio" style="margin-top:14px">Nenhuma transação neste mês.</div>')+
    '<div style="height:30px"></div>';

  $("#bSyncOF").onclick=async e=>{
    const b=e.currentTarget; b.disabled=true; b.textContent="Sincronizando…";
    const {data:r,error:er}=await sb.functions.invoke("sync-pluggy",{method:"POST"});
    if(er||r?.erro){
      let msg=r?.erro||er?.message;
      try{ msg=(await er.context.json()).erro||msg; }catch{}
      erro(msg);
    } else toast(r.transacoes+" transações de "+r.contas+" conta(s).");
    telaOF();
  };
}
