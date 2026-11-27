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
  const {data,error}=await sb.from("pluggy_transacao")
    .select("pluggy_id,conta_nome,conta_tipo,data,descricao,valor,parcela_num,parcelas_total,status,categoria,sincronizado_em")
    .gte("data",ini).lt("data",fim).order("data",{ascending:false});
  if(error){ alvo.innerHTML='<div class="vazio">'+esc(error.message)+'</div>'; return; }
  const ult=(await sb.from("pluggy_transacao").select("sincronizado_em")
    .order("sincronizado_em",{ascending:false}).limit(1)).data?.[0]?.sincronizado_em;

  const porConta={};
  for(const t of data){ (porConta[t.conta_nome||"Conta"] ||= []).push(t); }
  const blocos=Object.entries(porConta).map(([nome,ts])=>{
    const soma=ts.reduce((s,t)=>s+Number(t.valor),0);
    return '<div class="grupo"><span>'+esc(nome)+' <i>'+ts.length+'</i></span><b>'+brl(soma)+'</b></div>'+
      '<div class="lista">'+ts.map(t=>
        '<div class="item"><span class="dot" style="background:'+(t.status==="PENDING"?"var(--wr)":"var(--ok)")+'"></span>'+
        '<span class="ct"><span class="nm">'+esc(t.descricao)+
        (t.parcelas_total?' <i>'+t.parcela_num+'/'+t.parcelas_total+'</i>':'')+'</span>'+
        '<span class="mt">'+t.data.split("-").reverse().join("/")+' · '+esc(t.categoria||"sem categoria")+
        (t.status==="PENDING"?' · pendente':'')+'</span></span>'+
        '<b>'+brl(t.valor)+'</b></div>').join("")+'</div>';
  }).join("");

  alvo.innerHTML=
    '<div class="hero" style="margin-top:16px"><div class="lbl"><span>Open Finance (teste)</span></div>'+
    '<div class="mu" style="font-size:.82rem;line-height:1.5;margin-top:6px">'+
    'Transações recebidas da Pluggy em '+MESES[S.mes]+' '+S.ano+'. Só leitura: não alteram seus lançamentos.<br>'+
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
