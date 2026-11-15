import {sb} from "../supabase-client.js";
import {$} from "../util.js";

/* Login próprio do painel: só entrar e recuperar senha (criar conta continua no app). */
const EMAIL_OK=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const aqui=()=>location.origin+location.pathname;

function traduz(e){
  const m=String(e&&e.message||e||"");
  if(/Invalid login credentials/i.test(m))        return "E-mail ou senha incorretos.";
  if(/Email not confirmed/i.test(m))              return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if(/rate limit|too many|security purposes/i.test(m)) return "Muitas tentativas seguidas. Espere um minuto.";
  if(/Failed to fetch|NetworkError/i.test(m))     return "Sem conexão. Verifique a internet e tente de novo.";
  return m || "Não foi possível concluir. Tente de novo.";
}
function lMsg(t,tipo){ const e=$("#lMsg"); e.textContent=t||""; e.className="lmsg"+(tipo?" "+tipo:""); }
async function comCarga(btn,texto,fn){
  const antes=btn.textContent; btn.disabled=true; btn.textContent=texto;
  try{ await fn(); } catch(e){ lMsg(traduz(e),"e"); }
  finally{ btn.disabled=false; btn.textContent=antes; }
}

function ligarLogin(){
  $("#lVer").onchange=e=>{ $("#lSenha").type=e.target.checked?"text":"password"; };
  const entrar=()=>{
    const email=$("#lEmail").value.trim().toLowerCase(), senha=$("#lSenha").value;
    if(!EMAIL_OK.test(email)) return lMsg("Informe um e-mail válido.","e");
    if(senha.length<6)        return lMsg("A senha precisa de pelo menos 6 caracteres.","e");
    lMsg("");
    comCarga($("#lAcao"),"Entrando…",async()=>{
      const {error}=await sb.auth.signInWithPassword({email,password:senha});
      if(error) lMsg(traduz(error),"e");
    });
  };
  $("#lAcao").onclick=entrar;
  $("#lSenha").onkeydown=e=>{ if(e.key==="Enter") entrar(); };
  $("#lEsqueci").onclick=e=>{
    const email=$("#lEmail").value.trim().toLowerCase();
    if(!EMAIL_OK.test(email)) return lMsg("Digite seu e-mail primeiro.","e");
    comCarga(e.currentTarget,"Enviando…",async()=>{
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:aqui()});
      lMsg(error?traduz(error):"Enviamos um link para redefinir a senha.",error?"e":"s");
    });
  };
}

/* chama aoEntrar(user) / aoSair() só quando o usuário logado muda
   (o Supabase também dispara eventos em refresh de token) */
export function iniciarSessao({aoEntrar,aoSair}){
  ligarLogin();
  let atual;
  const aplicar=sess=>{
    const id=sess?.user?.id||null;
    if(id===atual) return;
    atual=id;
    $("#login").classList.toggle("hide",!!id);
    $("#painel").classList.toggle("hide",!id);
    id?aoEntrar(sess.user):aoSair();
  };
  sb.auth.onAuthStateChange((_e,s)=>aplicar(s));
  sb.auth.getSession().then(({data})=>aplicar(data.session));
}

export const sair=()=>sb.auth.signOut();
