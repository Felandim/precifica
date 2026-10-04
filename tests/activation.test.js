// Activation signals are same-site page requests with no query/data payload.
"use strict";
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
var tools = [
  ["conferidor-repasse-ml", "conferidor-repasse-ui.js"],
  ["extrato-x-saques-mp", "extrato-saques-mp-ui.js"],
  ["auditor-tarifas-ml", "auditor-tarifas-ml-ui.js"],
  ["full-aging-estoque", "full-aging-estoque-ui.js"]
];
var results = [];
function t(name, fn) { try { fn(); results.push({ name: name, ok: true }); } catch (e) { results.push({ name: name, ok: false, err: e.message }); } }
function ok(v, msg) { if (!v) throw new Error(msg || "falso"); }
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }

t("helper usa iframe same-site sem query", function () {
  var s = read("js/activation.js");
  ok(/createElement\("iframe"\)/.test(s));
  ok(/"a\/" \+ tool \+ "-" \+ kind \+ "\.html"/.test(s));
  ok(!/fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//.test(s));
});

tools.forEach(function (pair) {
  var tool = pair[0], ui = read("js/" + pair[1]);
  t(tool + ": helper carregado e ambos os sinais", function () {
    ok(ui.indexOf("precificaActivation") >= 0, "helper não usado");
    ok(ui.indexOf('"' + tool + '", "exemplo"') >= 0, "sinal exemplo ausente");
    ok(ui.indexOf('"' + tool + '", "arquivo"') >= 0, "sinal arquivo ausente");
  });
  ["exemplo", "arquivo"].forEach(function (kind) {
    t(tool + "-" + kind + ": página noindex e sem sitemap", function () {
      var p = "a/" + tool + "-" + kind + ".html";
      var s = read(p);
      ok(/name="robots"[^>]+noindex/.test(s), "noindex ausente");
      var sm = read("sitemap.xml");
      ok(sm.indexOf("/" + p) < 0, "ativação entrou no sitemap");
    });
  });
});

t("robots e sitemap apontam o conjunto de divulgação", function () {
  var sm = read("sitemap.xml"), robots = read("robots.txt");
  var urls = ["/", "/blog/como-conferir-repasse-mercado-livre.html", "/blog/tarifa-mercado-livre-como-conferir.html", "/blog/saque-mercado-pago-nao-caiu.html", "/blog/custo-estoque-antigo-full.html", "/conferidor-repasse-ml.html", "/extrato-x-saques-mp.html", "/auditor-tarifas-ml.html", "/full-aging-estoque.html"];
  urls.forEach(function (u) { ok(sm.indexOf("<loc>https://mellow-quarry-n7jk.here.now" + u + "</loc>") >= 0, "sitemap sem " + u); });
  ok(/Sitemap:\s*https:\/\/mellow-quarry-n7jk\.here\.now\/sitemap\.xml/.test(robots), "robots sem sitemap");
});

var fail = results.filter(function (r) { return !r.ok; });
fail.forEach(function (f) { console.log("FALHA: " + f.name + " — " + f.err); });
console.log("Ativação: " + results.length + " testes, falhas=" + fail.length);
process.exit(fail.length ? 1 : 0);
