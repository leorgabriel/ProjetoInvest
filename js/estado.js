export const MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const hoje=new Date();
export const S={ano:hoje.getFullYear(),mes:hoje.getMonth(),tela:"mes",liquido:false,cad:null,busca:"",noAno:false,secoes:{}};

export const preparados=new Set();
