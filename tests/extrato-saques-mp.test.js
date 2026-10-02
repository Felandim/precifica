// Testes Extrato × saques MP. Rodar: node tests/extrato-saques-mp.test.js
"use strict";
var path = require("path"), fs = require("fs");
var ROOT = path.join(__dirname, "..");
var E = require(path.join(ROOT, "js/extrato-saques-mp.js"));

var results = [];
function t(name, fn) {
  try { fn(); results.push({ name: name, ok: true }); }
  catch (e) { results.push({ name: name, ok: false, err: e && e.message }); }
}
function eq(a, b, msg) {
  var A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg || "") + " esperado " + B + ", veio " + A);
}
function ok(v, msg) { if (!v) throw new Error(msg || "falso"); }

t("csv: ; e BOM", function () {
  eq(E.parseCSV("\uFEFFa;b\n1;2"), [["a", "b"], ["1", "2"]]);
});
t("número BR e data", function () {
  eq(E.parseNumber("1.250,40"), 1250.4);
  eq(E.parseDate("05/09/2026"), "2026-09-05");
  eq(E.parseDate("20260905120000"), "2026-09-05");
});
t("looksLikeMP e looksLikeSaque", function () {
  ok(E.looksLikeMP("TED MERCADOPAGO INSTITUICAO"));
  ok(E.looksLikeMP("PAG*MERCADOPAGO"));
  ok(E.looksLikeMP("CREDITO MERPAGO SAQUE"));
  ok(!E.looksLikeMP("PIX RECEBIDO JOAO"));
  ok(E.looksLikeSaque("Withdrawal to bank account"));
  ok(E.looksLikeSaque("Saque para conta bancária"));
  ok(!E.looksLikeSaque("release"));
});
t("OFX: lê STMTTRN crédito/débito", function () {
  var ofx = fs.readFileSync(path.join(ROOT, "exemplos/extrato-banco-exemplo.ofx"), "utf8");
  var tx = E.parseOFX(ofx);
  ok(tx.length >= 4);
  eq(tx.filter(function (x) { return x.valor > 0; }).length, 4);
  ok(tx.some(function (x) { return x.valor === 1250.4 && x.data === "2026-09-05"; }));
});
t("exemplos CSV: 3 casados, 1 saque sem crédito, 1 crédito órfão", function () {
  var bank = E.buildBankTable(E.parseCSV(fs.readFileSync(path.join(ROOT, "exemplos/extrato-banco-exemplo.csv"), "utf8")));
  var saque = E.buildSaqueTable(E.parseCSV(fs.readFileSync(path.join(ROOT, "exemplos/saques-mp-exemplo.csv"), "utf8")));
  ok(bank.ok); ok(saque.ok);
  var B = E.extractBankCredits([bank], null, { onlyMP: true });
  var S = E.extractSaques([saque], { onlySaqueHints: true });
  eq(B.credits.length, 4);
  eq(S.saques.length, 4);
  ok(S.usadasHints);
  var R = E.reconcile(S.saques, B.credits, { windowDays: 2 });
  eq(R.counts.ok, 3);
  eq(R.counts.saque_sem_credito, 1);
  eq(R.counts.credito_sem_saque, 1);
  eq(R.totais.saquesSemCredito, 777);
  eq(R.totais.creditosSemSaque, 500);
});
t("janela de datas: saque D+1 casa com crédito", function () {
  var saques = [{ id: "1", data: "2026-09-05", valor: 100, desc: "saque" }];
  var credits = [{ id: "c1", data: "2026-09-06", valor: 100, desc: "MERCADOPAGO" }];
  var R0 = E.reconcile(saques, credits, { windowDays: 0 });
  eq(R0.counts.ok, 0);
  var R1 = E.reconcile(saques, credits, { windowDays: 1 });
  eq(R1.counts.ok, 1);
});
t("tolerância R$ 0,05", function () {
  var saques = [{ id: "1", data: "2026-09-05", valor: 100, desc: "saque" }];
  var credits = [{ id: "c1", data: "2026-09-05", valor: 100.04, desc: "MERCADOPAGO" }];
  eq(E.reconcile(saques, credits, {}).counts.ok, 1);
  credits[0].valor = 100.06;
  eq(E.reconcile(saques, credits, {}).counts.ok, 0);
});
t("onlyMP=false inclui crédito genérico", function () {
  var csv = "Data;Histórico;Valor\n01/09/2026;DEPOSITO AVULSO;50,00\n";
  var bank = E.buildBankTable(E.parseCSV(csv));
  var B1 = E.extractBankCredits([bank], null, { onlyMP: true });
  var B2 = E.extractBankCredits([bank], null, { onlyMP: false });
  eq(B1.credits.length, 0);
  eq(B2.credits.length, 1);
});
t("arquivo só de saques (sem hint) usa todas as linhas", function () {
  var csv = "Data;Valor;Descrição\n10/09/2026;200,00;Envio\n11/09/2026;300,00;Outro\n";
  var t = E.buildSaqueTable(E.parseCSV(csv));
  ok(t.ok);
  var S = E.extractSaques([t], { onlySaqueHints: true });
  eq(S.saques.length, 2);
  ok(!S.usadasHints);
});
t("export CSV tem BOM e status", function () {
  var R = E.reconcile(
    [{ id: "1", data: "2026-09-05", valor: 10, desc: "saque" }],
    [{ id: "c", data: "2026-09-05", valor: 10, desc: "MERCADOPAGO" }],
    {}
  );
  var csv = E.exportCSV(R);
  ok(csv.charCodeAt(0) === 0xFEFF);
  ok(csv.indexOf("ok;") >= 0 || csv.indexOf("ok\r") < 0 && csv.indexOf(";ok;") < 0);
  ok(/ok;2026-09-05/.test(csv));
});
t("OFX exemplo casa com saques do CSV", function () {
  var ofx = E.parseOFX(fs.readFileSync(path.join(ROOT, "exemplos/extrato-banco-exemplo.ofx"), "utf8"));
  var saque = E.buildSaqueTable(E.parseCSV(fs.readFileSync(path.join(ROOT, "exemplos/saques-mp-exemplo.csv"), "utf8")));
  var B = E.extractBankCredits([], ofx, { onlyMP: true });
  var S = E.extractSaques([saque], { onlySaqueHints: true });
  var R = E.reconcile(S.saques, B.credits, { windowDays: 2 });
  eq(R.counts.ok, 3);
});

var fail = results.filter(function (r) { return !r.ok; });
results.forEach(function (r) {
  if (!r.ok) console.log("FALHA: " + r.name + " — " + r.err);
});
console.log("Extrato×saques: " + results.length + " testes, falhas=" + fail.length);
process.exit(fail.length ? 1 : 0);
