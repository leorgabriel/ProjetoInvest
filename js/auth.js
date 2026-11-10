import {sb} from "./supabase-client.js";
import {S} from "./estado.js";
import {$, esc} from "./util.js";
import {recarregarCadastros} from "./cadastros.js";
import {montarMeses, abrir} from "./nav.js";

/* ---------------- login ---------------- */
let lModo="entrar";
const EMAIL_OK=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const voltaAqui=()=>location.origin+location.pathname;

function traduz(e){
  const m=String(e&&e.message||e||"");
  if(/Invalid login credentials/i.test(m))        return "E-mail ou senha incorretos.";
  if(/Email not confirmed/i.test(m))              return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if(/already registered|already exists/i.test(m))return "Esse e-mail já tem conta. Use a aba Entrar.";
  if(/Password should be at least/i.test(m))      return "A senha precisa de pelo menos 6 caracteres.";
  if(/convite/i.test(m))                          return "Este e-mail não está na lista de convidados.";
  if(/Database error saving new user/i.test(m))   return "Este e-mail não está na lista de convidados.";
  if(/rate limit|too many|security purposes/i.test(m)) return "Muitas tentativas seguidas. Espere um minuto.";
  if(/Failed to fetch|NetworkError/i.test(m))     return "Sem conexão. Verifique a internet e tente de novo.";
  return m || "Não foi possível concluir. Tente de novo.";
}
function lMsg(t,tipo){const e=$("#lMsg"); if(!e)return;
  e.textContent=t||""; e.className="lmsg"+(tipo?" "+tipo:"");}
function marca(sel){const el=$(sel); if(!el)return;
  el.classList.add("ruim"); el.focus();
  el.addEventListener("input",()=>el.classList.remove("ruim"),{once:true});}
async function comCarga(btn,texto,fn){
  const antes=btn.textContent;
  btn.disabled=true; btn.textContent=texto;
  try{ await fn(); } catch(e){ lMsg(traduz(e),"e"); }
  finally{ if(btn.isConnected){ btn.disabled=false; btn.textContent=antes; } }
}

function trocarModo(m){
  lModo=m; lMsg("");
  document.querySelectorAll("#lModo button").forEach(b=>b.classList.toggle("on",b.dataset.m===m));
  const criar=m==="criar";
  $("#boxNome").classList.toggle("hide",!criar);
  $("#boxConf").classList.toggle("hide",!criar);
  $("#lEsqueci").classList.toggle("hide",criar);
  $("#lTitulo").textContent=criar?"Criar conta":"Entrar";
  $("#lSub").textContent=criar
    ? "É preciso ter um convite. Você receberá um e-mail para confirmar."
    : "Acesse sua conta para continuar.";
  $("#lAcao").textContent=criar?"Criar conta":"Entrar";
  $("#lSenha").setAttribute("autocomplete",criar?"new-password":"current-password");
  (criar?$("#lNome"):$("#lEmail")).focus();
}
document.querySelectorAll("#lModo button").forEach(b=>b.onclick=()=>trocarModo(b.dataset.m));

$("#lVer").onchange=e=>{
  const t=e.target.checked?"text":"password";
  $("#lSenha").type=t; $("#lConf").type=t;
};

$("#lAcao").onclick=e=>{
  const btn=e.currentTarget;
  const email=$("#lEmail").value.trim().toLowerCase();
  const senha=$("#lSenha").value;
  if(!EMAIL_OK.test(email)) return lMsg("Informe um e-mail válido.","e"),marca("#lEmail");
  if(senha.length<6)        return lMsg("A senha precisa de pelo menos 6 caracteres.","e"),marca("#lSenha");
  if(lModo==="criar"){
    if(!$("#lNome").value.trim())   return lMsg("Informe seu nome.","e"),marca("#lNome");
    if(senha!==$("#lConf").value)   return lMsg("As senhas não conferem.","e"),marca("#lConf");
  }
  lMsg("");
  comCarga(btn, lModo==="criar"?"Criando conta…":"Entrando…", async()=>{
    if(lModo==="entrar"){
      const {error}=await sb.auth.signInWithPassword({email,password:senha});
      if(error) { lMsg(traduz(error),"e"); marca("#lSenha"); }
      return;
    }
    const {data,error}=await sb.auth.signUp({email,password:senha,
      options:{data:{nome:$("#lNome").value.trim()},emailRedirectTo:voltaAqui()}});
    if(error) return lMsg(traduz(error),"e");
    if(!data.session) telaConfirme(email);
  });
};

$("#lEsqueci").onclick=e=>{
  const email=$("#lEmail").value.trim().toLowerCase();
  if(!EMAIL_OK.test(email)) return lMsg("Digite seu e-mail primeiro.","e"),marca("#lEmail");
  comCarga(e.currentTarget,"Enviando…",async()=>{
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:voltaAqui()});
    lMsg(error?traduz(error):"Enviamos um link para redefinir a senha.",error?"e":"s");
  });
};

function telaConfirme(email){
  $("#login").innerHTML=
    '<div class="logo">&#9993;&#65039;</div><h1>Confirme seu e-mail</h1>'+
    '<p class="mu">Enviamos um link para <b style="color:var(--tx)">'+esc(email)+'</b>. '+
    'Abra o link para ativar a conta e volte aqui para entrar.</p>'+
    '<button class="btn sec" id="lReenviar">Reenviar e-mail</button>'+
    '<button type="button" class="btn-txt" id="lVoltar">Voltar para o acesso</button>'+
    '<div id="lMsg" class="lmsg"></div>';
  $("#lReenviar").onclick=ev=>comCarga(ev.currentTarget,"Enviando…",async()=>{
    const {error}=await sb.auth.resend({type:"signup",email,options:{emailRedirectTo:voltaAqui()}});
    lMsg(error?traduz(error):"E-mail reenviado. Verifique também a caixa de spam.",error?"e":"s");
  });
  $("#lVoltar").onclick=()=>location.replace(voltaAqui());
}
$("#bSair").onclick=()=>sb.auth.signOut();

sb.auth.onAuthStateChange((_e,sess)=>{ sess?entrar():sair(); });
(async()=>{ const {data}=await sb.auth.getSession(); if(data.session) entrar(); })();

async function sair(){ $("#app").classList.add("hide"); $("#nav").classList.add("hide");
  $("#fab").classList.add("hide"); $("#login").classList.remove("hide"); }

async function entrar(){
  $("#login").classList.add("hide"); $("#app").classList.remove("hide");
  $("#nav").classList.remove("hide"); $("#fab").classList.remove("hide");
  await recarregarCadastros();
  montarMeses(); abrir(S.tela);
}
