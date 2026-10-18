#!/bin/bash
# Publica o Precifica no Cloudflare Pages (permanente): stage limpo -> wrangler -> checa 200.
# Credenciais: /home/box/precifica-state/cloudflare.json (NUNCA versionar).
set -euo pipefail
ROOT=/workspace/precifica
STAGE=${STAGE:-/tmp/precifica-pub}
PROJECT=${CF_PAGES_PROJECT:-precifica-br}
SITE=https://precifica-br.pages.dev
source /workspace/bin/cf-env.sh
# Guarda: GitHub Pages é exclusivo do Brasileirão. Se o repo tiver branch gh-pages, para tudo.
code=$(curl -s -o /dev/null -w '%{http_code}' https://api.github.com/repos/Felandim/precifica/branches/gh-pages || true)
if [[ "$code" == 200 ]]; then echo "ERRO: Felandim/precifica tem branch gh-pages (GitHub Pages é só do Brasileirão). Apague antes de publicar." >&2; exit 3; fi
bash "$ROOT/tools/stage-public.sh" "$STAGE"
for bad in herenow.json zerodeploy-claim.json cloudflare.json LIVE_URL.txt keepalive.sh; do
  [[ -e "$STAGE/$bad" ]] && { echo "Refuse: $bad no stage" >&2; exit 2; }
done
(cd /workspace/.cf-work && wrangler pages deploy "$STAGE" --project-name="$PROJECT" --branch=main --commit-dirty=true)
sleep 5
curl -fsS -o /dev/null -w "home %{http_code}\n" "$SITE/"
curl -fsS "$SITE/site-manifest.txt" | cmp - "$STAGE/site-manifest.txt" && echo "manifest no ar = stage"
