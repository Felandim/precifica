# Scorecard: Consulta de CNPJ de fornecedores e clientes em lote (situação, Simples, MEI)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: o usuário cola ou solta uma planilha de CNPJs e recebe a situação cadastral, se é optante do Simples, se é MEI e o CNAE, a partir dos dados abertos da Receita. Um job mensal avisa quem mudou de situação.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa** | O chat não consulta 300 CNPJs ao vivo na base da Receita. |
| 2 | O que falta à IA | **Passa** | Dado vivo (base CNPJ mensal) + arquivo do usuário. |
| 3 | Dor real | **Passa (fraca)** | Contadores, compras e crédito checam a regularidade de fornecedores. MEIs e sellers pequenos raramente fazem isso. |
| 4 | Prova de interesse | **Passa** | Autocomplete Google BR: "consulta cnpj em lote", "consulta cnpj em lote excel", "consulta cnpj receita federal em lote". Pagos: CNPJ Aberto (lote só no plano Pro: https://cnpjaberto.com.br/lote) e CNPGolden (100 grátis, depois paga por Pix: https://www.cnpgolden.com.br/consulta-cnpj-em-massa). |
| 5 | Dado legítimo | **Passa (com risco)** | Dados abertos oficiais (https://dados.gov.br/dados/conjuntos-dados/cadastro-nacional-da-pessoa-juridica---cnpj). Mas um site estático não hospeda 60 milhões de registros; dependeria de uma API de terceiros com limite de uso, ou de um backend. |

**Existe grátis?** Sim: o MonitorCNPJ faz consulta em lote grátis com exportação para Excel (https://monitorcnpj.com.br/consultar-cnpj-em-lote/), e o CNPJ Multi envia o lote em CSV por e-mail (https://www.cnpjmulti.com.br/).

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **1** | Mensal, no máximo. |
| 7 | Fosso | **0** | Mesma base pública que todos usam; o MonitorCNPJ já faz isso de graça. |
| 8 | Distribuição | **0** | A página de resultados é dominada por sites de CNPJ com milhões de páginas indexadas. |
| 9 | Caminho para pagamento | **0** | Já existe grátis. |
| 10 | Custo de manutenção | **1** | Depende de uma API de terceiros ou de processar o dump mensal (~5 GB) e hospedar a consulta, coisa que o here.now estático não faz. |
| 11 | Métrica de 14 dias | **3** | ≥ 30 lotes consultados e ≥ 1 PIX. |

**Total: 5/18.**

## Decisão
**REPROVA (5 < 11).** Já existe de graça e não cabe num site estático.
