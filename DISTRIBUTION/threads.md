# Perguntas reais onde as 4 ferramentas resolvem (levantamento 2026-10-04, horário BRT)

Ferramentas: **conferidor** = conferidor-repasse-ml.html · **extrato** = extrato-x-saques-mp.html · **auditor** = auditor-tarifas-ml.html · **full** = full-aging-estoque.html

Nada foi postado. Este arquivo é só levantamento.

## Resumo honesto

- **19 perguntas registradas**: 14 onde dá para responder (Contábeis, Reddit, Adrenaline) e 5 onde não dá (Reclame Aqui / PROTESTE: só consumidor e empresa interagem).
- **O fórum oficial "Comunidade Mercado Livre" não existe mais.** `comunidade.mercadolivre.com.br` dá NXDOMAIN no DNS autoritativo do próprio Mercado Livre (consulta DoH na Cloudflare em 2026-10-04: Status 3, SOA `mercadolivre.com.br` na AWS). A busca não indexa nenhuma página dele, e o Wayback não tem captura com resposta 200 desde 2025. Não há substituto oficial com fórum aberto. A Central de Vendedores tem artigos e chat, mas nenhuma área de perguntas públicas.
- **Reddit não deu para ler daqui.** reddit.com, old.reddit e os espelhos devolvem 403 ou Cloudflare para a box e para o fetch. Os títulos e trechos vêm do índice de busca. As datas foram **estimadas pelo ID do post** e têm margem de cerca de 1 mês. Leia o post antes de responder.
- Encaixe "parcial" quer dizer que a ferramenta ajuda numa parte do problema, não no problema inteiro. Não venda como solução completa.
- A **extrato** é a mais fraca em demanda pública: achei poucas perguntas de vendedor sobre "saque não caiu", e a maioria é de consumidor ou de conta bloqueada, onde a ferramenta não ajuda.

## Regras de cada lugar (lidas)

| Lugar | Pode link externo? | Fonte / observação |
|---|---|---|
| **Fórum Contábeis** (contabeis.com.br/forum) | **Sim, se ajudar no problema.** Regra 4: "Não são permitidos anúncios de venda ou compra de produtos, serviços e cursos, divulgação de sites ou homepages, **sem o sentido de auxílio a algum problema de algum usuário**." Regra 24: mensagens de usuário novo **passam por aprovação** antes de aparecer. O moderador pode editar links em pedido de "resposta particular". | https://www.contabeis.com.br/regras/ (lido 2026-10-04) |
| **Reddit r/mercadolivre / r/empreendedorismo** | Autopromoção e spam são proibidos. O post de regras ("Novas Regras e Sugestões! [IMPORTANTE]", https://www.reddit.com/r/mercadolivre/comments/1r9jktz/) **não pôde ser lido daqui** (403). O índice resume como "sem links de afiliado, spam ou autopromoção". Na prática: comentário útil, link no fim, com aviso de que você mantém a ferramenta, e nunca o mesmo texto duas vezes. Conta nova com pouco karma costuma ser filtrada pelo automod. | regra confirmada só pelo resumo do índice |
| **Fórum Adrenaline** | É um fórum geral. O tópico de Mercado Livre é de compra e venda de pessoa física. Não li a regra específica de links. Link comercial em fórum geral costuma ser mal recebido. | baixa prioridade |
| **Reclame Aqui** | **Não dá para responder.** Nas páginas lidas, a seção "Interações da reclamação" só tem o consumidor e a empresa, e não existe campo de comentário de terceiros. Serve como **prova de dor e fonte de palavras do usuário**, não como canal. | páginas lidas via fetch |
| **PROTESTE Reclame** | Mesmo modelo, reclamação pública para a empresa responder. Não é canal. | — |

## Lista

Datas: data de publicação da pergunta. "Resp." é o número de respostas quando consegui ver.

| # | Lugar | URL | Data | O que a pessoa pergunta (resumo, palavras dela) | Ferramenta | Link permitido? |
|---|---|---|---|---|---|---|
| 1 | Contábeis | https://www.contabeis.com.br/forum/tributos-estaduais-municipais/415456/shopee-ml-e-tiktok-shop-relatorio-de-cada-plataforma-bate-diferente-pra-emitir-a-nfs-e/ | 2026-08-28 (0 resp., 171 acessos) | Contador de Ponta Grossa/PR atende afiliados que vendem na Shopee, no ML e no TikTok Shop. "Cada plataforma manda um relatório de repasse num formato diferente". "O Mercado Livre às vezes mistura repasse de venda própria com comissão de afiliado no mesmo extrato". Pergunta como montar a base da NFS-e. | conferidor (parcial: separa por Número da operação e Tipo de operação, só no ML) | Sim, se ajudar (regra 4); moderado |
| 2 | Contábeis | https://www.contabeis.com.br/forum/contabilidade/410508/contabilizacao-tarifas-mercado-livre/ | 2025-10-03 (1 resp., 797 acessos) | Em "tarifas e pagamentos", o valor efetivamente cobrado em 09/25 foi de 300k e as NFS emitidas somaram 200k. "Qual valor deveria ser observado" para contabilizar as tarifas? | auditor (tarifa por operação no "Por vendas") | Sim, se ajudar |
| 3 | Contábeis | https://www.contabeis.com.br/forum/contabilidade/414659/cte-na-venda-mercado-livre/ | 2026-06-24 (0 resp., 182 acessos) | O ML emite CT-e para todas as vendas, e o IOB lança como entrada. "O que ele paga de fato pra transportadora do ML é bem abaixo do valor total das CTEs". Em que conta lançar? | auditor (parcial: mostra o envio realmente cobrado por operação) | Sim, se ajudar |
| 4 | Contábeis | https://www.contabeis.com.br/forum/contabilidade/414516/contabilizacao-extrato-mercado-pago/ | 2026-06-11 (1 resp.) | Na conta Mercado Pago da empresa aparecem "muitos recebimentos com históricos apenas como 'RECEBIMENTO REEMBOLSO'", sem fornecedor. Qual a forma correta de contabilizar? | conferidor (parcial: relatório Liberações do MP com DESCRIPTION/ORDER_ID) | Sim, se ajudar |
| 5 | Contábeis | https://www.contabeis.com.br/forum/contabilidade/397831/mercado-pago-extrato-bancario/ | 2024-04-30 | "MERCADO PAGO - EXTRATO BANCARIO" (só o título foi lido) | extrato (provável) | Sim, se ajudar. **Antigo, não priorizar.** |
| 6 | Reddit r/mercadolivre | https://www.reddit.com/r/mercadolivre/comments/1vzhvjg/como_diminuir_essas_taxastarifas_cobradas_nas/ | ≈ set/2026 (estimado pelo ID) | "Como diminuir essas taxas/tarifas cobradas nas vendas?" | auditor | Autopromoção proibida, só comentário útil com aviso |
| 7 | Reddit r/mercadolivre | https://www.reddit.com/r/mercadolivre/comments/1vuxhpd/depoimento_de_um_seller_no_ml/ | ≈ set/2026 | "Depoimento de um seller no ML". O índice resume que fala de repasse menor e de frete por peso ou medida assumidos errado. | auditor | idem |
| 8 | Reddit r/mercadolivre | https://www.reddit.com/r/mercadolivre/comments/1t7q7u1/n%C3%A3o_vale_mais_a_pena_vender_pelo_ml/ | ≈ jun/2026 | "Não vale mais a pena vender pelo ML" | auditor (medir a % real antes de decidir) | idem |
| 9 | Reddit r/mercadolivre | https://www.reddit.com/r/mercadolivre/comments/1rxhml0/vendedores_ainda_vale_a_pena_vender_pelo_full/ | ≈ abr/2026 | "Vendedores, ainda vale a pena vender pelo full?" | full | idem |
| 10 | Reddit r/empreendedorismo | https://www.reddit.com/r/empreendedorismo/comments/1rxhnjn/vendedores_ainda_vale_a_pena_vender_pelo_full/ | ≈ abr/2026 | Mesmo post do #9, do mesmo autor. **Responder só em um dos dois.** | full | idem |
| 11 | Reddit r/mercadolivre | https://www.reddit.com/r/mercadolivre/comments/1mim8et/consigo_adiantar_o_dinheiro_de_uma_venda/ | ≈ ago/2025 | "Consigo adiantar o dinheiro de uma venda?" O índice resume: a liberação demora, e a antecipação não aparece com reputação baixa. | conferidor (parcial: mostra o que está a liberar e o que está atrasado) | idem |
| 12 | Reddit r/mercadolivre | https://www.reddit.com/r/mercadolivre/comments/1vwmk1o/como_vender_um_estoque_de_100mil/ | ≈ set/2026 | "Como vender um estoque de 100mil?" (não sei se é Full) | full (só se for Full; encaixe fraco) | idem |
| 13 | Fórum Adrenaline | https://forum.adrenaline.com.br/threads/mercadolivre-duvidas-discussoes-problemas-etc-poste-aqui.651975/page-60 | último post 2026-10-01 | Tópico geral de ML. Um post recente: "as taxas do ML estão bem altas e agora tem a opção do Olx pay, estão usando mais qual?" | auditor (encaixe fraco: público pessoa física) | Não conferido; baixa prioridade |
| 14 | Reclame Aqui (Mercado Pago) | https://www.reclameaqui.com.br/mercado-pago/mercado-pago-valor-a-liberar-de-vendas-desapareceu-da-conta-e-atendimento-nao-resolve_TfOtlkRGnjllb25N/ | 2026-04-27 | Vendedor há 14 anos: "sumiu completamente o 'valor a liberar'". O MP respondeu que fica em Relatórios e faturamentos → Relatórios de reconciliação contábil → Liberações. Encerrada com nota 0. | conferidor | **Não: RA não aceita resposta de terceiros** |
| 15 | Reclame Aqui (ML) | https://www.reclameaqui.com.br/mercado-pago/vendedor-no-mercado-livre-tem-recebimentos-bloqueados-por-compra-garantida-e-exige-liberacao-dos-valores-pagos_72OcdNoFL0uSDRBG/ | 2026-04-15 | Vendedor com 30 dias de conta: os recebimentos foram debitados como "compra garantida", e "o Mercado Livre não sabe informar quais valores serão debitados". Conta bloqueada de vez. | conferidor (parcial; não resolve bloqueio) | Não |
| 16 | Reclame Aqui (Mercado Pago) | https://www.reclameaqui.com.br/mercado-pago/cobranca-indevida-de-tarifa-de-armazenamento-full-durante-periodo-de-teste-gratis-no-mercado-livre_skRDCbZINKfRSEm-/ | ≈ set–out/2025 (1º envio 29/08/2025, fatura de setembro) | Vendedor no "Teste grátis Full" cobrado em R$ 68,63 de armazenamento na fatura de setembro | full (parcial: estima armazenamento por SKU; não verifica promoção) | Não |
| 17 | Reclame Aqui (ML) | https://www.reclameaqui.com.br/mercado-livre/mercado-livre-cobrando-frete-do-vendedor-indevidamente-nos-causando-um-prejuizo-de-mais-de-10-mil-reais_AK8FhMKzUIFAIU7k/ | data não verificada (fala em 30/01 a 10/02) | O ML mudou a forma de envio sozinho e passou a debitar "R$42,90 de frete por cada unidade vendida". Só perceberam dias depois. | auditor (linhas de envio fora da curva teriam aparecido no 1º dia) | Não |
| 18 | Reclame Aqui (ML) | https://www.reclameaqui.com.br/mercado-livre/mercado-livre-cobrando-frete-mais-caro-do-que-esta-na-sua-propria-tabela-v_5sYxtPkyYk7LDFbh/ | 2024-06-25 | "São 18 anuncios que estão cobrando frete de forma errada". Mesmo produto de cor diferente: R$ 41,95 contra R$ 85,95. | auditor | Não. **Antigo.** |
| 19 | PROTESTE | https://www.proteste.org.br/reclame/lista-de-reclamacoes-publicas/reclamacoes-publicas?referenceid=CPTBR01480062-36 | 2022 | Estoque no Full sem ir à venda ("sem cobertura fiscal"). "Quero saber se eu vou pagar pelo custo de armazenamento prolongado." | full | Não. **Antigo.** |

## Top 5 para responder (dá para responder, encaixa bem, recente)

1. #1 Contábeis 415456: 0 respostas, recente, contador que concilia para vários vendedores
2. #6 Reddit 1vzhvjg: taxas/tarifas
3. #9 Reddit 1rxhml0: Full vale a pena
4. #3 Contábeis 414659: CT-e × frete realmente pago
5. #2 Contábeis 410508: tarifas cobradas × NFS

## Prova de demanda de busca (Google Autocomplete pt-BR/BR, 2026-10-04)

- "conciliação mercado livre" → conciliação financeira / bancária / vendas mercado livre, "como fazer conciliação mercado livre"
- "tarifa mercado livre" → 2026, por categoria, full, vendedor, frete, "tarifa fixa mercado livre"
- "mercado livre cobrando" → frete, frete no full, frete muito caro, **frete errado**, frete do vendedor, imposto, difal
- "taxa mercado livre" → venda, vendedor, 2026, **abaixo de 79**, cnpj, anuncio premium
- "extrato mercado pago" → pdf, excel, **liberação de dinheiro**, **ofx**, mês anterior
- "relatorio mercado pago" → vendas, mensal, financeiro, **ofx**, detalhado
- "pix mercado pago não caiu" → "mandei pix pro mercado pago e nao caiu", "recebi um pix no mercado pago e nao caiu"
- "custo por estoque antigo" → "custo por estoque antigo mercado livre", "custo estoque antigo full"
- "armazenamento full" → custo / taxa de armazenamento full mercado livre
- "estoque full mercado livre" → custo, gestão, **tempo de estoque**, como ver estoque
- Sem sugestão nenhuma, ou seja, volume baixo: "como conferir repasse mercado livre", "tarifa mercado livre alta", "saque mercado pago não caiu", "dinheiro não liberado mercado livre".

## Concorrência grátis/paga encontrada (o usuário vai comparar)

Koncili (blog de conciliação e calendário de repasses), Terazi (tarifas), Cargoos, RecuperaBR/especialistaemmarketplace (auditoria de cobranças indevidas), Hunter HUB (recuperar taxas), JoomPulse, PuraMargem, SellSync, Mercado Advogados (jurídico). A maioria é SaaS ou captação de lead. Não achei outra ferramenta **grátis, sem login e que roda só no navegador** para o cruzamento venda × liberação. Mas os artigos deles já ranqueiam para "conciliação mercado livre".
