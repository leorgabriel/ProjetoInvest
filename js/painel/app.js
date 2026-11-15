import {$, esc, erro} from "../util.js";
import {iniciarSessao, sair} from "./sessao.js";
import {carregar} from "./dados.js";
import {montarFiltros} from "./filtros.js";
import {SECOES} from "./secoes.js";

let D=null;
const secaoAtual=()=>{ const s=location.hash.slice(1); return SECOES[s]?s:"visao"; };

function renderizar(){
  if(!D) return;
  const s=secaoAtual();
  document.querySelectorAll("#menu a").forEach(a=>a.classList.toggle("on",a.dataset.s===s));
  document.title=SECOES[s].nome+" · Painel";
  $("#conteudo").innerHTML=SECOES[s].render(D);
}

async function recarregar(){
  $("#conteudo").innerHTML='<div class="carregando">Carregando…</div>';
  try{ D=await carregar(); }
  catch(e){
    D=null;
    $("#conteudo").innerHTML='<div class="construcao er">Não foi possível carregar os dados: '+esc(e.message||e)+'</div>';
    return erro(e);
  }
  montarFiltros(D,renderizar);
  renderizar();
}

window.addEventListener("hashchange",renderizar);
$("#pSair").onclick=sair;
$("#pAtualizar").onclick=recarregar;

iniciarSessao({
  aoEntrar:user=>{ $("#pUsuario").textContent=user.email||""; recarregar(); },
  aoSair:()=>{ D=null; $("#conteudo").innerHTML=""; $("#filtros").innerHTML=""; }
});
