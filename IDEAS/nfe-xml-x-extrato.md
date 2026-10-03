# Scorecard: NF-e XML (entrada) × extrato bancário

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-03 (PT). Lote 2026-10-03.

Ideia: lote de XMLs de NF-e de entrada × débitos do banco (CSV/OFX). Casa por valor + janela de data (+ CNPJ na descrição quando houver). Lista: nota sem pagamento, pagamento sem nota, divergência de valor.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa** | ChatGPT não processa dezenas de XMLs + OFX de forma confiável no plano grátis; matching com janela e CNPJ exige os arquivos. Estimo <40% no chat. |
| 2 | O que falta à IA | **Passa** | Arquivos do usuário (XML + extrato). |
| 3 | Dor real | **Passa** | Contas a pagar: empresa paga fornecedor e precisa amarrar ao XML. Fisco/PlugContas vendem isso. |
| 4 | Prova de interesse | **Passa** | Fisco Conciliador de notas (https://fisco.com.br/conciliador-de-notas/); PlugContas conciliação OFX + XML (https://plugcontas.com.br/funcionalidades/conciliacao-bancaria-automatica/). Qive XML→Excel grátis (https://ferramentas.qive.com.br/xml-para-excel) **não** cruza banco. |
| 5 | Dado legítimo | **Passa** | Schema oficial NF-e + extrato que o usuário exporta. Sem login nosso. |

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Semanal/mensal no contas a pagar. |
| 7 | Fosso | **1** | Copiável; histórico local seria o fosso. |
| 8 | Distribuição | **2** | SEO contábil ("conciliação nfe extrato"); público um pouco diferente do seller ML. |
| 9 | Caminho para pagamento | **2** | Achar nota sem pagamento / pagamento sem nota = dor, mas menos "achei dinheiro" que tarifa ML. |
| 10 | Custo de manutenção | **2** | Schema NF-e estável; layouts de extrato variam (mesmo risco do extrato×saques). |
| 11 | Métrica de 14 dias | **3** | Definível (≥80 PV + 1 sinal). |

**Total: 12/18.** Gates: 5/5.

## Decisão
**REPROVA na régua 13 (12/18).** Na régua 11 seria construível, mas **auditor-tarifas-ml (13)** ganha o lote.
