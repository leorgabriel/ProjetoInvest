import {$, esc, erro} from "../util.js";
import {iniciarSessao, sair} from "./sessao.js";
import {carregar} from "./dados.js";
import {montarFiltros, limparX} from "./filtros.js";
import {limparGraficos} from "./graficos.js";
import {SECOES} from "./secoes.js";

let D=null;
const secaoAtual=()=>{ const s=location.hash.slice(1); return SECOES[s]?s:"visao"; };

function renderizar(){
  if(!D) return;
  const s=secaoAtual();
  document.querySelectorAll("#menu a").forEach(a=>a.classList.toggle("on",a.dataset.s===s));
  document.title=SECOES[s].nome+" · Painel";
  limparGraficos();
  SECOES[s].render(D,$("#conteudo"),renderizar);
}

/* mudar um filtro global zera o filtro cruzado dos gráficos */
const aoMudarFiltros=()=>{ limparX(); renderizar(); };

async function recarregar(){
  limparGraficos();
  $("#conteudo").innerHTML='<div class="carregando">Carregando…</div>';
  try{ D=await carregar(); }
  catch(e){
    D=null;
    $("#conteudo").innerHTML='<div class="construcao er">Não foi possível carregar os dados: '+esc(e.message||e)+'</div>';
    return erro(e);
  }
  montarFiltros(D,aoMudarFiltros);
  renderizar();
}

window.addEventListener("hashchange",()=>{ window.scrollTo({top:0}); renderizar(); });
$("#pSair").onclick=sair;
$("#pAtualizar").onclick=recarregar;

iniciarSessao({
  aoEntrar:user=>{ $("#pUsuario").textContent=user.email||""; recarregar(); },
  aoSair:()=>{ D=null; limparGraficos(); $("#conteudo").innerHTML=""; $("#filtros").innerHTML=""; }
});
