# Scorecard: Detector de campos obrigatórios faltando no CSV de catálogo ML

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: seller exporta planilha de anúncios ML; a página lista linhas com campos obrigatórios vazios.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | Reprova | Filtrar colunas vazias no Excel/ChatGPT é trivial. |
| 2 | O que falta à IA | Passa (fraca) | Arquivo do usuário. |
| 3 | Dor real | **Reprova** | A própria planilha do ML tem coluna **"Resumo de erros"** que indica o que falta (https://vendedores.mercadolivre.com.br/nota/entenda-como-preencher-sua-planilha-excel-para-anunciar-em-m). O problema já é resolvido na origem. |
| 4 | Prova de interesse | Fraca | Docs oficiais cobrem o fluxo. |
| 5 | Dado legítimo | Passa | Export do seller. |

## Notas
Não pontuada: gates 1 e 3.

## Decisão
**MORTA nos gates 1 e 3.**
