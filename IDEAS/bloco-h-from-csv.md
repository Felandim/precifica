# Scorecard: Inventário CSV → linhas SPED Bloco H (H010)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-03 (PT). Lote 2026-10-03.

Ideia: CSV de inventário → gera linhas H010 do SPED Fiscal.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | Formato H010 é documentado; chat gera poucas linhas. Volume + validação de campos (CST, conta contábil) é arquivo do usuário. ~60%. |
| 2 | O que falta à IA | **Passa** | Arquivo do usuário. |
| 3 | Dor real | **Passa (fraca)** | Contadores geram Bloco H no ERP (Sankhya, IOB). Dor existe no fechamento anual. |
| 4 | Prova de interesse | **Passa (fraca)** | Manuais gov.br SPED / ERPs; pouco volume de busca "gerar h010 csv" vs ferramentas seller. |
| 5 | Dado legítimo | **Passa** | Layout oficial EFD ICMS-IPI. |

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **0** | Tipicamente **uma vez por ano** (31/12). |
| 7 | Fosso | **0** | Texto fixo; ERPs já geram. |
| 8 | Distribuição | **1** | SEO nicho contábil, fora do funil ML. |
| 9 | Caminho para pagamento | **1** | Contador usa ERP pago; difícil PIX. |
| 10 | Custo de manutenção | **2** | Layout muda com NT ocasional. |
| 11 | Métrica de 14 dias | **2** | Definível, mas janela anual mata o kill de 14 dias. |

**Total: 6/18.** Gates: 5/5 (fracos).

## Decisão
**REPROVA (<11).** Frequência anual mata o lote diário.
