# Scorecard: Auditor de GTIN/EAN do catálogo (dígito, duplicados, prefixo GS1)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: o vendedor solta o export de produtos e a página aponta GTINs com dígito verificador errado, GTINs repetidos entre variações (o ML exige um por variação) e o país do prefixo GS1.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Reprova** | Dígito verificador (módulo 10, pesos 1 e 3) e duplicados numa planilha são exatamente o que o ChatGPT com análise de dados faz em um prompt. A única parte que a IA não faz, saber se o GTIN está **registrado** e a quem, depende da base da GS1. |
| 2 | O que falta à IA | Passa (fraco) | Só o arquivo do usuário. |
| 3 | Dor real | Passa | O ML pausa ou exclui anúncios com código universal vazio ou incorreto e exige um por variação (https://vendedores.mercadolivre.com.br/nota/tudo-o-que-voce-precisa-saber-sobre-os-codigos-universais-de-produto). O Bling documenta o erro de GTIN repetido em outra categoria (https://ajuda.bling.com.br/hc/pt-br/articles/39584018202519). |
| 4 | Prova de interesse | Passa | Autocomplete: "validar gtin", "validar gtin sefaz", "validar gtin gs1", "validar gtin online", "validar gtin 13". "ean em lote" não tem sugestões. |
| 5 | Dado legítimo | **Reprova (na parte valiosa)** | A verificação de registro é o Verified by GS1 (https://www.gs1br.org/consulta-gtin), que exige conta e associação. Sem ela, sobra só a conta do dígito. |

**Existe grátis?** Sim: validadores grátis de dígito no navegador (https://especialistaemmarketplace.com.br/gerador-de-codigo-de-barras/, https://www.stoqui.com.br/ferramentas/gerador-codigo-barras).

## Notas
Não pontuada: reprovou nos gates 1 e 5. (Estimativa indicativa: ~6/18.)

## Decisão
**MORTA no gate 1/5.**
