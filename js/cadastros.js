import {sb} from "./supabase-client.js";
import {S} from "./estado.js";
import {$, esc, toast, erro, sheet, fechar} from "./util.js";

export const TABELA={cat:"categoria",conta:"conta_pagamento",pessoa:"pessoa"};
export const ROTULO={cat:"categoria",conta:"forma de pagamento",pessoa:"pessoa"};
export const ESPECIES=[["credito","Crédito"],["debito","Débito"],["pix_boleto","Pix/Boleto"],
                ["emprestimo","Empréstimo"],["dinheiro","Dinheiro"]];
export const NOME_ESPECIE=Object.fromEntries(ESPECIES);

export async function recarregarCadastros(){
  const [c,ct,p]=await Promise.all([
    sb.from("categoria").select("*").order("ordem").order("nome"),
    sb.from("conta_pagamento").select("*").order("ordem").order("nome"),
    sb.from("pessoa").select("*").order("nome")]);
  const cat=c.data||[], contas=ct.data||[], pessoas=p.data||[];
  S.cad={todasCat:cat,todasContas:contas,todasPessoas:pessoas,
         cat:cat.filter(x=>x.ativo),contas:contas.filter(x=>x.ativo),
         pessoas:pessoas.filter(x=>x.ativo)};
}

function itemCat(x){
  return '<button class="item" data-ed="cat:'+x.id+'">'+
    '<span class="dot" style="background:'+(x.cor_fundo||"#555")+'"></span>'+
    '<span class="ct"><span class="nm">'+esc(x.nome)+'</span><span class="mt">'+
    (x.ativo?"ativa":"inativa")+'</span></span><span class="vl mu" style="font-size:.78rem">editar</span></button>';
}
function itemConta(x){
  const d=[NOME_ESPECIE[x.especie]||x.especie];
  if(x.dia_fechamento) d.push("fecha dia "+x.dia_fechamento);
  if(!x.ativo) d.push("inativa");
  return '<button class="item" data-ed="conta:'+x.id+'">'+
    '<span class="dot" style="background:'+(x.cor_fundo||"#555")+'"></span>'+
    '<span class="ct"><span class="nm">'+esc(x.nome)+'</span><span class="mt">'+
    esc(d.join(" · "))+'</span></span><span class="vl mu" style="font-size:.78rem">editar</span></button>';
}
function itemPessoa(x){
  return '<button class="item" data-ed="pessoa:'+x.id+'">'+
    '<span class="dot" style="background:var(--ac)"></span>'+
    '<span class="ct"><span class="nm">'+esc(x.nome)+'</span><span class="mt">'+
    (x.ativo?"ativa":"inativa")+'</span></span><span class="vl mu" style="font-size:.78rem">editar</span></button>';
}

export async function telaCadastros(){
  const C=S.cad;
  const convites=(await sb.from("convite").select("*").order("criado_em")).data||[];
  const cab=(t,n,tipo)=>'<div class="grupo"><span>'+t+' <i>'+n+'</i></span>'+
    '<button class="chip" style="padding:5px 12px;font-size:.76rem" data-novo="'+tipo+'">+ nova</button></div>';
  const lista=(itens,render)=>'<div class="lista">'+
    (itens.length?itens.map(render).join(""):'<div class="vazio">Nenhuma ainda.</div>')+'</div>';
  $("#t-cadastros").innerHTML=
    '<div class="hero" style="margin-top:16px"><div class="lbl"><span>Cadastros</span></div>'+
    '<div class="mu" style="font-size:.82rem;line-height:1.5;margin-top:6px">'+
    'O que aparece nas listas do formulário de lançamento. Desativar esconde das listas sem apagar o histórico.</div></div>'+
    cab("Categorias",C.todasCat.length,"cat")+lista(C.todasCat,itemCat)+
    cab("Formas de pagamento",C.todasContas.length,"conta")+lista(C.todasContas,itemConta)+
    cab("Pessoas",C.todasPessoas.length,"pessoa")+lista(C.todasPessoas,itemPessoa)+
    '<div class="grupo"><span>Convites <i>'+convites.length+'</i></span>'+
    '<button class="chip" style="padding:5px 12px;font-size:.76rem" data-novo="convite">+ convidar</button></div>'+
    '<div class="lista">'+(convites.length?convites.map(c=>
      '<div class="item"><span class="dot" style="background:'+(c.usado_em?"var(--ok)":"var(--wr)")+'"></span>'+
      '<span class="ct"><span class="nm">'+esc(c.email)+'</span><span class="mt">'+
      (c.usado_em?"conta criada":"aguardando cadastro")+'</span></span>'+
      '<button class="btn-icone" data-delcv="'+esc(c.email)+'">&#215;</button></div>').join("")
      :'<div class="vazio">Ninguém convidado ainda.</div>')+'</div>'+
    '<div class="grupo"><span>Conta</span></div>'+
    '<button class="btn sec" id="bSairC">Sair da conta</button>'+
    '<div class="mu" style="font-size:.78rem;text-align:center;margin-top:14px">'+
    'Para instalar: Compartilhar e depois "Adicionar à Tela de Início".</div><div style="height:30px"></div>';
  const alvo=$("#t-cadastros");
  alvo.querySelectorAll("[data-novo]").forEach(b=>b.onclick=()=>
    b.dataset.novo==="convite"?sheetConvite():sheetCadastro(b.dataset.novo,null));
  alvo.querySelectorAll("[data-delcv]").forEach(b=>b.onclick=async()=>{
    const {error}=await sb.from("convite").delete().eq("email",b.dataset.delcv);
    if(error) return erro(error);
    toast("Convite removido."); telaCadastros();});
  alvo.querySelectorAll("[data-ed]").forEach(b=>b.onclick=()=>{
    const i=b.dataset.ed.indexOf(":"), tipo=b.dataset.ed.slice(0,i), id=b.dataset.ed.slice(i+1);
    const l=tipo==="cat"?C.todasCat:tipo==="conta"?C.todasContas:C.todasPessoas;
    sheetCadastro(tipo,l.find(z=>z.id===id));});
  $("#bSairC").onclick=()=>sb.auth.signOut();
}

function sheetConvite(){
  const bg=sheet("Convidar alguém",
    '<label class="campo"><span>E-mail</span><input class="inp" id="vEmail" type="email" '+
    'inputmode="email" autocapitalize="off" placeholder="nome@exemplo.com"></label>'+
    '<div class="mu" style="font-size:.78rem;margin:-4px 0 14px;line-height:1.5">A pessoa cria a conta '+
    'no próprio app, com a senha dela, e recebe por e-mail o link de confirmação. '+
    'Os dados dela ficam separados dos seus: nenhum dos dois enxerga o do outro.</div>'+
    '<button class="btn" id="vOk">Convidar</button>');
  bg.querySelector("#vOk").onclick=async e=>{
    const btn=e.currentTarget, email=bg.querySelector("#vEmail").value.trim().toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("E-mail inválido.","e");
    btn.disabled=true; btn.textContent="Convidando…";
    const {error}=await sb.from("convite").insert({email});
    btn.disabled=false; btn.textContent="Convidar";
    if(error) return erro(error);
    fechar(); toast("Convite criado."); telaCadastros();};
}

function sheetCadastro(tipo,x){
  const novo=!x;
  x=x||{ativo:true,ordem:50,cor_fundo:"#7C5CFF",cor_texto:"#FFFFFF",especie:"credito"};
  const cor='style="padding:5px;height:50px"';
  let html='<label class="campo"><span>Nome</span><input class="inp" id="cNome" value="'+
    esc(x.nome||"")+'" placeholder="Como aparece nas listas"></label>';
  if(tipo==="conta")
    html+='<label class="campo"><span>Espécie</span><select class="inp" id="cEsp">'+
      ESPECIES.map(e=>'<option value="'+e[0]+'"'+(e[0]===x.especie?" selected":"")+'>'+e[1]+'</option>').join("")+
      '</select></label>'+
      '<div class="linha2"><label class="campo"><span>Fecha no dia</span>'+
      '<input class="inp" type="number" min="1" max="31" id="cFech" placeholder="—" value="'+
      (x.dia_fechamento||"")+'"></label><label class="campo"><span>Vence no dia</span>'+
      '<input class="inp" type="number" min="1" max="31" id="cVenc" placeholder="—" value="'+
      (x.dia_vencimento||"")+'"></label></div>'+
      '<div class="mu" style="font-size:.74rem;margin:-4px 0 12px">O dia de fechamento define em que mês o gasto cai. '+
      'Em branco, cai no mês da própria data.</div>';
  if(tipo!=="pessoa")
    html+='<div class="linha2"><label class="campo"><span>Cor de fundo</span>'+
      '<input class="inp" type="color" '+cor+' id="cFundo" value="'+(x.cor_fundo||"#7C5CFF")+'"></label>'+
      '<label class="campo"><span>Cor do texto</span>'+
      '<input class="inp" type="color" '+cor+' id="cTexto" value="'+(x.cor_texto||"#FFFFFF")+'"></label></div>'+
      '<label class="campo"><span>Ordem na lista</span>'+
      '<input class="inp" type="number" id="cOrdem" value="'+(x.ordem==null?50:x.ordem)+'"></label>';
  html+='<label class="sw">Ativa nas listas<input type="checkbox" id="cAtivo"'+(x.ativo?" checked":"")+'></label>'+
    '<div style="height:12px"></div><button class="btn" id="cOk">'+(novo?"Criar":"Salvar")+'</button>'+
    (novo?"":'<div style="height:10px"></div><button class="btn per" id="cDel">Excluir</button>');

  const bg=sheet((novo?"Nova ":"Editar ")+ROTULO[tipo],html);

  bg.querySelector("#cOk").onclick=async e=>{
    const btn=e.currentTarget, nome=bg.querySelector("#cNome").value.trim();
    if(!nome) return toast("Informe o nome.","e");
    const d={nome,ativo:bg.querySelector("#cAtivo").checked};
    if(tipo!=="pessoa"){
      d.cor_fundo=bg.querySelector("#cFundo").value;
      d.cor_texto=bg.querySelector("#cTexto").value;
      d.ordem=parseInt(bg.querySelector("#cOrdem").value,10)||50;
    }
    if(tipo==="conta"){
      d.especie=bg.querySelector("#cEsp").value;
      d.dia_fechamento=parseInt(bg.querySelector("#cFech").value,10)||null;
      d.dia_vencimento=parseInt(bg.querySelector("#cVenc").value,10)||null;
    }
    btn.disabled=true; btn.textContent="Salvando…";
    const {error}=novo?await sb.from(TABELA[tipo]).insert(d)
                      :await sb.from(TABELA[tipo]).update(d).eq("id",x.id);
    btn.disabled=false; btn.textContent=novo?"Criar":"Salvar";
    if(error) return erro(error);
    fechar(); toast("Salvo."); await recarregarCadastros(); telaCadastros();
  };

  const del=bg.querySelector("#cDel");
  del&&(del.onclick=async()=>{
    const col=tipo==="cat"?"categoria_id":tipo==="conta"?"conta_id":"pessoa_id";
    const tab=tipo==="pessoa"?"rateio":"lancamento";
    const {count,error:e1}=await sb.from(tab).select("id",{count:"exact",head:true}).eq(col,x.id);
    if(e1) return erro(e1);
    if(count>0) return toast("Em uso por "+count+" lançamento(s). Desative em vez de excluir.","e");
    const {error}=await sb.from(TABELA[tipo]).delete().eq("id",x.id);
    if(error) return erro(error);
    fechar(); toast("Excluído."); await recarregarCadastros(); telaCadastros();
  });
}
