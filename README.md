# Precifica

Calculadora de preço para Mercado Livre, Shopee e Amazon. Site estático: HTML, CSS e um `js/precifica.js` que monta a UI sozinho. Sem bundler, sem cadastro, sem servidor de cálculo.

**No ar (canônico, durável):** https://mellow-quarry-n7jk.here.now/
Código-fonte aqui; o site público é só o do here.now.

## Guias grátis para vendedor do Mercado Livre

As 4 ferramentas de arquivo foram tiradas do ar nos kill checks de 15–18/10/2026 (nenhuma chegou à meta de uso). Os guias manuais continuam no ar.

| Problema | Ferramenta | Guia manual (passo a passo) |
|---|---|---|
| O repasse do Mercado Livre não bate com as vendas | — (tirada do ar em 15/10/2026; use o guia) | [Como conferir o repasse, venda por venda](https://mellow-quarry-n7jk.here.now/blog/como-conferir-repasse-mercado-livre.html?ref=github-readme-guia-repasse) |
| A tarifa do Mercado Livre veio mais alta que o esperado | — (tirada do ar em 17/10/2026; use o guia) | [Tarifa veio alta? Como conferir](https://mellow-quarry-n7jk.here.now/blog/tarifa-mercado-livre-como-conferir.html?ref=github-readme-guia-tarifa) |
| O saque do Mercado Pago não apareceu no extrato do banco | — (tirada do ar em 16/10/2026; use o guia) | [Saque não caiu? Como conferir com o extrato](https://mellow-quarry-n7jk.here.now/blog/saque-mercado-pago-nao-caiu.html?ref=github-readme-guia-saque) |
| Quais produtos do Full vão pagar custo por estoque antigo | — (tirada do ar em 18/10/2026; use o guia) | [Custo por estoque antigo no Full](https://mellow-quarry-n7jk.here.now/blog/custo-estoque-antigo-full.html?ref=github-readme-guia-full) |

## Abrir no computador

```bash
python3 -m http.server 8765
```

Abra http://localhost:8765 (pelo `file://` os caminhos relativos podem falhar).

## Chave PIX

Cada HTML tem, antes do `precifica.js`:

```html
<script>window.PRECIFICA_PIX_KEY = window.PRECIFICA_PIX_KEY || "7a941c50-b79f-4791-a7f4-5fe2a68ffea0";</script>
```

Os blocos `[data-pix-key]` e o botão `[data-copy-pix]` leem essa variável.

## Testes do motor

```bash
node -e "var P=require('./js/precifica.js'); P.runTests();"
```

## O que o JS espera no HTML

- Qualquer `[data-precifica-calc]` vira a calculadora. `data-preset` opcional: `ml-classico`, `ml-premium`, `shopee`, `amazon`, `magalu`, `direta`.
- `#pdf-modal` com `[data-print]` e `[data-print-close]`; `#print-sheet` para o PDF/impressão.
- `#year` recebe o ano atual.

Taxas são **estimativa**. Confirme no Seller Center / simulador oficial.

## Planilha (.xlsx)

`_xlsxgen/` gera `Precifica-precificacao.xlsx` com openpyxl (`python3 _xlsxgen/build.py`; o caminho de saída está em `build.py`). O `.xlsx` gerado não é versionado.

## Publicação (sem túnel)

1. `bash tools/stage-public.sh /tmp/precifica-pub` monta a árvore pública (sem segredos, logs, planilha, notas internas)
   e gera dentro dela `site-manifest.txt` (sha256 de cada arquivo público), mais `site-manifest.sha256` (hash do manifesto) na raiz do projeto.
2. Publica no here.now (slug permanente `mellow-quarry-n7jk`); o manifesto vai junto e fica em `/site-manifest.txt`.
3. Commita na `main` só `site-manifest.sha256` (uma linha) junto com as fontes alteradas. O workflow `sync-from-live` baixa
   o manifesto do here.now, confere o hash dele contra `site-manifest.sha256`, baixa cada arquivo, confere o sha256 e commita na `main`.

Nunca versionar: credenciais do here.now, `herenow.json`, claims, `LIVE_URL.txt`, logs, `keepalive.*`, `cloudflared*` (ver `.gitignore`).
