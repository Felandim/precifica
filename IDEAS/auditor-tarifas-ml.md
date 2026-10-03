# Scorecard: Auditor de tarifas do Mercado Livre (Por venda / Faturamento)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-03 (PT). Lote 2026-10-03.

Ideia: o seller solta o CSV/XLSX de Conciliação **"Por venda"** (ou Faturamento) do ML. A página agrupa por Número da operação, calcula % de tarifas sobre o bruto, parseia "Detalhes de tarifas", resume por conceito (custo por vender, envio, etc.), e marca outliers vs mediana / limiar do usuário, operações duplicadas com tarifas conflitantes e linhas só de envio. **Não** replica a tabela oficial de tarifas — só audita o que o próprio relatório cobrou.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | ChatGPT calcula % em CSV pequeno. Falha no volume (milhares de linhas), no agrupamento multi-linha por operação (venda+envio+cancelamento), no parse de "Detalhes de tarifas" (texto livre / JSON), e em outliers vs mediana do lote. Estimo ~45% no chat. |
| 2 | O que falta à IA | **Passa** | Arquivo do usuário; processamento local em lote. |
| 3 | Dor real | **Passa** | Sellers perdem margem em taxas erradas (frete/cubagem, devolução, reembolso parcial) e não olham pedido a pedido. Hunter Hub: "Como recuperar dinheiro de taxas cobradas erradas" (https://hunterhub.com.br/blog/recuperar-taxas-mercado-livre/, jan/2026) e "Conciliação de taxas no Mercado Livre" (https://hunterhub.com.br/blog/conciliacao-taxas-mercado-livre-guia-completo/). |
| 4 | Prova de interesse | **Passa** | Hunter Hub cobrando a partir de **R$ 97/mês** com feature "Conciliação de taxas" (https://hunterhub.com.br/). Marketize e Koncili vendem conciliação/chargeback. Artigo Ferax sobre mudança de tarifas ML 2026 (https://ferax.com.br/blog/news/mercado-livre-muda-tarifas-em-2025-tabelas-de-custos-ferax/). |
| 5 | Dado legítimo | **Passa** | Export oficial que o seller baixa. Colunas do relatório documentadas na Central de Vendedores: https://vendedores.mercadolivre.com.br/aprender/nota/relatorio-detalhes-do-periodo-como-analisa-lo e o layout "Por venda" já usado pelo conferidor (`exemplos/conferidor-ml-exemplo-por-venda.csv`). Sem login nosso, sem scraping. |

**Existe grátis?** Não achei ferramenta grátis dedicada a "solte o Por venda e flag tarifas altas / por conceito". O conferidor Precifica confere venda×liberação e contas internas, **não** audita % vs mediana nem resume por keyword de tarifa. Hunter exige conta + API + assinatura.

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Fechamento semanal/mensal; quem já usa o conferidor fecha o mês. |
| 7 | Fosso | **1** | Código copiável; histórico local de auditorias ajudaria depois. |
| 8 | Distribuição | **2** | SEO ("auditoria taxas mercado livre", "taxas cobradas erradas") + funil do conferidor/extrato já no ar. |
| 9 | Caminho para pagamento | **3** | Achar cobrança alta → reclamação/estorno no ML = dinheiro recuperado. Hunter vende exatamente isso. PIX muito plausível. |
| 10 | Custo de manutenção | **2** | Nomes de coluna oficiais; texto de "Detalhes de tarifas" pode mudar (já tratado no conferidor com skip). Sem scrape. |
| 11 | Métrica de 14 dias | **3** | Abaixo. |

**Total: 13/18.** Gates: 5/5 (gate 1 fraca).

## Métrica de morte (definir antes de construir)
Janela: **2026-10-03 → 2026-10-17 PT**
1. ≥ 80 page views em `/auditor-tarifas-ml.html` (analytics here.now), **ou** visitas do site +15% vs. 14 dias anteriores se não houver dado por página;
2. **E** ≥ 1 PIX, mensagem citando a ferramenta, ou cobrança a mais real relatada.

Se 1 ou 2 falhar: tirar do ar, sem v2.

## Decisão
**PASSA na régua 13/18 → CONSTRUIR.** Melhor do lote 2026-10-03.
