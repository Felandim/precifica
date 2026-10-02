# Scorecard: Export WhatsApp (.txt/.zip) → resumo de pedidos/leads (sellers)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: seller exporta conversas do WhatsApp Business e recebe planilha com possíveis pedidos (R$, "quero", nº pedido) e leads.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Reprova** | Interpretar pedido em prosa é exatamente o forte do ChatGPT. Converter .txt WhatsApp→CSV é tutorial comum (Medium, userscripts). Heurística por palavra-chave no browser erra demais vs. o chat. CatalogoZap e CRMs cobram o fluxo estruturado via API de catálogo, não via export txt. |
| 2 | O que falta à IA | Passa | Arquivo do usuário. |
| 3 | Dor real | Passa | Pedidos no Zap sem ERP (https://www.negocionoautomaticobr.com.br/blog/whatsapp/receber-pedido-catalogo-whatsapp-cloud-api-webhook-order-passo-a-passo). |
| 4 | Prova de interesse | Passa (para CRM/API); fraca para "parser de export txt". |
| 5 | Dado legítimo | Passa | Export nativo WhatsApp (https://faq.whatsapp.com/1180414079177245). |

## Notas
Não pontuada: gate 1.

## Decisão
**MORTA no gate 1.**
