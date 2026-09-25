# Precifica

Calculadora de preço para Mercado Livre, Shopee e Amazon. Site estático: HTML, CSS e um `js/precifica.js` que monta a UI sozinho. Sem bundler, sem cadastro, sem servidor de cálculo.

**No ar (canônico, durável):** https://mellow-quarry-n7jk.here.now/
Espelho no GitHub Pages: https://felandim.github.io/precifica/ (as páginas apontam `canonical` pro here.now).

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

1. `bash tools/stage-public.sh /tmp/precifica-pub` monta a árvore pública (sem segredos, logs, planilha, notas internas).
2. Publica no here.now (slug permanente `mellow-quarry-n7jk`).
3. Atualiza `site-manifest.txt` (`cd /tmp/precifica-pub && find . -type f | sed 's#^\./##' | sort | xargs sha256sum`) e commita na `main`
   junto com as fontes alteradas. O workflow `sync-from-live` baixa cada arquivo do here.now, confere o sha256,
   commita na `main` e espelha o site em `gh-pages`.

Nunca versionar: credenciais do here.now, `herenow.json`, claims, `LIVE_URL.txt`, logs, `keepalive.*`, `cloudflared*` (ver `.gitignore`).
