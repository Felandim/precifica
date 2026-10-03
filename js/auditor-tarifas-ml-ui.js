/* Precifica — UI do Auditor de tarifas ML. Tudo local: FileReader + DOM. Sem envio de dados. */
(function () {
  "use strict";
  var A = window.AuditorTarifasML;
  var root = document.querySelector("[data-auditor-tarifas]");
  if (!A || !root) return;

  var XLSX_SRC = "js/vendor/xlsx-0.20.3.mini.min.js";
  var state = { files: [], result: null, filter: "todos" };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") el.textContent = attrs[k];
      else if (k === "class") el.className = attrs[k];
      else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  var xlsxPromise = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromise) xlsxPromise = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = XLSX_SRC; s.async = true;
      s.onload = function () { window.XLSX ? res(window.XLSX) : rej(new Error("SheetJS não carregou")); };
      s.onerror = function () { xlsxPromise = null; rej(new Error("Não consegui carregar o leitor de Excel (js/vendor). Exporte em CSV ou recarregue a página.")); };
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }

  function readBuffer(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(fr.error || new Error("Falha ao ler " + file.name)); };
      fr.readAsArrayBuffer(file);
    });
  }

  function rowsFromBuffer(name, buf) {
    if (A.isXlsxName(name)) {
      return loadXLSX().then(function (X) {
        var wb = X.read(new Uint8Array(buf), { type: "array", cellDates: true });
        return A.sheetRows(X, wb);
      });
    }
    return Promise.resolve(A.parseCSV(A.decodeText(buf)));
  }

  function addFiles(items) {
    return Promise.all(items.map(function (it) {
      return rowsFromBuffer(it.name, it.buf).then(function (rows) {
        return { name: it.name, rows: rows, table: A.buildTable(rows), forced: {} };
      }).catch(function (e) {
        return { name: it.name, rows: [], table: { ok: false, error: e.message, headers: [] }, forced: {} };
      });
    })).then(function (loaded) {
      state.files = state.files.concat(loaded);
      renderFiles();
      maybeRun();
    });
  }

  var thrInput = h("input", { class: "field__input", type: "number", min: "1", max: "100", step: "0.5", value: "20", id: "at-thr", inputmode: "decimal" });
  thrInput.addEventListener("input", maybeRun);
  var status = h("p", { class: "cr-status muted", "data-at-status": "", "aria-live": "polite", text: "Solte o relatório \"Por venda\" (CSV ou Excel). Nada é enviado: a leitura acontece neste aparelho." });
  var out = h("div", { class: "cr-out", "data-at-out": "" });
  var fileList = h("div", { class: "cr-files", "data-at-files": "" });

  var input = h("input", { type: "file", multiple: "multiple", accept: ".csv,.txt,.xlsx,.xls,.xlsm,.ods", id: "at-file", class: "cr-drop__input" });
  var drop = h("label", { class: "cr-drop", for: "at-file" }, [
    h("span", { class: "cr-drop__title", text: "Relatório \"Por venda\" / Faturamento" }),
    h("span", { class: "cr-drop__hint", text: "CSV ou Excel do Mercado Livre (Faturamento → Conciliação → Por vendas). Pode soltar mais de um período." }),
    h("span", { class: "btn btn--ghost cr-drop__btn", text: "Escolher arquivo(s)" }),
    input
  ]);
  input.addEventListener("change", function () {
    var files = Array.prototype.slice.call(input.files || []);
    Promise.all(files.map(function (f) { return readBuffer(f).then(function (b) { return { name: f.name, buf: b }; }); })).then(function (items) { addFiles(items); input.value = ""; });
  });
  ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); }); });
  drop.addEventListener("drop", function (e) {
    var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
    Promise.all(files.map(function (f) { return readBuffer(f).then(function (b) { return { name: f.name, buf: b }; }); })).then(function (items) { addFiles(items); });
  });

  var exampleBtn = h("button", { type: "button", class: "btn btn--solid", text: "Testar com o arquivo de exemplo" });
  exampleBtn.addEventListener("click", function () {
    resetAll();
    status.textContent = "Carregando o exemplo (dados fictícios)…";
    fetch("exemplos/auditor-tarifas-ml-exemplo.csv")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then(function (b) { return addFiles([{ name: "auditor-tarifas-ml-exemplo.csv (EXEMPLO)", buf: b }]); })
      .catch(function (e) { status.textContent = "Não consegui carregar o exemplo: " + e.message; });
  });
  var resetBtn = h("button", { type: "button", class: "btn btn--ghost", text: "Limpar" });
  resetBtn.addEventListener("click", resetAll);

  function resetAll() {
    state.files = []; state.result = null; state.filter = "todos";
    renderFiles(); clear(out); root.removeAttribute("data-state");
    status.textContent = "Solte o relatório \"Por venda\" (CSV ou Excel). Nada é enviado: a leitura acontece neste aparelho.";
  }

  root.appendChild(h("div", { class: "calc cr" }, [
    h("p", { class: "calc__kicker", text: "Auditor de tarifas · 100% no navegador" }),
    h("div", { class: "cr-slot" }, [drop, fileList]),
    h("div", { class: "fields cr-opts" }, [
      h("label", { class: "field" }, [
        h("span", { class: "field__label", text: "Marcar % de tarifas acima de" }),
        thrInput,
        h("span", { class: "field__hint", text: "Padrão 20. Também marca outliers bem acima da mediana do seu próprio arquivo." })
      ])
    ]),
    h("div", { class: "calc__actions" }, [exampleBtn, resetBtn]),
    status,
    out
  ]));

  function renderFiles() {
    clear(fileList);
    state.files.forEach(function (f, idx) {
      var tb = f.table;
      var box = h("div", { class: "cr-file" + (tb.ok ? "" : " is-bad") });
      var rm = h("button", { type: "button", class: "cr-file__rm", "aria-label": "Remover " + f.name, text: "×" });
      rm.addEventListener("click", function () { state.files.splice(idx, 1); renderFiles(); maybeRun(); });
      box.appendChild(h("p", { class: "cr-file__name" }, [h("strong", { text: f.name }), " ", rm]));
      if (!tb.headers || !tb.headers.length) {
        box.appendChild(h("p", { class: "cr-file__err", text: tb.error || "Arquivo vazio." }));
        fileList.appendChild(box); return;
      }
      if (tb.data) box.appendChild(h("p", { class: "cr-file__meta muted", text: tb.data.length + " linha(s) · cabeçalho na linha " + ((tb.headerRow || 0) + 1) }));
      if (tb.error) box.appendChild(h("p", { class: "cr-file__err", text: tb.error }));
      var det = h("details", { class: "cr-map" }, [h("summary", { text: tb.ok ? "Colunas reconhecidas (conferir/ajustar)" : "Escolher colunas manualmente" })]);
      if (!tb.ok) det.setAttribute("open", "open");
      var grid = h("div", { class: "cr-map__grid" });
      A.WANTED.forEach(function (fk) {
        var sel = h("select", { class: "field__input", "data-field": fk });
        sel.appendChild(h("option", { value: "", text: "— não usar —" }));
        tb.headers.forEach(function (hd, i) {
          var o = h("option", { value: String(i), text: hd || "(coluna " + (i + 1) + ")" });
          if (tb.map && tb.map[fk] === i) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () {
          f.forced[fk] = sel.value === "" ? "-1" : sel.value;
          f.table = A.buildTable(f.rows, f.forced);
          renderFiles(); maybeRun();
        });
        grid.appendChild(h("label", { class: "field" }, [h("span", { class: "field__label", text: A.FIELDS[fk].label }), sel]));
      });
      det.appendChild(grid);
      box.appendChild(det);
      fileList.appendChild(box);
    });
  }

  function maybeRun() {
    var okFiles = state.files.filter(function (f) { return f.table.ok; });
    if (!okFiles.length) {
      clear(out); root.removeAttribute("data-state");
      if (state.files.length) status.textContent = "Falta um relatório válido com Número da operação e Valor bruto ou tarifas.";
      return;
    }
    var thr = parseFloat(String(thrInput.value).replace(",", "."));
    var res = A.audit(okFiles.map(function (f) { return f.table; }), { feePctThreshold: isFinite(thr) ? thr : 20 });
    state.result = res;
    status.textContent = "Auditado no seu aparelho: " + res.resumo.operacoes + " operação(ões), " + res.resumo.flagged + " marcada(s). Mediana do lote: " + A.pct(res.medianaPct) + ".";
    renderResult(res);
    root.setAttribute("data-state", "done");
  }

  function row(label, value, cls) {
    return h("li", { class: "breakdown__row" }, [h("span", { text: label }), h("span", { class: cls || "", text: value })]);
  }

  function renderResult(res) {
    clear(out);
    var s = res.resumo, fmt = A.fmt;
    var bad = s.flagged > 0;
    var card = h("div", { class: "result-card" + (bad ? " result-card--loss" : "") }, [
      h("p", { class: "result-card__kicker", text: bad ? "Tarifas para investigar" : "Resultado" }),
      h("p", { class: "result-card__price" + (bad ? " is-loss" : ""), text: String(s.flagged) + " marcada(s)" }),
      h("p", { class: "cr-lead", text: bad
        ? s.alta + " com % acima de " + res.threshold + "% · " + s.outlier + " outlier(s) · " + s.envio + " só envio · " + s.conflito + " conflito(s)."
        : "Nenhuma operação acima do limiar nem outlier vs a mediana do seu arquivo." }),
      h("ul", { class: "breakdown" }, [
        row("% tarifas no lote (sobre bruto)", A.pct(s.feePctGeral) + " · " + fmt(s.totalTarifas)),
        row("Mediana % por operação (vendas)", A.pct(res.medianaPct)),
        row("Operações ok", String(s.ok)),
        row("% alta (acima do limiar)", String(s.alta), s.alta ? "is-loss" : ""),
        row("Outlier vs mediana", String(s.outlier), s.outlier ? "is-loss" : ""),
        row("Só envio (sem venda neste arquivo)", String(s.envio)),
        row("Conflito / conceito duplicado", String(s.conflito), s.conflito ? "is-loss" : ""),
        row("Valor bruto somado", fmt(s.totalBruto))
      ]),
      h("p", { class: "result-card__note", text: "Auditoria aritmética do seu relatório. Não replica a tabela oficial de tarifas do Mercado Livre. Use o Número da operação para abrir reclamação se achar cobrança estranha." })
    ]);
    out.appendChild(card);

    if (res.concepts.length) {
      var ul = h("ul", {});
      res.concepts.forEach(function (c) {
        ul.appendChild(h("li", {}, [
          h("strong", { text: c.label + ": " }),
          document.createTextNode(fmt(c.valor) + " (" + c.linhas + " ocorrência(s) no texto de detalhes/tipo)")
        ]));
      });
      out.appendChild(h("div", { class: "cr-box" }, [
        h("h3", { text: "Resumo por conceito de tarifa" }),
        ul,
        h("p", { class: "muted", text: "Classificação por palavras no texto que o próprio ML colocou em Detalhes de tarifas / Tipo. Conceitos sem match caem em \"Outros\"." })
      ]));
    }

    var counts = {};
    res.rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    var chips = h("div", { class: "presets__row cr-chips" });
    ["todos", "alta", "outlier", "conflito", "envio", "ok"].forEach(function (k) {
      if (k !== "todos" && !counts[k]) return;
      var label = k === "todos" ? "Todas (" + res.rows.length + ")" : A.STATUS[k].label + " (" + counts[k] + ")";
      var b = h("button", { type: "button", class: "chip" + (state.filter === k ? " is-on" : ""), text: label });
      b.addEventListener("click", function () { state.filter = k; renderResult(res); });
      chips.appendChild(b);
    });
    out.appendChild(chips);

    var shown = res.rows.filter(function (r) { return state.filter === "todos" || r.status === state.filter; });
    var tbody = h("tbody");
    shown.slice(0, 2000).forEach(function (r) {
      tbody.appendChild(h("tr", { class: "cr-st--" + r.status }, [
        h("td", { "data-l": "Operação" }, [h("code", { text: r.op })]),
        h("td", { "data-l": "Situação" }, [h("span", { class: "cr-pill cr-pill--" + (r.status === "ok" ? "ok" : "atrasada"), text: A.STATUS[r.status].label })]),
        h("td", { "data-l": "Data", text: A.br(r.dataVenda) }),
        h("td", { "data-l": "Bruto", class: "num", text: fmt(r.bruto) }),
        h("td", { "data-l": "Tarifas", class: "num", text: fmt(r.tarifas) }),
        h("td", { "data-l": "%", class: "num" + (r.status === "alta" || r.status === "outlier" ? " is-loss" : ""), text: A.pct(r.feePct) }),
        h("td", { "data-l": "Motivo", text: r.reasons.length ? r.reasons.join(" · ") : (r.tipos.join(" | ") || "—") })
      ]));
    });
    out.appendChild(h("div", { class: "cr-table-wrap" }, [h("table", { class: "cr-table" }, [
      h("thead", {}, [h("tr", {}, ["Operação", "Situação", "Data", "Bruto", "Tarifas", "%", "Motivo / tipos"].map(function (x) { return h("th", { text: x }); }))]),
      tbody
    ])]));
    if (shown.length > 2000) out.appendChild(h("p", { class: "muted", text: "Mostrando 2.000 de " + shown.length + ". O CSV traz todas." }));

    var dlAll = h("button", { type: "button", class: "btn btn--ghost", text: "Baixar todas (CSV)" });
    dlAll.addEventListener("click", function () {
      var blob = new Blob([A.toCSV(res, false)], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "auditor-tarifas-ml-todas.csv" });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    var dlFlag = h("button", { type: "button", class: "btn btn--solid", text: "Baixar só marcadas (CSV)" });
    dlFlag.addEventListener("click", function () {
      var blob = new Blob([A.toCSV(res, true)], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "auditor-tarifas-ml-marcadas.csv" });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    var pix = h("a", { class: "btn btn--ghost", href: "#pix", text: "Achou cobrança a mais? Apoie com PIX" });
    out.appendChild(h("div", { class: "calc__actions" }, [dlFlag, dlAll, pix]));
  }
})();
