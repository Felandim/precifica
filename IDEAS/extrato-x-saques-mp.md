# Scorecard: Extrato bancário × saques/transferências Mercado Pago (no navegador)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-02 (PT). Lote 2026-10-02.

Ideia: o seller solta (1) extrato do banco em CSV/OFX e (2) relatório de liberações/saques do Mercado Pago (CSV/XLSX). A página casa créditos no banco com saques/transferências do MP (valor + janela de datas + palavras na descrição) e lista: saque sem crédito, crédito "Mercado Pago" sem saque, e diferenças de valor. **Não** é o conferidor venda×liberação (`conferidor-repasse-ml`); é o batimento bancário depois que o dinheiro sai do MP.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | ChatGPT faz VLOOKUP em 2 CSVs pequenos. Falha no volume, em OFX, em créditos agrupados vs várias liberações do mesmo dia, e em janela D+0/D+1. Korveo explica que o crédito no banco é lump sum e não bate com GMV nem com liberação linha a linha (https://korveo.com.br/blog/extrato-bancario-vs-vendas-ml, 2026-04-15). Estimo ~50% no chat. |
| 2 | O que falta à IA | **Passa** | Dois arquivos do usuário; matching local. |
| 3 | Dor real | **Passa** | Sellers olham GMV e não entendem o extrato. Korveo: "Por que o Extrato Bancário não Bate com as Vendas do Mercado Livre?" lista defasagem, repasses agrupados, estornos e tarifas. Koncili: OFX importa o consolidado mas não valida o marketplace (https://www.koncili.com/blog/conciliacao-bancaria-no-marketplace-cnab-e-ofx/). |
| 4 | Prova de interesse | **Passa** | Autocomplete/cauda "conciliação mercado livre", "conciliação bancária mercado livre" (já medida no scorecard do conferidor). Concorrentes pagos: Koncili, Marketize, Korveo, Hunter. MP documenta relatório de liberações/saques exportável em CSV (https://www.mercadopago.com.br/blog/relatorio-de-liberacao-de-saldo-na-conta-mercado-pago). |
| 5 | Dado legítimo | **Passa** | Exports oficiais do banco e do MP/ML que o próprio seller baixa. Sem login nosso, sem scraping. |

**Existe grátis?** Não achei ferramenta grátis dedicada a "solte extrato + saques MP". ERPs (Bling/Tiny) fazem via API paga/configurada. O conferidor Precifica cobre venda×liberação, não banco×saque.

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Fechamento semanal/mensal; alguns conferem a cada saque. |
| 7 | Fosso | **1** | Histórico local de batimentos ajudaria; código ainda é copiável. Pagos têm API. |
| 8 | Distribuição | **2** | Encaixa no SEO e no funil do conferidor já no ar (mesmo site, mesmo público). Compartilhamento baixo (finanças privadas), mas a ponte "já usei o conferidor → agora o banco" é real. |
| 9 | Caminho para pagamento | **2** | Pode achar saque sem cair no banco (dinheiro sumido) ou crédito fantasma — "achei dinheiro/problema". PIX plausível. |
| 10 | Custo de manutenção | **2** | Layouts de extrato variam por banco; OFX é mais estável. Descrições MP mudam pouco ("MERPAGO", "MERCADOPAGO"). Mesmo risco de parser do conferidor. |
| 11 | Métrica de 14 dias | **3** | Abaixo. |

**Total: 12/18.** Gates: 5/5 (gate 1 fraco).

## Métrica de morte (definir antes de construir)
Janela de 14 dias a partir da publicação (checar em **2026-10-16 PT** se publicar em 2026-10-02):
1. ≥ 80 page views em `/extrato-x-saques-mp.html` (analytics here.now), **ou** visitas do site +15% vs. 14 dias anteriores se não houver dado por página;
2. **E** ≥ 1 PIX, mensagem citando a ferramenta, ou divergência real relatada.

Se 1 ou 2 falhar: tirar do ar, sem v2.

## Decisão
**REPROVA na régua 13 (12/18).** Na régua de fallback **11/18, É CONSTRUÍVEL** — melhor nota do lote 2026-10-02.


---

## Decisão revisada: 2026-10-02 → CONSTRUIR (régua 11/18)

- Lote 2026-10-02: nenhuma ideia ≥ 13/18. Melhor ≥ 11: **extrato-x-saques-mp (12/18)**.
- Construído e publicado em 2026-10-02: `extrato-x-saques-mp.html`.
- Kill check: **2026-10-16 PT** (≥80 page views **e** ≥1 PIX/mensagem/divergência relatada).
