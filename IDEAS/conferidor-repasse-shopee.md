# Scorecard: Conferidor de repasse Shopee ("Minha Renda" × pedidos)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Lote 2026-10-01-b.

Ideia: a versão Shopee do conferidor do ML. O seller solta o export de Minha Renda e o de pedidos, e a página aponta pedido concluído sem repasse, repasse negativo e taxa fora do padrão, tudo local.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | Passa (fraca) | Mesmo argumento do conferidor do ML: os pedidos com vários itens repetem a comissão se a soma não for agrupada por ID do pedido (https://www.youtube.com/watch?v=9oK2eRULDY8). |
| 2 | O que falta à IA | Passa | Arquivos do usuário. |
| 3 | Dor real | Passa | O vendedor procura "valores negativos no repasse" (https://especialistaemmarketplace.com.br/valores-negativos-shopee/) e concilia à mão com planilha (o vídeo acima). |
| 4 | Prova de interesse | Passa | Autocomplete: "conciliação shopee", "conciliação financeira shopee", "conciliação bancária shopee", "como fazer conciliação shopee". Pago: Marketize publica um guia de exportação e vende conciliação (https://www.marketizesales.com.br/guia-de-exportacao-de-planilha-shopee). |
| 5 | Dado legítimo | Passa | Relatório que o próprio vendedor exporta (Finanças > Minha Renda > Exportar). |

**Existe grátis?** Não achei nenhum dedicado.

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Semanal ou mensal. |
| 7 | Fosso | **1** | Histórico local; código copiável. |
| 8 | Distribuição | **1** | Cauda "conciliação shopee" menor que a do ML; os blogs dos pagos ocupam o topo. |
| 9 | Caminho para pagamento | **2** | Acha dinheiro (repasse faltando), o que torna um PIX plausível. |
| 10 | Custo de manutenção | **1** | Não achei um dicionário oficial público das colunas do export da Shopee (o ML tem artigo e o Mercado Pago tem glossário). Sem amostra real, o parser não é verificável, e a Shopee muda o Seller Centre com frequência. |
| 11 | Métrica de 14 dias | **3** | Mesma forma da métrica do conferidor do ML. |

**Total: 10/18.**

## Decisão
**REPROVA (10 < 11).** É a melhor ideia nova do lote, mas fica abaixo do conferidor do ML (11), que tem formato documentado oficialmente. Candidata natural a v2 *se* o conferidor do ML passar na métrica de 14 dias e algum usuário mandar um export real da Shopee.
