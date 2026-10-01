# Scorecard: Validador de NCM do catálogo contra a tabela oficial vigente

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: o vendedor solta a planilha de produtos (export do Bling/Tiny/ML) e a página confere, no navegador, cada NCM contra a tabela oficial do Siscomex baixada por um job semanal. Lista os NCMs inexistentes (que geram a rejeição 778 na NF-e), com sugestão dos códigos irmãos da mesma posição.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa** | O chat não tem a tabela vigente e inventa descrição de NCM. Conferir 500 códigos contra a tabela de hoje exige o arquivo oficial. |
| 2 | O que falta à IA | **Passa** | Dado vivo (tabela oficial) + arquivo do usuário. |
| 3 | Dor real | **Passa** | Rejeição 778 "Informado NCM inexistente": o NCM precisa existir na tabela vigente do MDIC na data de emissão (https://www.fazendanota.com.br/rejeicoes/778, https://suporte.senior.com.br/hc/pt-br/articles/4409364638228). Hoje o vendedor procura com Ctrl+F no portal da Receita, código a código (passo a passo do NS7: https://ns7.com.br/docs/ns7/rejeicao-778-ncm-inexistente/). |
| 4 | Prova de interesse | **Passa** | Autocomplete Google BR (medido em 2026-10-01): "validar ncm", "validar ncm sefaz", "validar ncm online", "acbr validar ncm", "consulta ncm em lote", "alterar ncm em lote dominio". Pagos: Mastersaf, Sovos Taxweb e Soluctra vendem TIPI atualizada (citados em https://1001ferramentas.com/ferramentas/validador-codigo-ncm). |
| 5 | Dado legítimo | **Passa** | JSON público oficial, sem login: `portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json` (baixado em 2026-10-01: HTTP 200, 3,1 MB, 15.157 linhas, "Vigente em 01/10/2026", Resolução Gecex nº 926/2026). |

**Existe grátis?** Sim, e isso pesa: o TOTVS Consulta NCM valida NCMs em lote a partir de XML (https://ncm-consulta.vercel.app/), o Tabelas Fiscais oferece a tabela completa em CSV (https://tabelasfiscais.com.br/ncm) e a BrasilAPI expõe `/api/ncm/v1/{codigo}` de graça.

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **1** | A tabela muda pouco. Medi no JSON: dos 10.516 códigos de 8 dígitos, só 139 começaram a valer depois de 2022. O vendedor usa isso ao cadastrar produto ou depois de uma rejeição, não toda semana. |
| 7 | Fosso | **0** | A tabela é oficial e espelhável por qualquer um; já existem três alternativas grátis. |
| 8 | Distribuição | **1** | Existe a cauda "validar ncm online", mas ERPs, a TOTVS e o Tabelas Fiscais já ocupam a página de resultados. |
| 9 | Caminho para pagamento | **0** | Uso pontual que resolve uma rejeição; nenhuma razão recorrente para doar. |
| 10 | Custo de manutenção | **2** | Um job semanal baixa um JSON oficial e estável. O risco é o endpoint mudar. |
| 11 | Métrica de 14 dias | **3** | ≥ 60 visitas na página e ≥ 15 planilhas validadas (evento agregado), checado no dia 14. Abaixo disso, desligar. |

**Total: 7/18.** Gates: 5 de 5 passam.

## Decisão
**REPROVA (7 < 11).** A dor é real, mas é rara e já tem solução grátis.
