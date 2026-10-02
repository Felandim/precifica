/* Precifica — UI Extrato × saques MP. Tudo local: FileReader + DOM. Sem envio de dados. */
(function () {
  "use strict";
  var E = window.ExtratoSaquesMP;
  var root = document.querySelector("[data-extrato-saques]");
  if (!E || !root) return;

  var XLSX_SRC = "js/vendor/xlsx-0.20.3.mini.min.js";
  var state = {
    banco: [], // {name, rows|ofx, table?, ofxTxns?, forced}
    saque: [],
    result: null,
    filter: "todos",
    onlyMP: true,
    windowDays: 2
  };

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
      s.onerror = function () { xlsxPromise = null; rej(new Error("Não consegui carregar o leitor de Excel.")); };
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

  function loadBankItem(name, buf) {
    if (E.isOfxName(name)) {
      var txns = E.parseOFX(E.decodeText(buf));
      return {
        name: name,
        rows: [],
        ofxTxns: txns,
        table: { ok: txns.length > 0, error: txns.length ? null : "OFX sem STMTTRN legível.", headers: ["OFX"], data: [], kind: "banco" },
        forced: {},
        kind: "banco"
      };
    }
    if (E.isXlsxName(name)) {
      return loadXLSX().then(function (X) {
        var wb = X.read(new Uint8Array(buf), { type: "array", cellDates: true });
        var rows = E.sheetRows(X, wb);
        return { name: name, rows: rows, ofxTxns: null, table: E.buildBankTable(rows), forced: {}, kind: "banco" };
      });
    }
    var rows = E.parseCSV(E.decodeText(buf));
    return Promise.resolve({ name: name, rows: rows, ofxTxns: null, table: E.buildBankTable(rows), forced: {}, kind: "banco" });
  }

  function loadSaqueItem(name, buf) {
    if (E.isXlsxName(name)) {
      return loadXLSX().then(function (X) {
        var wb = X.read(new Uint8Array(buf), { type: "array", cellDates: true });
        var rows = E.sheetRows(X, wb);
        return { name: name, rows: rows, table: E.buildSaqueTable(rows), forced: {}, kind: "saque" };
      });
    }
    var rows = E.parseCSV(E.decodeText(buf));
    return Promise.resolve({ name: name, rows: rows, table: E.buildSaqueTable(rows), forced: {}, kind: "saque" });
  }

  function addFiles(kind, items) {
    return Promise.all(items.map(function (it) {
      var p = kind === "banco" ? loadBankItem(it.name, it.buf) : loadSaqueItem(it.name, it.buf);
      return Promise.resolve(p).catch(function (e) {
        return { name: it.name, rows: [], table: { ok: false, error: e.message, headers: [] }, forced: {}, kind: kind };
      });
    })).then(function (loaded) {
      state[kind] = state[kind].concat(loaded);
      renderFiles(kind);
      maybeRun();
    });
  }

  var ui = {};
  function slot(kind, title, hint, accept) {
    var input = h("input", { type: "file", multiple: "multiple", accept: accept, id: "es-file-" + kind, class: "cr-drop__input" });
    var list = h("div", { class: "cr-files", "data-es-files": kind });
    var drop = h("label", { class: "cr-drop", for: "es-file-" + kind }, [
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

  var winInput = h("input", { class: "field__input", type: "number", min: "0", max: "30", step: "1", value: "2", id: "es-window", inputmode: "numeric" });
  var onlyMpCheck = h("input", { type: "checkbox", id: "es-onlymp", checked: "checked" });
  winInput.addEventListener("input", function () { state.windowDays = parseInt(winInput.value, 10) || 0; maybeRun(); });
  onlyMpCheck.addEventListener("change", function () { state.onlyMP = onlyMpCheck.checked; maybeRun(); });

  var status = h("p", { class: "cr-status muted", "aria-live": "polite", text: "Solte o extrato do banco e o relatório de saques do Mercado Pago. Nada é enviado." });
  var out = h("div", { class: "cr-out" });

  var exampleBtn = h("button", { type: "button", class: "btn btn--solid", text: "Testar com o arquivo de exemplo" });
  exampleBtn.addEventListener("click", function () {
    resetAll();
    status.textContent = "Carregando o exemplo (dados fictícios)…";
    var files = [
      ["banco", "exemplos/extrato-banco-exemplo.csv"],
      ["saque", "exemplos/saques-mp-exemplo.csv"]
    ];
    Promise.all(files.map(function (f) {
      return fetch(f[1]).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
        .then(function (b) { return addFiles(f[0], [{ name: f[1].split("/").pop() + " (EXEMPLO)", buf: b }]); });
    })).catch(function (e) { status.textContent = "Não consegui carregar o exemplo: " + e.message; });
  });
  var resetBtn = h("button", { type: "button", class: "btn btn--ghost", text: "Limpar" });
  resetBtn.addEventListener("click", resetAll);

  function resetAll() {
    state.banco = []; state.saque = []; state.result = null; state.filter = "todos";
    renderFiles("banco"); renderFiles("saque"); clear(out); root.removeAttribute("data-state");
    status.textContent = "Solte o extrato do banco e o relatório de saques do Mercado Pago. Nada é enviado.";
  }

  root.appendChild(h("div", { class: "calc cr" }, [
    h("p", { class: "calc__kicker", text: "Batimento bancário · 100% no navegador" }),
    h("div", { class: "cr-slots" }, [
      slot("banco", "1. Extrato do banco", "CSV, Excel ou OFX. Pode soltar mais de um período.", ".csv,.txt,.xlsx,.xls,.xlsm,.ods,.ofx,.qfx"),
      slot("saque", "2. Saques / transferências do Mercado Pago", "CSV ou Excel do relatório de liberações/saques (linhas de withdrawal/saque/transferência).", ".csv,.txt,.xlsx,.xls,.xlsm,.ods")
    ]),
    h("div", { class: "fields cr-opts" }, [
      h("label", { class: "field" }, [
        h("span", { class: "field__label", text: "Janela de datas (dias)" }),
        winInput,
        h("span", { class: "field__hint", text: "Diferença máxima entre a data do saque no MP e o crédito no banco (padrão 2)." })
      ]),
      h("label", { class: "field", style: "display:flex;align-items:flex-start;gap:8px;margin-top:8px" }, [
        onlyMpCheck,
        h("span", {}, [
          h("span", { class: "field__label", text: "No extrato, considerar só créditos que parecem Mercado Pago" }),
          h("span", { class: "field__hint", text: "Desmarque se o seu banco não escreve “Mercado Pago” na descrição (aí todos os créditos entram no cruzamento)." })
        ])
      ])
    ]),
    h("div", { class: "calc__actions" }, [exampleBtn, resetBtn]),
    status,
    out
  ]));

  function fieldsFor(kind) {
    return kind === "banco" ? ["data", "valor", "desc", "creditoCol", "debito"] : ["data", "valor", "credito", "debito", "desc", "id"];
  }
  function fieldBook(kind) { return kind === "banco" ? E.BANK_FIELDS : E.SAQUE_FIELDS; }

  function renderFiles(kind) {
    var list = ui[kind]; clear(list);
    state[kind].forEach(function (f, idx) {
      var tb = f.table;
      var box = h("div", { class: "cr-file" + (tb.ok ? "" : " is-bad") });
      var rm = h("button", { type: "button", class: "cr-file__rm", "aria-label": "Remover " + f.name, text: "×" });
      rm.addEventListener("click", function () { state[kind].splice(idx, 1); renderFiles(kind); maybeRun(); });
      box.appendChild(h("p", { class: "cr-file__name" }, [h("strong", { text: f.name }), " ", rm]));
      if (f.ofxTxns) {
        box.appendChild(h("p", { class: "cr-file__meta muted", text: f.ofxTxns.length + " lançamento(s) OFX" }));
        if (tb.error) box.appendChild(h("p", { class: "cr-file__err", text: tb.error }));
        list.appendChild(box); return;
      }
      if (!tb.headers || !tb.headers.length) {
        box.appendChild(h("p", { class: "cr-file__err", text: tb.error || "Arquivo vazio." }));
        list.appendChild(box); return;
      }
      if (tb.data) box.appendChild(h("p", { class: "cr-file__meta muted", text: tb.data.length + " linha(s) · cabeçalho na linha " + ((tb.headerRow || 0) + 1) }));
      if (tb.error) box.appendChild(h("p", { class: "cr-file__err", text: tb.error }));
      var det = h("details", { class: "cr-map" }, [h("summary", { text: tb.ok ? "Colunas reconhecidas (conferir/ajustar)" : "Escolher colunas manualmente" })]);
      if (!tb.ok) det.setAttribute("open", "open");
      var grid = h("div", { class: "cr-map__grid" });
      var book = fieldBook(kind);
      fieldsFor(kind).forEach(function (fk) {
        if ((fk === "creditoCol" || fk === "debito" || fk === "credito" || fk === "id") && tb.map && tb.map[fk] == null) return;
        var sel = h("select", { class: "field__input", "data-field": fk });
        sel.appendChild(h("option", { value: "", text: "— não usar —" }));
        tb.headers.forEach(function (hd, i) {
          var o = h("option", { value: String(i), text: hd || "(coluna " + (i + 1) + ")" });
          if (tb.map && tb.map[fk] === i) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function () {
          f.forced[fk] = sel.value === "" ? "-1" : sel.value;
          f.table = kind === "banco" ? E.buildBankTable(f.rows, f.forced) : E.buildSaqueTable(f.rows, f.forced);
          renderFiles(kind); maybeRun();
        });
        grid.appendChild(h("label", { class: "field" }, [h("span", { class: "field__label", text: book[fk].label }), sel]));
      });
      det.appendChild(grid);
      box.appendChild(det);
      list.appendChild(box);
    });
  }

  function maybeRun() {
    var banksOk = state.banco.filter(function (f) { return f.table && f.table.ok; });
    var saquesOk = state.saque.filter(function (f) { return f.table && f.table.ok; });
    if (!banksOk.length || !saquesOk.length) {
      clear(out); root.removeAttribute("data-state");
      if (state.banco.length || state.saque.length) {
        status.textContent = !banksOk.length ? "Falta um extrato bancário válido." : "Falta um relatório de saques válido.";
      }
      return;
    }
    var ofxTxns = [];
    banksOk.forEach(function (f) { if (f.ofxTxns) ofxTxns = ofxTxns.concat(f.ofxTxns); });
    var bankTables = banksOk.filter(function (f) { return !f.ofxTxns; }).map(function (f) { return f.table; });
    var bank = E.extractBankCredits(bankTables, ofxTxns, { onlyMP: state.onlyMP });
    var sq = E.extractSaques(saquesOk.map(function (f) { return f.table; }), { onlySaqueHints: true });
    var win = parseInt(winInput.value, 10);
    var res = E.reconcile(sq.saques, bank.credits, { windowDays: isFinite(win) && win >= 0 ? win : 2 });
    res.meta = {
      creditos: bank.credits.length,
      saques: sq.saques.length,
      ignoredBank: bank.ignored,
      usadasHints: sq.usadasHints
    };
    state.result = res;
    status.textContent = "Conferido no seu aparelho: " + sq.saques.length + " saque(s) × " + bank.credits.length + " crédito(s)" +
      (state.onlyMP ? " com cara de Mercado Pago" : "") + ". Janela: " + res.windowDays + " dia(s).";
    renderResult(res);
    root.setAttribute("data-state", "done");
  }

  var STATUS = {
    ok: { label: "Casado", pill: "ok" },
    saque_sem_credito: { label: "Saque sem crédito no banco", pill: "atrasada" },
    credito_sem_saque: { label: "Crédito MP sem saque", pill: "diferenca" }
  };

  function renderResult(res) {
    clear(out);
    var bad = res.counts.saque_sem_credito > 0 || res.counts.credito_sem_saque > 0;
    var card = h("div", { class: "result-card" + (bad ? " result-card--loss" : "") }, [
      h("p", { class: "result-card__kicker", text: bad ? "Divergências no batimento" : "Resultado" }),
      h("p", { class: "result-card__price" + (bad ? " is-loss" : ""), text: E.formatBRL(res.totais.saquesSemCredito + res.totais.creditosSemSaque) }),
      h("p", { class: "cr-lead", text: bad
        ? (res.counts.saque_sem_credito ? res.counts.saque_sem_credito + " saque(s) sem crédito (" + E.formatBRL(res.totais.saquesSemCredito) + ")" : "") +
          (res.counts.saque_sem_credito && res.counts.credito_sem_saque ? " · " : "") +
          (res.counts.credito_sem_saque ? res.counts.credito_sem_saque + " crédito(s) no banco sem saque correspondente (" + E.formatBRL(res.totais.creditosSemSaque) + ")" : "") + "."
        : "Todos os saques casaram com um crédito no extrato, dentro da janela e da tolerância de R$ 0,05." }),
      h("ul", { class: "breakdown" }, [
        h("li", { class: "breakdown__row" }, [h("span", { text: "Casados" }), h("span", { text: res.counts.ok + " · " + E.formatBRL(res.totais.casados) })]),
        h("li", { class: "breakdown__row" }, [h("span", { text: "Saque sem crédito" }), h("span", { class: res.counts.saque_sem_credito ? "is-loss" : "", text: res.counts.saque_sem_credito + " · " + E.formatBRL(res.totais.saquesSemCredito) })]),
        h("li", { class: "breakdown__row" }, [h("span", { text: "Crédito MP sem saque" }), h("span", { class: res.counts.credito_sem_saque ? "is-loss" : "", text: res.counts.credito_sem_saque + " · " + E.formatBRL(res.totais.creditosSemSaque) })])
      ]),
      h("p", { class: "result-card__note", text: "Batimento aritmético dos seus arquivos. Não é conciliação contábil oficial. Se um saque não caiu, confira no Mercado Pago e no banco com a data e o valor em mãos." })
    ]);
    out.appendChild(card);

    if (res.meta && res.meta.usadasHints) {
      out.appendChild(h("div", { class: "cr-box" }, [
        h("h3", { text: "Filtro de saques" }),
        h("ul", {}, [h("li", { text: "O relatório tinha tipos mistos; usei só linhas cuja descrição/tipo parece saque, transferência ou withdrawal. Liberações de venda foram ignoradas." })])
      ]));
    }

    var chips = h("div", { class: "presets__row cr-chips" });
    ["todos", "saque_sem_credito", "credito_sem_saque", "ok"].forEach(function (k) {
      if (k !== "todos" && !(res.counts[k] > 0)) return;
      var label = k === "todos" ? "Todas (" + res.rows.length + ")" : STATUS[k].label + " (" + res.counts[k] + ")";
      var b = h("button", { type: "button", class: "chip" + (state.filter === k ? " is-on" : ""), text: label });
      b.addEventListener("click", function () { state.filter = k; renderResult(res); });
      chips.appendChild(b);
    });
    out.appendChild(chips);

    var shown = res.rows.filter(function (r) { return state.filter === "todos" || r.status === state.filter; });
    var tbody = h("tbody");
    shown.slice(0, 2000).forEach(function (r) {
      tbody.appendChild(h("tr", {}, [
        h("td", { "data-l": "Situação" }, [h("span", { class: "cr-pill cr-pill--" + STATUS[r.status].pill, text: STATUS[r.status].label })]),
        h("td", { "data-l": "Data saque", text: r.saque ? r.saque.data : "—" }),
        h("td", { "data-l": "Valor saque", class: "num", text: r.saque ? E.formatBRL(r.saque.valor) : "—" }),
        h("td", { "data-l": "Data crédito", text: r.credito ? r.credito.data : "—" }),
        h("td", { "data-l": "Valor crédito", class: "num", text: r.credito ? E.formatBRL(r.credito.valor) : "—" }),
        h("td", { "data-l": "Δ dias", class: "num", text: r.deltaDias == null ? "—" : String(r.deltaDias) })
      ]));
    });
    out.appendChild(h("div", { class: "cr-table-wrap" }, [h("table", { class: "cr-table" }, [
      h("thead", {}, [h("tr", {}, ["Situação", "Data saque", "Valor saque", "Data crédito", "Valor crédito", "Δ dias"].map(function (x) { return h("th", { text: x }); }))]),
      tbody
    ])]));

    var dl = h("button", { type: "button", class: "btn btn--solid", text: "Baixar resultado (CSV)" });
    dl.addEventListener("click", function () {
      var blob = new Blob([E.exportCSV(res)], { type: "text/csv;charset=utf-8" });
      var a = h("a", { href: URL.createObjectURL(blob), download: "batimento-extrato-saques-mp.csv" });
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    out.appendChild(h("div", { class: "calc__actions" }, [
      dl,
      h("a", { class: "btn btn--ghost", href: "#pix", text: "Achou divergência? Apoie com PIX" })
    ]));
  }
})();
