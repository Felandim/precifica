# Scorecard: Tabela de frete por CEP em lote (CSV do usuário / Correios)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: seller cola lista de CEPs + peso/dimensões e recebe prazo/preço, ou valida tabela CSV de faixas CEP.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | Passa (fraca) | ChatGPT não tem cotação ao vivo. |
| 2 | O que falta à IA | **Passa** se houver API/tabela viva; **senão falha**. |
| 3 | Dor real | Passa | Lojas montam CSV de faixas (Loja Integrada, Tray). |
| 4 | Prova de interesse | Passa | Docs de plataformas sobre tabela CEP. |
| 5 | Dado legítimo | **Reprova (no nosso escopo)** | Calculador Correios oficial é interativo; API/contrato Correios exige credencial e tem ToS. Sem login/credencial do Felipe, não há fonte legítima de preço ao vivo. Validar só o CSV do usuário (faixas sobrepostas) é utilitário fraco que o Excel resolve — cai no teste da IA. |

## Notas
Não pontuada: gate 5 (e gate 2 sem dado vivo).

## Decisão
**MORTA no gate 5.**
