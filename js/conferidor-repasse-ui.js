/* Precifica — UI do Conferidor de repasse ML. Tudo local: FileReader + DOM. Sem envio de dados. */
(function () {
  "use strict";
  var C = window.ConferidorRepasse;
  var root = document.querySelector("[data-conferidor-repasse]");
  if (!C || !root) return;

  var XLSX_SRC = "js/vendor/xlsx-0.20.3.mini.min.js";
  var state = { venda: [], liberacao: [], result: null, filter: "todos" };

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
    if (C.isXlsxName(name)) {
      return loadXLSX().then(function (X) {
        var wb = X.read(new Uint8Array(buf), { type: "array", cellDates: true });
        return C.sheetRows(X, wb);
      });
    }
    return Promise.resolve(C.parseCSV(C.decodeText(buf)));
  }

  function addFiles(kind, items) {
    // items: [{name, buf}]
    return Promise.all(items.map(function (it) {
      return rowsFromBuffer(it.name, it.buf).then(function (rows) {
        return { name: it.name, rows: rows, table: C.buildTable(rows, kind), forced: {} };
      }).catch(function (e) {
        return { name: it.name, rows: [], table: { ok: false, error: e.message, headers: [] }, forced: {} };
      });
    })).then(function (loaded) {
      state[kind] = state[kind].concat(loaded);
      renderFiles(kind);
      maybeRun();
    });
  }

  // ---------- montagem ----------
  var ui = {};
  function slot(kind, title, hint) {
    var input = h("input", { type: "file", multiple: "multiple", accept: ".csv,.txt,.xlsx,.xls,.xlsm,.ods", id: "cr-file-" + kind, "data-cr-input": kind, class: "cr-drop__input" });
    var list = h("div", { class: "cr-files", "data-cr-files": kind });
    var drop = h("label", { class: "cr-drop", for: "cr-file-" + kind }, [
      h("span", { class: "cr-drop__title", text: title }),
      h("span", { class: "cr-drop__hint", text: hint }),
      h("span", { class: "btn btn--ghost cr-drop__btn", text: "Escolher arquivo(s)" }),
      input
    ]);
    input.addEventListener("change", function () {
      var files = Array.prototype.slice.call(input.files || []);
      Promise.all(files.map(function (f) { return readBuffer(f).then(function (b) { return { name: f.name, buf: b }; }); })).then(function (items) { addFiles(kind, items); input.value = ""; });
    });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); }); });
    drop.addEventListener("drop", function (e) {
      var files = Array.prototype.slice.call((e.dataTransfer && e.dataTransfer.files) || []);
      Promise.all(files.map(function (f) { return readBuffer(f).then(function (b) { return { name: f.name, buf: b }; }); })).then(function (items) { addFiles(kind, items); });
    });
    ui[kind] = list;
    return h("div", { class: "cr-slot" }, [drop, list]);
  }

  var lateInput = h("input", { class: "field__input", type: "number", min: "1", max: "365", step: "1", value: "40", id: "cr-late", inputmode: "numeric" });
  var refInput = h("input", { class: "field__input", type: "date", id: "cr-ref" });
  lateInput.addEventListener("input", maybeRun);
  refInput.addEventListener("change", maybeRun);
  var status = h("p", { class: "cr-status muted", "data-cr-status": "", "aria-live": "polite", text: "Solte os dois relatórios para começar. Nada é enviado: a leitura acontece neste aparelho." });
  var out = h("div", { class: "cr-out", "data-cr-out": "" });

  var exampleBtn = h("button", { type: "button", class: "btn btn--solid", "data-cr-example": "", text: "Testar com o arquivo de exemplo" });
  exampleBtn.addEventListener("click", function () {
    resetAll();
    status.textContent = "Carregando o exemplo (dados fictícios)…";
    var files = [["venda", "exemplos/conferidor-ml-exemplo-por-venda.csv"], ["liberacao", "exemplos/conferidor-ml-exemplo-por-liberacao.csv"]];
    Promise.all(files.map(function (f) {
      return fetch(f[1]).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); }).then(function (b) { return addFiles(f[0], [{ name: f[1].split("/").pop() + " (EXEMPLO)", buf: b }]); });
    })).catch(function (e) { status.textContent = "Não consegui carregar o exemplo: " + e.message; });
  });
  var resetBtn = h("button", { type: "button", class: "btn btn--ghost", text: "Limpar" });
  resetBtn.addEventListener("click", function () { resetAll(); });

  function resetAll() {
    state.venda = []; state.liberacao = []; state.result = null; state.filter = "todos";
    renderFiles("venda"); renderFiles("liberacao"); clear(out); root.removeAttribute("data-state");
    status.textContent = "Solte os dois relatórios para começar. Nada é enviado: a leitura acontece neste aparelho.";
  }

  root.appendChild(h("div", { class: "calc cr" }, [
    h("p", { class: "calc__kicker", text: "Conferidor · 100% no navegador" }),
    h("div", { class: "cr-slots" }, [
      slot("venda", "1. Relatório \"Por venda\"", "CSV ou Excel. Pode soltar mais de um arquivo (ex.: dois períodos)."),
      slot("liberacao", "2. Relatório \"Por liberação de dinheiro\"", "Do mesmo mês e do seguinte. Também aceita o relatório de liberações do Mercado Pago.")
    ]),
    h("div", { class: "fields cr-opts" }, [
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Considerar atrasada após (dias)" }), lateInput, h("span", { class: "field__hint", text: "Contados da data da venda até a data de referência." })]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Data de referência (opcional)" }), refInput, h("span", { class: "field__hint", text: "Vazio = a data mais recente encontrada nos arquivos." })])
    ]),
    h("div", { class: "calc__actions" }, [exampleBtn, resetBtn]),
    status,
    out
  ]));

  // ---------- arquivos e mapeamento ----------
  function fieldsFor(kind) { return kind === "liberacao" ? C.RELEASE_FIELDS : C.SALES_FIELDS; }

  function renderFiles(kind) {
    var list = ui[kind]; clear(list);
    state[kind].forEach(function (f, idx) {
      var tb = f.table;
      var box = h("div", { class: "cr-file" + (tb.ok ? "" : " is-bad") });
      var rm = h("button", { type: "button", class: "cr-file__rm", "aria-label": "Remover " + f.name, text: "×" });
      rm.addEventListener("click", function () { state[kind].splice(idx, 1); renderFiles(kind); maybeRun(); });
      box.appendChild(h("p", { class: "cr-file__name" }, [h("strong", { text: f.name }), " ", rm]));
      if (!tb.headers || !tb.headers.length) {
        box.appendChild(h("p", { class: "cr-file__err", text: tb.error || "Arquivo vazio." }));
        list.appendChild(box); return;
      }
      if (tb.data) box.appendChild(h("p", { class: "cr-file__meta muted", text: tb.data.length + " linha(s) · cabeçalho na linha " + ((tb.headerRow || 0) + 1) }));
      if (tb.error) box.appendChild(h("p", { class: "cr-file__err", text: tb.error }));
      var det = h("details", { class: "cr-map" }, [h("summary", { text: tb.ok ? "Colunas reconhecidas (conferir/ajustar)" : "Escolher colunas manualmente" })]);
      if (!tb.ok) det.setAttribute("open", "open");
      var grid = h("div", { class: "cr-map__grid" });
      fieldsFor(kind).forEach(function (fk) {
        if (fk === "recordType" || fk === "credito" || fk === "debito") { if (tb.map && tb.map[fk] == null) return; }
        var sel = h("select", { class: "field__input", "data-field": fk });
        sel.appendChild(h("option", { value: "", text: "— não usar —" }));
        tb.headers.forEach(function (hd, i) { var o = h("option", { value: String(i), text: hd || "(coluna " + (i + 1) + ")" }); if (tb.map && tb.map[fk] === i) o.selected = true; sel.appendChild(o); });
        sel.addEventListener("change", function () {
          f.forced[fk] = sel.value === "" ? "-1" : sel.value;
          f.table = C.buildTable(f.rows, kind, f.forced);
          renderFiles(kind); maybeRun();
        });
        grid.appendChild(h("label", { class: "field" }, [h("span", { class: "field__label", text: C.FIELDS[fk].label }), sel]));
      });
      det.appendChild(grid);
      box.appendChild(det);
      list.appendChild(box);
    });
  }

  // ---------- conferência ----------
  function maybeRun() {
    var v = state.venda.filter(function (f) { return f.table.ok; });
    var l = state.liberacao.filter(function (f) { return f.table.ok; });
    if (!v.length || !l.length) {
      clear(out); root.removeAttribute("data-state");
      if (state.venda.length || state.liberacao.length) status.textContent = !v.length ? "Falta um relatório \"Por venda\" válido." : "Falta um relatório \"Por liberação de dinheiro\" válido.";
      return;
    }
    var late = parseInt(lateInput.value, 10);
    var res = C.reconcile(C.analyzeSales(v.map(function (f) { return f.table; })), C.analyzeReleases(l.map(function (f) { return f.table; })), { lateDays: isFinite(late) && late > 0 ? late : 40, refDate: refInput.value || null });
    state.result = res;
    status.textContent = "Conferido no seu aparelho: " + res.resumo.vendas + " venda(s), " + res.resumo.operacoes + " operação(ões). Referência: " + C.br(res.refDate) + ".";
    renderResult(res);
    root.setAttribute("data-state", "done");
  }

  function row(label, value, cls) {
    return h("li", { class: "breakdown__row" }, [h("span", { text: label }), h("span", { class: cls || "", text: value })]);
  }

  function renderResult(res) {
    clear(out);
    var s = res.resumo, fmt = C.fmt;
    var bad = s.atrasadas > 0 || s.aMenos > 0;
    var card = h("div", { class: "result-card" + (bad ? " result-card--loss" : ""), "data-cr-summary": "" }, [
      h("p", { class: "result-card__kicker", text: bad ? "Dinheiro para investigar" : "Resultado" }),
      h("p", { class: "result-card__price" + (bad ? " is-loss" : ""), "data-cr-total": "", text: fmt(s.atrasadoValor + s.aMenos) }),
      h("p", { class: "cr-lead", text: bad
        ? s.atrasadas + " venda(s) sem liberação há mais de " + res.lateDays + " dias (" + fmt(s.atrasadoValor) + ")" + (s.aMenos > 0 ? " + " + fmt(s.aMenos) + " liberado(s) a menos que o esperado." : ".")
        : "Nenhuma venda atrasada e nenhuma liberação a menos no período conferido." }),
      h("ul", { class: "breakdown" }, [
        row("Bate (liberado = esperado)", String(s.ok)),
        row("Sem liberação, atrasada", s.atrasadas + " · " + fmt(s.atrasadoValor), s.atrasadas ? "is-loss" : ""),
        row("Liberado com diferença", s.diferencas + " · " + fmt(s.diferencaValor), s.diferencas ? "is-loss" : ""),
        row("Aguardando (dentro do prazo)", s.aguardando + " · " + fmt(s.aguardandoValor)),
        row("Cancelada / zerada", String(s.zeradas)),
        row("Cobrança sem débito na liberação", s.cobrancas + " · " + fmt(s.cobrancaValor)),
        row("Só na liberação (outro período)", s.soLiberacao + " · " + fmt(s.soLiberacaoValor)),
        row("Tarifas sobre o valor bruto", s.tarifaPctBruto == null ? "—" : String(s.tarifaPctBruto).replace(".", ",") + "% (" + fmt(s.tarifas) + ")")
      ]),
      h("p", { class: "result-card__note", text: "Conferência aritmética dos seus próprios relatórios. Não substitui a contabilidade nem o atendimento do Mercado Livre: use a lista abaixo para abrir a reclamação com o Número da operação em mãos." })
    ]);
    out.appendChild(card);

    if (res.checks.length) {
      out.appendChild(h("div", { class: "cr-box cr-box--warn", "data-cr-checks": "" }, [
        h("h3", { text: "Contas que não fecham dentro do relatório (" + res.checks.length + ")" }),
        h("ul", {}, res.checks.slice(0, 200).map(function (c) { return h("li", {}, [h("code", { text: c.op }), " " + c.msg]); }))
      ]));
    }
    if (res.avisos.length) {
      out.appendChild(h("div", { class: "cr-box" }, [h("h3", { text: "Avisos" }), h("ul", {}, res.avisos.map(function (a) { return h("li", { text: a }); }))]));
    }

    // filtros
    var counts = {}; res.rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    var chips = h("div", { class: "presets__row cr-chips" });
    var order = ["todos", "atrasada", "diferenca", "cobranca", "aguardando", "so_liberacao", "zerada", "ok"];
    order.forEach(function (k) {
      if (k !== "todos" && !counts[k]) return;
      var label = k === "todos" ? "Todas (" + res.rows.length + ")" : C.STATUS[k].label + " (" + counts[k] + ")";
      var b = h("button", { type: "button", class: "chip" + (state.filter === k ? " is-on" : ""), text: label });
      b.addEventListener("click", function () { state.filter = k; renderResult(res); });
      chips.appendChild(b);
    });
    out.appendChild(chips);

    var shown = res.rows.filter(function (r) { return state.filter === "todos" || r.status === state.filter; });
    var tbody = h("tbody");
    shown.slice(0, 2000).forEach(function (r) {
      tbody.appendChild(h("tr", { class: "cr-st--" + r.status, "data-status": r.status }, [
        h("td", { "data-l": "Operação" }, [h("code", { text: r.op })]),
        h("td", { "data-l": "Situação" }, [h("span", { class: "cr-pill cr-pill--" + r.status, text: C.STATUS[r.status].label })]),
        h("td", { "data-l": "Venda", text: C.br(r.dataVenda) }),
        h("td", { "data-l": "Liberação", text: C.br(r.dataLib) }),
        h("td", { "data-l": "Esperado", class: "num", text: fmt(r.esperado) }),
        h("td", { "data-l": "Liberado", class: "num", text: fmt(r.liberado) }),
        h("td", { "data-l": "Diferença", class: "num" + (r.diferenca < 0 ? " is-loss" : ""), text: r.diferenca == null ? (r.idade != null ? r.idade + " dias" : "—") : fmt(r.diferenca) })
      ]));
    });
    out.appendChild(h("div", { class: "cr-table-wrap" }, [h("table", { class: "cr-table", "data-cr-table": "" }, [
      h("thead", {}, [h("tr", {}, ["Operação", "Situação", "Venda", "Liberação", "Esperado", "Liberado", "Diferença / dias"].map(function (x) { return h("th", { text: x }); }))]),
      tbody
    ])]));
    if (shown.length > 2000) out.appendChild(h("p", { class: "muted", text: "Mostrando 2.000 de " + shown.length + ". O CSV traz todas." }));

    var dl = h("button", { type: "button", class: "btn btn--solid", "data-cr-download": "", text: "Baixar resultado (CSV)" });
    dl.addEventListener("click", function () {
      var blob = new Blob([C.toCSV(res)], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "conferencia-repasse-ml.csv" });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    var pix = h("a", { class: "btn btn--ghost", href: "#pix", text: "Achou dinheiro? Apoie com PIX" });
    out.appendChild(h("div", { class: "calc__actions" }, [dl, pix]));
  }
})();
