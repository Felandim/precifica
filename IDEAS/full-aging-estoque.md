# Scorecard: Aging de estoque Full (Excel Full → risco e custo estimado)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-04 (PT). Lote 2026-10-04.

Ideia: o seller solta o **Excel/CSV oficial do Full** (Controle de estoque / Relatório geral / consolidado). A página classifica aging (0–30 / 31–60 / 61–90 / 90+), estima **custo de armazenamento diário** com a tabela oficial de porte (editável), projeta o mês seguinte e marca SKUs perto do **custo por estoque antigo** (2 meses Supermercado / 4 meses demais). **Não** é a calculadora `custo-full.html`.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | ChatGPT aplica fórmula em 5 linhas (~40%). Falha no Excel Full em lote. |
| 2 | O que falta à IA | **Passa** | Arquivo do usuário (export Full). |
| 3 | Dor real | **Passa** | https://patrickcardoso.com.br/blog/mercado-livre-full-estoque-parado-2026 |
| 4 | Prova de interesse | **Passa** | https://envios.mercadolivre.com.br/mercado-envios-full ; https://ajudaecom.com.br/full-mercado-livre/ |
| 5 | Dado legítimo | **Passa** | https://vendedores.mercadolivre.com.br/aprender/nota/como-gerenciar-seu-estoque-full-com-os-relatorios-de-excel |

## Notas

| # | Critério | Nota |
|---|----------|------|
| 6 | Frequência | **2** |
| 7 | Fosso | **1** |
| 8 | Distribuição | **2** |
| 9 | Caminho para pagamento | **3** |
| 10 | Custo de manutenção | **2** |
| 11 | Métrica de 14 dias | **3** |

**Total: 13/18.** Gates: 5/5.

## Métrica de morte
Janela: **2026-10-04 → 2026-10-18 PT**: ≥80 PV **e** ≥1 PIX/mensagem/SKU encalhado.

## Decisão
**PASSA 13/18 → CONSTRUIR.**
