// Testes do Conferidor de repasse ML (parser, casamento, bordas). Rodar: node tests/conferidor-repasse.test.js
"use strict";
var path = require("path"), fs = require("fs");
var ROOT = path.join(__dirname, "..");
var C = require(path.join(ROOT, "js/conferidor-repasse.js"));
var XLSX = require(path.join(ROOT, "js/vendor/xlsx-0.20.3.mini.min.js"));

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

function run(salesCsvs, relCsvs, opts) {
  var S = C.analyzeSales(salesCsvs.map(function (s) { return C.buildTable(C.parseCSV(s), "venda"); }));
  var R = C.analyzeReleases(relCsvs.map(function (s) { return C.buildTable(C.parseCSV(s), "liberacao"); }));
  return C.reconcile(S, R, opts || {});
}
function byOp(res, op) { return res.rows.filter(function (r) { return r.op === op; })[0]; }

var HV = "Número da operação;Data da venda;Tipo de operação;(=) Valor bruto;Valor total de tarifas;Valor líquido após tarifas\n";
var HL = "Número da operação;Data da liberação;Tipo de operação;Valor líquido\n";

// ---------- parser: CSV ----------
t("csv: ; com aspas, aspas escapadas, CRLF e BOM", function () {
  var rows = C.parseCSV('\uFEFFa;b;c\r\n1;"x; y";"diz ""oi"""\r\n\r\n2;;\r\n');
  eq(rows, [["a", "b", "c"], ["1", "x; y", 'diz "oi"'], ["2", "", ""]]);
});
t("csv: quebra de linha dentro de aspas", function () {
  eq(C.parseCSV('a,b\n"l1\nl2",3'), [["a", "b"], ["l1\nl2", "3"]]);
});
t("csv: detecta delimitador ; , e TAB", function () {
  eq(C.detectDelimiter("a;b;c\n1;2,5;3"), ";");
  eq(C.detectDelimiter("a,b,c\n1,2,3"), ",");
  eq(C.detectDelimiter("a\tb\tc\n1\t2\t3"), "\t");
});

// ---------- parser: números ----------
t("número: formatos BR, R$, sinais e parênteses", function () {
  eq(C.parseNumber("1.234,56"), 1234.56);
  eq(C.parseNumber("R$ -23,86"), -23.86);
  eq(C.parseNumber("–R$ 23,86"), -23.86);
  eq(C.parseNumber("−R$ 1.000,00"), -1000);
  eq(C.parseNumber("(10,00)"), -10);
  eq(C.parseNumber("23,86-"), -23.86);
  eq(C.parseNumber("+5,5"), 5.5);
});
t("número: formato ponto decimal / milhar e vazios", function () {
  eq(C.parseNumber("1234.5"), 1234.5);
  eq(C.parseNumber("1,234.56"), 1234.56);
  eq(C.parseNumber("3.299"), 3299);
  eq(C.parseNumber("0.51"), 0.51);
  eq(C.parseNumber(12), 12);
  eq(C.parseNumber(""), null);
  eq(C.parseNumber("abc"), null);
  eq(C.parseNumber(null), null);
  eq(C.parseNumber("1,2,3,4"), null);
});

// ---------- parser: datas ----------
t("data: dd/mm/aaaa, com hora, ISO e por extenso", function () {
  eq(C.parseDate("31/05/2026"), "2026-05-31");
  eq(C.parseDate("31/05/2026 14:22"), "2026-05-31");
  eq(C.parseDate("1/6/26"), "2026-06-01");
  eq(C.parseDate("2026-05-31T10:00:00.000-04:00"), "2026-05-31");
  eq(C.parseDate("15 de março de 2024 10:30 hs."), "2024-03-15");
  eq(C.parseDate("2 set 2026"), "2026-09-02");
});
t("data: inválidas viram null; serial do Excel e Date funcionam", function () {
  eq(C.parseDate("31/02/2026"), null);
  eq(C.parseDate("ontem"), null);
  eq(C.parseDate(""), null);
  eq(C.parseDate(46173), "2026-05-31");
  eq(C.parseDate(new Date(2026, 4, 31, 12)), "2026-05-31");
  eq(C.daysBetween("2026-08-06", "2026-09-30"), 55);
});

// ---------- parser: cabeçalhos ----------
t("cabeçalho: sinais (+)(–)(=), acentos e prioridade do match exato", function () {
  var h = ["Valor líquido", "(=) Valor bruto", "Valor líquido após tarifas", "Número da operação", "Desconto do Mercado Livre | Rebate"];
  var m = C.mapHeaders(h, C.SALES_FIELDS);
  eq(m.liquido, 2); eq(m.bruto, 1); eq(m.op, 3); eq(m.rebate, 4);
});
t("cabeçalho: pula linhas de título antes do cabeçalho", function () {
  var rows = C.parseCSV("Relatório de conciliação\nPeríodo: 01/08 a 31/08\n\n" + HV + "1;01/08/2026;Venda;10;1;9\n");
  eq(C.detectHeaderRow(rows), 2);
  var tb = C.buildTable(rows, "venda");
  ok(tb.ok, tb.error); eq(tb.data.length, 1);
});
t("cabeçalho: arquivo sem Número da operação dá erro claro", function () {
  var tb = C.buildTable(C.parseCSV("Pedido;Valor\n1;10"), "venda");
  eq(tb.ok, false); ok(/Número da operação/.test(tb.error));
});
t("cabeçalho: coluna faltando é listada e o mapeamento manual resolve", function () {
  var rows = C.parseCSV("Número da operação;Quando;Valor líquido após tarifas\n1;01/08/2026;10");
  var tb = C.buildTable(rows, "venda");
  eq(tb.ok, false); eq(tb.missing, ["Data da venda"]);
  var tb2 = C.buildTable(rows, "venda", { dataVenda: 1 });
  ok(tb2.ok, tb2.error);
  eq(C.analyzeSales([tb2]).ops["1"].dataVenda, "2026-08-01");
  var tb3 = C.buildTable(C.parseCSV(HV + "1;01/08/2026;Venda;10;1;9"), "venda", { bruto: "-1" });
  eq(tb3.map.bruto, undefined, "-1 = não usar");
});

// ---------- parser: detalhes de tarifas ----------
t("detalhes de tarifas: texto com várias tarifas soma os líquidos", function () {
  eq(C.parseFeeDetails("Custo por vender: bruto R$ 20,00, desconto R$ 2,00, líquido R$ 18,00 | Tarifa de envio: bruto R$ 34,08, desconto R$ 10,22, líquido R$ 23,86"), 41.86);
  eq(C.parseFeeDetails("liquido: 1.234,50"), 1234.5);
});
t("detalhes de tarifas: JSON e formato desconhecido", function () {
  eq(C.parseFeeDetails('[{"nome":"Custo por vender","bruto":1.64,"desconto":0.51,"liquido":1.13},{"nome":"Envio","net_amount":"23,86"}]'), 24.99);
  eq(C.parseFeeDetails("Tarifa de venda 12%"), null);
  eq(C.parseFeeDetails(""), null);
});

// ---------- relatório do Mercado Pago ----------
t("MP: cabeçalhos em código, só linhas release, crédito − débito, ORDER_ID com reserva", function () {
  var csv = "DATE,SOURCE_ID,EXTERNAL_REFERENCE,RECORD_TYPE,DESCRIPTION,NET_CREDIT_AMOUNT,NET_DEBIT_AMOUNT,GROSS_AMOUNT,ORDER_ID\n" +
    "2026-09-01T00:00:00.000-04:00,,,initial_available_balance,,500.00,0.00,,\n" +
    "2026-09-02T10:00:00.000-04:00,111,2000090000000001,release,payment,109.12,0.00,129.90,2000090000000001\n" +
    "2026-09-03T10:00:00.000-04:00,112,2000090000000002,release,shipping,0.00,23.86,0.00,\n" +
    "2026-09-03T10:00:00.000-04:00,113,,release,payout,0.00,300.00,0.00,\n" +
    "2026-09-30T00:00:00.000-04:00,,,total,,0.00,0.00,,\n";
  var tb = C.buildTable(C.parseCSV(csv), "liberacao");
  ok(tb.ok, tb.error);
  var R = C.analyzeReleases([tb]);
  eq(R.ops["2000090000000001"].liberado, 109.12);
  eq(R.ops["2000090000000002"].liberado, -23.86, "reserva EXTERNAL_REFERENCE");
  eq(R.ops["113"].liberado, -300, "saque cai no SOURCE_ID");
  eq(R.ignoradas, 2);
  eq(R.maxData, "2026-09-03");
});
t("MP: cabeçalhos em português com código entre parênteses", function () {
  var csv = "Data da liberação (DATE);ID do pedido (ORDER_ID);Tipo de registro (RECORD_TYPE);Valor líquido creditado (NET_CREDIT_AMOUNT);Valor líquido debitado (NET_DEBIT_AMOUNT)\n" +
    "2026-09-02;2000090000000001;release;109,12;0,00\n";
  var tb = C.buildTable(C.parseCSV(csv), "liberacao");
  ok(tb.ok, tb.error);
  eq(C.analyzeReleases([tb]).ops["2000090000000001"].liberado, 109.12);
});

// ---------- casamento ----------
t("casamento: arquivos de exemplo dão os status esperados", function () {
  var v = fs.readFileSync(path.join(ROOT, "exemplos/conferidor-ml-exemplo-por-venda.csv"), "utf8");
  var l = fs.readFileSync(path.join(ROOT, "exemplos/conferidor-ml-exemplo-por-liberacao.csv"), "utf8");
  var res = run([v], [l]);
  eq(res.refDate, "2026-09-30");
  var s = res.resumo;
  eq([s.ok, s.atrasadas, s.aguardando, s.diferencas, s.zeradas, s.soLiberacao, s.vendas], [7, 2, 1, 1, 1, 2, 12]);
  eq(s.atrasadoValor, 251.08); eq(s.aMenos, 10);
  eq(byOp(res, "2000090000000004").idade, 55);
  eq(res.checks.map(function (c) { return c.op + ":" + c.tipo; }), ["2000090000000008:tarifas", "2000090000000011:liquido"]);
  eq(res.rows[0].status, "atrasada", "pior primeiro");
});
t("casamento: várias linhas por operação (frete negativo) somam antes de comparar", function () {
  var res = run([HV + "7;03/08/2026;Venda;89,90;14,38;75,52\n7;04/08/2026;Envio;;23,86;-23,86\n"], [HL + "7;02/09/2026;Venda;75,52\n7;02/09/2026;Envio;-23,86\n"]);
  var r = byOp(res, "7");
  eq([r.status, r.esperado, r.liberado, r.diferenca], ["ok", 51.66, 51.66, 0]);
});
t("casamento: cancelamento que anula a venda vira zerada, sem tarifa no total", function () {
  var res = run([HV + "3;05/08/2026;Venda;59,90;9,58;50,32\n3;07/08/2026;Cancelamento;-59,90;9,58;-50,32\n"], [HL]);
  eq(byOp(res, "3").status, "zerada");
  eq(res.resumo.tarifas, 0);
});
t("casamento: atrasada × aguardando respeita dias e data de referência", function () {
  var v = HV + "4;06/08/2026;Venda;199;31,84;167,16\n";
  eq(byOp(run([v], [HL], { refDate: "2026-09-30" }), "4").status, "atrasada");
  eq(byOp(run([v], [HL], { refDate: "2026-09-30", lateDays: 60 }), "4").status, "aguardando");
  eq(byOp(run([v], [HL], { refDate: "2026-09-15" }), "4").status, "aguardando");
  eq(byOp(run([v], [HL], { refDate: "2026-09-15" }), "4").idade, 40);
});
t("casamento: diferença negativa (recebeu a menos) e tolerância de centavos", function () {
  var res = run([HV + "6;10/08/2026;Venda;149,90;23,98;125,92\n8;10/08/2026;Venda;10;1;9\n"], [HL + "6;08/09/2026;Venda;115,92\n8;08/09/2026;Venda;9,03\n"]);
  eq([byOp(res, "6").status, byOp(res, "6").diferenca], ["diferenca", -10]);
  eq(byOp(res, "8").status, "ok");
  eq(res.resumo.aMenos, 10);
});
t("casamento: só na liberação e cobrança sem débito", function () {
  var res = run([HV + "9;04/08/2026;Envio;;23,86;-23,86\n"], [HL + "99;05/08/2026;Venda;54,30\n"]);
  eq(byOp(res, "9").status, "cobranca");
  eq(byOp(res, "99").status, "so_liberacao");
  eq(res.resumo.soLiberacaoValor, 54.3);
});
t("casamento: linhas repetidas entre arquivos sobrepostos são ignoradas; no mesmo arquivo, não", function () {
  var l1 = HL + "1;30/08/2026;Venda;50\n";
  var l2 = HL + "1;30/08/2026;Venda;50\n2;01/09/2026;Venda;10\n2;01/09/2026;Venda;10\n";
  var res = run([HV + "1;01/08/2026;Venda;60;10;50\n2;01/08/2026;Venda;24;4;20\n"], [l1, l2]);
  eq(byOp(res, "1").status, "ok");
  eq(byOp(res, "2").liberado, 20);
  ok(res.avisos.some(function (a) { return /1 linha\(s\) repetida/.test(a); }));
});
t("casamento: número em notação científica (Excel) é ignorado e avisado", function () {
  var res = run([HV + "2,00001E+15;01/08/2026;Venda;60;10;50\n"], [HL]);
  eq(res.rows.length, 0);
  ok(res.avisos.some(function (a) { return /sem Número da operação/.test(a); }));
});
t("casamento: aviso quando a liberação não cobre o prazo", function () {
  var res = run([HV + "1;01/09/2026;Venda;60;10;50\n"], [HL + "1;10/09/2026;Venda;50\n"]);
  ok(res.avisos.some(function (a) { return /liberação do mês seguinte/.test(a); }));
});
t("export: CSV com BOM, ; e vírgula decimal", function () {
  var res = run([HV + "6;10/08/2026;Venda;149,90;23,98;125,92\n"], [HL + "6;08/09/2026;Venda;115,92\n"]);
  var csv = C.toCSV(res);
  ok(csv.charCodeAt(0) === 0xfeff);
  var lines = csv.slice(1).split("\r\n");
  eq(lines[0].split(";")[0], "Número da operação");
  eq(lines[1].split(";").slice(0, 7), ["6", "Liberado com diferença", "10/08/2026", "08/09/2026", "125,92", "115,92", "-10,00"]);
});

// ---------- XLSX e codificação ----------
t("xlsx: exemplo .xlsx (números, datas e texto) bate com o CSV", function () {
  var wb = XLSX.read(fs.readFileSync(path.join(ROOT, "exemplos/conferidor-ml-exemplo-por-venda.xlsx")), { type: "buffer", cellDates: true });
  var S = C.analyzeSales([C.buildTable(C.sheetRows(XLSX, wb), "venda")]);
  eq(S.order.length, 12);
  eq(S.ops["2000090000000002"].esperado, 51.66);
  eq(S.ops["2000090000000002"].dataVenda, "2026-08-03");
});
t("xlsx: escolhe a aba com cabeçalho e lê número da operação numérico", function () {
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Resumo"], ["Total", 10]]), "Resumo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Número da operação", "Data da liberação", "Valor líquido"], [2000090000000001, "30/08/2026", 109.12]]), "Dados");
  var wb2 = XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { type: "array", cellDates: true });
  var R = C.analyzeReleases([C.buildTable(C.sheetRows(XLSX, wb2), "liberacao")]);
  eq(R.ops["2000090000000001"].liberado, 109.12);
});
t("codificação: UTF-8 e Windows-1252", function () {
  eq(C.decodeText(Buffer.from("Número", "utf8")), "Número");
  eq(C.decodeText(Buffer.from([0x4e, 0xfa, 0x6d, 0x65, 0x72, 0x6f])), "Número");
  ok(C.isXlsxName("a.XLSX") && !C.isXlsxName("a.csv"));
});

var fail = results.filter(function (r) { return !r.ok; });
fail.forEach(function (f) { console.log("FALHA: " + f.name + " — " + f.err); });
console.log("Conferidor: " + results.length + " testes, falhas=" + fail.length);
process.exit(fail.length ? 1 : 0);
