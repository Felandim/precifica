# Scorecard: Limpador de CSV para importação Bling / Conta Azul / Omie

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: seller solta planilha bagunçada; a página normaliza colunas, datas BR, CPF/CNPJ, remove mescladas/caracteres e gera CSV no modelo do ERP.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Reprova** | "Limpe este CSV para importar no Bling" é prompt clássico: ChatGPT devolve o arquivo corrigido. A própria Bling documenta os erros (https://ajuda.bling.com.br/hc/pt-br/articles/12039286702231). Sem regra proprietária viva, o chat cobre ≥80%. |
| 2 | O que falta à IA | Passa (fraca) | Arquivo do usuário, mas o chat também processa upload. |
| 3 | Dor real | Passa | Imports falham por formatação (Pipefy Community, Reclame Aqui Bling CEP). |
| 4 | Prova de interesse | Fraca | Há docs de erro, não produto dedicado cobrando "CSV cleaner Bling". |
| 5 | Dado legítimo | Passa | CSV do usuário. |

## Notas
Não pontuada: gate 1.

## Decisão
**MORTA no gate 1.**
