# Rascunhos de resposta (NÃO POSTADOS)

Regras que cada rascunho segue (filtro cético de divulgação):
- Começa pela dor nas palavras de quem perguntou, não pela ferramenta.
- **Continua útil sem o link.** O passo a passo manual vem primeiro, e o link é um atalho opcional no fim.
- Cada link leva um `?ref=` único (`forum-<canal>-<n>`). Atenção: a analytics do here.now hoje **não registra query string** (só caminho e domínio de origem). Ver plan.md. O ref fica para o dia em que existir medição.
- Aviso de transparência em todos: quem posta mantém a ferramenta.
- Nenhum texto se repete. **Antes de postar, leia o post original** (o Reddit não pôde ser lido daqui) e ajuste.
- Ritmo: no máximo 2 por dia, e nunca em #9 e #10 ao mesmo tempo.

---

## D1 · Contábeis #1: relatórios de repasse em formatos diferentes (415456)
URL: https://www.contabeis.com.br/forum/tributos-estaduais-municipais/415456/shopee-ml-e-tiktok-shop-relatorio-de-cada-plataforma-bate-diferente-pra-emitir-a-nfs-e/

> Junior, sobre o ponto do Mercado Livre "misturar repasse de venda própria com comissão de afiliado no mesmo extrato": no ML dá para separar sem depender do extrato consolidado.
>
> 1. Em Faturamento → Conciliação, gere o relatório **Por vendas** do mês (cada relatório cobre até 31 dias). Ele traz uma linha por evento, com **Número da operação**, **Tipo de operação**, valor bruto, total de tarifas e valor líquido.
> 2. Venda própria tem Número da operação de pedido e valor bruto de venda. O que não for venda (comissão, ajuste, bônus) aparece com outro Tipo de operação. Filtre por essa coluna e você tem as duas bases separadas, com o bruto de cada venda.
> 3. Gere também o **Por liberação de dinheiro** do mês e do seguinte, e some por Número da operação. Isso mostra o que efetivamente caiu, que é o que bate com o extrato.
>
> O artigo oficial que descreve essas colunas é "Como conciliar usando os relatórios de venda e liberação de dinheiro", na Central de Vendedores. Não resolve o TikTok, mas pelo menos no ML você não precisa assumir o líquido consolidado como base.
>
> Se for fazer isso para vários clientes, tem um conferidor gratuito que faz o cruzamento venda × liberação por Número da operação no navegador (o arquivo não sai do computador, não tem login): https://mellow-quarry-n7jk.here.now/conferidor-repasse-ml.html?ref=forum-contabeis-1
> (Transparência: eu mantenho essa ferramenta.)

---

## D2 · Contábeis #2: "cobrado 300k × NFS 200k" (410508)
URL: https://www.contabeis.com.br/forum/contabilidade/410508/contabilizacao-tarifas-mercado-livre/

> Murilo, complementando a resposta do Ricardo: antes de decidir qual dos dois números usar, vale descobrir **o que compõe os 100k de diferença**. Na tela "tarifas e pagamentos" entram itens que não são tarifa de venda (envio, Full, publicidade, às vezes cobranças de meses anteriores), e cada um tem nota e tratamento diferentes.
>
> Um jeito prático:
> 1. Faturamento → Conciliação → relatório **Por vendas** do mês.
> 2. Some por **Número da operação** (uma venda pode ter várias linhas). A coluna **Detalhes de tarifas** abre cada cobrança, e pela Central de Vendedores a soma dos líquidos dela deve bater com **Valor total de tarifas**.
> 3. Agrupe os itens por tipo (custo por vender, envio, Full, Ads). Aí fica claro quanto dos 300k é tarifa de intermediação coberta pelas NFS e quanto é outra coisa, como frete, armazenagem ou publicidade, com documento próprio.
>
> Com essa quebra dá para conversar com o cliente sobre o que falta de nota, em vez de lançar a diferença numa conta transitória.
>
> Se ajudar, tem um auditor gratuito que faz esse agrupamento por operação e por tipo direto no navegador, sem enviar a planilha a lugar nenhum: https://mellow-quarry-n7jk.here.now/auditor-tarifas-ml.html?ref=forum-contabeis-2
> (Transparência: eu mantenho essa ferramenta.)

---

## D3 · Contábeis #3: CT-e acima do frete realmente pago (414659)
URL: https://www.contabeis.com.br/forum/contabilidade/414659/cte-na-venda-mercado-livre/

> Maria, essa diferença entre o valor das CT-es e "o que ele paga de fato pra transportadora do ML" é esperada. A CT-e mostra o valor do frete da operação. O que o vendedor paga é a parte dele, depois do subsídio e da regra de frete grátis do ML. Então o valor do documento não é o seu custo.
>
> Para achar o custo real por venda:
> 1. No painel do cliente, Faturamento → Conciliação → relatório **Por vendas** do mês.
> 2. Por **Número da operação**, a coluna **Detalhes de tarifas** separa o envio cobrado do vendedor das outras tarifas.
> 3. Somando o envio de todas as operações, você tem o frete efetivamente debitado no mês, que é o valor que deveria ir para despesa. A CT-e fica como documento de suporte e não define o valor.
>
> Sobre a conta contábil em si, o pessoal do fórum entende mais do que eu. Mas pelo menos o número certo sai do relatório oficial, não da soma das CT-es.
>
> Se quiser a soma pronta por operação, tem um auditor gratuito que lê esse relatório no navegador (o arquivo não sai da máquina): https://mellow-quarry-n7jk.here.now/auditor-tarifas-ml.html?ref=forum-contabeis-3
> (Transparência: eu mantenho essa ferramenta.)

---

## D4 · Contábeis #4: "RECEBIMENTO REEMBOLSO" no Mercado Pago (414516)
URL: https://www.contabeis.com.br/forum/contabilidade/414516/contabilizacao-extrato-mercado-pago/

> Luma, antes de perguntar ao empresário dá para tirar boa parte da dúvida sozinha. O extrato simples do Mercado Pago resume demais. Já o relatório **Liberações** (Relatórios e faturamentos → Relatórios de reconciliação contábil → Liberações → Criar relatório) traz, linha a linha, a **descrição** do movimento, o **ID do pedido** (ORDER_ID) quando existe e a **referência externa**. Os campos estão no glossário oficial do relatório, na documentação de desenvolvedores do Mercado Pago.
>
> Com isso:
> 1. Os reembolsos que têm ORDER_ID são devoluções ligadas a uma venda ou compra específica, e dá para casar com o pedido.
> 2. Os que não têm ORDER_ID são os que realmente precisam da explicação do cliente. A lista para mandar para ele fica bem menor.
> 3. Quem vende no Mercado Livre também pode cruzar com o relatório "Por liberação de dinheiro" do ML pelo Número da operação.
>
> E concordo com o Ricardo: o que ficar sem explicação, peça por escrito.
>
> Se a empresa vende no ML, tem um conferidor gratuito que cruza as vendas com esse relatório de liberações no navegador, sem enviar o arquivo: https://mellow-quarry-n7jk.here.now/conferidor-repasse-ml.html?ref=forum-contabeis-4
> (Transparência: eu mantenho essa ferramenta.)

---

## D5 · Reddit #6: "Como diminuir essas taxas/tarifas cobradas nas vendas?" (1vzhvjg)
URL: https://www.reddit.com/r/mercadolivre/comments/1vzhvjg/
⚠️ Post não lido daqui. Confirme o contexto antes.

> Antes de tentar diminuir, vale ver **quais** taxas estão pesando. "As tarifas estão altas" geralmente é a média de um monte de venda normal com algumas bem fora da curva.
>
> O que eu faria:
> - Faturamento → Conciliação → relatório **Por vendas** do mês.
> - Para cada Número da operação: total de tarifas ÷ valor bruto. Ordena do maior para o menor.
> - Olha as 10 piores na coluna "Detalhes de tarifas". Normalmente é uma destas: **custo fixo** em produto barato (pela doc oficial "Custos por vender", abaixo do limite de frete grátis só Flex e envio próprio pagam o custo fixo; Full e Coleta não), **frete** caro por medida cadastrada errada, ou anúncio **Premium** onde o Clássico daria conta.
> - Compara a venda típica com o Simulador de custos oficial do ML para aquele anúncio. Se bater, o problema é preço. Se não bater, é cobrança para contestar.
>
> Às vezes "diminuir taxa" é só subir o produto de R$ 7x para R$ 79 ou mudar a medida do pacote.
>
> Se não quiser montar a planilha, eu mantenho um auditor grátis que faz essa conta por venda no navegador (o arquivo não sai do seu PC, não tem login): https://mellow-quarry-n7jk.here.now/auditor-tarifas-ml.html?ref=forum-reddit-6

---

## D6 · Reddit #7: "Depoimento de um seller no ML" (1vuxhpd)
URL: https://www.reddit.com/r/mercadolivre/comments/1vuxhpd/
⚠️ Post não lido. Só responda se o post falar de frete ou repasse errado (o resumo do índice diz que fala).

> Sobre a parte do frete cobrado por peso/medida que não é a do seu produto: uma coisa que ajuda muito a provar isso para o suporte é tirar a lista de **todas** as vendas afetadas, não uma só.
>
> No relatório Por vendas (Faturamento → Conciliação), cada venda tem o envio cobrado em "Detalhes de tarifas". Se você ordenar pelo valor do envio e comparar produtos iguais (mesma medida, mesma faixa de preço), as vendas com frete fora do padrão aparecem juntas. Teve um caso no Reclame Aqui de um vendedor que só descobriu dias depois que estava pagando R$ 42,90 de frete por unidade, porque o ML tinha mudado a forma de envio do anúncio. Uma checagem semanal assim pega isso no primeiro dia.
>
> Com a lista (número da operação, frete cobrado, frete esperado) o atendimento fica bem menos "mensagem pronta".
>
> Eu mantenho um auditor grátis que marca essas vendas fora da curva automaticamente, rodando só no navegador: https://mellow-quarry-n7jk.here.now/auditor-tarifas-ml.html?ref=forum-reddit-7

---

## D7 · Reddit #8: "Não vale mais a pena vender pelo ML" (1t7q7u1)
URL: https://www.reddit.com/r/mercadolivre/comments/1t7q7u1/
⚠️ Post não lido.

> Pode ser que não valha mesmo para o seu produto. Mas vale decidir com o número do seu mês e não com a sensação.
>
> Um teste de 20 minutos: baixa o relatório **Por vendas** (Faturamento → Conciliação) de um mês cheio, soma tarifas ÷ bruto **por venda** e separa em três grupos:
> 1. vendas com % normal para a categoria (confere no Simulador de custos oficial);
> 2. vendas com custo fixo ou frete pesando muito (geralmente produto abaixo de R$ 79 ou com medida errada);
> 3. vendas com cobrança estranha (tarifa em venda cancelada, envio sem venda).
>
> Se quase tudo cai no grupo 1 e mesmo assim não sobra margem, aí sim o canal não paga a conta. Se os grupos 2 e 3 são grandes, dá para consertar preço, medida e logística antes de largar.
>
> Eu mantenho uma ferramenta grátis que faz essa separação no navegador, sem subir o arquivo para lugar nenhum: https://mellow-quarry-n7jk.here.now/auditor-tarifas-ml.html?ref=forum-reddit-8

---

## D8 · Reddit #9: "Vendedores, ainda vale a pena vender pelo full?" (1rxhml0)
URL: https://www.reddit.com/r/mercadolivre/comments/1rxhml0/
⚠️ Post não lido. **Não repetir no #10 (r/empreendedorismo).**

> Para mim a pergunta muda de "vale a pena o Full" para "**quais SKUs** valem no Full". O Full se paga no que gira e sangra no que fica parado, porque além da diária por unidade tem o custo por estoque antigo.
>
> Regra oficial (Central de Vendedores, "Como gerenciar seu estoque antigo e evitar cobranças"): o custo por estoque antigo é mensal, por unidade, e começa quando a unidade passa de **4 meses** no CD (**2 meses** em Supermercado), contando da entrada. A seção "Custos por estoque antigo" mostra uma projeção e deixa baixar o relatório **em dias**.
>
> O que eu faço com esse arquivo:
> - faixas 0–30 / 31–60 / 61–90 / 91–120 / 120+ dias;
> - marco o que está a menos de 30 dias do limite;
> - cruzo com as vendas dos últimos 30 dias: SKU perto do limite e sem venda vira promoção ou retirada. Pela página oficial, a retirada fica mais barata por m³ quando você junta tudo numa vez só.
>
> Se o giro dos SKUs que você manda é bom, o Full costuma valer. Se você manda estoque "para ver se vende", é aí que a fatura assusta.
>
> Eu mantenho uma ferramenta grátis que monta essas faixas e o custo estimado a partir do Excel do Full, no navegador (o arquivo não sai do PC): https://mellow-quarry-n7jk.here.now/full-aging-estoque.html?ref=forum-reddit-9

---

## D9 · Reddit #11: "Consigo adiantar o dinheiro de uma venda?" (1mim8et)
URL: https://www.reddit.com/r/mercadolivre/comments/1mim8et/
⚠️ Post de ≈ ago/2025, então pode estar velho demais. Responder só se ainda tiver atividade.

> Se a antecipação não aparece para você, o que dá para fazer é pelo menos saber **o que está preso e até quando**, para planejar o caixa e não ficar esperando no escuro.
>
> - O Mercado Pago tem o relatório **Liberações** (Relatórios e faturamentos → Relatórios de reconciliação contábil), que mostra cada valor pela data em que foi liberado.
> - No ML, Faturamento → Conciliação gera o **Por vendas** e o **Por liberação de dinheiro**. Cruzando pelo Número da operação, você vê quais vendas já foram liberadas e quais ainda não.
> - Venda entregue há muito tempo e ainda sem liberação merece chamado no suporte, com o número da operação.
>
> Não acelera o dinheiro, mas evita descobrir na última hora que uma venda travou.
>
> Eu mantenho um conferidor grátis que faz esse cruzamento no navegador e lista as vendas ainda não liberadas: https://mellow-quarry-n7jk.here.now/conferidor-repasse-ml.html?ref=forum-reddit-11

---

## D10 · Adrenaline #13: "as taxas do ML estão bem altas" (tópico geral)
URL: https://forum.adrenaline.com.br/threads/mercadolivre-duvidas-discussoes-problemas-etc-poste-aqui.651975/page-60
⚠️ Público pessoa física e encaixe fraco. Baixa prioridade; só poste se o tópico voltar a falar de taxa de venda.

> Sobre as taxas estarem altas: para venda avulsa de pessoa física, o que mais pesa costuma ser a tarifa do anúncio (Clássico ou Premium, varia por categoria) somada ao frete. Antes de anunciar, joga o preço no Simulador de custos do próprio ML (mercadolivre.com.br/simulador-de-custos), que mostra quanto vai sobrar. Se já vendeu e achou que veio menos, o relatório Por vendas em Faturamento → Conciliação mostra cobrança por cobrança.
>
> Para quem vende com frequência, eu mantenho um auditor grátis que lê esse relatório no navegador e aponta a venda com taxa fora do normal: https://mellow-quarry-n7jk.here.now/auditor-tarifas-ml.html?ref=forum-adrenaline-13

---

## Tags usadas (todas únicas)
forum-contabeis-1, forum-contabeis-2, forum-contabeis-3, forum-contabeis-4, forum-reddit-6, forum-reddit-7, forum-reddit-8, forum-reddit-9, forum-reddit-11, forum-adrenaline-13
