/*!
 * Precifica — Auditor de tarifas do Mercado Livre (100% no navegador).
 * Lê o relatório de Conciliação "Por venda" (ou Faturamento), agrupa por
 * Número da operação, calcula % de tarifas, parseia Detalhes de tarifas,
 * marca outliers vs mediana/limiar, duplicatas conflitantes e linhas só de envio.
 * Não replica a tabela oficial de tarifas do ML.
 *
 * Colunas oficiais:
 *  - https://vendedores.mercadolivre.com.br/aprender/nota/relatorio-detalhes-do-periodo-como-analisa-lo
 *  - https://vendedores.mercadolivre.com.br/aprender/nota/como-conciliar-usando-os-relatorios-de-venda-e-liberacao-de-dinheiro
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AuditorTarifasML = api;
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
    op: { label: "Número da operação", syn: ["numero da operacao", "n da operacao", "numero de operacao", "order id", "id do pedido", "external reference", "numero da venda", "n de venda", "source id", "id da operacao no mercado pago"] },
    tipo: { label: "Tipo de operação", syn: ["tipo de operacao", "description", "descricao", "detalhe"] },
    dataVenda: { label: "Data da venda / tarifa", syn: ["data da venda", "data da operacao", "data da tarifa", "transaction date", "data de criacao da operacao", "date"] },
    bruto: { label: "Valor bruto", syn: ["valor bruto", "gross amount", "valor bruto da operacao", "valor da transacao"] },
    tarifas: { label: "Valor total de tarifas", syn: ["valor total de tarifas", "total de tarifas", "valor da tarifa"] },
    detTarifas: { label: "Detalhes de tarifas", syn: ["detalhes de tarifas", "detalhe de tarifas", "detalhamento de tarifas", "detalhe"] },
    liquido: { label: "Valor líquido após tarifas", syn: ["valor liquido apos tarifas", "valor liquido"] },
    valorItem: { label: "Valor do item", syn: ["valor do item", "preco do produto"] },
    anuncio: { label: "Anúncio / título (opcional)", syn: ["titulo do anuncio", "titulo", "anuncio", "item id", "codigo do produto"] }
  };
  var WANTED = ["op", "tipo", "dataVenda", "bruto", "tarifas", "detTarifas", "liquido", "valorItem", "anuncio"];

  // Conceitos comuns no texto de Detalhes de tarifas / Tipo (não inventamos valores — só agrupamos o que o arquivo traz).
  var FEE_KEYWORDS = [
    { key: "custo_vender", label: "Custo por vender", re: /custo por vender|comiss[aã]o|selling fee|tarifa de venda/i },
    { key: "envio", label: "Tarifa de envio", re: /tarifa de envio|envio extra|intermunicipal|frete|shipping|mercado envios/i },
    { key: "gestao", label: "Gestão de venda", re: /gest[aã]o de venda|custo de gest[aã]o|sale fee/i },
    { key: "parcelamento", label: "Parcelamento", re: /parcelamento|financiamento|installment/i },
    { key: "devolucao", label: "Devolução / cancelamento", re: /devolu[cç][aã]o|cancelamento|refund|chargeback|estorno/i },
    { key: "fix", label: "Full / fulfillment", re: /\bfull\b|fulfillment|armazenamento|storage/i },
    { key: "ads", label: "Ads / propaganda", re: /\bads\b|product ads|publicidade|propaganda/i },
    { key: "outros", label: "Outros / não classificado", re: null }
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
          if (!used[j] && norm[j] && (norm[j].indexOf(syn[s2] + " ") === 0)) { idx = j; break; }
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
  function round1(n) { return Math.round(n * 10) / 10; }

  /** Extrai partes nomeadas do texto de Detalhes de tarifas (soma líquidos quando possível). */
  function parseFeeParts(cell) {
    if (cell == null) return [];
    var s = String(cell).trim();
    if (!s) return [];
    var parts = [];
    if (/^[\[{]/.test(s)) {
      try {
        var j = JSON.parse(s);
        var arr = Array.isArray(j) ? j : [j];
        arr.forEach(function (o) {
          if (!o || typeof o !== "object") return;
          var name = o.name || o.nome || o.concept || o.conceito || o.type || o.tipo || "";
          var keys = Object.keys(o);
          var k = keys.filter(function (x) { return /liquid|net/.test(normHeader(x)); })[0];
          if (k == null) k = keys.filter(function (x) { return /amount|valor/.test(normHeader(x)); })[0];
          var val = k != null ? parseNumber(o[k]) : null;
          if (val != null) parts.push({ name: String(name || "item"), valor: Math.abs(val) });
        });
        if (parts.length) return parts;
      } catch (e) { /* regex */ }
    }
    // "Nome: bruto R$ X, desconto R$ Y, líquido R$ Z" (pode haver vários separados por ; ou |)
    var chunks = s.split(/\s*[|;]\s*(?=[A-Za-zÀ-ú])/);
    if (chunks.length === 1) chunks = [s];
    chunks.forEach(function (chunk) {
      var liq = chunk.match(/l[ií]quido\s*:?\s*(-?\s*(?:R\$)?\s*[\d.,]+)/i);
      var nameMatch = chunk.match(/^([^:]+?)(?::|\s+bruto|\s+l[ií]quido)/i);
      var valor = liq ? parseNumber(liq[1].replace(/[.,]$/, "")) : null;
      if (valor == null) {
        var any = chunk.match(/(?:R\$)?\s*([\d.,]+)/);
        if (any) valor = parseNumber(any[1]);
      }
      if (valor != null) {
        parts.push({
          name: nameMatch ? nameMatch[1].trim() : chunk.slice(0, 80).trim(),
          valor: Math.abs(valor)
        });
      }
    });
    return parts;
  }

  function classifyFeeText(text) {
    var t = String(text || "");
    for (var i = 0; i < FEE_KEYWORDS.length; i++) {
      var fk = FEE_KEYWORDS[i];
      if (fk.re && fk.re.test(t)) return fk.key;
    }
    return "outros";
  }

  function headerScore(row) {
    var n = row.map(normHeader);
    var score = 0, hasOp = false;
    var allSyn = [];
    Object.keys(FIELDS).forEach(function (f) { allSyn = allSyn.concat(FIELDS[f].syn); });
    n.forEach(function (h) {
      if (!h) return;
      if (allSyn.indexOf(h) >= 0 || allSyn.some(function (s) { return h.indexOf(s + " ") === 0; })) score++;
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

  function buildTable(rows, forcedMap) {
    var hIdx = detectHeaderRow(rows);
    if (hIdx < 0) {
      return { ok: false, error: "Não achei a linha de cabeçalho com \"Número da operação\".", headers: rows[0] || [], rows: rows };
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
    if (map.op == null) missing.push(FIELDS.op.label);
    if (map.bruto == null && map.tarifas == null) missing.push("Valor bruto ou Valor total de tarifas");
    return {
      ok: missing.length === 0,
      error: missing.length ? "Faltam colunas: " + missing.join(", ") + ". Escolha manualmente abaixo." : null,
      missing: missing, headerRow: hIdx, headers: headers, map: map, data: data
    };
  }

  function cell(r, idx) { return idx == null ? null : r[idx]; }
  function opKey(v) {
    if (v == null) return "";
    if (typeof v === "number") return String(Math.round(v));
    var s = String(v).trim().replace(/^'+/, "");
    if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, "");
    if (/^\d+([.,]\d+)?e\+?\d+$/i.test(s)) return "";
    return s;
  }

  function isEnvioTipo(tipo) {
    var t = normHeader(tipo || "");
    return t === "envio" || t.indexOf("envio") === 0 || /shipping|frete/.test(t);
  }
  function isCancelTipo(tipo) {
    var t = normHeader(tipo || "");
    return /cancel|devolu|estorno|refund/.test(t);
  }

  function median(arr) {
    if (!arr.length) return null;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /**
   * opts:
   *  - feePctThreshold: número (ex.: 20) — flag se feePct > limiar
   *  - outlierMultiplier: se feePct > mediana * mult (padrão 1.8) e acima do limiar mínimo
   */
  function audit(tables, opts) {
    opts = opts || {};
    var threshold = opts.feePctThreshold != null ? +opts.feePctThreshold : 20;
    if (!isFinite(threshold) || threshold < 0) threshold = 20;
    var mult = opts.outlierMultiplier != null ? +opts.outlierMultiplier : 1.8;
    if (!isFinite(mult) || mult < 1) mult = 1.8;

    var ops = {};
    var order = [];
    var feeByConcept = {};
    FEE_KEYWORDS.forEach(function (fk) { feeByConcept[fk.key] = { key: fk.key, label: fk.label, valor: 0, linhas: 0 }; });
    var lines = 0, badKeys = 0, envioOnlyLines = 0;

    tables.forEach(function (t) {
      if (!t || !t.ok) return;
      var m = t.map;
      t.data.forEach(function (r) {
        var key = opKey(cell(r, m.op));
        if (!key) { badKeys++; return; }
        lines++;
        var tipo = cell(r, m.tipo);
        var tipoStr = tipo != null ? String(tipo).trim() : "";
        var bruto = parseNumber(cell(r, m.bruto));
        var tar = parseNumber(cell(r, m.tarifas));
        var liq = parseNumber(cell(r, m.liquido));
        var date = parseDate(cell(r, m.dataVenda));
        var det = cell(r, m.detTarifas);
        var an = cell(r, m.anuncio);

        var o = ops[key];
        if (!o) {
          o = ops[key] = {
            op: key, linhas: 0, bruto: 0, tarifas: 0, liquido: 0,
            dataVenda: null, tipos: [], anuncio: "", feeParts: [],
            envioOnly: true, hasVenda: false, hasCancel: false
          };
          order.push(key);
        }
        o.linhas++;
        if (tipoStr && o.tipos.indexOf(tipoStr) < 0) o.tipos.push(tipoStr);
        if (an != null && String(an).trim() && !o.anuncio) o.anuncio = String(an).trim();
        if (date && (!o.dataVenda || date < o.dataVenda)) o.dataVenda = date;

        var isEnvio = isEnvioTipo(tipoStr);
        var isCancel = isCancelTipo(tipoStr);
        if (isEnvio) envioOnlyLines++;
        if (!isEnvio && tipoStr) o.envioOnly = false;
        if (!isEnvio && !isCancel && (bruto == null || bruto > 0)) o.hasVenda = true;
        if (isCancel) o.hasCancel = true;

        // Bruto: soma só linhas com bruto > 0 (cancelamento negativo não entra no denominador)
        if (bruto != null && bruto > 0) o.bruto = round2(o.bruto + bruto);
        if (tar != null) {
          // Em cancelamentos o ML às vezes devolve tarifa (negativo) — soma algébrica
          o.tarifas = round2(o.tarifas + tar);
        }
        if (liq != null) o.liquido = round2(o.liquido + liq);

        var parts = parseFeeParts(det);
        if (parts.length) {
          parts.forEach(function (p) {
            o.feeParts.push(p);
            var ck = classifyFeeText(p.name + " " + tipoStr);
            feeByConcept[ck].valor = round2(feeByConcept[ck].valor + p.valor);
            feeByConcept[ck].linhas++;
          });
        } else if (tar != null && Math.abs(tar) > 0) {
          var ck2 = classifyFeeText(tipoStr + " " + String(det || ""));
          feeByConcept[ck2].valor = round2(feeByConcept[ck2].valor + Math.abs(tar));
          feeByConcept[ck2].linhas++;
        }
      });
    });

    // Se operação só tem linhas de envio (nunca teve tipo venda), marca envioOnly
    order.forEach(function (k) {
      var o = ops[k];
      if (o.hasVenda) o.envioOnly = false;
      else if (o.tipos.length && o.tipos.every(isEnvioTipo)) o.envioOnly = true;
      else if (!o.tipos.length) o.envioOnly = false;
    });

    var pcts = [];
    order.forEach(function (k) {
      var o = ops[k];
      if (o.bruto > 0 && o.tarifas != null) {
        o.feePct = round1((Math.abs(o.tarifas) / o.bruto) * 100);
        if (!o.envioOnly && o.hasVenda) pcts.push(o.feePct);
      } else {
        o.feePct = null;
      }
    });
    var med = median(pcts);

    var flags = { alta: 0, outlier: 0, envio: 0, conflito: 0, ok: 0 };
    var rows = order.map(function (k) {
      var o = ops[k];
      var reasons = [];
      var status = "ok";

      if (o.envioOnly) {
        reasons.push("Linha(s) só de envio (sem venda no mesmo Nº de operação neste arquivo)");
        status = "envio";
        flags.envio++;
      }

      // Conflito: mesma op com tarifas de sinais opostos ou % absurdo com bruto
      if (o.linhas >= 2 && o.bruto > 0 && o.feePct != null && o.feePct > 80) {
        reasons.push("Tarifas > 80% do bruto na operação (possível conceito duplicado ou cancelamento parcial)");
        if (status === "ok") status = "conflito";
        flags.conflito++;
      }
      // Duas partes do mesmo conceito com valores muito diferentes na mesma op
      if (o.feeParts.length >= 2) {
        var byName = {};
        o.feeParts.forEach(function (p) {
          var nk = normHeader(p.name).slice(0, 40);
          if (!byName[nk]) byName[nk] = [];
          byName[nk].push(p.valor);
        });
        Object.keys(byName).forEach(function (nk) {
          var vals = byName[nk];
          if (vals.length >= 2) {
            var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
            if (mx - mn > 0.05 && mx > mn * 1.5) {
              reasons.push("Mesmo conceito de tarifa com valores conflitantes (" + mn.toFixed(2) + " vs " + mx.toFixed(2) + ")");
              if (status === "ok" || status === "envio") { status = "conflito"; flags.conflito++; }
            }
          }
        });
      }

      if (o.feePct != null && !o.envioOnly) {
        if (o.feePct > threshold) {
          reasons.push("% de tarifas " + String(o.feePct).replace(".", ",") + "% acima do limiar " + threshold + "%");
          if (status === "ok") status = "alta";
          flags.alta++;
        }
        if (med != null && o.feePct > med * mult && o.feePct > Math.max(threshold * 0.5, 10)) {
          reasons.push("Outlier vs mediana do lote (mediana " + String(round1(med)).replace(".", ",") + "%)");
          if (status === "ok" || status === "alta") {
            if (status === "ok") flags.outlier++;
            status = status === "ok" ? "outlier" : status;
            if (status === "alta") { /* already counted alta */ flags.outlier++; }
          }
        }
      }

      if (status === "ok") flags.ok++;

      return {
        op: o.op,
        status: status,
        dataVenda: o.dataVenda,
        bruto: o.bruto,
        tarifas: o.tarifas,
        liquido: o.liquido,
        feePct: o.feePct,
        tipos: o.tipos,
        anuncio: o.anuncio,
        linhas: o.linhas,
        reasons: reasons,
        feeParts: o.feeParts,
        envioOnly: o.envioOnly
      };
    });

    // Ordena: flagged primeiro
    var rank = { conflito: 0, alta: 1, outlier: 2, envio: 3, ok: 4 };
    rows.sort(function (a, b) {
      var ra = rank[a.status] != null ? rank[a.status] : 9;
      var rb = rank[b.status] != null ? rank[b.status] : 9;
      if (ra !== rb) return ra - rb;
      if ((b.feePct || 0) !== (a.feePct || 0)) return (b.feePct || 0) - (a.feePct || 0);
      return a.op < b.op ? -1 : 1;
    });

    var concepts = FEE_KEYWORDS.map(function (fk) { return feeByConcept[fk.key]; })
      .filter(function (c) { return c.valor > 0 || c.linhas > 0; });

    var flagged = rows.filter(function (r) { return r.status !== "ok"; });
    var totalBruto = 0, totalTar = 0;
    rows.forEach(function (r) { totalBruto += r.bruto || 0; totalTar += Math.abs(r.tarifas || 0); });

    return {
      rows: rows,
      flagged: flagged,
      concepts: concepts,
      medianaPct: med != null ? round1(med) : null,
      threshold: threshold,
      resumo: {
        operacoes: rows.length,
        linhas: lines,
        semNumero: badKeys,
        flagged: flagged.length,
        alta: flags.alta,
        outlier: flags.outlier,
        envio: flags.envio,
        conflito: flags.conflito,
        ok: flags.ok,
        totalBruto: round2(totalBruto),
        totalTarifas: round2(totalTar),
        feePctGeral: totalBruto > 0 ? round1((totalTar / totalBruto) * 100) : null,
        envioOnlyLines: envioOnlyLines
      }
    };
  }

  function fmt(n) {
    if (n == null || !isFinite(n)) return "—";
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).split(".");
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "−" : "") + "R$ " + s[0] + "," + s[1];
  }
  function br(isoDate) {
    if (!isoDate) return "—";
    var p = isoDate.split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  function pct(n) {
    if (n == null || !isFinite(n)) return "—";
    return String(n).replace(".", ",") + "%";
  }

  var STATUS = {
    ok: { label: "Ok", class: "ok" },
    alta: { label: "% alta", class: "alta" },
    outlier: { label: "Outlier", class: "outlier" },
    envio: { label: "Só envio", class: "envio" },
    conflito: { label: "Conflito", class: "conflito" }
  };

  function toCSV(result, onlyFlagged) {
    var head = ["Número da operação", "Situação", "Data", "Valor bruto", "Tarifas", "% tarifas", "Líquido", "Tipos", "Motivos", "Anúncio"];
    var esc = function (v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var num = function (n) { return n == null ? "" : String(n.toFixed(2)).replace(".", ","); };
    var lines = [head.join(";")];
    var list = onlyFlagged ? result.flagged : result.rows;
    list.forEach(function (r) {
      lines.push([
        r.op,
        STATUS[r.status] ? STATUS[r.status].label : r.status,
        br(r.dataVenda),
        num(r.bruto),
        num(r.tarifas),
        r.feePct == null ? "" : String(r.feePct).replace(".", ","),
        num(r.liquido),
        r.tipos.join(" | "),
        r.reasons.join(" · "),
        r.anuncio
      ].map(esc).join(";"));
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
    FIELDS: FIELDS, WANTED: WANTED, FEE_KEYWORDS: FEE_KEYWORDS, STATUS: STATUS,
    normHeader: normHeader, mapHeaders: mapHeaders, detectDelimiter: detectDelimiter, parseCSV: parseCSV,
    parseNumber: parseNumber, parseDate: parseDate, parseFeeParts: parseFeeParts, classifyFeeText: classifyFeeText,
    detectHeaderRow: detectHeaderRow, buildTable: buildTable, audit: audit, median: median,
    toCSV: toCSV, fmt: fmt, br: br, pct: pct, sheetRows: sheetRows, decodeText: decodeText, isXlsxName: isXlsxName, opKey: opKey
  };
});
