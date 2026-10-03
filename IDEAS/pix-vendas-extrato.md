# Scorecard: PIX de vendas × extrato bancário

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-03 (PT). Lote 2026-10-03.

Ideia: créditos PIX no extrato × planilha de vendas (casa E2E/txid, depois valor+data). Distinto de `extrato-x-saques-mp` (que é saques MP × banco).

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | VLOOKUP em CSV pequeno; falha em E2E/txid e volume. ~50%. |
| 2 | O que falta à IA | **Passa** | Dois arquivos do usuário. |
| 3 | Dor real | **Passa** | Contplan: diferenças entre vendas, extrato e taxas no PIX (https://www.contplan.com.br/pix-e-conciliacao-bancaria-como-reduzir-diferencas-entre-vendas-extrato-e-taxas/). MP documenta fechamento de caixa / conciliação (https://www.mercadopago.com.br/blog/guia-conciliacao-vendas-conta-negocio). |
| 4 | Prova de interesse | **Passa** | Contplan, Pagare (webhooks ERP), blogs MP. Sobreposição com o que ERPs já fazem via API. |
| 5 | Dado legítimo | **Passa** | Extrato + planilha própria do seller. |

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Diário/semanal quem recebe PIX direto. |
| 7 | Fosso | **1** | Copiável; sobrepõe extrato×saques já no ar. |
| 8 | Distribuição | **2** | SEO "conciliação pix vendas". |
| 9 | Caminho para pagamento | **2** | Divergência real, mas público mais amplo (não só ML) dilui funil Precifica. |
| 10 | Custo de manutenção | **2** | Layouts de extrato + formatos de txid variam. |
| 11 | Métrica de 14 dias | **2** | Métrica ok, mas sinal de interesse pode misturar com extrato×saques. |

**Total: 11/18.** Gates: 5/5.

## Decisão
**REPROVA na régua 13.** Fallback 11 ok, mas perde para auditor (13) e nfe-xml-x-extrato (12). Risco de canibalizar `extrato-x-saques-mp`.
