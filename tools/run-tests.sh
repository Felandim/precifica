#!/bin/bash
# Suíte do Precifica: motor JS (precifica.js runTests) + tests/*.test.js (Node) + testes Python em tests/ (se houver).
# O Radar Mercado Livre foi despublicado em 2026-10-01 (reprovou no filtro cético, 10/18);
# código + testes dele estão em /workspace/precifica-shelved/radar/ (para rodar os testes dele:
#   cd /workspace/precifica-shelved/radar && python3 -m unittest discover -s tests -p 'test_*.py').
set -uo pipefail
cd "$(dirname "$0")/.."
node -e 'var P=require("./js/precifica.js"); var r=P.runTests(); var f=r.filter(function(x){return !x.ok}).length; console.log("JS: "+r.length+" testes, falhas="+f); process.exit(f?1:0);' > /tmp/precifica-jstests.out 2>&1
js=$?; tail -1 /tmp/precifica-jstests.out
# Testes Node em tests/*.test.js (ex.: conferidor de repasse ML: parser, casamento, bordas)
for f in tests/*.test.js; do
  [ -e "$f" ] || continue
  node "$f" > /tmp/precifica-nodetest.out 2>&1; r=$?
  grep -E "FALHA|testes, falhas" /tmp/precifica-nodetest.out
  [ $r -ne 0 ] && js=1
done
py=0
if compgen -G "tests/test_*.py" > /dev/null; then
  PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py' 2>&1 | tail -3
  py=${PIPESTATUS[0]}
else
  echo "Python: nenhum teste em tests/ (radar arquivado)"
fi
if [ $js -eq 0 ] && [ $py -eq 0 ]; then echo "SUÍTE OK"; exit 0; fi
echo "SUÍTE FALHOU (js=$js py=$py)"; exit 1
