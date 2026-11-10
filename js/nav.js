import {MESES, S} from "./estado.js";
import {$, sheet, fechar} from "./util.js";
import {telaMes, sheetNovoLancamento} from "./mes.js";
import {telaAno} from "./ano.js";
import {telaGuardado} from "./guardado.js";
import {telaCadastros} from "./cadastros.js";

const CARET='<svg class="caret" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';

/* ---------------- navegação ---------------- */
export function montarMeses(){
  const label=$("#tMes");
  if(S.tela==="cadastros") label.innerHTML="Ajustes";
  else label.innerHTML=MESES[S.mes]+" "+S.ano+" "+CARET;
}

$("#tMes").onclick=()=>{ if(S.tela!=="cadastros") sheetMesAno(); };
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>abrir(b.dataset.t));
$("#fab").onclick=()=>sheetNovoLancamento();

/* folha com o seletor de mês/ano */
function sheetMesAno(){
  let anoSel=S.ano;
  const gradeHTML=ano=>MESES.map((m,i)=>
    '<button type="button" class="mesCel'+(i===S.mes&&ano===S.ano?" on":"")+'" data-m="'+i+'">'+
    m.slice(0,3)+"</button>").join("");

  const bg=sheet("Escolher mês",
    '<div class="anoSel"><button type="button" id="pAnoMenos">&#8249;</button>'+
    '<span id="pAno">'+anoSel+'</span><button type="button" id="pAnoMais">&#8250;</button></div>'+
    '<div class="gradeMeses" id="gradeMeses">'+gradeHTML(anoSel)+'</div>');

  function ligarMeses(){
    bg.querySelectorAll(".mesCel").forEach(b=>b.onclick=()=>{
      S.ano=anoSel; S.mes=+b.dataset.m;
      fechar(); montarMeses(); carregar();
    });
  }
  function atualizaAno(){
    bg.querySelector("#pAno").textContent=anoSel;
    bg.querySelector("#gradeMeses").innerHTML=gradeHTML(anoSel);
    ligarMeses();
  }
  bg.querySelector("#pAnoMenos").onclick=()=>{anoSel--;atualizaAno();};
  bg.querySelector("#pAnoMais").onclick=()=>{anoSel++;atualizaAno();};
  ligarMeses();
}

export function abrir(t){
  S.tela=t;
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.t===t));
  document.querySelectorAll(".tela").forEach(s=>s.classList.toggle("on",s.id==="t-"+t));
  montarMeses();
  window.scrollTo({top:0}); carregar();
}
export function carregar(){
  if(S.tela==="mes") telaMes();
  else if(S.tela==="ano") telaAno();
  else if(S.tela==="guardado") telaGuardado();
  else if(S.tela==="cadastros") telaCadastros();
}
