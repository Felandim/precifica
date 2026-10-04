// Testes Aging Full. Rodar: node tests/full-aging-estoque.test.js
"use strict";
var path = require("path"), fs = require("fs");
var ROOT = path.join(__dirname, "..");
var A = require(path.join(ROOT, "js/full-aging-estoque.js"));
var results = [];
function t(name, fn) { try { fn(); results.push({ name: name, ok: true }); } catch (e) { results.push({ name: name, ok: false, err: e && e.message }); } }
function eq(a, b, msg) { var A0 = JSON.stringify(a), B = JSON.stringify(b); if (A0 !== B) throw new Error((msg || "") + " esperado " + B + ", veio " + A0); }
function ok(v, msg) { if (!v) throw new Error(msg || "falso"); }
function approx(a, b, eps) { if (Math.abs(a - b) > (eps || 0.05)) throw new Error("esperado ~" + b + ", veio " + a); }
t("csv BOM", function () { eq(A.parseCSV("\uFEFFa;b\n1;2"), [["a", "b"], ["1", "2"]]); });
t("número data", function () { eq(A.parseNumber("1.234,56"), 1234.56); eq(A.parseDate("01/09/2026"), "2026-09-01"); });
t("porte", function () { eq(A.classifyPorte("Extragrande"), "extragrande"); });
t("bucket", function () { eq(A.bucketFor(130), "120_plus"); });
t("exemplo", function () {
  var csv = fs.readFileSync(path.join(ROOT, "exemplos/full-aging-estoque-exemplo.csv"), "utf8");
  var R = A.analyze([A.buildTable(A.parseCSV(csv))], { asOf: "2026-10-04" });
  ok(R.resumo.skus >= 7); ok(R.resumo.flagged >= 2);
});
var fail = results.filter(function (r) { return !r.ok; });
console.log("FullAging: " + results.length + " testes, falhas=" + fail.length);
process.exit(fail.length ? 1 : 0);
