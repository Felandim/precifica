# Plano de distribuição: filtro cético (Bullseye + gates + AARRR)

Feito em 2026-10-04 (BRT). Nada foi postado. Postar é com o Felipe; este plano só prepara.
Produto: as 4 ferramentas grátis, sem login, que rodam no navegador (conferidor de repasse, extrato × saques MP, auditor de tarifas, Full aging) em https://mellow-quarry-n7jk.here.now/

## 0. Onde estamos (números reais, analytics here.now, desde 2026-09-04)
- 53 views e 41 visitantes no total. `/` teve 40 views, `/conferidor-repasse-ml.html` 2. **Auditor, extrato e full-aging: 0 views.**
- Origem: Direct 51, github.com 2. Países: US 40 (provavelmente nossas próprias checagens) e BR 13.
- **Estágio mais fraco: Aquisição.** Ninguém de fora chega. Não adianta mexer em ativação antes.
- Os kill checks das próprias ferramentas caem em 15, 16, 17 e 18/10. Este plano tenta gerar o tráfego que esses checks precisam ver.

## 1. Bullseye: canais plausíveis (evidência e custo)

| Canal (Traction) | Onde o público JÁ pergunta (evidência) | Custo do teste | Veredito |
|---|---|---|---|
| **SEO / conteúdo** | Autocomplete pt-BR: "conciliação mercado livre", "tarifa mercado livre", "mercado livre cobrando frete errado", "taxa mercado livre abaixo de 79", "extrato mercado pago liberação de dinheiro", "custo por estoque antigo mercado livre" (ver threads.md). Concorrentes (Koncili etc.) ranqueiam com artigo. | Já pago: 4 guias publicados hoje. Custo marginal 0, só esperar a indexação. | **Top 3** |
| **Comunidade / fórum: Contábeis** | Perguntas reais e sem resposta de contadores que conciliam ML/MP: #1 415456 (28/08/2026, 0 resp.), #3 414659 (24/06/2026, 0 resp.), #4 414516 (11/06/2026), #2 410508 (797 acessos). Um contador atende vários vendedores. | Cadastro por e-mail com Turnstile (pode precisar de humano; talvez peça CPF ou celular depois, não confirmado). Post de usuário novo é moderado. Cerca de 15 min por resposta. | **Top 3 (canal recomendado)** |
| **Comunidade: Reddit r/mercadolivre** | #6 1vzhvjg taxas (≈ set/2026), #7 1vuxhpd, #8 1t7q7u1, #9 1rxhml0 Full. Títulos vistos só pelo índice; não deu para ler o post (403). | Conta por e-mail. Automod filtra conta nova e autopromoção é proibida. Cerca de 10 min por comentário. Alto risco de remoção. | **Top 3 (teste curto)** |
| Comunidade oficial ML | — | — | **Morto**: `comunidade.mercadolivre.com.br` dá NXDOMAIN. |
| Reclame Aqui / PROTESTE | Muita dor real (#14–19) | — | **Não é canal**: terceiro não responde. Uso só como fonte das palavras do usuário. |
| Adrenaline | Tópico geral, público pessoa física (#13) | Cadastro, ≈ 10 min | Encaixe fraco. Fora do top 3. |
| Social (FB grupos, WhatsApp, Telegram, Instagram) | Grupos de vendedor ML existem, mas não deu para verificar daqui | Exige celular com OTP, e alguém mantendo o perfil | Fora (bloqueado sem o celular do Felipe) |
| Vídeo (YouTube / TikTok) | Buscas "como conferir tarifa ML" têm vídeos | Gravar e manter canal | Fora por agora (custo alto) |
| Parcerias (escritórios contábeis, ERPs tipo Bling/Tiny) | Contadores do Contábeis mostram a dor | Outreach por e-mail precisa de aprovação do Felipe | Depois do teste Contábeis, se ele mostrar sinal |
| Plataformas / diretórios / TabNews / Bluesky / Mastodon / Lemmy | Tentados antes (ver DISTRIBUTION.md antigo) | — | Bloqueados antes |
| Submissão de URL (IndexNow / Search Console) | Ajuda o SEO a indexar mais rápido | 5 min. Search Console exige verificar a propriedade; IndexNow exige arquivo de chave no site | **Recomendado ao Felipe**. Não fiz (é submissão externa). |
| Ads / PR / afiliados / e-mail | Sem orçamento, lista ou pauta | — | Fora |

## 2. Gates por canal escolhido

| Gate | SEO guias | Contábeis | Reddit |
|---|---|---|---|
| Público real agora | ✅ autocomplete | ✅ threads de 2026 sem resposta | ⚠️ títulos de 2026, corpo não lido |
| Regras permitem | ✅ site próprio | ✅ regra 4: link "no sentido de auxílio"; moderado | ⚠️ autopromoção proibida; só comentário útil com aviso |
| Útil sem o link | ✅ passo a passo manual com fontes oficiais | ✅ rascunhos D1–D4 | ✅ D5–D9, mas confira o post antes |
| Palavras do usuário | ✅ títulos e aberturas usam as buscas | ✅ cita a frase de cada um | ⚠️ só pelo título |
| Mensurável | ⚠️ `?ref=` sim, mas a analytics não registra query string; referrer de buscador sim | ⚠️ por referrer `contabeis.com.br` | ⚠️ por referrer `reddit.com` |

## 3. Top 3 para testar, com meta e data de corte

| # | Canal | Ação | Meta | Data de corte |
|---|---|---|---|---|
| 1 | **SEO (4 guias já no ar)** | Esperar a indexação. Felipe pode acelerar com IndexNow ou Search Console. | ≥ 1 guia indexado (busca `site:mellow-quarry-n7jk.here.now/blog`) **e** ≥ 30 views em `/blog/*` com referrer de buscador | **2026-10-25** (sem isso, parar de escrever guias novos) |
| 2 | **Fórum Contábeis** (recomendado) | Postar D1–D4 (e mais 1 nova pergunta que surgir), no máximo 2 por dia | 5 respostas publicadas (aprovadas pela moderação) em 7 dias **e** ≥ 20 views com referrer `contabeis.com.br` | **2026-10-14** |
| 3 | **Reddit r/mercadolivre** | D5, D8, D6 (nessa ordem), um por dia, depois de ler cada post | 3 comentários que fiquem no ar **e** ≥ 15 views com referrer `reddit.com` | **2026-10-14**, ou na hora se o automod ou um mod remover um comentário |

Depois: concentrar só no canal que bater a meta. Se nenhum bater até 14/10, a tese "vendedor procura conferir repasse e tarifa" está fraca, e é o momento de voltar ao kill check das ferramentas (15–18/10).

## 4. Funil AARRR (um número por estágio)

| Estágio | Definição | Meta até 2026-10-25 | Como medir hoje |
|---|---|---|---|
| Aquisição | view em página de ferramenta ou guia vinda de fora (referrer ≠ Direct) | 100 | analytics here.now (topPaths + topReferrers) |
| Ativação | clicou em "exemplo" ou carregou um arquivo | 20 | **Não mensurável hoje** (ver seção 5) |
| Retenção | volta em até 30 dias | — | não mensurável (o here.now só dá visitantes únicos no período) |
| Indicação | link aparece em fórum ou referrer novo que não postamos | 1 | topReferrers |
| Receita | PIX ou doação | 1 | manual |

## 5. Dá para medir a ativação sem mandar dado de arquivo?
- **O que já existe:** a analytics do here.now (`/api/v1/publishes/<slug>/analytics`) só tem totais, série, topPaths, topReferrers, topCountries, topCrawlers e top404Paths. **Não tem evento customizado e não guarda query string**, então o `?ref=` não aparece.
- Teste em 2026-10-04 por volta de 09:52 BRT: pedir `/full-aging-estoque.html?ref=probe-analytics-test` e o CSV de exemplo `/exemplos/full-aging-estoque-exemplo.csv` **não aumentou a contagem de views**. Pedidos de asset ou fetch não contam.
- Os botões de exemplo já buscam arquivos do próprio site (`js/conferidor-repasse-ui.js:109`, `js/full-aging-estoque-ui.js:111`, `js/extrato-saques-mp-ui.js:142`, `js/auditor-tarifas-ml-ui.js:98`), mas isso não aparece na analytics. "Arquivo carregado" não tem beacon nenhum.
- **Conclusão: hoje a ativação não é mensurável** com o que já existe. Opções para o Felipe decidir (não implementei nenhuma):
  - (a) o botão de exemplo navega para uma página real e mínima do próprio site (ex.: `/e/exemplo-auditor.html`) que aparece em topPaths. Não envia nada do arquivo e não usa terceiros.
  - (b) usar o "Site Data" do here.now (exige criar `.herenow/data.json` e escrever via JS), gravando só um contador "carregou arquivo", nunca o conteúdo.
  - Nenhum rastreador de terceiros.
- Atribuição por canal fica **só por domínio de referrer** (contabeis.com.br, reddit.com, google). Os `?ref=` já estão nos links para o dia em que houver medição por query.

## 6. Tags `?ref=`
- Guias: `guia-repasse-atalho`, `guia-repasse-para-saque`, `guia-repasse-para-tarifa`, `guia-tarifa-calc`, `guia-tarifa-atalho`, `guia-tarifa-para-repasse`, `guia-saque-atalho`, `guia-saque-para-repasse`, `guia-full-atalho`, `guia-full-para-tarifa`.
- Ferramenta → guia: `tool-conferidor`, `tool-auditor`, `tool-extrato`, `tool-full-aging`. Índice do blog: `blog-index-*-1..4`.
- Fórum: `forum-contabeis-1..4`, `forum-reddit-6/7/8/9/11`, `forum-adrenaline-13`.
- Sem `?ref=`: links para páginas oficiais do ML ou MP (não são nossos) e a navegação do cabeçalho e rodapé compartilhados.

## 7. Log de distribuição (preencher a cada ação)

| Data (BRT) | Canal | URL do post | ref | Ação | Views com esse referrer em +3 dias | Em +7 dias | Ficou no ar? | Nota |
|---|---|---|---|---|---|---|---|---|
| 2026-10-04 | SEO | /blog/como-conferir-repasse-mercado-livre.html | guia-repasse-* | guia publicado | 1 view (Direct); 0 de buscador (07/10) | 1 view, 0 de buscador (11/10) | sim | |
| 2026-10-04 | SEO | /blog/tarifa-mercado-livre-como-conferir.html | guia-tarifa-* | guia publicado | 0 (07/10) | 0 (11/10) | sim | |
| 2026-10-04 | SEO | /blog/saque-mercado-pago-nao-caiu.html | guia-saque-* | guia publicado | 0 (07/10) | 0 (11/10) | sim | |
| 2026-10-04 | SEO | /blog/custo-estoque-antigo-full.html | guia-full-* | guia publicado | 0 (07/10) | 0 (11/10) | sim | |
| 2026-10-07 | SEO (descoberta) | github.com/Felandim/precifica (README) | github-readme-* | tabela 4 ferramentas + 4 guias | github.com 2→3 (1 view em 08/10, não confirmada; 10/10) | github.com 3 (14/10, log do dia); 4 em 16–17/10 | sim | medir por referrer github.com |
| 2026-10-08 | SEO | /blog/ | blog-index-* | título/descrição/H1 do índice alinhados aos 4 guias + IndexNow | 0 de buscador (conferido tarde, 17/10) | /blog 2 views no total (Direct), 0 de buscador (conferido tarde, 17/10) | sim | |
| 2026-10-09 | SEO | /blog/saque-mercado-pago-nao-caiu.html | guia-saque-* | FAQ + FAQPage + IndexNow | 0 (12/10) | 0 (conferido tarde, 17/10) | sim | |
| 2026-10-10 | SEO | /blog/tarifa-mercado-livre-como-conferir.html | guia-tarifa-* | FAQ + FAQPage + IndexNow | 0 (13/10) | 0 (17/10) | sim | |
| 2026-10-11 | SEO | /blog/como-conferir-repasse-mercado-livre.html | guia-repasse-* | FAQ + FAQPage + IndexNow | 1 view no total (Direct), 0 de buscador (conferido tarde, 17/10) | 1 view no total (Direct), 0 de buscador (18/10) | sim | |
| 2026-10-12 | SEO | / (home) | — | seção "O dinheiro do Mercado Livre bateu?" com links diretos aos 4 guias + IndexNow | 0 de buscador (conferido tarde, 17/10) | em 19/10 | sim | title da home não mudado (uma mudança por vez) |
| 2026-10-13 | SEO | / (home) | — | title/description/og:* da home na dor do vendedor ML ("Calculadora Mercado Livre: preço, tarifa e repasse") + sitemap lastmod + IndexNow | 0 de buscador (conferido tarde, 17/10) | em 20/10 | sim | medir por referrer de buscador em / e nos guias |
| 2026-10-14 | SEO | /conferidor-repasse-ml.html | — | title/description "Conciliação Mercado Livre" + IndexNow | página tirada do ar em 15/10 | — | não | kill check |
| 2026-10-15 | KILL CHECK | /conferidor-repasse-ml.html | — | 2 views em 14 dias (< 100), 0 sinal externo → tirada do ar; guia manual do repasse fica | — | — | não (404) | ver IDEAS/conferidor-repasse-ml.md |
| 2026-10-16 | KILL CHECK | /extrato-x-saques-mp.html | — | 0 views em 14 dias (< 80), 0 sinal externo → tirada do ar; guia manual do saque fica; SEO auditor title "Tarifa Mercado Livre" | — | — | não (404) | ver IDEAS/extrato-x-saques-mp.md |
| 2026-10-17 | KILL CHECK | /auditor-tarifas-ml.html | — | 0 views em 14 dias (< 80), 0 sinal externo → tirada do ar; guia manual da tarifa fica (atalho virou "Se a tarifa está certa, mas o problema continua") | — | — | não (404) | ver IDEAS/auditor-tarifas-ml.md |
| 2026-10-17 | SEO | /blog/custo-estoque-antigo-full.html | guia-full-* | title → "Custo por estoque antigo Mercado Livre (Full): quais produtos pagam" (H1/corpo iguais) + sitemap lastmod + IndexNow | em 20/10 | em 24/10 | sim | autocomplete "custo por estoque antigo mercado livre" (threads.md); title antigo não tinha "Mercado Livre" |
| 2026-10-18 | KILL CHECK | /full-aging-estoque.html | — | 0 views em 14 dias (< 80), 0 sinal externo → tirada do ar; guia manual do Full fica (atalho virou "Se a lista está pronta, mas o custo continua"); js/vendor (SheetJS), js/activation.js e a/ saíram (sem uso) | — | — | não (404) | ver IDEAS/full-aging-estoque.md; nenhuma ferramenta ML fica no ar |
| 2026-10-18 | SEO | /blog/como-conferir-repasse-mercado-livre.html | guia-repasse-* | title → "Conciliação Mercado Livre: como conferir o repasse venda por venda" (H1/og/corpo iguais) + sitemap lastmod + IndexNow | em 21/10 | em 25/10 | sim | autocomplete "conciliação mercado livre" / "como fazer conciliação mercado livre" (threads.md); "como conferir repasse" não tem sugestão |

## 8. Revisão semanal
Domingo, 2026-10-11: comparar views por referrer nos três canais. Dobrar a aposta no melhor e cortar os outros. Última checagem em 2026-10-25 para o SEO.

### Revisão 2026-10-11
Nenhum canal moveu a métrica (Google/Bing 0 páginas indexadas, 0 views de buscador; README 1 view não confirmada). Esperar o Google não basta antes dos kill checks. Proposta levada ao Felipe: Reddit r/mercadolivre com conta do box por e-mail (sem celular, sem ação dele), 1 comentário útil por dia, meta 3 no ar e ≥15 views reddit.com até 18/10. Aguardando o OK dele (contraria a regra só Google/Bing de 04/10).

### Revisão 2026-10-18
Números reais (analytics here.now, 08:19 BRT, antes das nossas checagens): all-time 78 views / 65 visitantes; 30d 60 / 47; últimos 7 dias (12–18/10) 9 views / 9 visitantes, **todas em `/`**; Direct 8, github.com 1. Nenhuma view com referrer de buscador desde o início (04/09). Google `site:` 0 páginas, Bing `site:` 0 páginas. Crawlers 30d: Bingbot 12, Googlebot 4 (3 deles nos últimos 7 dias, mas sem página indexada).

| Canal | Desde | Resultado real | Veredito |
|---|---|---|---|
| SEO Google/Bing (4 guias + /blog/ + home; ~1 mudança SEO por dia desde 06/10; IndexNow 200/202) | 04/10 | 0 páginas indexadas; 0 views de buscador em 14 dias; guias: /blog 2 views, repasse 1, tarifa 0, saque 0, Full 0 (todas Direct) | Não moveu. Mantém o corte de 25/10 (≥1 guia indexado e ≥30 views de buscador); sem guia novo |
| README GitHub (Felandim/precifica) | 07/10 | github.com 2 → 4 views (+2 em 11 dias; 1 nos últimos 7 dias), caem em `/`, nunca numa ferramenta ou guia | Melhor "sinal" e irrelevante (2 views). Manter como está, custo 0; não investir mais |
| Contábeis / Reddit | — | cortados pelo Felipe em 04/10 (sem celular); proposta Reddit de 11/10 não foi aprovada | Fora |

**Conclusão:** nenhum canal moveu a métrica; não há canal para dobrar a aposta. As 4 ferramentas de arquivo reprovaram nos kill checks (conferidor 15/10: 2 views; extrato 16/10: 0; auditor 17/10: 0; full-aging 18/10: 0) e saíram do ar. **O objetivo do DISTRIBUTION MODE (trazer vendedores do ML às 4 ferramentas) acabou.** Ficam no ar os 4 guias manuais, o /blog/ e as calculadoras antigas.

**Recomendação para a rotina diária daqui em diante:**
1. Precifica: parar de mexer nos guias. Só checar a analytics (sem nova mudança SEO) até o corte de 25/10; em 25/10 aplicar a regra (sem ≥1 guia indexado e ≥30 views de buscador → encerrar o trabalho de SEO do Precifica e deixar o site parado no ar, sem custo).
2. Nenhum produto novo sem aprovação do Felipe (regra de 15/10: "build nothing before he approves"). O próximo passo útil é montar um lote de ideias em **outros nichos**, incluindo consumidor comum (não só vendedor/empresa), com as knockouts duras antes da nota: a IA faz a partir de um prompt ou arquivo = morre; sem canal alcançável (sem celular, sem fórum) = morre; sem caminho de pagamento = morre. Levar o lote ao Felipe e esperar o OK.
3. Lição para o lote: as 4 ferramentas morreram na **aquisição** (0–2 views cada), não na ativação. Toda ideia nova precisa provar um canal de aquisição que já funcione para nós antes de ser construída; "SEO e esperar" sozinho não bastou em 14 dias num domínio novo (here.now) sem links de entrada.

