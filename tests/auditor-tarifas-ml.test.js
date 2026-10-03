// Testes Auditor de tarifas ML. Rodar: node tests/auditor-tarifas-ml.test.js
"use strict";
var path = require("path"), fs = require("fs");
var ROOT = path.join(__dirname, "..");
var A = require(path.join(ROOT, "js/auditor-tarifas-ml.js"));

var results = [];
function t(name, fn) {
  try { fn(); results.push({ name: name, ok: true }); }
  catch (e) { results.push({ name: name, ok: false, err: e && e.message }); }
}
function eq(a, b, msg) {
  var A0 = JSON.stringify(a), B = JSON.stringify(b);
  if (A0 !== B) throw new Error((msg || "") + " esperado " + B + ", veio " + A0);
}
function ok(v, msg) { if (!v) throw new Error(msg || "falso"); }
function approx(a, b, eps) { if (Math.abs(a - b) > (eps || 0.05)) throw new Error("esperado ~" + b + ", veio " + a); }

t("csv: ; com BOM", function () {
  eq(A.parseCSV("\uFEFFa;b\n1;2"), [["a", "b"], ["1", "2"]]);
});
t("número e data BR", function () {
  eq(A.parseNumber("1.234,56"), 1234.56);
  eq(A.parseDate("01/09/2026"), "2026-09-01");
});
t("parseFeeParts: líquido R$", function () {
  var p = A.parseFeeParts("Custo por vender no Mercado Livre: bruto R$ 16,00, desconto R$ 0,00, líquido R$ 16,00");
  ok(p.length >= 1);
  approx(p[0].valor, 16);
  ok(/custo por vender/i.test(p[0].name));
});
t("parseFeeParts: dois conceitos com |", function () {
  var p = A.parseFeeParts("Custo por vender: líquido R$ 32,00 | Tarifa de envio extra: líquido R$ 38,00");
  ok(p.length >= 2);
  approx(p[0].valor + p[1].valor, 70);
});
t("classifyFeeText", function () {
  eq(A.classifyFeeText("Custo por vender no Mercado Livre"), "custo_vender");
  eq(A.classifyFeeText("Tarifa de envio extra ou intermunicipal"), "envio");
  eq(A.classifyFeeText("Algo desconhecido xyz"), "outros");
});
t("median", function () {
  eq(A.median([1, 3, 2]), 2);
  eq(A.median([1, 2, 3, 4]), 2.5);
});
t("buildTable exemplo oficial", function () {
  var csv = fs.readFileSync(path.join(ROOT, "exemplos/auditor-tarifas-ml-exemplo.csv"), "utf8");
  var tb = A.buildTable(A.parseCSV(csv));
  ok(tb.ok, tb.error);
  ok(tb.map.op != null);
  ok(tb.map.bruto != null);
  ok(tb.map.tarifas != null);
});
t("audit exemplo: marca alta, envio e conflito", function () {
  var csv = fs.readFileSync(path.join(ROOT, "exemplos/auditor-tarifas-ml-exemplo.csv"), "utf8");
  var tb = A.buildTable(A.parseCSV(csv));
  var R = A.audit([tb], { feePctThreshold: 20 });
  ok(R.resumo.operacoes >= 9);
  ok(R.resumo.flagged >= 2, "esperava flags, veio " + R.resumo.flagged);
  var byOp = {};
  R.rows.forEach(function (r) { byOp[r.op] = r; });
  ok(byOp["2000090000000104"], "falta 0104");
  ok(byOp["2000090000000104"].feePct > 20);
  ok(byOp["2000090000000104"].status === "alta" || byOp["2000090000000104"].status === "outlier");
  ok(byOp["2000090000000106"]);
  eq(byOp["2000090000000106"].status, "envio");
  ok(byOp["2000090000000107"]);
  ok(byOp["2000090000000107"].feeParts.length >= 2);
  ok(byOp["2000090000000107"].reasons.some(function (x) { return /conflit/i.test(x); }) || byOp["2000090000000107"].status === "conflito");
});
t("audit: limiar customizado 40% não marca 35%", function () {
  var csv = "Número da operação;Data da venda;Tipo de operação;(=) Valor bruto;Valor total de tarifas;Detalhes de tarifas;Valor líquido após tarifas\n" +
    "1;01/09/2026;Venda;100,00;16,00;\"Custo por vender: líquido R$ 16,00\";84,00\n" +
    "2;02/09/2026;Venda;200,00;70,00;\"Custo por vender: líquido R$ 70,00\";130,00\n";
  var tb = A.buildTable(A.parseCSV(csv));
  ok(tb.ok);
  var R20 = A.audit([tb], { feePctThreshold: 20 });
  var R40 = A.audit([tb], { feePctThreshold: 40 });
  var r2_20 = R20.rows.filter(function (r) { return r.op === "2"; })[0];
  var r2_40 = R40.rows.filter(function (r) { return r.op === "2"; })[0];
  ok(r2_20.status === "alta" || r2_20.status === "outlier");
  ok(r2_40.feePct < 40);
});
t("concepts: soma custo_vender", function () {
  var csv = fs.readFileSync(path.join(ROOT, "exemplos/auditor-tarifas-ml-exemplo.csv"), "utf8");
  var R = A.audit([A.buildTable(A.parseCSV(csv))], { feePctThreshold: 20 });
  var cv = R.concepts.filter(function (c) { return c.key === "custo_vender"; })[0];
  ok(cv && cv.valor > 0, "custo_vender deveria ter valor");
});
t("toCSV: BOM e só marcadas", function () {
  var csv = fs.readFileSync(path.join(ROOT, "exemplos/auditor-tarifas-ml-exemplo.csv"), "utf8");
  var R = A.audit([A.buildTable(A.parseCSV(csv))], { feePctThreshold: 20 });
  var all = A.toCSV(R, false);
  var fl = A.toCSV(R, true);
  ok(all.charCodeAt(0) === 0xFEFF);
  ok(fl.split(/\r?\n/).length <= all.split(/\r?\n/).length);
  ok(fl.indexOf("Número da operação") >= 0);
});
t("op sem bruto mas com tarifas: ok build se tarifas mapeada", function () {
  var csv = "Número da operação;Tipo de operação;Valor total de tarifas\n9;Envio;10,00\n";
  var tb = A.buildTable(A.parseCSV(csv));
  ok(tb.ok);
});

var fail = results.filter(function (r) { return !r.ok; });
results.forEach(function (r) {
  if (!r.ok) console.log("FALHA: " + r.name + " — " + r.err);
});
console.log("Auditor tarifas: " + results.length + " testes, falhas=" + fail.length);
process.exit(fail.length ? 1 : 0);
