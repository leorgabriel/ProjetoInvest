import {sb} from "./supabase-client.js";
import {MESES, S, preparados} from "./estado.js";
import {$, esc, brl, comp, mesCorrente, hojeISO, num, toast, erro, sheet, fechar} from "./util.js";
import {carregar} from "./nav.js";

/* ---------------- tela: mês ---------------- */
export async function telaMes(){
  const c=comp(), alvo=$("#t-mes");
  if(!preparados.has(c) && c>=mesCorrente()){
    preparados.add(c);
    try{ await sb.rpc("preparar_mes",{p_competencia:c}); }catch(e){}
  }
  const limpo=!S.busca && !S.noAno;
  let q=sb.from("v_lancamento").select("*").order("data_compra",{ascending:false,nullsFirst:false})
       .order("criado_em",{ascending:false});
  if(S.noAno) q=q.gte("competencia",S.ano+"-01-01").lte("competencia",S.ano+"-12-01");
  else q=q.eq("competencia",c);
  if(S.busca) q=q.ilike("descricao","%"+S.busca+"%");

  const [r,l,ar,gc,fa,en,pe]=await Promise.all([
    sb.from("v_resumo_mes").select("*").eq("competencia",c).maybeSingle(),
    q.limit(300),
    sb.from("v_a_receber").select("*").eq("competencia",c).order("pessoa"),
    sb.from("v_gastos_categoria").select("*").eq("competencia",c).order("valor_bruto",{ascending:false}),
    sb.from("v_gastos_conta").select("*").eq("competencia",c).order("valor",{ascending:false}),
    sb.from("entrada").select("*").eq("competencia",c).order("descricao"),
    sb.from("v_lancamento").select("*").or("categoria_id.is.null,conta_id.is.null").limit(30)
  ]);
  if(l.error) return erro(l.error);
  const R=r.data||{gastos_bruto:0,gastos_liquido:0,entradas_total:0,entradas_fixas:0,saldo:0,a_receber:0};
  const lanc=l.data||[], gasto=S.liquido?R.gastos_liquido:R.gastos_bruto;
  const entrada=S.liquido?R.entradas_fixas:R.entradas_total;

  let proj=null;
  if(limpo && c===mesCorrente()){
    const d=new Date(), dia=d.getDate(), dias=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    const av=lanc.filter(x=>x.origem==="avista").reduce((s,x)=>s+ +x.valor,0);
    if(dia<dias && av>0) proj=+R.gastos_bruto+(av/dia)*(dias-dia);
  }

  let h='<div class="hero"><div class="lbl"><span>Saldo de '+MESES[S.mes]+'</span>'+
    '<div class="seg"><button data-lq="0"'+(S.liquido?"":' class="on"')+'>Bruto</button>'+
    '<button data-lq="1"'+(S.liquido?' class="on"':"")+'>Líquido</button></div></div>'+
    '<div class="val '+(R.saldo<0?"er":"")+'">'+brl(R.saldo)+'</div><div class="duo">'+
    '<div><small>Entradas</small><b class="ok">'+brl(entrada)+'</b></div>'+
    '<div><small>Gastos</small><b>'+brl(gasto)+'</b></div></div>'+
    (proj!==null?'<div class="mu" style="font-size:.78rem;margin-top:11px">No ritmo de hoje, o mês '+
      'deve fechar em <b style="color:var(--tx)">'+brl(proj)+'</b> de gastos.</div>':'')+'</div>';

  const estouro=(gc.data||[]).filter(x=>+x.valor_esperado>0 && +x.valor_bruto>+x.valor_esperado);
  const avisos=[];
  if(R.saldo<0) avisos.push(["er","&#9888;&#65039;","Saldo negativo",
    "As saídas superaram as entradas em "+brl(Math.abs(R.saldo))+"."]);
  estouro.forEach(x=>avisos.push(["","&#128201;","Orçamento estourado em "+x.categoria,
    brl(x.valor_bruto)+" de "+brl(x.valor_esperado)+", "+Math.round(x.valor_bruto/x.valor_esperado*100)+"% do limite."]));
  if((pe.data||[]).length) avisos.push(["","&#9999;&#65039;",(pe.data.length)+" lançamentos incompletos",
    "Sem categoria ou sem forma de pagamento. Veja em Pendências, no fim da tela."]);
  h+=avisos.map(a=>'<div class="alerta '+a[0]+'"><span class="ic">'+a[1]+'</span>'+
    '<span><b>'+esc(a[2])+'</b>'+esc(a[3])+'</span></div>').join("");

  const fs=(fa.data||[]).filter(x=>Math.abs(x.valor)>0.004);
  if(fs.length){
    const tf=fs.reduce((s,x)=>s+ +x.valor,0);
    h+='<h2>Faturas · '+brl(tf)+'</h2><div class="lista">'+fs.map(f=>
      '<button class="item" data-fat="'+f.conta_id+'" data-nome="'+esc(f.conta)+'" data-v="'+f.valor+
      '" data-pg="'+(f.pago?1:0)+'"><span class="dot" style="background:'+(f.pago?"var(--ok)":"var(--wr)")+
      '"></span><span class="ct"><span class="nm">'+esc(f.conta)+'</span><span class="mt">'+
      (f.pago?"paga":"em aberto")+'</span></span><span class="vl">'+brl(f.valor)+
      '</span></button>').join("")+'</div>';
  }

  {
    const ens=en.data||[], te=ens.reduce((s,x)=>s+ +x.valor,0);
    h+='<h2>Entradas'+(te?' · '+brl(te):'')+'</h2><div class="lista">'+ens.map(e=>
      '<button class="item" data-ent="'+e.id+'">'+
      '<span class="dot" style="background:'+(e.recebido?"var(--ok)":"var(--mu)")+'"></span>'+
      '<span class="ct"><span class="nm">'+esc(e.descricao)+'</span><span class="mt">'+
      (e.recebido?"recebida":"a receber")+(e.recorrente?" · repete todo mês":"")+
      '</span></span><span class="vl ok">'+brl(e.valor)+'</span></button>').join("")+
      '<button class="item" id="novaEnt"><span class="dot" style="background:var(--ac)"></span>'+
      '<span class="ct"><span class="nm" style="color:#b9a6ff">+ nova entrada</span></span></button></div>';
  }

  if(ar.data?.length){
    h+='<h2>A receber</h2><div class="rolo">'+ar.data.map(p=>{
      const pend=Number(p.pendente)||0;
      return '<button class="pcard" data-pes="'+p.pessoa_id+'" data-nome="'+esc(p.pessoa)+'">'+
        '<small>'+esc(p.pessoa)+'</small><b>'+brl(p.total)+'</b>'+
        '<span class="tag '+(pend>0?"pend":"quit")+'">'+(pend>0?brl(pend)+" pendente":"recebido")+
        '</span></button>';}).join("")+'</div>';
  }

  h+='<h2>Lançamentos</h2><div class="busca">'+
     '<input class="inp" id="qBusca" placeholder="Buscar descrição…" value="'+esc(S.busca)+'">'+
     '<button class="tg'+(S.noAno?" on":"")+'" id="qAno">Ano</button></div>';
  if(!lanc.length) h+='<div class="lista"><div class="vazio">Nada por aqui ainda.</div></div>';
  else [["avista","À vista"],["parcelado","Parcelados"],["fixo","Contas fixas"]].forEach(([k,rot])=>{
    const g=lanc.filter(x=>x.origem===k);
    if(!g.length) return;
    const s=g.reduce((a,x)=>a+Number(x.valor),0);
    h+='<div class="grupo"><span>'+rot+' <i>'+g.length+'</i></span><b>'+brl(s)+'</b></div>'+
       '<div class="lista">'+g.map(linha).join("")+'</div>';
  });

  if(gc.data?.length){
    const mx=Math.max(...gc.data.map(x=>Math.abs(x.valor_bruto)))||1;
    h+='<h2>Por categoria</h2><div class="mu" style="font-size:.76rem;margin:-4px 0 8px">'+
       'Toque numa categoria para definir o limite do mês.</div><div class="lista">'+gc.data.map(x=>{
      const orc=Number(x.valor_esperado)||0, pct=orc?Math.round(x.valor_bruto/orc*100):null;
      const cls=pct===null?"":pct>100?"er":pct>80?"wr":"ok";
      const larg=orc?Math.min(100,Math.max(2,pct)):Math.max(2,Math.round(Math.abs(x.valor_bruto)/mx*100));
      return '<button class="cat" data-orc="'+x.categoria_id+'" data-nome="'+esc(x.categoria)+
        '" data-lim="'+orc+'"><div class="l"><span>'+esc(x.categoria)+'</span>'+
        '<span class="mu">'+brl(x.valor_bruto)+(orc?' <small>de '+brl(orc)+'</small>':'')+'</span></div>'+
        '<div class="barra"><i class="'+cls+'" style="width:'+larg+'%'+
        (orc?'':';background:'+(x.cor_fundo||"var(--ac)"))+'"></i></div></button>';
    }).join("")+'</div>';
  }

  if((pe.data||[]).length){
    h+='<h2>Pendências · '+pe.data.length+'</h2><div class="lista">'+pe.data.map(x=>
      '<button class="item" data-corr="'+x.id+'"><span class="dot" style="background:var(--wr)"></span>'+
      '<span class="ct"><span class="nm">'+esc(x.descricao)+'</span><span class="mt">'+
      esc([MESES[+x.competencia.slice(5,7)-1].slice(0,3)+"/"+x.competencia.slice(2,4),
           x.categoria_nome?null:"sem categoria", x.conta_nome?null:"sem forma de pagamento"]
          .filter(Boolean).join(" · "))+'</span></span><span class="vl">'+brl(x.valor)+
      '</span></button>').join("")+'</div>';
  }
  h+='<div style="height:30px"></div>';
  alvo.innerHTML=h;

  const acha=id=>lanc.find(x=>x.id===id)||(pe.data||[]).find(x=>x.id===id);
  alvo.querySelectorAll("[data-lq]").forEach(b=>b.onclick=()=>{S.liquido=b.dataset.lq==="1";telaMes();});
  alvo.querySelectorAll(".pcard").forEach(b=>b.onclick=()=>sheetReceber(b.dataset.pes,b.dataset.nome));
  alvo.querySelectorAll("[data-fat]").forEach(b=>b.onclick=()=>
    sheetFatura(b.dataset.fat,b.dataset.nome,+b.dataset.v,b.dataset.pg==="1"));
  alvo.querySelectorAll("[data-orc]").forEach(b=>b.onclick=()=>
    sheetOrcamento(b.dataset.orc,b.dataset.nome,+b.dataset.lim));
  alvo.querySelectorAll("[data-ent]").forEach(b=>b.onclick=()=>
    sheetEntrada((en.data||[]).find(z=>z.id===b.dataset.ent)));
  alvo.querySelectorAll("[data-corr]").forEach(b=>b.onclick=()=>sheetItem(acha(b.dataset.corr)));
  alvo.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>sheetItem(acha(b.dataset.id)));
  const bNova=alvo.querySelector("#novaEnt");
  if(bNova) bNova.onclick=()=>sheetEntrada(null);
  ligarSwipe(alvo,id=>formEventos(sheet("Editar",formHTML(acha(id))),acha(id)),
                  id=>confirmarExclusao(acha(id)));
  const qb=$("#qBusca");
  let t; qb.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{S.busca=qb.value.trim();telaMes();},350);};
  $("#qAno").onclick=()=>{S.noAno=!S.noAno;telaMes();};
  if(S.busca){qb.focus();qb.setSelectionRange(qb.value.length,qb.value.length);}
}

function linha(x){
  const meta=[x.data_compra?x.data_compra.slice(8,10)+"/"+x.data_compra.slice(5,7):"",
              x.conta_nome].filter(Boolean).join(" · ");
  const bd=x.parcela_num?'<span class="bdg">'+x.parcela_num+(x.parcelas_total?"/"+x.parcelas_total:"")+"</span>":
           (x.origem==="fixo"?'<span class="bdg">'+(x.pago?"pago":"fixo")+"</span>":"");
  const mes=S.noAno?'<span class="bdg">'+MESES[+x.competencia.slice(5,7)-1].slice(0,3)+"</span>":"";
  return '<div class="swipe" data-sw="'+x.id+'"><div class="acoes">'+
    '<button type="button" class="ed">Editar</button>'+
    '<button type="button" class="ex">Excluir</button></div>'+
    '<button class="item" data-id="'+x.id+'"><span class="dot" style="background:'+
    (x.categoria_cor||"#555")+'"></span><span class="ct"><span class="nm">'+esc(x.descricao)+bd+mes+
    '</span><span class="mt">'+esc(meta||"sem tipo")+'</span></span>'+
    '<span class="vl'+(x.valor<0?" ok":"")+'">'+brl(x.valor)+'</span></button></div>';
}

/* deslizar para editar ou excluir */
function ligarSwipe(raiz,onEd,onEx){
  let alvo=null,x0=0,y0=0,dir=null;
  const fecha=()=>raiz.querySelectorAll(".swipe.aberto").forEach(s=>s.classList.remove("aberto"));
  raiz.addEventListener("touchstart",e=>{
    const s=e.target.closest(".swipe");
    if(!s){fecha();alvo=null;return;}
    if(!s.classList.contains("aberto")) fecha();
    alvo=s; x0=e.touches[0].clientX; y0=e.touches[0].clientY; dir=null;},{passive:true});
  raiz.addEventListener("touchmove",e=>{
    if(!alvo) return;
    const dx=e.touches[0].clientX-x0, dy=e.touches[0].clientY-y0;
    if(dir===null){ if(Math.abs(dx)<7&&Math.abs(dy)<7) return;
      dir=Math.abs(dx)>Math.abs(dy)?"h":"v"; }
    if(dir!=="h") return;
    const it=alvo.querySelector(".item");
    const base=alvo.classList.contains("aberto")?-144:0;
    it.style.transition="none";
    it.style.transform="translateX("+Math.max(-150,Math.min(0,base+dx))+"px)";},{passive:true});
  raiz.addEventListener("touchend",()=>{
    if(!alvo){dir=null;return;}
    const it=alvo.querySelector(".item");
    const m=/-?[\d.]+/.exec(it.style.transform||"");
    const cur=m?parseFloat(m[0]):0;
    it.style.transition=""; it.style.transform="";
    if(dir==="h") alvo.classList.toggle("aberto",cur<-62);
    alvo=null; dir=null;});
  raiz.querySelectorAll(".swipe .ed").forEach(b=>b.onclick=e=>{
    e.stopPropagation(); fecha(); onEd(b.closest(".swipe").dataset.sw);});
  raiz.querySelectorAll(".swipe .ex").forEach(b=>b.onclick=e=>{
    e.stopPropagation(); fecha(); onEx(b.closest(".swipe").dataset.sw);});
}

/* exclusão sempre pede confirmação */
function confirmarExclusao(x){
  if(!x) return;
  const bg=sheet("Excluir lançamento",
    '<p class="mu" style="margin:-6px 0 16px;line-height:1.5">Excluir <b style="color:var(--tx)">'+
    esc(x.descricao)+'</b> de '+brl(x.valor)+'? Essa ação não tem desfazer.</p>'+
    '<button class="btn per" id="xUm">Excluir'+(x.compra_id?" só esta parcela":"")+'</button>'+
    (x.compra_id?'<div style="height:10px"></div>'+
      '<button class="btn per" id="xTodas">Excluir todas as parcelas da compra</button>':'')+
    '<div style="height:10px"></div><button class="btn sec" id="xNao">Cancelar</button>');
  bg.querySelector("#xUm").onclick=()=>excluir(sb.from("lancamento").delete().eq("id",x.id));
  const bt=bg.querySelector("#xTodas");
  if(bt) bt.onclick=()=>excluir(sb.from("lancamento").delete().eq("compra_id",x.compra_id));
  bg.querySelector("#xNao").onclick=fechar;
}

/* ---------------- novo lançamento ---------------- */
export function sheetNovoLancamento(){
  const C=S.cad;
  let modo="avista";
  const bg=sheet("Novo lançamento",
    '<div class="chips" id="nmModo" style="margin-bottom:14px">'+
      [["avista","À vista"],["parcelado","Parcelado"],["fixo","Fixo"]].map((m,i)=>
      '<button type="button" class="chip'+(i===0?" on":"")+'" data-m="'+m[0]+'">'+m[1]+"</button>").join("")+'</div>'+
    '<label class="campo"><span>Descrição</span><input class="inp" id="nDesc" placeholder="Supermercado, assinatura…"></label>'+
    '<div class="linha2"><label class="campo"><span>Valor</span>'+
      '<input class="inp" id="nValor" inputmode="decimal" placeholder="0,00"></label>'+
    '<label class="campo" id="nDataBox"><span>Data</span><input class="inp" type="date" id="nData" value="'+hojeISO()+'"></label></div>'+
    '<div class="linha2"><label class="campo"><span>Categoria</span><select class="inp" id="nCat"><option value="">—</option>'+
      C.cat.map(c=>'<option value="'+c.id+'">'+esc(c.nome)+'</option>').join("")+'</select></label>'+
    '<label class="campo"><span>Forma de pagamento</span><select class="inp" id="nConta"><option value="">—</option>'+
      C.contas.map(c=>'<option value="'+c.id+'">'+esc(c.nome)+'</option>').join("")+'</select></label></div>'+
    '<div id="nExtra"></div>'+
    '<div class="grupo" style="margin-top:18px"><span>Dividir com alguém</span></div>'+
    '<div class="chips" id="nPessoas">'+C.pessoas.map(p=>
      '<button type="button" class="chip" data-p="'+p.id+'">'+esc(p.nome)+'</button>').join("")+'</div>'+
    '<div id="nRateios"></div>'+
    '<div style="height:16px"></div><button class="btn" id="nOk">Lançar</button>');

  const extra=bg.querySelector("#nExtra");
  function pintaExtra(){
    if(modo==="parcelado"){
      extra.innerHTML='<div class="linha2"><label class="campo"><span>Parcelas</span>'+
        '<input class="inp" type="number" min="1" max="60" id="nTot" value="2"></label>'+
        '<label class="campo"><span>Esta é a parcela nº</span>'+
        '<input class="inp" type="number" min="1" id="nNum" value="1"></label></div>'+
        '<label class="sw">Lançar as próximas parcelas nos meses seguintes<input type="checkbox" id="nRep" checked></label>';
    } else if(modo==="fixo"){
      extra.innerHTML='<div class="linha2"><label class="campo"><span>Vence no dia</span>'+
        '<input class="inp" type="number" min="1" max="31" id="nVenc" placeholder="—"></label>'+
        '<label class="campo"><span>Até quando (opcional)</span><input class="inp" type="month" id="nFim"></label></div>'+
        '<div class="mu" style="font-size:.76rem;margin:4px 0 0">Lançada automaticamente todo mês a partir de '+
        MESES[S.mes]+" de "+S.ano+', até ser desativada ou até o mês final.</div>';
    } else extra.innerHTML="";
  }
  pintaExtra();
  bg.querySelectorAll("#nmModo .chip").forEach(b=>b.onclick=()=>{
    modo=b.dataset.m; pintaExtra();
    bg.querySelectorAll("#nmModo .chip").forEach(o=>o.classList.toggle("on",o===b));
    bg.querySelector("#nDataBox").classList.toggle("hide",modo==="fixo");
  });

  const pessoasSel=new Set();
  function pintaRateios(){
    const rt=bg.querySelector("#nRateios");
    if(!pessoasSel.size){ rt.innerHTML=""; return; }
    rt.innerHTML=[...pessoasSel].map(pid=>{
      const nome=(C.pessoas.find(p=>p.id===pid)||{}).nome||"";
      return '<div class="rat"><span class="nm">'+esc(nome)+'</span>'+
        '<select class="inp un" data-rt="'+pid+'" data-f="tipo">'+
        '<option value="percentual">%</option><option value="valor">R$</option></select>'+
        '<input class="inp qtd" data-rt="'+pid+'" data-f="qtd" inputmode="decimal" placeholder="0"></div>';
    }).join("");
  }
  bg.querySelectorAll("#nPessoas .chip").forEach(b=>b.onclick=()=>{
    const pid=b.dataset.p;
    b.classList.toggle("on");
    b.classList.contains("on")?pessoasSel.add(pid):pessoasSel.delete(pid);
    pintaRateios();
  });

  bg.querySelector("#nOk").onclick=async e=>{
    const btn=e.currentTarget;
    const desc=bg.querySelector("#nDesc").value.trim();
    const valor=num(bg.querySelector("#nValor").value);
    if(!desc) return toast("Informe a descrição.","e");
    if(isNaN(valor)||valor===0) return toast("Informe um valor.","e");
    const catId=bg.querySelector("#nCat").value||null;
    const contaId=bg.querySelector("#nConta").value||null;

    let rateios=[], invalido=false;
    pessoasSel.forEach(pid=>{
      const tp=bg.querySelector('[data-rt="'+pid+'"][data-f="tipo"]').value;
      const q=num(bg.querySelector('[data-rt="'+pid+'"][data-f="qtd"]').value);
      if(isNaN(q)||q<=0) invalido=true;
      rateios.push({pessoa_id:pid,percentual:tp==="percentual"?q:null,valor:tp==="valor"?q:null});
    });
    if(invalido) return toast("Preencha o valor da divisão de cada pessoa.","e");

    btn.disabled=true; btn.textContent="Lançando…";
    try{
      if(modo==="fixo"){
        const venc=parseInt(bg.querySelector("#nVenc").value,10)||null;
        const fimStr=bg.querySelector("#nFim").value;
        const {data:rec,error}=await sb.from("recorrencia").insert({
          nome:desc,valor_padrao:valor,categoria_id:catId,conta_id:contaId,
          dia_vencimento:venc,mes_inicio:comp(),mes_fim:fimStr?fimStr+"-01":null
        }).select().single();
        if(error) throw error;
        if(rateios.length){
          const {error:e2}=await sb.from("recorrencia_rateio").insert(
            rateios.map(r=>({recorrencia_id:rec.id,pessoa_id:r.pessoa_id,
              percentual:r.percentual!=null?r.percentual:Math.round(r.valor/valor*10000)/100})));
          if(e2) throw e2;
        }
        await sb.rpc("preparar_mes",{p_competencia:comp()});
      } else {
        const {error}=await sb.rpc("novo_lancamento",{p:{
          modo,competencia:comp(),descricao:desc,valor,
          data:bg.querySelector("#nData").value||null,
          categoria_id:catId,conta_id:contaId,
          parcelas_total:modo==="parcelado"?(parseInt(bg.querySelector("#nTot").value,10)||1):1,
          parcela_atual:modo==="parcelado"?(parseInt(bg.querySelector("#nNum").value,10)||1):1,
          repetir:modo==="parcelado"?bg.querySelector("#nRep").checked:true,
          rateios
        }});
        if(error) throw error;
      }
      fechar(); toast("Lançado."); carregar();
    }catch(err){
      btn.disabled=false; btn.textContent="Lançar";
      erro(err);
    }
  };
}

/* ---------------- editar lançamento ---------------- */
function formHTML(x){
  const C=S.cad;
  return '<label class="campo"><span>Descrição</span><input class="inp" id="fDesc" value="'+
      esc(x.descricao||"")+'"></label>'+
    '<div class="linha2"><label class="campo"><span>Valor</span><input class="inp" id="fValor" inputmode="decimal" value="'+
      Number(x.valor).toFixed(2).replace(".",",")+'"></label>'+
    '<label class="campo"><span>Data</span><input class="inp" type="date" id="fData" value="'+
      (x.data_compra||"")+'"></label></div>'+
    '<div class="linha2"><label class="campo"><span>Categoria</span><select class="inp" id="fCat"><option value="">—</option>'+
      C.todasCat.map(c=>'<option value="'+c.id+'"'+(c.id===x.categoria_id?" selected":"")+'>'+esc(c.nome)+'</option>').join("")+
      '</select></label>'+
    '<label class="campo"><span>Forma de pagamento</span><select class="inp" id="fConta"><option value="">—</option>'+
      C.todasContas.map(c=>'<option value="'+c.id+'"'+(c.id===x.conta_id?" selected":"")+'>'+esc(c.nome)+'</option>').join("")+
      '</select></label></div>'+
    '<div style="height:14px"></div><button class="btn" id="fOk">Salvar</button>';
}
function formEventos(bg,x){
  bg.querySelector("#fOk").onclick=async e=>{
    const btn=e.currentTarget;
    const desc=bg.querySelector("#fDesc").value.trim();
    const valor=num(bg.querySelector("#fValor").value);
    if(!desc) return toast("Informe a descrição.","e");
    if(isNaN(valor)||valor===0) return toast("Informe um valor.","e");
    btn.disabled=true; btn.textContent="Salvando…";
    const {error}=await sb.from("lancamento").update({
      descricao:desc,valor,data_compra:bg.querySelector("#fData").value||null,
      categoria_id:bg.querySelector("#fCat").value||null,
      conta_id:bg.querySelector("#fConta").value||null
    }).eq("id",x.id);
    btn.disabled=false; btn.textContent="Salvar";
    if(error) return erro(error);
    fechar(); toast("Salvo."); telaMes();
  };
}

/* ---------------- fatura ---------------- */
async function sheetFatura(contaId,nome,valor,pago){
  const {data,error}=await sb.from("v_lancamento").select("*")
    .eq("competencia",comp()).eq("conta_id",contaId)
    .order("data_compra",{ascending:false,nullsFirst:false});
  if(error) return erro(error);
  const its=data||[];
  const bg=sheet(nome,
    '<div class="mu" style="margin:-8px 0 12px;font-size:.86rem">'+its.length+' lançamentos · '+
    '<b style="color:var(--tx)">'+brl(valor)+'</b></div>'+
    '<label class="sw">Fatura paga<input type="checkbox" id="fPago"'+(pago?" checked":"")+'></label>'+
    '<div class="lista" style="margin-top:8px;max-height:48dvh;overflow:auto">'+
    (its.length?its.map(x=>'<div class="item"><span class="dot" style="background:'+
      (x.categoria_cor||"#555")+'"></span><span class="ct"><span class="nm">'+esc(x.descricao)+
      (x.parcela_num?'<span class="bdg">'+x.parcela_num+"/"+x.parcelas_total+"</span>":"")+
      '</span><span class="mt">'+esc([x.data_compra?x.data_compra.slice(8,10)+"/"+x.data_compra.slice(5,7):"",
      x.categoria_nome].filter(Boolean).join(" · "))+'</span></span><span class="vl">'+
      brl(x.valor)+'</span></div>').join("")
      :'<div class="vazio">Nada nesta fatura.</div>')+'</div>');
  bg.querySelector("#fPago").onchange=async e=>{
    const p=e.target.checked;
    const {error}=await sb.from("fatura").upsert({conta_id:contaId,competencia:comp(),pago:p,
      data_pagamento:p?hojeISO():null},{onConflict:"conta_id,competencia"});
    if(error) return erro(error);
    toast(p?"Fatura marcada como paga.":"Fatura reaberta."); telaMes();};
}

/* ---------------- orçamento ---------------- */
function sheetOrcamento(catId,nome,atual){
  const bg=sheet("Limite de "+nome,
    '<label class="campo"><span>Limite mensal</span><input class="inp" id="oVal" inputmode="decimal" '+
    'placeholder="0,00" value="'+(atual>0?Number(atual).toFixed(2).replace(".",","):"")+'"></label>'+
    '<label class="sw">Aplicar deste mês até dezembro<input type="checkbox" id="oProp" checked></label>'+
    '<div class="mu" style="font-size:.76rem;margin:4px 0 0">Deixe em branco para remover o limite. '+
    'Quando o gasto passar de 80% a barra fica amarela, e acima de 100% vermelha, com aviso no topo da tela.</div>'+
    '<div style="height:14px"></div><button class="btn" id="oOk">Salvar</button>');
  bg.querySelector("#oOk").onclick=async e=>{
    const btn=e.currentTarget, v=num(bg.querySelector("#oVal").value);
    btn.disabled=true; btn.textContent="Salvando…";
    const {error}=await sb.rpc("definir_orcamento",{p_categoria:catId,p_competencia:comp(),
      p_valor:isNaN(v)?null:v,p_propagar:bg.querySelector("#oProp").checked});
    btn.disabled=false; btn.textContent="Salvar";
    if(error) return erro(error);
    fechar(); toast("Limite salvo."); telaMes();};
}

/* ---------------- a receber ---------------- */
async function sheetReceber(pid,nome){
  const [it,tot]=await Promise.all([
    sb.from("rateio").select("id,recebido,percentual,valor,lancamento:lancamento_id(descricao,valor,competencia)")
      .eq("pessoa_id",pid),
    sb.from("v_a_receber_pessoa").select("*").eq("pessoa_id",pid).maybeSingle()]);
  if(it.error) return erro(it.error);
  const mes=(it.data||[]).filter(r=>r.lancamento&&r.lancamento.competencia===comp());
  const T=tot.data||{pendente:0,itens:0,desde:null};
  const bg=sheet(nome,
    '<div class="kpis" style="margin:-4px 0 14px"><div class="kpi"><small>Em aberto no total</small>'+
    '<b class="'+(+T.pendente>0?"wr":"ok")+'">'+brl(T.pendente)+'</b></div>'+
    '<div class="kpi"><small>Itens pendentes</small><b>'+T.itens+
    (T.desde?' <span class="mu" style="font-size:.7rem">desde '+
      MESES[+T.desde.slice(5,7)-1].slice(0,3)+"/"+T.desde.slice(2,4)+'</span>':'')+'</b></div></div>'+
    '<div class="lista">'+(mes.length?mes.map(r=>{
      const v=r.valor!=null?r.valor:(Number(r.lancamento.valor)*Number(r.percentual)/100);
      return '<label class="item"><input type="checkbox" data-r="'+r.id+'"'+(r.recebido?" checked":"")+
        ' style="width:22px;height:22px;accent-color:#7C5CFF"><span class="ct"><span class="nm">'+
        esc(r.lancamento.descricao)+'</span><span class="mt">'+
        (r.percentual?r.percentual+"% de "+brl(r.lancamento.valor):"valor combinado")+
        '</span></span><span class="vl">'+brl(v)+'</span></label>';}).join("")
      :'<div class="vazio">Nada neste mês.</div>')+'</div>'+
    '<div style="height:12px"></div>'+
    (mes.some(r=>!r.recebido)?'<button class="btn sec" id="rMes">Marcar o mês inteiro como recebido</button>'+
      '<div style="height:10px"></div>':'')+
    (+T.pendente>0?'<button class="btn sec" id="rTudo">Quitar tudo que está em aberto</button>'+
      '<div style="height:10px"></div>':'')+
    '<button class="btn" id="okR">Pronto</button>');
  bg.querySelectorAll("[data-r]").forEach(ch=>ch.onchange=async()=>{
    const {error}=await sb.from("rateio").update({recebido:ch.checked,
      data_recebimento:ch.checked?hojeISO():null}).eq("id",ch.dataset.r);
    if(error) erro(error);});
  const quitar=mc=>async e=>{
    const btn=e.currentTarget, antes=btn.textContent;
    btn.disabled=true; btn.textContent="Marcando…";
    const {data,error}=await sb.rpc("marcar_recebido",{p_pessoa:pid,p_competencia:mc});
    btn.disabled=false; btn.textContent=antes;
    if(error) return erro(error);
    fechar(); toast(data+" item(ns) marcado(s) como recebido."); telaMes();};
  const bm=bg.querySelector("#rMes"); if(bm) bm.onclick=quitar(comp());
  const bt=bg.querySelector("#rTudo"); if(bt) bt.onclick=quitar(null);
  bg.querySelector("#okR").onclick=()=>{fechar();telaMes();};
}

/* ---------------- entradas ---------------- */
function sheetEntrada(x){
  const novo=!x;
  x=x||{descricao:"",valor:"",recorrente:true,recebido:false};
  const bg=sheet(novo?"Nova entrada":"Editar entrada",
    '<label class="campo"><span>Descrição</span><input class="inp" id="eDesc" value="'+
      esc(x.descricao||"")+'" placeholder="Salário, aluguel recebido…"></label>'+
    '<label class="campo"><span>Valor</span><input class="inp" id="eValor" inputmode="decimal" '+
      'placeholder="0,00" value="'+(novo?"":Number(x.valor).toFixed(2).replace(".",","))+'"></label>'+
    '<label class="sw">Repete todo mês<input type="checkbox" id="eRec"'+(x.recorrente?" checked":"")+'></label>'+
    '<label class="sw">Já recebida<input type="checkbox" id="eOk"'+(x.recebido?" checked":"")+'></label>'+
    '<div class="mu" style="font-size:.76rem;margin:6px 0 0">Marcada para repetir, ela é criada sozinha '+
    'quando você abrir um mês novo.</div>'+
    '<div style="height:14px"></div><button class="btn" id="eSalvar">'+(novo?"Criar":"Salvar")+'</button>'+
    (novo?"":'<div style="height:10px"></div><button class="btn per" id="eDel">Excluir</button>'));

  bg.querySelector("#eSalvar").onclick=async ev=>{
    const btn=ev.currentTarget;
    const d=bg.querySelector("#eDesc").value.trim(), v=num(bg.querySelector("#eValor").value);
    if(!d) return toast("Informe a descrição.","e");
    if(isNaN(v)) return toast("Informe um valor válido.","e");
    const rec=bg.querySelector("#eOk").checked;
    const dados={descricao:d,valor:v,recorrente:bg.querySelector("#eRec").checked,
      recebido:rec,data_recebimento:rec?hojeISO():null};
    btn.disabled=true; btn.textContent="Salvando…";
    const {error}=novo?await sb.from("entrada").insert({...dados,competencia:comp()})
                      :await sb.from("entrada").update(dados).eq("id",x.id);
    btn.disabled=false; btn.textContent=novo?"Criar":"Salvar";
    if(error) return erro(error);
    fechar(); toast("Salvo."); telaMes();
  };

  const d=bg.querySelector("#eDel");
  d&&(d.onclick=async()=>{
    const {error}=await sb.from("entrada").delete().eq("id",x.id);
    if(error) return erro(error);
    fechar(); toast("Excluída."); telaMes();});
}

/* ---------------- item: ações ---------------- */
function sheetItem(x){
  if(!x)return;
  const meta=[x.data_compra,x.conta_nome,x.categoria_nome].filter(Boolean).join(" · ");
  const bg=sheet(x.descricao,
    '<div class="mu" style="margin:-8px 0 16px;font-size:.86rem">'+brl(x.valor)+
      (meta?" · "+esc(meta):"")+'</div>'+
    (x.origem==="fixo"?'<label class="sw">Pago neste mês<input type="checkbox" id="iPago"'+
      (x.pago?" checked":"")+"></label>":"")+
    '<button class="btn sec" id="iEd">Editar</button><div style="height:10px"></div>'+
    '<button class="btn per" id="iEx">Excluir</button>');
  bg.querySelector("#iPago")?.addEventListener("change",async e=>{
    const {error}=await sb.from("lancamento").update({pago:e.target.checked,
      data_pagamento:e.target.checked?hojeISO():null}).eq("id",x.id);
    error?erro(error):toast(e.target.checked?"Marcado como pago.":"Marcado como a pagar.");});
  bg.querySelector("#iEd").onclick=()=>formEventos(sheet("Editar",formHTML(x)),x);
  bg.querySelector("#iEx").onclick=()=>confirmarExclusao(x);
}
async function excluir(p){ const {error}=await p; if(error)return erro(error);
  fechar(); toast("Excluído."); carregar(); }
