import {DEBITO, mesDe, valorDe} from "./dados.js";

/* 6.3 Gastos fora do padrão.
   Um lançamento é fora do padrão quando o valor fica acima de média + 2 desvios-padrão
   da sua categoria, calculados sobre os lançamentos da mesma categoria nos 12 meses
   anteriores ao mês do lançamento (sem contar o próprio mês). A categoria só é avaliada
   se houver pelo menos 6 lançamentos nessa janela. Só gastos positivos são avaliados;
   lançamentos sem categoria ficam de fora. Valor bruto ou líquido segue o filtro global. */
export const JANELA_MESES=12, MIN_BASE=6, DESVIOS=2;

const idxMes=k=>{ const [a,m]=k.split("-").map(Number); return a*12+(m-1); };

/* devolve Map(lancamento_id -> {media, desvio, limite, base, excesso}) */
export function foraDoPadrao(D,F){
  const porCat=new Map();                       // categoria -> [{i, v}] em ordem de mês
  D.lanc.forEach(l=>{
    if(!l.categoria_id) return;
    if(!F.debito&&DEBITO.has(l.conta_especie)) return;
    const lista=porCat.get(l.categoria_id)||[];
    lista.push({id:l.id,i:idxMes(mesDe(l.competencia)),v:valorDe(l,F)});
    porCat.set(l.categoria_id,lista);
  });

  const res=new Map();
  porCat.forEach(lista=>{
    lista.sort((a,b)=>a.i-b.i);
    lista.forEach(alvo=>{
      if(!(alvo.v>0)) return;
      let n=0,s=0,s2=0;
      for(const x of lista){
        if(x.i>=alvo.i) break;                  // lista ordenada: daqui em diante é o próprio mês ou depois
        if(x.i<alvo.i-JANELA_MESES) continue;
        n++; s+=x.v; s2+=x.v*x.v;
      }
      if(n<MIN_BASE) return;
      // desvio-padrão amostral (n-1), o mesmo do DESVPAD do Excel
      const media=s/n, desvio=Math.sqrt(Math.max(0,(s2-n*media*media)/(n-1)));
      const limite=media+DESVIOS*desvio;
      if(alvo.v>limite+0.005) res.set(alvo.id,{media,desvio,limite,base:n,excesso:alvo.v-limite});
    });
  });
  return res;
}
