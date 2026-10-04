/* Precifica — UI Aging Full. Tudo local: FileReader + DOM. Sem envio de dados. */
(function () {
  "use strict";
  var A = window.FullAgingEstoque;
  var root = document.querySelector("[data-full-aging]");
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

  function rateInput(key, label) {
    var inp = h("input", { class: "field__input", type: "number", min: "0", step: "0.001", value: String(A.DEFAULT_RATES[key]), id: "fa-rate-" + key, inputmode: "decimal", "data-porte": key });
    inp.addEventListener("input", maybeRun);
    return h("label", { class: "field" }, [
      h("span", { class: "field__label", text: label }),
      inp,
      h("span", { class: "field__hint", text: "R$/un/dia (editável)" })
    ]);
  }

  var rateP = rateInput("pequeno", "Pequeno");
  var rateM = rateInput("medio", "Médio");
  var rateG = rateInput("grande", "Grande");
  var rateX = rateInput("extragrande", "Extragrande");

  var status = h("p", { class: "cr-status muted", "data-fa-status": "", "aria-live": "polite", text: "Solte o Excel/CSV do Full (Controle de estoque ou Relatório geral). Nada é enviado: a leitura acontece neste aparelho." });
  var out = h("div", { class: "cr-out", "data-fa-out": "" });
  var fileList = h("div", { class: "cr-files", "data-fa-files": "" });

  var input = h("input", { type: "file", multiple: "multiple", accept: ".csv,.txt,.xlsx,.xls,.xlsm,.ods", id: "fa-file", class: "cr-drop__input" });
  var drop = h("label", { class: "cr-drop", for: "fa-file" }, [
    h("span", { class: "cr-drop__title", text: "Relatório de estoque Full" }),
    h("span", { class: "cr-drop__hint", text: "Excel ou CSV do painel (Anúncios → Gestão de estoque Full → Controle de estoque / Relatório geral). Pode soltar mais de um arquivo." }),
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
    fetch("exemplos/full-aging-estoque-exemplo.csv")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
      .then(function (b) { return addFiles([{ name: "full-aging-estoque-exemplo.csv (EXEMPLO)", buf: b }]); })
      .catch(function (e) { status.textContent = "Não consegui carregar o exemplo: " + e.message; });
  });
  var resetBtn = h("button", { type: "button", class: "btn btn--ghost", text: "Limpar" });
  resetBtn.addEventListener("click", resetAll);

  function resetAll() {
    state.files = []; state.result = null; state.filter = "todos";
    renderFiles(); clear(out); root.removeAttribute("data-state");
    status.textContent = "Solte o Excel/CSV do Full (Controle de estoque ou Relatório geral). Nada é enviado: a leitura acontece neste aparelho.";
  }

  root.appendChild(h("div", { class: "calc cr" }, [
    h("p", { class: "calc__kicker", text: "Aging Full · 100% no navegador" }),
    h("div", { class: "cr-slot" }, [drop, fileList]),
    h("div", { class: "fields cr-opts" }, [
      h("p", { class: "field__hint", text: "Diárias de referência (página oficial Full). Ajuste se a sua fatura mostrar outros valores." }),
      rateP, rateM, rateG, rateX
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

  function readRates() {
    var rates = {};
    ["pequeno", "medio", "grande", "extragrande"].forEach(function (k) {
      var el = document.getElementById("fa-rate-" + k);
      var v = el ? parseFloat(String(el.value).replace(",", ".")) : NaN;
      rates[k] = isFinite(v) && v >= 0 ? v : A.DEFAULT_RATES[k];
    });
    return rates;
  }

  function maybeRun() {
    var okFiles = state.files.filter(function (f) { return f.table.ok; });
    if (!okFiles.length) {
      clear(out); root.removeAttribute("data-state");
      if (state.files.length) status.textContent = "Falta um arquivo válido com SKU/título, unidades e dias no CD (ou data de entrada).";
      return;
    }
    var res = A.analyze(okFiles.map(function (f) { return f.table; }), { rates: readRates() });
    state.result = res;
    status.textContent = "Analisado no seu aparelho: " + res.resumo.skus + " SKU(s), " + res.resumo.flagged + " com alerta · custo estimado/mês R$ " + A.fmt(res.resumo.custoMes) + ".";
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
      h("p", { class: "result-card__kicker", text: bad ? "Estoque para agir" : "Resultado" }),
      h("p", { class: "result-card__price" + (bad ? " is-loss" : ""), text: "R$ " + fmt(s.custoMes) + "/mês est." }),
      h("p", { class: "cr-lead", text: bad
        ? s.flagged + " SKU(s) em alerta/antigo/sem venda · " + s.unidades + " un. no Full · " + s.skus + " SKU(s) no arquivo."
        : s.skus + " SKU(s), " + s.unidades + " un. — nenhum no limiar de estoque antigo com as diárias atuais." }),
      h("ul", { class: "breakdown" }, [
        row("Custo estimado / dia", "R$ " + fmt(s.custoDia)),
        row("Custo estimado / mês (×30)", "R$ " + fmt(s.custoMes)),
        row("SKUs marcados", String(s.flagged), s.flagged ? "is-loss" : ""),
        row("Sem venda no período", String(s.semVenda)),
        row("Linhas ignoradas (sem qty/dias)", String(s.skipped)),
        row("Limiar antigo (geral / supermercado)", s.antigoGeralDias + " / " + s.antigoSuperDias + " dias")
      ]),
      h("p", { class: "result-card__note", text: "Estimativa com diárias editáveis (referência da página Full). O valor cobrado na fatura pode diferir por porte real, descontos e regras vigentes — use o painel \"Custos por estoque antigo\" do ML para confirmar." })
    ]);
    out.appendChild(card);

    if (res.buckets && res.buckets.length) {
      var ul = h("ul", {});
      res.buckets.forEach(function (b) {
        if (!b.skus) return;
        ul.appendChild(h("li", {}, [
          h("strong", { text: b.label + ": " }),
          document.createTextNode(b.skus + " SKU · " + b.unidades + " un. · ~R$ " + fmt(b.custoMes) + "/mês")
        ]));
      });
      out.appendChild(h("div", { class: "cr-box" }, [
        h("h3", { text: "Resumo por faixa de aging" }),
        ul,
        h("p", { class: "muted", text: "Faixas calculadas a partir de \"Dias no CD\" ou da data de entrada vs. hoje." })
      ]));
    }

    var counts = {};
    res.rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    var chips = h("div", { class: "presets__row cr-chips" });
    ["todos", "antigo", "alerta", "sem_venda", "ok"].forEach(function (k) {
      if (k !== "todos" && !counts[k]) return;
      var label = k === "todos" ? "Todos (" + res.rows.length + ")" : A.STATUS[k].label + " (" + counts[k] + ")";
      var b = h("button", { type: "button", class: "chip" + (state.filter === k ? " is-on" : ""), text: label });
      b.addEventListener("click", function () { state.filter = k; renderResult(res); });
      chips.appendChild(b);
    });
    out.appendChild(chips);

    var shown = res.rows.filter(function (r) { return state.filter === "todos" || r.status === state.filter; });
    var tbody = h("tbody");
    shown.slice(0, 2000).forEach(function (r) {
      tbody.appendChild(h("tr", { class: "cr-st--" + (r.status === "ok" ? "ok" : "atrasada") }, [
        h("td", { "data-l": "SKU" }, [h("code", { text: r.sku })]),
        h("td", { "data-l": "Situação" }, [h("span", { class: "cr-pill cr-pill--" + (r.status === "ok" ? "ok" : "atrasada"), text: A.STATUS[r.status].label })]),
        h("td", { "data-l": "Un.", class: "num", text: String(r.unidades) }),
        h("td", { "data-l": "Porte", text: r.porte }),
        h("td", { "data-l": "Dias", class: "num", text: String(r.dias) }),
        h("td", { "data-l": "Faixa", text: r.bucketLabel }),
        h("td", { "data-l": "R$/mês", class: "num" + (r.status === "antigo" ? " is-loss" : ""), text: fmt(r.custoMes) }),
        h("td", { "data-l": "Motivo", text: r.reasons.length ? r.reasons.join(" · ") : (r.titulo || "—") })
      ]));
    });
    out.appendChild(h("div", { class: "cr-table-wrap" }, [h("table", { class: "cr-table" }, [
      h("thead", {}, [h("tr", {}, ["SKU", "Situação", "Un.", "Porte", "Dias", "Faixa", "R$/mês est.", "Motivo / título"].map(function (x) { return h("th", { text: x }); }))]),
      tbody
    ])]));
    if (shown.length > 2000) out.appendChild(h("p", { class: "muted", text: "Mostrando 2.000 de " + shown.length + ". O CSV traz todas." }));

    var dlAll = h("button", { type: "button", class: "btn btn--ghost", text: "Baixar todas (CSV)" });
    dlAll.addEventListener("click", function () {
      var blob = new Blob([A.toCSV(res, false)], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "full-aging-estoque-todas.csv" });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    var dlFlag = h("button", { type: "button", class: "btn btn--solid", text: "Baixar só marcadas (CSV)" });
    dlFlag.addEventListener("click", function () {
      var blob = new Blob([A.toCSV(res, true)], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "full-aging-estoque-marcadas.csv" });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    var pix = h("a", { class: "btn btn--ghost", href: "#pix", text: "Achou SKU encalhado? Apoie com PIX" });
    out.appendChild(h("div", { class: "calc__actions" }, [dlFlag, dlAll, pix]));
  }
})();
