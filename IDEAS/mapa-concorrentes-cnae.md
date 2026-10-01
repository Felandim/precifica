# Scorecard: "Quantos concorrentes tenho na minha cidade?" (CNAE × município, dados abertos CNPJ + IBGE)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: páginas geradas por um job mensal a partir do dump aberto do CNPJ e da população do IBGE, uma por atividade × município: empresas ativas, abertas e fechadas nos últimos 12 meses e empresas por 10 mil habitantes. Público: quem vai abrir um MEI.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | Passa | O chat não sabe a contagem atual de barbearias ativas em Uberlândia. |
| 2 | O que falta à IA | Passa | Dado vivo + histórico mensal acumulado. |
| 3 | Dor real | **Fraca** | Hoje a pessoa abre o Mapa de Empresas do governo, que já filtra município × CNAE e mostra ativas, abertas e encerradas, de graça (https://www.gov.br/empresas-e-negocios/pt-br/mapa-de-empresas/painel-mapa-de-empresas). |
| 4 | Prova de interesse | **Fraca** | O autocomplete de "quantas empresas" é só macro ou político ("...fecharam no governo...", "...existem no brasil"); nada por atividade ou cidade. |
| 5 | Dado legítimo | Passa | Dados abertos da Receita e do IBGE. |

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **0** | Consulta única, antes de abrir o negócio. |
| 7 | Fosso | **1** | O histórico mensal acumulado ajuda um pouco. |
| 8 | Distribuição | **2** | SEO programático cidade × atividade tem cauda longa real. |
| 9 | Caminho para pagamento | **0** | Curiosidade pontual. |
| 10 | Custo de manutenção | **1** | Processar um dump de ~5 GB por mês e gerar milhares de páginas. |
| 11 | Métrica de 14 dias | **3** | ≥ 200 páginas indexadas e ≥ 300 visitas orgânicas. |

**Total: 7/18.**

## Decisão
**REPROVA (7 < 11).** O governo já entrega isso de graça (Mapa de Empresas).
