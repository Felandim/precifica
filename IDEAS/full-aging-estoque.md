# Scorecard: Aging de estoque Full (Excel Full → risco e custo estimado)

Filtro: `filtro-c-tico-de-ideia-de-produto/SKILL.md`. Avaliado em 2026-10-04 (PT). Lote 2026-10-04.

Ideia: o seller solta o **Excel/CSV oficial do Full** (Controle de estoque / Relatório geral / consolidado de movimentações). A página classifica aging (faixas 0–30 / 31–60 / 61–90 / 90+ dias), estima **custo de armazenamento diário** com a tabela oficial de porte (editável), projeta o mês seguinte e marca SKUs perto do **custo por estoque antigo** (2 meses Supermercado / 4 meses demais). **Não** é a calculadora `custo-full.html` (1 SKU na mão) — processa o inventário inteiro do export.

## Gates

| # | Gate | Resultado | Evidência |
|---|------|-----------|-----------|
| 1 | Teste da IA | **Passa (fraca)** | ChatGPT aplica `unidades × diária × dias` em 5 linhas. Falha no Excel Full com cabeçalhos PT, centenas de SKUs, buckets de aging, ranking de risco e export CSV. Estimo ~40% no chat. |
| 2 | O que falta à IA | **Passa** | Arquivo do usuário (export Full); processamento local em lote. |
| 3 | Dor real | **Passa** | Estoque parado no Full gera armazenagem diária + custo por estoque antigo. Sellers descobrem na fatura. Patrick Cardoso (ago/2026): "estoque parado está comendo sua margem em silêncio" — rotina semanal no Excel Full (https://patrickcardoso.com.br/blog/mercado-livre-full-estoque-parado-2026). Central ML: "Custo por estoque antigo" após 2/4 meses (https://vendedores.mercadolivre.com.br/aprender/nota/quanto-custa-vender-pelo-full). |
| 4 | Prova de interesse | **Passa** | Página oficial Full com tabela R$ 0,007–0,107/un/dia (https://envios.mercadolivre.com.br/mercado-envios-full). Guias: Ajudaecom "7 taxas Full" (https://ajudaecom.com.br/full-mercado-livre/), Letzee guia Full (https://letzee.ai/mercado-livre-full-guia-completo-para-vendedores/). Demanda SEO: "estoque parado full", "custo estoque antigo mercado livre". ERPs cobram controle Full (AnyMarket, Protheus). |
| 5 | Dado legítimo | **Passa** | Relatórios Excel oficiais documentados: "Como gerenciar seu estoque Full com os relatórios de Excel" (https://vendedores.mercadolivre.com.br/aprender/nota/como-gerenciar-seu-estoque-full-com-os-relatorios-de-excel) — Controle de estoque, Relatório geral, consolidado de movimentações. Sem login nosso, sem scraping. Mapeamento tolerante a colunas PT. |

**Existe grátis?** Calculadoras de Full (1 produto) sim — Precifica já tem `custo-full.html`. Não achei ferramenta grátis "solte o Excel Full e rode o aging + custo estimado do lote".

## Notas

| # | Critério | Nota | Por quê |
|---|----------|------|---------|
| 6 | Frequência | **2** | Rotina semanal/quinzenal de Full (recomendação dos guias). |
| 7 | Fosso | **1** | Código copiável; histórico local de snapshots ajudaria depois. |
| 8 | Distribuição | **2** | SEO ("custo estoque antigo full", "aging full mercado livre") + funil Precifica (custo-full → ferramenta de arquivo). |
| 9 | Caminho para pagamento | **3** | Achar SKU que vai gerar R$ centenas de armazenagem → liquidar/retirar = dinheiro salvo. PIX muito plausível. |
| 10 | Custo de manutenção | **2** | Diárias mudam (tabela editável na UI). Colunas do Excel Full variam por relatório — mapeamento + aliases. Sem scrape. |
| 11 | Métrica de 14 dias | **3** | Abaixo. |

**Total: 13/18.** Gates: 5/5 (gate 1 fraca).

## Métrica de morte (definir antes de construir)
Janela: **2026-10-04 → 2026-10-18 PT**
1. ≥ 80 page views em `/full-aging-estoque.html` (analytics here.now), **ou** visitas do site +15% vs. 14 dias anteriores se não houver dado por página;
2. **E** ≥ 1 PIX, mensagem citando a ferramenta, ou SKU encalhado real relatado.

Se 1 ou 2 falhar: tirar do ar, sem v2.

## Decisão
**PASSA na régua 13/18 → CONSTRUIR** (melhor do lote 2026-10-04 se nenhuma outra ≥13).

## Resultado do kill check (2026-10-18)
- Critério 1: ≥ 80 views em `/full-aging-estoque.html` em 14 dias (04/10 → 18/10) → **0** (a página nunca apareceu em topPaths da analytics here.now, nem no all-time; a analytics separa por página, então o critério alternativo +15% não se aplica).
- Critério 2: ≥ 1 PIX, mensagem citando a ferramenta ou SKU encalhado real relatado → **nenhum** (inbox do bot landas@mail.grokbot.com sem nenhuma thread desde 04/10).
- **REPROVOU → tirada do ar em 2026-10-18, sem v2.** Backup: `/workspace/precifica-killed/full-aging-2026-10-18/` (inclui `pre-edit/`). O guia manual `/blog/custo-estoque-antigo-full.html` continua no ar (o atalho virou "Se a lista está pronta, mas o custo continua", sem ferramenta).
- Saíram junto: `js/vendor/` (SheetJS) e `js/activation.js` + pasta `a/` (beacons), porque nenhuma página restante usa.
- Com isso **nenhuma das 4 ferramentas de arquivo do Mercado Livre ficou no ar** (conferidor 15/10, extrato 16/10, auditor 17/10, full-aging 18/10). Todas reprovaram por falta de aquisição (0–2 views por ferramenta em 14 dias), não por ativação.
