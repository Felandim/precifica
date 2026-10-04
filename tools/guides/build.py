#!/usr/bin/env python3
"""Monta os guias SEO (blog/*.html) a partir de *.body.html + cabeçalho/rodapé do blog."""
import json, os, html
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BASE = 'https://mellow-quarry-n7jk.here.now/blog/'
GUIDES = [
  ('repasse', 'como-conferir-repasse-mercado-livre.html',
   'Como conferir o repasse do Mercado Livre, venda por venda | Precifica',
   'Conciliação do Mercado Livre passo a passo: relatório Por venda e Por liberação, Número da operação, fórmula de planilha e o que fazer com cada diferença.',
   'Como conferir o repasse do Mercado Livre, venda por venda'),
  ('tarifa', 'tarifa-mercado-livre-como-conferir.html',
   'Tarifa do Mercado Livre veio alta? Como conferir venda por venda | Precifica',
   'Como achar a venda que puxou a tarifa para cima: % por operação no relatório Por vendas, simulador oficial, custo fixo, frete e como pedir revisão.',
   'Tarifa do Mercado Livre veio alta? Como conferir venda por venda'),
  ('saque', 'saque-mercado-pago-nao-caiu.html',
   'Saque do Mercado Pago não caiu na conta? Como conferir com o extrato | Precifica',
   'Passo a passo para casar os saques do relatório de liberações do Mercado Pago com o extrato do banco (OFX/CSV) e achar o saque que não caiu.',
   'Saque do Mercado Pago não caiu na conta? Como conferir com o extrato do banco'),
  ('full', 'custo-estoque-antigo-full.html',
   'Custo por estoque antigo no Full: quais produtos vão ser cobrados | Precifica',
   'Regra oficial do custo por estoque antigo do Full (4 meses, 2 em Supermercado), onde ver os dias de cada unidade e como montar a lista de risco antes da fatura.',
   'Custo por estoque antigo no Full: como ver quais produtos vão ser cobrados'),
]
header = open(os.path.join(HERE, '_header.html'), encoding='utf-8').read()
footer = open(os.path.join(HERE, '_footer.html'), encoding='utf-8').read()
for key, fname, title, desc, h1 in GUIDES:
    body = open(os.path.join(HERE, key + '.body.html'), encoding='utf-8').read()
    url = BASE + fname
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": h1, "description": desc,
          "inLanguage": "pt-BR", "datePublished": "2026-10-04", "dateModified": "2026-10-04",
          "mainEntityOfPage": url, "author": {"@type": "Organization", "name": "Precifica"},
          "publisher": {"@type": "Organization", "name": "Precifica"}}
    e = html.escape
    out = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="{url}">
  <meta property="og:title" content="{e(h1)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="pt_BR">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#12110c">
  <link rel="icon" href="../img/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/app.css">
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
  {header}

{body}
  {footer}'''
    open(os.path.join(ROOT, 'blog', fname), 'w', encoding='utf-8').write(out)
    print('ok', fname)
