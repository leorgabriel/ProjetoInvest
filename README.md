# ProjetoInvest

Controle financeiro pessoal. Aplicação web instalável (PWA) construída para substituir
uma planilha de controle de gastos, com os dados em um banco relacional.

**No ar:** https://leorgabriel.github.io/ProjetoInvest/

## Arquitetura

| Camada | Escolha |
|---|---|
| Interface | HTML, CSS e JavaScript sem framework, em arquivo único |
| Hospedagem | GitHub Pages |
| Dados e autenticação | Supabase (PostgreSQL + Auth) |
| Acesso aos dados | PostgREST e funções RPC, direto do navegador |

Não há servidor próprio nem etapa de build: o navegador fala direto com o Postgres
através da API do Supabase, e toda a autorização é feita no banco.

## Segurança

- **Row Level Security** em todas as tabelas, com a política `user_id = auth.uid()`.
  Sem sessão válida, qualquer consulta volta vazia.
- **Views com `security_invoker`**, para que os relatórios respeitem a RLS de quem consulta.
- **Cadastro por convite**: um gatilho em `auth.users` recusa qualquer e-mail que não
  esteja na tabela `convite`.
- A chave publicável no código do cliente é pública por projeto e não concede acesso
  a dado nenhum sozinha.

## Modelo de dados

```
categoria · conta_pagamento · pessoa      cadastros
compra ──< lancamento >── rateio >── pessoa
recorrencia ──< lancamento                contas fixas geradas por mês
entrada · orcamento · fatura              receitas, limites e faturas
investimento ──< movimento_investimento   patrimônio, separado do saldo
```

A tabela central é `lancamento`, com uma linha por gasto e por mês de competência.
Compras parceladas são uma `compra` com N lançamentos; contas fixas são uma
`recorrencia` que gera um lançamento por mês; e `rateio` registra a parte de cada
pessoa num gasto dividido, em percentual ou em valor.

## Funcionalidades

- Lançamento à vista, parcelado e fixo, com divisão entre pessoas
- Orçamento por categoria com alerta de estouro
- Projeção de fechamento do mês pelo ritmo de gastos
- Faturas por cartão, com detalhamento e baixa
- Controle do que cada pessoa deve, com quitação em lote
- Comprometimento dos meses futuros e fechamento anual
- Acompanhamento de investimentos, separado do saldo corrente

## Estrutura

```
index.html        aplicação completa
backup/           exportações diárias do banco, em JSON
db/               notas sobre o esquema
```

## Banco

As migrações ficam versionadas no próprio Supabase e estão listadas em `db/migracoes.txt`.
O backup diário é gerado pela função `exportar_dados()` e gravado em `backup/`.
