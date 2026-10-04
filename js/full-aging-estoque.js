/*!
 * Precifica — Aging de estoque Full (100% no navegador).
 * Lê Excel/CSV do Full (Controle de estoque / Relatório geral / consolidado),
 * classifica aging, estima custo de armazenamento diário (tabela editável)
 * e marca SKUs perto do custo por estoque antigo.
 *
 * Fontes oficiais (não inventamos cobranças — só estimamos com diárias editáveis):
 *  - https://vendedores.mercadolivre.com.br/aprender/nota/como-gerenciar-seu-estoque-full-com-os-relatorios-de-excel
 *  - https://vendedores.mercadolivre.com.br/aprender/nota/quanto-custa-vender-pelo-full
 *  - https://envios.mercadolivre.com.br/mercado-envios-full
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FullAgingEstoque = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function normHeader(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  var FIELDS = {
    sku: { label: "SKU / código / MLB", syn: ["sku", "codigo", "codigo do produto", "codigo mlb", "mlb", "item id", "id do item", "id do anuncio", "codigo do anuncio", "inventory id", "id de inventario", "variacao", "variation id"] },
    titulo: { label: "Título / anúncio", syn: ["titulo", "titulo do anuncio", "anuncio", "produto", "nome", "descricao do produto", "item title"] },
    unidades: { label: "Unidades no CD", syn: ["unidades", "quantidade", "estoque", "qtd", "qty", "available quantity", "quantidade disponivel", "unidades disponiveis", "unidades no full", "stock", "saldo", "ocupacao"] },
    porte: { label: "Porte / tamanho", syn: ["porte", "tamanho", "size", "tipologia", "tipo de tamanho", "categoria de tamanho", "package size", "porte do produto"] },
    diasCd: { label: "Dias no CD", syn: ["dias no cd", "dias no full", "tempo no cd", "tempo no full", "dias armazenados", "dias de estoque", "aging", "days in warehouse", "idade", "idade em dias"] },
    dataEntrada: { label: "Data de entrada no Full", syn: ["data de entrada", "data entrada", "data de ingresso", "data no cd", "primeira entrada", "inbound date", "data de recebimento"] },
    vendas30: { label: "Vendas 30 dias (opc.)", syn: ["vendas 30", "vendas 30 dias", "vendas nos ultimos 30 dias", "sales 30", "unidades vendidas 30"] },
    vendas60: { label: "Vendas 60 dias (opc.)", syn: ["vendas 60", "vendas 60 dias", "sales 60"] },
    vendas90: { label: "Vendas 90 dias (opc.)", syn: ["vendas 90", "vendas 90 dias", "sales 90"] },
    categoria: { label: "Categoria (opc. Supermercado)", syn: ["categoria", "category", "vertical", "dominio", "departamento"] }
  };
  var WANTED = ["sku", "titulo", "unidades", "porte", "diasCd", "dataEntrada", "vendas30", "vendas60", "vendas90", "categoria"];

  /** Diárias oficiais de referência (Full, página envios ML — editáveis na UI). R$/un/dia. */
  var DEFAULT_RATES = {
    pequeno: 0.007,
    medio: 0.015,
    grande: 0.050,
    extragrande: 0.107
  };

  var BUCKETS = [
    { key: "0_30", label: "0–30 dias", min: 0, max: 30 },
    { key: "31_60", label: "31–60 dias", min: 31, max: 60 },
    { key: "61_90", label: "61–90 dias", min: 61, max: 90 },
    { key: "91_120", label: "91–120 dias", min: 91, max: 120 },
    { key: "120_plus", label: "120+ dias", min: 121, max: Infinity }
  ];

  function mapHeaders(headers, wanted) {
    var norm = headers.map(normHeader);
    var used = {};
    var map = {};
    (wanted || WANTED).forEach(function (f) {
      var syn = FIELDS[f].syn;
      var idx = -1;
      for (var s = 0; s < syn.length && idx < 0; s++) {
        for (var i = 0; i < norm.length; i++) if (!used[i] && norm[i] === syn[s]) { idx = i; break; }
      }
      for (var s2 = 0; s2 < syn.length && idx < 0; s2++) {
        for (var j = 0; j < norm.length; j++) {
          if (!used[j] && norm[j] && (norm[j].indexOf(syn[s2] + " ") === 0 || norm[j].indexOf(syn[s2]) >= 0 && syn[s2].length >= 6)) {
            if (norm[j] === syn[s2] || norm[j].indexOf(syn[s2] + " ") === 0 || norm[j].slice(-syn[s2].length - 1) === " " + syn[s2]) { idx = j; break; }
          }
        }
      }
      if (idx >= 0) { map[f] = idx; used[idx] = true; }
    });
    return map;
  }

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
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
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
      if (v > 20000 && v < 80000) {
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

  function round2(n) { return Math.round(n * 100) / 100; }
  function round4(n) { return Math.round(n * 10000) / 10000; }

  function classifyPorte(raw) {
    var t = normHeader(raw || "");
    if (!t) return "medio";
    if (/extra\s*grande|extragrande|xg|xxl|extra large|muito grande/.test(t)) return "extragrande";
    if (/^g$|grande|large|big|l\b/.test(t) || t === "grande") return "grande";
    if (/^p$|pequeno|small|mini|pp/.test(t) || t === "pequeno") return "pequeno";
    if (/medio|medium|m\b|^m$/.test(t) || t === "medio") return "medio";
    // números / faixas do ML às vezes
    if (/1|xs|s\b/.test(t) && !/grande/.test(t)) return "pequeno";
    return "medio";
  }

  function isSupermercado(cat) {
    var t = normHeader(cat || "");
    return /super\s*mercado|grocery|alimentos|mercearia|supermercado/.test(t);
  }

  function daysBetween(isoFrom, isoTo) {
    if (!isoFrom || !isoTo) return null;
    var a = isoFrom.split("-").map(Number);
    var b = isoTo.split("-").map(Number);
    var da = Date.UTC(a[0], a[1] - 1, a[2]);
    var db = Date.UTC(b[0], b[1] - 1, b[2]);
    return Math.floor((db - da) / 86400000);
  }

  function todayIso(ref) {
    var d = ref || new Date();
    return iso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function bucketFor(days) {
    if (days == null || !isFinite(days) || days < 0) return null;
    for (var i = 0; i < BUCKETS.length; i++) {
      if (days >= BUCKETS[i].min && days <= BUCKETS[i].max) return BUCKETS[i].key;
    }
    return "120_plus";
  }

  function headerScore(row) {
    var n = row.map(normHeader);
    var score = 0, hasSku = false, hasQty = false;
    var allSyn = [];
    Object.keys(FIELDS).forEach(function (f) { allSyn = allSyn.concat(FIELDS[f].syn); });
    n.forEach(function (h) {
      if (!h) return;
      if (allSyn.indexOf(h) >= 0 || allSyn.some(function (s) { return h === s || h.indexOf(s + " ") === 0; })) score++;
      if (FIELDS.sku.syn.some(function (s) { return h === s || h.indexOf(s) === 0; })) hasSku = true;
      if (FIELDS.unidades.syn.some(function (s) { return h === s || h.indexOf(s) === 0; })) hasQty = true;
    });
    return { score: score, hasSku: hasSku, hasQty: hasQty };
  }

  function detectHeaderRow(rows) {
    var best = -1, bestScore = 0;
    for (var i = 0; i < Math.min(rows.length, 40); i++) {
      var hs = headerScore(rows[i]);
      if ((hs.hasSku || hs.hasQty) && hs.score >= 2 && hs.score > bestScore) { best = i; bestScore = hs.score; }
    }
    return best;
  }

  function buildTable(rows, forcedMap) {
    var hIdx = detectHeaderRow(rows);
    if (hIdx < 0) {
      return { ok: false, error: "Não achei a linha de cabeçalho com SKU/código e unidades. Mapeie as colunas abaixo.", headers: rows[0] || [], rows: rows };
    }
    var headers = rows[hIdx].map(function (h) { return String(h == null ? "" : h).trim(); });
    var map = mapHeaders(headers, WANTED);
    if (forcedMap) Object.keys(forcedMap).forEach(function (k) {
      if (forcedMap[k] == null || forcedMap[k] === "") return;
      if (+forcedMap[k] < 0) delete map[k]; else map[k] = +forcedMap[k];
    });
    var data = rows.slice(hIdx + 1).filter(function (r) {
      return r.some(function (v) { return String(v == null ? "" : v).trim() !== ""; });
    });
    var missing = [];
    if (map.sku == null && map.titulo == null) missing.push("SKU ou Título");
    if (map.unidades == null) missing.push(FIELDS.unidades.label);
    if (map.diasCd == null && map.dataEntrada == null) missing.push("Dias no CD ou Data de entrada");
    return {
      ok: missing.length === 0,
      error: missing.length ? "Faltam colunas: " + missing.join(", ") + ". Escolha manualmente abaixo." : null,
      missing: missing, headerRow: hIdx, headers: headers, map: map, data: data
    };
  }

  function cell(r, idx) { return idx == null ? null : r[idx]; }

  /**
   * opts:
   *  - rates: { pequeno, medio, grande, extragrande }
   *  - asOf: ISO date (default today)
   *  - antigoGeralDias: 120 (≈4 meses)
   *  - antigoSuperDias: 60 (≈2 meses)
   */
  function analyze(tables, opts) {
    opts = opts || {};
    var rates = Object.assign({}, DEFAULT_RATES, opts.rates || {});
    var asOf = opts.asOf || todayIso();
    var antigoGeral = opts.antigoGeralDias != null ? +opts.antigoGeralDias : 120;
    var antigoSuper = opts.antigoSuperDias != null ? +opts.antigoSuperDias : 60;
    if (!isFinite(antigoGeral) || antigoGeral < 30) antigoGeral = 120;
    if (!isFinite(antigoSuper) || antigoSuper < 15) antigoSuper = 60;

    var rows = [];
    var bucketStats = {};
    BUCKETS.forEach(function (b) { bucketStats[b.key] = { key: b.key, label: b.label, skus: 0, unidades: 0, custoMes: 0 }; });
    var totalUn = 0, totalCustoMes = 0, totalCustoDia = 0, flagged = 0, semVenda = 0, skipped = 0;

    tables.forEach(function (t) {
      if (!t || !t.ok) return;
      var m = t.map;
      t.data.forEach(function (r) {
        var sku = cell(r, m.sku);
        var titulo = cell(r, m.titulo);
        var skuStr = sku != null ? String(sku).trim() : "";
        var titStr = titulo != null ? String(titulo).trim() : "";
        if (!skuStr && !titStr) { skipped++; return; }
        var un = parseNumber(cell(r, m.unidades));
        if (un == null || un <= 0) { skipped++; return; }
        un = Math.round(un);

        var dias = parseNumber(cell(r, m.diasCd));
        if (dias == null) {
          var ent = parseDate(cell(r, m.dataEntrada));
          if (ent) dias = daysBetween(ent, asOf);
        }
        if (dias == null || !isFinite(dias) || dias < 0) { skipped++; return; }
        dias = Math.floor(dias);

        var porteKey = classifyPorte(cell(r, m.porte));
        var rate = rates[porteKey] != null ? +rates[porteKey] : rates.medio;
        if (!isFinite(rate) || rate < 0) rate = DEFAULT_RATES.medio;

        var custoDia = round4(un * rate);
        var custoMes = round2(custoDia * 30);
        var bk = bucketFor(dias);
        var cat = cell(r, m.categoria);
        var superM = isSupermercado(cat);
        var limiarAntigo = superM ? antigoSuper : antigoGeral;
        var reasons = [];
        var status = "ok";

        if (dias >= limiarAntigo) {
          status = "antigo";
          reasons.push(superM
            ? "Supermercado: ≥" + limiarAntigo + " dias (risco de custo por estoque antigo)"
            : "≥" + limiarAntigo + " dias no CD (risco de custo por estoque antigo ≈4 meses)");
        } else if (dias >= limiarAntigo - 30) {
          status = "alerta";
          reasons.push("A " + (limiarAntigo - dias) + " dia(s) do limiar de estoque antigo (" + limiarAntigo + " d)");
        }

        var v30 = m.vendas30 != null ? parseNumber(cell(r, m.vendas30)) : null;
        var v60 = m.vendas60 != null ? parseNumber(cell(r, m.vendas60)) : null;
        var v90 = m.vendas90 != null ? parseNumber(cell(r, m.vendas90)) : null;
        if (v30 === 0 || (v30 == null && v60 === 0) || (v30 == null && v60 == null && v90 === 0)) {
          if (status === "ok") status = "sem_venda";
          reasons.push("Sem vendas no período informado");
          semVenda++;
        }

        var cobertura = null;
        if (v30 != null && v30 > 0) cobertura = round1(un / (v30 / 30));
        else if (v60 != null && v60 > 0) cobertura = round1(un / (v60 / 60));
        else if (v90 != null && v90 > 0) cobertura = round1(un / (v90 / 90));
        if (cobertura != null && cobertura > 120 && status === "ok") {
          status = "alerta";
          reasons.push("Cobertura estimada > 120 dias");
        }

        if (status !== "ok") flagged++;

        var row = {
          sku: skuStr || titStr.slice(0, 40),
          titulo: titStr,
          unidades: un,
          porte: porteKey,
          rate: rate,
          dias: dias,
          bucket: bk,
          bucketLabel: (BUCKETS.filter(function (b) { return b.key === bk; })[0] || {}).label || bk,
          custoDia: custoDia,
          custoMes: custoMes,
          custoAcum: round2(custoDia * dias),
          vendas30: v30,
          vendas60: v60,
          vendas90: v90,
          cobertura: cobertura,
          supermercado: superM,
          limiarAntigo: limiarAntigo,
          status: status,
          reasons: reasons
        };
        rows.push(row);

        totalUn += un;
        totalCustoDia += custoDia;
        totalCustoMes += custoMes;
        if (bk && bucketStats[bk]) {
          bucketStats[bk].skus++;
          bucketStats[bk].unidades += un;
          bucketStats[bk].custoMes = round2(bucketStats[bk].custoMes + custoMes);
        }
      });
    });

    rows.sort(function (a, b) {
      var rank = { antigo: 0, alerta: 1, sem_venda: 2, ok: 3 };
      var ra = rank[a.status] != null ? rank[a.status] : 9;
      var rb = rank[b.status] != null ? rank[b.status] : 9;
      if (ra !== rb) return ra - rb;
      return b.custoMes - a.custoMes;
    });

    return {
      rows: rows,
      buckets: BUCKETS.map(function (b) { return bucketStats[b.key]; }),
      rates: rates,
      asOf: asOf,
      resumo: {
        skus: rows.length,
        unidades: totalUn,
        custoDia: round2(totalCustoDia),
        custoMes: round2(totalCustoMes),
        flagged: flagged,
        semVenda: semVenda,
        skipped: skipped,
        antigoGeralDias: antigoGeral,
        antigoSuperDias: antigoSuper
      }
    };
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  function fmt(n) {
    if (n == null || !isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function br(isoDate) {
    if (!isoDate) return "—";
    var p = String(isoDate).split("-");
    if (p.length !== 3) return isoDate;
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  var STATUS = {
    ok: { label: "OK", class: "ok" },
    alerta: { label: "Alerta", class: "alerta" },
    antigo: { label: "Estoque antigo", class: "antigo" },
    sem_venda: { label: "Sem venda", class: "sem_venda" }
  };

  function numBr(n) {
    if (n == null || !isFinite(n)) return "";
    return String(n).replace(".", ",");
  }

  function toCSV(result, onlyFlagged) {
    var lines = ["SKU;Título;Unidades;Porte;Diária R$;Dias no CD;Faixa;Custo/dia R$;Custo/mês R$;Custo acum. est. R$;Vendas 30d;Cobertura dias;Status;Motivos"];
    (result.rows || []).forEach(function (r) {
      if (onlyFlagged && r.status === "ok") return;
      lines.push([
        r.sku, r.titulo, r.unidades, r.porte, numBr(r.rate),
        r.dias, r.bucketLabel, numBr(r.custoDia), numBr(r.custoMes), numBr(r.custoAcum),
        r.vendas30 != null ? r.vendas30 : "", r.cobertura != null ? numBr(r.cobertura) : "",
        (STATUS[r.status] || {}).label || r.status,
        (r.reasons || []).join(" | ")
      ].map(function (c) {
        var s = String(c == null ? "" : c);
        if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(";"));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

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
    FIELDS: FIELDS, WANTED: WANTED, DEFAULT_RATES: DEFAULT_RATES, BUCKETS: BUCKETS, STATUS: STATUS,
    normHeader: normHeader, mapHeaders: mapHeaders, detectDelimiter: detectDelimiter, parseCSV: parseCSV,
    parseNumber: parseNumber, parseDate: parseDate, classifyPorte: classifyPorte, isSupermercado: isSupermercado,
    daysBetween: daysBetween, bucketFor: bucketFor, todayIso: todayIso,
    detectHeaderRow: detectHeaderRow, buildTable: buildTable, analyze: analyze,
    toCSV: toCSV, fmt: fmt, br: br, sheetRows: sheetRows, decodeText: decodeText, isXlsxName: isXlsxName
  };
});
