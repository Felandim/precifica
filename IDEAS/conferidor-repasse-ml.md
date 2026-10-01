# Scorecard: Conferidor de repasse Mercado Livre (cruza "Por venda" × "Por liberação" no navegador)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-01 (PT). Só pesquisa.

Ideia: o vendedor solta os dois relatórios oficiais de conciliação do ML. A ferramenta, 100% local:
- soma todas as linhas por Número da operação;
- valida que a soma de "Detalhes de tarifas" é igual ao "Valor total de tarifas";
- lista as vendas sem liberação após N dias, os fretes cobrados à parte, os cancelamentos e devoluções que não zeraram;
- mostra quanto da venda virou tarifa, por anúncio.

Não compara com a tabela de comissões, para não depender de regras que mudam.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | Um usuário avançado consegue fazer o join no ChatGPT com upload, mas: o plano grátis tem 3 uploads/dia (https://help.openai.com/pt-br/articles/8555545-file-uploads-faq); a lógica tem pegadinhas que o próprio ML precisou explicar (uma operação gera várias linhas em datas diferentes, linhas com líquido negativo, cancelamento anulando a venda, venda de maio liberada em junho: https://vendedores.mercadolivre.com.br/aprender/nota/como-conciliar-usando-os-relatorios-de-venda-e-liberacao-de-dinheiro); e o vendedor pequeno não sabe o que perguntar. Estimo que o chat entregue ~50%, não 80%. |
| 2 | O que falta à IA | **Passa** | Processa os arquivos do usuário; opcionalmente, histórico local (IndexedDB) de meses anteriores. |
| 3 | Dor real | **Passa** | Seller de ML com 50 a 2000 pedidos/mês. Hoje cruza no Excel à mão ou paga conciliador. "Fazer esse cruzamento manualmente, pedido a pedido, é inviável para qualquer operação com volume relevante" (https://www.koncili.com/blog/conciliacao-mercado-livre-guia-passo-a-passo-do-repasse/). |
| 4 | Prova de interesse | **Passa** | Autocomplete: "conciliação mercado livre", "conciliação financeira mercado livre", "conciliação bancária mercado livre", "conciliação vendas mercado livre", "como fazer conciliação mercado livre". Concorrentes pagos: Koncili (planos Start a Enterprise, preço sob consulta: https://www.koncili.com/planos/); Marketize ("recupere 15% do seu lucro", teste de 7 dias: https://marketizesales.com.br/pagina-inicial/); Hunter, que estima R$ 120 a R$ 300/mês por ferramenta especializada (https://hunterhub.com.br/blog/ferramentas-seller-mercado-livre-comparativo-2026/). Conteúdo sobre "recuperar taxas cobradas erradas" (https://hunterhub.com.br/blog/recuperar-taxas-mercado-livre/). |
| 5 | Dado legítimo | **Passa** | Relatórios oficiais que o próprio vendedor baixa. Sem login do nosso lado, sem API e sem scraping. |

**Existe grátis?** Não achei um conferidor grátis dedicado. A alternativa grátis é o próprio relatório do ML + Excel. O ML melhorou o relatório (líquido por linha, detalhes de tarifas), o que **reduz** a dor. Os pagos conectam via API e auditam tarifa contra a tabela, que é mais do que esta ideia faria.

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Semanal ou mensal (fechamento). Não é diária. |
| 7 | Fosso | **1** | Histórico local mês a mês prende o usuário, mas o código é copiável e os pagos já têm o histórico via API. |
| 8 | Distribuição | **1** | Existe a cauda longa "conciliação mercado livre", mas Koncili, Marketize e Hunter publicam conteúdo nela; um subdomínio here.now sem backlinks larga atrás. O compartilhamento natural é baixo, porque finanças são privadas. |
| 9 | Caminho para pagamento | **2** | É o único caso em que a ferramenta **acha dinheiro** ("R$ 87 sem liberação há 40 dias"). Um pedido de PIX logo após mostrar o valor encontrado é plausível. Ainda é doação, não assinatura. |
| 10 | Custo de manutenção | **2** | Sem regras de tarifa, só depende do layout do export. Mas o ML mudou o relatório recentemente e pode mudar de novo, e cada mudança quebra o parser. |
| 11 | Métrica de 14 dias | **3** | Abaixo. |

**Total: 11/18.** Gates: 5 de 5 passam (o 1 fraco).

## Decisão
**REPROVA (11/18 < 13).** É a melhor ideia do lote, mas não atinge a régua. Pela regra do Felipe, não construir. Só reavaliar se aparecer um sinal externo concreto: alguém pedindo isso, ou um PIX ou mensagem citando conciliação.

## Métrica de morte (se um dia for construída)
Janela de 14 dias a partir da publicação:
1. ≥ 25 conciliações concluídas (contador local agregado, sem dado pessoal, ou contagem via um evento sem cookies, se o here.now oferecer analytics); **e**
2. ≥ 1 PIX ou mensagem citando o conferidor, **ou** ≥ 1 divergência real relatada por usuário.

Se qualquer um falhar: tirar do ar, sem v2.

---

## Decisão revisada: 2026-10-01-b → CONSTRUIR (régua 11/18)

- **Nova regra do Felipe (2026-10-01):** se nenhuma ideia atingir 13/18, a régua cai para 11/18.
- **Lote novo de 2026-10-01-b**, 8 ideias pontuadas com o mesmo filtro. Nenhuma chegou a 13 nem passou de 11:

| Ideia | Gates | Nota |
|---|---|---|
| conferidor-repasse-shopee | 5/5 | 10 |
| ncm-vigencia-catalogo | 5/5 | 7 |
| mapa-concorrentes-cnae | 5/5 (3 e 4 fracos) | 7 |
| legenda-video-local | 5/5 (3 fraco) | 6 |
| cnpj-fornecedores-lote | 5/5 (5 com risco) | 5 |
| gtin-lote-catalogo | reprova nos gates 1 e 5 | — |
| comprovantes-pix-planilha | reprova no gate 1 | — |
| conciliador-maquininha | reprova no gate 5 | — |

- **A maior nota ≥ 11 entre todas as ideias é a do conferidor-repasse-ml (11).** Gates: 5/5. **Construído e publicado em 2026-10-01**: `conferidor-repasse-ml.html`.
- **Escopo construído:** igual ao da ideia (soma por Número da operação; esperado × liberado; atrasada após N dias, padrão 40; diferença acima de R$ 0,05; contas internas bruto/líquido/Detalhes de tarifas). Também aceita o relatório de liberações do Mercado Pago no lugar do "Por liberação". **Não** confere a tabela de tarifas. O histórico local em IndexedDB ficou de fora da v1, de propósito: só entra se a métrica passar.
- **Colunas:** vêm do artigo oficial do ML e do glossário do MP. Os nomes que não aparecerem no arquivo do usuário são escolhidos por ele no mapeamento manual; a ferramenta nunca adivinha em silêncio. O formato da célula "Detalhes de tarifas" não é documentado: a checagem só roda quando os valores são legíveis.

## Métrica de morte (14 dias), definida antes de publicar

Janela: de 2026-10-01 a **2026-10-15 (checar nesse dia, PT)**.

1. **≥ 100 visualizações de `/conferidor-repasse-ml.html`** na analytics nativa do here.now (`GET /api/v1/publishes/mellow-quarry-n7jk/analytics?range=…`, lida pelo dono). Se a analytics não separar por página, vale este critério: **as visitas totais do site nos 14 dias devem ser ≥ 20% maiores que nos 14 dias anteriores a 2026-10-01**. Não existe evento de "conciliação concluída", porque a página não envia nada (é a promessa de privacidade). Por isso o contador local agregado do plano original foi trocado por esta medida.
2. **E ≥ 1 sinal externo:** um PIX ou uma mensagem citando o conferidor, **ou** uma divergência real relatada por algum usuário.

**Se 1 ou 2 falhar em 2026-10-15:** tirar a página do ar (o HTML, os dois JS, `js/vendor/`, `exemplos/`, o card, o nav e as URLs do sitemap), sem v2. Se passar: a próxima iteração é o histórico local (IndexedDB) e, havendo um export real, a versão Shopee (10/18).
