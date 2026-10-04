// Guias SEO (blog/*): canonical, link para a ferramenta com ?ref= único, sitemap e link de volta na ferramenta.
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..');
var BASE = 'https://mellow-quarry-n7jk.here.now/';
var G = [
  ['blog/como-conferir-repasse-mercado-livre.html', 'conferidor-repasse-ml.html'],
  ['blog/tarifa-mercado-livre-como-conferir.html', 'auditor-tarifas-ml.html'],
  ['blog/saque-mercado-pago-nao-caiu.html', 'extrato-x-saques-mp.html'],
  ['blog/custo-estoque-antigo-full.html', 'full-aging-estoque.html']
];
var n = 0, f = 0;
function ok(c, m) { n++; if (!c) { f++; console.log('FALHA: ' + m); } }
var sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
var sml = fs.readFileSync(path.join(ROOT, 'sitemap-live.xml'), 'utf8');
var allRefs = {};
G.forEach(function (g) {
  var p = path.join(ROOT, g[0]);
  ok(fs.existsSync(p), g[0] + ' existe');
  if (!fs.existsSync(p)) return;
  var s = fs.readFileSync(p, 'utf8');
  ok(s.indexOf('<link rel="canonical" href="' + BASE + g[0] + '">') >= 0, g[0] + ' canonical');
  ok(/<title>[^<]{20,}<\/title>/.test(s), g[0] + ' title');
  ok(/<meta name="description" content="[^"]{60,}">/.test(s), g[0] + ' description');
  var art = s.slice(s.indexOf('<article'), s.indexOf('</article>'));
  ok(art.indexOf('href="../' + g[1] + '?ref=') >= 0, g[0] + ' linka a ferramenta com ?ref=');
  ok(/vendedores\.mercadolivre\.com\.br|mercadopago\.com\.br/.test(art), g[0] + ' cita página oficial');
  // todo link interno do artigo carrega ?ref= único
  var re = /href="(?!https?:)([^"]+)"/g, m;
  while ((m = re.exec(art))) {
    var ref = (m[1].match(/[?&]ref=([^&#"]+)/) || [])[1];
    ok(!!ref, g[0] + ' link interno sem ?ref=: ' + m[1]);
    if (ref) { ok(!allRefs[ref], 'ref repetido: ' + ref); allRefs[ref] = 1; }
  }
  ok(sm.indexOf('<loc>' + BASE + g[0] + '</loc>') >= 0, g[0] + ' no sitemap.xml');
  ok(sml.indexOf('<loc>' + BASE + g[0] + '</loc>') >= 0, g[0] + ' no sitemap-live.xml');
  var tool = fs.readFileSync(path.join(ROOT, g[1]), 'utf8');
  ok(tool.indexOf('href="' + g[0] + '?ref=tool-') >= 0, g[1] + ' linka de volta para o guia');
});
console.log('Guias SEO: ' + n + ' testes, falhas=' + f);
process.exit(f ? 1 : 0);
