/*!
 * Precifica — Conferidor de repasse do Mercado Livre (100% no navegador).
 * Cruza o relatório de Conciliação "Por venda" com o "Por liberação de dinheiro"
 * (ou com o "Relatório de liberações" do Mercado Pago) pelo Número da operação.
 * Nenhum arquivo sai do aparelho: leitura via FileReader, sem fetch/XHR de dados.
 *
 * Nomes de colunas reconhecidos vêm de fontes oficiais:
 *  - ML: https://vendedores.mercadolivre.com.br/aprender/nota/como-conciliar-usando-os-relatorios-de-venda-e-liberacao-de-dinheiro
 *  - MP: https://www.mercadopago.com.br/developers/pt/docs/prestashop/additional-content/reports/released-money/report-use
 * Se o arquivo usar outro nome, o usuário escolhe a coluna manualmente (mapeamento).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConferidorRepasse = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- normalização ----------
  function normHeader(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // Campos e sinônimos em ordem de prioridade (match exato primeiro, depois "começa com").
  var FIELDS = {
    op: { label: "Número da operação", syn: ["numero da operacao", "n da operacao", "numero de operacao", "order id", "id do pedido", "external reference", "numero da venda", "n de venda", "source id", "id da operacao no mercado pago"] },
    tipo: { label: "Tipo de operação", syn: ["tipo de operacao", "description", "descricao"] },
    recordType: { label: "Tipo de registro (MP)", syn: ["record type", "tipo de registro"] },
    dataVenda: { label: "Data da venda", syn: ["data da venda", "data da operacao", "transaction date", "data de criacao da operacao", "transaction approval date", "data de aprovacao"] },
    dataLib: { label: "Data da liberação", syn: ["data da liberacao", "date", "data de liberacao", "date short", "data de liberacao curta"] },
    liquido: { label: "Valor líquido (após tarifas)", syn: ["valor liquido apos tarifas", "valor liquido"] },
    credito: { label: "Valor líquido creditado (MP)", syn: ["net credit amount", "valor liquido creditado"] },
    debito: { label: "Valor líquido debitado (MP)", syn: ["net debit amount", "valor liquido debitado"] },
    bruto: { label: "Valor bruto", syn: ["valor bruto", "gross amount", "valor bruto da operacao"] },
    tarifas: { label: "Valor total de tarifas", syn: ["valor total de tarifas", "total de tarifas"] },
    detTarifas: { label: "Detalhes de tarifas", syn: ["detalhes de tarifas", "detalhe de tarifas", "detalhamento de tarifas"] },
    valorItem: { label: "Valor do item", syn: ["valor do item"] },
    rebate: { label: "Desconto do Mercado Livre | Rebate", syn: ["desconto do mercado livre rebate", "desconto do mercado livre"] },
    descVendedor: { label: "Desconto do vendedor para comprador", syn: ["desconto do vendedor para comprador", "desconto do vendedor"] },
    envioComprador: { label: "Envio pago pelo comprador", syn: ["envio pago pelo comprador"] },
    parcComprador: { label: "Taxa de parcelamento paga pelo comprador", syn: ["taxa de parcelamento paga pelo comprador"] },
    anuncio: { label: "Anúncio / título (opcional)", syn: ["titulo do anuncio", "titulo", "anuncio", "item id", "codigo do produto"] }
  };
  var SALES_FIELDS = ["op", "tipo", "dataVenda", "liquido", "bruto", "tarifas", "detTarifas", "valorItem", "rebate", "descVendedor", "envioComprador", "parcComprador", "anuncio"];
  var RELEASE_FIELDS = ["op", "tipo", "recordType", "dataLib", "liquido", "credito", "debito"];

  function mapHeaders(headers, wanted) {
    var norm = headers.map(normHeader);
    var used = {};
    var map = {};
    (wanted || Object.keys(FIELDS)).forEach(function (f) {
      var syn = FIELDS[f].syn;
      var idx = -1;
      for (var s = 0; s < syn.length && idx < 0; s++) {
        for (var i = 0; i < norm.length; i++) if (!used[i] && norm[i] === syn[s]) { idx = i; break; }
      }
      for (var s2 = 0; s2 < syn.length && idx < 0; s2++) {
        for (var j = 0; j < norm.length; j++) {
          // "(=) Valor bruto" vira "valor bruto"; "Data da liberação (DATE)" vira "data da liberacao date"
          if (!used[j] && norm[j] && (norm[j].indexOf(syn[s2] + " ") === 0)) { idx = j; break; }
        }
      }
      if (idx >= 0) { map[f] = idx; used[idx] = true; }
    });
    return map;
  }

  // ---------- CSV ----------
  function detectDelimiter(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; }).slice(0, 15);
    var cands = [";", ",", "\t", "|"];
    var best = ",", bestScore = -1;
    cands.forEach(function (d) {
      var counts = lines.map(function (l) {
        var n = 0, q = false;
        for (var i = 0; i < l.length; i++) {
          var c = l[i];
          if (c === '"') q = !q;
          else if (c === d && !q) n++;
        }
        return n;
      });
      var max = Math.max.apply(null, counts.concat([0]));
      // linhas com o mesmo nº de separadores pesam mais
      var same = counts.filter(function (n) { return n === max && n > 0; }).length;
      var score = max * 2 + same;
      if (score > bestScore) { bestScore = score; best = d; }
    });
    return best;
  }

  function parseCSV(text, delim) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var d = delim || detectDelimiter(text);
    var rows = [], row = [], field = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
        } else field += c;
      } else if (c === '"') {
        q = true;
      } else if (c === d) {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        rows.push(row); row = [];
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ""; }); });
  }

  // ---------- números e datas ----------
  function parseNumber(v) {
    if (v == null) return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    var s = String(v).trim();
    if (!s) return null;
    s = s.replace(/[\u2212\u2013\u2014]/g, "-").replace(/R\$/gi, "").replace(/[\s\u00a0]/g, "");
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = !neg; s = s.slice(0, -1); }
    if (/^[+-]/.test(s)) { if (s[0] === "-") neg = !neg; s = s.slice(1); }
    if (!/^[\d.,]+$/.test(s)) return null;
    var lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
    if (lastDot >= 0 && lastComma >= 0) {
      if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (lastComma >= 0) {
      if (/^\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, "");
      else s = s.replace(/,/g, ".");
      if ((s.match(/\./g) || []).length > 1) return null;
    } else if (lastDot >= 0) {
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // 3.299 = 3299 (padrão BR)
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  var MESES = { jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12 };
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(y, m, d) {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return y + "-" + pad(m) + "-" + pad(d);
  }
  function parseDate(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date && !isNaN(v)) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === "number") {
      if (v > 20000 && v < 80000) { // serial do Excel
        var ms = Math.round((v - 25569) * 86400000);
        var d0 = new Date(ms);
        return iso(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate());
      }
      return null;
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) return iso(+m[3], +m[2], +m[1]);
    var n = normHeader(s);
    m = n.match(/^(\d{1,2}) (?:de )?([a-z]+) (?:de )?(\d{4})/);
    if (m && MESES[m[2]]) return iso(+m[3], MESES[m[2]], +m[1]);
    return null;
  }
  function dayNum(isoDate) {
    if (!isoDate) return null;
    var p = isoDate.split("-");
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function daysBetween(a, b) { return dayNum(b) - dayNum(a); }

  // "Detalhes de tarifas": formato da célula não é documentado. Tentamos JSON e o padrão
  // "... líquido R$ x" (como no exemplo oficial). Se não der, devolve null e a checagem é pulada.
  function parseFeeDetails(cell) {
    if (cell == null) return null;
    var s = String(cell).trim();
    if (!s) return null;
    if (/^[\[{]/.test(s)) {
      try {
        var j = JSON.parse(s);
        var arr = Array.isArray(j) ? j : [j];
        var sum = 0, found = false;
        arr.forEach(function (o) {
          if (!o || typeof o !== "object") return;
          var keys = Object.keys(o);
          var k = keys.filter(function (x) { return /liquid|net/.test(normHeader(x)); })[0];
          if (k == null) k = keys.filter(function (x) { return /amount|valor/.test(normHeader(x)); })[0];
          var val = k != null ? parseNumber(o[k]) : null;
          if (val != null) { sum += Math.abs(val); found = true; }
        });
        return found ? round2(sum) : null;
      } catch (e) { /* segue para regex */ }
    }
    var re = /l[ií]quido\s*:?\s*(-?\s*(?:R\$)?\s*[\d.,]+)/gi, mm, total = 0, any = false;
    while ((mm = re.exec(s))) {
      var val2 = parseNumber(mm[1].replace(/[.,]$/, ""));
      if (val2 != null) { total += Math.abs(val2); any = true; }
    }
    return any ? round2(total) : null;
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // ---------- tabela ----------
  var KEY_SYNS = [];
  Object.keys(FIELDS).forEach(function (f) { KEY_SYNS = KEY_SYNS.concat(FIELDS[f].syn); });

  function headerScore(row) {
    var n = row.map(normHeader);
    var score = 0, hasOp = false;
    n.forEach(function (h) {
      if (!h) return;
      if (KEY_SYNS.indexOf(h) >= 0 || KEY_SYNS.some(function (s) { return h.indexOf(s + " ") === 0; })) score++;
      if (FIELDS.op.syn.some(function (s) { return h === s || h.indexOf(s + " ") === 0; })) hasOp = true;
    });
    return { score: score, hasOp: hasOp };
  }

  function detectHeaderRow(rows) {
    var best = -1, bestScore = 0;
    for (var i = 0; i < Math.min(rows.length, 40); i++) {
      var hs = headerScore(rows[i]);
      if (hs.hasOp && hs.score >= 2 && hs.score > bestScore) { best = i; bestScore = hs.score; }
    }
    return best;
  }

  // rows: array de arrays. kind: "venda" | "liberacao". forcedMap: {campo: índice} opcional.
  function buildTable(rows, kind, forcedMap) {
    var hIdx = detectHeaderRow(rows);
    if (hIdx < 0) {
      return { ok: false, error: "Não achei a linha de cabeçalho com a coluna \"Número da operação\" (ou ORDER_ID / EXTERNAL_REFERENCE no relatório do Mercado Pago).", headers: rows[0] || [], rows: rows };
    }
    var headers = rows[hIdx].map(function (h) { return String(h == null ? "" : h).trim(); });
    var wanted = kind === "liberacao" ? RELEASE_FIELDS : SALES_FIELDS;
    var map = mapHeaders(headers, wanted);
    if (forcedMap) Object.keys(forcedMap).forEach(function (k) {
      if (forcedMap[k] == null || forcedMap[k] === "") return;
      if (+forcedMap[k] < 0) delete map[k]; else map[k] = +forcedMap[k]; // -1 = "não usar"
    });
    // Outras colunas de identificação (ex.: ORDER_ID vazio, EXTERNAL_REFERENCE preenchido) servem de reserva por linha.
    var normH = headers.map(normHeader);
    map.opAlt = [];
    FIELDS.op.syn.forEach(function (sy) {
      normH.forEach(function (h, i) {
        if (i !== map.op && map.opAlt.indexOf(i) < 0 && (h === sy || h.indexOf(sy + " ") === 0)) map.opAlt.push(i);
      });
    });
    var data = rows.slice(hIdx + 1).filter(function (r) {
      return r.some(function (v) { return String(v == null ? "" : v).trim() !== ""; });
    });
    var missing = [];
    if (map.op == null) missing.push(FIELDS.op.label);
    if (kind === "liberacao") {
      if (map.liquido == null && map.credito == null) missing.push(FIELDS.liquido.label);
    } else {
      if (map.liquido == null) missing.push(FIELDS.liquido.label);
      if (map.dataVenda == null) missing.push(FIELDS.dataVenda.label);
    }
    return { ok: missing.length === 0, error: missing.length ? "Faltam colunas: " + missing.join(", ") + ". Escolha manualmente abaixo." : null, missing: missing, headerRow: hIdx, headers: headers, map: map, data: data, kind: kind };
  }

  function cell(r, idx) { return idx == null ? null : r[idx]; }
  function rowKey(r, m) {
    var k = opKey(cell(r, m.op));
    for (var i = 0; !k && m.opAlt && i < m.opAlt.length; i++) k = opKey(r[m.opAlt[i]]);
    return k;
  }
  function opKey(v) {
    if (v == null) return "";
    if (typeof v === "number") return String(Math.round(v));
    var s = String(v).trim().replace(/^'+/, "");
    if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, "");
    if (/^\d+([.,]\d+)?e\+?\d+$/i.test(s)) return ""; // notação científica: número já perdeu dígitos
    return s;
  }

  // Remove linhas idênticas vindas de arquivos diferentes (exports com período sobreposto).
  function mergeTables(tables) {
    var seen = {}, out = [], dups = 0;
    tables.forEach(function (t, ti) {
      t.data.forEach(function (r) {
        var sig = JSON.stringify(t.headers.map(function (h, i) { return [normHeader(h), String(r[i] == null ? "" : r[i])]; }));
        if (seen[sig] != null && seen[sig] !== ti) { dups++; return; }
        seen[sig] = ti;
        out.push({ t: t, r: r });
      });
    });
    return { rows: out, duplicates: dups };
  }

  // ---------- análise ----------
  var TOL = 0.05;

  function analyzeSales(tables) {
    var merged = mergeTables(tables);
    var ops = {}, order = [], checks = [], badKeys = 0, lines = 0;
    merged.rows.forEach(function (x) {
      var m = x.t.map, r = x.r;
      var key = rowKey(r, m);
      if (!key) { badKeys++; return; }
      lines++;
      var liq = parseNumber(cell(r, m.liquido));
      var date = parseDate(cell(r, m.dataVenda));
      var o = ops[key];
      if (!o) {
        o = ops[key] = { op: key, linhas: 0, esperado: 0, bruto: 0, tarifas: 0, dataVenda: null, tipos: [], anuncio: "" };
        order.push(key);
      }
      o.linhas++;
      if (liq != null) o.esperado += liq;
      var bruto = parseNumber(cell(r, m.bruto));
      var tar = parseNumber(cell(r, m.tarifas));
      if (bruto != null && bruto > 0) o.bruto += bruto;
      if (tar != null && !(bruto != null && bruto < 0)) o.tarifas += Math.abs(tar); // linha de cancelamento não soma tarifa
      if (date && (!o.dataVenda || date < o.dataVenda)) o.dataVenda = date;
      var tipo = cell(r, m.tipo);
      if (tipo != null && String(tipo).trim() && o.tipos.indexOf(String(tipo).trim()) < 0) o.tipos.push(String(tipo).trim());
      var an = cell(r, m.anuncio);
      if (an != null && String(an).trim() && !o.anuncio) o.anuncio = String(an).trim();

      // Conta do bruto (só na linha que traz "Valor do item")
      var item = parseNumber(cell(r, m.valorItem));
      if (item != null && item !== 0 && bruto != null) {
        var calc = item - Math.abs(parseNumber(cell(r, m.rebate)) || 0) - Math.abs(parseNumber(cell(r, m.descVendedor)) || 0)
          + Math.abs(parseNumber(cell(r, m.envioComprador)) || 0) + Math.abs(parseNumber(cell(r, m.parcComprador)) || 0);
        if (Math.abs(round2(calc) - bruto) > 0.02) checks.push({ op: key, tipo: "bruto", msg: "Valor do item − descontos + envio/parcelamento do comprador = " + fmt(calc) + ", mas o relatório diz Valor bruto " + fmt(bruto) + ".", diff: round2(bruto - calc) });
      }
      // Conta do líquido: bruto − tarifas = líquido
      if (bruto != null && tar != null && liq != null && bruto > 0) {
        var calcLiq = bruto - Math.abs(tar);
        if (Math.abs(round2(calcLiq) - liq) > 0.02) checks.push({ op: key, tipo: "liquido", msg: "Valor bruto − tarifas = " + fmt(calcLiq) + ", mas o relatório diz líquido " + fmt(liq) + ".", diff: round2(liq - calcLiq) });
      }
      // Detalhes de tarifas = Valor total de tarifas
      if (m.detTarifas != null && tar != null) {
        var det = parseFeeDetails(cell(r, m.detTarifas));
        if (det != null && Math.abs(det - Math.abs(tar)) > 0.02) checks.push({ op: key, tipo: "tarifas", msg: "Soma dos líquidos em Detalhes de tarifas = " + fmt(det) + ", mas Valor total de tarifas = " + fmt(Math.abs(tar)) + ".", diff: round2(Math.abs(tar) - det) });
      }
    });
    order.forEach(function (k) { var o = ops[k]; o.esperado = round2(o.esperado); o.bruto = round2(o.bruto); o.tarifas = round2(o.tarifas); });
    return { ops: ops, order: order, checks: checks, linhas: lines, semNumero: badKeys, duplicadas: merged.duplicates };
  }

  function analyzeReleases(tables) {
    var merged = mergeTables(tables);
    var ops = {}, order = [], badKeys = 0, skipped = 0, lines = 0, minD = null, maxD = null;
    merged.rows.forEach(function (x) {
      var m = x.t.map, r = x.r;
      var rt = cell(r, m.recordType);
      if (m.recordType != null && rt != null && String(rt).trim() && normHeader(rt) !== "release") { skipped++; return; } // saldo inicial, total, saques
      var key = rowKey(r, m);
      if (!key) { badKeys++; return; }
      var val = null;
      if (m.liquido != null) val = parseNumber(cell(r, m.liquido));
      if (val == null && m.credito != null) val = (parseNumber(cell(r, m.credito)) || 0) - Math.abs(parseNumber(cell(r, m.debito)) || 0);
      if (val == null) val = 0;
      lines++;
      var d = parseDate(cell(r, m.dataLib));
      if (d) { if (!minD || d < minD) minD = d; if (!maxD || d > maxD) maxD = d; }
      var o = ops[key];
      if (!o) { o = ops[key] = { op: key, linhas: 0, liberado: 0, dataLib: null, tipos: [] }; order.push(key); }
      o.linhas++;
      o.liberado += val;
      if (d && (!o.dataLib || d > o.dataLib)) o.dataLib = d;
      var tipo = cell(r, m.tipo);
      if (tipo != null && String(tipo).trim() && o.tipos.indexOf(String(tipo).trim()) < 0) o.tipos.push(String(tipo).trim());
    });
    order.forEach(function (k) { ops[k].liberado = round2(ops[k].liberado); });
    return { ops: ops, order: order, linhas: lines, semNumero: badKeys, ignoradas: skipped, duplicadas: merged.duplicates, minData: minD, maxData: maxD };
  }

  var STATUS = {
    atrasada: { label: "Sem liberação (atrasada)", rank: 0 },
    diferenca: { label: "Liberado com diferença", rank: 1 },
    cobranca: { label: "Cobrança sem débito na liberação", rank: 2 },
    aguardando: { label: "Aguardando liberação", rank: 3 },
    so_liberacao: { label: "Só na liberação (venda de outro período)", rank: 4 },
    zerada: { label: "Cancelada / zerada", rank: 5 },
    ok: { label: "Bate", rank: 6 }
  };

  function reconcile(sales, releases, opts) {
    opts = opts || {};
    var lateDays = opts.lateDays != null ? +opts.lateDays : 40;
    var tol = opts.tol != null ? +opts.tol : TOL;
    var refDate = opts.refDate || null;
    if (!refDate) {
      var all = [];
      if (releases.maxData) all.push(releases.maxData);
      sales.order.forEach(function (k) { if (sales.ops[k].dataVenda) all.push(sales.ops[k].dataVenda); });
      refDate = all.sort().pop() || null;
    }
    var rows = [];
    var sum = { esperado: 0, liberadoCasado: 0, atrasadoValor: 0, atrasadas: 0, aguardandoValor: 0, aguardando: 0, diferencaValor: 0, diferencas: 0, aMenos: 0, zeradas: 0, ok: 0, cobrancas: 0, cobrancaValor: 0, soLiberacao: 0, soLiberacaoValor: 0, bruto: 0, tarifas: 0 };
    sales.order.forEach(function (k) {
      var s = sales.ops[k], r = releases.ops[k];
      var row = { op: k, dataVenda: s.dataVenda, dataLib: r ? r.dataLib : null, esperado: s.esperado, liberado: r ? r.liberado : null, diferenca: null, idade: null, status: "", tipos: s.tipos.concat(r ? r.tipos.filter(function (t) { return s.tipos.indexOf(t) < 0; }) : []), anuncio: s.anuncio, bruto: s.bruto, tarifas: s.tarifas };
      sum.esperado += s.esperado;
      if (r) {
        row.diferenca = round2(r.liberado - s.esperado);
        sum.liberadoCasado += r.liberado;
        if (Math.abs(row.diferenca) <= tol) { row.status = "ok"; sum.ok++; }
        else { row.status = "diferenca"; sum.diferencas++; sum.diferencaValor += row.diferenca; if (row.diferenca < 0) sum.aMenos += -row.diferenca; }
      } else if (Math.abs(s.esperado) <= tol) {
        row.status = "zerada"; sum.zeradas++;
      } else if (s.esperado < 0) {
        row.status = "cobranca"; sum.cobrancas++; sum.cobrancaValor += s.esperado;
      } else {
        row.idade = refDate && s.dataVenda ? daysBetween(s.dataVenda, refDate) : null;
        if (row.idade != null && row.idade > lateDays) { row.status = "atrasada"; sum.atrasadas++; sum.atrasadoValor += s.esperado; }
        else { row.status = "aguardando"; sum.aguardando++; sum.aguardandoValor += s.esperado; }
      }
      if (row.status !== "zerada") { sum.bruto += s.bruto; sum.tarifas += s.tarifas; }
      rows.push(row);
    });
    releases.order.forEach(function (k) {
      if (sales.ops[k]) return;
      var r = releases.ops[k];
      sum.soLiberacao++; sum.soLiberacaoValor += r.liberado;
      rows.push({ op: k, dataVenda: null, dataLib: r.dataLib, esperado: null, liberado: r.liberado, diferenca: null, idade: null, status: "so_liberacao", tipos: r.tipos.slice(), anuncio: "", bruto: 0, tarifas: 0 });
    });
    Object.keys(sum).forEach(function (k) { sum[k] = round2(sum[k]); });
    sum.tarifaPctBruto = sum.bruto > 0 ? round2((sum.tarifas / sum.bruto) * 100) : null;
    sum.vendas = sales.order.length;
    sum.operacoes = rows.length;
    rows.sort(function (a, b) {
      var d = STATUS[a.status].rank - STATUS[b.status].rank;
      if (d) return d;
      return (a.dataVenda || a.dataLib || "").localeCompare(b.dataVenda || b.dataLib || "");
    });
    var avisos = [];
    if (releases.minData && sales.order.length) {
      var minVenda = sales.order.map(function (k) { return sales.ops[k].dataVenda; }).filter(Boolean).sort()[0];
      if (minVenda && releases.maxData && daysBetween(minVenda, releases.maxData) < lateDays) avisos.push("O arquivo de liberações termina em " + br(releases.maxData) + ", menos de " + lateDays + " dias depois da primeira venda. Muitas vendas ainda podem estar só aguardando: gere também a liberação do mês seguinte.");
    }
    if (sales.duplicadas || releases.duplicadas) avisos.push((sales.duplicadas + releases.duplicadas) + " linha(s) repetida(s) entre arquivos com período sobreposto foram ignoradas.");
    if (sales.semNumero || releases.semNumero) avisos.push((sales.semNumero + releases.semNumero) + " linha(s) sem Número da operação foram ignoradas.");
    if (releases.ignoradas) avisos.push(releases.ignoradas + " linha(s) de saldo/saque/total do relatório do Mercado Pago foram ignoradas (só entram linhas \"release\").");
    return { refDate: refDate, lateDays: lateDays, rows: rows, resumo: sum, checks: sales.checks, avisos: avisos };
  }

  // ---------- formatação / export ----------
  function fmt(n) {
    if (n == null || !isFinite(n)) return "—";
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).split(".");
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "−" : "") + "R$ " + s[0] + "," + s[1];
  }
  function br(isoDate) { if (!isoDate) return "—"; var p = isoDate.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }

  function toCSV(result) {
    var head = ["Número da operação", "Situação", "Data da venda", "Data da liberação", "Líquido esperado (Por venda)", "Liberado", "Diferença", "Dias sem liberação", "Tipos de operação", "Anúncio"];
    var esc = function (v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var num = function (n) { return n == null ? "" : String(n.toFixed(2)).replace(".", ","); };
    var lines = [head.join(";")];
    result.rows.forEach(function (r) {
      lines.push([r.op, STATUS[r.status].label, br(r.dataVenda), br(r.dataLib), num(r.esperado), num(r.liberado), num(r.diferenca), r.idade == null ? "" : r.idade, r.tipos.join(" | "), r.anuncio].map(esc).join(";"));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  // ---------- leitura de arquivos (navegador) ----------
  function sheetRows(XLSX, wb) {
    var best = null, bestScore = -1;
    wb.SheetNames.forEach(function (name) {
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
      var h = detectHeaderRow(rows);
      var sc = h >= 0 ? headerScore(rows[h]).score : 0;
      if (sc > bestScore) { bestScore = sc; best = rows; }
    });
    return best || [];
  }

  function decodeText(buf) {
    var bytes = new Uint8Array(buf);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (e) { return new TextDecoder("windows-1252").decode(bytes); }
  }

  function isXlsxName(name) { return /\.(xlsx|xlsm|xls|ods)$/i.test(name || ""); }

  return {
    FIELDS: FIELDS, SALES_FIELDS: SALES_FIELDS, RELEASE_FIELDS: RELEASE_FIELDS, STATUS: STATUS,
    normHeader: normHeader, mapHeaders: mapHeaders, detectDelimiter: detectDelimiter, parseCSV: parseCSV,
    parseNumber: parseNumber, parseDate: parseDate, daysBetween: daysBetween, parseFeeDetails: parseFeeDetails,
    detectHeaderRow: detectHeaderRow, buildTable: buildTable, analyzeSales: analyzeSales, analyzeReleases: analyzeReleases,
    reconcile: reconcile, toCSV: toCSV, fmt: fmt, br: br, sheetRows: sheetRows, decodeText: decodeText, isXlsxName: isXlsxName, opKey: opKey
  };
});
