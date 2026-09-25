#!/bin/bash
# Build clean public tree for here.now / ZeroDeploy (no secrets).
set -euo pipefail
ROOT=/workspace/precifica
STAGE=${1:-/tmp/precifica-pub}
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -C "$ROOT" -cf - \
  --exclude='.git' --exclude='tools' --exclude='_ship_tmp' --exclude='_xlsxgen' \
  --exclude='.herenow' --exclude='herenow.json' --exclude='zerodeploy-claim.json' \
  --exclude='LIVE_URL.txt' --exclude='keepalive.sh' --exclude='keepalive.*' \
  --exclude='*.log' --exclude='*.nohup' --exclude='*.xlsx' --exclude='SHIPPED-*.md' \
  --exclude='README.md' --exclude='DISTRIBUTION.md' \
  --exclude='07a8af429e89100dd60bab9dd62b955b.txt' --exclude='cloudflared.log' \
  --exclude='*.txt' \
  . | tar -C "$STAGE" -xf -
# keep robots.txt + sitemaps (txt exclude was too broad for robots — restore)
cp -a "$ROOT/robots.txt" "$STAGE/" 2>/dev/null || true
cp -a "$ROOT/sitemap.xml" "$STAGE/" 2>/dev/null || true
cp -a "$ROOT/sitemap-live.xml" "$STAGE/" 2>/dev/null || true
echo "$STAGE"
find "$STAGE" -type f | wc -l
