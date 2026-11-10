import {sb} from "./supabase-client.js";
import {MESES} from "./estado.js";
import {$, esc, brl, hojeISO, num, toast, erro, sheet, fechar} from "./util.js";

const TIPOS=[["reserva","Reserva"],["renda_fixa","Renda fixa"],["renda_variavel","Renda variável"],
  ["cripto","Cripto"],["previdencia","Previdência"],["outro","Outro"]];
const NOME_TIPO=Object.fromEntries(TIPOS);
const dataBR=d=>d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
const mesLabel=chave=>MESES[+chave.slice(5,7)-1].slice(0,3)+"/"+chave.slice(2,4);

/* projeta o saldo à frente usando a taxa anual, convertida para mensal composta */
function projecao(saldo,taxaAA,meses){
  if(!taxaAA||saldo<=0) return null;
  const mensal=Math.pow(1+taxaAA/100,1/12)-1;
  return saldo*Math.pow(1+mensal,meses);
}

/* ---------------- tela: investido ---------------- */
export async function telaGuardado(){
  const [r,mv]=await Promise.all([
    sb.from("v_investimento").select("*").order("ordem"),
    sb.from("movimento_investimento").select("data,tipo,valor").order("data")]);
  if(r.error)return erro(r.error);
  const todos=r.data||[];
  const ativos=todos.filter(i=>i.ativo), inativos=todos.filter(i=>!i.ativo);
  const tot=ativos.reduce((s,i)=>s+ +i.saldo,0);

  let h='<div class="hero" style="margin-top:16px"><div class="lbl"><span>Total investido</span></div>'+
    '<div class="val">'+brl(tot)+'</div>'+
    '<div class="mu" style="font-size:.78rem">Separado do saldo do mês — não entra nas contas.</div>'+
    graficoEvolucao(evolucaoMensal(mv.data||[]))+'</div>';
  h+="<h2>Aplicações</h2>";
  h+=ativos.length?ativos.map(cardAplicacao).join(""):'<div class="lista"><div class="vazio">Nenhuma aplicação ainda.</div></div>';
  h+='<div style="height:12px"></div><button class="btn sec" id="gNova">Nova aplicação</button>';

  if(inativos.length){
    h+='<h2>Desativadas</h2><div class="lista">'+inativos.map(i=>
      '<button class="item" data-inv="'+i.id+'"><span class="dot" style="background:var(--mu)"></span>'+
      '<span class="ct"><span class="nm">'+esc(i.nome)+'</span><span class="mt">'+
      (i.desativado_em?"desativada em "+dataBR(i.desativado_em):"desativada")+'</span></span>'+
      '<span class="vl mu">'+brl(i.saldo)+'</span></button>').join("")+'</div>';
  }
  h+='<div style="height:30px"></div>';
  $("#t-guardado").innerHTML=h;
  $("#t-guardado").querySelectorAll("[data-inv]").forEach(b=>b.onclick=()=>
    sheetAplicacao(todos.find(i=>i.id===b.dataset.inv)));
  $("#gNova").onclick=sheetNovaAplicacao;

  const cap=$("#guardGrafCap");
  $("#t-guardado").querySelectorAll(".linhaG circle").forEach(c=>c.onclick=()=>{
    $("#t-guardado").querySelectorAll(".linhaG circle").forEach(o=>o.classList.toggle("sel",o===c));
    if(cap) cap.textContent=mesLabel(c.dataset.mes)+": "+brl(+c.dataset.v)+" investidos.";
  });
}

/* soma todos os movimentos (de todas as aplicações) e devolve o saldo acumulado ao fim de cada mês */
function evolucaoMensal(movs){
  let acc=0; const porMes={};
  movs.forEach(m=>{
    const sinal=m.tipo==="resgate"?-1:1;
    acc+=sinal*Number(m.valor);
    porMes[m.data.slice(0,7)]=acc;
  });
  return Object.keys(porMes).sort().map(mes=>({mes,saldo:porMes[mes]}));
}

function graficoEvolucao(pontos){
  if(pontos.length<1)
    return '<div class="mu" style="font-size:.78rem;margin-top:12px">Sem histórico de movimentos ainda.</div>';
  const W=300,H=96,pad=10;
  const vals=pontos.map(p=>p.saldo);
  const min=Math.min(0,...vals), max=Math.max(1,...vals);
  const range=(max-min)||1, n=pontos.length;
  const xs=pontos.map((_,idx)=>n>1?pad+idx*(W-2*pad)/(n-1):W/2);
  const ys=pontos.map(p=>H-pad-((p.saldo-min)/range)*(H-2*pad));
  const linha=xs.map((x,idx)=>x.toFixed(1)+","+ys[idx].toFixed(1)).join(" ");
  const pontosSvg=pontos.map((p,idx)=>
    '<circle data-mes="'+p.mes+'" data-v="'+p.saldo+'" cx="'+xs[idx].toFixed(1)+'" cy="'+ys[idx].toFixed(1)+'" r="3.6"></circle>').join("");
  return '<svg class="linhaG" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
    (n>1?'<polyline points="'+linha+'"></polyline>':"")+pontosSvg+'</svg>'+
    '<div class="grafCap" id="guardGrafCap">Toque num ponto para ver o mês.</div>';
}

function cardAplicacao(i){
  const pct=i.objetivo_valor?Math.min(100,Math.round(i.saldo/i.objetivo_valor*100)):null;
  return '<button class="lista" data-inv="'+i.id+'" style="display:block;width:100%;text-align:left;'+
    'padding:14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px">'+
    "<div><div style=\"font-weight:600\">"+esc(i.nome)+"</div>"+
    '<div class="mu" style="font-size:.76rem">'+esc(i.instituicao||NOME_TIPO[i.tipo]||i.tipo)+
    (i.data_abertura?" · desde "+dataBR(i.data_abertura):"")+
    (i.taxa_rendimento_aa?" · "+Number(i.taxa_rendimento_aa).toFixed(2).replace(".",",")+"% a.a.":"")+"</div></div>"+
    '<div style="text-align:right"><div style="font-weight:700">'+brl(i.saldo)+"</div>"+
    (pct!==null?'<div class="mu" style="font-size:.72rem">'+pct+"% de "+brl(i.objetivo_valor)+"</div>":"")+
    "</div></div>"+(pct!==null?'<div class="barra"><i style="width:'+Math.max(2,pct)+'%"></i></div>':"")+
    "</button>";
}

/* ---------------- ações da aplicação ---------------- */
function sheetAplicacao(i){
  if(!i)return;
  const p6=projecao(i.saldo,i.taxa_rendimento_aa,6), p12=projecao(i.saldo,i.taxa_rendimento_aa,12);
  const bg=sheet(i.nome,
    '<div class="mu" style="margin:-8px 0 16px;font-size:.86rem">Saldo '+brl(i.saldo)+
      " · aportado "+brl(i.total_aportado)+" · rendeu "+brl(i.total_rendimento)+"</div>"+
    '<div class="mu" style="font-size:.78rem;margin:-10px 0 16px;line-height:1.5">'+
      (i.data_abertura?"Aberta em "+dataBR(i.data_abertura)+". ":"")+
      (i.ativo?"":"Desativada"+(i.desativado_em?" em "+dataBR(i.desativado_em):"")+". ")+
      (i.atualizado_em?"Última alteração em "+dataBR(i.atualizado_em.slice(0,10))+".":"")+'</div>'+
    (p6!==null?'<div class="kpis" style="margin:0 0 16px">'+
      '<div class="kpi"><small>Projeção em 6 meses</small><b>'+brl(p6)+'</b></div>'+
      '<div class="kpi"><small>Projeção em 12 meses</small><b>'+brl(p12)+'</b></div></div>'+
      '<div class="mu" style="font-size:.72rem;margin:-10px 0 16px">Com base em '+
      Number(i.taxa_rendimento_aa).toFixed(2).replace(".",",")+'% a.a., sem considerar novos aportes ou resgates.</div>':'')+
    (i.ativo?'<button class="btn sec" id="aMov">Registrar movimento</button><div style="height:10px"></div>':'')+
    '<button class="btn sec" id="aEd">Editar</button>');
  const bMov=bg.querySelector("#aMov");
  if(bMov) bMov.onclick=()=>sheetMovimento(i);
  bg.querySelector("#aEd").onclick=()=>sheetEditarAplicacao(i);
}

/* ---------------- criar ---------------- */
function sheetNovaAplicacao(){
  const bg=sheet("Nova aplicação",
    '<label class="campo"><span>Nome</span><input class="inp" id="nNome" placeholder="Reserva de emergência"></label>'+
    '<label class="campo"><span>Instituição</span><input class="inp" id="nInst" placeholder="Nubank, Sicoob…"></label>'+
    '<div class="linha2"><label class="campo"><span>Tipo</span><select class="inp" id="nTipo">'+
      TIPOS.map(t=>'<option value="'+t[0]+'">'+t[1]+"</option>").join("")+"</select></label>"+
    '<label class="campo"><span>Meta (opcional)</span><input class="inp" id="nMeta" inputmode="decimal" placeholder="0,00"></label></div>'+
    '<div class="linha2"><label class="campo"><span>Data de abertura</span><input class="inp" type="date" id="nData" value="'+
      hojeISO()+'"></label>'+
    '<label class="campo"><span>Rendimento esperado (% a.a.)</span><input class="inp" id="nTaxa" inputmode="decimal" placeholder="0,00"></label></div>'+
    '<div style="height:16px"></div><button class="btn" id="nOk">Criar</button>');
  bg.querySelector("#nOk").onclick=async()=>{
    const nome=bg.querySelector("#nNome").value.trim(); if(!nome)return toast("Informe o nome.","e");
    const meta=num(bg.querySelector("#nMeta").value);
    const taxa=num(bg.querySelector("#nTaxa").value);
    const {error}=await sb.from("investimento").insert({nome,instituicao:bg.querySelector("#nInst").value.trim()||null,
      tipo:bg.querySelector("#nTipo").value,objetivo_valor:isNaN(meta)||meta<=0?null:meta,
      data_abertura:bg.querySelector("#nData").value||hojeISO(),
      taxa_rendimento_aa:isNaN(taxa)?null:taxa});
    if(error)return erro(error);
    fechar(); toast("Aplicação criada."); telaGuardado();};
}

/* ---------------- editar / desativar ---------------- */
function sheetEditarAplicacao(i){
  const bg=sheet("Editar aplicação",
    '<label class="campo"><span>Nome</span><input class="inp" id="eNome" value="'+esc(i.nome||"")+'"></label>'+
    '<label class="campo"><span>Instituição</span><input class="inp" id="eInst" value="'+esc(i.instituicao||"")+'"></label>'+
    '<div class="linha2"><label class="campo"><span>Tipo</span><select class="inp" id="eTipo">'+
      TIPOS.map(t=>'<option value="'+t[0]+'"'+(t[0]===i.tipo?" selected":"")+'>'+t[1]+"</option>").join("")+"</select></label>"+
    '<label class="campo"><span>Meta (opcional)</span><input class="inp" id="eMeta" inputmode="decimal" value="'+
      (i.objetivo_valor?Number(i.objetivo_valor).toFixed(2).replace(".",","):"")+'"></label></div>'+
    '<div class="linha2"><label class="campo"><span>Data de abertura</span><input class="inp" type="date" id="eData" value="'+
      (i.data_abertura||"")+'"></label>'+
    '<label class="campo"><span>Rendimento esperado (% a.a.)</span><input class="inp" id="eTaxa" inputmode="decimal" value="'+
      (i.taxa_rendimento_aa!=null?Number(i.taxa_rendimento_aa).toFixed(2).replace(".",","):"")+'"></label></div>'+
    '<label class="sw">Aplicação ativa<input type="checkbox" id="eAtivo"'+(i.ativo?" checked":"")+'></label>'+
    '<div class="mu" style="font-size:.76rem;margin:4px 0 0">Desativar some da lista principal, mas mantém o '+
    'histórico e a data em que foi desativada.</div>'+
    '<div style="height:14px"></div><button class="btn" id="eOk">Salvar</button>');
  bg.querySelector("#eOk").onclick=async e=>{
    const btn=e.currentTarget;
    const nome=bg.querySelector("#eNome").value.trim();
    if(!nome) return toast("Informe o nome.","e");
    const meta=num(bg.querySelector("#eMeta").value);
    const taxa=num(bg.querySelector("#eTaxa").value);
    const ativo=bg.querySelector("#eAtivo").checked;
    const dados={nome,instituicao:bg.querySelector("#eInst").value.trim()||null,
      tipo:bg.querySelector("#eTipo").value,objetivo_valor:isNaN(meta)||meta<=0?null:meta,
      data_abertura:bg.querySelector("#eData").value||null,
      taxa_rendimento_aa:isNaN(taxa)?null:taxa,ativo};
    if(ativo!==i.ativo) dados.desativado_em=ativo?null:hojeISO();
    btn.disabled=true; btn.textContent="Salvando…";
    const {error}=await sb.from("investimento").update(dados).eq("id",i.id);
    btn.disabled=false; btn.textContent="Salvar";
    if(error) return erro(error);
    fechar(); toast("Salvo."); telaGuardado();
  };
}

/* ---------------- movimentos ---------------- */
function sheetMovimento(i){
  if(!i)return;
  const tipos=[["aporte","Aporte"],["rendimento","Rendimento"],["resgate","Resgate"],["ajuste","Ajuste"]];
  const bg=sheet(i.nome,
    '<div class="mu" style="margin:-8px 0 16px;font-size:.86rem">Saldo '+brl(i.saldo)+
      " · aportado "+brl(i.total_aportado)+" · rendeu "+brl(i.total_rendimento)+"</div>"+
    '<div class="chips" id="mTipo" style="margin-bottom:14px">'+tipos.map((t,k)=>
      '<button class="chip'+(k===0?" on":"")+'" data-k="'+t[0]+'">'+t[1]+"</button>").join("")+"</div>"+
    '<div class="linha2"><label class="campo"><span>Valor</span>'+
      '<input class="inp" id="mValor" inputmode="decimal" placeholder="0,00"></label>'+
    '<label class="campo"><span>Data</span><input class="inp" type="date" id="mData" value="'+hojeISO()+'"></label></div>'+
    '<div style="height:16px"></div><button class="btn" id="mOk">Registrar</button>');
  let tipo="aporte";
  bg.querySelectorAll("#mTipo .chip").forEach(b=>b.onclick=()=>{tipo=b.dataset.k;
    bg.querySelectorAll("#mTipo .chip").forEach(o=>o.classList.toggle("on",o===b));});
  bg.querySelector("#mOk").onclick=async()=>{
    const v=num(bg.querySelector("#mValor").value);
    if(isNaN(v)||v<=0)return toast("Informe um valor válido.","e");
    const {error}=await sb.from("movimento_investimento").insert({investimento_id:i.id,
      tipo,valor:v,data:bg.querySelector("#mData").value||hojeISO()});
    if(error)return erro(error);
    fechar(); toast("Movimento registrado."); telaGuardado();};
}
