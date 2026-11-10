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

## Backup

- `fazer_backup()` grava um snapshot JSON completo (`exportar_dados()`) na tabela
  `backup_diario`, que mantem os ultimos 30 dias. Agendado por `pg_cron` todos os
  dias as 06:10 UTC (03:10 em Brasilia).
- A tabela tem RLS ligado sem policies e `execute` revogado de `anon`/`authenticated`,
  ou seja: nao e acessivel pelo app, apenas pelo service role.
- Restaurar uma versao do HTML: `select restaurar_app(<id>)` (tabela `app_html_versao`,
  ultimas 30 versoes).
- **Atencao:** este repositorio e publico (necessario para o GitHub Pages), portanto
  nenhum export de dados deve ser commitado aqui.

### Copia off-site

O repositorio privado [ProjetoInvest-backup](https://github.com/leorgabriel/ProjetoInvest-backup)
guarda os ultimos 60 dias em JSON. Um GitHub Actions roda todo dia as 03:10, chama a
Edge Function `backup` (que exige o token da tabela `config_app` no header
`x-backup-token`) e commita o arquivo. O token nunca aparece em codigo: fica no
secret `BACKUP_TOKEN` daquele repositorio e no banco.
