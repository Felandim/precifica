/*!
 * Precifica — Extrato bancário × saques Mercado Pago (100% no navegador).
 * Cruza créditos do extrato (CSV/OFX) com saques/transferências do MP/ML.
 * Nenhum arquivo sai do aparelho.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ExtratoSaquesMP = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function normHeader(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  var BANK_FIELDS = {
    data: { label: "Data", syn: ["data", "date", "data lancamento", "data do lancamento", "data movimento", "data da movimentacao", "dt posted", "posted date", "data contabil"] },
    valor: { label: "Valor", syn: ["valor", "amount", "valor r", "valor rs", "valor da movimentacao", "credito", "entrada", "trnamt", "valor creditado"] },
    debito: { label: "Débito (opcional)", syn: ["debito", "saida", "valor debito"] },
    creditoCol: { label: "Crédito (opcional)", syn: ["credito", "entrada", "valor credito"] },
    desc: { label: "Descrição / histórico", syn: ["descricao", "description", "historico", "historico lancamento", "memo", "lancamento", "detalhe", "complemento", "nome"] }
  };
  var SAQUE_FIELDS = {
    data: { label: "Data do saque", syn: ["data", "date", "data da liberacao", "data do saque", "data da transferencia", "transaction date", "date short", "data de criacao"] },
    valor: { label: "Valor do saque", syn: ["valor", "amount", "valor liquido", "valor da transferencia", "valor do saque", "withdrawal amount", "gross amount"] },
    credito: { label: "Crédito líquido (MP)", syn: ["net credit amount", "valor liquido creditado", "credito"] },
    debito: { label: "Débito líquido (MP)", syn: ["net debit amount", "valor liquido debitado", "debito"] },
    desc: { label: "Descrição / tipo", syn: ["descricao", "description", "tipo", "tipo de operacao", "record type", "tipo de registro", "detail"] },
    id: { label: "ID (opcional)", syn: ["id", "external reference", "order id", "source id", "numero da operacao", "transaction id", "reference"] }
  };
  var BANK_WANTED = ["data", "valor", "desc", "debito", "creditoCol"];
  var SAQUE_WANTED = ["data", "valor", "credito", "debito", "desc", "id"];

  // Palavras que tipicamente marcam crédito vindo do Mercado Pago no extrato.
  var MP_HINTS = [
    "mercadopago", "mercado pago", "merpago", "mercado pago", "mpago",
    "mercadolivre", "mercado livre", "meli", "mp *", "mp*",
    "pag*mercado", "pagseguro mercado" // alguns extratos abreviam
  ];

  // Tipos/descrições do lado MP que são saída de dinheiro para o banco (não liberação de venda).
  var SAQUE_HINTS = [
    "saque", "transferencia", "transferência", "withdrawal", "withdraw", "payout",
    "money_out", "money out", "cashout", "cash out", "envio de dinheiro",
    "transfer", "bank_transfer", "bank transfer", "withdraw_to_bank"
  ];

  function mapHeaders(headers, fields, wanted) {
    var norm = headers.map(normHeader);
    var used = {};
    var map = {};
    (wanted || Object.keys(fields)).forEach(function (f) {
      var syn = fields[f].syn;
      var idx = -1;
      for (var s = 0; s < syn.length && idx < 0; s++) {
        for (var i = 0; i < norm.length; i++) if (!used[i] && norm[i] === syn[s]) { idx = i; break; }
      }
      for (var s2 = 0; s2 < syn.length && idx < 0; s2++) {
        for (var j = 0; j < norm.length; j++) {
          if (!used[j] && norm[j] && (norm[j].indexOf(syn[s2] + " ") === 0 || norm[j].indexOf(" " + syn[s2]) > 0)) { idx = j; break; }
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
    // OFX: YYYYMMDD or YYYYMMDDHHMMSS
    var mOfx = s.match(/^(\d{4})(\d{2})(\d{2})/);
    if (mOfx && s.length >= 8 && /^\d+$/.test(s.slice(0, 8))) return iso(+mOfx[1], +mOfx[2], +mOfx[3]);
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
  function round2(n) { return Math.round(n * 100) / 100; }

  function decodeText(buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    try {
      var utf8 = new TextDecoder("utf-8", { fatal: true }).decode(u8);
      if (utf8.indexOf("\ufffd") < 0) return utf8;
    } catch (e) { /* try 1252 */ }
    try { return new TextDecoder("windows-1252").decode(u8); } catch (e2) {
      var s = "";
      for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
      return s;
    }
  }
  function isXlsxName(name) { return /\.(xlsx|xlsm|xls|ods)$/i.test(name || ""); }
  function isOfxName(name) { return /\.(ofx|qfx)$/i.test(name || ""); }

  function sheetRows(XLSX, wb) {
    var name = wb.SheetNames[0];
    var sheet = wb.Sheets[name];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  }

  // ---------- OFX ----------
  function parseOFX(text) {
    text = String(text || "");
    // Normaliza tags SGML (OFX 1.x) para facilitar o parse
    var blocks = text.split(/<\/?STMTTRN>/i);
    var txns = [];
    for (var i = 1; i < blocks.length; i += 2) {
      var b = blocks[i];
      if (!b || b.length < 5) continue;
      function tag(name) {
        var re = new RegExp("<" + name + ">([^\\r\\n<]+)", "i");
        var m = b.match(re);
        return m ? m[1].trim() : "";
      }
      var amt = parseNumber(tag("TRNAMT"));
      var date = parseDate(tag("DTPOSTED")) || parseDate(tag("DTUSER"));
      var memo = tag("MEMO") || tag("NAME") || tag("PAYEE") || "";
      var type = tag("TRNTYPE");
      if (amt == null || !date) continue;
      txns.push({
        data: date,
        valor: round2(amt),
        desc: memo,
        tipo: type,
        source: "ofx"
      });
    }
    return txns;
  }

  function looksLikeMP(desc) {
    var d = normHeader(desc || "");
    if (!d) return false;
    for (var i = 0; i < MP_HINTS.length; i++) {
      var h = normHeader(MP_HINTS[i]);
      if (h && d.indexOf(h) >= 0) return true;
    }
    // padrões soltos comuns em extratos BR
    if (/\bmp\b/.test(d) && /pago|pagto|transf|ted|pix/.test(d)) return true;
    return false;
  }

  function looksLikeSaque(desc) {
    var d = normHeader(desc || "");
    if (!d) return false;
    for (var i = 0; i < SAQUE_HINTS.length; i++) {
      if (d.indexOf(normHeader(SAQUE_HINTS[i])) >= 0) return true;
    }
    return false;
  }

  function headerScore(row, fields) {
    var n = row.map(normHeader);
    var syns = [];
    Object.keys(fields).forEach(function (f) { syns = syns.concat(fields[f].syn); });
    var score = 0, hasDate = false, hasVal = false;
    n.forEach(function (h) {
      if (!h) return;
      if (syns.indexOf(h) >= 0 || syns.some(function (s) { return h.indexOf(s) === 0; })) score++;
      if (fields.data.syn.some(function (s) { return h === s || h.indexOf(s) === 0; })) hasDate = true;
      if (fields.valor.syn.some(function (s) { return h === s || h.indexOf(s) === 0; }) ||
          (fields.creditoCol && fields.creditoCol.syn.some(function (s) { return h === s; })) ||
          (fields.credito && fields.credito.syn.some(function (s) { return h === s; })) ||
          (fields.debito && fields.debito.syn.some(function (s) { return h === s; }))) hasVal = true;
    });
    return { score: score, hasDate: hasDate, hasVal: hasVal };
  }

  function detectHeaderRow(rows, fields) {
    var best = -1, bestScore = 0;
    for (var i = 0; i < Math.min(rows.length, 40); i++) {
      var hs = headerScore(rows[i], fields);
      if (hs.hasDate && hs.hasVal && hs.score >= 2 && hs.score > bestScore) { best = i; bestScore = hs.score; }
    }
    return best;
  }

  function buildBankTable(rows, forcedMap) {
    var hIdx = detectHeaderRow(rows, BANK_FIELDS);
    if (hIdx < 0) {
      return { ok: false, error: "Não achei cabeçalho com Data e Valor no extrato. Se for OFX, use a extensão .ofx.", headers: rows[0] || [], rows: rows, kind: "banco" };
    }
    var headers = rows[hIdx].map(function (h) { return String(h == null ? "" : h).trim(); });
    var map = mapHeaders(headers, BANK_FIELDS, BANK_WANTED);
    if (forcedMap) Object.keys(forcedMap).forEach(function (k) {
      if (forcedMap[k] == null || forcedMap[k] === "") return;
      if (+forcedMap[k] < 0) delete map[k]; else map[k] = +forcedMap[k];
    });
    var data = rows.slice(hIdx + 1).filter(function (r) {
      return r.some(function (v) { return String(v == null ? "" : v).trim() !== ""; });
    });
    var missing = [];
    if (map.data == null) missing.push(BANK_FIELDS.data.label);
    if (map.valor == null && map.creditoCol == null) missing.push(BANK_FIELDS.valor.label);
    return { ok: missing.length === 0, error: missing.length ? "Faltam colunas: " + missing.join(", ") + ". Escolha manualmente." : null, missing: missing, headerRow: hIdx, headers: headers, map: map, data: data, kind: "banco" };
  }

  function buildSaqueTable(rows, forcedMap) {
    var hIdx = detectHeaderRow(rows, SAQUE_FIELDS);
    if (hIdx < 0) {
      return { ok: false, error: "Não achei cabeçalho com Data e Valor no relatório de saques/liberações do Mercado Pago.", headers: rows[0] || [], rows: rows, kind: "saque" };
    }
    var headers = rows[hIdx].map(function (h) { return String(h == null ? "" : h).trim(); });
    var map = mapHeaders(headers, SAQUE_FIELDS, SAQUE_WANTED);
    if (forcedMap) Object.keys(forcedMap).forEach(function (k) {
      if (forcedMap[k] == null || forcedMap[k] === "") return;
      if (+forcedMap[k] < 0) delete map[k]; else map[k] = +forcedMap[k];
    });
    var data = rows.slice(hIdx + 1).filter(function (r) {
      return r.some(function (v) { return String(v == null ? "" : v).trim() !== ""; });
    });
    var missing = [];
    if (map.data == null) missing.push(SAQUE_FIELDS.data.label);
    if (map.valor == null && map.credito == null && map.debito == null) missing.push(SAQUE_FIELDS.valor.label);
    return { ok: missing.length === 0, error: missing.length ? "Faltam colunas: " + missing.join(", ") + ". Escolha manualmente." : null, missing: missing, headerRow: hIdx, headers: headers, map: map, data: data, kind: "saque" };
  }

  function cell(r, idx) { return idx == null ? null : r[idx]; }

  /**
   * Extrai créditos do extrato.
   * opts.onlyMP (default true): só linhas cuja descrição parece Mercado Pago.
   * opts.minAmount (default 0.01): ignora valores menores.
   */
  function extractBankCredits(tables, ofxTxns, opts) {
    opts = opts || {};
    var onlyMP = opts.onlyMP !== false;
    var minAmount = opts.minAmount != null ? opts.minAmount : 0.01;
    var credits = [];
    var ignored = 0;

    (ofxTxns || []).forEach(function (t, i) {
      if (t.valor < minAmount) { ignored++; return; } // só créditos positivos
      if (onlyMP && !looksLikeMP(t.desc)) { ignored++; return; }
      credits.push({
        id: "ofx-" + i,
        data: t.data,
        valor: round2(t.valor),
        desc: t.desc || "",
        mpHint: looksLikeMP(t.desc)
      });
    });

    (tables || []).forEach(function (t, ti) {
      if (!t || !t.ok) return;
      var m = t.map;
      t.data.forEach(function (r, ri) {
        var date = parseDate(cell(r, m.data));
        var valor = null;
        if (m.creditoCol != null) {
          valor = parseNumber(cell(r, m.creditoCol));
          if (valor == null || valor === 0) {
            // se tem coluna débito/crédito separada e crédito vazio, pula
            ignored++; return;
          }
        } else {
          valor = parseNumber(cell(r, m.valor));
        }
        // Se valor único e negativo = débito → ignora
        if (valor == null) { ignored++; return; }
        if (valor < minAmount) { ignored++; return; }
        var desc = String(cell(r, m.desc) == null ? "" : cell(r, m.desc));
        if (onlyMP && !looksLikeMP(desc)) { ignored++; return; }
        credits.push({
          id: "csv-" + ti + "-" + ri,
          data: date,
          valor: round2(valor),
          desc: desc,
          mpHint: looksLikeMP(desc)
        });
      });
    });

    credits = credits.filter(function (c) { return c.data; });
    credits.sort(function (a, b) {
      if (a.data < b.data) return -1;
      if (a.data > b.data) return 1;
      return a.valor - b.valor;
    });
    return { credits: credits, ignored: ignored };
  }

  /**
   * Extrai saques do relatório MP.
   * opts.onlySaqueHints (default true): se o arquivo tiver tipos mistos (liberações + saques),
   *   fica só com linhas que parecem saque/transferência. Se NENHUMA linha casar o hint,
   *   assume que o arquivo inteiro já é de saques e usa todas as linhas com valor ≠ 0
   *   (valor absoluto, preferindo saída).
   */
  function extractSaques(tables, opts) {
    opts = opts || {};
    var onlyHints = opts.onlySaqueHints !== false;
    var rows = [];
    (tables || []).forEach(function (t, ti) {
      if (!t || !t.ok) return;
      var m = t.map;
      t.data.forEach(function (r, ri) {
        var date = parseDate(cell(r, m.data));
        var raw = parseNumber(cell(r, m.valor));
        var cred = m.credito != null ? parseNumber(cell(r, m.credito)) : null;
        var deb = m.debito != null ? parseNumber(cell(r, m.debito)) : null;
        // Saque/transferência no MP costuma vir em NET_DEBIT_AMOUNT; liberação em NET_CREDIT.
        if (raw == null || raw === 0) {
          if (deb != null && deb !== 0) raw = -Math.abs(deb);
          else if (cred != null && cred !== 0) raw = cred;
        }
        var desc = String(cell(r, m.desc) == null ? "" : cell(r, m.desc));
        // RECORD_TYPE às vezes está em outra coluna já mapeada como desc; se vazio, tenta juntar.
        var id = m.id != null ? String(cell(r, m.id) == null ? "" : cell(r, m.id)).trim() : "";
        if (!date || raw == null || raw === 0) return;
        var hintSrc = desc;
        rows.push({
          id: id || ("saque-" + ti + "-" + ri),
          data: date,
          valorRaw: raw,
          valor: round2(Math.abs(raw)),
          desc: desc,
          isSaqueHint: looksLikeSaque(hintSrc) || (deb != null && deb !== 0 && (cred == null || cred === 0))
        });
      });
    });

    var hinted = rows.filter(function (r) { return r.isSaqueHint; });
    var chosen = (onlyHints && hinted.length) ? hinted : rows;
    // Preferir valores que representam saída: se houver misturados +/- e hints, ok; senão abs.
    chosen.sort(function (a, b) {
      if (a.data < b.data) return -1;
      if (a.data > b.data) return 1;
      return a.valor - b.valor;
    });
    return { saques: chosen, totalLinhas: rows.length, usadasHints: !!(onlyHints && hinted.length) };
  }

  var TOL = 0.05;

  /**
   * Casa saques com créditos (greedy: melhor par valor+data dentro da janela).
   * opts.windowDays (default 2), opts.tol (default 0.05)
   */
  function reconcile(saques, credits, opts) {
    opts = opts || {};
    var windowDays = opts.windowDays != null ? +opts.windowDays : 2;
    if (!isFinite(windowDays) || windowDays < 0) windowDays = 2;
    var tol = opts.tol != null ? +opts.tol : TOL;
    if (!isFinite(tol) || tol < 0) tol = TOL;

    var S = (saques || []).map(function (s, i) { return Object.assign({ _i: i }, s); });
    var C = (credits || []).map(function (c, i) { return Object.assign({ _i: i }, c); });
    var usedS = {}, usedC = {};
    var matches = [];

    // Candidatos: para cada saque, lista de créditos possíveis; escolhe o de menor (deltaValor*1000 + deltaDias)
    function candidates(s) {
      var out = [];
      var sd = dayNum(s.data);
      C.forEach(function (c) {
        if (usedC[c._i]) return;
        var cd = dayNum(c.data);
        if (sd == null || cd == null) return;
        var dd = Math.abs(cd - sd);
        if (dd > windowDays) return;
        var dv = Math.abs(c.valor - s.valor);
        if (dv > tol) return;
        out.push({ c: c, dd: dd, dv: dv, score: dv * 1000 + dd });
      });
      out.sort(function (a, b) { return a.score - b.score; });
      return out;
    }

    // Ordena saques por menos ambiguidade (menos candidatos primeiro) — multi-pass
    var pending = S.map(function (s) { return s._i; });
    var guard = 0;
    while (pending.length && guard < S.length + 5) {
      guard++;
      var bestIdx = -1, bestCand = null, bestAmb = 1e9;
      for (var p = 0; p < pending.length; p++) {
        var s = S[pending[p]];
        if (usedS[s._i]) continue;
        var cands = candidates(s);
        if (!cands.length) continue;
        if (cands.length < bestAmb || (cands.length === bestAmb && cands[0].score < (bestCand ? bestCand.score : 1e9))) {
          bestAmb = cands.length;
          bestIdx = pending[p];
          bestCand = cands[0];
        }
      }
      if (bestIdx < 0) break;
      var ss = S[bestIdx];
      usedS[ss._i] = true;
      usedC[bestCand.c._i] = true;
      pending = pending.filter(function (i) { return i !== bestIdx; });
      matches.push({
        status: "ok",
        saque: ss,
        credito: bestCand.c,
        deltaValor: round2(bestCand.c.valor - ss.valor),
        deltaDias: bestCand.c.data === ss.data ? 0 : dayNum(bestCand.c.data) - dayNum(ss.data)
      });
    }

    S.forEach(function (s) {
      if (!usedS[s._i]) {
        matches.push({ status: "saque_sem_credito", saque: s, credito: null, deltaValor: null, deltaDias: null });
      }
    });
    C.forEach(function (c) {
      if (!usedC[c._i]) {
        matches.push({ status: "credito_sem_saque", saque: null, credito: c, deltaValor: null, deltaDias: null });
      }
    });

    matches.sort(function (a, b) {
      var da = (a.saque || a.credito).data;
      var db = (b.saque || b.credito).data;
      if (da < db) return -1;
      if (da > db) return 1;
      return 0;
    });

    var counts = { ok: 0, saque_sem_credito: 0, credito_sem_saque: 0 };
    var sumOk = 0, sumMissing = 0, sumOrphan = 0;
    matches.forEach(function (m) {
      counts[m.status] = (counts[m.status] || 0) + 1;
      if (m.status === "ok") sumOk += m.saque.valor;
      if (m.status === "saque_sem_credito") sumMissing += m.saque.valor;
      if (m.status === "credito_sem_saque") sumOrphan += m.credito.valor;
    });

    return {
      rows: matches,
      counts: counts,
      totais: {
        casados: round2(sumOk),
        saquesSemCredito: round2(sumMissing),
        creditosSemSaque: round2(sumOrphan)
      },
      windowDays: windowDays,
      tol: tol
    };
  }

  function formatBRL(n) {
    if (n == null || !isFinite(n)) return "—";
    var neg = n < 0; n = Math.abs(n);
    var s = n.toFixed(2).split(".");
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "−" : "") + "R$ " + s[0] + "," + s[1];
  }

  function exportCSV(result) {
    var lines = ["Status;Data saque;Valor saque;Desc saque;Data crédito;Valor crédito;Desc crédito;Δ dias;Δ valor"];
    (result.rows || []).forEach(function (m) {
      function esc(v) {
        var s = String(v == null ? "" : v);
        if (/[;"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      }
      function brl(n) {
        if (n == null || !isFinite(n)) return "";
        return String(round2(n)).replace(".", ",");
      }
      lines.push([
        m.status,
        m.saque ? m.saque.data : "",
        m.saque ? brl(m.saque.valor) : "",
        m.saque ? esc(m.saque.desc) : "",
        m.credito ? m.credito.data : "",
        m.credito ? brl(m.credito.valor) : "",
        m.credito ? esc(m.credito.desc) : "",
        m.deltaDias == null ? "" : m.deltaDias,
        m.deltaValor == null ? "" : brl(m.deltaValor)
      ].join(";"));
    });
    return "\uFEFF" + lines.join("\r\n") + "\r\n";
  }

  return {
    normHeader: normHeader,
    BANK_FIELDS: BANK_FIELDS,
    SAQUE_FIELDS: SAQUE_FIELDS,
    BANK_WANTED: BANK_WANTED,
    SAQUE_WANTED: SAQUE_WANTED,
    MP_HINTS: MP_HINTS,
    SAQUE_HINTS: SAQUE_HINTS,
    detectDelimiter: detectDelimiter,
    parseCSV: parseCSV,
    parseNumber: parseNumber,
    parseDate: parseDate,
    parseOFX: parseOFX,
    decodeText: decodeText,
    isXlsxName: isXlsxName,
    isOfxName: isOfxName,
    sheetRows: sheetRows,
    looksLikeMP: looksLikeMP,
    looksLikeSaque: looksLikeSaque,
    buildBankTable: buildBankTable,
    buildSaqueTable: buildSaqueTable,
    extractBankCredits: extractBankCredits,
    extractSaques: extractSaques,
    reconcile: reconcile,
    formatBRL: formatBRL,
    exportCSV: exportCSV,
    round2: round2
  };
});
