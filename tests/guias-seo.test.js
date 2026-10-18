// Guias SEO (blog/*): canonical, link para a ferramenta com ?ref= único, sitemap e link de volta na ferramenta.
var fs = require('fs'), path = require('path');
var ROOT = path.join(__dirname, '..');
var BASE = 'https://mellow-quarry-n7jk.here.now/';
var G = [
  ['blog/como-conferir-repasse-mercado-livre.html', null], // conferidor tirado do ar no kill check de 2026-10-15
  ['blog/tarifa-mercado-livre-como-conferir.html', null], // auditor tirado do ar no kill check de 2026-10-17
  ['blog/saque-mercado-pago-nao-caiu.html', null], // extrato tirado do ar no kill check de 2026-10-16
  ['blog/custo-estoque-antigo-full.html', null] // full-aging tirado do ar no kill check de 2026-10-18
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
  if (g[1]) ok(art.indexOf('href="../' + g[1] + '?ref=') >= 0, g[0] + ' linka a ferramenta com ?ref=');
  ok(art.indexOf('conferidor-repasse-ml') < 0, g[0] + ' não linka conferidor tirado do ar');
  ok(art.indexOf('extrato-x-saques-mp') < 0, g[0] + ' não linka extrato tirado do ar');
  ok(art.indexOf('auditor-tarifas-ml') < 0, g[0] + ' não linka auditor tirado do ar');
  ok(art.indexOf('full-aging-estoque') < 0, g[0] + ' não linka full-aging tirado do ar');
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
  if (!g[1]) return;
  var tool = fs.readFileSync(path.join(ROOT, g[1]), 'utf8');
  ok(tool.indexOf('href="' + g[0] + '?ref=tool-') >= 0, g[1] + ' linka de volta para o guia');
});
// Ferramentas de arquivo tiradas do ar (kill checks 15–18/10/2026): nada delas fica no site nem no sitemap.
var KILLED = ['conferidor-repasse-ml', 'extrato-x-saques-mp', 'auditor-tarifas-ml', 'full-aging-estoque'];
KILLED.forEach(function (k) {
  ok(!fs.existsSync(path.join(ROOT, k + '.html')), k + '.html removido');
  ok(sm.indexOf(k) < 0 && sml.indexOf(k) < 0, k + ' fora dos sitemaps');
  ['index.html', 'custo-full.html', 'blog/index.html'].forEach(function (pg) {
    ok(fs.readFileSync(path.join(ROOT, pg), 'utf8').indexOf(k) < 0, pg + ' não linka ' + k);
  });
});
ok(!fs.existsSync(path.join(ROOT, 'js/vendor')), 'js/vendor (SheetJS) removido: nenhuma página usa');
ok(!fs.existsSync(path.join(ROOT, 'js/activation.js')), 'js/activation.js removido: nenhuma ferramenta usa');
ok(!fs.existsSync(path.join(ROOT, 'a')), 'pasta a/ (beacons) removida');
var robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
ok(/Sitemap:\s*https:\/\/mellow-quarry-n7jk\.here\.now\/sitemap\.xml/.test(robots), 'robots aponta o sitemap');
ok(sm.indexOf('<loc>' + BASE + '</loc>') >= 0, 'home no sitemap');
console.log('Guias SEO: ' + n + ' testes, falhas=' + f);
process.exit(f ? 1 : 0);
