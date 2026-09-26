/**
 * Precifica — motor de cálculo de preço para marketplaces BR
 * Funções puras + UI. Roda no navegador e no Node (testes).
 *
 * PIX: uma linha só — edite window.PRECIFICA_PIX_KEY no HTML
 * ou o fallback abaixo.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof root !== "undefined") {
    root.Precifica = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PIX_KEY =
    (typeof window !== "undefined" && window.PRECIFICA_PIX_KEY) ||
    "7a941c50-b79f-4791-a7f4-5fe2a68ffea0";

  var PRESETS = {
    "ml-classico": {
      id: "ml-classico",
      label: "ML Clássico",
      short: "Clássico",
      group: "mercadolivre",
      feePct: 12,
      hint: "Anúncio Clássico · 12%"
    },
    "ml-premium": {
      id: "ml-premium",
      label: "ML Premium",
      short: "Premium",
      group: "mercadolivre",
      feePct: 17,
      hint: "Anúncio Premium · 17%"
    },
    shopee: {
      id: "shopee",
      label: "Shopee",
      short: "Shopee",
      group: "shopee",
      feePct: 14,
      hint: "Tabela por faixa de preço"
    },
    amazon: {
      id: "amazon",
      label: "Amazon BR",
      short: "Amazon",
      group: "amazon",
      feePct: 12,
      hint: "Referral 10–15% · padrão 12%"
    },
    magalu: {
      id: "magalu",
      label: "Magalu",
      short: "Magalu",
      group: "magalu",
      feePct: 16,
      hint: "Estimativa 16%"
    },
    direta: {
      id: "direta",
      label: "Venda direta",
      short: "Direta",
      group: "direta",
      feePct: 0,
      hint: "Sem taxa de marketplace"
    }
  };

  var FEE_DISCLAIMER =
    "Estimativa. Confirme no Seller Center / Simulador oficial.";

  var ML_SIMULATOR = "https://www.mercadolivre.com.br/simulador-de-custos";

  /* Faixas ML. extraRate é fração de S; fixed é R$. */
  var ML_BANDS = [
    {
      min: 0,
      max: 12.5,
      extraRate: 0.5,
      fixed: 0,
      label: "preço < R$ 12,50",
      note: "Oficial: taxa extra de 50% do preço abaixo de R$ 12,50."
    },
    {
      min: 12.5,
      max: 79,
      extraRate: 0,
      fixed: 6.5,
      label: "R$ 12,50–78,99",
      note: "Estimativa do blog: +R$ 6,50 nessa faixa. Confirme no simulador oficial."
    },
    {
      min: 79,
      max: Infinity,
      extraRate: 0,
      fixed: 0,
      label: "a partir de R$ 79",
      note: "Sem taxa fixa extra a partir de R$ 79."
    }
  ];

  function shopeeBands(cpfAlto) {
    var extra = cpfAlto ? 3 : 0;
    return [
      { min: 0, max: 80, feePct: 0.2, extraRate: 0, fixed: 4 + extra, label: "preço < R$ 80" },
      { min: 80, max: 100, feePct: 0.14, extraRate: 0, fixed: 16 + extra, label: "R$ 80–99,99" },
      { min: 100, max: 200, feePct: 0.14, extraRate: 0, fixed: 20 + extra, label: "R$ 100–199,99" },
      { min: 200, max: Infinity, feePct: 0.14, extraRate: 0, fixed: 26 + extra, label: "a partir de R$ 200" }
    ];
  }

  function toNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (v == null || v === "") return 0;
    var s = String(v).trim().replace(/\s/g, "");
    if (!s) return 0;
    if (s.indexOf(",") !== -1) s = s.replace(/\./g, "").replace(",", ".");
    var n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  function pctToFrac(pct) {
    return toNumber(pct) / 100;
  }

  function bandFor(price, bands) {
    var s = Number.isFinite(price) ? price : 0;
    var i, b;
    for (i = 0; i < bands.length; i++) {
      b = bands[i];
      if (s >= b.min && s < b.max) return b;
    }
    return bands[bands.length - 1];
  }

  function isMl(id) {
    return id === "ml-classico" || id === "ml-premium" || id === "mercadolivre";
  }

  /**
   * Decompõe a taxa do marketplace em % + extraRate (fração de S) + R$ fixo.
   * Amazon: referral mínimo R$ 1 e, se Individual, +R$ 2/item.
   */
  function feeParamsFor(S, ctx) {
    var feePct = toNumber(ctx.feePct);
    var extraRate = 0;
    var fixed = 0;
    var perItem = 0;
    var minReferral = 0;
    var useMinReferral = false;
    var band = null;
    var note = "";
    var label = "";
    var id = ctx.marketplace || "";

    if (isMl(id)) {
      band = bandFor(S, ML_BANDS);
      extraRate = band.extraRate;
      fixed = band.fixed;
      note = band.note;
      label = band.label;
    } else if (id === "shopee") {
      band = bandFor(S, shopeeBands(!!ctx.shopeeCpfAlto));
      if (!ctx.feeDirty && band.feePct != null) feePct = band.feePct;
      extraRate = band.extraRate || 0;
      fixed = band.fixed;
      label = band.label;
      note =
        "Estimativa Shopee (não há tabela oficial pública). " +
        (ctx.shopeeCpfAlto ? "Inclui +R$ 3 de CPF alto volume. " : "") +
        FEE_DISCLAIMER;
    } else if (id === "amazon") {
      minReferral = 1;
      perItem = ctx.amazonIndividual ? 2 : 0;
      useMinReferral = S * feePct < minReferral;
      note = ctx.amazonIndividual
        ? "Conta Individual: +R$ 2 por item. Referral mínimo R$ 1. Plano Professional cobra R$ 19/mês (fora desta conta unitária)."
        : "Plano Professional: sem taxa por item. Referral mínimo R$ 1. Mensalidade de R$ 19 não entra nesta conta.";
      label = ctx.amazonIndividual ? "Individual" : "Professional";
    } else if (id === "magalu") {
      note = "Estimativa Magalu 16%. " + FEE_DISCLAIMER;
    } else if (id === "direta") {
      note = "Venda direta: sem comissão de marketplace.";
    }

    return {
      feePct: feePct,
      extraRate: extraRate,
      fixed: fixed,
      perItem: perItem,
      minReferral: minReferral,
      useMinReferral: useMinReferral,
      band: band,
      note: note,
      label: label
    };
  }

  function marketplaceFeeReais(S, ctx) {
    var p = feeParamsFor(S, ctx);
    var pctPart = S * p.feePct;
    if (p.minReferral > 0) pctPart = Math.max(pctPart, p.minReferral);
    var fee = pctPart + p.extraRate * S + p.fixed + p.perItem;
    return {
      feeReais: fee,
      pctPart: pctPart,
      extraPart: p.extraRate * S,
      fixedPart: p.fixed + p.perItem,
      params: p
    };
  }

  function costTotal(productCost, packaging, freight, sellerPaysFreight) {
    var c = toNumber(productCost);
    var p = toNumber(packaging);
    var f = sellerPaysFreight ? toNumber(freight) : 0;
    return c + p + f;
  }

  /**
   * Resolve S = (numer) / (1 - feePct - extraRate - tax - margin)
   * com taxa fixa em R$ no numerador.
   * Faixa de preço: trial sem fixo → aplica faixa → se sair da faixa, troca uma vez.
   */
  function solveS(input) {
    var cost = toNumber(input.costTotal);
    var tax = toNumber(input.tax);
    var margin = input.margin == null ? 0 : toNumber(input.margin);
    var desiredProfit = input.desiredProfit == null ? 0 : toNumber(input.desiredProfit);
    var useMargin = input.mode !== "profit";
    var ctx = input.ctx || {};

    function attempt(p) {
      var feePct = p.useMinReferral ? 0 : p.feePct;
      var extra = p.extraRate;
      var denom = 1 - feePct - extra - tax - (useMargin ? margin : 0);
      if (denom <= 0.01) {
        return { ok: false, error: "taxas + margem acima de 99%" };
      }
      var numer = cost + p.fixed + p.perItem + (p.useMinReferral ? p.minReferral : 0);
      if (!useMargin) numer += desiredProfit;
      return { ok: true, S: numer / denom, denom: denom, params: p };
    }

    var trialCtx = {
      marketplace: ctx.marketplace,
      feePct: toNumber(ctx.feePct),
      feeDirty: !!ctx.feeDirty,
      shopeeCpfAlto: !!ctx.shopeeCpfAlto,
      amazonIndividual: !!ctx.amazonIndividual
    };

    var t0 = attempt(
      feeParamsFor(0, {
        marketplace: "",
        feePct: trialCtx.feePct,
        feeDirty: true
      })
    );
    if (!t0.ok) return t0;

    var p1 = feeParamsFor(t0.S, trialCtx);
    var t1 = attempt(p1);
    if (!t1.ok) return t1;

    var p2 = feeParamsFor(t1.S, trialCtx);
    var bandChanged =
      (p1.label || "") !== (p2.label || "") ||
      p1.fixed !== p2.fixed ||
      p1.extraRate !== p2.extraRate ||
      p1.feePct !== p2.feePct ||
      p1.useMinReferral !== p2.useMinReferral;

    var chosen = t1;
    if (bandChanged) {
      var t2 = attempt(p2);
      if (!t2.ok) return t2;
      chosen = t2;
    }

    var S = chosen.S;
    var applied = feeParamsFor(S, trialCtx);
    var feeInfo = marketplaceFeeReais(S, trialCtx);
    var taxAmount = S * tax;
    var profit = useMargin ? S * margin : S - feeInfo.feeReais - taxAmount - cost;
    var effectiveMargin = S !== 0 ? profit / S : 0;

    return {
      ok: true,
      sellingPrice: S,
      profit: profit,
      denom: chosen.denom,
      feeAmount: feeInfo.feeReais,
      feePctPart: feeInfo.pctPart,
      feeExtraPart: feeInfo.extraPart,
      feeFixedPart: feeInfo.fixedPart,
      taxAmount: taxAmount,
      effectiveMargin: effectiveMargin,
      feeParams: applied,
      feePctApplied: applied.feePct
    };
  }

  function forwardByMargin(input) {
    return solveS({
      costTotal: input.costTotal,
      tax: input.tax,
      margin: input.margin,
      mode: "margin",
      ctx: input.ctx || {
        marketplace: "",
        feePct: input.fee,
        feeDirty: true
      }
    });
  }

  function forwardByProfit(input) {
    var ctx = input.ctx || {
      marketplace: "",
      feePct: input.fee,
      feeDirty: true
    };
    if (!input.ctx && input.fee != null) ctx.feePct = input.fee;
    return solveS({
      costTotal: input.costTotal,
      tax: input.tax,
      desiredProfit: input.desiredProfit,
      mode: "profit",
      ctx: ctx
    });
  }

  function reverseCalc(input) {
    var S = toNumber(input.sellingPrice);
    var cost = toNumber(input.costTotal);
    var tax = toNumber(input.tax);
    var ctx = input.ctx || {
      marketplace: "",
      feePct: input.fee,
      feeDirty: true
    };
    if (!input.ctx && input.fee != null) ctx.feePct = input.fee;
    var feeInfo = marketplaceFeeReais(S, ctx);
    var taxAmount = S * tax;
    var profit = S - feeInfo.feeReais - taxAmount - cost;
    var effectiveMargin = S !== 0 ? profit / S : 0;
    return {
      ok: true,
      sellingPrice: S,
      profit: profit,
      feeAmount: feeInfo.feeReais,
      feePctPart: feeInfo.pctPart,
      feeExtraPart: feeInfo.extraPart,
      feeFixedPart: feeInfo.fixedPart,
      taxAmount: taxAmount,
      effectiveMargin: effectiveMargin,
      feeParams: feeInfo.params,
      feePctApplied: feeInfo.params.feePct
    };
  }

  function calculate(state) {
    var sellerPays = !!state.sellerPaysFreight;
    var cost = costTotal(
      state.productCost,
      state.packaging,
      state.freight,
      sellerPays
    );
    var feeFrac = pctToFrac(state.feePct);
    var taxFrac = pctToFrac(state.taxPct);
    var ctx = {
      marketplace: state.marketplace || "",
      feePct: feeFrac,
      feeDirty: !!state.feeDirty,
      shopeeCpfAlto: !!state.shopeeCpfAlto,
      amazonIndividual: !!state.amazonIndividual
    };

    var result;
    if (state.mode === "reverse") {
      result = reverseCalc({
        sellingPrice: state.sellingPrice,
        costTotal: cost,
        tax: taxFrac,
        ctx: ctx
      });
    } else if (state.target === "profit") {
      result = forwardByProfit({
        costTotal: cost,
        tax: taxFrac,
        desiredProfit: state.desiredProfit,
        ctx: ctx
      });
    } else {
      result = forwardByMargin({
        costTotal: cost,
        tax: taxFrac,
        margin: pctToFrac(state.marginPct),
        ctx: ctx
      });
    }

    var out = {
      costTotal: cost,
      productCost: toNumber(state.productCost),
      packaging: toNumber(state.packaging),
      freight: sellerPays ? toNumber(state.freight) : 0,
      freightInput: toNumber(state.freight),
      sellerPaysFreight: sellerPays,
      tax: taxFrac,
      feePct: toNumber(state.feePct),
      taxPct: toNumber(state.taxPct),
      marketplace: ctx.marketplace,
      marketplaceLabel: state.marketplaceLabel || ""
    };
    var k;
    for (k in result) out[k] = result[k];
    return out;
  }

  function formatBRL(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatPct(frac) {
    if (!Number.isFinite(frac)) return "—";
    return (frac * 100).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + "%";
  }

  function todayBR() {
    try {
      return new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "America/Sao_Paulo"
      });
    } catch (e) {
      return new Date().toLocaleDateString("pt-BR");
    }
  }

  function pixKey() {
    if (typeof window !== "undefined" && window.PRECIFICA_PIX_KEY) {
      return String(window.PRECIFICA_PIX_KEY);
    }
    return PIX_KEY;
  }

  function buildSummary(r) {
    var feePctShow = r.feePctApplied != null ? r.feePctApplied * 100 : r.feePct;
    var lines = [
      "*Precifica — cálculo de preço*",
      r.marketplaceLabel ? "Marketplace: " + r.marketplaceLabel : null,
      "Custo do produto: " + formatBRL(r.productCost),
      "Embalagem: " + formatBRL(r.packaging),
      "Frete (" +
        (r.sellerPaysFreight ? "você paga" : "cliente paga") +
        "): " +
        formatBRL(r.sellerPaysFreight ? r.freight : r.freightInput),
      "Taxa marketplace: " +
        Number(feePctShow).toLocaleString("pt-BR") +
        "% (" +
        formatBRL(r.feePctPart != null ? r.feePctPart : r.feeAmount) +
        ")" +
        (r.feeFixedPart ? " + fixo " + formatBRL(r.feeFixedPart) : "") +
        (r.feeExtraPart ? " + extra " + formatBRL(r.feeExtraPart) : ""),
      "Imposto: " +
        r.taxPct.toLocaleString("pt-BR") +
        "% (" +
        formatBRL(r.taxAmount) +
        ")",
      "*Preço de venda: " + formatBRL(r.sellingPrice) + "*",
      "*Lucro líquido: " + formatBRL(r.profit) + "*",
      "Margem efetiva: " + formatPct(r.effectiveMargin),
      "",
      "Calculado em precifica.surge.sh — estimativa, não é conselho fiscal."
    ];
    return lines
      .filter(function (x) {
        return x !== null;
      })
      .join("\n");
  }

  function assertClose(actual, expected, eps, label) {
    var e = eps == null ? 0.015 : eps;
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > e) {
      throw new Error(
        label + " falhou: obtido " + actual + ", esperado " + expected
      );
    }
  }

  function runTests() {
    var results = [];

    function push(id, fn) {
      try {
        var detail = fn() || "ok";
        results.push({ id: id, ok: true, detail: detail });
      } catch (err) {
        results.push({ id: id, ok: false, detail: String(err.message || err) });
      }
    }

    /* 1) sem taxa fixa: cost 50 + pack 4 = 54, fee 16%, tax 4%, margem 20%
          S = 54 / 0.60 = 90.00, lucro 18.00 */
    push(1, function () {
      var c1 = costTotal(50, 4, 0, true);
      assertClose(c1, 54, 0.001, "teste 1 costTotal");
      var r1 = forwardByMargin({
        costTotal: c1,
        fee: 0.16,
        tax: 0.04,
        margin: 0.2
      });
      if (!r1.ok) throw new Error(r1.error);
      assertClose(r1.sellingPrice, 90, 0.001, "teste 1 S");
      assertClose(r1.profit, 18, 0.001, "teste 1 lucro");
      return "S = " + r1.sellingPrice.toFixed(2) + ", profit = " + r1.profit.toFixed(2);
    });

    /* 2) cost 100, pack 0, frete vendedor 20, fee 11%, tax 0, lucro R$30
          S = 150 / 0.89 ≈ 168.54 */
    push(2, function () {
      var c2 = costTotal(100, 0, 20, true);
      assertClose(c2, 120, 0.001, "teste 2 costTotal");
      var r2 = forwardByProfit({
        costTotal: c2,
        fee: 0.11,
        tax: 0,
        desiredProfit: 30
      });
      if (!r2.ok) throw new Error(r2.error);
      assertClose(r2.sellingPrice, 150 / 0.89, 0.01, "teste 2 S");
      return "S ≈ " + r2.sellingPrice.toFixed(2);
    });

    /* 3) reverso: S=100, costTotal=50, fee 16%, tax 4% → lucro 30 */
    push(3, function () {
      var r3 = reverseCalc({
        sellingPrice: 100,
        costTotal: 50,
        fee: 0.16,
        tax: 0.04
      });
      assertClose(r3.profit, 30, 0.001, "teste 3 lucro");
      return "profit = " + r3.profit.toFixed(2);
    });

    /* 4) ML Clássico, faixa R$ 12,50–78,99, fixo 6,50 */
    push(4, function () {
      var r = forwardByMargin({
        costTotal: 30,
        tax: 0,
        margin: 0.2,
        ctx: { marketplace: "ml-classico", feePct: 0.12, feeDirty: true }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 36.5 / 0.68, 0.02, "teste 4 S");
      assertClose(r.feeFixedPart, 6.5, 0.001, "teste 4 fixo");
      return "S ≈ " + r.sellingPrice.toFixed(2) + " (faixa " + r.feeParams.label + ")";
    });

    /* 5) ML Premium ≥ R$ 79, sem extra */
    push(5, function () {
      var r = forwardByMargin({
        costTotal: 50,
        tax: 0.04,
        margin: 0.2,
        ctx: { marketplace: "ml-premium", feePct: 0.17, feeDirty: true }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 50 / 0.59, 0.02, "teste 5 S");
      assertClose(r.feeFixedPart, 0, 0.001, "teste 5 fixo");
      return "S ≈ " + r.sellingPrice.toFixed(2) + ", fixo 0";
    });

    /* 6) ML barato permanece < 12,50: extra 50% de S */
    push(6, function () {
      var r = forwardByMargin({
        costTotal: 2,
        tax: 0,
        margin: 0.1,
        ctx: { marketplace: "ml-classico", feePct: 0.12, feeDirty: true }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 2 / 0.28, 0.02, "teste 6 S");
      assertClose(r.feeParams.extraRate, 0.5, 0.001, "teste 6 extraRate");
      return "S ≈ " + r.sellingPrice.toFixed(2) + " (50% extra)";
    });

    /* 7) ML troca de faixa uma vez: trial < 12,50, resultado cai em 12,50–78,99 */
    push(7, function () {
      var r = forwardByMargin({
        costTotal: 4,
        tax: 0,
        margin: 0.1,
        ctx: { marketplace: "ml-classico", feePct: 0.12, feeDirty: true }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 10.5 / 0.78, 0.02, "teste 7 S");
      assertClose(r.feeFixedPart, 6.5, 0.001, "teste 7 fixo após troca");
      return "S ≈ " + r.sellingPrice.toFixed(2) + " (trocou de faixa)";
    });

    /* 8) Shopee: trial na faixa 80–99,99, S recalculado vai para 100–199,99 — troca uma vez */
    push(8, function () {
      var r = forwardByProfit({
        costTotal: 50,
        tax: 0,
        desiredProfit: 20,
        ctx: { marketplace: "shopee", feePct: 0.14, feeDirty: false }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 90 / 0.86, 0.05, "teste 8 S");
      assertClose(r.feeFixedPart, 20, 0.001, "teste 8 fixo");
      assertClose(r.profit, 20, 0.05, "teste 8 lucro");
      return "S ≈ " + r.sellingPrice.toFixed(2) + " (fixo R$ 20)";
    });

    /* 9) Amazon Professional, referral 12%, sem extra por item */
    push(9, function () {
      var r = forwardByMargin({
        costTotal: 50,
        tax: 0,
        margin: 0.2,
        ctx: { marketplace: "amazon", feePct: 0.12, amazonIndividual: false, feeDirty: true }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 50 / 0.68, 0.02, "teste 9 S");
      assertClose(r.feeFixedPart, 0, 0.001, "teste 9 per item");
      return "S ≈ " + r.sellingPrice.toFixed(2);
    });

    /* 10) Amazon Individual +R$ 2 */
    push(10, function () {
      var r = forwardByMargin({
        costTotal: 50,
        tax: 0,
        margin: 0.2,
        ctx: { marketplace: "amazon", feePct: 0.12, amazonIndividual: true, feeDirty: true }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 52 / 0.68, 0.02, "teste 10 S");
      assertClose(r.feeFixedPart, 2, 0.001, "teste 10 +R$2");
      return "S ≈ " + r.sellingPrice.toFixed(2) + " (Individual +R$ 2)";
    });

    /* 11) Amazon referral mínimo R$ 1 */
    push(11, function () {
      var r = forwardByProfit({
        costTotal: 0.5,
        tax: 0,
        desiredProfit: 0.5,
        ctx: { marketplace: "amazon", feePct: 0.12, amazonIndividual: false, feeDirty: true }
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.sellingPrice, 2, 0.05, "teste 11 S");
      assertClose(r.feeAmount, 1, 0.05, "teste 11 min referral");
      return "S ≈ " + r.sellingPrice.toFixed(2) + ", taxa mín. R$ 1";
    });

    /* 12) Shopee CPF alto volume +R$ 3, faixa >= 200 */
    push(12, function () {
      var r = forwardByProfit({
        costTotal: 140,
        tax: 0,
        desiredProfit: 40,
        ctx: { marketplace: "shopee", feePct: 0.14, feeDirty: false, shopeeCpfAlto: true }
      });
      if (!r.ok) throw new Error(r.error);
      /* trial S=(180)/0.86≈209.3 → faixa >=200: 14% + 26+3=29
         S=(180+29)/0.86=209/0.86≈243.02 permanece */
      assertClose(r.sellingPrice, 209 / 0.86, 0.05, "teste 12 S");
      assertClose(r.feeFixedPart, 29, 0.001, "teste 12 fixo+cpf");
      return "S ≈ " + r.sellingPrice.toFixed(2) + " (fixo R$ 29)";
    });

    /* 13) reverso ML com fixo 6,50 */
    push(13, function () {
      var r = reverseCalc({
        sellingPrice: 50,
        costTotal: 20,
        tax: 0,
        ctx: { marketplace: "ml-classico", feePct: 0.12, feeDirty: true }
      });
      /* fee = 50*0.12 + 6.50 = 12.50; profit = 50-12.50-20 = 17.50 */
      assertClose(r.feeAmount, 12.5, 0.01, "teste 13 taxa");
      assertClose(r.profit, 17.5, 0.01, "teste 13 lucro");
      return "profit = " + r.profit.toFixed(2);
    });


    /* 14) peso cubado: 30×20×10 / 6000 = 1 kg */
    push(14, function () {
      assertClose(cubedKg(30, 20, 10), 1, 0.001, "teste 14 cubado");
      assertClose(cubedWeight(45, 35, 30), (45 * 35 * 30) / 6000, 0.01, "teste 14 cubado2");
      return "cubed = " + cubedKg(30, 20, 10).toFixed(3) + " kg";
    });

    /* 15) tarifado = max(real, cubado) */
    push(15, function () {
      assertClose(billedKg(0.4, 7.875), 7.875, 0.001, "teste 15 billed cubado");
      assertClose(billedWeight(2, 0.5), 2, 0.001, "teste 15 billed real");
      return "billed ok";
    });

    /* 16) embutir frete na taxa 12%: 25 / 0.88 ≈ 28.409 */
    push(16, function () {
      assertClose(embedFreightInPrice(25, 12), 25 / 0.88, 0.01, "teste 16 embed %");
      assertClose(embedFreightInPrice(25, 0.12), 25 / 0.88, 0.01, "teste 16 embed frac");
      return "embed ≈ " + embedFreightInPrice(25, 12).toFixed(2);
    });

    /* 17) frete grátis ML costuma >= 79 */
    push(17, function () {
      if (mlFreeShippingLikely(78.99)) throw new Error("78.99 não deveria");
      if (!mlFreeShippingLikely(79)) throw new Error("79 deveria");
      if (!mlFreeShippingLikely(100)) throw new Error("100 deveria");
      return "threshold R$ " + ML_FREE_SHIPPING_THRESHOLD;
    });

    /* 18) estimateFreightBRL tem low < mid < high e calculateFreight amarra */
    push(18, function () {
      var e = estimateFreightBRL(1, "mercadolivre");
      if (!(e.low < e.mid && e.mid < e.high)) throw new Error("faixa ML inválida");
      if (e.label !== "ESTIMATIVA") throw new Error("falta ESTIMATIVA");
      var e2 = estimateFreightBRL(0.3, "shopee");
      if (!(e2.low <= e2.high)) throw new Error("faixa Shopee inválida");
      var r = calculateFreight({
        realKg: 0.4,
        lengthCm: 45,
        widthCm: 35,
        heightCm: 30,
        listPrice: 99,
        marketplace: "mercadolivre",
        feePct: 12,
        whoPays: "seller"
      });
      assertClose(r.cubedKg, (45 * 35 * 30) / 6000, 0.01, "teste 18 cubado");
      assertClose(r.billedKg, r.cubedKg, 0.01, "teste 18 billed");
      if (!r.mlFreeShippingLikely) throw new Error("99 deveria marcar frete grátis");
      assertClose(r.embedAmount, embedFreightInPrice(r.estimate.mid, 12), 0.01, "teste 18 embed");
      return "mid ML ≈ " + r.estimate.mid.toFixed(2);
    });

    /* 19) descrição: produto vazio → textos vazios */
    push(19, function () {
      var d = generateDescriptions({ produto: "" });
      if (d.ml.text !== "" || d.shopee.text !== "" || d.preview.text !== "") {
        throw new Error("textos deveriam ser vazios");
      }
      if (d.ml.chars !== 0 || d.shopee.chars !== 0 || d.preview.chars !== 0) {
        throw new Error("chars deveriam ser 0");
      }
      return "empty ok";
    });

    /* 20) descrição ML inclui specs e não inventa fluff */
    push(20, function () {
      var d = generateDescriptions({
        produto: "fone bluetooth",
        marca: "Sony",
        modelo: "WH-1000XM5",
        cor: "preto",
        beneficios: "cancelamento de ruído"
      });
      var t = d.ml.text.toLowerCase();
      if (t.indexOf("fone bluetooth") === -1) throw new Error("falta produto");
      if (d.ml.text.indexOf("Sony") === -1) throw new Error("falta marca");
      if (d.ml.text.indexOf("WH-1000XM5") === -1) throw new Error("falta modelo");
      if (t.indexOf("preto") === -1) throw new Error("falta cor");
      if (t.indexOf("cancelamento de ruído") === -1 && t.indexOf("cancelamento de ruido") === -1) {
        throw new Error("falta benefício");
      }
      if (/\bincrível\b/i.test(d.ml.text) || /\bótimo\b/i.test(d.ml.text)) {
        throw new Error("fluff proibido no ML");
      }
      return "ml chars=" + d.ml.chars;
    });

    /* 21) caps Shopee/preview e preview é prefixo do ML */
    push(21, function () {
      var d = generateDescriptions({
        produto: "fone bluetooth",
        marca: "Sony",
        modelo: "WH-1000XM5",
        cor: "preto",
        beneficios: "cancelamento de ruído"
      });
      if (d.shopee.text.length > 5000) throw new Error("shopee > 5000");
      if (d.preview.text.length > 500) throw new Error("preview > 500");
      if (d.shopee.chars > DESC_SHOPEE_MAX) throw new Error("shopee chars max");
      if (d.preview.chars > DESC_PREVIEW_MAX) throw new Error("preview chars max");
      if (d.ml.text.indexOf(d.preview.text) !== 0 && d.preview.text !== d.ml.text) {
        throw new Error("preview não é prefixo do ml");
      }
      return "preview " + d.preview.chars + "/500";
    });

    /* 22) caixa e garantia aparecem no ML */
    push(22, function () {
      var d = generateDescriptions({
        produto: "fone bluetooth",
        caixa: "cabo USB e estojo",
        garantia: "12 meses"
      });
      if (d.ml.text.indexOf("cabo USB e estojo") === -1) throw new Error("falta caixa");
      if (d.ml.text.indexOf("12 meses") === -1) throw new Error("falta garantia");
      return "caixa+garantia ok";
    });

    /* 23) gerador nunca acrescenta 'melhor do brasil' / 'promoção' */
    push(23, function () {
      var d = generateDescriptions({ produto: "Fone incrível" });
      var blob = (d.ml.text + "\n" + d.shopee.text).toLowerCase();
      if (blob.indexOf("melhor do brasil") !== -1) throw new Error("emitiu melhor do brasil");
      if (blob.indexOf("promoção") !== -1) throw new Error("emitiu promoção");
      return "sem fluff inventado";
    });


    /* 24) parseSheet CSV com header mapeia sku/custo/embalagem/frete; BR 45,90 */
    push(24, function () {
      var p = parseSheet("sku,custo,embalagem,frete\nABC,45,90,2,00,8,50");
      /* comma CSV with BR decimals is ambiguous — use semicolon Excel-BR */
      p = parseSheet("sku;custo;embalagem;frete\nABC;45,90;2,00;8,50");
      if (p.rows.length !== 1) throw new Error("esperava 1 row");
      if (p.rows[0].sku !== "ABC") throw new Error("sku");
      assertClose(p.rows[0].productCost, 45.9, 0.001, "custo BR");
      assertClose(p.rows[0].packaging, 2, 0.001, "embalagem");
      assertClose(p.rows[0].freight, 8.5, 0.001, "frete");
      return "sku=" + p.rows[0].sku + " custo=" + p.rows[0].productCost;
    });

    /* 25) parseSheet TSV sem header; 2 colunas = sku+custo */
    push(25, function () {
      var p = parseSheet("SKU-1\t10\nSKU-2\t20,5");
      if (p.rows.length !== 2) throw new Error("esperava 2 rows");
      if (p.rows[0].sku !== "SKU-1") throw new Error("sku1");
      assertClose(p.rows[0].productCost, 10, 0.001, "custo1");
      assertClose(p.rows[1].productCost, 20.5, 0.001, "custo2");
      return "tsv rows=" + p.rows.length;
    });

    /* 26) priceSheet 2 SKUs ML clássico; válido > custo; custo 0 → ok false */
    push(26, function () {
      var priced = priceSheet(
        [
          { sku: "A", productCost: 50, packaging: 0, freight: 0 },
          { sku: "B", productCost: 0, packaging: 0, freight: 0 }
        ],
        {
          marketplace: "ml-classico",
          marketplaceLabel: "ML Clássico",
          feePct: 12,
          taxPct: 0,
          marginPct: 20,
          sellerPaysFreight: true
        }
      );
      if (priced.length !== 2) throw new Error("len");
      if (!priced[0].ok) throw new Error(priced[0].error || "A deveria ok");
      if (!(priced[0].sellingPrice > priced[0].costTotal)) {
        throw new Error("sellingPrice deve ser > costTotal");
      }
      if (!Number.isFinite(priced[0].sellingPrice)) throw new Error("S finito");
      if (priced[1].ok) throw new Error("B deveria falhar");
      if (priced[1].error !== "custo precisa ser > 0") throw new Error("msg custo");
      return "A S=" + priced[0].sellingPrice.toFixed(2);
    });

    /* 27) sheetToCsv tem header preco_minimo e o sku */
    push(27, function () {
      var priced = priceSheet(
        [{ sku: "XYZ-9", productCost: 40, packaging: 0, freight: 0 }],
        {
          marketplace: "ml-classico",
          feePct: 12,
          taxPct: 0,
          marginPct: 20,
          sellerPaysFreight: true
        }
      );
      var csv = sheetToCsv(priced);
      if (csv.indexOf("preco_minimo") === -1) throw new Error("falta preco_minimo");
      if (csv.indexOf("XYZ-9") === -1) throw new Error("falta sku");
      return "csv ok";
    });

    /* 28) SHEET_MAX: 201 linhas → truncated e rows.length === 200 */
    push(28, function () {
      var lines = [];
      var i;
      for (i = 1; i <= 201; i++) lines.push("SKU-" + i + "\t" + (10 + i));
      var p = parseSheet(lines.join("\n"));
      if (!p.truncated) throw new Error("deveria truncated");
      if (p.rows.length !== 200) throw new Error("len=" + p.rows.length);
      if (SHEET_MAX !== 200) throw new Error("SHEET_MAX");
      return "truncated 200/" + SHEET_MAX;
    });



    /* 29) contribuição positiva e break-even com ceil */
    push(29, function () {
      /* price 100, fee 14%, fixed fee 0, tax 6%, frete 0, var 40
         contrib = 100 - 14 - 0 - 6 - 0 - 40 = 40
         fixed 1000 → BE = ceil(1000/40) = 25 */
      var c = contributionPerUnit(100, 14, 0, 6, 0, 40);
      assertClose(c, 40, 0.001, "teste 29 contrib");
      var be = breakEvenUnits(1000, c);
      if (be !== 25) throw new Error("BE esperado 25, got " + be);
      return "contrib=" + c.toFixed(2) + " BE=" + be;
    });

    /* 30) contribuição zero → Infinity */
    push(30, function () {
      var c = contributionPerUnit(100, 14, 0, 6, 0, 80);
      /* 100 - 14 - 6 - 80 = 0 */
      assertClose(c, 0, 0.001, "teste 30 contrib zero");
      var be = breakEvenUnits(500, c);
      if (be !== Infinity) throw new Error("esperado Infinity, got " + be);
      return "BE Infinity (contrib 0)";
    });

    /* 31) contribuição negativa → Infinity */
    push(31, function () {
      var c = contributionPerUnit(50, 14, 20, 6, 10, 30);
      /* 50 - 7 - 20 - 3 - 10 - 30 = -20 */
      assertClose(c, -20, 0.001, "teste 31 contrib neg");
      var be = breakEvenUnits(100, c);
      if (be !== Infinity) throw new Error("esperado Infinity, got " + be);
      return "BE Infinity (contrib " + c.toFixed(2) + ")";
    });

    /* 32) projectedProfit e ceil de quebra parcial */
    push(32, function () {
      var c = contributionPerUnit(100, 14, 0, 6, 5, 40);
      /* 100 - 14 - 6 - 5 - 40 = 35 */
      assertClose(c, 35, 0.001, "teste 32 contrib");
      assertClose(projectedProfit(50, 1000, c), 50 * 35 - 1000, 0.001, "teste 32 p50");
      assertClose(projectedProfit(100, 1000, c), 100 * 35 - 1000, 0.001, "teste 32 p100");
      assertClose(projectedProfit(200, 1000, c), 200 * 35 - 1000, 0.001, "teste 32 p200");
      /* fixed 100 → ceil(100/35)=3 */
      var be = breakEvenUnits(100, c);
      if (be !== 3) throw new Error("ceil BE esperado 3, got " + be);
      return "p50=" + projectedProfit(50, 1000, c).toFixed(2) + " BE=" + be;
    });

    /* 33) feePct como fração 0.14 e feeFixed */
    push(33, function () {
      var c1 = contributionPerUnit(200, 0.14, 16, 0.06, 0, 50);
      /* 200 - 28 - 16 - 12 - 0 - 50 = 94 */
      assertClose(c1, 94, 0.001, "teste 33 frac");
      var c2 = contributionPerUnit(200, 14, 16, 6, 0, 50);
      assertClose(c2, 94, 0.001, "teste 33 pct");
      var eq = calculateEquilibrium({
        fixedCost: 940,
        varCost: 50,
        price: 200,
        feePct: 14,
        feeFixed: 16,
        taxPct: 6,
        freight: 0
      });
      assertClose(eq.contribution, 94, 0.001, "teste 33 eq contrib");
      if (eq.breakEvenUnits !== 10) throw new Error("BE eq=" + eq.breakEvenUnits);
      assertClose(eq.breakEvenRevenue, 2000, 0.001, "teste 33 receita");
      return "eq BE=" + eq.breakEvenUnits;
    });


    /* 34) ACOS = adSpend / adRevenue * 100 */
    push(34, function () {
      assertClose(acosPct(100, 400), 25, 0.001, "teste 34 acos");
      assertClose(acosPct(50, 200), 25, 0.001, "teste 34 acos2");
      var t = calculateTacos({
        totalRevenue: 1000,
        adSpend: 100,
        adRevenue: 400,
        marginPct: 20
      });
      assertClose(t.acosPct, 25, 0.001, "teste 34 calc acos");
      return "ACOS=" + t.acosPct.toFixed(1) + "%";
    });

    /* 35) TACOS = adSpend / totalRevenue * 100 */
    push(35, function () {
      assertClose(tacosPct(100, 1000), 10, 0.001, "teste 35 tacos");
      var t = calculateTacos({
        totalRevenue: 1000,
        adSpend: 100,
        adRevenue: 400,
        marginPct: 20
      });
      assertClose(t.tacosPct, 10, 0.001, "teste 35 calc tacos");
      assertClose(t.breakEvenAcosPct, 20, 0.001, "teste 35 BE");
      return "TACOS=" + t.tacosPct.toFixed(1) + "%";
    });

    /* 36) break-even: lucro após ads e badge VERDE/VERMELHO */
    push(36, function () {
      assertClose(profitAfterAds(1000, 20, 150), 50, 0.001, "teste 36 profit");
      assertClose(maxAdSpendAtMargin(1000, 20), 200, 0.001, "teste 36 max");
      var ok = calculateTacos({
        totalRevenue: 1000,
        adSpend: 150,
        adRevenue: 600,
        marginPct: 20
      });
      /* ACOS=25 > margem 20 → VERMELHO */
      if (ok.badge !== "VERMELHO") throw new Error("badge=" + ok.badge);
      var green = calculateTacos({
        totalRevenue: 1000,
        adSpend: 150,
        adRevenue: 1000,
        marginPct: 20
      });
      /* ACOS=15 ≤ 20 e lucro 50 → VERDE */
      assertClose(green.profitAfterAds, 50, 0.001, "teste 36 green profit");
      if (green.badge !== "VERDE") throw new Error("green badge=" + green.badge);
      var redSpend = calculateTacos({
        totalRevenue: 1000,
        adSpend: 250,
        adRevenue: 1000,
        marginPct: 20
      });
      assertClose(redSpend.profitAfterAds, -50, 0.001, "teste 36 red profit");
      if (redSpend.badge !== "VERMELHO") throw new Error("red badge=" + redSpend.badge);
      return "badge ok VERDE/VERMELHO";
    });

    /* 37) zero-guards: receita ads 0 e receita total 0 */
    push(37, function () {
      if (acosPct(50, 0) !== null) throw new Error("acos deveria null");
      if (tacosPct(50, 0) !== null) throw new Error("tacos deveria null");
      var z = calculateTacos({
        totalRevenue: 0,
        adSpend: 10,
        adRevenue: 0,
        marginPct: 20
      });
      if (z.acosPct !== null) throw new Error("calc acos null");
      if (z.tacosPct !== null) throw new Error("calc tacos null");
      assertClose(z.maxAdSpend, 0, 0.001, "teste 37 max0");
      /* default adRevenue = totalRevenue quando omitido */
      var d = calculateTacos({ totalRevenue: 500, adSpend: 50, marginPct: 20 });
      assertClose(d.adRevenue, 500, 0.001, "teste 37 default adRev");
      assertClose(d.acosPct, 10, 0.001, "teste 37 default acos");
      return "zero-guards + default adRevenue";
    });


    /* 38) keywords: empty produto → empty lists */
    push(38, function () {
      var k = generateMlKeywords({});
      if (k.principais.length || k.caudaLonga.length || k.atributos.length || k.evitar.length) {
        throw new Error("empty should be empty");
      }
      var k2 = generateMlKeywords({ produto: "   " });
      if (k2.principais.length) throw new Error("blank produto");
      return "empty ok";
    });

    /* 39) keywords: basic produto fills principais */
    push(39, function () {
      var k = generateMlKeywords({ produto: "Fone bluetooth" });
      if (k.principais.length < 1) throw new Error("principais vazio");
      var blob = k.principais.join(" ").toLowerCase();
      if (blob.indexOf("fone") === -1) throw new Error("produto missing");
      if (k.evitar.length < 3) throw new Error("evitar denylist");
      return "principais=" + k.principais.length;
    });

    /* 40) keywords: atributos appear */
    push(40, function () {
      var k = generateMlKeywords({
        produto: "Camiseta",
        atributos: "algodão, preta, G",
        marca: "Nike"
      });
      var all = k.principais.concat(k.caudaLonga, k.atributos).join(" ").toLowerCase();
      if (all.indexOf("algod") === -1 && all.indexOf("preta") === -1) {
        throw new Error("attrs missing: " + all);
      }
      if (k.atributos.length < 1) throw new Error("atributos list empty");
      return "attrs=" + k.atributos.length;
    });

    /* 41) keywords: case-insensitive dedupe */
    push(41, function () {
      var k = generateMlKeywords({
        produto: "Caneca",
        marca: "Caneca",
        atributos: "branca, Branca, BRANCA"
      });
      var lowers = k.atributos.map(function (x) { return x.toLowerCase(); });
      var uniq = {};
      lowers.forEach(function (x) { uniq[x] = (uniq[x] || 0) + 1; });
      if (uniq["branca"] > 1) throw new Error("dup branca in atributos");
      var pLow = k.principais.map(function (x) { return x.toLowerCase(); });
      var seen = {};
      var i;
      for (i = 0; i < pLow.length; i++) {
        if (seen[pLow[i]]) throw new Error("dup principais " + pLow[i]);
        seen[pLow[i]] = true;
      }
      return "dedupe ok";
    });

    /* 42) keywords: denylist in evitar */
    push(42, function () {
      var k = generateMlKeywords({ produto: "Kit beleza", uso: "presente" });
      var ev = k.evitar.join(" ").toLowerCase();
      if (ev.indexOf("incr") === -1) throw new Error("missing incrivel");
      if (ev.indexOf("promo") === -1 && ev.indexOf("promoção") === -1 && ev.indexOf("promocao") === -1) {
        throw new Error("missing promocao");
      }
      if (ev.indexOf("barato") === -1) throw new Error("missing barato");
      return "denylist ok n=" + k.evitar.length;
    });



    /* 43) kit-combo: empty/zero */
    push(43, function () {
      var k = priceKitCombo({});
      if (k.costTotal !== 0 || k.soloSum !== 0 || k.kitListPrice !== 0) {
        throw new Error("empty not zero: " + JSON.stringify(k));
      }
      if (k.profitKit !== 0 && Math.abs(k.profitKit) > 1e-9) throw new Error("profit");
      if (k.badge !== "AMARELO" && k.badge !== "VERMELHO" && k.badge !== "VERDE") {
        throw new Error("badge missing");
      }
      return "empty ok badge=" + k.badge;
    });

    /* 44) kit-combo: basic profit + discount math */
    push(44, function () {
      var k = priceKitCombo({
        items: [
          { name: "Shampoo", cost: 12, sellSolo: 35, qty: 1 },
          { name: "Condicionador", cost: 14, sellSolo: 39, qty: 1 },
          { name: "Máscara", cost: 18, sellSolo: 49, qty: 1 }
        ],
        kitDiscountPct: 10,
        feePct: 14,
        feeFixed: 0,
        taxPct: 6,
        packaging: 3,
        freight: 0
      });
      if (Math.abs(k.soloSum - 123) > 1e-9) throw new Error("soloSum " + k.soloSum);
      if (Math.abs(k.kitListPrice - 110.7) > 1e-6) throw new Error("kitList " + k.kitListPrice);
      if (Math.abs(k.costTotal - 47) > 1e-9) throw new Error("costTotal " + k.costTotal);
      if (Math.abs(k.savingBuyer - 12.3) > 1e-6) throw new Error("saving " + k.savingBuyer);
      if (!(k.profitKit > 0)) throw new Error("expected profit " + k.profitKit);
      if (k.badge !== "VERDE") throw new Error("badge " + k.badge);
      return "profit=" + k.profitKit.toFixed(2);
    });

    /* 45) kit-combo: kitPrice override */
    push(45, function () {
      var k = priceKitCombo({
        items: [{ cost: 10, sellSolo: 50, qty: 2 }],
        kitDiscountPct: 50,
        kitPrice: 80,
        feePct: 0,
        feeFixed: 0,
        taxPct: 0,
        packaging: 0,
        freight: 0
      });
      if (Math.abs(k.soloSum - 100) > 1e-9) throw new Error("solo");
      if (Math.abs(k.kitListPrice - 80) > 1e-9) throw new Error("override " + k.kitListPrice);
      if (Math.abs(k.costTotal - 20) > 1e-9) throw new Error("cost");
      if (Math.abs(k.profitKit - 60) > 1e-9) throw new Error("profit " + k.profitKit);
      return "override ok";
    });

    /* 46) kit-combo: fees eat margin → VERMELHO */
    push(46, function () {
      var k = priceKitCombo({
        items: [
          { cost: 40, sellSolo: 50, qty: 1 },
          { cost: 40, sellSolo: 50, qty: 1 }
        ],
        kitDiscountPct: 20,
        feePct: 30,
        feeFixed: 10,
        taxPct: 10,
        packaging: 5,
        freight: 8
      });
      // soloSum=100, kit=80, cost=40+40+5+8=93, fees=24+10=34, tax=8 → profit=80-34-8-93=-55
      if (!(k.profitKit < 0)) throw new Error("expected loss " + k.profitKit);
      if (k.badge !== "VERMELHO") throw new Error("badge " + k.badge + " profit=" + k.profitKit);
      return "vermelho ok " + k.profitKit.toFixed(2);
    });

    /* 47) kit-combo: solo vs kit comparison ESTIMATIVA */
    push(47, function () {
      var k = priceKitCombo({
        items: [
          { cost: 10, sellSolo: 40, qty: 1 },
          { cost: 10, sellSolo: 40, qty: 1 }
        ],
        kitDiscountPct: 10,
        feePct: 14,
        feeFixed: 0,
        taxPct: 6,
        packaging: 0,
        freight: 0
      });
      // soloSum=80, kit=72, cost=20
      // profitIfSoldSolo = 80*(1-0.14-0.06) - 20 = 80*0.8 - 20 = 44
      if (Math.abs(k.profitIfSoldSolo - 44) > 1e-6) {
        throw new Error("solo profit " + k.profitIfSoldSolo);
      }
      if (typeof k.disclaimer !== "string" || k.disclaimer.indexOf("ESTIMATIVA") === -1) {
        throw new Error("disclaimer");
      }
      if (!(k.netAfterFees > 0)) throw new Error("net");
      return "soloVsKit ok";
    });

    /* 48) kit-combo: qty + thin AMARELO */
    push(48, function () {
      var k = priceKitCombo({
        items: [{ cost: 45, sellSolo: 60, qty: 2 }],
        kitDiscountPct: 0,
        kitPrice: 100,
        feePct: 5,
        feeFixed: 0,
        taxPct: 0,
        packaging: 0,
        freight: 0
      });
      // cost=90, kit=100, fee=5, profit=5 → 5% margin → AMARELO (thin <5%? wait 5% exact)
      // use profit 4 on 100 → AMARELO
      var k2 = priceKitCombo({
        items: [{ cost: 91, sellSolo: 100, qty: 1 }],
        kitDiscountPct: 0,
        kitPrice: 100,
        feePct: 5,
        feeFixed: 0,
        taxPct: 0
      });
      // fee=5, profit=100-5-91=4 → 4% → AMARELO
      if (k2.badge !== "AMARELO") throw new Error("expected AMARELO got " + k2.badge + " p=" + k2.profitKit);
      if (Math.abs(k.costTotal - 90) > 1e-9) throw new Error("qty cost");
      return "amarelo+qty ok";
    });



    /* 49) amazon bullets: empty produto → 5 safe empty rows */
    push(49, function () {
      var rows = generateAmazonBullets({});
      if (!rows || rows.length !== 5) throw new Error("need 5 rows got " + (rows && rows.length));
      var i;
      for (i = 0; i < 5; i++) {
        if (!rows[i] || typeof rows[i].text !== "string") throw new Error("row " + i);
        if (rows[i].text && rows[i].length !== rows[i].text.length) {
          throw new Error("length mismatch " + i);
        }
        if (rows[i].length !== (rows[i].text || "").length) throw new Error("len field");
        if (rows[i].text.length > 0 && rows[i].length !== 0) { /* ok */ }
      }
      var allEmpty = rows.every(function (r) { return !r.text || r.length === 0; });
      if (!allEmpty) throw new Error("expected empty texts: " + JSON.stringify(rows));
      return "empty 5 ok";
    });

    /* 50) amazon bullets: filled fone → 5 non-empty ≤255 */
    push(50, function () {
      var rows = generateAmazonBullets({
        produto: "Fone bluetooth",
        marca: "Acme",
        modelo: "X200",
        uso: "home office",
        specs: "cancelamento de ruído, 30h bateria, USB-C",
        beneficios: "foco no trabalho, conforto longo uso, conexão estável",
        diffs: "microfone com redução de eco",
        tom: "pratico"
      });
      if (rows.length !== 5) throw new Error("len " + rows.length);
      var i;
      for (i = 0; i < 5; i++) {
        if (!rows[i].text || !rows[i].text.trim()) throw new Error("empty bullet " + i);
        if (rows[i].length > 255) throw new Error("over 255: " + rows[i].length);
        if (rows[i].length !== rows[i].text.length) throw new Error("len field " + i);
        if (!rows[i].lead || !rows[i].body) throw new Error("lead/body " + i);
      }
      return "fone 5 ok max=" + Math.max.apply(null, rows.map(function (r) { return r.length; }));
    });

    /* 51) amazon bullets: no medical/hype banned words for normal input */
    push(51, function () {
      var rows = generateAmazonBullets({
        produto: "Garrafa térmica",
        marca: "House",
        modelo: "500",
        uso: "academia",
        specs: "inox 500ml",
        beneficios: "mantém gelado, leve para treino",
        tom: "premium"
      });
      var banned = [
        "melhor do brasil",
        "#1",
        "cura",
        "milagroso",
        "milagrosa",
        "trata câncer",
        "trata cancer",
        "emagrece rápido",
        "emagrece rapido",
        "aprovado pela anvisa como remédio",
        "melhor do mundo"
      ];
      var blob = rows.map(function (r) { return r.text; }).join(" ").toLowerCase();
      var i;
      for (i = 0; i < banned.length; i++) {
        if (blob.indexOf(banned[i]) !== -1) throw new Error("banned: " + banned[i]);
      }
      return "no hype/medical ok";
    });

    /* 52) amazon bullets: tom técnico includes spec-ish bullet when specs given */
    push(52, function () {
      var rows = generateAmazonBullets({
        produto: "Roteador wifi",
        marca: "NetCo",
        modelo: "AX3000",
        uso: "escritório",
        specs: "Wi-Fi 6, 3000 Mbps, 4 antenas",
        beneficios: "cobertura ampla, baixa latência",
        tom: "tecnico"
      });
      var blob = rows.map(function (r) { return (r.lead + " " + r.body + " " + r.text).toLowerCase(); }).join(" ");
      var hit =
        blob.indexOf("wi-fi") !== -1 ||
        blob.indexOf("wifi") !== -1 ||
        blob.indexOf("3000") !== -1 ||
        blob.indexOf("antenas") !== -1 ||
        blob.indexOf("especif") !== -1 ||
        blob.indexOf("técnic") !== -1 ||
        blob.indexOf("tecnic") !== -1 ||
        blob.indexOf("mbps") !== -1;
      if (!hit) throw new Error("expected spec-ish content: " + blob.slice(0, 200));
      return "tecnico+specs ok";
    });

    /* 53) amazon bullets: copy-all join uses newlines */
    push(53, function () {
      var rows = generateAmazonBullets({
        produto: "Cadeira ergonômica",
        marca: "Sit",
        beneficios: "apoio lombar, altura ajustável, rodízios",
        tom: "pratico"
      });
      var joined = joinAmazonBulletsCopy(rows);
      if (joined.indexOf("\n") === -1) throw new Error("expected newlines");
      var parts = joined.split("\n");
      if (parts.length !== 5) throw new Error("parts " + parts.length);
      var i;
      for (i = 0; i < 5; i++) {
        if (parts[i] !== rows[i].text) throw new Error("mismatch line " + i);
      }
      return "copy-all newlines ok";
    });



    /* 54) ML bid: empty/zero → safe zeros, badge VERMELHO */
    push(54, function () {
      var r = simulateMlBid({
        bid: 0,
        ctrPct: 0,
        convPct: 0,
        price: 0,
        cost: 0,
        feePct: 0,
        feeFixed: 0,
        taxPct: 0,
        budget: 0
      });
      if (r.clicksDay !== 0) throw new Error("clicks");
      if (r.ordersDay !== 0) throw new Error("orders");
      if (r.revenueDay !== 0) throw new Error("rev");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (!/ESTIMATIVA/i.test(r.disclaimer)) throw new Error("disclaimer");
      return "empty/zero ok";
    });

    /* 55) ML bid: profitable green (low bid vs BE) */
    push(55, function () {
      // price 100, cost 40, fee 14%+6=20, tax 6 → profitUnit=34
      // conv 10% → BE CPC = 3.4; bid 0.50 → far below → VERDE
      var r = simulateMlBid({
        bid: 0.5,
        ctrPct: 2,
        convPct: 10,
        price: 100,
        cost: 40,
        feePct: 14,
        feeFixed: 6,
        taxPct: 6,
        budget: 50
      });
      assertClose(r.profitUnit, 34, 0.01, "profitUnit");
      assertClose(r.breakEvenCpc, 3.4, 0.01, "BE");
      assertClose(r.clicksDay, 100, 0.01, "clicks");
      assertClose(r.ordersDay, 10, 0.01, "orders");
      assertClose(r.adCostOrder, 5, 0.01, "cac");
      assertClose(r.profitAfterAdsOrder, 29, 0.01, "paa");
      if (r.badge !== "VERDE") throw new Error("expected VERDE got " + r.badge);
      assertClose(r.maxBidSuggested, 3.4 * 0.8, 0.01, "maxBid");
      return "green ok";
    });

    /* 56) ML bid: red overbid */
    push(56, function () {
      // same unit profit 34, conv 10% → BE 3.4; bid 5 → CAC=50 → loss
      var r = simulateMlBid({
        bid: 5,
        convPct: 10,
        price: 100,
        cost: 40,
        feePct: 14,
        feeFixed: 6,
        taxPct: 6,
        budget: 50
      });
      if (!(r.profitAfterAdsOrder < 0)) throw new Error("expected loss");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      return "red overbid ok";
    });

    /* 57) ML bid: break-even edge → AMARELO (within 10%) */
    push(57, function () {
      // profitUnit 34, conv 10% → BE 3.4; bid 3.2 (≥ 90% of BE) → AMARELO
      var r = simulateMlBid({
        bid: 3.2,
        convPct: 10,
        price: 100,
        cost: 40,
        feePct: 14,
        feeFixed: 6,
        taxPct: 6,
        budget: 32
      });
      assertClose(r.breakEvenCpc, 3.4, 0.01, "BE");
      if (!(r.profitAfterAdsOrder > 0)) throw new Error("still profit");
      if (r.badge !== "AMARELO") throw new Error("expected AMARELO got " + r.badge);
      var r2 = estimateMlBid({
        bid: 3.4,
        convPct: 10,
        price: 100,
        cost: 40,
        feePct: 14,
        feeFixed: 6,
        taxPct: 6,
        budget: 34
      });
      assertClose(r2.profitAfterAdsOrder, 0, 0.05, "edge paa");
      if (r2.badge !== "AMARELO" && r2.badge !== "VERDE") {
        throw new Error("edge badge " + r2.badge);
      }
      return "BE edge ok";
    });

    /* 58) ML bid: ROAS sanity */
    push(58, function () {
      var r = simulateMlBid({
        bid: 1,
        convPct: 10,
        price: 100,
        cost: 40,
        feePct: 14,
        feeFixed: 6,
        taxPct: 6,
        budget: 20
      });
      // clicks=20, orders=2, revenue=200, spend=20 → ROAS=10
      assertClose(r.roas, 10, 0.01, "roas");
      assertClose(r.revenueDay, 200, 0.01, "rev");
      assertClose(r.acosLikePct, 10, 0.01, "acos");
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) {
        throw new Error("disclaimer");
      }
      return "roas ok";
    });


    /* 59) ML variations: empty/fail */
    push(59, function () {
      var r = generateMlVariations({});
      if (r.ok !== false) throw new Error("expected ok false");
      if (!r.error) throw new Error("expected error");
      if (!r.variations || r.variations.length !== 0) throw new Error("expected empty variations");
      var r2 = generateMlVariations({ produto: "   " });
      if (r2.ok !== false) throw new Error("blank produto should fail");
      return "empty/fail ok";
    });

    /* 60) ML variations: filled → 3 variations, title ≤60 */
    push(60, function () {
      var r = generateMlVariations({
        produto: "Fone bluetooth",
        marca: "Acme",
        modelo: "X200",
        cor: "preto",
        tamanho: "kit 1",
        diferencial: "cancelamento de ruído",
        beneficio: "foco no trabalho",
        tom: "pratico"
      });
      if (!r.ok) throw new Error("ok " + r.error);
      if (r.variations.length !== 3) throw new Error("len " + r.variations.length);
      var angles = r.variations.map(function (v) { return v.angle; });
      if (angles.indexOf("Atributos") === -1 || angles.indexOf("Benefício") === -1 || angles.indexOf("Uso/kit") === -1) {
        throw new Error("angles " + angles.join(","));
      }
      var i, v;
      for (i = 0; i < 3; i++) {
        v = r.variations[i];
        if (!v.title || !v.title.trim()) throw new Error("empty title " + i);
        if (v.title.length > TITLE_MAX) throw new Error("title over " + v.title.length);
        if (v.titleLen !== v.title.length) throw new Error("titleLen " + i);
        if (!v.hook || !v.hook.trim()) throw new Error("empty hook " + i);
        if (v.hook.length > HOOK_MAX) throw new Error("hook over " + v.hook.length);
        if (v.hookLen !== v.hook.length) throw new Error("hookLen " + i);
      }
      return "3 vars ok maxT=" + Math.max.apply(null, r.variations.map(function (x) { return x.titleLen; }));
    });

    /* 61) ML variations: no banned hype */
    push(61, function () {
      var r = generateMlVariations({
        produto: "Garrafa térmica milagroso cura melhor do brasil",
        marca: "House",
        modelo: "500",
        beneficio: "mantém gelado",
        diferencial: "inox",
        tom: "beneficio"
      });
      if (!r.ok) throw new Error(r.error);
      var banned = [
        "melhor do brasil",
        "cura",
        "milagroso",
        "milagrosa",
        "melhor do mundo"
      ];
      var blob = r.variations.map(function (v) { return v.title + " " + v.hook; }).join(" ").toLowerCase();
      var i;
      for (i = 0; i < banned.length; i++) {
        if (blob.indexOf(banned[i]) !== -1) throw new Error("banned: " + banned[i]);
      }
      return "no hype ok";
    });

    /* 62) ML variations: tom técnico includes model/spec */
    push(62, function () {
      var r = generateMlVariations({
        produto: "Roteador wifi",
        marca: "NetCo",
        modelo: "AX3000",
        tamanho: "4 antenas",
        diferencial: "Wi-Fi 6 3000 Mbps",
        beneficio: "cobertura ampla",
        tom: "tecnico"
      });
      if (!r.ok) throw new Error(r.error);
      var blob = r.variations.map(function (v) { return v.title + " " + v.hook; }).join(" ").toLowerCase();
      var hit =
        blob.indexOf("ax3000") !== -1 ||
        blob.indexOf("wi-fi") !== -1 ||
        blob.indexOf("wifi") !== -1 ||
        blob.indexOf("3000") !== -1 ||
        blob.indexOf("antenas") !== -1 ||
        blob.indexOf("mbps") !== -1;
      if (!hit) throw new Error("expected model/spec: " + blob.slice(0, 220));
      return "tecnico model/spec ok";
    });

    /* 63) ML variations: copy-block joins with newline */
    push(63, function () {
      var r = generateMlVariations({
        produto: "Cadeira ergonômica",
        marca: "Sit",
        modelo: "Pro",
        beneficio: "apoio lombar",
        tom: "pratico"
      });
      if (!r.ok) throw new Error(r.error);
      var v = r.variations[0];
      var joined = joinMlVariationBlock(v);
      if (joined.indexOf("\n") === -1) throw new Error("expected newline");
      var parts = joined.split("\n");
      if (parts.length < 2) throw new Error("parts " + parts.length);
      if (parts[0] !== v.title) throw new Error("title mismatch");
      if (parts.slice(1).join("\n") !== v.hook) throw new Error("hook mismatch");
      return "copy-block newline ok";
    });

    /* 64) A/B titles: empty/fail */
    push(64, function () {
      var r = scoreAbTitles({});
      if (r.ok !== false) throw new Error("expected ok false");
      if (!r.error) throw new Error("expected error");
      var r2 = scoreAbTitles({ titleA: "Só A", titleB: "" });
      if (r2.ok !== false) throw new Error("missing B should fail");
      var r3 = scoreAbTitles({ titleA: "   ", titleB: "Título B ok" });
      if (r3.ok !== false) throw new Error("blank A should fail");
      return "empty/fail ok";
    });

    /* 65) A/B titles: filled scores + winner + disclaimer */
    push(65, function () {
      var r = scoreAbTitles({
        titleA: "Fone Bluetooth Acme X200 Cancelamento Ruído Preto",
        titleB: "FONE BLUETOOTH MELHOR DO BRASIL CURA ZUMBIDO OFERTA",
        keyword: "fone bluetooth",
        visitasDia: 50,
        convPct: 2
      });
      if (!r.ok) throw new Error(r.error);
      if (!r.a || !r.b) throw new Error("missing a/b");
      if (typeof r.a.score !== "number" || typeof r.b.score !== "number") throw new Error("scores");
      if (r.a.score < r.b.score) throw new Error("A should beat hype B: " + r.a.score + " vs " + r.b.score);
      if (["A", "B", "empate"].indexOf(r.winner) === -1) throw new Error("winner " + r.winner);
      if (typeof r.diffScore !== "number" || r.diffScore < 0 || r.diffScore > 100) throw new Error("diffScore");
      if (!r.advice || !r.advice.trim()) throw new Error("advice");
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("disclaimer");
      if (!r.sampleDays || r.sampleDays < 1) throw new Error("sampleDays");
      return "filled scores ok A=" + r.a.score + " B=" + r.b.score + " w=" + r.winner;
    });

    /* 66) A/B titles: keyword near start preferred */
    push(66, function () {
      var r = scoreAbTitles({
        titleA: "Fone bluetooth Acme X200 cancelamento preto",
        titleB: "Acme modelo X200 preto cancelamento ativo fone bluetooth",
        keyword: "fone bluetooth",
        visitasDia: 40
      });
      if (!r.ok) throw new Error(r.error);
      if (!r.a.hasKeyword || !r.b.hasKeyword) throw new Error("both should have keyword");
      var posB = r.b.title.toLowerCase().indexOf("fone bluetooth");
      if (posB < 40) throw new Error("fixture: B keyword should be after 40, got " + posB);
      if (r.a.score <= r.b.score) throw new Error("keyword-at-start A should score higher: " + r.a.score + " vs " + r.b.score);
      if (r.winner !== "A") throw new Error("winner " + r.winner);
      return "keyword preference ok";
    });

    /* 67) A/B titles: over-60 penalty */
    push(67, function () {
      var shortOk = "Garrafa Térmica Inox 500ml Mantém Gelado";
      var longBad = "Garrafa Térmica Inox 500ml Mantém Gelado Por Horas Ideal Para Academia Trabalho e Viagem Extra XXL";
      if (longBad.length <= 60) throw new Error("fixture not over 60: " + longBad.length);
      var r = scoreAbTitles({
        titleA: shortOk,
        titleB: longBad,
        keyword: "garrafa térmica",
        visitasDia: 50
      });
      if (!r.ok) throw new Error(r.error);
      if (r.b.len <= 60) throw new Error("B len should be raw >60: " + r.b.len);
      if (r.b.score >= r.a.score) throw new Error("over-60 should score lower: A=" + r.a.score + " B=" + r.b.score);
      return "over-60 penalty ok Blen=" + r.b.len;
    });

    /* 68) A/B titles: checklist nonempty + join */
    push(68, function () {
      var r = scoreAbTitles({
        titleA: "Kit Panela Antiaderente 5 Peças Preto",
        titleB: "Jogo de Panelas 5pcs Antiaderente Casa",
        visitasDia: 50
      });
      if (!r.ok) throw new Error(r.error);
      if (!r.checklist || r.checklist.length < 4) throw new Error("checklist len " + (r.checklist && r.checklist.length));
      var joined = joinAbChecklist(r.checklist);
      if (!joined || joined.indexOf("\n") === -1) throw new Error("join checklist");
      if (r.diffScore === 0) throw new Error("different titles should diff>0");
      var same = scoreAbTitles({ titleA: "Mesmo Título 500ml", titleB: "Mesmo Título 500ml" });
      if (!same.ok) throw new Error(same.error);
      if (same.diffScore !== 0) throw new Error("identical diffScore " + same.diffScore);
      if (same.winner !== "empate") throw new Error("identical winner " + same.winner);
      return "checklist ok n=" + r.checklist.length;
    });






    /* 69) listing FAQ: empty/fail */
    push(69, function () {
      var r = generateListingFaq({});
      if (r.ok !== false) throw new Error("expected ok false");
      if (!r.error) throw new Error("expected error");
      var r2 = generateListingFaq({ produto: "   " });
      if (r2.ok !== false) throw new Error("blank produto should fail");
      if (!r2.disclaimer || r2.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("fail disclaimer");
      return "empty/fail ok";
    });

    /* 70) listing FAQ: filled ok, count 6–8, q+a, ESTIMATIVA, copyText */
    push(70, function () {
      var r = generateListingFaq({
        produto: "Garrafa térmica inox 500ml",
        marca: "Acme",
        atributos: "inox 304, 500ml, 12h",
        uso: "academia",
        garantia: "90 dias",
        marketplace: "ml"
      });
      if (!r.ok) throw new Error(r.error);
      if (r.count < 6 || r.count > 8) throw new Error("count " + r.count);
      if (!r.items || r.items.length !== r.count) throw new Error("items mismatch");
      r.items.forEach(function (it, i) {
        if (!it.q || !String(it.q).trim()) throw new Error("empty q @" + i);
        if (!it.a || !String(it.a).trim()) throw new Error("empty a @" + i);
      });
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("disclaimer");
      if (!r.copyText || !String(r.copyText).trim()) throw new Error("copyText empty");
      return "filled ok n=" + r.count;
    });

    /* 71) listing FAQ: marca/atributos appear in answers */
    push(71, function () {
      var r = generateListingFaq({
        produto: "Fone Bluetooth",
        marca: "SonicBrand",
        atributos: "ANC 40mm IPX5",
        marketplace: "ml"
      });
      if (!r.ok) throw new Error(r.error);
      var blob = r.items.map(function (it) { return it.a; }).join(" ");
      if (blob.indexOf("SonicBrand") === -1) throw new Error("marca missing in answers");
      if (blob.indexOf("ANC 40mm IPX5") === -1 && blob.indexOf("ANC") === -1) throw new Error("attrs missing");
      return "marca/attrs woven ok";
    });

    /* 72) listing FAQ: marketplace flavor */
    push(72, function () {
      var ml = generateListingFaq({ produto: "Kit panelas", marketplace: "ml" });
      var amz = generateListingFaq({ produto: "Kit panelas", marketplace: "amazon" });
      if (!ml.ok || !amz.ok) throw new Error("ok");
      var mlBlob = ml.items.map(function (it) { return it.q + " " + it.a; }).join(" ").toLowerCase();
      var amzBlob = amz.items.map(function (it) { return it.q + " " + it.a; }).join(" ").toLowerCase();
      if (mlBlob.indexOf("mercado livre") === -1 && mlBlob.indexOf("frete") === -1) {
        throw new Error("ml flavor missing");
      }
      if (amzBlob.indexOf("amazon") === -1) throw new Error("amazon flavor missing");
      if (mlBlob === amzBlob) throw new Error("ml and amazon should differ");
      if (ml.marketplace !== "ml" || amz.marketplace !== "amazon") throw new Error("marketplace field");
      return "marketplace flavor ok";
    });

    /* 73) listing FAQ: joinListingFaqCopy newline structure */
    push(73, function () {
      var r = generateListingFaq({
        produto: "Mochila notebook 15",
        marca: "BagCo",
        atributos: "15.6 pol, USB",
        marketplace: "shopee"
      });
      if (!r.ok) throw new Error(r.error);
      var joined = joinListingFaqCopy(r.items);
      if (!joined || joined.indexOf("\n") === -1) throw new Error("expected newlines");
      if (joined.indexOf("P: ") === -1 || joined.indexOf("R: ") === -1) throw new Error("P:/R: missing");
      if (joined.indexOf("\n\n") === -1) throw new Error("expected blank line between items");
      if (joined !== r.copyText) throw new Error("copyText should match join");
      return "join copy ok";
    });



    /* 74) ad campaigns: empty / only one → fail */
    push(74, function () {
      var r = compareAdCampaigns({});
      if (r.ok !== false) throw new Error("empty should fail");
      if (!r.error) throw new Error("expected error");
      var r1 = compareAdCampaigns({
        a: { gastoAds: 100, receitaAds: 400 },
        b: { gastoAds: 0, receitaAds: 0 }
      });
      if (r1.ok !== false) throw new Error("only one with gasto should fail");
      if (!r1.disclaimer || r1.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("fail disclaimer");
      return "empty/one fail ok";
    });

    /* 75) ad campaigns: two filled → winner, badges, ESTIMATIVA */
    push(75, function () {
      var r = compareAdCampaigns({
        marketplace: "ml",
        metaAcosPct: 25,
        a: { nome: "Camp A", gastoAds: 100, receitaAds: 500, cliques: 50, impressoes: 2000, pedidos: 10 },
        b: { nome: "Camp B", gastoAds: 200, receitaAds: 500, cliques: 80, impressoes: 4000, pedidos: 8 }
      });
      if (!r.ok) throw new Error(r.error);
      if (!r.campaigns || r.campaigns.length < 2) throw new Error("need 2 campaigns");
      if (r.winner !== "A") throw new Error("winner expected A got " + r.winner);
      var ca = r.campaigns.find(function (c) { return c.id === "A"; });
      var cb = r.campaigns.find(function (c) { return c.id === "B"; });
      if (!ca || !cb) throw new Error("missing A/B");
      if (ca.badge !== "VERDE") throw new Error("A badge " + ca.badge);
      if (cb.badge !== "VERMELHO" && cb.badge !== "AMARELO") throw new Error("B badge " + cb.badge);
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("disclaimer");
      if (!r.advice || !String(r.advice).trim()) throw new Error("advice");
      return "two filled winner=" + r.winner;
    });

    /* 76) ad campaigns: ACOS/ROAS math fixture */
    push(76, function () {
      var r = compareAdCampaigns({
        metaAcosPct: 25,
        a: { gastoAds: 100, receitaAds: 400, cliques: 40, impressoes: 1000, pedidos: 5 },
        b: { gastoAds: 50, receitaAds: 250, cliques: 25, impressoes: 500, pedidos: 4 }
      });
      if (!r.ok) throw new Error(r.error);
      var ca = r.campaigns.find(function (c) { return c.id === "A"; });
      var cb = r.campaigns.find(function (c) { return c.id === "B"; });
      assertClose(ca.acos, 25, 0.001, "A acos");
      assertClose(ca.roas, 4, 0.001, "A roas");
      assertClose(ca.cpc, 2.5, 0.001, "A cpc");
      assertClose(ca.ctr, 4, 0.001, "A ctr");
      assertClose(ca.cpa, 20, 0.001, "A cpa");
      assertClose(cb.acos, 20, 0.001, "B acos");
      assertClose(cb.roas, 5, 0.001, "B roas");
      if (r.winner !== "B") throw new Error("lower ACOS should win B got " + r.winner);
      if (ca.badge !== "VERDE") throw new Error("A badge at meta");
      if (cb.badge !== "VERDE") throw new Error("B badge under meta");
      return "math ok ACOS A=25 B=20";
    });

    /* 77) ad campaigns: optional C + empate path */
    push(77, function () {
      var r = compareAdCampaigns({
        metaAcosPct: 30,
        a: { nome: "X", gastoAds: 100, receitaAds: 400 },
        b: { nome: "Y", gastoAds: 100, receitaAds: 400 },
        c: { nome: "Z", gastoAds: 80, receitaAds: 200 }
      });
      if (!r.ok) throw new Error(r.error);
      if (r.campaigns.length !== 3) throw new Error("expected 3 got " + r.campaigns.length);
      // A and B same ACOS 25 and same ROAS 4 → empate (within 0.5pp)
      if (r.winner !== "empate" && r.winner !== "A" && r.winner !== "B") {
        throw new Error("unexpected winner " + r.winner);
      }
      // exact same acos and roas → empate
      if (r.winner !== "empate") throw new Error("tie should be empate got " + r.winner);
      var r2 = compareAdCampaigns({
        a: { gastoAds: 100, receitaAds: 400 },
        b: { gastoAds: 100, receitaAds: 401 }
      });
      if (!r2.ok) throw new Error(r2.error);
      // acos A=25, B≈24.937 — within 0.5pp; ROAS B slightly higher → B or empate by ROAS
      var ca2 = r2.campaigns.find(function (c) { return c.id === "A"; });
      var cb2 = r2.campaigns.find(function (c) { return c.id === "B"; });
      if (Math.abs(ca2.acos - cb2.acos) > 0.5) throw new Error("fixture acos diff");
      if (r2.winner !== "B") throw new Error("higher ROAS on near-tie should be B got " + r2.winner);
      return "C+empate ok winner=" + r.winner;
    });

    /* 78) ad campaigns: joinAdCampaignsCopy nonempty with ACOS/ROAS */
    push(78, function () {
      var r = compareAdCampaigns({
        a: { nome: "Alpha", gastoAds: 120, receitaAds: 600 },
        b: { nome: "Beta", gastoAds: 90, receitaAds: 300 }
      });
      if (!r.ok) throw new Error(r.error);
      var joined = joinAdCampaignsCopy(r);
      if (!joined || !String(joined).trim()) throw new Error("empty join");
      if (joined.indexOf("ACOS") === -1) throw new Error("ACOS missing in copy");
      if (joined.indexOf("ROAS") === -1) throw new Error("ROAS missing in copy");
      if (joined !== r.copyText) throw new Error("copyText should match join");
      return "join copy ok len=" + joined.length;
    });



    /* 79) preco-minimo-ads: empty / custo<=0 → fail */
    push(79, function () {
      var r = calculatePrecoMinimoAds({});
      if (r.ok !== false) throw new Error("empty should fail");
      if (!r.error) throw new Error("expected error");
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("fail disclaimer");
      var r0 = calculatePrecoMinimoAds({ custoProduto: 0, taxaMarketplacePct: 16, acosMetaPct: 20, lucroDesejadoPct: 20 });
      if (r0.ok !== false) throw new Error("custo 0 should fail");
      return "empty/zero fail ok";
    });

    /* 80) preco-minimo-ads: happy path ML math */
    push(80, function () {
      var r = calculatePrecoMinimoAds({
        marketplace: "ml",
        custoProduto: 50,
        taxaMarketplacePct: 16,
        freteUnitario: 10,
        embalagem: 2,
        acosMetaPct: 20,
        lucroDesejadoPct: 20
      });
      if (!r.ok) throw new Error(r.error);
      assertClose(r.custosFixos, 62, 0.01, "custosFixos");
      assertClose(r.variablePct, 56, 0.01, "variablePct");
      assertClose(r.precoMinimo, 62 / 0.44, 0.02, "precoMinimo");
      assertClose(r.taxaEstimada + r.custoAdsEstimado + r.lucroReais + r.custosFixos, r.precoMinimo, 0.02, "breakdown sum");
      if (r.badge !== "VERDE") throw new Error("badge expected VERDE got " + r.badge);
      if (!r.advice || !String(r.advice).trim()) throw new Error("advice");
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("disclaimer");
      return "happy ML preco=" + r.precoMinimo.toFixed(2);
    });

    /* 81) preco-minimo-ads: variablePct >= 100 → fail */
    push(81, function () {
      var r = calculatePrecoMinimoAds({
        custoProduto: 40,
        taxaMarketplacePct: 40,
        acosMetaPct: 40,
        lucroDesejadoPct: 30
      });
      if (r.ok !== false) throw new Error("variable>=100 should fail");
      if (!r.error || r.error.indexOf("100") === -1) throw new Error("error should mention 100");
      return "high variable fail ok";
    });

    /* 82) preco-minimo-ads: marketplace presets + badge AMARELO/VERMELHO */
    push(82, function () {
      var r = calculatePrecoMinimoAds({ marketplace: "magalu", custoProduto: 80 });
      if (!r.ok) throw new Error(r.error);
      if (r.taxaMarketplacePct !== 14) throw new Error("magalu default taxa " + r.taxaMarketplacePct);
      var rA = calculatePrecoMinimoAds({
        custoProduto: 50,
        taxaMarketplacePct: 16,
        acosMetaPct: 30,
        lucroDesejadoPct: 12
      });
      if (!rA.ok) throw new Error(rA.error);
      if (rA.badge !== "AMARELO") throw new Error("expected AMARELO got " + rA.badge);
      var rV = calculatePrecoMinimoAds({
        custoProduto: 50,
        taxaMarketplacePct: 16,
        acosMetaPct: 40,
        lucroDesejadoPct: 5
      });
      if (!rV.ok) throw new Error(rV.error);
      if (rV.badge !== "VERMELHO") throw new Error("expected VERMELHO got " + rV.badge);
      var rAm = calculatePrecoMinimoAds({ marketplace: "amazon", custoProduto: 30 });
      if (!rAm.ok) throw new Error(rAm.error);
      if (rAm.taxaMarketplacePct !== 15) throw new Error("amazon default " + rAm.taxaMarketplacePct);
      var rSh = calculatePrecoMinimoAds({ marketplace: "shopee", custoProduto: 30 });
      if (!rSh.ok) throw new Error(rSh.error);
      if (rSh.taxaMarketplacePct !== 14) throw new Error("shopee default " + rSh.taxaMarketplacePct);
      return "presets+badges ok";
    });

    /* 83) preco-minimo-ads: joinPrecoMinimoAdsCopy */
    push(83, function () {
      var r = calculatePrecoMinimoAds({
        marketplace: "ml",
        custoProduto: 45,
        freteUnitario: 5,
        acosMetaPct: 18,
        lucroDesejadoPct: 22
      });
      if (!r.ok) throw new Error(r.error);
      var joined = joinPrecoMinimoAdsCopy(r);
      if (!joined || !String(joined).trim()) throw new Error("empty join");
      if (joined.indexOf("Preço mínimo") === -1 && joined.indexOf("preço mínimo") === -1) throw new Error("missing preço mínimo");
      if (joined.indexOf("ESTIMATIVA") === -1) throw new Error("ESTIMATIVA missing");
      if (joined !== r.copyText) throw new Error("copyText should match join");
      return "join copy ok len=" + joined.length;
    });


    /* 84) checklist-anuncio: empty / none checked → score 0 VERMELHO */
    push(84, function () {
      var r = calculateChecklistAnuncio({});
      if (!r.ok) throw new Error("empty checks should still ok");
      if (r.score !== 0) throw new Error("score expected 0 got " + r.score);
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (r.checkedCount !== 0) throw new Error("checkedCount");
      if (r.totalCount < 10) throw new Error("totalCount too small");
      if (!r.missing || r.missing.length !== r.totalCount) throw new Error("missing len");
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("disclaimer");
      if (r.marketplace !== "ml") throw new Error("default marketplace ml got " + r.marketplace);
      return "empty score0 VERMELHO";
    });

    /* 85) checklist-anuncio: full checked → 100 VERDE */
    push(85, function () {
      var items = checklistAnuncioItems("ml");
      var checks = {};
      items.forEach(function (it) { checks[it.id] = true; });
      var r = calculateChecklistAnuncio({ marketplace: "ml", checks: checks });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.score !== 100) throw new Error("score " + r.score);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      if (r.checkedCount !== r.totalCount) throw new Error("checked");
      if (r.missing.length !== 0) throw new Error("missing should be empty");
      if (r.maxScore !== r.score) throw new Error("maxScore");
      return "full 100 VERDE";
    });

    /* 86) checklist-anuncio: partial + array ids + AMARELO band */
    push(86, function () {
      var items = checklistAnuncioItems("amazon");
      var half = Math.ceil(items.length / 2);
      var ids = items.slice(0, half).map(function (it) { return it.id; });
      var r = calculateChecklistAnuncio({ marketplace: "amazon", checks: ids });
      if (!r.ok) throw new Error("partial fail");
      if (r.marketplace !== "amazon") throw new Error("mp");
      if (r.checkedCount !== half) throw new Error("checkedCount " + r.checkedCount);
      if (r.score < 1 || r.score > 99) throw new Error("partial score " + r.score);
      if (r.missing.length !== items.length - half) throw new Error("missing");
      // force AMARELO: check enough weight for 50-79
      var w = 0;
      var total = 0;
      items.forEach(function (it) { total += it.weight; });
      var checks2 = {};
      items.forEach(function (it) {
        if (w / total * 100 < 55) {
          checks2[it.id] = true;
          w += it.weight;
        }
      });
      var r2 = calculateChecklistAnuncio({ marketplace: "shopee", checks: checks2 });
      if (r2.badge !== "AMARELO" && r2.badge !== "VERDE") {
        // if overshot to VERDE, dial back — accept AMARELO primarily
        if (r2.score < 50) throw new Error("expected mid band got " + r2.score + " " + r2.badge);
      }
      if (r2.score >= 50 && r2.score < 80 && r2.badge !== "AMARELO") throw new Error("AMARELO badge");
      if (r2.score >= 80 && r2.badge !== "VERDE") throw new Error("VERDE badge");
      return "partial amazon score=" + r.score + " mid=" + r2.score + "/" + r2.badge;
    });

    /* 87) checklist-anuncio: badge thresholds exact */
    push(87, function () {
      var items = checklistAnuncioItems("magalu");
      var total = 0;
      items.forEach(function (it) { total += it.weight; });
      function scoreWithFraction(frac) {
        var target = frac * total;
        var acc = 0;
        var checks = {};
        // greedily take smallest items to approach target
        var sorted = items.slice().sort(function (a, b) { return a.weight - b.weight; });
        sorted.forEach(function (it) {
          if (acc + it.weight <= target + 0.0001) {
            checks[it.id] = true;
            acc += it.weight;
          }
        });
        return calculateChecklistAnuncio({ marketplace: "magalu", checks: checks });
      }
      var low = calculateChecklistAnuncio({ marketplace: "magalu", checks: {} });
      if (low.badge !== "VERMELHO" || low.score !== 0) throw new Error("low");
      // check only lightest item → should be VERMELHO
      var one = {};
      one[items[0].id] = true;
      var r1 = calculateChecklistAnuncio({ marketplace: "magalu", checks: one });
      if (r1.score >= 50) {
        // if first item is heavy, pick lightest
        var light = items.slice().sort(function (a, b) { return a.weight - b.weight; })[0];
        one = {};
        one[light.id] = true;
        r1 = calculateChecklistAnuncio({ marketplace: "magalu", checks: one });
      }
      if (r1.badge !== "VERMELHO") throw new Error("single light should VERMELHO got " + r1.badge + " score " + r1.score);
      // all but leave enough unchecked for <80 if possible — verify formula
      var all = {};
      items.forEach(function (it) { all[it.id] = true; });
      var full = calculateChecklistAnuncio({ checks: all });
      if (full.badge !== "VERDE" || full.score !== 100) throw new Error("full");
      // synthetic: badge helper via score bands
      if (badgeChecklistAnuncio(49) !== "VERMELHO") throw new Error("49");
      if (badgeChecklistAnuncio(50) !== "AMARELO") throw new Error("50");
      if (badgeChecklistAnuncio(79) !== "AMARELO") throw new Error("79");
      if (badgeChecklistAnuncio(80) !== "VERDE") throw new Error("80");
      return "thresholds ok";
    });

    /* 88) checklist-anuncio: joinChecklistAnuncioCopy + tip marketplace */
    push(88, function () {
      var r = calculateChecklistAnuncio({ marketplace: "ml", checks: ["tituloKeywords"] });
      var joined = joinChecklistAnuncioCopy(r);
      if (!joined || joined.indexOf("Checklist") === -1) throw new Error("title");
      if (joined.indexOf("ESTIMATIVA") === -1) throw new Error("ESTIMATIVA");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      var itemsAm = checklistAnuncioItems("amazon");
      var tipLen = itemsAm.filter(function (it) { return it.id === "tituloLength"; })[0];
      if (!tipLen || tipLen.tip.indexOf("150") === -1) throw new Error("amazon tip length");
      var itemsMl = checklistAnuncioItems("ml");
      var tipMl = itemsMl.filter(function (it) { return it.id === "tituloLength"; })[0];
      if (!tipMl || tipMl.tip.indexOf("60") === -1) throw new Error("ml tip length");
      var tipFoto = itemsAm.filter(function (it) { return it.id === "fotosMinimas"; })[0];
      if (!tipFoto || tipFoto.tip.indexOf("5") === -1) throw new Error("amazon fotos tip");
      return "join+tips ok len=" + joined.length;
    });


    /* 89) breakeven-ads: empty / gasto 0 fail */
    push(89, function () {
      var r = calculateBreakevenAds({});
      if (r.ok) throw new Error("empty should fail");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("disclaimer");
      var r0 = calculateBreakevenAds({ gastoAdsDiario: 0, contribuicaoPorPedido: 20 });
      if (r0.ok) throw new Error("gasto0 should fail");
      var rNeg = calculateBreakevenAds({ gastoAdsDiario: 50, contribuicaoPorPedido: 0 });
      if (rNeg.ok) throw new Error("contrib0 should fail");
      return "fail empty/gasto0/contrib0";
    });

    /* 90) breakeven-ads: happy gasto 100 / contrib 20 → exact 5 ceil 5 */
    push(90, function () {
      var r = calculateBreakevenAds({ gastoAdsDiario: 100, contribuicaoPorPedido: 20, marketplace: "ml" });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.pedidosBreakEvenExact !== 5) throw new Error("exact " + r.pedidosBreakEvenExact);
      if (r.pedidosBreakEven !== 5) throw new Error("ceil " + r.pedidosBreakEven);
      if (r.contribuicaoPorPedido !== 20) throw new Error("contrib");
      if (r.marketplace !== "ml") throw new Error("mp");
      return "happy 5/5";
    });

    /* 91) breakeven-ads: ceil gasto 100 / contrib 30 → exact 3.333… ceil 4 */
    push(91, function () {
      var r = calculateBreakevenAds({ gastoAdsDiario: 100, contribuicaoPorPedido: 30 });
      if (!r.ok) throw new Error(r.error || "fail");
      var exact = 100 / 30;
      if (Math.abs(r.pedidosBreakEvenExact - exact) > 1e-9) throw new Error("exact " + r.pedidosBreakEvenExact);
      if (r.pedidosBreakEven !== 4) throw new Error("ceil expected 4 got " + r.pedidosBreakEven);
      return "ceil 3.333→4";
    });

    /* 92) breakeven-ads: pedidosAtuais profitable → VERDE or AMARELO + lucro+ */
    push(92, function () {
      var r = calculateBreakevenAds({
        gastoAdsDiario: 100,
        contribuicaoPorPedido: 25,
        pedidosAtuaisDia: 8,
        precoVenda: 80
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (!(r.lucroLiquidoDiaEstimado > 0)) throw new Error("lucro " + r.lucroLiquidoDiaEstimado);
      if (r.badge !== "VERDE" && r.badge !== "AMARELO") throw new Error("badge " + r.badge);
      if (r.coberturaPct == null || r.coberturaPct < 100) throw new Error("cobertura " + r.coberturaPct);
      if (r.receitaBreakEven == null || r.receitaBreakEven <= 0) throw new Error("receita");
      // derive path
      var d = calculateBreakevenAds({
        gastoAdsDiario: 50,
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteUnitario: 10
      });
      // contrib = 100 - 40 - 16 - 10 = 34
      if (!d.ok) throw new Error("derive fail " + d.error);
      if (Math.abs(d.contribuicaoPorPedido - 34) > 1e-6) throw new Error("derive contrib " + d.contribuicaoPorPedido);
      return "profitable badge=" + r.badge + " lucro=" + r.lucroLiquidoDiaEstimado;
    });

    /* 93) breakeven-ads: joinBreakevenAdsCopy nonempty + ESTIMATIVA */
    push(93, function () {
      var r = calculateBreakevenAds({ gastoAdsDiario: 80, contribuicaoPorPedido: 16, pedidosAtuaisDia: 3 });
      var joined = joinBreakevenAdsCopy(r);
      if (!joined || !String(joined).trim()) throw new Error("empty join");
      if (joined.indexOf("ESTIMATIVA") === -1) throw new Error("ESTIMATIVA missing");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (joined.indexOf("Break-even") === -1 && joined.indexOf("break-even") === -1 && joined.indexOf("Ads") === -1) {
        throw new Error("missing topic");
      }
      return "join ok len=" + joined.length;
    });

    /* 94) roi-frete-gratis: empty / invalid fail */
    push(94, function () {
      var r = calculateRoiFreteGratis({});
      if (r.ok) throw new Error("empty should fail");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (!r.disclaimer || r.disclaimer.indexOf("ESTIMATIVA") === -1) throw new Error("disclaimer");
      var r0 = calculateRoiFreteGratis({
        precoVenda: 0, custoProduto: 10, taxaMarketplacePct: 16,
        freteUnitario: 12, conversaoSemFreteGratis: 2, conversaoComFreteGratis: 4
      });
      if (r0.ok) throw new Error("preco0 should fail");
      var rNeg = calculateRoiFreteGratis({
        precoVenda: 100, custoProduto: 40, taxaMarketplacePct: 16,
        freteUnitario: 12, conversaoSemFreteGratis: 0, conversaoComFreteGratis: 4
      });
      if (rNeg.ok) throw new Error("convSem0 should fail");
      return "fail empty/preco0/convSem0";
    });

    /* 95) roi-frete-gratis: green lift — frete grátis aumenta lucro */
    push(95, function () {
      // contribSem = 100-40-16-0 = 44; contribCom = 44-12 = 32
      // visitas 100: pedSem=2.5 lucro=110; pedCom=5 lucro=160; delta=+50 VERDE
      var r = calculateRoiFreteGratis({
        marketplace: "ml",
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteUnitario: 12,
        conversaoSemFreteGratis: 2.5,
        conversaoComFreteGratis: 5,
        visitasDia: 100
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.contribuicaoSem - 44) > 1e-6) throw new Error("contribSem " + r.contribuicaoSem);
      if (Math.abs(r.contribuicaoCom - 32) > 1e-6) throw new Error("contribCom " + r.contribuicaoCom);
      if (Math.abs(r.lucroSem - 110) > 1e-6) throw new Error("lucroSem " + r.lucroSem);
      if (Math.abs(r.lucroCom - 160) > 1e-6) throw new Error("lucroCom " + r.lucroCom);
      if (!(r.deltaLucro > 0)) throw new Error("delta " + r.deltaLucro);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      if (Math.abs(r.liftConversaoPct - 100) > 1e-6) throw new Error("lift " + r.liftConversaoPct);
      return "green delta=" + r.deltaLucro;
    });

    /* 96) roi-frete-gratis: red loss — frete grátis piora lucro */
    push(96, function () {
      // contribSem=44; contribCom=44-20=24
      // pedSem=3 lucro=132; pedCom=3.5 lucro=84; delta=-48 VERMELHO
      var r = calculateRoiFreteGratis({
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteUnitario: 20,
        conversaoSemFreteGratis: 3,
        conversaoComFreteGratis: 3.5,
        visitasDia: 100
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (!(r.deltaLucro < 0)) throw new Error("delta " + r.deltaLucro);
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      return "red delta=" + r.deltaLucro;
    });

    /* 97) roi-frete-gratis: break-even conversao + near / contribCom<=0 */
    push(97, function () {
      // lucroSem = 2.5*44=110; need pedidosCom = 110/32 = 3.4375 → conv% = 3.4375
      var r = calculateRoiFreteGratis({
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteUnitario: 12,
        conversaoSemFreteGratis: 2.5,
        conversaoComFreteGratis: 3.4375,
        visitasDia: 100
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.deltaLucro) > 1e-6) throw new Error("delta near0 " + r.deltaLucro);
      if (Math.abs(r.breakEvenConversaoCom - 3.4375) > 1e-6) {
        throw new Error("beConv " + r.breakEvenConversaoCom);
      }
      if (r.badge !== "AMARELO") throw new Error("badge near " + r.badge);
      // contribCom <= 0 → VERMELHO
      var bad = calculateRoiFreteGratis({
        precoVenda: 50,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteUnitario: 20,
        conversaoSemFreteGratis: 2,
        conversaoComFreteGratis: 8,
        visitasDia: 100
      });
      // contrib base = 50-40-8=2; com frete = 2-20 = -18
      if (!bad.ok) throw new Error("neg contrib still ok? " + bad.error);
      if (!(bad.contribuicaoCom <= 0)) throw new Error("expected contribCom<=0");
      if (bad.badge !== "VERMELHO") throw new Error("badge contrib " + bad.badge);
      return "be=" + r.breakEvenConversaoCom + " badge=" + r.badge;
    });

    /* 98) roi-frete-gratis: join copy + default visitas + derive edge */
    push(98, function () {
      var r = calculateRoiFreteGratis({
        marketplace: "shopee",
        precoVenda: 80,
        custoProduto: 30,
        taxaMarketplacePct: 14,
        freteUnitario: 10,
        conversaoSemFreteGratis: 2,
        conversaoComFreteGratis: 3.5
        // visitas default 100
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.visitasDia !== 100) throw new Error("default visitas " + r.visitasDia);
      if (r.marketplace !== "shopee") throw new Error("mp");
      var joined = joinRoiFreteGratisCopy(r);
      if (!joined || !String(joined).trim()) throw new Error("empty join");
      if (joined.indexOf("ESTIMATIVA") === -1) throw new Error("ESTIMATIVA missing");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (joined.indexOf("frete") === -1 && joined.indexOf("Frete") === -1) {
        throw new Error("missing topic");
      }
      if (badgeRoiFreteGratis(r) !== r.badge) throw new Error("badge helper");
      return "join ok len=" + joined.length + " badge=" + r.badge;
    });

    /* 99) desconto-maximo: happy path VERDE — folga >= 5% */
    push(99, function () {
      // custosFixos=40; denom=1-0.16-0.10=0.74; precoMin=40/0.74≈54.054
      // precoAtual=100; desconto≈45.946; pct≈45.95 VERDE
      // contribAtual=100-16-40=44; margem=44%
      var r = calculateDescontoMaximo({
        marketplace: "ml",
        precoAtual: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteAbsorvido: 0,
        custoAdsUnitario: 0,
        margemMinimaPct: 10
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.custosFixosUnit - 40) > 1e-6) throw new Error("custos " + r.custosFixosUnit);
      if (Math.abs(r.precoMinimo - 40 / 0.74) > 1e-6) throw new Error("precoMin " + r.precoMinimo);
      if (Math.abs(r.descontoMaxReais - (100 - 40 / 0.74)) > 1e-6) throw new Error("descR " + r.descontoMaxReais);
      if (!(r.descontoMaxPct >= 5)) throw new Error("pct " + r.descontoMaxPct);
      if (Math.abs(r.contribuicaoAtual - 44) > 1e-6) throw new Error("contrib " + r.contribuicaoAtual);
      if (Math.abs(r.margemAtualPct - 44) > 1e-6) throw new Error("margem " + r.margemAtualPct);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      return "green pct=" + r.descontoMaxPct;
    });

    /* 100) desconto-maximo: already below floor → VERMELHO */
    push(100, function () {
      // precoAtual too low vs precoMin
      // custos=70; denom=0.74; precoMin≈94.59; precoAtual=80 → desconto 0 VERMELHO
      var r = calculateDescontoMaximo({
        precoAtual: 80,
        custoProduto: 70,
        taxaMarketplacePct: 16,
        margemMinimaPct: 10
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (!(r.descontoMaxReais <= 0)) throw new Error("expected no folga " + r.descontoMaxReais);
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      // margem atual also below min when price low
      if (!(r.margemAtualPct < 10)) throw new Error("margem should be low " + r.margemAtualPct);
      return "red no-folga margem=" + r.margemAtualPct;
    });

    /* 101) desconto-maximo: invalid taxa+margem >= 100 */
    push(101, function () {
      var r = calculateDescontoMaximo({
        precoAtual: 100,
        custoProduto: 40,
        taxaMarketplacePct: 60,
        margemMinimaPct: 50
      });
      if (r.ok) throw new Error("should fail denom");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (!r.error || r.error.indexOf("100") === -1) throw new Error("msg " + r.error);
      var empty = calculateDescontoMaximo({});
      if (empty.ok) throw new Error("empty should fail");
      return "fail denom+empty";
    });

    /* 102) desconto-maximo: frete+ads eating margin → AMARELO or VERMELHO */
    push(102, function () {
      // custos=40+8+7=55; denom=0.74; precoMin≈74.324; preco=80
      // desconto≈5.676; pct≈7.09 → still >=5 and margem?
      // taxa=12.8; contrib=80-12.8-55=12.2; margem=15.25% > 10 → VERDE
      // tighter: frete 15 ads 10 → custos=65; precoMin≈87.84; preco=90
      // desconto≈2.16; pct≈2.4 → AMARELO
      var r = calculateDescontoMaximo({
        precoAtual: 90,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteAbsorvido: 15,
        custoAdsUnitario: 10,
        margemMinimaPct: 10
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.custosFixosUnit - 65) > 1e-6) throw new Error("custos " + r.custosFixosUnit);
      if (!(r.descontoMaxPct > 0 && r.descontoMaxPct < 5)) throw new Error("pct " + r.descontoMaxPct);
      if (r.badge !== "AMARELO") throw new Error("badge " + r.badge);
      return "yellow frete+ads pct=" + r.descontoMaxPct;
    });

    /* 103) desconto-maximo: zero price + join copy + defaults */
    push(103, function () {
      var z = calculateDescontoMaximo({
        precoAtual: 0,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        margemMinimaPct: 10
      });
      if (z.ok) throw new Error("preco0 should fail");
      if (z.badge !== "VERMELHO") throw new Error("badge0 " + z.badge);
      var r = calculateDescontoMaximo({
        marketplace: "shopee",
        precoAtual: 120,
        custoProduto: 45
        // taxa default shopee 14; frete/ads 0; margem 10
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.marketplace !== "shopee") throw new Error("mp");
      if (r.taxaMarketplacePct !== 14) throw new Error("default taxa " + r.taxaMarketplacePct);
      if (r.freteAbsorvido !== 0 || r.custoAdsUnitario !== 0) throw new Error("defaults frete/ads");
      if (r.margemMinimaPct !== 10) throw new Error("default margem");
      var joined = joinDescontoMaximoCopy(r);
      if (!joined || !String(joined).trim()) throw new Error("empty join");
      if (joined.indexOf("ESTIMATIVA") === -1) throw new Error("ESTIMATIVA missing");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (joined.indexOf("Desconto") === -1 && joined.indexOf("desconto") === -1) {
        throw new Error("missing topic");
      }
      if (badgeDescontoMaximo(r) !== r.badge) throw new Error("badge helper");
      return "join ok len=" + joined.length + " badge=" + r.badge;
    });

    /* 104) meta-lucro: happy path VERDE — high contrib, low meta */
    push(104, function () {
      // contrib = 100 - 16 - 40 = 44; lucroNec=100; pedidos=ceil(100/44)=3; /30=0.1 VERDE
      var r = calculateMetaLucro({
        marketplace: "ml",
        metaLucroMensal: 100,
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteAbsorvido: 0,
        custoAdsUnitario: 0,
        custosFixosMensais: 0
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.contribuicaoUnit - 44) > 1e-6) throw new Error("contrib " + r.contribuicaoUnit);
      if (r.pedidosNecessarios !== 3) throw new Error("pedidos " + r.pedidosNecessarios);
      if (Math.abs(r.receitaBrutaNecessaria - 300) > 1e-6) throw new Error("receita " + r.receitaBrutaNecessaria);
      if (Math.abs(r.lucroEstimado - (3 * 44)) > 1e-6) throw new Error("lucro " + r.lucroEstimado);
      if (Math.abs(r.pedidosPorDia - 3 / 30) > 1e-9) throw new Error("dia " + r.pedidosPorDia);
      if (Math.abs(r.margemUnitPct - 44) > 1e-6) throw new Error("margem " + r.margemUnitPct);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      return "green pedidos=" + r.pedidosNecessarios;
    });

    /* 105) meta-lucro: high meta → many pedidos → AMARELO or VERMELHO */
    push(105, function () {
      // contrib=44; meta=10000 → pedidos=ceil(10000/44)=228; /30=7.6 AMARELO
      var yellow = calculateMetaLucro({
        metaLucroMensal: 10000,
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16
      });
      if (!yellow.ok) throw new Error(yellow.error || "fail y");
      if (yellow.pedidosNecessarios !== 228) throw new Error("ped y " + yellow.pedidosNecessarios);
      if (yellow.badge !== "AMARELO") throw new Error("badge y " + yellow.badge);
      // meta=30000 → ceil(30000/44)=682; /30≈22.73 VERMELHO
      var red = calculateMetaLucro({
        metaLucroMensal: 30000,
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16
      });
      if (!red.ok) throw new Error(red.error || "fail r");
      if (red.pedidosNecessarios !== 682) throw new Error("ped r " + red.pedidosNecessarios);
      if (red.badge !== "VERMELHO") throw new Error("badge r " + red.badge);
      return "yellow+red pedidos=" + yellow.pedidosNecessarios + "/" + red.pedidosNecessarios;
    });

    /* 106) meta-lucro: negative contribution → fail VERMELHO */
    push(106, function () {
      // 50 - 8 - 45 = -3
      var r = calculateMetaLucro({
        metaLucroMensal: 500,
        precoVenda: 50,
        custoProduto: 45,
        taxaMarketplacePct: 16
      });
      if (r.ok) throw new Error("should fail neg contrib");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (!(r.contribuicaoUnit <= 0)) throw new Error("contrib " + r.contribuicaoUnit);
      if (!r.error || r.error.toLowerCase().indexOf("contrib") === -1) {
        throw new Error("msg " + r.error);
      }
      return "red neg-contrib=" + r.contribuicaoUnit;
    });

    /* 107) meta-lucro: empty/invalid inputs */
    push(107, function () {
      var empty = calculateMetaLucro({});
      if (empty.ok) throw new Error("empty should fail");
      if (empty.badge !== "VERMELHO") throw new Error("badge empty");
      var zMeta = calculateMetaLucro({
        metaLucroMensal: 0,
        precoVenda: 100,
        custoProduto: 40
      });
      if (zMeta.ok) throw new Error("meta0 should fail");
      var zPreco = calculateMetaLucro({
        metaLucroMensal: 500,
        precoVenda: 0,
        custoProduto: 40
      });
      if (zPreco.ok) throw new Error("preco0 should fail");
      var negCusto = calculateMetaLucro({
        metaLucroMensal: 500,
        precoVenda: 100,
        custoProduto: -1
      });
      if (negCusto.ok) throw new Error("custo neg should fail");
      return "invalids ok";
    });

    /* 108) meta-lucro: custosFixosMensais increases pedidos; join copy */
    push(108, function () {
      var base = calculateMetaLucro({
        marketplace: "shopee",
        metaLucroMensal: 440,
        precoVenda: 100,
        custoProduto: 40
        // taxa default shopee 14; contrib=100-14-40=46; lucroNec=440; pedidos=ceil(440/46)=10
      });
      if (!base.ok) throw new Error(base.error || "fail base");
      if (base.taxaMarketplacePct !== 14) throw new Error("default taxa " + base.taxaMarketplacePct);
      if (Math.abs(base.contribuicaoUnit - 46) > 1e-6) throw new Error("contrib " + base.contribuicaoUnit);
      if (base.pedidosNecessarios !== 10) throw new Error("base ped " + base.pedidosNecessarios);
      var withFix = calculateMetaLucro({
        marketplace: "shopee",
        metaLucroMensal: 440,
        precoVenda: 100,
        custoProduto: 40,
        custosFixosMensais: 460
        // lucroNec=900; ceil(900/46)=20
      });
      if (!withFix.ok) throw new Error(withFix.error || "fail fix");
      if (withFix.pedidosNecessarios !== 20) throw new Error("fix ped " + withFix.pedidosNecessarios);
      if (!(withFix.pedidosNecessarios > base.pedidosNecessarios)) {
        throw new Error("fixos should increase pedidos");
      }
      var joined = joinMetaLucroCopy(withFix);
      if (!joined || !String(joined).trim()) throw new Error("empty join");
      if (joined.indexOf("ESTIMATIVA") === -1) throw new Error("ESTIMATIVA missing");
      if (joined !== withFix.copyText) throw new Error("copyText mismatch");
      if (badgeMetaLucro(withFix) !== withFix.badge) throw new Error("badge helper");
      return "fixos+join ped=" + withFix.pedidosNecessarios + " badge=" + withFix.badge;
    });



    /* 109) estoque-minimo: happy path VERDE — stock well above target */
    push(109, function () {
      // vendas=10, lead=5 → demandaLead=50; seg=10*7=70; ROP=ceil(120)=120; alvo=120+50=170
      // estoqueAtual=250 > alvo → VERDE; precisaComprar=false; qtd=0
      var r = calculateEstoqueMinimo({
        vendasPorDia: 10,
        leadTimeDias: 5,
        coberturaSegurancaDias: 7,
        estoqueAtual: 250,
        custoUnitario: 20,
        taxaCapitalMensalPct: 1
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.demandaLead !== 50) throw new Error("demandaLead " + r.demandaLead);
      if (r.estoqueSeguranca !== 70) throw new Error("seg " + r.estoqueSeguranca);
      if (r.pontoPedido !== 120) throw new Error("rop " + r.pontoPedido);
      if (r.estoqueMinimoSugerido !== 120) throw new Error("min " + r.estoqueMinimoSugerido);
      if (r.estoqueAlvo !== 170) throw new Error("alvo " + r.estoqueAlvo);
      if (r.precisaComprarAgora) throw new Error("should not buy");
      if (r.qtdSugeridaCompra !== 0) throw new Error("qtd " + r.qtdSugeridaCompra);
      if (Math.abs(r.diasAteRuptura - 25) > 1e-9) throw new Error("dias " + r.diasAteRuptura);
      if (Math.abs(r.capitalTravado - 170 * 20) > 1e-6) throw new Error("cap " + r.capitalTravado);
      if (Math.abs(r.custoCapitalMensal - 3400 * 0.01) > 1e-6) throw new Error("cc " + r.custoCapitalMensal);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      return "green rop=" + r.pontoPedido + " alvo=" + r.estoqueAlvo;
    });

    /* 110) estoque-minimo: at/below ROP → VERMELHO + buy qty */
    push(110, function () {
      // same ROP=120 alvo=170; estoqueAtual=100 → precisa comprar; qtd=70
      var r = calculateEstoqueMinimo({
        vendasPorDia: 10,
        leadTimeDias: 5,
        coberturaSegurancaDias: 7,
        estoqueAtual: 100,
        custoUnitario: 15
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (!r.precisaComprarAgora) throw new Error("should buy");
      if (r.qtdSugeridaCompra !== 70) throw new Error("qtd " + r.qtdSugeridaCompra);
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (Math.abs(r.diasAteRuptura - 10) > 1e-9) throw new Error("dias " + r.diasAteRuptura);
      // dias 10 == lead 5? 10 > 5 but still VERMELHO because precisaComprar
      return "red buy qtd=" + r.qtdSugeridaCompra;
    });

    /* 111) estoque-minimo: AMARELO — within 20% above ROP */
    push(111, function () {
      // ROP=120; 20% above = 144; estoqueAtual=130 → AMARELO (within 20%, below alvo 170)
      var r = calculateEstoqueMinimo({
        vendasPorDia: 10,
        leadTimeDias: 5,
        coberturaSegurancaDias: 7,
        estoqueAtual: 130,
        custoUnitario: 10
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.precisaComprarAgora) throw new Error("should not buy yet");
      if (r.badge !== "AMARELO") throw new Error("badge " + r.badge);
      if (r.qtdSugeridaCompra !== 40) throw new Error("qtd " + r.qtdSugeridaCompra);
      return "yellow stock=" + r.estoqueAtual;
    });

    /* 112) estoque-minimo: invalid inputs + diasAteRuptura < lead → VERMELHO */
    push(112, function () {
      var empty = calculateEstoqueMinimo({});
      if (empty.ok) throw new Error("empty should fail");
      if (empty.badge !== "VERMELHO") throw new Error("badge empty");
      var zVendas = calculateEstoqueMinimo({
        vendasPorDia: 0,
        leadTimeDias: 5,
        estoqueAtual: 10,
        custoUnitario: 5
      });
      if (zVendas.ok) throw new Error("vendas0 should fail");
      var negLead = calculateEstoqueMinimo({
        vendasPorDia: 5,
        leadTimeDias: -1,
        estoqueAtual: 10,
        custoUnitario: 5
      });
      if (negLead.ok) throw new Error("neg lead should fail");
      // diasAteRuptura = 20/10 = 2 < lead 5 → VERMELHO even if above ROP?
      // ROP = ceil(10*5 + 10*7)=120; estoque 20 << ROP anyway
      var rupture = calculateEstoqueMinimo({
        vendasPorDia: 10,
        leadTimeDias: 5,
        coberturaSegurancaDias: 7,
        estoqueAtual: 20,
        custoUnitario: 8
      });
      if (!rupture.ok) throw new Error(rupture.error || "fail rupture");
      if (!(rupture.diasAteRuptura < rupture.leadTimeDias)) throw new Error("dias vs lead");
      if (rupture.badge !== "VERMELHO") throw new Error("badge rupture " + rupture.badge);
      return "invalids+rupture ok";
    });

    /* 113) estoque-minimo: defaults cobertura/taxa; ceil; join copy */
    push(113, function () {
      // vendas=3.2 lead=4 → demanda=12.8; cobertura default 7 → seg=22.4; ROP=ceil(35.2)=36
      // alvo=36+12.8=48.8 → wait: demandaLead kept as float, estoqueAlvo = pontoPedido + demandaLead
      // Spec: estoqueAlvo = pontoPedido + demandaLead (may be float) — use as-is or ceil?
      // Prefer: demandaLead raw float; pontoPedido ceil; estoqueAlvo = pontoPedido + demandaLead
      // But qtdSugerida should be sensible — ceil on qtd: max(0, ceil(alvo - atual)) OR max(0, alvo-atual) if alvo int
      // Spec says: estoqueAlvo = pontoPedido + demandaLead; qtdSugeridaCompra = max(0, estoqueAlvo - estoqueAtual)
      // For clean integers in UI, ceil estoqueAlvo: Math.ceil(pontoPedido + demandaLead) — but spec says pontoPedido + demandaLead
      // I'll keep demandaLead as number (may float), estoqueAlvo = pontoPedido + demandaLead, qtd = max(0, Math.ceil(estoqueAlvo - estoqueAtual)) for buy qty integers
      // Actually re-read: qtdSugeridaCompra = max(0, estoqueAlvo - estoqueAtual) — if float ok. Better ceil qtd for sellers.
      // Looking at my implementation plan: use Math.ceil for pontoPedido; demandaLead exact; estoqueAlvo = pontoPedido + Math.ceil(demandaLead) for clean ints OR pontoPedido + demandaLead
      // Spec: "estoqueAlvo = pontoPedido + demandaLead" — I'll follow exactly; qtd can be float then Math.max(0, ...) 
      // For test with 3.2*4=12.8; ROP=ceil(12.8+22.4)=ceil(35.2)=36; alvo=36+12.8=48.8; atual=40; qtd=8.8
      var r = calculateEstoqueMinimo({
        vendasPorDia: 3.2,
        leadTimeDias: 4,
        // cobertura default 7
        estoqueAtual: 40,
        custoUnitario: 25
        // taxa default 1
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.coberturaSegurancaDias !== 7) throw new Error("default cob " + r.coberturaSegurancaDias);
      if (r.taxaCapitalMensalPct !== 1) throw new Error("default taxa " + r.taxaCapitalMensalPct);
      if (Math.abs(r.demandaLead - 12.8) > 1e-9) throw new Error("demanda " + r.demandaLead);
      if (Math.abs(r.estoqueSeguranca - 22.4) > 1e-9) throw new Error("seg " + r.estoqueSeguranca);
      if (r.pontoPedido !== 36) throw new Error("rop " + r.pontoPedido);
      if (Math.abs(r.estoqueAlvo - 48.8) > 1e-9) throw new Error("alvo " + r.estoqueAlvo);
      if (Math.abs(r.qtdSugeridaCompra - 8.8) > 1e-9) throw new Error("qtd " + r.qtdSugeridaCompra);
      var joined = joinEstoqueMinimoCopy(r);
      if (!joined || !String(joined).trim()) throw new Error("empty join");
      if (joined.indexOf("ESTIMATIVA") === -1) throw new Error("ESTIMATIVA missing");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (badgeEstoqueMinimo(r) !== r.badge) throw new Error("badge helper");
      if (joined.indexOf("Estoque") === -1 && joined.indexOf("estoque") === -1) {
        throw new Error("missing topic");
      }
      return "defaults+join rop=" + r.pontoPedido + " badge=" + r.badge;
    });



    /* 114) imposto-simples: happy path VERDE — margem líquida >= alvo */
    push(114, function () {
      // preco=100, custo=40, taxa=16%, frete=0, outros=0, aliquota=6%, margemMin=15%
      // taxaMP=16, das=6, custoTotal=40+16+0+0+6=62, lucro=38, margem=38%
      // Fixed=40, denom=1-0.16-0.06-0.15=0.63, precoMin=40/0.63≈63.492
      var r = calculateImpostoSimples({
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteAbsorvido: 0,
        outrosCustos: 0,
        aliquotaSimplesPct: 6,
        margemMinimaDesejadaPct: 15
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.taxaMarketplace - 16) > 1e-9) throw new Error("taxaMP " + r.taxaMarketplace);
      if (Math.abs(r.das - 6) > 1e-9) throw new Error("das " + r.das);
      if (Math.abs(r.custoTotal - 62) > 1e-9) throw new Error("custoTotal " + r.custoTotal);
      if (Math.abs(r.lucroLiquido - 38) > 1e-9) throw new Error("lucro " + r.lucroLiquido);
      if (Math.abs(r.margemLiquidaPct - 38) > 1e-9) throw new Error("margem " + r.margemLiquidaPct);
      if (Math.abs(r.precoMinimo - 40 / 0.63) > 1e-6) throw new Error("precoMin " + r.precoMinimo);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      if (Math.abs(r.lucroBrutoAntesDas - 44) > 1e-9) throw new Error("bruto " + r.lucroBrutoAntesDas);
      if (Math.abs(r.dasPctDoLucroBruto - (6 / 44) * 100) > 1e-6) throw new Error("das% " + r.dasPctDoLucroBruto);
      return "happy verde margem=" + r.margemLiquidaPct;
    });

    /* 115) imposto-simples: loss → VERMELHO */
    push(115, function () {
      // preco=50, custo=40, taxa=16%, frete=5, outros=2, aliquota=6%
      // taxaMP=8, das=3, custoTotal=40+8+5+2+3=58, lucro=-8, margem=-16%
      var r = calculateImpostoSimples({
        precoVenda: 50,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteAbsorvido: 5,
        outrosCustos: 2,
        aliquotaSimplesPct: 6,
        margemMinimaDesejadaPct: 15
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (!(r.lucroLiquido < 0)) throw new Error("expected loss " + r.lucroLiquido);
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      return "loss lucro=" + r.lucroLiquido;
    });

    /* 116) imposto-simples: preço mínimo + AMARELO (lucro>=0 mas < alvo) */
    push(116, function () {
      // preco=80, custo=40, taxa=16%, frete=0, outros=0, a=6%, m=15%
      // taxaMP=12.8, das=4.8, custoTotal=57.6, lucro=22.4, margem=28% → wait that's VERDE
      // Need margem between 0 and 15. Try preco closer to floor.
      // Fixed=40, denom=0.63, precoMin≈63.492. At precoMin, margem=15% → VERDE boundary.
      // For AMARELO: preço such that 0 <= margem < 15. e.g. preco=70
      // taxa=11.2, das=4.2, custoTotal=55.4, lucro=14.6, margem≈20.86% still VERDE
      // Need lower: preco=60 → taxa=9.6, das=3.6, total=53.2, lucro=6.8, margem≈11.33% AMARELO
      var r = calculateImpostoSimples({
        precoVenda: 60,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteAbsorvido: 0,
        outrosCustos: 0,
        aliquotaSimplesPct: 6,
        margemMinimaDesejadaPct: 15
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (!(r.lucroLiquido >= 0)) throw new Error("expected non-neg " + r.lucroLiquido);
      if (!(r.margemLiquidaPct < 15)) throw new Error("expected below target " + r.margemLiquidaPct);
      if (!(r.precoVenda < r.precoMinimo)) throw new Error("expected below precoMin");
      if (r.badge !== "AMARELO") throw new Error("badge " + r.badge + " margem=" + r.margemLiquidaPct);
      var gap = r.gapPrecoVsMinimo;
      if (!(gap > 0)) throw new Error("gap should be positive (need raise) " + gap);
      return "amarelo margem=" + (Math.round(r.margemLiquidaPct * 100) / 100);
    });

    /* 117) imposto-simples: denom ≤ 0 → error VERMELHO */
    push(117, function () {
      var r = calculateImpostoSimples({
        precoVenda: 100,
        custoProduto: 40,
        taxaMarketplacePct: 50,
        freteAbsorvido: 0,
        outrosCustos: 0,
        aliquotaSimplesPct: 40,
        margemMinimaDesejadaPct: 20
      });
      if (r.ok) throw new Error("expected fail denom");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      if (!r.error || String(r.error).indexOf("100%") === -1) throw new Error("msg " + r.error);
      return "denom fail ok";
    });

    /* 118) imposto-simples: zero/invalid price + defaults + join copy */
    push(118, function () {
      var z = calculateImpostoSimples({
        precoVenda: 0,
        custoProduto: 10
      });
      if (z.ok) throw new Error("zero price should fail");
      if (z.badge !== "VERMELHO") throw new Error("badge zero");
      var empty = calculateImpostoSimples({});
      if (empty.ok) throw new Error("empty should fail");
      var r = calculateImpostoSimples({
        precoVenda: 100,
        custoProduto: 40
        // defaults: taxa 16, frete 0, outros 0, aliquota 6, margem 15
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.taxaMarketplacePct !== 16) throw new Error("default taxa " + r.taxaMarketplacePct);
      if (r.aliquotaSimplesPct !== 6) throw new Error("default aliq " + r.aliquotaSimplesPct);
      if (r.margemMinimaDesejadaPct !== 15) throw new Error("default margem " + r.margemMinimaDesejadaPct);
      if (r.freteAbsorvido !== 0 || r.outrosCustos !== 0) throw new Error("default zeros");
      var joined = joinImpostoSimplesCopy(r);
      if (!joined || joined.indexOf("ESTIMATIVA") === -1) throw new Error("join");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (badgeImpostoSimples(r) !== r.badge) throw new Error("badge helper");
      if (joined.toLowerCase().indexOf("simples") === -1 && joined.toLowerCase().indexOf("das") === -1) {
        throw new Error("missing topic");
      }
      return "defaults+join badge=" + r.badge;
    });



    /* 119) capital-giro: happy path VERDE — ciclo curto */
    push(119, function () {
      // ticket=89, custo=35, pedidos=120, lead=5, cob=10, prazo=7, taxa=16, frete=0
      // demanda=4; est=4*10*35=1400; lead=4*5*35=700; recUnit=89*0.84=74.76;
      // receber=4*7*74.76=2093.28; total=4193.28; dias=22; giro=365/22
      // vendasMes=10680; total < 0.5*vendas → VERDE; dias<=45 → VERDE
      var r = calculateCapitalGiro({
        ticketMedio: 89,
        custoProduto: 35,
        pedidosPorMes: 120,
        leadTimeCompraDias: 5,
        estoqueCoberturaDias: 10,
        prazoRepasseDias: 7,
        taxaMarketplacePct: 16,
        freteAbsorvidoPorPedido: 0
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.demandaDiaria - 4) > 1e-9) throw new Error("demanda " + r.demandaDiaria);
      if (Math.abs(r.capitalEstoque - 1400) > 1e-6) throw new Error("estoque " + r.capitalEstoque);
      if (Math.abs(r.capitalLead - 700) > 1e-6) throw new Error("lead " + r.capitalLead);
      if (Math.abs(r.receitaLiquidaUnit - 74.76) > 1e-9) throw new Error("recUnit " + r.receitaLiquidaUnit);
      if (Math.abs(r.capitalReceber - 2093.28) > 1e-6) throw new Error("receber " + r.capitalReceber);
      if (Math.abs(r.capitalGiroTotal - 4193.28) > 1e-6) throw new Error("total " + r.capitalGiroTotal);
      if (r.diasCiclo !== 22) throw new Error("dias " + r.diasCiclo);
      if (Math.abs(r.giroAno - 365 / 22) > 1e-9) throw new Error("giro " + r.giroAno);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      return "happy verde total=" + r.capitalGiroTotal;
    });

    /* 120) capital-giro: ciclo longo / float pesado → AMARELO */
    push(120, function () {
      // defaults: lead=15, cob=20, prazo=14 → dias=49 > 45 → AMARELO
      // also total = 2800+2100+4186.56=9086.56 > 0.5*10680=5340
      var r = calculateCapitalGiro({
        ticketMedio: 89,
        custoProduto: 35,
        pedidosPorMes: 120,
        leadTimeCompraDias: 15,
        estoqueCoberturaDias: 20,
        prazoRepasseDias: 14,
        taxaMarketplacePct: 16,
        freteAbsorvidoPorPedido: 0
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.diasCiclo !== 49) throw new Error("dias " + r.diasCiclo);
      if (Math.abs(r.capitalEstoque - 2800) > 1e-6) throw new Error("estoque " + r.capitalEstoque);
      if (Math.abs(r.capitalLead - 2100) > 1e-6) throw new Error("lead " + r.capitalLead);
      if (Math.abs(r.capitalReceber - 4186.56) > 1e-6) throw new Error("receber " + r.capitalReceber);
      if (Math.abs(r.capitalGiroTotal - 9086.56) > 1e-6) throw new Error("total " + r.capitalGiroTotal);
      if (r.badge !== "AMARELO") throw new Error("badge " + r.badge);
      return "amarelo dias=" + r.diasCiclo + " total=" + r.capitalGiroTotal;
    });

    /* 121) capital-giro: receita líquida ≤ 0 → VERMELHO */
    push(121, function () {
      var r = calculateCapitalGiro({
        ticketMedio: 50,
        custoProduto: 20,
        pedidosPorMes: 30,
        leadTimeCompraDias: 5,
        estoqueCoberturaDias: 5,
        prazoRepasseDias: 7,
        taxaMarketplacePct: 80,
        freteAbsorvidoPorPedido: 15
      });
      // receitaLiquidaUnit = 50*0.2 - 15 = 10-15 = -5 ≤ 0
      if (!r.ok) throw new Error(r.error || "fail");
      if (!(r.receitaLiquidaUnit <= 0)) throw new Error("expected non-pos rec " + r.receitaLiquidaUnit);
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      return "vermelho recUnit=" + r.receitaLiquidaUnit;
    });

    /* 122) capital-giro: inputs inválidos → error VERMELHO */
    push(122, function () {
      var r = calculateCapitalGiro({
        ticketMedio: 0,
        custoProduto: 10,
        pedidosPorMes: 10
      });
      if (r.ok) throw new Error("expected fail zero ticket");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      var neg = calculateCapitalGiro({
        ticketMedio: 50,
        custoProduto: -1,
        pedidosPorMes: 10
      });
      if (neg.ok) throw new Error("expected fail neg custo");
      return "invalid ok";
    });

    /* 123) capital-giro: defaults + join copy */
    push(123, function () {
      var empty = calculateCapitalGiro({});
      if (empty.ok) throw new Error("empty should fail (missing ticket/custo/pedidos)");
      var r = calculateCapitalGiro({
        ticketMedio: 89,
        custoProduto: 35,
        pedidosPorMes: 120
        // defaults: lead 15, cob 20, prazo 14, taxa 16, frete 0
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.leadTimeCompraDias !== 15) throw new Error("default lead " + r.leadTimeCompraDias);
      if (r.estoqueCoberturaDias !== 20) throw new Error("default cob " + r.estoqueCoberturaDias);
      if (r.prazoRepasseDias !== 14) throw new Error("default prazo " + r.prazoRepasseDias);
      if (r.taxaMarketplacePct !== 16) throw new Error("default taxa " + r.taxaMarketplacePct);
      if (r.freteAbsorvidoPorPedido !== 0) throw new Error("default frete " + r.freteAbsorvidoPorPedido);
      var joined = joinCapitalGiroCopy(r);
      if (!joined || joined.indexOf("ESTIMATIVA") === -1) throw new Error("join");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (badgeCapitalGiro(r) !== r.badge) throw new Error("badge helper");
      if (joined.toLowerCase().indexOf("giro") === -1 && joined.toLowerCase().indexOf("capital") === -1) {
        throw new Error("missing topic");
      }
      return "defaults+join badge=" + r.badge;
    });


    /* 124) custo-devolucao: happy path VERDE — defaults */
    push(124, function () {
      // ticket=89, custo=35, taxa=16, freteIda=12, freteVolta=18, pack=5, taxaDev=8, pedidos=120
      // recUnit=74.76; margem=27.76; direto=70; devMes=9.6; custoMes=672;
      // lucroSem=3331.2; lucroApos=2659.2; porPedido=5.6; be≈39.657%
      var r = calculateCustoDevolucao({
        ticketMedio: 89,
        custoProduto: 35,
        taxaMarketplacePct: 16,
        freteIdaPorPedido: 12,
        freteVoltaPorDevolucao: 18,
        custoRepackingOuRetrabalho: 5,
        taxaDevolucaoPct: 8,
        pedidosPorMes: 120
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.receitaLiquidaUnit - 74.76) > 1e-9) throw new Error("recUnit " + r.receitaLiquidaUnit);
      if (Math.abs(r.margemBrutaUnit - 27.76) > 1e-9) throw new Error("margem " + r.margemBrutaUnit);
      if (Math.abs(r.custoDiretoPorDevolucao - 70) > 1e-9) throw new Error("direto " + r.custoDiretoPorDevolucao);
      if (Math.abs(r.devolucoesMes - 9.6) > 1e-9) throw new Error("devMes " + r.devolucoesMes);
      if (Math.abs(r.custoDevolucoesMes - 672) > 1e-6) throw new Error("custoMes " + r.custoDevolucoesMes);
      if (Math.abs(r.lucroBrutoMesSemDev - 3331.2) > 1e-6) throw new Error("lucroSem " + r.lucroBrutoMesSemDev);
      if (Math.abs(r.lucroLiquidoAposDev - 2659.2) > 1e-6) throw new Error("lucroApos " + r.lucroLiquidoAposDev);
      if (Math.abs(r.custoPorPedidoVendido - 5.6) > 1e-9) throw new Error("porPedido " + r.custoPorPedidoVendido);
      if (Math.abs(r.breakEvenTaxaDevPct - (27.76 / 70) * 100) > 1e-9) {
        throw new Error("be " + r.breakEvenTaxaDevPct);
      }
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      return "happy verde direto=" + r.custoDiretoPorDevolucao;
    });

    /* 125) custo-devolucao: taxa alta / custo >30% lucro → AMARELO */
    push(125, function () {
      // taxaDev=12 → custoMes=1008 > 0.3*3331.2=999.36 → AMARELO (also taxa>10)
      var r = calculateCustoDevolucao({
        ticketMedio: 89,
        custoProduto: 35,
        taxaMarketplacePct: 16,
        freteIdaPorPedido: 12,
        freteVoltaPorDevolucao: 18,
        custoRepackingOuRetrabalho: 5,
        taxaDevolucaoPct: 12,
        pedidosPorMes: 120
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.custoDevolucoesMes - 1008) > 1e-6) throw new Error("custoMes " + r.custoDevolucoesMes);
      if (r.badge !== "AMARELO") throw new Error("badge " + r.badge);
      return "amarelo taxaDev=" + r.taxaDevolucaoPct;
    });

    /* 126) custo-devolucao: taxa ≥ break-even / lucro ≤ 0 → VERMELHO */
    push(126, function () {
      var r = calculateCustoDevolucao({
        ticketMedio: 89,
        custoProduto: 35,
        taxaMarketplacePct: 16,
        freteIdaPorPedido: 12,
        freteVoltaPorDevolucao: 18,
        custoRepackingOuRetrabalho: 5,
        taxaDevolucaoPct: 40,
        pedidosPorMes: 120
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (!(r.lucroLiquidoAposDev <= 0)) throw new Error("expected non-pos lucro " + r.lucroLiquidoAposDev);
      if (!(r.taxaDevolucaoPct >= r.breakEvenTaxaDevPct)) throw new Error("expected >= be");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      var negMargem = calculateCustoDevolucao({
        ticketMedio: 50,
        custoProduto: 40,
        taxaMarketplacePct: 16,
        freteIdaPorPedido: 12,
        freteVoltaPorDevolucao: 18,
        custoRepackingOuRetrabalho: 5,
        taxaDevolucaoPct: 5,
        pedidosPorMes: 50
      });
      // rec=42; margem=42-40-12=-10 ≤ 0
      if (!negMargem.ok) throw new Error(negMargem.error || "fail margem");
      if (!(negMargem.margemBrutaUnit <= 0)) throw new Error("expected non-pos margem");
      if (negMargem.badge !== "VERMELHO") throw new Error("badge margem " + negMargem.badge);
      return "vermelho lucro=" + r.lucroLiquidoAposDev;
    });

    /* 127) custo-devolucao: inputs inválidos → error VERMELHO */
    push(127, function () {
      var r = calculateCustoDevolucao({
        ticketMedio: 0,
        custoProduto: 10,
        pedidosPorMes: 10
      });
      if (r.ok) throw new Error("expected fail zero ticket");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      var neg = calculateCustoDevolucao({
        ticketMedio: 50,
        custoProduto: -1,
        pedidosPorMes: 10
      });
      if (neg.ok) throw new Error("expected fail neg custo");
      return "invalid ok";
    });

    /* 128) custo-devolucao: defaults + join copy */
    push(128, function () {
      var empty = calculateCustoDevolucao({});
      if (empty.ok) throw new Error("empty should fail (missing ticket/custo/pedidos)");
      var r = calculateCustoDevolucao({
        ticketMedio: 89,
        custoProduto: 35,
        pedidosPorMes: 120
        // defaults: taxa 16, freteIda 12, freteVolta 18, pack 5, taxaDev 8
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.taxaMarketplacePct !== 16) throw new Error("default taxa " + r.taxaMarketplacePct);
      if (r.freteIdaPorPedido !== 12) throw new Error("default ida " + r.freteIdaPorPedido);
      if (r.freteVoltaPorDevolucao !== 18) throw new Error("default volta " + r.freteVoltaPorDevolucao);
      if (r.custoRepackingOuRetrabalho !== 5) throw new Error("default pack " + r.custoRepackingOuRetrabalho);
      if (r.taxaDevolucaoPct !== 8) throw new Error("default taxaDev " + r.taxaDevolucaoPct);
      var joined = joinCustoDevolucaoCopy(r);
      if (!joined || joined.indexOf("ESTIMATIVA") === -1) throw new Error("join");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (badgeCustoDevolucao(r) !== r.badge) throw new Error("badge helper");
      if (
        joined.toLowerCase().indexOf("devolu") === -1 &&
        joined.toLowerCase().indexOf("retorno") === -1
      ) {
        throw new Error("missing topic");
      }
      return "defaults+join badge=" + r.badge;
    });



    /* 129) prazo-repasse: happy path VERDE — defaults */
    push(129, function () {
      // vendas=8, ticket=89, prazo=14, taxa=16, custo=35, frete=12
      // liquido=74.76; caixaSaida=47; margem=27.76
      // floatReceber=8*14*74.76=8373.12; floatJaGasto=8*14*47=5264
      // margemDia=222.08; ratio≈23.70 < 30; prazo 14 < 21 → VERDE
      var r = calculatePrazoRepasse({
        vendasPorDia: 8,
        ticketMedio: 89,
        prazoRepasseDias: 14,
        taxaMarketplacePct: 16,
        custoProdutoUnit: 35,
        fretePagoPeloSellerUnit: 12
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.receitaBrutaDia - 712) > 1e-9) throw new Error("receitaDia " + r.receitaBrutaDia);
      if (Math.abs(r.liquidoPorPedidoAposTaxa - 74.76) > 1e-9) throw new Error("liquido " + r.liquidoPorPedidoAposTaxa);
      if (Math.abs(r.caixaSaidaPorPedido - 47) > 1e-9) throw new Error("caixaSaida " + r.caixaSaidaPorPedido);
      if (Math.abs(r.floatReceber - 8373.12) > 1e-6) throw new Error("floatReceber " + r.floatReceber);
      if (Math.abs(r.floatJaGasto - 5264) > 1e-6) throw new Error("floatJaGasto " + r.floatJaGasto);
      if (Math.abs(r.necessidadeCaixa - 5264) > 1e-6) throw new Error("necessidade " + r.necessidadeCaixa);
      if (r.diasAtePrimeiroRepasse !== 14) throw new Error("dias " + r.diasAtePrimeiroRepasse);
      if (Math.abs(r.margemPorPedido - 27.76) > 1e-9) throw new Error("margem " + r.margemPorPedido);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      return "happy verde necessidade=" + r.necessidadeCaixa;
    });

    /* 130) prazo-repasse: prazo ≥ 21 OU float > 30 dias de margem → AMARELO */
    push(130, function () {
      var r = calculatePrazoRepasse({
        vendasPorDia: 8,
        ticketMedio: 89,
        prazoRepasseDias: 21,
        taxaMarketplacePct: 16,
        custoProdutoUnit: 35,
        fretePagoPeloSellerUnit: 12
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.prazoEfetivoDias !== 21) throw new Error("prazoEfetivo " + r.prazoEfetivoDias);
      if (Math.abs(r.floatJaGasto - 8 * 21 * 47) > 1e-6) throw new Error("float " + r.floatJaGasto);
      if (r.badge !== "AMARELO") throw new Error("badge " + r.badge);
      return "amarelo prazo=" + r.prazoRepasseDias;
    });

    /* 131) prazo-repasse: margem ≤ 0 OU float > 60 dias de margem → VERMELHO */
    push(131, function () {
      var neg = calculatePrazoRepasse({
        vendasPorDia: 8,
        ticketMedio: 50,
        prazoRepasseDias: 14,
        taxaMarketplacePct: 16,
        custoProdutoUnit: 40,
        fretePagoPeloSellerUnit: 12
      });
      // liquido=42; caixa=52; margem=-10 → VERMELHO
      if (!neg.ok) throw new Error(neg.error || "fail neg");
      if (!(neg.margemPorPedido <= 0)) throw new Error("expected non-pos margem " + neg.margemPorPedido);
      if (neg.badge !== "VERMELHO") throw new Error("badge margem " + neg.badge);
      var huge = calculatePrazoRepasse({
        vendasPorDia: 8,
        ticketMedio: 89,
        prazoRepasseDias: 100,
        taxaMarketplacePct: 16,
        custoProdutoUnit: 35,
        fretePagoPeloSellerUnit: 12
      });
      // floatJaGasto=8*100*47=37600; margemDia=222.08; ratio≈169 > 60 → VERMELHO
      if (!huge.ok) throw new Error(huge.error || "fail huge");
      if (huge.badge !== "VERMELHO") throw new Error("badge huge " + huge.badge);
      return "vermelho margem=" + neg.margemPorPedido;
    });

    /* 132) prazo-repasse: inputs inválidos → error VERMELHO */
    push(132, function () {
      var r = calculatePrazoRepasse({
        vendasPorDia: 0,
        ticketMedio: 89,
        custoProdutoUnit: 35
      });
      if (r.ok) throw new Error("expected fail zero vendas");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      var neg = calculatePrazoRepasse({
        vendasPorDia: 5,
        ticketMedio: -1,
        custoProdutoUnit: 10
      });
      if (neg.ok) throw new Error("expected fail neg ticket");
      return "invalid ok";
    });

    /* 133) prazo-repasse: defaults + parcelamento + join copy */
    push(133, function () {
      var empty = calculatePrazoRepasse({});
      if (empty.ok) throw new Error("empty should fail (missing vendas/ticket/custo)");
      var r = calculatePrazoRepasse({
        vendasPorDia: 8,
        ticketMedio: 89,
        custoProdutoUnit: 35
        // defaults: prazo 14, taxa 16, frete 12, pctParc 0, atrasoExtra 0
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.prazoRepasseDias !== 14) throw new Error("default prazo " + r.prazoRepasseDias);
      if (r.taxaMarketplacePct !== 16) throw new Error("default taxa " + r.taxaMarketplacePct);
      if (r.fretePagoPeloSellerUnit !== 12) throw new Error("default frete " + r.fretePagoPeloSellerUnit);
      var parc = calculatePrazoRepasse({
        vendasPorDia: 8,
        ticketMedio: 89,
        prazoRepasseDias: 14,
        taxaMarketplacePct: 16,
        custoProdutoUnit: 35,
        fretePagoPeloSellerUnit: 12,
        percentualVendasParceladas: 50,
        atrasoExtraParcelamento: 30
      });
      // prazoEfetivo = 14 + 0.5*30 = 29
      if (!parc.ok) throw new Error(parc.error || "fail parc");
      if (Math.abs(parc.prazoEfetivoDias - 29) > 1e-9) throw new Error("prazoEfetivo " + parc.prazoEfetivoDias);
      if (Math.abs(parc.floatJaGasto - 8 * 29 * 47) > 1e-6) throw new Error("float parc " + parc.floatJaGasto);
      if (parc.badge !== "AMARELO" && parc.badge !== "VERMELHO") {
        throw new Error("expected AMARELO/VERMELHO for prazoEfetivo 29, got " + parc.badge);
      }
      var joined = joinPrazoRepasseCopy(r);
      if (!joined || joined.indexOf("ESTIMATIVA") === -1) throw new Error("join");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (badgePrazoRepasse(r) !== r.badge) throw new Error("badge helper");
      if (
        joined.toLowerCase().indexOf("repasse") === -1 &&
        joined.toLowerCase().indexOf("float") === -1
      ) {
        throw new Error("missing topic");
      }
      return "defaults+join+parc badge=" + r.badge + "/" + parc.badge;
    });



    /* 134) custo-embalagem: happy path VERDE — defaults */
    push(134, function () {
      // preco=89, taxa=16, custo=35, frete=12, emb=3.5, vendas=200, meta=15
      // liquido=74.76; varSemEmb=47; margemSem=27.76; margemCom=24.26
      // emb%preco≈3.93; emb%margem≈12.61; impacto=700; tetoZero=27.76; tetoMeta=14.41
      var r = calculateCustoEmbalagem({
        precoVenda: 89,
        taxaMarketplacePct: 16,
        custoProduto: 35,
        fretePagoPeloSeller: 12,
        custoEmbalagemUnit: 3.5,
        vendasPorMes: 200,
        metaMargemPct: 15
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (Math.abs(r.liquidoAposTaxa - 74.76) > 1e-9) throw new Error("liquido " + r.liquidoAposTaxa);
      if (Math.abs(r.custoVariavelSemEmbalagem - 47) > 1e-9) throw new Error("var " + r.custoVariavelSemEmbalagem);
      if (Math.abs(r.margemSemEmbalagem - 27.76) > 1e-9) throw new Error("margemSem " + r.margemSemEmbalagem);
      if (Math.abs(r.margemComEmbalagem - 24.26) > 1e-9) throw new Error("margemCom " + r.margemComEmbalagem);
      if (Math.abs(r.embalagemPctSobrePreco - (3.5 / 89) * 100) > 1e-9) throw new Error("pctPreco " + r.embalagemPctSobrePreco);
      if (Math.abs(r.embalagemPctSobreMargem - (3.5 / 27.76) * 100) > 1e-9) throw new Error("pctMargem " + r.embalagemPctSobreMargem);
      if (Math.abs(r.impactoMes - 700) > 1e-9) throw new Error("impacto " + r.impactoMes);
      if (Math.abs(r.tetoEmbalagemParaMargemZero - 27.76) > 1e-9) throw new Error("tetoZero " + r.tetoEmbalagemParaMargemZero);
      if (Math.abs(r.tetoEmbalagemParaMetaPct - 14.41) > 1e-9) throw new Error("tetoMeta " + r.tetoEmbalagemParaMetaPct);
      if (r.badge !== "VERDE") throw new Error("badge " + r.badge);
      return "happy verde margemCom=" + r.margemComEmbalagem;
    });

    /* 135) custo-embalagem: AMARELO — % margem ≥ 20 OU % preço ≥ 5 */
    push(135, function () {
      var byMargem = calculateCustoEmbalagem({
        precoVenda: 89,
        taxaMarketplacePct: 16,
        custoProduto: 35,
        fretePagoPeloSeller: 12,
        custoEmbalagemUnit: 6,
        vendasPorMes: 200,
        metaMargemPct: 15
      });
      // 6/27.76 ≈ 21.61% ≥ 20 → AMARELO
      if (!byMargem.ok) throw new Error(byMargem.error || "fail");
      if (!(byMargem.embalagemPctSobreMargem >= 20)) throw new Error("pctMargem " + byMargem.embalagemPctSobreMargem);
      if (byMargem.badge !== "AMARELO") throw new Error("badge margem " + byMargem.badge);
      var byPreco = calculateCustoEmbalagem({
        precoVenda: 89,
        taxaMarketplacePct: 16,
        custoProduto: 35,
        fretePagoPeloSeller: 12,
        custoEmbalagemUnit: 4.5,
        vendasPorMes: 200,
        metaMargemPct: 15
      });
      // 4.5/89 ≈ 5.06% ≥ 5 → AMARELO (and 4.5/27.76 ≈ 16.2% < 20)
      if (!byPreco.ok) throw new Error(byPreco.error || "fail preco");
      if (!(byPreco.embalagemPctSobrePreco >= 5)) throw new Error("pctPreco " + byPreco.embalagemPctSobrePreco);
      if (byPreco.badge !== "AMARELO") throw new Error("badge preco " + byPreco.badge);
      return "amarelo pctM=" + byMargem.embalagemPctSobreMargem.toFixed(2) + " pctP=" + byPreco.embalagemPctSobrePreco.toFixed(2);
    });

    /* 136) custo-embalagem: VERMELHO — margem ≤ 0 OU % margem ≥ 40 */
    push(136, function () {
      var neg = calculateCustoEmbalagem({
        precoVenda: 89,
        taxaMarketplacePct: 16,
        custoProduto: 35,
        fretePagoPeloSeller: 12,
        custoEmbalagemUnit: 30,
        vendasPorMes: 200,
        metaMargemPct: 15
      });
      // margemCom = 27.76-30 < 0 → VERMELHO
      if (!neg.ok) throw new Error(neg.error || "fail neg");
      if (!(neg.margemComEmbalagem <= 0)) throw new Error("expected non-pos " + neg.margemComEmbalagem);
      if (neg.badge !== "VERMELHO") throw new Error("badge neg " + neg.badge);
      var high = calculateCustoEmbalagem({
        precoVenda: 89,
        taxaMarketplacePct: 16,
        custoProduto: 35,
        fretePagoPeloSeller: 12,
        custoEmbalagemUnit: 12,
        vendasPorMes: 200,
        metaMargemPct: 15
      });
      // 12/27.76 ≈ 43.2% ≥ 40 → VERMELHO
      if (!high.ok) throw new Error(high.error || "fail high");
      if (!(high.embalagemPctSobreMargem >= 40)) throw new Error("pct " + high.embalagemPctSobreMargem);
      if (high.badge !== "VERMELHO") throw new Error("badge high " + high.badge);
      return "vermelho margemCom=" + neg.margemComEmbalagem;
    });

    /* 137) custo-embalagem: inputs inválidos → error VERMELHO */
    push(137, function () {
      var r = calculateCustoEmbalagem({
        precoVenda: 0,
        custoProduto: 35,
        custoEmbalagemUnit: 3.5
      });
      if (r.ok) throw new Error("expected fail zero preco");
      if (r.badge !== "VERMELHO") throw new Error("badge " + r.badge);
      var neg = calculateCustoEmbalagem({
        precoVenda: 89,
        custoProduto: -1,
        custoEmbalagemUnit: 3.5
      });
      if (neg.ok) throw new Error("expected fail neg custo");
      return "invalid ok";
    });

    /* 138) custo-embalagem: defaults + breakdown sum + join copy */
    push(138, function () {
      var empty = calculateCustoEmbalagem({});
      if (empty.ok) throw new Error("empty should fail (missing preco/custo/emb)");
      var r = calculateCustoEmbalagem({
        precoVenda: 89,
        custoProduto: 35,
        custoEmbalagemUnit: 3.5
        // defaults: taxa 16, frete 12, vendas 200, meta 15
      });
      if (!r.ok) throw new Error(r.error || "fail");
      if (r.taxaMarketplacePct !== 16) throw new Error("default taxa " + r.taxaMarketplacePct);
      if (r.fretePagoPeloSeller !== 12) throw new Error("default frete " + r.fretePagoPeloSeller);
      if (r.vendasPorMes !== 200) throw new Error("default vendas " + r.vendasPorMes);
      if (r.metaMargemPct !== 15) throw new Error("default meta " + r.metaMargemPct);
      var parts = calculateCustoEmbalagem({
        precoVenda: 89,
        custoProduto: 35,
        caixa: 2,
        fita: 0.5,
        protecao: 0.7,
        etiqueta: 0.3
        // sum = 3.5 → same as main default
      });
      if (!parts.ok) throw new Error(parts.error || "fail parts");
      if (Math.abs(parts.custoEmbalagemUnit - 3.5) > 1e-9) throw new Error("sum parts " + parts.custoEmbalagemUnit);
      var joined = joinCustoEmbalagemCopy(r);
      if (!joined || joined.indexOf("ESTIMATIVA") === -1) throw new Error("join");
      if (joined !== r.copyText) throw new Error("copyText mismatch");
      if (badgeCustoEmbalagem(r) !== r.badge) throw new Error("badge helper");
      if (
        joined.toLowerCase().indexOf("embalagem") === -1 &&
        joined.toLowerCase().indexOf("embalag") === -1
      ) {
        throw new Error("missing topic");
      }
      return "defaults+join+parts badge=" + r.badge;
    });

    var passed = results.filter(function (r) { return r.ok; }).length;
    results.forEach(function (r) {
      console.log("[" + (r.ok ? "PASS" : "FAIL") + "] teste " + r.id + " — " + r.detail);
    });
    console.log(passed + "/" + results.length + " testes ok");
    if (passed !== results.length) {
      throw new Error("Falhou " + (results.length - passed) + " teste(s)");
    }
    return results;
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    var a, i, val;
    if (attrs) {
      for (a in attrs) {
        val = attrs[a];
        if (a === "class") node.className = val;
        else if (a === "text") node.textContent = val;
        else if (a === "html") node.innerHTML = val;
        else if (a.indexOf("on") === 0 && typeof val === "function") {
          node.addEventListener(a.slice(2).toLowerCase(), val);
        } else if (val === true) node.setAttribute(a, a);
        else if (val === false || val == null) {
        } else node.setAttribute(a, String(val));
      }
    }
    if (typeof children === "string") node.textContent = children;
    else if (Array.isArray(children)) {
      for (i = 0; i < children.length; i++) {
        if (children[i]) node.appendChild(children[i]);
      }
    }
    return node;
  }

  function field(opts) {
    var wrap = el("label", { class: "field" + (opts.wide ? " field--wide" : "") });
    wrap.appendChild(el("span", { class: "field__label" }, opts.label));
    var input;
    if (opts.type === "select") {
      input = el("select", { class: "field__input", id: opts.id, name: opts.id });
      opts.options.forEach(function (o) {
        var op = el("option", { value: o.value }, o.label);
        if (o.selected) op.selected = true;
        input.appendChild(op);
      });
    } else if (opts.type === "text") {
      var tAttrs = {
        class: "field__input",
        id: opts.id,
        name: opts.id,
        type: "text",
        placeholder: opts.placeholder || "",
        autocomplete: "off",
        spellcheck: "false"
      };
      if (opts.value != null && opts.value !== "") tAttrs.value = String(opts.value);
      if (opts.maxlength != null) tAttrs.maxlength = String(opts.maxlength);
      input = el("input", tAttrs);
    } else if (opts.type === "textarea") {
      var taAttrs = {
        class: "field__input",
        id: opts.id,
        name: opts.id,
        rows: String(opts.rows || 3),
        placeholder: opts.placeholder || "",
        autocomplete: "off",
        spellcheck: "false"
      };
      if (opts.maxlength != null) taAttrs.maxlength = String(opts.maxlength);
      input = el("textarea", taAttrs);
      if (opts.value != null && opts.value !== "") input.value = String(opts.value);
    } else {
      var attrs = {
        class: "field__input",
        id: opts.id,
        name: opts.id,
        type: opts.type || "number",
        inputmode: opts.inputmode || "decimal",
        min: opts.min != null ? String(opts.min) : "0",
        step: opts.step || "0.01",
        placeholder: opts.placeholder || "0",
        autocomplete: "off"
      };
      if (opts.value != null && opts.value !== "") attrs.value = String(opts.value);
      if (opts.max != null) attrs.max = String(opts.max);
      input = el("input", attrs);
    }
    wrap.appendChild(input);
    if (opts.hint) wrap.appendChild(el("span", { class: "field__hint" }, opts.hint));
    return wrap;
  }

  function mountCalculator(root, options) {
    if (!root) return;
    options = options || {};
    var presetId = options.preset || root.getAttribute("data-preset") || "";
    var initial = PRESETS[presetId] || null;

    root.innerHTML = "";
    root.classList.add("calc");

    var state = {
      productCost: "",
      packaging: "",
      freight: "",
      sellerPaysFreight: true,
      feePct: initial ? initial.feePct : "",
      taxPct: "",
      marginPct: 20,
      desiredProfit: "",
      sellingPrice: "",
      target: "margin",
      mode: "forward",
      marketplace: initial ? initial.id : "",
      marketplaceLabel: initial ? initial.label : "",
      feeDirty: false,
      shopeeCpfAlto: false,
      amazonIndividual: false
    };

    var form = el("div", { class: "calc__grid" });
    var controls = el("div", { class: "calc__controls" });
    controls.appendChild(el("p", { class: "calc__kicker" }, "Calculadora de preço"));
    controls.appendChild(
      el("h2", { class: "calc__title" }, "Quanto cobrar para sobrar lucro de verdade")
    );

    var presetsWrap = el("div", { class: "presets" });
    presetsWrap.appendChild(
      el("p", { class: "presets__label" }, FEE_DISCLAIMER)
    );
    var presetsRow = el("div", {
      class: "presets__row",
      role: "group",
      "aria-label": "Taxas estimadas por marketplace"
    });
    Object.keys(PRESETS).forEach(function (id) {
      var p = PRESETS[id];
      var btn = el(
        "button",
        {
          type: "button",
          class: "chip" + (initial && initial.id === id ? " is-on" : ""),
          "data-preset": id
        },
        p.label + (p.feePct ? " " + p.feePct + "%" : "")
      );
      presetsRow.appendChild(btn);
    });
    presetsWrap.appendChild(presetsRow);
    controls.appendChild(presetsWrap);

    var extra = el("div", { class: "calc__extra", id: "calc-extra" });
    controls.appendChild(extra);

    var fields = el("div", { class: "fields" });
    fields.appendChild(field({ id: "custo", label: "Custo do produto (R$)", placeholder: "50,00" }));
    fields.appendChild(field({ id: "embalagem", label: "Embalagem (R$)", placeholder: "2,00" }));
    fields.appendChild(field({ id: "frete", label: "Frete (R$)", placeholder: "0,00" }));
    fields.appendChild(
      field({
        id: "frete-quem",
        type: "select",
        label: "Quem paga o frete?",
        options: [
          { value: "seller", label: "Você paga", selected: true },
          { value: "buyer", label: "Cliente paga" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "taxa",
        label: "Taxa do marketplace (%)",
        placeholder: "12",
        step: "0.01",
        value: initial ? initial.feePct : "",
        hint: FEE_DISCLAIMER
      })
    );
    fields.appendChild(
      field({
        id: "imposto",
        label: "Imposto sobre a venda (%)",
        placeholder: "4",
        step: "0.01",
        hint: FEE_DISCLAIMER
      })
    );
    controls.appendChild(fields);

    var toggles = el("div", { class: "toggles" });
    var targetSwitch = el("div", { class: "switch", role: "group", "aria-label": "Meta de lucro" });
    var btnMargin = el("button", { type: "button", class: "switch__btn is-on", "data-target": "margin" }, "Margem %");
    var btnProfit = el("button", { type: "button", class: "switch__btn", "data-target": "profit" }, "Lucro R$");
    targetSwitch.appendChild(btnMargin);
    targetSwitch.appendChild(btnProfit);
    toggles.appendChild(targetSwitch);

    var modeBtn = el(
      "button",
      { type: "button", class: "toggle-mode", id: "mode-reverse", "aria-pressed": "false" },
      "Já sei o preço, quanto sobra?"
    );
    toggles.appendChild(modeBtn);
    controls.appendChild(toggles);

    var targetFields = el("div", { class: "fields fields--target" });
    var marginField = field({
      id: "margem",
      label: "Margem desejada (% do preço)",
      placeholder: "20",
      step: "0.1",
      value: 20
    });
    var profitField = field({
      id: "lucro-alvo",
      label: "Lucro líquido desejado (R$)",
      placeholder: "30,00"
    });
    profitField.hidden = true;
    var sellField = field({
      id: "preco-conhecido",
      label: "Preço de venda que você já pratica (R$)",
      placeholder: "99,90"
    });
    sellField.hidden = true;
    targetFields.appendChild(marginField);
    targetFields.appendChild(profitField);
    targetFields.appendChild(sellField);
    controls.appendChild(targetFields);

    var actions = el("div", { class: "calc__actions" });
    var copyBtn = el("button", { type: "button", class: "btn btn--ghost", id: "btn-copy" }, "Copiar resumo");
    var pdfBtn = el("button", { type: "button", class: "btn btn--solid", id: "btn-pdf" }, "Baixar PDF");
    actions.appendChild(copyBtn);
    actions.appendChild(pdfBtn);
    controls.appendChild(actions);

    var result = el("div", { class: "calc__result", "aria-live": "polite" });
    form.appendChild(controls);
    form.appendChild(result);
    root.appendChild(form);

    function readState() {
      state.productCost = document.getElementById("custo").value;
      state.packaging = document.getElementById("embalagem").value;
      state.freight = document.getElementById("frete").value;
      state.sellerPaysFreight = document.getElementById("frete-quem").value === "seller";
      state.feePct = document.getElementById("taxa").value;
      state.taxPct = document.getElementById("imposto").value;
      state.marginPct = document.getElementById("margem").value;
      state.desiredProfit = document.getElementById("lucro-alvo").value;
      state.sellingPrice = document.getElementById("preco-conhecido").value;
      var cpf = document.getElementById("shopee-cpf");
      var amz = document.getElementById("amazon-plano");
      state.shopeeCpfAlto = !!(cpf && cpf.checked);
      state.amazonIndividual = !!(amz && amz.value === "individual");
      return state;
    }

    function paintExtra() {
      extra.innerHTML = "";
      var id = state.marketplace;
      if (isMl(id)) {
        extra.appendChild(
          el("p", { class: "calc__note" }, [
            document.createTextNode("Mercado Livre: Clássico 12% ou Premium 17%, mais faixa de preço. Confirme no "),
            el("a", { href: ML_SIMULATOR, target: "_blank", rel: "noopener noreferrer" }, "Simulador de custos oficial"),
            document.createTextNode(".")
          ])
        );
      } else if (id === "shopee") {
        extra.appendChild(
          el("p", { class: "calc__note" }, "Shopee não publica tabela oficial. Faixas abaixo são estimativa.")
        );
        var lab = el("label", { class: "check" });
        var cb = el("input", { type: "checkbox", id: "shopee-cpf" });
        cb.checked = state.shopeeCpfAlto;
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(" CPF alto volume +R$ 3 (opcional, desligado por padrão)"));
        extra.appendChild(lab);
      } else if (id === "amazon") {
        extra.appendChild(
          el("p", { class: "calc__note" }, "Referral oficial costuma ficar entre 10% e 15% por categoria. Padrão 12%, editável. Mínimo R$ 1.")
        );
        var wrap = el("label", { class: "field" });
        wrap.appendChild(el("span", { class: "field__label" }, "Plano Amazon"));
        var sel = el("select", { class: "field__input", id: "amazon-plano" });
        var o1 = el("option", { value: "professional" }, "Professional (R$ 19/mês, fora da conta unitária)");
        var o2 = el("option", { value: "individual" }, "Individual (+R$ 2 por item)");
        if (state.amazonIndividual) o2.selected = true;
        else o1.selected = true;
        sel.appendChild(o1);
        sel.appendChild(o2);
        wrap.appendChild(sel);
        extra.appendChild(wrap);
      } else if (id === "magalu") {
        extra.appendChild(el("p", { class: "calc__note" }, FEE_DISCLAIMER));
      }
    }

    function setPreset(id) {
      var p = PRESETS[id];
      if (!p) return;
      state.marketplace = p.id;
      state.marketplaceLabel = p.label;
      state.feeDirty = false;
      document.getElementById("taxa").value = String(p.feePct);
      root.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("is-on", c.getAttribute("data-preset") === id);
      });
      paintExtra();
      render();
    }

    function render() {
      readState();
      var r = calculate(state);
      result.innerHTML = "";

      if (!r.ok) {
        result.appendChild(
          el("div", { class: "result-card result-card--error", role: "alert" }, [
            el("p", { class: "result-card__kicker" }, "Não dá para fechar o preço"),
            el("p", { class: "result-card__error" }, r.error),
            el("p", { class: "muted" }, "Reduza a margem ou as taxas. A soma precisa ficar abaixo de 99% do preço de venda.")
          ])
        );
        updatePrintSheet(null);
        return;
      }

      if (!state.feeDirty && r.feePctApplied != null && state.marketplace === "shopee") {
        var shown = document.getElementById("taxa");
        var next = (r.feePctApplied * 100).toString();
        if (shown.value !== next && shown.value !== String(r.feePctApplied * 100)) {
          shown.value = String(+(r.feePctApplied * 100).toFixed(2));
          state.feePct = shown.value;
        }
      }

      var loss = r.profit < 0;
      var card = el("div", { class: "result-card" + (loss ? " result-card--loss" : "") });
      card.appendChild(
        el("p", { class: "result-card__kicker" }, state.mode === "reverse" ? "O que sobra nesse preço" : "Preço de venda")
      );
      card.appendChild(
        el("p", { class: "result-card__price" + (loss ? " is-loss" : "") }, formatBRL(r.sellingPrice))
      );

      var profitRow = el("div", { class: "result-card__profit" });
      profitRow.appendChild(el("span", { class: "muted" }, "Lucro líquido"));
      profitRow.appendChild(el("strong", { class: loss ? "is-loss" : "is-gain" }, formatBRL(r.profit)));
      card.appendChild(profitRow);

      var marginRow = el("div", { class: "result-card__profit" });
      marginRow.appendChild(el("span", { class: "muted" }, "Margem efetiva"));
      marginRow.appendChild(el("strong", {}, formatPct(r.effectiveMargin)));
      card.appendChild(marginRow);

      var list = el("ul", { class: "breakdown" });
      var feePctShow = r.feePctApplied != null ? r.feePctApplied * 100 : r.feePct;
      var rows = [
        ["Custo do produto", r.productCost],
        ["Embalagem", r.packaging],
        [
          "Frete" + (r.sellerPaysFreight ? " (você)" : " (cliente — fora do custo)"),
          r.sellerPaysFreight ? r.freight : 0
        ],
        [
          "Taxa % (" + Number(feePctShow).toLocaleString("pt-BR") + "%)",
          r.feePctPart != null ? r.feePctPart : r.feeAmount
        ]
      ];
      if (r.feeExtraPart) rows.push(["Taxa extra (faixa de preço)", r.feeExtraPart]);
      if (r.feeFixedPart) rows.push(["Taxa fixa / por item", r.feeFixedPart]);
      rows.push(["Imposto (" + r.taxPct.toLocaleString("pt-BR") + "%)", r.taxAmount]);
      rows.push(["Lucro líquido", r.profit]);
      rows.forEach(function (row) {
        var li = el("li", { class: "breakdown__row" });
        li.appendChild(el("span", {}, row[0]));
        li.appendChild(el("span", {}, formatBRL(row[1])));
        list.appendChild(li);
      });
      card.appendChild(list);

      var note = FEE_DISCLAIMER;
      if (r.feeParams && r.feeParams.note) note = r.feeParams.note;
      if (r.feeParams && r.feeParams.label) {
        note = "Faixa aplicada: " + r.feeParams.label + ". " + note;
      }
      card.appendChild(el("p", { class: "result-card__note" }, note));
      result.appendChild(card);
      updatePrintSheet(r);
    }

    function updatePrintSheet(r) {
      var sheet = document.getElementById("print-sheet");
      if (!sheet) return;
      if (!r || !r.ok) {
        sheet.innerHTML = "";
        return;
      }
      var feePctShow = r.feePctApplied != null ? r.feePctApplied * 100 : r.feePct;
      sheet.innerHTML =
        '<div class="quote">' +
        '<header class="quote__head">' +
        '<div><p class="quote__brand">PRECIFICA</p><p class="quote__sub">Cálculo de preço para marketplace</p></div>' +
        '<div class="quote__meta"><p>' +
        todayBR() +
        "</p>" +
        (r.marketplaceLabel ? "<p>" + escapeHtml(r.marketplaceLabel) + "</p>" : "") +
        "</div></header>" +
        '<table class="quote__table">' +
        quoteRow("Custo do produto", formatBRL(r.productCost)) +
        quoteRow("Embalagem", formatBRL(r.packaging)) +
        quoteRow(
          "Frete (" + (r.sellerPaysFreight ? "vendedor" : "cliente") + ")",
          formatBRL(r.sellerPaysFreight ? r.freight : 0)
        ) +
        quoteRow("Custo total", formatBRL(r.costTotal)) +
        quoteRow(
          "Taxa % marketplace",
          formatBRL(r.feePctPart != null ? r.feePctPart : r.feeAmount) +
            " (" +
            Number(feePctShow).toLocaleString("pt-BR") +
            "%)"
        ) +
        (r.feeExtraPart ? quoteRow("Taxa extra (faixa)", formatBRL(r.feeExtraPart)) : "") +
        (r.feeFixedPart ? quoteRow("Taxa fixa / item", formatBRL(r.feeFixedPart)) : "") +
        quoteRow(
          "Imposto",
          formatBRL(r.taxAmount) + " (" + r.taxPct.toLocaleString("pt-BR") + "%)"
        ) +
        "</table>" +
        '<p class="quote__sell">Preço de venda <strong>' +
        formatBRL(r.sellingPrice) +
        "</strong></p>" +
        '<p class="quote__profit">Lucro líquido <strong>' +
        formatBRL(r.profit) +
        "</strong> · margem " +
        formatPct(r.effectiveMargin) +
        "</p>" +
        '<p class="quote__disc">Estimativa gerada no navegador. Não constitui conselho contábil, fiscal ou financeiro. Confirme taxas no Seller Center / simulador oficial e o seu regime tributário.</p>' +
        "</div>";
    }

    function quoteRow(k, v) {
      return "<tr><th>" + escapeHtml(k) + "</th><td>" + escapeHtml(v) + "</td></tr>";
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    presetsRow.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-preset]");
      if (btn) setPreset(btn.getAttribute("data-preset"));
    });

    btnMargin.addEventListener("click", function () {
      state.target = "margin";
      btnMargin.classList.add("is-on");
      btnProfit.classList.remove("is-on");
      syncTargetVisibility();
      render();
    });
    btnProfit.addEventListener("click", function () {
      state.target = "profit";
      btnProfit.classList.add("is-on");
      btnMargin.classList.remove("is-on");
      syncTargetVisibility();
      render();
    });
    modeBtn.addEventListener("click", function () {
      state.mode = state.mode === "reverse" ? "forward" : "reverse";
      modeBtn.setAttribute("aria-pressed", state.mode === "reverse" ? "true" : "false");
      modeBtn.classList.toggle("is-on", state.mode === "reverse");
      modeBtn.textContent =
        state.mode === "reverse"
          ? "Voltar: quero calcular o preço"
          : "Já sei o preço, quanto sobra?";
      syncTargetVisibility();
      render();
    });

    function syncTargetVisibility() {
      var reverse = state.mode === "reverse";
      sellField.hidden = !reverse;
      marginField.hidden = reverse || state.target !== "margin";
      profitField.hidden = reverse || state.target !== "profit";
      targetSwitch.hidden = reverse;
    }

    document.getElementById("taxa").addEventListener("input", function () {
      state.feeDirty = true;
    });

    root.addEventListener("input", render);
    root.addEventListener("change", render);

    copyBtn.addEventListener("click", function () {
      var r = calculate(readState());
      if (!r.ok) {
        toast("Ajuste as taxas e a margem antes de copiar.");
        return;
      }
      copyText(buildSummary(r))
        .then(function () {
          toast("Resumo copiado. Cola no WhatsApp.");
        })
        .catch(function () {
          toast("Não deu para copiar. Seleciona o texto e copia na mão.");
        });
    });

    pdfBtn.addEventListener("click", function () {
      var r = calculate(readState());
      if (!r.ok) {
        toast("Ajuste as taxas e a margem antes de gerar o PDF.");
        return;
      }
      updatePrintSheet(r);
      openPdfNudge();
    });

    paintExtra();
    syncTargetVisibility();
    render();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (e) {
        reject(e);
      }
      document.body.removeChild(ta);
    });
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) {
      t = el("div", { id: "toast", class: "toast", role: "status" });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toast._tid);
    toast._tid = setTimeout(function () {
      t.classList.remove("is-on");
    }, 2800);
  }

  function openPdfNudge() {
    var modal = document.getElementById("pdf-modal");
    if (!modal) {
      window.print();
      return;
    }
    modal.hidden = false;
    modal.classList.add("is-on");
    var first = modal.querySelector("[data-print]");
    if (first) first.focus();
  }

  function closePdfNudge() {
    var modal = document.getElementById("pdf-modal");
    if (!modal) return;
    modal.hidden = true;
    modal.classList.remove("is-on");
  }


  var COMPARE_IDS = ["ml-classico", "ml-premium", "shopee", "amazon", "magalu"];

  function mountCompare(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("compare");

    var panel = el("div", { class: "compare__panel" });
    panel.appendChild(el("p", { class: "compare__kicker" }, "Comparar marketplaces"));
    panel.appendChild(
      el(
        "h2",
        { class: "compare__title" },
        "O mesmo custo, cinco preços"
      )
    );

    var fields = el("div", { class: "compare__fields" });
    var fProduct = field({
      id: "cmp-product",
      label: "Custo do produto (R$)",
      value: "40",
      hint: "O que você pagou no item"
    });
    var fPack = field({
      id: "cmp-pack",
      label: "Embalagem (R$)",
      value: "3"
    });
    var fFreight = field({
      id: "cmp-freight",
      label: "Frete de ida (R$)",
      value: "12",
      hint: "Só entra se você paga"
    });
    var fTax = field({
      id: "cmp-tax",
      label: "Imposto (%)",
      value: "4",
      step: "0.1"
    });
    var fMargin = field({
      id: "cmp-margin",
      label: "Margem desejada (%)",
      value: "20",
      step: "0.1",
      hint: "Lucro líquido sobre o preço"
    });
    var fWho = field({
      id: "cmp-who",
      label: "Quem paga o frete",
      type: "select",
      options: [
        { value: "seller", label: "Você (vendedor)", selected: true },
        { value: "buyer", label: "Cliente" }
      ]
    });
    [fProduct, fPack, fFreight, fTax, fMargin, fWho].forEach(function (f) {
      fields.appendChild(f);
    });
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "compare__hint" },
        FEE_DISCLAIMER + " Amazon usa plano Professional (sem +R$ 2/item)."
      )
    );
    root.appendChild(panel);

    var grid = el("div", {
      class: "compare__grid",
      "aria-live": "polite"
    });
    root.appendChild(grid);

    var verdict = el("div", { class: "compare__verdict", hidden: true });
    root.appendChild(verdict);

    function read() {
      return {
        productCost: document.getElementById("cmp-product").value,
        packaging: document.getElementById("cmp-pack").value,
        freight: document.getElementById("cmp-freight").value,
        sellerPaysFreight:
          document.getElementById("cmp-who").value === "seller",
        taxPct: document.getElementById("cmp-tax").value,
        marginPct: document.getElementById("cmp-margin").value,
        mode: "forward",
        target: "margin",
        feeDirty: false,
        shopeeCpfAlto: false,
        amazonIndividual: false
      };
    }

    function render() {
      var base = read();
      var rows = [];
      var i, id, pre, r, bestIdx, bestPrice;

      for (i = 0; i < COMPARE_IDS.length; i++) {
        id = COMPARE_IDS[i];
        pre = PRESETS[id];
        r = calculate({
          productCost: base.productCost,
          packaging: base.packaging,
          freight: base.freight,
          sellerPaysFreight: base.sellerPaysFreight,
          taxPct: base.taxPct,
          marginPct: base.marginPct,
          mode: base.mode,
          target: base.target,
          feeDirty: false,
          shopeeCpfAlto: false,
          amazonIndividual: false,
          marketplace: id,
          marketplaceLabel: pre.label,
          feePct: pre.feePct
        });
        rows.push({ id: id, pre: pre, r: r });
      }

      bestIdx = -1;
      bestPrice = Infinity;
      for (i = 0; i < rows.length; i++) {
        r = rows[i].r;
        if (r.ok && Number.isFinite(r.sellingPrice) && r.sellingPrice < bestPrice) {
          bestPrice = r.sellingPrice;
          bestIdx = i;
        }
      }

      grid.innerHTML = "";
      for (i = 0; i < rows.length; i++) {
        var row = rows[i];
        r = row.r;
        var card = el("article", {
          class:
            "compare-card" +
            (i === bestIdx ? " is-best" : "") +
            (r.ok && r.effectiveMargin != null && r.effectiveMargin < 0
              ? " is-loss"
              : "")
        });
        if (i === bestIdx) {
          card.appendChild(
            el("span", { class: "compare-card__badge" }, "Menor preço")
          );
        }
        card.appendChild(el("h3", { class: "compare-card__name" }, row.pre.label));
        card.appendChild(
          el("p", { class: "compare-card__fee" }, row.pre.hint)
        );
        if (!r.ok) {
          card.appendChild(
            el("p", { class: "compare-card__err" }, r.error || "Não deu para calcular.")
          );
        } else {
          var priceEl = el("p", {
            class:
              "compare-card__price" +
              (r.effectiveMargin < 0 ? " is-loss" : ""),
            text: formatBRL(r.sellingPrice)
          });
          card.appendChild(priceEl);
          card.appendChild(
            el("p", {
              class: "compare-card__profit",
              html:
                "Lucro " +
                "<strong>" +
                formatBRL(r.profit) +
                "</strong> · margem " +
                formatPct(r.effectiveMargin)
            })
          );
          var feeBits = formatBRL(r.feeAmount);
          if (r.feeFixedPart) feeBits += " (inclui fixo)";
          var bandLabel = r.feeParams && r.feeParams.label ? r.feeParams.label : "";
          card.appendChild(
            el("p", {
              class: "compare-card__meta",
              text:
                "Taxa ~" +
                feeBits +
                (bandLabel ? " · " + bandLabel : "")
            })
          );
        }
        grid.appendChild(card);
      }

      if (bestIdx >= 0) {
        var b = rows[bestIdx];
        verdict.hidden = false;
        verdict.innerHTML =
          "<p>Com esses números, o <strong>" +
          b.pre.label +
          "</strong> pede o menor preço de venda (" +
          formatBRL(b.r.sellingPrice) +
          ") para a margem de " +
          Number(base.marginPct).toLocaleString("pt-BR") +
          "%. Isso não escolhe o canal — só mostra o pedágio. Confirme no Seller Center.</p>";
      } else {
        verdict.hidden = true;
        verdict.innerHTML = "";
      }
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  var TITLE_MAX = 60;

  function cleanPart(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .replace(/\|+/g, " ")
      .trim();
  }

  function packTitle(parts, max) {
    max = max == null ? TITLE_MAX : max;
    var out = "";
    var i, p, next, room, cut;
    for (i = 0; i < parts.length; i++) {
      p = cleanPart(parts[i]);
      if (!p) continue;
      next = out ? out + " " + p : p;
      if (next.length <= max) {
        out = next;
        continue;
      }
      room = max - (out ? out.length + 1 : 0);
      if (room < 3) break;
      cut = p.slice(0, room);
      cut = cut.replace(/\s+\S*$/, "").replace(/[\s,;./\-]+$/, "");
      if (cut.length >= 2) out = out ? out + " " + cut : cut;
      break;
    }
    if (out.length > max) {
      out = out.slice(0, max).replace(/\s+\S*$/, "").trim();
    }
    return out;
  }

  function generateMlTitles(input) {
    var produto = cleanPart(input.produto);
    var marca = cleanPart(input.marca);
    var modelo = cleanPart(input.modelo);
    var cor = cleanPart(input.cor);
    var qty = cleanPart(input.qty);
    var material = cleanPart(input.material);
    var diffs = cleanPart(input.diffs);
    var raw = [
      packTitle([produto, marca, modelo, cor, qty, material]),
      packTitle([marca, produto, modelo, material, cor, qty]),
      packTitle([produto, diffs, marca, modelo, cor, qty])
    ];
    var extras = [
      packTitle([produto, cor, material, qty, marca]),
      packTitle([marca, modelo, produto, diffs]),
      packTitle([produto, modelo, cor, diffs])
    ];
    var opts = [];
    function pushUnique(t) {
      if (t && opts.indexOf(t) === -1) opts.push(t);
    }
    raw.forEach(pushUnique);
    extras.forEach(function (t) {
      if (opts.length < 3) pushUnique(t);
    });
    while (opts.length < 3) opts.push(opts[0] || "");
    return [
      { label: "Busca", hint: "produto + marca + modelo", title: opts[0] },
      { label: "Atributos", hint: "marca à frente, material e cor", title: opts[1] },
      { label: "Diferencial", hint: "o que te separa da concorrência", title: opts[2] }
    ];
  }


  var KW_PRINCIPAIS_MAX = 60;
  var KW_CAUDA_MAX = 80;
  var KW_DENYLIST = [
    "incrível",
    "incrivel",
    "promoção",
    "promocao",
    "melhor do brasil",
    "barato",
    "barato demais",
    "imperdível",
    "imperdivel",
    "oferta",
    "frete grátis",
    "frete gratis",
    "ótimo",
    "otimo",
    "super promoção",
    "super promocao",
    "qualidade premium spam",
    "melhor preço",
    "melhor preco",
    "aproveite",
    "liquidação",
    "liquidacao"
  ];

  function splitKeywordParts(raw) {
    var s = String(raw || "");
    var parts = s.split(/[,;\n|/]+/);
    var out = [];
    var i, p;
    for (i = 0; i < parts.length; i++) {
      p = cleanPart(parts[i]);
      if (p) out.push(p);
    }
    return out;
  }

  function uniqueCi(items) {
    var seen = {};
    var out = [];
    var i, t, key;
    for (i = 0; i < items.length; i++) {
      t = cleanPart(items[i]);
      if (!t) continue;
      key = t.toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;
      out.push(t);
    }
    return out;
  }

  function clipKw(s, max) {
    s = cleanPart(s);
    if (!s) return "";
    if (s.length <= max) return s;
    var cut = s.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s,;./\-]+$/, "");
    return cut || s.slice(0, max).trim();
  }

  function joinKw(parts, max) {
    return clipKw(packTitle(parts, max), max);
  }

  /**
   * Gera listas de palavras-chave ML: principais, cauda longa, atributos, evitar.
   * Sugestões para pesquisa — não são dados oficiais do Trends.
   */
  function generateMlKeywords(input) {
    input = input || {};
    var empty = { principais: [], caudaLonga: [], atributos: [], evitar: [] };
    var produto = cleanPart(input.produto);
    if (!produto) return empty;

    var categoria = cleanPart(input.categoria);
    var marca = cleanPart(input.marca);
    var attrs = splitKeywordParts(input.atributos || input.attrs || "");
    var uso = cleanPart(input.uso || input.intencao || input.intenção || "");

    var principais = [];
    function addP(parts) {
      var t = joinKw(parts, KW_PRINCIPAIS_MAX);
      if (t) principais.push(t);
    }
    addP([produto]);
    if (marca) addP([produto, marca]);
    if (marca) addP([marca, produto]);
    if (categoria) addP([produto, categoria]);
    if (attrs[0]) addP([produto, attrs[0]]);
    if (attrs[1]) addP([produto, attrs[1]]);
    if (marca && attrs[0]) addP([produto, marca, attrs[0]]);
    if (attrs[0] && attrs[1]) addP([produto, attrs[0], attrs[1]]);
    if (uso) addP([produto, uso]);
    if (marca && categoria) addP([marca, produto, categoria]);
    if (attrs[2]) addP([produto, attrs[2]]);
    if (marca && uso) addP([produto, marca, uso]);
    if (categoria && attrs[0]) addP([categoria, produto, attrs[0]]);
    if (attrs[0] && uso) addP([produto, attrs[0], uso]);
    if (categoria && uso) addP([produto, categoria, uso]);
    principais = uniqueCi(principais).slice(0, 12);

    var cauda = [];
    function addC(parts) {
      var t = joinKw(parts, KW_CAUDA_MAX);
      if (t) cauda.push(t);
    }
    addC([produto, attrs[0] || "", uso || "presente"]);
    addC([produto, marca || "", attrs[0] || "", "comprar"]);
    addC([produto, uso || "profissional", "mercado livre"]);
    addC([produto, categoria || "", uso || "kit"]);
    addC([produto, attrs[0] || "original", attrs[1] || ""]);
    addC([marca || produto, produto, uso || "dia a dia"]);
    addC([produto, attrs[1] || attrs[0] || "", uso || "casa"]);
    addC([produto, "kit", attrs[0] || marca || ""]);
    addC(["comprar", produto, marca || "", attrs[0] || ""]);
    addC([produto, categoria || "", "entrega rápida"]);
    addC([produto, "para presente", attrs[0] || ""]);
    addC([produto, uso || "profissional", marca || ""]);
    if (attrs[0] && uso) addC([produto, attrs[0], uso, "anúncio"]);
    if (marca && categoria) addC([produto, marca, categoria, uso || ""]);
    cauda = uniqueCi(cauda).slice(0, 12);

    var atributos = uniqueCi(
      attrs.concat(
        [
          categoria,
          marca && marca.length <= 24 ? marca : "",
          uso,
          "kit",
          "original"
        ].filter(Boolean)
      )
    ).slice(0, 12);

    /* Evitar: static denylist when produto present; also surface matches in input */
    var blob = [produto, categoria, marca, attrs.join(" "), uso, String(input.atributos || "")]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    var evitar = [];
    var matched = [];
    var di, d, dl;
    for (di = 0; di < KW_DENYLIST.length; di++) {
      d = KW_DENYLIST[di];
      dl = d
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (blob.indexOf(dl) !== -1) matched.push(d);
      evitar.push(d);
    }
    /* keep full denylist as guidance; matched first for UX */
    evitar = uniqueCi(matched.concat(evitar));

    return {
      principais: principais,
      caudaLonga: cauda,
      atributos: atributos,
      evitar: evitar
    };
  }

  function mountKeywords(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("titlegen");

    var panel = el("div", { class: "titlegen__panel" });
    panel.appendChild(
      el("p", { class: "titlegen__kicker" }, "Gerador de palavras-chave Mercado Livre")
    );
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Principais, cauda longa e filtros")
    );

    var fields = el("div", { class: "titlegen__fields" });
    fields.appendChild(
      field({
        id: "kw-produto",
        type: "text",
        label: "Produto",
        placeholder: "Fone bluetooth",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "kw-categoria",
        type: "text",
        label: "Categoria",
        placeholder: "Beleza, Eletrônicos…"
      })
    );
    fields.appendChild(
      field({ id: "kw-marca", type: "text", label: "Marca", placeholder: "Sony" })
    );
    fields.appendChild(
      field({
        id: "kw-atributos",
        type: "text",
        label: "Atributos",
        placeholder: "preto, in-ear, cancelamento de ruído",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "kw-uso",
        type: "text",
        label: "Uso / intenção",
        placeholder: "presente, profissional, kit",
        wide: true
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Sugestões para pesquisa de anúncio — não são dados oficiais do Mercado Livre Trends. Use no título, na ficha e nos filtros."
      )
    );
    root.appendChild(panel);

    var list = el("div", { class: "titlegen__list", "aria-live": "polite" });
    root.appendChild(list);

    function read() {
      return {
        produto: document.getElementById("kw-produto").value,
        categoria: document.getElementById("kw-categoria").value,
        marca: document.getElementById("kw-marca").value,
        atributos: document.getElementById("kw-atributos").value,
        uso: document.getElementById("kw-uso").value
      };
    }

    function renderListCard(label, hint, items) {
      var card = el("article", { class: "title-card" });
      card.appendChild(el("p", { class: "title-card__label" }, label));
      card.appendChild(el("p", { class: "title-card__hint" }, hint));
      var pre = el("pre", {
        class: "title-card__input",
        style: "white-space:pre-wrap;min-height:4.5em;margin:0;padding:10px 12px;font:inherit"
      });
      pre.textContent = items.length ? items.join("\n") : "—";
      card.appendChild(pre);
      var copyBtn = el(
        "button",
        { type: "button", class: "btn btn--ghost title-card__copy" },
        "Copiar tudo"
      );
      copyBtn.addEventListener("click", function () {
        var text = items.join("\n").trim();
        if (!text) {
          toast("Preenche o produto primeiro.");
          return;
        }
        copyText(text)
          .then(function () {
            toast("Lista copiada (" + items.length + ").");
          })
          .catch(function () {
            toast("Não deu para copiar. Seleciona o texto.");
          });
      });
      card.appendChild(copyBtn);
      return card;
    }

    function render() {
      var data = generateMlKeywords(read());
      list.innerHTML = "";
      list.appendChild(
        renderListCard(
          "Principais",
          "8–12 termos curtos · até ~60 caracteres",
          data.principais
        )
      );
      list.appendChild(
        renderListCard(
          "Cauda longa",
          "frases com atributo + uso + intenção de compra",
          data.caudaLonga
        )
      );
      list.appendChild(
        renderListCard(
          "Atributos / filtros",
          "tokens úteis na ficha e nos filtros do ML",
          data.atributos
        )
      );
      list.appendChild(
        renderListCard(
          "Evitar",
          "fluff que come caracteres e não ranqueia",
          data.evitar
        )
      );
    }

    panel.addEventListener("input", render);
    render();
  }


  var DESC_ML_MAX = 50000;
  var DESC_SHOPEE_MAX = 5000;
  var DESC_PREVIEW_MAX = 500;

  /** Split benefícios by comma/semicolon/newline; skip empties. */
  function splitBenefits(raw) {
    var s = String(raw || "");
    var parts = s.split(/[,;\n]+/);
    var out = [];
    var i, p;
    for (i = 0; i < parts.length; i++) {
      p = cleanPart(parts[i]);
      if (p) out.push(p);
    }
    return out.slice(0, 3);
  }

  /**
   * Gera 3 textos de descrição: ML (estruturado), Shopee (keyword-front),
   * Preview (primeiros 500 do ML). Não inventa spec nem fluff de marketing.
   */
  function generateDescriptions(input) {
    input = input || {};
    var empty = {
      ml: {
        label: "Mercado Livre",
        hint: "gancho + specs + caixa + garantia · soft 5000 / hard 50000",
        text: "",
        chars: 0,
        max: DESC_ML_MAX
      },
      shopee: {
        label: "Shopee",
        hint: "keywords na frente, mais curto · soft/hard ~5000",
        text: "",
        chars: 0,
        max: DESC_SHOPEE_MAX
      },
      preview: {
        label: "Preview 500",
        hint: "o que a busca/card costuma mostrar",
        text: "",
        chars: 0,
        max: DESC_PREVIEW_MAX
      }
    };
    var produto = cleanPart(input.produto);
    if (!produto) return empty;

    var marca = cleanPart(input.marca);
    var modelo = cleanPart(input.modelo);
    var cor = cleanPart(input.cor);
    var qty = cleanPart(input.qty || input.tamanho);
    var material = cleanPart(input.material);
    var beneficios = splitBenefits(input.beneficios || input.diffs);
    var caixa = cleanPart(input.caixa);
    var garantia = cleanPart(input.garantia);
    var paraQuem = cleanPart(input.paraQuem || input.para_quem);

    var ganchoParts = [produto];
    if (marca) ganchoParts.push(marca);
    if (modelo) ganchoParts.push(modelo);
    if (cor) ganchoParts.push(cor);
    var gancho = ganchoParts.join(" ");

    var bullets = [];
    if (marca) bullets.push("• Marca: " + marca);
    if (modelo) bullets.push("• Modelo: " + modelo);
    if (cor) bullets.push("• Cor: " + cor);
    if (qty) bullets.push("• Tamanho / qtd: " + qty);
    if (material) bullets.push("• Material: " + material);
    var bi;
    for (bi = 0; bi < beneficios.length; bi++) {
      bullets.push("• " + beneficios[bi]);
    }

    var mlParts = [gancho, ""];
    if (bullets.length) {
      mlParts = mlParts.concat(bullets);
      mlParts.push("");
    }
    if (caixa) {
      mlParts.push("O que vem na caixa:");
      mlParts.push(caixa);
      mlParts.push("");
    }
    if (garantia) {
      mlParts.push("Garantia: " + garantia);
      mlParts.push("");
    }
    if (paraQuem) {
      mlParts.push("Para quem: " + paraQuem);
    }
    while (mlParts.length && mlParts[mlParts.length - 1] === "") mlParts.pop();
    var mlText = mlParts.join("\n");
    if (mlText.length > DESC_ML_MAX) mlText = mlText.slice(0, DESC_ML_MAX);

    /* Shopee: keyword-front, shorter, line breaks */
    var kw = [];
    if (produto) kw.push(produto);
    if (marca) kw.push(marca);
    if (modelo) kw.push(modelo);
    if (cor) kw.push(cor);
    if (qty) kw.push(qty);
    if (material) kw.push(material);
    for (bi = 0; bi < beneficios.length; bi++) kw.push(beneficios[bi]);
    var shopeeLines = [kw.join(" ")];
    if (caixa) shopeeLines.push("Na caixa: " + caixa);
    if (garantia) shopeeLines.push("Garantia: " + garantia);
    if (paraQuem) shopeeLines.push("Para: " + paraQuem);
    var shopeeText = shopeeLines.join("\n");
    if (shopeeText.length > DESC_SHOPEE_MAX) {
      shopeeText = shopeeText.slice(0, DESC_SHOPEE_MAX);
    }

    var previewText = mlText.slice(0, DESC_PREVIEW_MAX);

    return {
      ml: {
        label: "Mercado Livre",
        hint: "gancho + specs + caixa + garantia · soft 5000 / hard 50000",
        text: mlText,
        chars: mlText.length,
        max: DESC_ML_MAX
      },
      shopee: {
        label: "Shopee",
        hint: "keywords na frente, mais curto · soft/hard ~5000",
        text: shopeeText,
        chars: shopeeText.length,
        max: DESC_SHOPEE_MAX
      },
      preview: {
        label: "Preview 500",
        hint: "o que a busca/card costuma mostrar",
        text: previewText,
        chars: previewText.length,
        max: DESC_PREVIEW_MAX
      }
    };
  }


  /* ------------------------------------------------------------------ */
  /* Frete — peso cubado / tarifado / estimativa / embutir no preço      */
  /* ------------------------------------------------------------------ */

  var ML_FREE_SHIPPING_THRESHOLD = 79;

  /* Faixas ESTIMATIVA amplas (não oficiais). Baseadas em faixas públicas
     aproximadas de blogs 2025/2026 (ex.: até 0,5 kg ~R$10–30). Confirme
     no Seller Center / simulador. */
  var FREIGHT_BANDS_ML = [
    { maxKg: 0.3, low: 8, high: 24 },
    { maxKg: 0.5, low: 10, high: 30 },
    { maxKg: 1, low: 14, high: 38 },
    { maxKg: 2, low: 18, high: 48 },
    { maxKg: 5, low: 25, high: 75 },
    { maxKg: 9, low: 35, high: 110 },
    { maxKg: 15, low: 50, high: 160 },
    { maxKg: Infinity, low: 70, high: 220 }
  ];

  var FREIGHT_BANDS_SHOPEE = [
    { maxKg: 0.3, low: 7, high: 22 },
    { maxKg: 0.5, low: 9, high: 28 },
    { maxKg: 1, low: 12, high: 36 },
    { maxKg: 2, low: 16, high: 45 },
    { maxKg: 5, low: 22, high: 70 },
    { maxKg: 9, low: 32, high: 105 },
    { maxKg: 15, low: 45, high: 150 },
    { maxKg: Infinity, low: 65, high: 210 }
  ];

  /** Cubagem padrão Mercado Envios / Correios: (C×L×A cm) / 6000 → kg */
  function cubedKg(lengthCm, widthCm, heightCm) {
    var C = Math.max(0, toNumber(lengthCm));
    var L = Math.max(0, toNumber(widthCm));
    var A = Math.max(0, toNumber(heightCm));
    return (C * L * A) / 6000;
  }

  function cubedWeight(lengthCm, widthCm, heightCm) {
    return cubedKg(lengthCm, widthCm, heightCm);
  }

  function billedKg(realKg, cubed) {
    return Math.max(Math.max(0, toNumber(realKg)), Math.max(0, toNumber(cubed)));
  }

  function billedWeight(realKg, cubed) {
    return billedKg(realKg, cubed);
  }

  function pickFreightBand(kg, marketplace) {
    var bands =
      marketplace === "shopee" ? FREIGHT_BANDS_SHOPEE : FREIGHT_BANDS_ML;
    var i;
    for (i = 0; i < bands.length; i++) {
      if (kg <= bands[i].maxKg) return bands[i];
    }
    return bands[bands.length - 1];
  }

  /**
   * Estimativa ampla de frete por peso tarifado. NÃO é tabela oficial.
   * Retorna {low, high, mid, billedKg, marketplace, label}.
   */
  function estimateFreightBRL(billed, marketplace) {
    var kg = Math.max(0, toNumber(billed));
    var mp = marketplace === "shopee" ? "shopee" : "mercadolivre";
    var b = pickFreightBand(kg, mp);
    var low = b.low;
    var high = b.high;
    if (kg > 15 && Number.isFinite(kg)) {
      var extra = Math.ceil(kg - 15);
      low = b.low + extra * 4;
      high = b.high + extra * 10;
    }
    var mid = Math.round(((low + high) / 2) * 100) / 100;
    return {
      low: low,
      high: high,
      mid: mid,
      billedKg: kg,
      marketplace: mp,
      label: "ESTIMATIVA"
    };
  }

  /** ML costuma exigir frete grátis (vendedor) a partir de R$ 79 em muitas categorias. */
  function mlFreeShippingLikely(price) {
    return toNumber(price) >= ML_FREE_SHIPPING_THRESHOLD;
  }

  /**
   * Quanto embutir no preço de anúncio para cobrir o frete depois da taxa %.
   * feePct aceita 12 ou 0.12. embed = freight / (1 - fee).
   */
  function embedFreightInPrice(freight, feePct) {
    var f = toNumber(freight);
    var p = toNumber(feePct);
    if (p > 1) p = p / 100;
    if (!(p < 1) || p < 0) return NaN;
    if (!Number.isFinite(f) || f < 0) return NaN;
    return f / (1 - p);
  }

  function calculateFreight(state) {
    state = state || {};
    var real = Math.max(0, toNumber(state.realKg));
    var cubed = cubedKg(state.lengthCm, state.widthCm, state.heightCm);
    var billed = billedKg(real, cubed);
    var mp = state.marketplace === "shopee" ? "shopee" : "mercadolivre";
    var feePct = toNumber(state.feePct);
    if (!feePct) feePct = mp === "shopee" ? 14 : 12;
    var who = state.whoPays === "buyer" ? "buyer" : "seller";
    var price = Math.max(0, toNumber(state.listPrice));
    var est = estimateFreightBRL(billed, mp);
    var freeLikely = mp === "mercadolivre" && mlFreeShippingLikely(price);
    var embedMid = embedFreightInPrice(est.mid, feePct);
    var embedLow = embedFreightInPrice(est.low, feePct);
    var embedHigh = embedFreightInPrice(est.high, feePct);
    return {
      realKg: real,
      cubedKg: cubed,
      billedKg: billed,
      estimate: est,
      marketplace: mp,
      feePct: feePct,
      whoPays: who,
      listPrice: price,
      mlFreeShippingLikely: freeLikely,
      freeShippingThreshold: ML_FREE_SHIPPING_THRESHOLD,
      embedAmount: embedMid,
      embedLow: embedLow,
      embedHigh: embedHigh,
      suggestedPrice: Number.isFinite(embedMid) ? price + embedMid : price,
      disclaimer:
        "ESTIMATIVA. Não é tabela oficial — confirme no Seller Center / simulador de envios."
    };
  }

  function mountTitle(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("titlegen");

    var panel = el("div", { class: "titlegen__panel" });
    panel.appendChild(el("p", { class: "titlegen__kicker" }, "Gerador de título Mercado Livre"));
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Três títulos, 60 caracteres")
    );

    var fields = el("div", { class: "titlegen__fields" });
    fields.appendChild(
      field({
        id: "ttl-produto",
        type: "text",
        label: "Produto",
        placeholder: "Fone bluetooth",
        wide: true
      })
    );
    fields.appendChild(field({ id: "ttl-marca", type: "text", label: "Marca", placeholder: "Sony" }));
    fields.appendChild(field({ id: "ttl-modelo", type: "text", label: "Modelo", placeholder: "WH-1000XM5" }));
    fields.appendChild(field({ id: "ttl-cor", type: "text", label: "Cor", placeholder: "preto" }));
    fields.appendChild(
      field({
        id: "ttl-qty",
        type: "text",
        label: "Quantidade / tamanho",
        placeholder: "500ml · M · kit 3"
      })
    );
    fields.appendChild(field({ id: "ttl-material", type: "text", label: "Material", placeholder: "algodão" }));
    fields.appendChild(
      field({
        id: "ttl-diffs",
        type: "text",
        label: "1–2 diferenciais",
        placeholder: "cancelamento de ruído, 30h bateria",
        wide: true
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Limite clássico do ML: 60 caracteres. Número, cor e modelo na frente. Sem “incrível” e sem promoção."
      )
    );
    root.appendChild(panel);

    var list = el("div", { class: "titlegen__list", "aria-live": "polite" });
    root.appendChild(list);

    function read() {
      return {
        produto: document.getElementById("ttl-produto").value,
        marca: document.getElementById("ttl-marca").value,
        modelo: document.getElementById("ttl-modelo").value,
        cor: document.getElementById("ttl-cor").value,
        qty: document.getElementById("ttl-qty").value,
        material: document.getElementById("ttl-material").value,
        diffs: document.getElementById("ttl-diffs").value
      };
    }

    function paintCount(node, n) {
      node.textContent = n + "/" + TITLE_MAX;
      node.classList.toggle("is-over", n > TITLE_MAX);
      node.classList.toggle("is-ok", n > 0 && n <= TITLE_MAX);
    }

    function render() {
      var rows = generateMlTitles(read());
      list.innerHTML = "";
      rows.forEach(function (row, idx) {
        var card = el("article", { class: "title-card" });
        card.appendChild(el("p", { class: "title-card__label" }, "Opção " + (idx + 1) + " · " + row.label));
        card.appendChild(el("p", { class: "title-card__hint" }, row.hint));
        var box = el("div", { class: "title-card__row" });
        var inp = el("input", {
          class: "title-card__input",
          type: "text",
          maxlength: String(TITLE_MAX),
          value: row.title,
          "aria-label": "Título opção " + (idx + 1)
        });
        var count = el("span", { class: "title-card__count" });
        paintCount(count, row.title.length);
        inp.addEventListener("input", function () {
          if (inp.value.length > TITLE_MAX) inp.value = inp.value.slice(0, TITLE_MAX);
          paintCount(count, inp.value.length);
        });
        box.appendChild(inp);
        box.appendChild(count);
        card.appendChild(box);
        var copyBtn = el(
          "button",
          { type: "button", class: "btn btn--ghost title-card__copy" },
          "Copiar"
        );
        copyBtn.addEventListener("click", function () {
          var text = inp.value.trim();
          if (!text) {
            toast("Preenche o produto primeiro.");
            return;
          }
          copyText(text)
            .then(function () {
              toast("Título copiado (" + text.length + " caracteres).");
            })
            .catch(function () {
              toast("Não deu para copiar. Seleciona o texto.");
            });
        });
        card.appendChild(copyBtn);
        list.appendChild(card);
      });
    }

    panel.addEventListener("input", render);
    render();
  }



  var SHEET_MAX = 200;

  function normHeader(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitSheetLine(line, delim) {
    var out = [];
    var cur = "";
    var i = 0;
    var inQ = false;
    while (i < line.length) {
      var ch = line.charAt(i);
      if (inQ) {
        if (ch === '"') {
          if (line.charAt(i + 1) === '"') {
            cur += '"';
            i += 2;
            continue;
          }
          inQ = false;
          i += 1;
          continue;
        }
        cur += ch;
        i += 1;
        continue;
      }
      if (ch === '"') {
        inQ = true;
        i += 1;
        continue;
      }
      if (ch === delim) {
        out.push(cur);
        cur = "";
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
    }
    out.push(cur);
    return out;
  }

  function detectSheetDelim(firstLine) {
    if (firstLine.indexOf("\t") !== -1) return "\t";
    var semis = (firstLine.match(/;/g) || []).length;
    var commas = (firstLine.match(/,/g) || []).length;
    if (semis > commas) return ";";
    return ",";
  }

  function mapSheetHeader(cells) {
    var map = { sku: -1, custo: -1, embalagem: -1, frete: -1 };
    var i, h;
    for (i = 0; i < cells.length; i++) {
      h = normHeader(cells[i]);
      if (
        map.sku < 0 &&
        (h === "sku" ||
          h === "codigo" ||
          h === "produto" ||
          h === "item" ||
          h === "id")
      ) {
        map.sku = i;
      } else if (
        map.custo < 0 &&
        (h === "custo" ||
          h === "cost" ||
          h === "preco de custo" ||
          h === "preco" ||
          h === "valor")
      ) {
        map.custo = i;
      } else if (
        map.embalagem < 0 &&
        (h === "embalagem" || h === "pack" || h === "packaging")
      ) {
        map.embalagem = i;
      } else if (
        map.frete < 0 &&
        (h === "frete" || h === "freight" || h === "envio")
      ) {
        map.frete = i;
      }
    }
    return map;
  }

  function looksLikeSheetHeader(cells) {
    if (!cells || !cells.length) return false;
    var first = normHeader(cells[0]);
    var skuOk =
      first === "sku" ||
      first === "codigo" ||
      first === "produto" ||
      first === "item" ||
      first === "id";
    if (!skuOk) return false;
    var i, h;
    for (i = 1; i < cells.length; i++) {
      h = normHeader(cells[i]);
      if (
        h === "custo" ||
        h === "cost" ||
        h === "preco de custo" ||
        h === "preco" ||
        h === "valor"
      ) {
        return true;
      }
    }
    return false;
  }

  function parseSheet(text, opts) {
    opts = opts || {};
    var max = opts.max != null ? opts.max : SHEET_MAX;
    var raw = String(text == null ? "" : text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = raw.split("\n");
    var skipped = 0;
    var truncated = false;
    var errors = [];
    var rows = [];
    var i;
    var firstNonBlank = -1;
    for (i = 0; i < lines.length; i++) {
      if (String(lines[i] || "").trim()) {
        firstNonBlank = i;
        break;
      }
      skipped += 1;
    }
    if (firstNonBlank < 0) {
      return { rows: [], skipped: skipped, truncated: false, errors: errors };
    }
    var delim = detectSheetDelim(lines[firstNonBlank]);
    var start = firstNonBlank;
    var colMap = { sku: 0, custo: 1, embalagem: 2, frete: 3 };
    var firstCells = splitSheetLine(lines[firstNonBlank], delim).map(function (c) {
      return String(c || "").trim();
    });
    if (looksLikeSheetHeader(firstCells)) {
      colMap = mapSheetHeader(firstCells);
      if (colMap.sku < 0) colMap.sku = 0;
      if (colMap.custo < 0) colMap.custo = 1;
      start = firstNonBlank + 1;
    }

    for (i = start; i < lines.length; i++) {
      var line = lines[i];
      if (!String(line || "").trim()) {
        skipped += 1;
        continue;
      }
      if (rows.length >= max) {
        truncated = true;
        break;
      }
      var cells = splitSheetLine(line, delim).map(function (c) {
        return String(c || "").trim();
      });
      var sku = colMap.sku >= 0 && colMap.sku < cells.length ? cells[colMap.sku] : "";
      var costRaw =
        colMap.custo >= 0 && colMap.custo < cells.length ? cells[colMap.custo] : "";
      var packRaw =
        colMap.embalagem >= 0 && colMap.embalagem < cells.length
          ? cells[colMap.embalagem]
          : "";
      var frtRaw =
        colMap.frete >= 0 && colMap.frete < cells.length ? cells[colMap.frete] : "";

      /* Sem cabeçalho: 1 coluna = só SKU (custo 0); 2+ = sku, custo, embalagem?, frete? */
      if (!looksLikeSheetHeader(firstCells) && cells.length === 1) {
        sku = cells[0];
        costRaw = "";
        packRaw = "";
        frtRaw = "";
      }

      var productCost = toNumber(costRaw);
      var packaging = toNumber(packRaw);
      var freight = toNumber(frtRaw);
      rows.push({
        sku: sku,
        productCost: productCost,
        packaging: packaging,
        freight: freight,
        line: i + 1
      });
    }

    /* Conta linhas extras além do cap como truncated (já setado) */
    if (!truncated) {
      for (i = start + rows.length; i < lines.length; i++) {
        if (String(lines[i] || "").trim()) {
          /* ainda há dados depois do que lemos? só se paramos por outra razão */
        }
      }
    }
    /* Se paramos no cap, verificar se restam linhas não-vazias */
    if (rows.length >= max) {
      for (i = start; i < lines.length; i++) {
        /* recount: after consuming max data rows */
      }
      var seen = 0;
      for (i = start; i < lines.length; i++) {
        if (!String(lines[i] || "").trim()) continue;
        seen += 1;
        if (seen > max) {
          truncated = true;
          break;
        }
      }
    }

    return {
      rows: rows,
      skipped: skipped,
      truncated: truncated,
      errors: errors
    };
  }

  function priceSheet(rows, defaults) {
    defaults = defaults || {};
    var marketplace = defaults.marketplace || "ml-classico";
    var marketplaceLabel =
      defaults.marketplaceLabel ||
      (PRESETS[marketplace] && PRESETS[marketplace].label) ||
      marketplace;
    var feePct = defaults.feePct != null ? defaults.feePct : 12;
    var taxPct = defaults.taxPct != null ? defaults.taxPct : 0;
    var marginPct = defaults.marginPct != null ? defaults.marginPct : 20;
    var sellerPaysFreight =
      defaults.sellerPaysFreight == null ? true : !!defaults.sellerPaysFreight;
    var out = [];
    var i;
    for (i = 0; i < (rows || []).length; i++) {
      var row = rows[i] || {};
      var sku = String(row.sku == null ? "" : row.sku).trim();
      var productCost = toNumber(row.productCost);
      var packaging = toNumber(row.packaging);
      var freight = toNumber(row.freight);
      if (!sku) {
        out.push({
          sku: sku,
          productCost: productCost,
          packaging: packaging,
          freight: freight,
          costTotal: 0,
          sellingPrice: NaN,
          profit: NaN,
          effectiveMargin: NaN,
          feeAmount: NaN,
          ok: false,
          error: "SKU vazio"
        });
        continue;
      }
      if (!(productCost > 0)) {
        out.push({
          sku: sku,
          productCost: productCost,
          packaging: packaging,
          freight: freight,
          costTotal: costTotal(productCost, packaging, freight, sellerPaysFreight),
          sellingPrice: NaN,
          profit: NaN,
          effectiveMargin: NaN,
          feeAmount: NaN,
          ok: false,
          error: "custo precisa ser > 0"
        });
        continue;
      }
      var r = calculate({
        productCost: productCost,
        packaging: packaging,
        freight: freight,
        sellerPaysFreight: sellerPaysFreight,
        feePct: feePct,
        taxPct: taxPct,
        marginPct: marginPct,
        marketplace: marketplace,
        marketplaceLabel: marketplaceLabel,
        mode: "forward",
        target: "margin"
      });
      if (!r.ok) {
        out.push({
          sku: sku,
          productCost: productCost,
          packaging: packaging,
          freight: freight,
          costTotal: r.costTotal,
          sellingPrice: NaN,
          profit: NaN,
          effectiveMargin: NaN,
          feeAmount: NaN,
          ok: false,
          error: r.error || "falha no cálculo"
        });
        continue;
      }
      out.push({
        sku: sku,
        productCost: productCost,
        packaging: packaging,
        freight: freight,
        costTotal: r.costTotal,
        sellingPrice: r.sellingPrice,
        profit: r.profit,
        effectiveMargin: r.effectiveMargin,
        feeAmount: r.feeAmount,
        ok: true,
        error: ""
      });
    }
    return out;
  }

  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function numPlain(n) {
    if (!Number.isFinite(n)) return "";
    return String(Math.round(n * 10000) / 10000);
  }

  function sheetToCsv(pricedRows) {
    var lines = [
      "sku,custo,embalagem,frete,custo_total,preco_minimo,lucro,margem,status"
    ];
    var i;
    for (i = 0; i < (pricedRows || []).length; i++) {
      var r = pricedRows[i];
      var status = r.ok ? "ok" : String(r.error || "erro");
      var margem = Number.isFinite(r.effectiveMargin)
        ? numPlain(r.effectiveMargin * 100)
        : "";
      lines.push(
        [
          csvEscape(r.sku),
          numPlain(r.productCost),
          numPlain(r.packaging),
          numPlain(r.freight),
          numPlain(r.costTotal),
          numPlain(r.sellingPrice),
          numPlain(r.profit),
          margem,
          csvEscape(status)
        ].join(",")
      );
    }
    return lines.join("\n");
  }

  function sheetToCsvBom(pricedRows) {
    return "\uFEFF" + sheetToCsv(pricedRows);
  }

  function mountDesc(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("descgen", "titlegen");

    var panel = el("div", { class: "titlegen__panel" });
    panel.appendChild(
      el("p", { class: "titlegen__kicker" }, "Gerador de descrição ML / Shopee")
    );
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Três textos prontos pra colar")
    );

    var fields = el("div", { class: "titlegen__fields" });
    fields.appendChild(
      field({
        id: "dsc-produto",
        type: "text",
        label: "Produto",
        placeholder: "Fone bluetooth",
        wide: true
      })
    );
    fields.appendChild(field({ id: "dsc-marca", type: "text", label: "Marca", placeholder: "Sony" }));
    fields.appendChild(field({ id: "dsc-modelo", type: "text", label: "Modelo", placeholder: "WH-1000XM5" }));
    fields.appendChild(field({ id: "dsc-cor", type: "text", label: "Cor", placeholder: "preto" }));
    fields.appendChild(
      field({
        id: "dsc-qty",
        type: "text",
        label: "Tamanho / quantidade",
        placeholder: "500ml · M · kit 3"
      })
    );
    fields.appendChild(
      field({ id: "dsc-material", type: "text", label: "Material", placeholder: "plástico / alumínio" })
    );
    fields.appendChild(
      field({
        id: "dsc-beneficios",
        type: "textarea",
        rows: 3,
        label: "1–3 benefícios / diferenciais",
        placeholder: "cancelamento de ruído, 30h de bateria, dobra na mala",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "dsc-caixa",
        type: "textarea",
        rows: 3,
        label: "O que vem na caixa",
        placeholder: "cabo USB e estojo",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "dsc-garantia",
        type: "text",
        label: "Garantia",
        placeholder: "12 meses"
      })
    );
    fields.appendChild(
      field({
        id: "dsc-paraquem",
        type: "text",
        label: "Para quem",
        placeholder: "quem viaja e quer silêncio no fone",
        wide: true
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Só o que você digitou. Sem “incrível”, sem “melhor do Brasil”. Soft cap ML ~5000; preview mostra os primeiros 500."
      )
    );
    root.appendChild(panel);

    var list = el("div", { class: "titlegen__list", "aria-live": "polite" });
    root.appendChild(list);

    function read() {
      return {
        produto: document.getElementById("dsc-produto").value,
        marca: document.getElementById("dsc-marca").value,
        modelo: document.getElementById("dsc-modelo").value,
        cor: document.getElementById("dsc-cor").value,
        qty: document.getElementById("dsc-qty").value,
        material: document.getElementById("dsc-material").value,
        beneficios: document.getElementById("dsc-beneficios").value,
        caixa: document.getElementById("dsc-caixa").value,
        garantia: document.getElementById("dsc-garantia").value,
        paraQuem: document.getElementById("dsc-paraquem").value
      };
    }

    function softCap(key) {
      if (key === "ml") return 5000;
      if (key === "shopee") return DESC_SHOPEE_MAX;
      return DESC_PREVIEW_MAX;
    }

    function paintCount(node, n, soft, hard) {
      node.textContent = n + "/" + soft;
      node.classList.toggle("is-over", n > soft);
      node.classList.toggle("is-ok", n > 0 && n <= soft);
      if (n > hard) node.classList.add("is-over");
    }

    function render() {
      var pack = generateDescriptions(read());
      var keys = ["ml", "shopee", "preview"];
      list.innerHTML = "";
      keys.forEach(function (key) {
        var row = pack[key];
        var soft = softCap(key);
        var card = el("article", { class: "title-card desc-card" });
        card.appendChild(el("p", { class: "title-card__label" }, row.label));
        card.appendChild(el("p", { class: "title-card__hint" }, row.hint));
        var body = el("div", { class: "desc-card__body" });
        var ta = el("textarea", {
          class: "title-card__input",
          rows: key === "preview" ? "4" : "8",
          "aria-label": row.label
        });
        ta.value = row.text;
        if (key === "preview") ta.maxLength = DESC_PREVIEW_MAX;
        else if (key === "shopee") ta.maxLength = DESC_SHOPEE_MAX;
        else ta.maxLength = DESC_ML_MAX;
        var count = el("span", { class: "title-card__count" });
        paintCount(count, row.text.length, soft, row.max);
        ta.addEventListener("input", function () {
          if (ta.value.length > row.max) ta.value = ta.value.slice(0, row.max);
          paintCount(count, ta.value.length, soft, row.max);
        });
        body.appendChild(ta);
        body.appendChild(count);
        card.appendChild(body);
        var copyBtn = el(
          "button",
          { type: "button", class: "btn btn--ghost title-card__copy" },
          "Copiar"
        );
        copyBtn.addEventListener("click", function () {
          var text = ta.value;
          if (!String(text || "").trim()) {
            toast("Preenche o produto primeiro.");
            return;
          }
          copyText(text)
            .then(function () {
              toast("Descrição copiada (" + text.length + " caracteres).");
            })
            .catch(function () {
              toast("Não deu para copiar. Seleciona o texto.");
            });
        });
        card.appendChild(copyBtn);
        list.appendChild(card);
      });
    }

    panel.addEventListener("input", render);
    render();
  }



  function mountSheet(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("sheetgen", "titlegen");

    var panel = el("div", { class: "titlegen__panel sheetgen__panel" });
    panel.appendChild(
      el("p", { class: "titlegen__kicker" }, "Lote por planilha · ESTIMATIVA")
    );
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Cola a lista, sai o preço mínimo")
    );

    var sample =
      "sku,custo,embalagem,frete\n" +
      "SKU-001,45,90,2,00,8,50\n" +
      "SKU-002,120,0,15";
    /* placeholder with BR decimals as separate lines for clarity */
    sample =
      "sku;custo;embalagem;frete\n" +
      "SKU-001;45,90;2,00;8,50\n" +
      "SKU-002;120;0;15\n" +
      "SKU-003;30,5;1;0";

    var fields = el("div", { class: "titlegen__fields sheetgen__fields" });
    fields.appendChild(
      field({
        id: "sht-paste",
        type: "textarea",
        rows: 8,
        label: "Cole SKUs (CSV / TSV / Excel BR)",
        placeholder: sample,
        wide: true
      })
    );

    var mpOpts = [];
    Object.keys(PRESETS).forEach(function (id) {
      var p = PRESETS[id];
      mpOpts.push({
        value: id,
        label: p.label + " · " + p.feePct + "%",
        selected: id === "ml-classico"
      });
    });
    fields.appendChild(
      field({
        id: "sht-mp",
        type: "select",
        label: "Marketplace",
        options: mpOpts
      })
    );
    fields.appendChild(
      field({
        id: "sht-fee",
        label: "Taxa %",
        value: "12",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "sht-tax",
        label: "Imposto %",
        value: "0",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "sht-margin",
        label: "Margem %",
        value: "20",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );

    var chkWrap = el("label", { class: "field field--check field--wide" });
    var chk = el("input", {
      type: "checkbox",
      id: "sht-freight",
      checked: true
    });
    chk.checked = true;
    chkWrap.appendChild(chk);
    chkWrap.appendChild(
      el("span", { class: "field__label" }, "Vendedor paga o frete")
    );
    fields.appendChild(chkWrap);

    panel.appendChild(fields);

    var actions = el("div", { class: "sheetgen__actions" });
    var btnCalc = el("button", { type: "button", class: "btn btn--solid" }, "Calcular");
    var btnCsv = el("button", { type: "button", class: "btn btn--ghost" }, "Baixar CSV");
    var btnCopy = el("button", { type: "button", class: "btn btn--ghost" }, "Copiar");
    actions.appendChild(btnCalc);
    actions.appendChild(btnCsv);
    actions.appendChild(btnCopy);
    panel.appendChild(actions);

    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Até " +
          SHEET_MAX +
          " SKUs. Mesma taxa e margem no lote. ESTIMATIVA — confirme no Seller Center."
      )
    );
    root.appendChild(panel);

    var meta = el("p", { class: "sheetgen__meta muted", "aria-live": "polite" });
    root.appendChild(meta);
    var tableWrap = el("div", { class: "sheetgen__table-wrap" });
    root.appendChild(tableWrap);

    var lastPriced = [];
    var feeDirty = false;
    var mpEl = document.getElementById("sht-mp");
    var feeEl = document.getElementById("sht-fee");

    function defaultsFromUi() {
      var id = mpEl.value;
      var pre = PRESETS[id] || PRESETS["ml-classico"];
      return {
        marketplace: id,
        marketplaceLabel: pre.label,
        feePct: toNumber(feeEl.value),
        taxPct: toNumber(document.getElementById("sht-tax").value),
        marginPct: toNumber(document.getElementById("sht-margin").value),
        sellerPaysFreight: !!document.getElementById("sht-freight").checked
      };
    }

    function run() {
      var pasted = document.getElementById("sht-paste").value;
      var parsed = parseSheet(pasted);
      var priced = priceSheet(parsed.rows, defaultsFromUi());
      lastPriced = priced;
      var okN = 0;
      var errN = 0;
      var i;
      for (i = 0; i < priced.length; i++) {
        if (priced[i].ok) okN += 1;
        else errN += 1;
      }
      var msg =
        priced.length +
        " SKUs · " +
        okN +
        " ok · " +
        errN +
        " erro";
      if (parsed.truncated) msg += " · truncado em " + SHEET_MAX;
      meta.textContent = msg;

      tableWrap.innerHTML = "";
      if (!priced.length) {
        tableWrap.appendChild(
          el("p", { class: "muted" }, "Cola a lista e aperta Calcular.")
        );
        return;
      }
      var table = el("table", { class: "sheetgen__table" });
      var thead = el("thead", {});
      var hr = el("tr", {});
      ["SKU", "Custo", "Preço mínimo", "Lucro", "Margem"].forEach(function (h) {
        hr.appendChild(el("th", {}, h));
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el("tbody", {});
      priced.forEach(function (r) {
        var tr = el("tr", { class: r.ok ? "" : "is-error" });
        tr.appendChild(el("td", {}, r.sku || "—"));
        tr.appendChild(el("td", {}, formatBRL(r.productCost)));
        tr.appendChild(
          el("td", {}, r.ok ? formatBRL(r.sellingPrice) : r.error || "erro")
        );
        tr.appendChild(el("td", {}, r.ok ? formatBRL(r.profit) : "—"));
        tr.appendChild(
          el("td", {}, r.ok ? formatPct(r.effectiveMargin) : "—")
        );
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
    }

    function downloadCsv() {
      if (!lastPriced.length) {
        toast("Calcula o lote primeiro.");
        return;
      }
      var blob = new Blob([sheetToCsvBom(lastPriced)], {
        type: "text/csv;charset=utf-8"
      });
      var url = URL.createObjectURL(blob);
      var a = el("a", { href: url, download: "precifica-lote.csv" });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("CSV baixado.");
    }

    function copyTsv() {
      if (!lastPriced.length) {
        toast("Calcula o lote primeiro.");
        return;
      }
      var lines = ["SKU\tCusto\tPreço mínimo\tLucro\tMargem\tStatus"];
      lastPriced.forEach(function (r) {
        lines.push(
          [
            r.sku,
            Number.isFinite(r.productCost) ? r.productCost : "",
            r.ok && Number.isFinite(r.sellingPrice) ? r.sellingPrice : "",
            r.ok && Number.isFinite(r.profit) ? r.profit : "",
            r.ok && Number.isFinite(r.effectiveMargin)
              ? (r.effectiveMargin * 100).toFixed(1) + "%"
              : "",
            r.ok ? "ok" : r.error || "erro"
          ].join("\t")
        );
      });
      copyText(lines.join("\n"))
        .then(function () {
          toast("Tabela copiada (TSV).");
        })
        .catch(function () {
          toast("Não deu para copiar.");
        });
    }

    btnCalc.addEventListener("click", run);
    btnCsv.addEventListener("click", downloadCsv);
    btnCopy.addEventListener("click", copyTsv);
    mpEl.addEventListener("change", function () {
      if (!feeDirty) {
        var pre = PRESETS[mpEl.value];
        if (pre) feeEl.value = String(pre.feePct);
      }
    });
    feeEl.addEventListener("input", function () {
      feeDirty = true;
    });
  }


  /**
   * Contribuição unitária (margem de contribuição) após taxas e custos variáveis.
   * feePct/taxPct: aceita 14 ou 0.14. ESTIMATIVA.
   * contribution = price - fee% - feeFixed - tax% - freight - varCost
   */
  function contributionPerUnit(price, feePct, feeFixed, taxPct, freight, varCost) {
    var p = Math.max(0, toNumber(price));
    var feeRate = toNumber(feePct);
    if (feeRate > 1) feeRate = feeRate / 100;
    var taxRate = toNumber(taxPct);
    if (taxRate > 1) taxRate = taxRate / 100;
    var feeAmt = p * feeRate;
    var taxAmt = p * taxRate;
    var fixedFee = Math.max(0, toNumber(feeFixed));
    var frt = Math.max(0, toNumber(freight));
    var vc = Math.max(0, toNumber(varCost));
    return p - feeAmt - fixedFee - taxAmt - frt - vc;
  }

  /** Unidades no ponto de equilíbrio: ceil(fixed/contribution) ou Infinity se contribution ≤ 0. */
  function breakEvenUnits(fixed, contribution) {
    var f = toNumber(fixed);
    var c = toNumber(contribution);
    if (!(c > 0)) return Infinity;
    if (!Number.isFinite(f) || f < 0) return Infinity;
    return Math.ceil(f / c);
  }

  /** Lucro projetado: n * contribution - fixed. */
  function projectedProfit(n, fixed, contribution) {
    return toNumber(n) * toNumber(contribution) - toNumber(fixed);
  }

  function calculateEquilibrium(state) {
    state = state || {};
    var fixed = Math.max(0, toNumber(state.fixedCost));
    var varCost = Math.max(0, toNumber(state.varCost));
    var price = Math.max(0, toNumber(state.price));
    var feePct = state.feePct == null || state.feePct === "" ? 14 : toNumber(state.feePct);
    var feeFixed = Math.max(0, toNumber(state.feeFixed));
    var taxPct = state.taxPct == null || state.taxPct === "" ? 6 : toNumber(state.taxPct);
    var freight = Math.max(0, toNumber(state.freight));
    var contrib = contributionPerUnit(price, feePct, feeFixed, taxPct, freight, varCost);
    var units = breakEvenUnits(fixed, contrib);
    var feePctOut = feePct > 1 || feePct === 0 ? feePct : feePct * 100;
    var taxPctOut = taxPct > 1 || taxPct === 0 ? taxPct : taxPct * 100;
    var revenue = Number.isFinite(units) ? units * price : Infinity;
    return {
      fixedCost: fixed,
      varCost: varCost,
      price: price,
      feePct: feePctOut,
      feeFixed: feeFixed,
      taxPct: taxPctOut,
      freight: freight,
      contribution: contrib,
      breakEvenUnits: units,
      breakEvenRevenue: revenue,
      profit50: projectedProfit(50, fixed, contrib),
      profit100: projectedProfit(100, fixed, contrib),
      profit200: projectedProfit(200, fixed, contrib),
      disclaimer: "ESTIMATIVA. Confirme taxas e custos no Seller Center."
    };
  }


  function acosPct(adSpend, adRevenue) {
    var spend = Math.max(0, toNumber(adSpend));
    var rev = toNumber(adRevenue);
    if (!(rev > 0)) return null;
    return (spend / rev) * 100;
  }

  function tacosPct(adSpend, totalRevenue) {
    var spend = Math.max(0, toNumber(adSpend));
    var rev = toNumber(totalRevenue);
    if (!(rev > 0)) return null;
    return (spend / rev) * 100;
  }

  function profitAfterAds(totalRevenue, marginPct, adSpend) {
    var rev = Math.max(0, toNumber(totalRevenue));
    var margin = toNumber(marginPct);
    var spend = Math.max(0, toNumber(adSpend));
    return rev * (margin / 100) - spend;
  }

  function maxAdSpendAtMargin(totalRevenue, marginPct) {
    var rev = Math.max(0, toNumber(totalRevenue));
    var margin = toNumber(marginPct);
    return rev * (margin / 100);
  }

  function calculateTacos(state) {
    state = state || {};
    var totalRevenue = Math.max(0, toNumber(state.totalRevenue));
    var adSpend = Math.max(0, toNumber(state.adSpend));
    var adRevenueRaw = state.adRevenue;
    var adRevenue =
      adRevenueRaw == null || adRevenueRaw === ""
        ? totalRevenue
        : Math.max(0, toNumber(adRevenueRaw));
    var marginPct =
      state.marginPct == null || state.marginPct === ""
        ? 20
        : toNumber(state.marginPct);
    var marketplace = state.marketplace || "amazon";
    var acos = acosPct(adSpend, adRevenue);
    var tacos = tacosPct(adSpend, totalRevenue);
    var profit = profitAfterAds(totalRevenue, marginPct, adSpend);
    var maxSpend = maxAdSpendAtMargin(totalRevenue, marginPct);
    var breakEven = marginPct;
    var overSpend = adSpend > maxSpend + 1e-9;
    var overAcos = acos != null && acos > marginPct + 1e-9;
    var badge = overSpend || overAcos || profit < -1e-9 ? "VERMELHO" : "VERDE";
    return {
      totalRevenue: totalRevenue,
      adSpend: adSpend,
      adRevenue: adRevenue,
      marginPct: marginPct,
      marketplace: marketplace,
      acosPct: acos,
      tacosPct: tacos,
      breakEvenAcosPct: breakEven,
      profitAfterAds: profit,
      maxAdSpend: maxSpend,
      badge: badge,
      disclaimer:
        "ESTIMATIVA. Confirme no Seller Central / Ads console (Amazon) ou no painel de Ads do marketplace."
    };
  }


  function simulateMlBid(state) {
    state = state || {};
    var bid = Math.max(0, toNumber(state.bid != null ? state.bid : state.cpc));
    var ctrPct =
      state.ctrPct == null || state.ctrPct === ""
        ? 1.5
        : Math.max(0, toNumber(state.ctrPct));
    var convPct =
      state.convPct == null || state.convPct === ""
        ? 8
        : Math.max(0, toNumber(state.convPct));
    var price = Math.max(0, toNumber(state.price));
    var cost = Math.max(0, toNumber(state.cost));
    var feePct =
      state.feePct == null || state.feePct === ""
        ? 14
        : Math.max(0, toNumber(state.feePct));
    var feeFixed =
      state.feeFixed == null || state.feeFixed === ""
        ? 6
        : Math.max(0, toNumber(state.feeFixed));
    var taxPct =
      state.taxPct == null || state.taxPct === ""
        ? 6
        : Math.max(0, toNumber(state.taxPct));
    var budget =
      state.budget == null || state.budget === ""
        ? 50
        : Math.max(0, toNumber(state.budget));
    var impressionsIn =
      state.impressions == null || state.impressions === ""
        ? null
        : Math.max(0, toNumber(state.impressions));

    var cpc = bid;
    var clicksDay = cpc > 0 ? budget / cpc : 0;
    var ordersDay = clicksDay * (convPct / 100);
    var revenueDay = ordersDay * price;
    var spendDay = budget;
    var feeUnit = price * (feePct / 100) + feeFixed;
    var taxUnit = price * (taxPct / 100);
    var profitUnit = price - cost - feeUnit - taxUnit;
    var adCostOrder =
      convPct > 0 ? cpc / (convPct / 100) : null;
    var profitAfterAdsOrder =
      adCostOrder == null ? null : profitUnit - adCostOrder;
    var acosLike =
      adCostOrder != null && price > 0
        ? (adCostOrder / price) * 100
        : null;
    var roas =
      spendDay > 0 ? revenueDay / spendDay : null;
    var breakEvenCpc =
      convPct > 0 ? profitUnit * (convPct / 100) : null;
    var maxBidSuggested =
      breakEvenCpc != null && breakEvenCpc > 0
        ? breakEvenCpc * 0.8
        : null;
    var impressionsDay =
      impressionsIn != null
        ? impressionsIn
        : ctrPct > 0
          ? clicksDay / (ctrPct / 100)
          : null;

    var badge = "VERMELHO";
    if (profitAfterAdsOrder != null && Number.isFinite(profitAfterAdsOrder)) {
      if (profitAfterAdsOrder > 0 && (breakEvenCpc == null || bid <= breakEvenCpc + 1e-9)) {
        if (
          breakEvenCpc != null &&
          breakEvenCpc > 0 &&
          bid >= breakEvenCpc * 0.9 - 1e-9
        ) {
          badge = "AMARELO";
        } else {
          badge = "VERDE";
        }
      } else if (
        breakEvenCpc != null &&
        breakEvenCpc > 0 &&
        Math.abs(bid - breakEvenCpc) / breakEvenCpc <= 0.1 + 1e-9
      ) {
        badge = "AMARELO";
      } else if (profitAfterAdsOrder > 0 && breakEvenCpc != null && bid <= breakEvenCpc * 1.1 + 1e-9) {
        badge = "AMARELO";
      } else {
        badge = "VERMELHO";
      }
    }

    return {
      bid: bid,
      cpc: cpc,
      ctrPct: ctrPct,
      convPct: convPct,
      price: price,
      cost: cost,
      feePct: feePct,
      feeFixed: feeFixed,
      taxPct: taxPct,
      budget: budget,
      clicksDay: clicksDay,
      ordersDay: ordersDay,
      revenueDay: revenueDay,
      spendDay: spendDay,
      feeUnit: feeUnit,
      taxUnit: taxUnit,
      profitUnit: profitUnit,
      adCostOrder: adCostOrder,
      profitAfterAdsOrder: profitAfterAdsOrder,
      acosLikePct: acosLike,
      roas: roas,
      breakEvenCpc: breakEvenCpc,
      maxBidSuggested: maxBidSuggested,
      impressionsDay: impressionsDay,
      badge: badge,
      disclaimer:
        "ESTIMATIVA. CPC ≈ bid; confirme no painel de Ads do Mercado Livre antes de subir lance."
    };
  }

  function estimateMlBid(state) {
    return simulateMlBid(state);
  }

  function mountMlBid(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "bidmlgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Bid / CPC ML Ads · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Até quanto pagar de bid sem comer o lucro"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "bid-cpc",
        label: "Bid / CPC sugerido (R$)",
        value: "0.80",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "bid-ctr",
        label: "CTR estimado %",
        value: "1.5",
        step: "0.1",
        min: "0",
        max: "100"
      })
    );
    fields.appendChild(
      field({
        id: "bid-conv",
        label: "Conversão pós-clique %",
        value: "8",
        step: "0.1",
        min: "0",
        max: "100"
      })
    );
    fields.appendChild(
      field({
        id: "bid-price",
        label: "Preço do produto (R$)",
        value: "99.90",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "bid-cost",
        label: "Custo do produto (R$)",
        value: "40",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "bid-fee",
        label: "Taxa marketplace %",
        value: "14",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "bid-feefix",
        label: "Taxa fixa (R$)",
        value: "6",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "bid-tax",
        label: "Imposto %",
        value: "6",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "bid-budget",
        label: "Orçamento diário (R$)",
        value: "50",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "bid-impr",
        label: "Impressões/dia (opcional)",
        value: "",
        step: "1",
        min: "0"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "CPC ≈ bid (ESTIMATIVA). Cliques ≈ orçamento ÷ CPC. Pedidos ≈ cliques × conversão. Break-even CPC = lucro unitário × conversão. Confirme no painel de Ads do Mercado Livre."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function fmtPctOrDash(pct) {
      if (pct == null || !Number.isFinite(pct)) return "—";
      return (
        pct.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }) + "%"
      );
    }

    function fmtNum(n, digits) {
      if (n == null || !Number.isFinite(n)) return "—";
      return n.toLocaleString("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    }

    function read() {
      return {
        bid: document.getElementById("bid-cpc").value,
        ctrPct: document.getElementById("bid-ctr").value,
        convPct: document.getElementById("bid-conv").value,
        price: document.getElementById("bid-price").value,
        cost: document.getElementById("bid-cost").value,
        feePct: document.getElementById("bid-fee").value,
        feeFixed: document.getElementById("bid-feefix").value,
        taxPct: document.getElementById("bid-tax").value,
        budget: document.getElementById("bid-budget").value,
        impressions: document.getElementById("bid-impr").value
      };
    }

    function render() {
      var r = simulateMlBid(read());
      out.innerHTML = "";
      var loss = r.badge === "VERMELHO";
      var warn = r.badge === "AMARELO";
      var card = el(
        "article",
        {
          class:
            "result-card" +
            (loss ? " result-card--loss" : "") +
            (warn ? " result-card--warn" : "")
        }
      );
      card.appendChild(
        el("p", { class: "result-card__label" }, "Resultado · ESTIMATIVA")
      );
      card.appendChild(
        el(
          "p",
          {
            class:
              "result-card__price" +
              (loss ? " is-loss" : "") +
              (warn ? " is-warn" : "")
          },
          r.badge
        )
      );
      card.appendChild(
        el(
          "p",
          { class: "muted" },
          loss
            ? "Bid acima do lucro — ESTIMATIVA"
            : warn
              ? "Perto do break-even — ESTIMATIVA"
              : "Bid dentro do lucro — ESTIMATIVA"
        )
      );

      var ul = el("ul", { class: "result-card__rows" });
      function row(k, v) {
        var li = el("li", {});
        li.appendChild(el("span", {}, k));
        li.appendChild(el("strong", {}, v));
        ul.appendChild(li);
      }
      row("CPC (≈ bid)", formatBRL(r.cpc));
      row("Cliques/dia", fmtNum(r.clicksDay, 1));
      row("Pedidos/dia", fmtNum(r.ordersDay, 2));
      row("Receita/dia", formatBRL(r.revenueDay));
      row("Gasto/dia", formatBRL(r.spendDay));
      row("Lucro unitário (sem ads)", formatBRL(r.profitUnit));
      row("CAC ads / pedido", r.adCostOrder == null ? "—" : formatBRL(r.adCostOrder));
      row(
        "Lucro após ads / pedido",
        r.profitAfterAdsOrder == null ? "—" : formatBRL(r.profitAfterAdsOrder)
      );
      row("ACOS-like", fmtPctOrDash(r.acosLikePct));
      row("ROAS", r.roas == null ? "—" : fmtNum(r.roas, 2) + "x");
      row(
        "Break-even CPC",
        r.breakEvenCpc == null ? "—" : formatBRL(r.breakEvenCpc)
      );
      row(
        "Max bid sugerido (80%)",
        r.maxBidSuggested == null ? "—" : formatBRL(r.maxBidSuggested)
      );
      row(
        "Impressões/dia",
        r.impressionsDay == null ? "—" : fmtNum(r.impressionsDay, 0)
      );
      card.appendChild(ul);

      if (loss) {
        card.appendChild(
          el(
            "p",
            { class: "freightgen__warn is-hot" },
            "Bid come o lucro unitário. Baixe o lance, suba preço/margem ou pause. Confirme no Ads ML."
          )
        );
      } else if (warn) {
        card.appendChild(
          el(
            "p",
            { class: "freightgen__warn" },
            "Você está perto do break-even. Prefira o max bid sugerido (80% do BE). ESTIMATIVA."
          )
        );
      }

      card.appendChild(
        el(
          "p",
          { class: "result-card__note" },
          r.disclaimer +
            " Não é o relatório oficial do Mercado Livre Ads / Product Ads."
        )
      );

      var copyBtn = el(
        "button",
        { type: "button", class: "btn btn--ghost" },
        "Copiar resumo"
      );
      copyBtn.addEventListener("click", function () {
        var lines = [
          "Precifica — Bid / CPC ML Ads (ESTIMATIVA)",
          "Bid/CPC: " + formatBRL(r.cpc),
          "CTR%: " + fmtPctOrDash(r.ctrPct),
          "Conv%: " + fmtPctOrDash(r.convPct),
          "Preço: " + formatBRL(r.price),
          "Custo: " + formatBRL(r.cost),
          "Orçamento/dia: " + formatBRL(r.budget),
          "Cliques/dia: " + fmtNum(r.clicksDay, 1),
          "Pedidos/dia: " + fmtNum(r.ordersDay, 2),
          "Receita/dia: " + formatBRL(r.revenueDay),
          "Lucro unit.: " + formatBRL(r.profitUnit),
          "CAC ads/pedido: " +
            (r.adCostOrder == null ? "—" : formatBRL(r.adCostOrder)),
          "Lucro após ads/pedido: " +
            (r.profitAfterAdsOrder == null
              ? "—"
              : formatBRL(r.profitAfterAdsOrder)),
          "ACOS-like: " + fmtPctOrDash(r.acosLikePct),
          "ROAS: " + (r.roas == null ? "—" : fmtNum(r.roas, 2) + "x"),
          "Break-even CPC: " +
            (r.breakEvenCpc == null ? "—" : formatBRL(r.breakEvenCpc)),
          "Max bid sugerido: " +
            (r.maxBidSuggested == null ? "—" : formatBRL(r.maxBidSuggested)),
          "Badge: " + r.badge,
          "Confirme no painel de Ads do Mercado Livre."
        ];
        copyText(lines.join("\n"))
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Não deu para copiar.");
          });
      });
      card.appendChild(copyBtn);
      out.appendChild(card);
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }

  function mountTacos(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "TACOS / ACOS · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quanto o anúncio come da sua margem"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "tac-total",
        label: "Receita total (R$)",
        value: "10000",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "tac-spend",
        label: "Gasto em ads (R$)",
        value: "800",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "tac-adrev",
        label: "Receita atribuída a ads (R$, opcional)",
        value: "10000",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "tac-margin",
        label: "Margem líquida % após taxa marketplace",
        value: "20",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "tac-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "amazon", label: "Amazon", selected: true },
          { value: "mercadolivre", label: "Mercado Livre" },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "ACOS = gasto ads ÷ receita de ads × 100. TACOS = gasto ads ÷ receita total × 100. Break-even ACOS ≈ margem %. ESTIMATIVA — confirme no Seller Central / Ads console."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function fmtPctOrDash(pct) {
      if (pct == null || !Number.isFinite(pct)) return "—";
      return (
        pct.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }) + "%"
      );
    }

    function mpLabel(id) {
      if (id === "shopee") return "Shopee";
      if (id === "mercadolivre") return "Mercado Livre";
      return "Amazon";
    }

    function read() {
      return {
        totalRevenue: document.getElementById("tac-total").value,
        adSpend: document.getElementById("tac-spend").value,
        adRevenue: document.getElementById("tac-adrev").value,
        marginPct: document.getElementById("tac-margin").value,
        marketplace: document.getElementById("tac-mp").value
      };
    }

    function render() {
      var r = calculateTacos(read());
      out.innerHTML = "";
      var loss = r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el("p", { class: "result-card__label" }, "Resultado · ESTIMATIVA")
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__price" + (loss ? " is-loss" : "") },
          r.badge
        )
      );
      card.appendChild(
        el(
          "p",
          { class: "muted" },
          loss
            ? "Ads acima do break-even da margem — ESTIMATIVA"
            : "Ads dentro da margem — ESTIMATIVA"
        )
      );

      var ul = el("ul", { class: "result-card__rows" });
      function row(k, v) {
        var li = el("li", {});
        li.appendChild(el("span", {}, k));
        li.appendChild(el("strong", {}, v));
        ul.appendChild(li);
      }
      row("ACOS", fmtPctOrDash(r.acosPct));
      row("TACOS", fmtPctOrDash(r.tacosPct));
      row("Break-even ACOS (margem)", fmtPctOrDash(r.breakEvenAcosPct));
      row("Lucro após ads", formatBRL(r.profitAfterAds));
      row("Gasto máximo de ads (break-even)", formatBRL(r.maxAdSpend));
      row("Marketplace", mpLabel(r.marketplace));
      card.appendChild(ul);

      if (loss) {
        card.appendChild(
          el(
            "p",
            { class: "freightgen__warn is-hot" },
            "Gasto em ads passa da margem líquida. Corte bid, pause SKU ou suba preço/margem. Confirme no Ads console."
          )
        );
      }

      card.appendChild(
        el(
          "p",
          { class: "result-card__note" },
          r.disclaimer +
            " Receita atribuída a ads vazia = usa receita total. Não é relatório oficial da Amazon Ads."
        )
      );

      var copyBtn = el(
        "button",
        { type: "button", class: "btn btn--ghost" },
        "Copiar resumo"
      );
      copyBtn.addEventListener("click", function () {
        var lines = [
          "Precifica — TACOS / ACOS (ESTIMATIVA)",
          "Marketplace: " + mpLabel(r.marketplace),
          "Receita total: " + formatBRL(r.totalRevenue),
          "Gasto ads: " + formatBRL(r.adSpend),
          "Receita ads: " + formatBRL(r.adRevenue),
          "Margem líquida: " + fmtPctOrDash(r.marginPct),
          "ACOS: " + fmtPctOrDash(r.acosPct),
          "TACOS: " + fmtPctOrDash(r.tacosPct),
          "Break-even ACOS: " + fmtPctOrDash(r.breakEvenAcosPct),
          "Lucro após ads: " + formatBRL(r.profitAfterAds),
          "Gasto máx. ads: " + formatBRL(r.maxAdSpend),
          "Badge: " + r.badge,
          "Confirme no Seller Central / Ads console."
        ];
        copyText(lines.join("\n"))
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Não deu para copiar.");
          });
      });
      card.appendChild(copyBtn);
      out.appendChild(card);
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }

  function mountFreight(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Calculadora de frete · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Peso cubado, frete e quanto embutir"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "frt-peso",
        label: "Peso real (kg)",
        value: "0.5",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "frt-comp",
        label: "Comprimento (cm)",
        value: "30",
        step: "0.1",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "frt-larg",
        label: "Largura (cm)",
        value: "20",
        step: "0.1",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "frt-alt",
        label: "Altura (cm)",
        value: "10",
        step: "0.1",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "frt-preco",
        label: "Preço do anúncio (R$)",
        value: "99",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "frt-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "mercadolivre", label: "Mercado Livre", selected: true },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "frt-taxa",
        label: "Taxa % (editável)",
        value: "12",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "frt-paga",
        type: "select",
        label: "Quem paga o frete",
        options: [
          { value: "seller", label: "Vendedor", selected: true },
          { value: "buyer", label: "Comprador" }
        ]
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Peso tarifado = o maior entre real e cubado ((C×L×A)/6000). Faixa de frete é ESTIMATIVA ampla — não tabela oficial."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    var feeDirty = false;
    var mpEl = document.getElementById("frt-mp");
    var feeEl = document.getElementById("frt-taxa");

    function read() {
      return {
        realKg: document.getElementById("frt-peso").value,
        lengthCm: document.getElementById("frt-comp").value,
        widthCm: document.getElementById("frt-larg").value,
        heightCm: document.getElementById("frt-alt").value,
        listPrice: document.getElementById("frt-preco").value,
        marketplace: document.getElementById("frt-mp").value,
        feePct: document.getElementById("frt-taxa").value,
        whoPays: document.getElementById("frt-paga").value
      };
    }

    function render() {
      var r = calculateFreight(read());
      out.innerHTML = "";
      var card = el("article", { class: "result-card" });
      card.appendChild(
        el("p", { class: "result-card__label" }, "Resultado · ESTIMATIVA")
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__price" },
          formatBRL(r.estimate.low) + " – " + formatBRL(r.estimate.high)
        )
      );
      card.appendChild(
        el(
          "p",
          { class: "muted" },
          "Meio da faixa: " +
            formatBRL(r.estimate.mid) +
            " · " +
            (r.marketplace === "shopee" ? "Shopee" : "Mercado Livre")
        )
      );

      var ul = el("ul", { class: "result-card__rows" });
      function row(k, v) {
        var li = el("li", {});
        li.appendChild(el("span", {}, k));
        li.appendChild(el("strong", {}, v));
        ul.appendChild(li);
      }
      row(
        "Peso cubado",
        r.cubedKg.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3
        }) + " kg"
      );
      row(
        "Peso tarifado",
        r.billedKg.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 3
        }) + " kg"
      );
      row("Faixa estimada", formatBRL(r.estimate.low) + " – " + formatBRL(r.estimate.high));
      card.appendChild(ul);

      if (r.marketplace === "mercadolivre") {
        var warn = el(
          "p",
          {
            class:
              "freightgen__warn" + (r.mlFreeShippingLikely ? " is-hot" : "")
          },
          r.mlFreeShippingLikely
            ? "Anúncio ≥ R$ " +
              ML_FREE_SHIPPING_THRESHOLD +
              ": o ML costuma exigir frete grátis (vendedor paga parte). Confirme na sua categoria."
            : "Abaixo de R$ " +
              ML_FREE_SHIPPING_THRESHOLD +
              ": o frete costuma ficar com o comprador em muitas categorias — não é regra absoluta."
        );
        card.appendChild(warn);
      }

      if (r.whoPays === "seller") {
        var emb = el("div", { class: "freightgen__embed" });
        emb.appendChild(el("h3", {}, "Se você paga o frete"));
        emb.appendChild(
          el(
            "p",
            {},
            "Para cobrir " +
              formatBRL(r.estimate.mid) +
              " de frete com taxa de " +
              r.feePct.toLocaleString("pt-BR") +
              "%, embuta " +
              formatBRL(r.embedAmount) +
              " no anúncio (frete ÷ (1 − taxa))."
          )
        );
        emb.appendChild(
          el(
            "p",
            {},
            "Preço sugerido: " +
              formatBRL(r.suggestedPrice) +
              " (anúncio " +
              formatBRL(r.listPrice) +
              " + " +
              formatBRL(r.embedAmount) +
              ")."
          )
        );
        emb.appendChild(
          el(
            "p",
            { class: "muted" },
            "Faixa a embutir: " +
              formatBRL(r.embedLow) +
              " – " +
              formatBRL(r.embedHigh) +
              "."
          )
        );
        card.appendChild(emb);
      } else {
        card.appendChild(
          el(
            "p",
            { class: "muted" },
            "Comprador paga o frete nesta simulação — ainda assim confira se o ML não exige grátis pelo preço do anúncio."
          )
        );
      }

      card.appendChild(
        el(
          "p",
          { class: "result-card__note" },
          r.disclaimer +
            " Use o simulador de envios do ML e a calculadora da Shopee."
        )
      );

      var copyBtn = el(
        "button",
        { type: "button", class: "btn btn--ghost" },
        "Copiar resumo"
      );
      copyBtn.addEventListener("click", function () {
        var lines = [
          "Precifica — frete (ESTIMATIVA)",
          (r.marketplace === "shopee" ? "Shopee" : "Mercado Livre") +
            " · taxa " +
            r.feePct.toLocaleString("pt-BR") +
            "%",
          "Peso real: " +
            r.realKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) +
            " kg",
          "Peso cubado: " +
            r.cubedKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) +
            " kg",
          "Peso tarifado: " +
            r.billedKg.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) +
            " kg",
          "Frete estimado: " +
            formatBRL(r.estimate.low) +
            " – " +
            formatBRL(r.estimate.high) +
            " (meio " +
            formatBRL(r.estimate.mid) +
            ")",
          "Quem paga: " + (r.whoPays === "seller" ? "vendedor" : "comprador"),
          "Preço anúncio: " + formatBRL(r.listPrice)
        ];
        if (r.marketplace === "mercadolivre") {
          lines.push(
            r.mlFreeShippingLikely
              ? "ML costuma exigir frete grátis (≥ R$ 79)."
              : "Abaixo de R$ 79: frete costuma ficar com o comprador."
          );
        }
        if (r.whoPays === "seller") {
          lines.push("Embutir no preço: " + formatBRL(r.embedAmount));
          lines.push("Preço sugerido: " + formatBRL(r.suggestedPrice));
        }
        lines.push("Não é tabela oficial. Confirme no Seller Center.");
        copyText(lines.join("\n"))
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Não deu para copiar.");
          });
      });
      card.appendChild(copyBtn);
      out.appendChild(card);
    }

    mpEl.addEventListener("change", function () {
      if (!feeDirty) {
        feeEl.value = mpEl.value === "shopee" ? "14" : "12";
      }
      render();
    });
    feeEl.addEventListener("input", function () {
      feeDirty = true;
    });
    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  function mountEquilibrium(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "eqgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Ponto de equilíbrio · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quantas unidades até cobrir o custo fixo"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "eq-fixo",
        label: "Custo fixo mensal (R$)",
        value: "2000",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "eq-var",
        label: "Custo variável unitário (R$)",
        value: "40",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "eq-preco",
        label: "Preço de venda (R$)",
        value: "100",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "eq-taxa",
        label: "Taxa marketplace %",
        value: "14",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "eq-fixa",
        label: "Taxa fixa marketplace (R$)",
        value: "0",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "eq-imp",
        label: "Imposto %",
        value: "6",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "eq-frete",
        label: "Frete pago pelo vendedor / un. (R$)",
        value: "0",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "eq-n",
        label: "Projetar lucro em N unidades",
        value: "150",
        step: "1",
        min: "0"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Contribuição = preço − taxa% − taxa fixa − imposto% − frete − custo variável. Unidades = ceil(fixo ÷ contribuição). ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function read() {
      return {
        fixedCost: document.getElementById("eq-fixo").value,
        varCost: document.getElementById("eq-var").value,
        price: document.getElementById("eq-preco").value,
        feePct: document.getElementById("eq-taxa").value,
        feeFixed: document.getElementById("eq-fixa").value,
        taxPct: document.getElementById("eq-imp").value,
        freight: document.getElementById("eq-frete").value,
        customN: document.getElementById("eq-n").value
      };
    }

    function render() {
      var raw = read();
      var r = calculateEquilibrium(raw);
      var customN = Math.max(0, Math.floor(toNumber(raw.customN)));
      var profitN = projectedProfit(customN, r.fixedCost, r.contribution);
      out.innerHTML = "";
      var card = el(
        "article",
        {
          class:
            "result-card" +
            (r.contribution <= 0 ? " result-card--loss" : "")
        }
      );
      card.appendChild(
        el("p", { class: "result-card__label" }, "Resultado · ESTIMATIVA")
      );

      if (r.contribution <= 0) {
        card.appendChild(
          el(
            "p",
            { class: "result-card__price is-loss" },
            "Sem equilíbrio"
          )
        );
        card.appendChild(
          el(
            "p",
            { class: "freightgen__warn is-hot" },
            "Contribuição unitária ≤ R$ 0. Cada venda não cobre variável + taxas. Suba o preço ou corte custo — senão o fixo nunca fecha."
          )
        );
      } else {
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" },
            Number.isFinite(r.breakEvenUnits)
              ? r.breakEvenUnits.toLocaleString("pt-BR") + " un."
              : "—"
          )
        );
        card.appendChild(
          el(
            "p",
            { class: "muted" },
            "Unidades no ponto de equilíbrio"
          )
        );
      }

      var ul = el("ul", { class: "result-card__rows" });
      function row(k, v) {
        var li = el("li", {});
        li.appendChild(el("span", {}, k));
        li.appendChild(el("strong", {}, v));
        ul.appendChild(li);
      }
      row("Contribuição unitária", formatBRL(r.contribution));
      row(
        "Unidades no equilíbrio",
        Number.isFinite(r.breakEvenUnits)
          ? r.breakEvenUnits.toLocaleString("pt-BR")
          : "∞"
      );
      row(
        "Receita no equilíbrio",
        Number.isFinite(r.breakEvenRevenue)
          ? formatBRL(r.breakEvenRevenue)
          : "—"
      );
      row("Lucro em 50 un.", formatBRL(r.profit50));
      row("Lucro em 100 un.", formatBRL(r.profit100));
      row("Lucro em 200 un.", formatBRL(r.profit200));
      row(
        "Lucro em " + customN.toLocaleString("pt-BR") + " un.",
        formatBRL(profitN)
      );
      card.appendChild(ul);

      card.appendChild(
        el(
          "p",
          { class: "result-card__note" },
          r.disclaimer +
            " Não é planilha contábil. Confira taxa fixa da sua faixa e o frete real."
        )
      );

      var copyBtn = el(
        "button",
        { type: "button", class: "btn btn--ghost" },
        "Copiar resumo"
      );
      copyBtn.addEventListener("click", function () {
        var lines = [
          "Precifica — ponto de equilíbrio (ESTIMATIVA)",
          "Custo fixo: " + formatBRL(r.fixedCost),
          "Custo variável/un.: " + formatBRL(r.varCost),
          "Preço: " + formatBRL(r.price),
          "Taxa: " +
            r.feePct.toLocaleString("pt-BR") +
            "% + " +
            formatBRL(r.feeFixed),
          "Imposto: " + r.taxPct.toLocaleString("pt-BR") + "%",
          "Frete/un.: " + formatBRL(r.freight),
          "Contribuição/un.: " + formatBRL(r.contribution),
          "Equilíbrio: " +
            (Number.isFinite(r.breakEvenUnits)
              ? r.breakEvenUnits + " un. · receita " + formatBRL(r.breakEvenRevenue)
              : "∞ (contribuição ≤ 0)"),
          "Lucro 50/100/200: " +
            formatBRL(r.profit50) +
            " / " +
            formatBRL(r.profit100) +
            " / " +
            formatBRL(r.profit200),
          "Lucro em " + customN + ": " + formatBRL(profitN),
          "Não é tabela oficial. Confirme no Seller Center."
        ];
        copyText(lines.join("\n"))
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Não deu para copiar.");
          });
      });
      card.appendChild(copyBtn);
      out.appendChild(card);
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  function priceKitCombo(input) {
    input = input || {};
    var items = Array.isArray(input.items) ? input.items : [];
    var packaging = Math.max(0, toNumber(input.packaging));
    var freight = Math.max(0, toNumber(input.freight));
    var kitDiscountPct =
      input.kitDiscountPct == null || input.kitDiscountPct === ""
        ? 10
        : toNumber(input.kitDiscountPct);
    var feePct =
      input.feePct == null || input.feePct === "" ? 14 : toNumber(input.feePct);
    var feeFixed =
      input.feeFixed == null || input.feeFixed === "" ? 0 : toNumber(input.feeFixed);
    var taxPct =
      input.taxPct == null || input.taxPct === "" ? 6 : toNumber(input.taxPct);

    var costItems = 0;
    var soloSum = 0;
    var normalized = [];
    var i, it, cost, sellSolo, qty;
    for (i = 0; i < items.length; i++) {
      it = items[i] || {};
      cost = Math.max(0, toNumber(it.cost));
      sellSolo = Math.max(0, toNumber(it.sellSolo));
      qty =
        it.qty == null || it.qty === ""
          ? 1
          : Math.max(0, toNumber(it.qty));
      costItems += cost * qty;
      soloSum += sellSolo * qty;
      normalized.push({
        name: it.name ? String(it.name) : "",
        cost: cost,
        sellSolo: sellSolo,
        qty: qty
      });
    }

    var costTotal = costItems + packaging + freight;
    var kitListPrice;
    if (input.kitPrice != null && input.kitPrice !== "") {
      kitListPrice = Math.max(0, toNumber(input.kitPrice));
    } else {
      kitListPrice = soloSum * (1 - kitDiscountPct / 100);
      if (kitListPrice < 0) kitListPrice = 0;
    }

    var feeAmount = kitListPrice * (feePct / 100) + Math.max(0, feeFixed);
    var taxAmount = kitListPrice * (taxPct / 100);
    var netAfterFees = kitListPrice - feeAmount - taxAmount;
    var profitKit = netAfterFees - costTotal;
    /* ESTIMATIVA: solo as if one basket at solo sum, same fee%/tax%, one feeFixed */
    var profitIfSoldSolo =
      soloSum * (1 - feePct / 100 - taxPct / 100) - Math.max(0, feeFixed) - costTotal;
    var savingBuyer = soloSum - kitListPrice;
    var marginPctOnKit =
      kitListPrice > 1e-9 ? (profitKit / kitListPrice) * 100 : profitKit > 0 ? 100 : 0;
    var badge;
    if (profitKit < -1e-9) badge = "VERMELHO";
    else if (marginPctOnKit < 5 - 1e-9) badge = "AMARELO";
    else badge = "VERDE";

    return {
      items: normalized,
      packaging: packaging,
      freight: freight,
      kitDiscountPct: kitDiscountPct,
      feePct: feePct,
      feeFixed: Math.max(0, feeFixed),
      taxPct: taxPct,
      costTotal: costTotal,
      soloSum: soloSum,
      kitListPrice: kitListPrice,
      feeAmount: feeAmount,
      taxAmount: taxAmount,
      netAfterFees: netAfterFees,
      contribution: netAfterFees - costItems,
      profitKit: profitKit,
      profitIfSoldSolo: profitIfSoldSolo,
      savingBuyer: savingBuyer,
      marginPctOnKit: marginPctOnKit,
      badge: badge,
      disclaimer:
        "ESTIMATIVA — confirme no Seller Center. Taxas de kit SKU, frete e imposto reais podem diferir."
    };
  }

  function mountKitCombo(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "kitgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Kit / Combo · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Preço do kit vs venda avulsa"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });

    function itemFields(n, nameDef, costDef, sellDef, qtyDef) {
      fields.appendChild(
        field({
          id: "kit-name-" + n,
          type: "text",
          label: "Item " + n + " · nome",
          value: nameDef,
          placeholder: "Produto"
        })
      );
      fields.appendChild(
        field({
          id: "kit-cost-" + n,
          label: "Item " + n + " · custo (R$)",
          value: String(costDef),
          step: "0.01",
          min: "0"
        })
      );
      fields.appendChild(
        field({
          id: "kit-sell-" + n,
          label: "Item " + n + " · preço solo (R$)",
          value: String(sellDef),
          step: "0.01",
          min: "0"
        })
      );
      fields.appendChild(
        field({
          id: "kit-qty-" + n,
          label: "Item " + n + " · qtd",
          value: String(qtyDef),
          step: "1",
          min: "0"
        })
      );
    }

    itemFields(1, "Shampoo", 12, 35, 1);
    itemFields(2, "Condicionador", 14, 39, 1);
    itemFields(3, "Máscara", 18, 49, 1);

    fields.appendChild(
      field({
        id: "kit-discount",
        label: "Desconto do kit % (vs soma solo)",
        value: "10",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "kit-price-override",
        label: "Preço kit override (R$, opcional)",
        value: "",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "kit-fee",
        label: "Taxa marketplace %",
        value: "14",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "kit-feefixed",
        label: "Taxa fixa marketplace (R$)",
        value: "0",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "kit-tax",
        label: "Imposto %",
        value: "6",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "kit-pack",
        label: "Embalagem do kit (R$)",
        value: "3",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "kit-freight",
        label: "Frete do kit (vendedor paga, R$)",
        value: "0",
        step: "0.01",
        min: "0"
      })
    );

    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Preço kit = soma solo × (1 − desconto%) — ou override. Lucro = preço − taxa% − taxa fixa − imposto% − custo itens − embalagem − frete. ESTIMATIVA — confirme no Seller Center."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function read() {
      var items = [];
      var n;
      for (n = 1; n <= 3; n++) {
        var costEl = document.getElementById("kit-cost-" + n);
        var sellEl = document.getElementById("kit-sell-" + n);
        var qtyEl = document.getElementById("kit-qty-" + n);
        var nameEl = document.getElementById("kit-name-" + n);
        var cost = toNumber(costEl && costEl.value);
        var sell = toNumber(sellEl && sellEl.value);
        var qty = toNumber(qtyEl && qtyEl.value);
        if (cost > 0 || sell > 0 || qty > 0) {
          items.push({
            name: nameEl ? nameEl.value : "",
            cost: costEl.value,
            sellSolo: sellEl.value,
            qty: qtyEl.value === "" ? 1 : qtyEl.value
          });
        }
      }
      var override = document.getElementById("kit-price-override").value;
      var payload = {
        items: items,
        kitDiscountPct: document.getElementById("kit-discount").value,
        feePct: document.getElementById("kit-fee").value,
        feeFixed: document.getElementById("kit-feefixed").value,
        taxPct: document.getElementById("kit-tax").value,
        packaging: document.getElementById("kit-pack").value,
        freight: document.getElementById("kit-freight").value
      };
      if (override !== "") payload.kitPrice = override;
      return payload;
    }

    function badgeClass(badge) {
      if (badge === "VERMELHO") return " is-loss";
      if (badge === "AMARELO") return " is-warn";
      return "";
    }

    function render() {
      var r = priceKitCombo(read());
      out.innerHTML = "";
      var loss = r.badge === "VERMELHO";
      var thin = r.badge === "AMARELO";
      var card = el(
        "article",
        {
          class:
            "result-card" + (loss ? " result-card--loss" : thin ? " result-card--warn" : "")
        }
      );
      card.appendChild(
        el("p", { class: "result-card__label" }, "Resultado · ESTIMATIVA")
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__price" + badgeClass(r.badge) },
          r.badge
        )
      );
      card.appendChild(
        el(
          "p",
          { class: "muted" },
          loss
            ? "Kit no prejuízo após taxas — ESTIMATIVA"
            : thin
              ? "Margem fina (< 5% do preço do kit) — ESTIMATIVA"
              : "Kit com lucro após taxas — ESTIMATIVA"
        )
      );

      var ul = el("ul", { class: "result-card__rows" });
      function row(k, v) {
        var li = el("li", {});
        li.appendChild(el("span", {}, k));
        li.appendChild(el("strong", {}, v));
        ul.appendChild(li);
      }
      row("Soma preços solo", formatBRL(r.soloSum));
      row("Preço do kit", formatBRL(r.kitListPrice));
      row("Economia do comprador", formatBRL(r.savingBuyer));
      row("Custo total (itens+emb+frete)", formatBRL(r.costTotal));
      row(
        "Taxa marketplace",
        formatBRL(r.feeAmount) +
          " (" +
          r.feePct.toLocaleString("pt-BR") +
          "% + " +
          formatBRL(r.feeFixed) +
          ")"
      );
      row(
        "Imposto",
        formatBRL(r.taxAmount) +
          " (" +
          r.taxPct.toLocaleString("pt-BR") +
          "%)"
      );
      row("Líquido após taxas", formatBRL(r.netAfterFees));
      row("Lucro do kit", formatBRL(r.profitKit));
      row("Lucro se vendesse solo (EST.)", formatBRL(r.profitIfSoldSolo));
      row(
        "Margem s/ preço kit",
        r.marginPctOnKit.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }) + "%"
      );
      card.appendChild(ul);

      if (loss) {
        card.appendChild(
          el(
            "p",
            { class: "freightgen__warn is-hot" },
            "Desconto + taxas comem o kit. Suba o preço do kit, corte desconto ou embale menos — confirme no Seller Center."
          )
        );
      } else if (r.profitKit + 1e-9 < r.profitIfSoldSolo) {
        card.appendChild(
          el(
            "p",
            { class: "freightgen__warn" },
            "Neste cenário o solo rende mais que o kit (ESTIMATIVA). Kit ainda pode valer por ticket médio / conversão — valide no anúncio."
          )
        );
      }

      card.appendChild(
        el(
          "p",
          { class: "result-card__note" },
          r.disclaimer + " Stamp: ESTIMATIVA — confirme no Seller Center."
        )
      );

      var copyBtn = el(
        "button",
        { type: "button", class: "btn btn--ghost" },
        "Copiar resumo"
      );
      copyBtn.addEventListener("click", function () {
        var lines = [
          "Precifica — kit/combo (ESTIMATIVA)",
          "Soma solo: " + formatBRL(r.soloSum),
          "Preço kit: " + formatBRL(r.kitListPrice),
          "Desconto: " + r.kitDiscountPct.toLocaleString("pt-BR") + "%",
          "Economia comprador: " + formatBRL(r.savingBuyer),
          "Custo total: " + formatBRL(r.costTotal),
          "Taxa: " +
            r.feePct.toLocaleString("pt-BR") +
            "% + " +
            formatBRL(r.feeFixed) +
            " = " +
            formatBRL(r.feeAmount),
          "Imposto: " +
            r.taxPct.toLocaleString("pt-BR") +
            "% = " +
            formatBRL(r.taxAmount),
          "Lucro kit: " + formatBRL(r.profitKit) + " · " + r.badge,
          "Lucro solo (EST.): " + formatBRL(r.profitIfSoldSolo),
          "ESTIMATIVA — confirme no Seller Center."
        ];
        copyText(lines.join("\n"))
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Não deu para copiar.");
          });
      });
      card.appendChild(copyBtn);
      out.appendChild(card);
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  /* ------------------------------------------------------------------ */
  /* Amazon BR bullets (5 feature bullets)                               */
  /* ------------------------------------------------------------------ */

  var AMAZON_BULLET_SOFT = 200;
  var AMAZON_BULLET_HARD = 255;

  var AMAZON_BULLET_BANNED = [
    "melhor do brasil",
    "melhor do mundo",
    "#1",
    "numero 1",
    "número 1",
    "cura",
    "cura câncer",
    "cura cancer",
    "milagroso",
    "milagrosa",
    "trata câncer",
    "trata cancer",
    "emagrece rápido",
    "emagrece rapido",
    "remédio milagroso",
    "remedio milagroso",
    "aprovado como remédio",
    "aprovado como remedio"
  ];

  function splitCsvParts(raw) {
    return splitKeywordParts(raw);
  }

  function scrubAmazonClaim(s) {
    var out = cleanPart(s);
    if (!out) return "";
    var low = out.toLowerCase();
    var i, b;
    for (i = 0; i < AMAZON_BULLET_BANNED.length; i++) {
      b = AMAZON_BULLET_BANNED[i];
      if (low.indexOf(b) !== -1) {
        out = out.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "");
        out = cleanPart(out.replace(/\s{2,}/g, " "));
        low = out.toLowerCase();
      }
    }
    return out;
  }

  function clipBulletBody(s, softMax) {
    softMax = softMax == null ? AMAZON_BULLET_SOFT : softMax;
    s = cleanPart(s);
    if (!s) return "";
    if (s.length <= softMax) return s;
    var cut = s.slice(0, softMax).replace(/\s+\S*$/, "").replace(/[\s,;./\-–—:]+$/, "");
    return cut || s.slice(0, softMax).trim();
  }

  function makeBullet(lead, body, softMax) {
    lead = cleanPart(lead).toUpperCase();
    body = scrubAmazonClaim(body);
    body = clipBulletBody(body, softMax);
    if (!lead && !body) {
      return { lead: "", body: "", text: "", length: 0 };
    }
    if (!body) {
      return { lead: lead, body: "", text: "", length: 0 };
    }
    var text = lead ? lead + " — " + body : body;
    if (text.length > AMAZON_BULLET_HARD) {
      var room = AMAZON_BULLET_HARD - (lead ? lead.length + 3 : 0);
      if (room < 8) {
        text = text.slice(0, AMAZON_BULLET_HARD);
      } else {
        body = clipBulletBody(body, room);
        text = lead ? lead + " — " + body : body;
        if (text.length > AMAZON_BULLET_HARD) text = text.slice(0, AMAZON_BULLET_HARD);
      }
    }
    return { lead: lead, body: body, text: text, length: text.length };
  }

  function joinAmazonBulletsCopy(rows) {
    rows = rows || [];
    return rows
      .map(function (r) {
        return r && r.text ? r.text : "";
      })
      .join("\n");
  }

  /**
   * Gera 5 bullets de anúncio Amazon BR (texto plano, benefit-first).
   * Soft max ~200 chars; hard warn 255. ESTIMATIVA — não é Seller Central.
   */
  function generateAmazonBullets(input) {
    input = input || {};
    var produto = scrubAmazonClaim(input.produto);
    var marca = scrubAmazonClaim(input.marca);
    var modelo = scrubAmazonClaim(input.modelo);
    var uso = scrubAmazonClaim(input.uso || input.paraQuem || "");
    var specs = scrubAmazonClaim(input.specs || input.materiais || "");
    var diffs = scrubAmazonClaim(input.diffs || input.diferenciais || "");
    var tomRaw = cleanPart(input.tom || "pratico").toLowerCase();
    var tom = "pratico";
    if (tomRaw.indexOf("prem") === 0) tom = "premium";
    else if (tomRaw.indexOf("tec") === 0 || tomRaw.indexOf("téc") === 0) tom = "tecnico";

    var bens = splitCsvParts(input.beneficios || "")
      .map(scrubAmazonClaim)
      .filter(Boolean);
    while (bens.length < 3) {
      if (produto) {
        if (bens.length === 0) bens.push("uso no dia a dia com mais praticidade");
        else if (bens.length === 1) bens.push("fácil de usar e de manter");
        else bens.push("entrega o essencial sem complicação");
      } else break;
    }
    bens = bens.slice(0, 5);

    if (!produto) {
      return [0, 1, 2, 3, 4].map(function () {
        return { lead: "", body: "", text: "", length: 0 };
      });
    }

    var soft = AMAZON_BULLET_SOFT;
    var leads;
    if (tom === "premium") {
      leads = ["EXPERIÊNCIA", "ACABAMENTO", "BENEFÍCIO", "DESTAQUE", "CONFIANÇA"];
    } else if (tom === "tecnico") {
      leads = ["APLICAÇÃO", "ESPECIFICAÇÕES", "DESEMPENHO", "RECURSO", "DETALHE TÉCNICO"];
    } else {
      leads = ["IDEAL PARA", "O QUE IMPORTA", "PRINCIPAL", "NA PRÁTICA", "DIFERENCIAL"];
    }

    var brandBit = [marca, modelo].filter(Boolean).join(" ");
    var bodies = [];

    /* 1 — who / use */
    if (uso) {
      bodies.push(
        tom === "premium"
          ? "Pensado para " + uso + (produto ? ": " + produto : "") + " com foco em conforto e apresentação."
          : "Feito para " + uso + (produto ? " — " + produto : "") + " no ritmo do dia a dia."
      );
    } else {
      bodies.push(
        (brandBit ? brandBit + " · " : "") +
          produto +
          " para quem busca resultado claro sem enrolação."
      );
    }

    /* 2 — specs / materials */
    if (specs) {
      bodies.push(
        tom === "tecnico"
          ? "Ficha objetiva: " + specs + (brandBit ? " (" + brandBit + ")" : "") + "."
          : "Materiais e medidas: " + specs + "."
      );
    } else if (brandBit) {
      bodies.push(
        produto + " " + brandBit + " com atributos claros para o comprador comparar."
      );
    } else {
      bodies.push(
        "Detalhes do " + produto + " organizados para leitura rápida no anúncio."
      );
    }

    /* 3 — main benefit */
    bodies.push(
      bens[0]
        ? bens[0].charAt(0).toUpperCase() + bens[0].slice(1) + " com " + produto + "."
        : "Benefício principal do " + produto + " em linguagem direta."
    );

    /* 4 — second benefit / practical */
    if (bens[1]) {
      bodies.push(
        tom === "premium"
          ? bens[1].charAt(0).toUpperCase() + bens[1].slice(1) + " — acabamento e uso contínuo."
          : bens[1].charAt(0).toUpperCase() + bens[1].slice(1) + " no uso real."
      );
    } else {
      bodies.push("Uso simples: menos atrito para o cliente entender o valor do " + produto + ".");
    }

    /* 5 — diffs or third benefit */
    if (diffs) {
      bodies.push(
        "O que separa: " + diffs + (bens[2] ? " · " + bens[2] : "") + "."
      );
    } else if (bens[2]) {
      bodies.push(bens[2].charAt(0).toUpperCase() + bens[2].slice(1) + ".");
    } else if (tom === "tecnico" && specs) {
      bodies.push("Resumo técnico: " + specs + ".");
    } else {
      bodies.push(
        "Informação objetiva sobre " + produto + " para decidir com clareza."
      );
    }

    var out = [];
    var i;
    for (i = 0; i < 5; i++) {
      out.push(makeBullet(leads[i], bodies[i], soft));
    }
    return out;
  }

  function mountAmazonBullets(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("titlegen", "bulletgen");

    var panel = el("div", { class: "titlegen__panel" });
    panel.appendChild(
      el("p", { class: "titlegen__kicker" }, "Gerador de bullets Amazon BR · ESTIMATIVA")
    );
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Cinco bullets, benefit-first")
    );

    var fields = el("div", { class: "titlegen__fields" });
    fields.appendChild(
      field({
        id: "amz-b-produto",
        type: "text",
        label: "Produto",
        placeholder: "Fone bluetooth",
        wide: true
      })
    );
    fields.appendChild(
      field({ id: "amz-b-marca", type: "text", label: "Marca", placeholder: "Acme" })
    );
    fields.appendChild(
      field({ id: "amz-b-modelo", type: "text", label: "Modelo", placeholder: "X200" })
    );
    fields.appendChild(
      field({
        id: "amz-b-uso",
        type: "text",
        label: "Para quem / uso",
        placeholder: "home office, academia",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "amz-b-specs",
        type: "text",
        label: "Materiais / especificações",
        placeholder: "inox, 500ml, 30h bateria",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "amz-b-beneficios",
        type: "text",
        label: "Benefícios (3–5, separados por vírgula)",
        placeholder: "foco no trabalho, conforto, conexão estável",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "amz-b-diffs",
        type: "text",
        label: "Diferenciais vs concorrente (opcional)",
        placeholder: "microfone com redução de eco",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "amz-b-tom",
        type: "select",
        label: "Tom",
        options: [
          { value: "pratico", label: "Prático", selected: true },
          { value: "premium", label: "Premium" },
          { value: "tecnico", label: "Técnico" }
        ]
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Soft max 200 caracteres por bullet; alerta acima de 255. Texto plano (sem emoji). ESTIMATIVA — confirme limites e políticas no Seller Central da Amazon."
      )
    );

    var actions = el("div", { class: "titlegen__actions", style: "margin:12px 0 4px;display:flex;gap:8px;flex-wrap:wrap" });
    var copyAllBtn = el(
      "button",
      { type: "button", class: "btn btn--solid", id: "amz-b-copy-all" },
      "Copiar todas"
    );
    actions.appendChild(copyAllBtn);
    panel.appendChild(actions);
    root.appendChild(panel);

    var list = el("div", { class: "titlegen__list", "aria-live": "polite" });
    root.appendChild(list);

    var lastRows = [];

    function read() {
      return {
        produto: document.getElementById("amz-b-produto").value,
        marca: document.getElementById("amz-b-marca").value,
        modelo: document.getElementById("amz-b-modelo").value,
        uso: document.getElementById("amz-b-uso").value,
        specs: document.getElementById("amz-b-specs").value,
        beneficios: document.getElementById("amz-b-beneficios").value,
        diffs: document.getElementById("amz-b-diffs").value,
        tom: document.getElementById("amz-b-tom").value
      };
    }

    function paintCount(node, n) {
      node.textContent = n + "/" + AMAZON_BULLET_SOFT;
      node.classList.toggle("is-ok", n > 0 && n <= AMAZON_BULLET_SOFT);
      node.classList.toggle("is-over", n > AMAZON_BULLET_HARD);
      if (n > AMAZON_BULLET_SOFT && n <= AMAZON_BULLET_HARD) {
        node.classList.add("is-over");
      }
    }

    function render() {
      lastRows = generateAmazonBullets(read());
      list.innerHTML = "";
      lastRows.forEach(function (row, idx) {
        var card = el("article", { class: "title-card" });
        card.appendChild(
          el("p", { class: "title-card__label" }, "Bullet " + (idx + 1) + (row.lead ? " · " + row.lead : ""))
        );
        card.appendChild(
          el(
            "p",
            { class: "title-card__hint" },
            "Lead em CAPS + traço. Edite antes de colar no Seller Central."
          )
        );
        var box = el("div", { class: "title-card__row" });
        var ta = el("textarea", {
          class: "title-card__input",
          rows: "3",
          "aria-label": "Bullet " + (idx + 1)
        });
        ta.value = row.text || "";
        var count = el("span", { class: "title-card__count" });
        paintCount(count, ta.value.length);
        ta.addEventListener("input", function () {
          paintCount(count, ta.value.length);
          lastRows[idx] = {
            lead: row.lead,
            body: ta.value,
            text: ta.value,
            length: ta.value.length
          };
        });
        box.appendChild(ta);
        box.appendChild(count);
        card.appendChild(box);
        var copyBtn = el(
          "button",
          { type: "button", class: "btn btn--ghost title-card__copy" },
          "Copiar"
        );
        copyBtn.addEventListener("click", function () {
          var text = ta.value.trim();
          if (!text) {
            toast("Preenche o produto primeiro.");
            return;
          }
          copyText(text)
            .then(function () {
              toast("Bullet copiado (" + text.length + " caracteres).");
            })
            .catch(function () {
              toast("Não deu para copiar. Seleciona o texto.");
            });
        });
        card.appendChild(copyBtn);
        list.appendChild(card);
      });
    }

    copyAllBtn.addEventListener("click", function () {
      var texts = [];
      list.querySelectorAll("textarea.title-card__input").forEach(function (ta) {
        texts.push(ta.value);
      });
      if (!texts.length) texts = lastRows.map(function (r) { return r.text || ""; });
      var joined = texts.join("\n");
      if (!joined.trim()) {
        toast("Preenche o produto primeiro.");
        return;
      }
      copyText(joined)
        .then(function () {
          toast("5 bullets copiados.");
        })
        .catch(function () {
          toast("Não deu para copiar.");
        });
    });

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  /* ------------------------------------------------------------------ */
  /* Variações de anúncio ML (3 ângulos: atributos / benefício / uso)    */
  /* ------------------------------------------------------------------ */

  var HOOK_MAX = 120;

  function clipHook(s, max) {
    max = max == null ? HOOK_MAX : max;
    s = cleanPart(s);
    if (!s) return "";
    if (s.length <= max) return s;
    var cut = s.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s,;./\-–—:]+$/, "");
    return cut || s.slice(0, max).trim();
  }

  function scrubVariationClaim(s) {
    return scrubAmazonClaim(s);
  }

  /**
   * Gera 3 variações título+gancho para A/B no Mercado Livre.
   * Ângulos: Atributos | Benefício | Uso/kit. ESTIMATIVA.
   */
  function generateMlVariations(input) {
    input = input || {};
    var produto = scrubVariationClaim(input.produto);
    if (!produto) {
      return { ok: false, error: "Informe o produto.", variations: [] };
    }

    var marca = scrubVariationClaim(input.marca);
    var modelo = scrubVariationClaim(input.modelo);
    var cor = scrubVariationClaim(input.cor);
    var qty = scrubVariationClaim(
      input.tamanho || input.qty || input.qtd || input.tamanhoQtd || ""
    );
    var diferencial = scrubVariationClaim(input.diferencial || input.diffs || "");
    var beneficio = scrubVariationClaim(
      input.beneficio || input.beneficioPrincipal || input.beneficio_principal || ""
    );
    var tomRaw = cleanPart(input.tom || "pratico").toLowerCase();
    var tom = "pratico";
    if (tomRaw.indexOf("benef") === 0) tom = "beneficio";
    else if (tomRaw.indexOf("tec") === 0 || tomRaw.indexOf("téc") === 0) tom = "tecnico";

    var titleAttrs;
    var titleBenef;
    var titleUso;
    if (tom === "tecnico") {
      titleAttrs = packTitle([produto, marca, modelo, qty, diferencial || cor]);
      titleBenef = packTitle([produto, modelo, beneficio || diferencial, marca]);
      titleUso = packTitle([produto, modelo, qty || "kit", diferencial || marca]);
    } else if (tom === "beneficio") {
      titleAttrs = packTitle([produto, marca, cor, qty, modelo]);
      titleBenef = packTitle([produto, beneficio || diferencial, marca, cor]);
      titleUso = packTitle([produto, beneficio || qty || "kit", marca, diferencial]);
    } else {
      titleAttrs = packTitle([produto, marca, modelo, cor, qty]);
      titleBenef = packTitle([produto, beneficio || diferencial, marca, cor]);
      titleUso = packTitle([produto, qty || "kit", diferencial || beneficio, marca]);
    }

    function hookAtributos() {
      var bits = [];
      if (marca) bits.push(marca);
      if (modelo) bits.push(modelo);
      if (cor) bits.push("cor " + cor);
      if (qty) bits.push(qty);
      if (diferencial) bits.push(diferencial);
      var core;
      if (tom === "tecnico") {
        core =
          produto +
          (modelo ? " " + modelo : "") +
          (marca ? " " + marca : "") +
          (qty ? " · " + qty : "") +
          (diferencial ? " · " + diferencial : "") +
          ". Atributos e especificação claros para comparar no ML.";
      } else if (bits.length) {
        core =
          bits.join(", ") +
          " — " +
          produto +
          " com atributos objetivos para filtrar e comparar.";
      } else {
        core = produto + " com atributos objetivos para o comprador filtrar e comparar.";
      }
      return clipHook(scrubVariationClaim(core));
    }

    function hookBeneficio() {
      var ben = beneficio || diferencial || "praticidade no dia a dia";
      var core;
      if (tom === "tecnico") {
        core =
          "Benefício: " +
          ben +
          (modelo ? " · " + modelo : "") +
          (diferencial && diferencial !== ben ? " · " + diferencial : "") +
          ". Resultado claro com " +
          produto +
          ".";
      } else {
        core =
          "Benefício principal: " +
          ben +
          ". Foque no resultado que o comprador busca com " +
          produto +
          ".";
      }
      return clipHook(scrubVariationClaim(core));
    }

    function hookUso() {
      var usoBit = qty || "kit / uso diário";
      var core;
      if (tom === "tecnico") {
        core =
          "Uso e montagem: " +
          usoBit +
          (modelo ? " · " + modelo : "") +
          (diferencial ? " · " + diferencial : "") +
          ". Como o " +
          produto +
          " entra no fluxo do cliente.";
      } else {
        core =
          "Ideal para " +
          usoBit +
          (diferencial ? " — " + diferencial : "") +
          ". Como o " +
          produto +
          " encaixa no dia a dia.";
      }
      return clipHook(scrubVariationClaim(core));
    }

    function row(angle, title, hook) {
      title = cleanPart(title);
      hook = cleanPart(hook);
      if (title.length > TITLE_MAX) title = packTitle([title], TITLE_MAX);
      if (hook.length > HOOK_MAX) hook = clipHook(hook, HOOK_MAX);
      return {
        angle: angle,
        title: title,
        titleLen: title.length,
        hook: hook,
        hookLen: hook.length
      };
    }

    return {
      ok: true,
      variations: [
        row("Atributos", titleAttrs, hookAtributos()),
        row("Benefício", titleBenef, hookBeneficio()),
        row("Uso/kit", titleUso, hookUso())
      ]
    };
  }

  function joinMlVariationBlock(v) {
    if (!v) return "";
    var t = cleanPart(v.title);
    var h = cleanPart(v.hook);
    if (!t && !h) return "";
    if (!h) return t;
    if (!t) return h;
    return t + "\n" + h;
  }

  function mountMlVariations(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("titlegen", "variacoesgen");

    var panel = el("div", { class: "titlegen__panel" });
    panel.appendChild(
      el("p", { class: "titlegen__kicker" }, "Gerador de variações de anúncio Mercado Livre · ESTIMATIVA")
    );
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Três ângulos para teste A/B")
    );

    var fields = el("div", { class: "titlegen__fields" });
    fields.appendChild(
      field({
        id: "var-produto",
        type: "text",
        label: "Produto",
        placeholder: "Fone bluetooth",
        wide: true
      })
    );
    fields.appendChild(field({ id: "var-marca", type: "text", label: "Marca", placeholder: "Acme" }));
    fields.appendChild(field({ id: "var-modelo", type: "text", label: "Modelo", placeholder: "X200" }));
    fields.appendChild(field({ id: "var-cor", type: "text", label: "Cor", placeholder: "preto" }));
    fields.appendChild(
      field({
        id: "var-tamanho",
        type: "text",
        label: "Tamanho / quantidade",
        placeholder: "500ml · M · kit 3"
      })
    );
    fields.appendChild(
      field({
        id: "var-diferencial",
        type: "text",
        label: "Diferencial",
        placeholder: "cancelamento de ruído, inox",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "var-beneficio",
        type: "text",
        label: "Benefício principal",
        placeholder: "foco no trabalho, mantém gelado",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "var-tom",
        type: "select",
        label: "Tom",
        options: [
          { value: "pratico", label: "Prático", selected: true },
          { value: "beneficio", label: "Benefício" },
          { value: "tecnico", label: "Técnico" }
        ]
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Título até 60 caracteres · gancho até 120. Três ângulos: Atributos, Benefício e Uso/kit. ESTIMATIVA — sem claims médicos ou hype. Confirme no anúncio do Mercado Livre."
      )
    );
    root.appendChild(panel);

    var list = el("div", { class: "titlegen__list", "aria-live": "polite" });
    root.appendChild(list);

    var lastVars = [];

    function read() {
      return {
        produto: document.getElementById("var-produto").value,
        marca: document.getElementById("var-marca").value,
        modelo: document.getElementById("var-modelo").value,
        cor: document.getElementById("var-cor").value,
        tamanho: document.getElementById("var-tamanho").value,
        diferencial: document.getElementById("var-diferencial").value,
        beneficio: document.getElementById("var-beneficio").value,
        tom: document.getElementById("var-tom").value
      };
    }

    function paintTitleCount(node, n) {
      node.textContent = n + "/" + TITLE_MAX;
      node.classList.toggle("is-over", n > TITLE_MAX);
      node.classList.toggle("is-ok", n > 0 && n <= TITLE_MAX);
    }

    function paintHookCount(node, n) {
      node.textContent = n + "/" + HOOK_MAX;
      node.classList.toggle("is-over", n > HOOK_MAX);
      node.classList.toggle("is-ok", n > 0 && n <= HOOK_MAX);
    }

    function render() {
      var result = generateMlVariations(read());
      lastVars = result.ok ? result.variations : [];
      list.innerHTML = "";
      if (!result.ok) {
        list.appendChild(
          el("p", { class: "titlegen__hint" }, result.error || "Preencha o produto.")
        );
        return;
      }
      lastVars.forEach(function (row, idx) {
        var card = el("article", { class: "title-card" });
        card.appendChild(
          el("p", { class: "title-card__label" }, "Variação " + (idx + 1) + " · " + row.angle)
        );
        card.appendChild(
          el(
            "p",
            { class: "title-card__hint" },
            "Título (≤60) + gancho de abertura (≤120). ESTIMATIVA para teste A/B."
          )
        );

        var titleBox = el("div", { class: "title-card__row" });
        var titleInp = el("input", {
          class: "title-card__input",
          type: "text",
          maxlength: String(TITLE_MAX),
          value: row.title,
          "aria-label": "Título variação " + (idx + 1)
        });
        var titleCount = el("span", { class: "title-card__count" });
        paintTitleCount(titleCount, row.title.length);
        titleInp.addEventListener("input", function () {
          if (titleInp.value.length > TITLE_MAX) {
            titleInp.value = titleInp.value.slice(0, TITLE_MAX);
          }
          paintTitleCount(titleCount, titleInp.value.length);
          lastVars[idx].title = titleInp.value;
          lastVars[idx].titleLen = titleInp.value.length;
        });
        titleBox.appendChild(titleInp);
        titleBox.appendChild(titleCount);
        card.appendChild(titleBox);

        var hookBox = el("div", { class: "title-card__row" });
        var hookTa = el("textarea", {
          class: "title-card__input",
          rows: "2",
          maxlength: String(HOOK_MAX),
          "aria-label": "Gancho variação " + (idx + 1)
        });
        hookTa.value = row.hook || "";
        var hookCount = el("span", { class: "title-card__count" });
        paintHookCount(hookCount, hookTa.value.length);
        hookTa.addEventListener("input", function () {
          if (hookTa.value.length > HOOK_MAX) {
            hookTa.value = hookTa.value.slice(0, HOOK_MAX);
          }
          paintHookCount(hookCount, hookTa.value.length);
          lastVars[idx].hook = hookTa.value;
          lastVars[idx].hookLen = hookTa.value.length;
        });
        hookBox.appendChild(hookTa);
        hookBox.appendChild(hookCount);
        card.appendChild(hookBox);

        var actions = el("div", {
          class: "titlegen__actions",
          style: "margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"
        });

        var copyTitle = el(
          "button",
          { type: "button", class: "btn btn--ghost title-card__copy" },
          "Copiar título"
        );
        copyTitle.addEventListener("click", function () {
          var text = titleInp.value.trim();
          if (!text) {
            toast("Preenche o produto primeiro.");
            return;
          }
          copyText(text)
            .then(function () {
              toast("Título copiado (" + text.length + " caracteres).");
            })
            .catch(function () {
              toast("Não deu para copiar. Seleciona o texto.");
            });
        });

        var copyHook = el(
          "button",
          { type: "button", class: "btn btn--ghost title-card__copy" },
          "Copiar gancho"
        );
        copyHook.addEventListener("click", function () {
          var text = hookTa.value.trim();
          if (!text) {
            toast("Preenche o produto primeiro.");
            return;
          }
          copyText(text)
            .then(function () {
              toast("Gancho copiado (" + text.length + " caracteres).");
            })
            .catch(function () {
              toast("Não deu para copiar. Seleciona o texto.");
            });
        });

        var copyBlock = el(
          "button",
          { type: "button", class: "btn btn--solid title-card__copy" },
          "Copiar bloco"
        );
        copyBlock.addEventListener("click", function () {
          var block = joinMlVariationBlock({
            title: titleInp.value,
            hook: hookTa.value
          });
          if (!block.trim()) {
            toast("Preenche o produto primeiro.");
            return;
          }
          copyText(block)
            .then(function () {
              toast("Bloco copiado (título + gancho).");
            })
            .catch(function () {
              toast("Não deu para copiar.");
            });
        });

        actions.appendChild(copyTitle);
        actions.appendChild(copyHook);
        actions.appendChild(copyBlock);
        card.appendChild(actions);
        list.appendChild(card);
      });
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  /**
   * Teste A/B de título Mercado Livre — score heurístico determinístico.
   * sampleDays = ceil(100 / (visitasDia * CTR)), CTR padrão 3%.
   * ESTIMATIVA — não prevê conversão real do ML.
   */
  function tokenizeAbTitle(s) {
    return cleanPart(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(function (t) {
        return t.length > 1;
      });
  }

  function countAllCapsWords(s) {
    var words = cleanPart(s).split(/\s+/).filter(Boolean);
    var n = 0;
    var i, w;
    for (i = 0; i < words.length; i++) {
      w = words[i];
      if (w.length >= 3 && w === w.toUpperCase() && /[A-ZÀ-Ü]/.test(w)) n++;
    }
    return n;
  }

  function titleDiffScore(a, b) {
    var ca = cleanPart(a).toLowerCase();
    var cb = cleanPart(b).toLowerCase();
    if (!ca && !cb) return 0;
    if (ca === cb) return 0;
    var ta = tokenizeAbTitle(a);
    var tb = tokenizeAbTitle(b);
    if (!ta.length && !tb.length) return ca === cb ? 0 : 100;
    var setA = {};
    var setB = {};
    var i, t, inter = 0, union = 0;
    for (i = 0; i < ta.length; i++) setA[ta[i]] = true;
    for (i = 0; i < tb.length; i++) setB[tb[i]] = true;
    for (t in setA) {
      if (Object.prototype.hasOwnProperty.call(setA, t)) {
        union++;
        if (setB[t]) inter++;
      }
    }
    for (t in setB) {
      if (Object.prototype.hasOwnProperty.call(setB, t) && !setA[t]) union++;
    }
    if (!union) return 100;
    return Math.round((1 - inter / union) * 100);
  }

  function scoreOneAbTitle(title, keyword) {
    var raw = cleanPart(title);
    var scrubbed = scrubAmazonClaim(raw);
    var len = raw.length;
    var score = 50;
    var low = raw.toLowerCase();

    if (len >= 45 && len <= 60) score += 25;
    else if (len >= 35 && len < 45) score += 14;
    else if (len >= 30 && len < 35) score += 8;
    else if (len > 60 && len <= 70) score -= 12;
    else if (len > 70) score -= 22;
    else if (len > 0 && len < 30) score -= 18;

    var kw = cleanPart(keyword).toLowerCase();
    var hasKeyword = false;
    if (kw) {
      var pos = low.indexOf(kw);
      hasKeyword = pos !== -1;
      if (hasKeyword) {
        score += 8;
        if (pos === 0) score += 22;
        else if (pos < 40) score += 18;
        else score += 2;
      } else {
        score -= 10;
      }
    }

    if (/\d/.test(raw)) score += 8;

    var caps = countAllCapsWords(raw);
    if (caps >= 3) score -= 14;
    else if (caps === 2) score -= 7;
    else if (caps === 1) score -= 3;

    if (scrubbed.length + 3 < raw.length) score -= 16;
    var bannedHit = raw.length > 0 && scrubbed.toLowerCase() !== scrubAmazonClaim(raw).toLowerCase();
    if (!bannedHit && scrubbed.length < raw.length) score -= 4;

    score = Math.max(0, Math.min(100, Math.round(score)));
    return {
      title: raw,
      len: len,
      hasKeyword: hasKeyword,
      score: score
    };
  }

  function defaultAbChecklist() {
    return [
      "Publique só o título A (mesmo preço, fotos e estoque) e anote visitas/CTR.",
      "Espere ~100 cliques no braço A (veja sampleDays) ou 7–14 dias.",
      "Troque apenas o título para B — uma mudança por vez.",
      "Compare CTR e conversão no mesmo período; ignore dias atípicos de ads.",
      "Fique com o vencedor e documente; repita o teste se mudar preço ou foto."
    ];
  }

  function joinAbChecklist(list) {
    list = list || [];
    return list
      .map(function (s, i) {
        return i + 1 + ". " + cleanPart(s);
      })
      .filter(function (s) {
        return s.length > 3;
      })
      .join("\n");
  }

  function scoreAbTitles(input) {
    input = input || {};
    var titleA = cleanPart(input.titleA || input.tituloA || input.a || "");
    var titleB = cleanPart(input.titleB || input.tituloB || input.b || "");
    if (!titleA || !titleB) {
      return {
        ok: false,
        error: "Informe o título A e o título B.",
        a: null,
        b: null,
        winner: null,
        diffScore: 0,
        advice: "",
        sampleDays: 0,
        checklist: [],
        disclaimer: "ESTIMATIVA — heurística no navegador; não prevê ranking nem conversão real do Mercado Livre."
      };
    }

    var keyword = cleanPart(input.keyword || input.palavraChave || input.palavra || "");
    var visitas = toNumber(input.visitasDia != null ? input.visitasDia : input.visitas);
    if (!(visitas > 0)) visitas = 50;
    var convPct = toNumber(input.convPct != null ? input.convPct : input.conversao);
    if (!(convPct >= 0)) convPct = 2;
    var ctr = toNumber(input.ctr);
    if (!(ctr > 0)) ctr = 0.03;
    if (ctr > 1) ctr = ctr / 100;

    var a = scoreOneAbTitle(titleA, keyword);
    var b = scoreOneAbTitle(titleB, keyword);

    // Unique-token bonus: prefer more distinct tokens vs the sibling
    var tokA = tokenizeAbTitle(titleA);
    var tokB = tokenizeAbTitle(titleB);
    var setA = {};
    var setB = {};
    var i, t, uniqA = 0, uniqB = 0;
    for (i = 0; i < tokA.length; i++) setA[tokA[i]] = true;
    for (i = 0; i < tokB.length; i++) setB[tokB[i]] = true;
    for (t in setA) {
      if (Object.prototype.hasOwnProperty.call(setA, t) && !setB[t]) uniqA++;
    }
    for (t in setB) {
      if (Object.prototype.hasOwnProperty.call(setB, t) && !setA[t]) uniqB++;
    }
    if (uniqA > uniqB + 1) a.score = Math.min(100, a.score + 2);
    else if (uniqB > uniqA + 1) b.score = Math.min(100, b.score + 2);

    var winner = "empate";
    if (a.score > b.score) winner = "A";
    else if (b.score > a.score) winner = "B";

    var diff = titleDiffScore(titleA, titleB);
    var clicksPerDay = Math.max(visitas * ctr, 0.01);
    var sampleDays = Math.ceil(100 / clicksPerDay);

    var advice;
    if (diff < 15) {
      advice = "Títulos muito parecidos — mude ângulo (atributo vs benefício) para o A/B valer.";
    } else if (winner === "empate") {
      advice = "Scores empatados. Prefira o título com palavra-chave no início e 45–60 caracteres.";
    } else if (winner === "A") {
      advice =
        "Título A leva vantagem heurística (score " +
        a.score +
        " vs " +
        b.score +
        "). Rode o A/B no ML antes de decidir.";
    } else {
      advice =
        "Título B leva vantagem heurística (score " +
        b.score +
        " vs " +
        a.score +
        "). Rode o A/B no ML antes de decidir.";
    }
    if (a.len > 60 || b.len > 60) {
      advice += " Corte o que passar de 60 caracteres.";
    }

    var checklist = defaultAbChecklist();
    checklist[1] =
      "Espere ~100 cliques no braço A (~" +
      sampleDays +
      " dias com " +
      visitas +
      " visitas/dia e CTR ~" +
      Math.round(ctr * 100) +
      "%) ou 7–14 dias.";

    return {
      ok: true,
      a: a,
      b: b,
      winner: winner,
      diffScore: diff,
      advice: advice,
      sampleDays: sampleDays,
      checklist: checklist,
      disclaimer:
        "ESTIMATIVA — score heurístico no navegador (comprimento, keyword, dígitos, CAPS, hype). sampleDays = ceil(100 / (visitasDia × CTR)); CTR padrão 3%. Não prevê CTR/conversão real do Mercado Livre."
    };
  }

  function mountAbTitleTest(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("titlegen", "variacoesgen", "abtitulogen");

    var panel = el("div", { class: "titlegen__panel" });
    panel.appendChild(
      el("p", { class: "titlegen__kicker" }, "Teste A/B de título Mercado Livre · ESTIMATIVA")
    );
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Compare título A vs B")
    );

    var fields = el("div", { class: "titlegen__fields" });
    fields.appendChild(
      field({
        id: "ab-title-a",
        type: "text",
        label: "Título A",
        placeholder: "Fone Bluetooth Acme X200 Cancelamento Preto",
        wide: true,
        maxlength: TITLE_MAX
      })
    );
    fields.appendChild(
      field({
        id: "ab-title-b",
        type: "text",
        label: "Título B",
        placeholder: "Fone Bluetooth Cancelamento Ruído Acme Kit",
        wide: true,
        maxlength: TITLE_MAX
      })
    );
    fields.appendChild(
      field({
        id: "ab-keyword",
        type: "text",
        label: "Palavra-chave principal (opcional)",
        placeholder: "fone bluetooth",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "ab-visitas",
        type: "number",
        label: "Visitas/dia estimadas",
        value: "50"
      })
    );
    fields.appendChild(
      field({
        id: "ab-conv",
        type: "number",
        label: "Conversão atual %",
        value: "2"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Título até 60 caracteres. Score ESTIMATIVA: doce 45–60, keyword no início, dígitos, sem CAPS/hype. Dias de amostra ≈ ceil(100 ÷ (visitas × 3% CTR)). Confirme no anúncio do Mercado Livre."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "titlegen__list", "aria-live": "polite" });
    root.appendChild(out);

    var last = null;

    function read() {
      return {
        titleA: document.getElementById("ab-title-a").value,
        titleB: document.getElementById("ab-title-b").value,
        keyword: document.getElementById("ab-keyword").value,
        visitasDia: document.getElementById("ab-visitas").value,
        convPct: document.getElementById("ab-conv").value
      };
    }

    function clampInput(id) {
      var inp = document.getElementById(id);
      if (!inp) return;
      if (inp.value.length > TITLE_MAX) inp.value = inp.value.slice(0, TITLE_MAX);
    }

    function paintCount(node, n) {
      node.textContent = n + "/" + TITLE_MAX;
      node.classList.toggle("is-over", n > TITLE_MAX);
      node.classList.toggle("is-ok", n > 0 && n <= TITLE_MAX);
    }

    function armCard(label, arm, isWinner) {
      var card = el("article", {
        class: "title-card" + (isWinner ? " title-card--winner" : "")
      });
      var head = el("p", { class: "title-card__label" }, "Título " + label);
      if (isWinner) {
        head.appendChild(
          el("span", { class: "title-card__badge", style: "margin-left:8px" }, "Vencedor")
        );
      }
      card.appendChild(head);
      card.appendChild(
        el(
          "p",
          { class: "title-card__hint" },
          "Score " +
            arm.score +
            "/100 · " +
            arm.len +
            " caracteres" +
            (arm.hasKeyword ? " · keyword ok" : "")
        )
      );
      var row = el("div", { class: "title-card__row" });
      var inp = el("input", {
        class: "title-card__input",
        type: "text",
        readonly: "readonly",
        value: arm.title,
        "aria-label": "Título " + label
      });
      var count = el("span", { class: "title-card__count" });
      paintCount(count, arm.len);
      row.appendChild(inp);
      row.appendChild(count);
      card.appendChild(row);
      return card;
    }

    function render() {
      clampInput("ab-title-a");
      clampInput("ab-title-b");
      var result = scoreAbTitles(read());
      last = result;
      out.innerHTML = "";
      if (!result.ok) {
        out.appendChild(
          el("p", { class: "titlegen__hint" }, result.error || "Preencha os dois títulos.")
        );
        return;
      }

      var grid = el("div", {
        class: "ab-compare",
        style: "display:grid;gap:12px;grid-template-columns:1fr;margin-bottom:12px"
      });
      if (window.matchMedia && window.matchMedia("(min-width:720px)").matches) {
        grid.style.gridTemplateColumns = "1fr 1fr";
      }
      grid.appendChild(armCard("A", result.a, result.winner === "A"));
      grid.appendChild(armCard("B", result.b, result.winner === "B"));
      out.appendChild(grid);

      var meta = el("div", { class: "title-card" });
      meta.appendChild(
        el(
          "p",
          { class: "title-card__label" },
          "Resultado · vencedor " +
            (result.winner === "empate" ? "empate" : result.winner) +
            " · diff " +
            result.diffScore +
            "/100"
        )
      );
      meta.appendChild(el("p", { class: "title-card__hint" }, result.advice));
      meta.appendChild(
        el(
          "p",
          { class: "titlegen__hint" },
          "Amostra sugerida: ~" +
            result.sampleDays +
            " dias para ~100 cliques/braço (visitas × CTR 3%). " +
            result.disclaimer
        )
      );
      var ul = el("ul", { class: "titlegen__hint", style: "padding-left:1.2em" });
      result.checklist.forEach(function (step) {
        ul.appendChild(el("li", null, step));
      });
      meta.appendChild(ul);

      var actions = el("div", {
        class: "titlegen__actions",
        style: "margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"
      });

      function copyBtn(label, solid, getter) {
        var btn = el(
          "button",
          { type: "button", class: "btn " + (solid ? "btn--solid" : "btn--ghost") + " title-card__copy" },
          label
        );
        btn.addEventListener("click", function () {
          var text = getter();
          if (!text || !String(text).trim()) {
            toast("Nada para copiar.");
            return;
          }
          copyText(String(text))
            .then(function () {
              toast(label + " — copiado.");
            })
            .catch(function () {
              toast("Não deu para copiar.");
            });
        });
        return btn;
      }

      actions.appendChild(
        copyBtn("Copiar A", false, function () {
          return last && last.a ? last.a.title : "";
        })
      );
      actions.appendChild(
        copyBtn("Copiar B", false, function () {
          return last && last.b ? last.b.title : "";
        })
      );
      actions.appendChild(
        copyBtn("Copiar checklist", true, function () {
          return last && last.checklist ? joinAbChecklist(last.checklist) : "";
        })
      );
      meta.appendChild(actions);
      out.appendChild(meta);
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  function scrubListingFaqText(s) {
    var out = cleanPart(s);
    if (!out) return "";
    var banned = [
      "melhor do brasil",
      "melhor do mundo",
      "cura",
      "milagroso",
      "milagrosa",
      "trata câncer",
      "trata cancer",
      "remédio milagroso",
      "remedio milagroso",
      "emagrece rápido",
      "emagrece rapido",
      "100% eficaz",
      "garantia de resultado"
    ];
    var low = out.toLowerCase();
    var i, b;
    for (i = 0; i < banned.length; i++) {
      b = banned[i];
      if (low.indexOf(b) !== -1) {
        out = out.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "");
        out = cleanPart(out.replace(/\s{2,}/g, " "));
        low = out.toLowerCase();
      }
    }
    return out;
  }

  function normalizeFaqMarketplace(raw) {
    var m = String(raw || "ml").toLowerCase().trim();
    if (m === "mercado livre" || m === "mercadolivre" || m === "meli") m = "ml";
    if (m === "amazon.br" || m === "amazon br") m = "amazon";
    if (["ml", "shopee", "amazon", "geral"].indexOf(m) === -1) m = "ml";
    return m;
  }

  function joinListingFaqCopy(items) {
    items = items || [];
    return items
      .map(function (it) {
        var q = cleanPart(it && it.q);
        var a = cleanPart(it && it.a);
        if (!q || !a) return "";
        return "P: " + q + "\nR: " + a;
      })
      .filter(Boolean)
      .join("\n\n");
  }

  function defaultListingFaqChecklist(marketplace) {
    marketplace = normalizeFaqMarketplace(marketplace);
    var mpLabel =
      marketplace === "ml"
        ? "Mercado Livre"
        : marketplace === "shopee"
          ? "Shopee"
          : marketplace === "amazon"
            ? "Amazon"
            : "marketplace";
    return [
      "Revise cada resposta com as fotos e a ficha técnica do anúncio.",
      "Confirme política de frete/entrega e prazo no painel do " + mpLabel + ".",
      "Alinhe garantia e devolução com as regras oficiais do " + mpLabel + ".",
      "Não invente material, medida ou conteúdo da caixa — use só o que você tem.",
      "Cole o FAQ no campo adequado (perguntas frequentes / descrição) e teste a leitura no celular.",
      "Atualize o FAQ se mudar marca, kit, garantia ou atributos."
    ];
  }

  function generateListingFaq(input) {
    input = input || {};
    var produto = scrubListingFaqText(input.produto || input.product || "");
    var marca = scrubListingFaqText(input.marca || input.brand || "");
    var attrs = scrubListingFaqText(input.atributos || input.attrs || input.atributo || "");
    var uso = scrubListingFaqText(input.uso || input.use || "");
    var garantia = scrubListingFaqText(input.garantia || input.warranty || "");
    var marketplace = normalizeFaqMarketplace(input.marketplace);
    var tom = scrubListingFaqText(input.tom || input.tone || "");

    var failDisclaimer =
      "ESTIMATIVA — rascunho no navegador; confirme políticas do marketplace e do seu anúncio.";

    if (!produto) {
      return {
        ok: false,
        error: "Informe o produto.",
        items: [],
        marketplace: marketplace,
        count: 0,
        copyText: "",
        checklist: [],
        disclaimer: failDisclaimer
      };
    }

    var nome = marca ? produto + " " + marca : produto;
    var usoTxt = uso || "uso cotidiano";
    var garTxt = garantia || "conforme a política do marketplace e do vendedor";
    var attrBit = attrs ? " Atributos informados: " + attrs + "." : "";

    var shipQ;
    var shipA;
    if (marketplace === "ml") {
      shipQ = "Como funciona a entrega no Mercado Livre?";
      shipA =
        "O prazo e o frete do " +
        nome +
        " aparecem no anúncio do Mercado Livre (Full, Coleta ou envio do vendedor). Confira CEP e modalidade antes de comprar; o Precifica não calcula frete oficial.";
    } else if (marketplace === "shopee") {
      shipQ = "Qual o frete e o prazo na Shopee?";
      shipA =
        "Na Shopee, frete e prazo do " +
        nome +
        " dependem do CEP, da loja e de campanhas (frete grátis quando elegível). Veja o cálculo no checkout da Shopee.";
    } else if (marketplace === "amazon") {
      shipQ = "Entrega e Amazon Prime: como fica?";
      shipA =
        "Na Amazon, o " +
        nome +
        " pode ter envio padrão ou Prime conforme o seller e o CEP. Confira prazo estimado na página do produto Amazon antes de fechar a compra.";
    } else {
      shipQ = "Como é o frete e a entrega?";
      shipA =
        "Prazo e valor de entrega do " +
        nome +
        " dependem do marketplace, do CEP e da modalidade escolhida. Confira sempre no anúncio oficial.";
    }

    var items = [];

    items.push({
      q: "De que material / composição é feito o " + produto + "?",
      a: attrs
        ? "O " +
          nome +
          " segue a especificação informada:" +
          attrBit +
          " Use a ficha técnica e as fotos do anúncio para validar composição e acabamento."
        : "Informe material e composição na ficha do " +
          nome +
          ". Evite claims vagos; descreva só o que você confirma com o fornecedor e as fotos."
    });

    if (attrs) {
      items.push({
        q: "Quais são as medidas / dimensões / tamanho?",
        a:
          "Medidas e atributos do " +
          nome +
          ": " +
          attrs +
          ". Confira unidade (cm, ml, kg) nas fotos e na descrição antes de publicar."
      });
    } else {
      items.push({
        q: "Quais são as medidas / tamanho do produto?",
        a:
          "Inclua altura, largura, profundidade ou volume do " +
          nome +
          " na descrição e nas fotos com referência. Sem medida publicada, o comprador tende a perguntar no chat."
      });
    }

    items.push({
      q: "Como usar o " + produto + "?",
      a:
        "Indicação de uso do " +
        nome +
        ": " +
        usoTxt +
        "." +
        attrBit +
        (tom ? " Tom sugerido: " + tom + "." : "") +
        " Siga as instruções do fabricante; não prometa resultado médico ou milagroso."
    });

    items.push({
      q: "Qual a garantia e a política de devolução?",
      a:
        "Garantia do " +
        nome +
        ": " +
        garTxt +
        ". Devoluções seguem as regras do " +
        (marketplace === "ml"
          ? "Mercado Livre"
          : marketplace === "shopee"
            ? "Shopee"
            : marketplace === "amazon"
              ? "Amazon"
              : "marketplace") +
        " e do seu anúncio — confirme prazos e condições no painel oficial."
    });

    items.push({
      q: shipQ,
      a: shipA
    });

    items.push({
      q: "É compatível / como cuidar do " + produto + "?",
      a: attrs
        ? "Compatibilidade e cuidados do " +
          nome +
          " consideram: " +
          attrs +
          ". Para " +
          usoTxt +
          ", evite uso fora da especificação e limpe conforme o material indicado."
        : "Use o " +
          nome +
          " conforme " +
          usoTxt +
          ". Evite exposição a condições não previstas na ficha; descreva cuidados (limpeza, armazenamento) no anúncio."
    });

    items.push({
      q: "O que vem na caixa / no kit?",
      a: attrs
        ? "Conteúdo sugerido para o " +
          nome +
          " com base nos atributos (" +
          attrs +
          "): produto principal e itens acessórios que você listar. Não prometa brinde ou peça extra sem estoque."
        : "Liste explicitamente o que acompanha o " +
          nome +
          " (produto, cabos, manual, peças). Se for kit, nomeie cada item; se for unidade avulsa, diga isso com clareza."
    });

    if (marca) {
      items.push({
        q: "O produto é original da marca " + marca + "?",
        a:
          "Este anúncio refere-se ao " +
          produto +
          " da marca " +
          marca +
          ". Autenticidade e procedência devem refletir a nota/fornecedor real — não use selos ou claims que você não possa comprovar."
      });
    } else {
      items.push({
        q: "Qual a marca / procedência?",
        a:
          "Informe a marca do " +
          produto +
          " no título e na ficha. Se for genérico ou reembalado, diga com transparência para reduzir perguntas e devoluções."
      });
    }

    // Keep 6–8
    if (items.length > 8) items = items.slice(0, 8);
    if (items.length < 6) {
      items.push({
        q: "Posso tirar dúvidas antes de comprar?",
        a:
          "Sim. Pergunte pelo chat do anúncio do " +
          nome +
          " sobre " +
          (attrs || "especificações") +
          ", prazo e estoque. Respostas rápidas e honestas reduzem cancelamento."
      });
    }

    items = items.map(function (it) {
      return {
        q: scrubListingFaqText(it.q),
        a: scrubListingFaqText(it.a)
      };
    });

    var checklist = defaultListingFaqChecklist(marketplace);
    var copyText = joinListingFaqCopy(items);
    var disclaimer =
      "ESTIMATIVA — rascunho no navegador; confirme políticas do marketplace e do seu anúncio.";

    return {
      ok: true,
      items: items,
      marketplace: marketplace,
      count: items.length,
      copyText: copyText,
      checklist: checklist,
      disclaimer: disclaimer
    };
  }

  function mountListingFaq(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("titlegen", "variacoesgen", "faqanunciogen");

    var panel = el("div", { class: "titlegen__panel" });
    panel.appendChild(
      el("p", { class: "titlegen__kicker" }, "Gerador de FAQ de anúncio · ESTIMATIVA")
    );
    panel.appendChild(
      el("h2", { class: "titlegen__title" }, "Perguntas e respostas do anúncio")
    );

    var fields = el("div", { class: "titlegen__fields" });
    fields.appendChild(
      field({
        id: "faq-produto",
        type: "text",
        label: "Produto",
        placeholder: "Garrafa térmica inox 500ml",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "faq-marca",
        type: "text",
        label: "Marca (opcional)",
        placeholder: "Acme"
      })
    );
    fields.appendChild(
      field({
        id: "faq-atributos",
        type: "text",
        label: "Atributos / medidas",
        placeholder: "inox 304, 500ml, mantém 12h, tampa hermética",
        wide: true
      })
    );
    fields.appendChild(
      field({
        id: "faq-uso",
        type: "text",
        label: "Uso / indicação",
        placeholder: "academia, trabalho, viagem"
      })
    );
    fields.appendChild(
      field({
        id: "faq-garantia",
        type: "text",
        label: "Garantia",
        placeholder: "90 dias contra defeito de fabricação"
      })
    );
    fields.appendChild(
      field({
        id: "faq-marketplace",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "shopee", label: "Shopee" },
          { value: "amazon", label: "Amazon" },
          { value: "geral", label: "Geral" }
        ]
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "titlegen__hint" },
        "Gera 6–8 Q&As cobrindo material, medidas, uso, garantia, frete, cuidados, kit e autenticidade. ESTIMATIVA — confirme políticas do marketplace e do seu anúncio."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "titlegen__list", "aria-live": "polite" });
    root.appendChild(out);

    var last = null;

    function read() {
      return {
        produto: document.getElementById("faq-produto").value,
        marca: document.getElementById("faq-marca").value,
        atributos: document.getElementById("faq-atributos").value,
        uso: document.getElementById("faq-uso").value,
        garantia: document.getElementById("faq-garantia").value,
        marketplace: document.getElementById("faq-marketplace").value
      };
    }

    function render() {
      var result = generateListingFaq(read());
      last = result;
      out.innerHTML = "";
      if (!result.ok) {
        out.appendChild(
          el("p", { class: "titlegen__hint" }, result.error || "Informe o produto.")
        );
        return;
      }

      result.items.forEach(function (it, idx) {
        var card = el("article", { class: "title-card" });
        card.appendChild(
          el("p", { class: "title-card__label" }, "Pergunta " + (idx + 1) + " / " + result.count)
        );
        card.appendChild(el("p", { class: "title-card__hint" }, it.q));
        card.appendChild(
          el("p", { class: "titlegen__hint", style: "margin-top:6px" }, it.a)
        );
        out.appendChild(card);
      });

      var meta = el("div", { class: "title-card" });
      meta.appendChild(
        el(
          "p",
          { class: "title-card__label" },
          "Checklist · " + result.marketplace.toUpperCase() + " · ESTIMATIVA"
        )
      );
      meta.appendChild(el("p", { class: "titlegen__hint" }, result.disclaimer));
      var ul = el("ul", { class: "titlegen__hint", style: "padding-left:1.2em" });
      result.checklist.forEach(function (step) {
        ul.appendChild(el("li", null, step));
      });
      meta.appendChild(ul);

      var actions = el("div", {
        class: "titlegen__actions",
        style: "margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"
      });

      function copyBtn(label, solid, getter) {
        var btn = el(
          "button",
          {
            type: "button",
            class: "btn " + (solid ? "btn--solid" : "btn--ghost") + " title-card__copy"
          },
          label
        );
        btn.addEventListener("click", function () {
          var text = getter();
          if (!text || !String(text).trim()) {
            toast("Nada para copiar.");
            return;
          }
          copyText(String(text))
            .then(function () {
              toast(label + " — copiado.");
            })
            .catch(function () {
              toast("Não deu para copiar.");
            });
        });
        return btn;
      }

      actions.appendChild(
        copyBtn("Copiar FAQ", true, function () {
          return last && last.copyText ? last.copyText : "";
        })
      );
      actions.appendChild(
        copyBtn("Copiar checklist", false, function () {
          return last && last.checklist
            ? last.checklist
                .map(function (s, i) {
                  return i + 1 + ". " + cleanPart(s);
                })
                .join("\n")
            : "";
        })
      );
      meta.appendChild(actions);
      out.appendChild(meta);
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }


  function normalizeAdsCampaignMarketplace(mp) {
    mp = String(mp || "ml").toLowerCase().trim();
    if (mp === "mercadolivre" || mp === "mercado-livre" || mp === "meli") return "ml";
    if (mp === "magazine" || mp === "magazine-luiza" || mp === "magalu") return "magalu";
    if (mp === "amazon" || mp === "amz") return "amazon";
    if (mp === "geral" || mp === "general" || mp === "all") return "geral";
    if (mp === "ml") return "ml";
    return "ml";
  }

  function adsMarketplaceLabel(mp) {
    mp = normalizeAdsCampaignMarketplace(mp);
    if (mp === "amazon") return "Amazon";
    if (mp === "magalu") return "Magalu";
    if (mp === "geral") return "Geral";
    return "Mercado Livre";
  }

  function parseAdCampaignRow(raw, id, fallbackNome) {
    raw = raw || {};
    var nome = cleanPart(raw.nome || raw.name || fallbackNome || ("Campanha " + id));
    var gasto = Math.max(0, toNumber(raw.gastoAds != null ? raw.gastoAds : raw.gasto));
    var receita = Math.max(0, toNumber(raw.receitaAds != null ? raw.receitaAds : raw.receita));
    var cliquesRaw = raw.cliques != null && raw.cliques !== "" ? toNumber(raw.cliques) : null;
    var impressoesRaw =
      raw.impressoes != null && raw.impressoes !== ""
        ? toNumber(raw.impressoes)
        : raw.impressions != null && raw.impressions !== ""
          ? toNumber(raw.impressions)
          : null;
    var pedidosRaw =
      raw.pedidos != null && raw.pedidos !== ""
        ? toNumber(raw.pedidos)
        : raw.orders != null && raw.orders !== ""
          ? toNumber(raw.orders)
          : null;
    var cliques = cliquesRaw != null && cliquesRaw > 0 ? cliquesRaw : null;
    var impressoes = impressoesRaw != null && impressoesRaw > 0 ? impressoesRaw : null;
    var pedidos = pedidosRaw != null && pedidosRaw > 0 ? pedidosRaw : null;

    var acos = null;
    var roas = null;
    var cpc = null;
    var ctr = null;
    var cpa = null;
    if (receita > 0) acos = (gasto / receita) * 100;
    if (gasto > 0) roas = receita / gasto;
    if (cliques != null && cliques > 0) cpc = gasto / cliques;
    if (impressoes != null && impressoes > 0 && cliques != null) ctr = (cliques / impressoes) * 100;
    if (pedidos != null && pedidos > 0) cpa = gasto / pedidos;

    return {
      id: id,
      nome: nome || ("Campanha " + id),
      gasto: gasto,
      receita: receita,
      acos: acos,
      roas: roas,
      cpc: cpc,
      ctr: ctr,
      cpa: cpa,
      pedidos: pedidos,
      cliques: cliques,
      impressoes: impressoes,
      badge: null
    };
  }

  function badgeAdCampaign(camp, metaAcosPct) {
    var meta = toNumber(metaAcosPct);
    if (!(meta > 0)) meta = 25;
    if (camp.receita <= 0 && camp.gasto > 0) return "VERMELHO";
    if (camp.acos == null) return "VERMELHO";
    if (camp.acos <= meta) return "VERDE";
    if (camp.acos <= meta * 1.25) return "AMARELO";
    return "VERMELHO";
  }

  function buildAdCampaignsAdvice(result) {
    var mp = adsMarketplaceLabel(result.marketplace);
    var meta = result.metaAcosPct;
    if (!result.ok) {
      return result.error || "Informe ao menos 2 campanhas com gasto em ads.";
    }
    var w = result.winner;
    if (w === "empate") {
      return (
        "Empate técnico no " +
        mp +
        ": ACOS quase iguais (≤0,5 p.p.) e ROAS parecido. Olhe CTR/CPC/CPA e teste criativo ou lance. Meta ACOS " +
        meta +
        "%. ESTIMATIVA."
      );
    }
    var win = result.campaigns.find(function (c) {
      return c.id === w;
    });
    var others = result.campaigns.filter(function (c) {
      return c.id !== w && c.gasto > 0;
    });
    var winNome = win ? win.nome : w;
    var winAcos =
      win && win.acos != null
        ? win.acos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
        : "—";
    var tip =
      "Vencedora no " +
      mp +
      ": **" +
      winNome +
      "** (campanha " +
      w +
      ") com ACOS " +
      winAcos +
      "% vs meta " +
      meta +
      "%. ";
    if (win && win.badge === "VERDE") {
      tip += "Dentro da meta — considere escalar budget com cuidado. ";
    } else if (win && win.badge === "AMARELO") {
      tip += "Acima da meta até +25% — otimize lance/termo antes de escalar. ";
    } else {
      tip += "Acima do limite — corte termos ruins ou pause. ";
    }
    if (others.length) {
      var hot = others.filter(function (c) {
        return c.badge === "VERMELHO";
      });
      if (hot.length) {
        tip +=
          "Revise " +
          hot
            .map(function (c) {
              return c.nome;
            })
            .join(", ") +
          " (VERMELHO). ";
      }
    }
    tip += "Confirme no Ads console — ESTIMATIVA.";
    return tip.replace(/\*\*/g, "");
  }

  function joinAdCampaignsCopy(result) {
    result = result || {};
    var lines = [];
    lines.push("Precifica — Comparador de campanhas Ads (ESTIMATIVA)");
    lines.push("Marketplace: " + adsMarketplaceLabel(result.marketplace));
    lines.push(
      "Meta ACOS: " +
        (result.metaAcosPct != null ? String(result.metaAcosPct) : "25") +
        "%"
    );
    if (!result.ok) {
      lines.push("Erro: " + (result.error || "dados insuficientes"));
      return lines.join("\n");
    }
    (result.campaigns || []).forEach(function (c) {
      lines.push("");
      lines.push("[" + c.id + "] " + (c.nome || ""));
      lines.push("Gasto: " + formatBRL(c.gasto));
      lines.push("Receita ads: " + formatBRL(c.receita));
      lines.push(
        "ACOS: " +
          (c.acos == null
            ? "—"
            : c.acos.toLocaleString("pt-BR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              }) + "%")
      );
      lines.push(
        "ROAS: " +
          (c.roas == null
            ? "—"
            : c.roas.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }) + "x")
      );
      if (c.cpc != null) lines.push("CPC: " + formatBRL(c.cpc));
      if (c.ctr != null) {
        lines.push(
          "CTR: " +
            c.ctr.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }) +
            "%"
        );
      }
      if (c.cpa != null) lines.push("CPA: " + formatBRL(c.cpa));
      lines.push("Badge: " + (c.badge || "—"));
    });
    lines.push("");
    lines.push("Vencedora: " + (result.winner || "—"));
    if (result.advice) lines.push("Conselho: " + result.advice);
    lines.push(result.disclaimer || "ESTIMATIVA.");
    return lines.join("\n");
  }


  var PRECO_MINIMO_ADS_TAXA = { ml: 16, amazon: 15, magalu: 14, shopee: 14 };

  function normalizePrecoMinimoMarketplace(raw) {
    var s = String(raw == null ? "ml" : raw).toLowerCase().trim();
    if (s === "mercado livre" || s === "mercadolivre" || s === "meli") return "ml";
    if (s === "magazine luiza" || s === "magazine" || s === "luiza") return "magalu";
    if (s === "ml" || s === "amazon" || s === "magalu" || s === "shopee") return s;
    return "ml";
  }

  function precoMinimoAdsMarketplaceLabel(id) {
    if (id === "amazon") return "Amazon";
    if (id === "magalu") return "Magalu";
    if (id === "shopee") return "Shopee";
    return "Mercado Livre";
  }

  function defaultTaxaPrecoMinimoAds(marketplace) {
    var id = normalizePrecoMinimoMarketplace(marketplace);
    return PRECO_MINIMO_ADS_TAXA[id] != null ? PRECO_MINIMO_ADS_TAXA[id] : 16;
  }

  function badgePrecoMinimoAds(lucroDesejadoPct, acosMetaPct) {
    if (lucroDesejadoPct >= 15 && acosMetaPct <= 25) return "VERDE";
    if ((lucroDesejadoPct >= 8 && lucroDesejadoPct < 15) || (acosMetaPct > 25 && acosMetaPct <= 35)) return "AMARELO";
    return "VERMELHO";
  }

  function buildPrecoMinimoAdsAdvice(r) {
    var mp = precoMinimoAdsMarketplaceLabel(r.marketplace);
    if (r.badge === "VERDE") {
      return (
        "Preço mínimo estimado de " +
        formatBRL(r.precoMinimo) +
        " no " +
        mp +
        " cobre custo, taxa, ACOS meta e lucro. Confirme a comissão no Seller Center. ESTIMATIVA."
      );
    }
    if (r.badge === "AMARELO") {
      return (
        "Margem ou ACOS no limite: preço mínimo " +
        formatBRL(r.precoMinimo) +
        ". Aperte ACOS, negocie custo ou suba o preço no " +
        mp +
        ". ESTIMATIVA."
      );
    }
    return (
      "Alerta: lucro baixo ou ACOS alto. Preço mínimo " +
      formatBRL(r.precoMinimo) +
      " pode não sustentar o anúncio no " +
      mp +
      ". Revise custo/taxa/ads. ESTIMATIVA."
    );
  }

  function joinPrecoMinimoAdsCopy(r) {
    if (!r) return "";
    var lines = [];
    lines.push("Precifica — Preço mínimo com Ads (" + precoMinimoAdsMarketplaceLabel(r.marketplace) + ")");
    if (!r.ok) {
      lines.push(r.error || "Dados incompletos");
      lines.push("ESTIMATIVA");
      return lines.join("\n");
    }
    lines.push("Custo produto: " + formatBRL(r.custoProduto));
    lines.push("Frete unitário: " + formatBRL(r.freteUnitario));
    lines.push("Embalagem: " + formatBRL(r.embalagem));
    lines.push("Custos fixos: " + formatBRL(r.custosFixos));
    lines.push("Taxa marketplace: " + formatPct(r.taxaMarketplacePct));
    lines.push("ACOS meta: " + formatPct(r.acosMetaPct));
    lines.push("Lucro desejado: " + formatPct(r.lucroDesejadoPct));
    lines.push("Variável total: " + formatPct(r.variablePct));
    lines.push("Preço mínimo: " + formatBRL(r.precoMinimo));
    lines.push("Taxa estimada: " + formatBRL(r.taxaEstimada));
    lines.push("Ads estimado: " + formatBRL(r.custoAdsEstimado));
    lines.push("Lucro R$: " + formatBRL(r.lucroReais));
    lines.push("Badge: " + r.badge);
    if (r.advice) lines.push(r.advice);
    lines.push("ESTIMATIVA — confirme taxas e Ads no painel oficial.");
    return lines.join("\n");
  }

  function calculatePrecoMinimoAds(input) {
    input = input || {};
    var marketplace = normalizePrecoMinimoMarketplace(input.marketplace);
    var custoProduto = toNumber(input.custoProduto);
    var freteUnitario = toNumber(input.freteUnitario);
    var embalagem = toNumber(input.embalagem);
    if (!(freteUnitario >= 0) || freteUnitario !== freteUnitario) freteUnitario = 0;
    if (!(embalagem >= 0) || embalagem !== embalagem) embalagem = 0;

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = defaultTaxaPrecoMinimoAds(marketplace);
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }
    var acosMetaPct =
      input.acosMetaPct == null || input.acosMetaPct === ""
        ? 20
        : toNumber(input.acosMetaPct);
    var lucroDesejadoPct =
      input.lucroDesejadoPct == null || input.lucroDesejadoPct === ""
        ? 20
        : toNumber(input.lucroDesejadoPct);

    var disclaimer =
      "ESTIMATIVA — preço mínimo no navegador; confirme comissão, frete e Ads no Seller Center / Ads console. Não é conselho fiscal.";

    function fail(msg) {
      return {
        ok: false,
        error: msg,
        marketplace: marketplace,
        custoProduto: custoProduto,
        taxaMarketplacePct: taxaMarketplacePct,
        freteUnitario: freteUnitario,
        embalagem: embalagem,
        acosMetaPct: acosMetaPct,
        lucroDesejadoPct: lucroDesejadoPct,
        custosFixos: null,
        precoMinimo: null,
        taxaEstimada: null,
        custoAdsEstimado: null,
        lucroReais: null,
        variablePct: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
    }

    if (!(custoProduto > 0)) {
      var f0 = fail("Informe o custo do produto (R$) maior que zero.");
      f0.copyText = joinPrecoMinimoAdsCopy(f0);
      return f0;
    }
    if (!(taxaMarketplacePct >= 0) || !(acosMetaPct >= 0) || !(lucroDesejadoPct >= 0)) {
      var f1 = fail("Taxa, ACOS meta e lucro desejado precisam ser números ≥ 0.");
      f1.copyText = joinPrecoMinimoAdsCopy(f1);
      return f1;
    }

    var variablePct = taxaMarketplacePct + acosMetaPct + lucroDesejadoPct;
    if (!(variablePct < 100)) {
      var f2 = fail(
        "Soma de taxa + ACOS meta + lucro (" +
          variablePct.toFixed(1) +
          "%) precisa ser menor que 100%. Reduza algum percentual."
      );
      f2.variablePct = variablePct;
      f2.copyText = joinPrecoMinimoAdsCopy(f2);
      return f2;
    }

    var custosFixos = custoProduto + freteUnitario + embalagem;
    var precoMinimo = custosFixos / (1 - variablePct / 100);
    var taxaEstimada = precoMinimo * (taxaMarketplacePct / 100);
    var custoAdsEstimado = precoMinimo * (acosMetaPct / 100);
    var lucroReais = precoMinimo * (lucroDesejadoPct / 100);
    var badge = badgePrecoMinimoAds(lucroDesejadoPct, acosMetaPct);

    var result = {
      ok: true,
      marketplace: marketplace,
      custoProduto: custoProduto,
      taxaMarketplacePct: taxaMarketplacePct,
      freteUnitario: freteUnitario,
      embalagem: embalagem,
      acosMetaPct: acosMetaPct,
      lucroDesejadoPct: lucroDesejadoPct,
      custosFixos: custosFixos,
      precoMinimo: precoMinimo,
      taxaEstimada: taxaEstimada,
      custoAdsEstimado: custoAdsEstimado,
      lucroReais: lucroReais,
      variablePct: variablePct,
      badge: badge,
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.advice = buildPrecoMinimoAdsAdvice(result);
    result.copyText = joinPrecoMinimoAdsCopy(result);
    return result;
  }

  function mountPrecoMinimoAds(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "precominimoadsgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Preço mínimo com Ads · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Qual o menor preço que ainda paga taxa, ads e lucro"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "pma-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "amazon", label: "Amazon" },
          { value: "magalu", label: "Magalu" },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "pma-custo",
        label: "Custo do produto (R$)",
        value: "50",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "pma-taxa",
        label: "Taxa marketplace %",
        value: "16",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "pma-frete",
        label: "Frete unitário (R$)",
        value: "10",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "pma-emb",
        label: "Embalagem (R$)",
        value: "2",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "pma-acos",
        label: "ACOS meta %",
        value: "20",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    fields.appendChild(
      field({
        id: "pma-lucro",
        label: "Lucro desejado %",
        value: "20",
        step: "0.1",
        min: "0",
        max: "99"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Preço mínimo = (custo + frete + embalagem) ÷ (1 − taxa% − ACOS% − lucro%). Ao trocar o marketplace, a taxa padrão atualiza (você pode editar). ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    var mpEl = document.getElementById("pma-mp");
    var taxaEl = document.getElementById("pma-taxa");
    if (mpEl && taxaEl) {
      mpEl.addEventListener("change", function () {
        taxaEl.value = String(defaultTaxaPrecoMinimoAds(mpEl.value));
        render();
      });
    }

    function read() {
      return {
        marketplace: document.getElementById("pma-mp").value,
        custoProduto: document.getElementById("pma-custo").value,
        taxaMarketplacePct: document.getElementById("pma-taxa").value,
        freteUnitario: document.getElementById("pma-frete").value,
        embalagem: document.getElementById("pma-emb").value,
        acosMetaPct: document.getElementById("pma-acos").value,
        lucroDesejadoPct: document.getElementById("pma-lucro").value
      };
    }

    function render() {
      var r = calculatePrecoMinimoAds(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el("p", { class: "result-card__label" }, "Preço mínimo · " + (r.badge || "—") + " · ESTIMATIVA")
      );
      if (!r.ok) {
        card.appendChild(
          el("p", { class: "result-card__price is-loss" }, "—")
        );
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            formatBRL(r.precoMinimo)
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Marketplace", precoMinimoAdsMarketplaceLabel(r.marketplace));
        row("Custos fixos", formatBRL(r.custosFixos));
        row("Taxa est.", formatBRL(r.taxaEstimada) + " (" + formatPct(r.taxaMarketplacePct) + ")");
        row("Ads est.", formatBRL(r.custoAdsEstimado) + " (" + formatPct(r.acosMetaPct) + ")");
        row("Lucro R$", formatBRL(r.lucroReais) + " (" + formatPct(r.lucroDesejadoPct) + ")");
        row("Variável", formatPct(r.variablePct));
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinPrecoMinimoAdsCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["pma-custo", "pma-taxa", "pma-frete", "pma-emb", "pma-acos", "pma-lucro"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", render);
        node.addEventListener("change", render);
      }
    });
    render();
  }


  function compareAdCampaigns(input) {
    input = input || {};
    var marketplace = normalizeAdsCampaignMarketplace(input.marketplace);
    var metaAcosPct =
      input.metaAcosPct == null || input.metaAcosPct === ""
        ? 25
        : toNumber(input.metaAcosPct);
    if (!(metaAcosPct > 0)) metaAcosPct = 25;

    var disclaimer =
      "ESTIMATIVA — compare no navegador; confirme ACOS/ROAS/CPC no Ads console do marketplace. Não é relatório oficial.";

    var rawList = [];
    if (Array.isArray(input.campaigns) && input.campaigns.length) {
      rawList = input.campaigns.slice(0, 3);
    } else {
      rawList = [input.a || input.A || {}, input.b || input.B || {}];
      if (input.c || input.C) rawList.push(input.c || input.C);
    }

    var ids = ["A", "B", "C"];
    var campaigns = [];
    var i;
    for (i = 0; i < rawList.length && i < 3; i++) {
      var row = parseAdCampaignRow(rawList[i], ids[i], "Campanha " + ids[i]);
      row.badge = badgeAdCampaign(row, metaAcosPct);
      campaigns.push(row);
    }

    var withSpend = campaigns.filter(function (c) {
      return c.gasto > 0;
    });

    if (withSpend.length < 2) {
      return {
        ok: false,
        error: "Informe ao menos 2 campanhas com gasto em ads (R$) maior que zero.",
        campaigns: campaigns,
        winner: null,
        advice: "Preencha gasto e receita de pelo menos duas campanhas (A e B). Campanha C é opcional.",
        metaAcosPct: metaAcosPct,
        marketplace: marketplace,
        disclaimer: disclaimer,
        copyText: ""
      };
    }

    var eligible = campaigns.filter(function (c) {
      return c.gasto > 0 && c.receita > 0 && c.acos != null;
    });

    var winner = null;
    if (!eligible.length) {
      winner = null;
    } else {
      eligible.sort(function (x, y) {
        if (x.acos !== y.acos) return x.acos - y.acos;
        return (y.roas || 0) - (x.roas || 0);
      });
      var best = eligible[0];
      var tied = eligible.filter(function (c) {
        return Math.abs(c.acos - best.acos) <= 0.5;
      });
      if (tied.length > 1) {
        tied.sort(function (x, y) {
          return (y.roas || 0) - (x.roas || 0);
        });
        var topRoas = tied[0].roas || 0;
        var roasTied = tied.filter(function (c) {
          return Math.abs((c.roas || 0) - topRoas) < 1e-9;
        });
        if (roasTied.length > 1) winner = "empate";
        else winner = tied[0].id;
      } else {
        winner = best.id;
      }
    }

    if (winner == null) {
      // all spent but no receita → still ok:false? Spec: winner among receita>0 && gasto>0.
      // If none eligible, treat as fail-ish but we already have 2 with gasto — return ok true with winner null? 
      // Better: ok true, winner null, advice to fix attribution.
      winner = null;
    }

    var result = {
      ok: true,
      campaigns: campaigns,
      winner: winner == null ? "—" : winner,
      advice: "",
      metaAcosPct: metaAcosPct,
      marketplace: marketplace,
      disclaimer: disclaimer,
      copyText: ""
    };
    if (winner == null) {
      result.winner = "—";
      result.advice =
        "Há gasto em ads, mas nenhuma campanha com receita atribuída > 0. Corrija a atribuição no " +
        adsMarketplaceLabel(marketplace) +
        " antes de comparar eficiência. ESTIMATIVA.";
    } else {
      result.advice = buildAdCampaignsAdvice(result);
    }
    result.copyText = joinAdCampaignsCopy(result);
    return result;
  }

  function mountAdCampaigns(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "campanhasadsgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Comparador de campanhas Ads · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Compare 2 ou 3 campanhas lado a lado"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "ads-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "amazon", label: "Amazon" },
          { value: "magalu", label: "Magalu" },
          { value: "geral", label: "Geral" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "ads-meta",
        label: "Meta ACOS %",
        value: "25",
        step: "0.1",
        min: "1",
        max: "200"
      })
    );

    function campFields(id, defaults) {
      var box = el("div", {
        class: "field field--wide",
        style: "grid-column:1/-1;border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px;margin-top:8px"
      });
      box.appendChild(
        el("p", { class: "field__label", style: "margin-bottom:8px" }, "Campanha " + id)
      );
      var inner = el("div", { class: "freightgen__fields titlegen__fields" });
      inner.appendChild(
        field({
          id: "ads-" + id + "-nome",
          type: "text",
          label: "Nome (opcional)",
          placeholder: "Ex.: Product Ads marca",
          value: defaults.nome || ""
        })
      );
      inner.appendChild(
        field({
          id: "ads-" + id + "-gasto",
          label: "Gasto ads (R$)",
          value: defaults.gasto,
          step: "0.01",
          min: "0"
        })
      );
      inner.appendChild(
        field({
          id: "ads-" + id + "-receita",
          label: "Receita ads (R$)",
          value: defaults.receita,
          step: "0.01",
          min: "0"
        })
      );
      inner.appendChild(
        field({
          id: "ads-" + id + "-cliques",
          label: "Cliques (opcional)",
          value: defaults.cliques || "",
          step: "1",
          min: "0"
        })
      );
      inner.appendChild(
        field({
          id: "ads-" + id + "-imp",
          label: "Impressões (opcional)",
          value: defaults.imp || "",
          step: "1",
          min: "0"
        })
      );
      inner.appendChild(
        field({
          id: "ads-" + id + "-pedidos",
          label: "Pedidos (opcional)",
          value: defaults.pedidos || "",
          step: "1",
          min: "0"
        })
      );
      box.appendChild(inner);
      return box;
    }

    fields.appendChild(
      campFields("A", { nome: "Campanha A", gasto: "100", receita: "500", cliques: "50", imp: "2000", pedidos: "10" })
    );
    fields.appendChild(
      campFields("B", { nome: "Campanha B", gasto: "200", receita: "500", cliques: "80", imp: "4000", pedidos: "8" })
    );
    fields.appendChild(
      campFields("C", { nome: "", gasto: "", receita: "", cliques: "", imp: "", pedidos: "" })
    );

    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "ACOS = gasto ÷ receita ads × 100. ROAS = receita ÷ gasto. CPC / CTR / CPA se informar cliques, impressões e pedidos. Badge vs meta ACOS: VERDE ≤ meta, AMARELO ≤ meta×1,25, VERMELHO acima. ESTIMATIVA — confirme no Ads console."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function fmtPct(v) {
      if (v == null || !Number.isFinite(v)) return "—";
      return (
        v.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }) + "%"
      );
    }
    function fmtRoas(v) {
      if (v == null || !Number.isFinite(v)) return "—";
      return (
        v.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) + "x"
      );
    }

    function readCamp(id) {
      var gastoEl = document.getElementById("ads-" + id + "-gasto");
      var recEl = document.getElementById("ads-" + id + "-receita");
      var gastoVal = gastoEl ? gastoEl.value : "";
      var recVal = recEl ? recEl.value : "";
      // skip empty C entirely if both blank
      if (id === "C" && (!String(gastoVal).trim() && !String(recVal).trim())) {
        return null;
      }
      return {
        nome: document.getElementById("ads-" + id + "-nome").value,
        gastoAds: gastoVal,
        receitaAds: recVal,
        cliques: document.getElementById("ads-" + id + "-cliques").value,
        impressoes: document.getElementById("ads-" + id + "-imp").value,
        pedidos: document.getElementById("ads-" + id + "-pedidos").value
      };
    }

    function read() {
      var input = {
        marketplace: document.getElementById("ads-mp").value,
        metaAcosPct: document.getElementById("ads-meta").value,
        a: readCamp("A") || { gastoAds: 0, receitaAds: 0 },
        b: readCamp("B") || { gastoAds: 0, receitaAds: 0 }
      };
      var c = readCamp("C");
      if (c) input.c = c;
      return input;
    }

    function badgeClass(b) {
      if (b === "VERDE") return " is-ok";
      if (b === "AMARELO") return "";
      return " is-loss";
    }

    function render() {
      var r = compareAdCampaigns(read());
      out.innerHTML = "";
      if (!r.ok) {
        var errCard = el("article", { class: "result-card result-card--loss" });
        errCard.appendChild(
          el("p", { class: "result-card__label" }, "Comparador · ESTIMATIVA")
        );
        errCard.appendChild(
          el("p", { class: "result-card__price is-loss" }, "Dados incompletos")
        );
        errCard.appendChild(el("p", { class: "muted" }, r.error || r.advice));
        errCard.appendChild(el("p", { class: "result-card__note" }, r.disclaimer));
        out.appendChild(errCard);
        return;
      }

      var grid = el("div", {
        style: "display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"
      });

      r.campaigns.forEach(function (c) {
        var loss = c.badge === "VERMELHO";
        var isWin = r.winner === c.id;
        var card = el(
          "article",
          {
            class:
              "result-card" +
              (loss ? " result-card--loss" : "") +
              (isWin ? "" : "")
          }
        );
        card.appendChild(
          el(
            "p",
            { class: "result-card__label" },
            "Campanha " +
              c.id +
              (isWin ? " · VENCEDORA" : r.winner === "empate" ? " · EMPATE" : "") +
              " · ESTIMATIVA"
          )
        );
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + badgeClass(c.badge) },
            c.badge || "—"
          )
        );
        card.appendChild(el("p", { class: "muted" }, c.nome || ("Campanha " + c.id)));
        var ul = el("ul", { class: "result-card__rows" });
        function row(k, v) {
          var li = el("li", {});
          li.appendChild(el("span", {}, k));
          li.appendChild(el("strong", {}, v));
          ul.appendChild(li);
        }
        row("Gasto", formatBRL(c.gasto));
        row("Receita ads", formatBRL(c.receita));
        row("ACOS", fmtPct(c.acos));
        row("ROAS", fmtRoas(c.roas));
        row("CPC", c.cpc != null ? formatBRL(c.cpc) : "—");
        row("CTR", c.ctr != null ? fmtPct(c.ctr) : "—");
        row("CPA", c.cpa != null ? formatBRL(c.cpa) : "—");
        card.appendChild(ul);
        grid.appendChild(card);
      });
      out.appendChild(grid);

      var summary = el("article", { class: "result-card", style: "margin-top:12px" });
      summary.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Resumo · " +
            adsMarketplaceLabel(r.marketplace) +
            " · meta " +
            r.metaAcosPct +
            "% · ESTIMATIVA"
        )
      );
      summary.appendChild(
        el(
          "p",
          { class: "result-card__price" },
          r.winner === "empate"
            ? "EMPATE"
            : r.winner === "—"
              ? "Sem vencedora"
              : "Vencedora: " + r.winner
        )
      );
      summary.appendChild(el("p", { class: "muted" }, r.advice));
      summary.appendChild(el("p", { class: "result-card__note" }, r.disclaimer));

      var copyBtn = el(
        "button",
        { type: "button", class: "btn btn--ghost" },
        "Copiar resumo"
      );
      copyBtn.addEventListener("click", function () {
        var text = joinAdCampaignsCopy(r);
        if (!text || !String(text).trim()) {
          toast("Nada para copiar.");
          return;
        }
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Não deu para copiar.");
          });
      });
      summary.appendChild(copyBtn);
      out.appendChild(summary);
    }

    panel.addEventListener("input", render);
    panel.addEventListener("change", render);
    render();
  }



  function normalizeChecklistMarketplace(raw) {
    return normalizePrecoMinimoMarketplace(raw);
  }

  function checklistAnuncioMarketplaceLabel(id) {
    return precoMinimoAdsMarketplaceLabel(id);
  }

  function checklistAnuncioItems(marketplace) {
    var mp = normalizeChecklistMarketplace(marketplace);
    var tituloLenTip =
      mp === "amazon"
        ? "Amazon: use até ~150 caracteres no título (backend). Coloque a keyword principal no início. ESTIMATIVA."
        : mp === "shopee"
          ? "Shopee: mira ~100 caracteres. Keyword principal no começo. ESTIMATIVA."
          : mp === "magalu"
            ? "Magalu: mantenha o título completo e legível (~60–100 chars úteis). Keyword no início. ESTIMATIVA."
            : "Mercado Livre: limite prático ~60 caracteres. Keyword principal no início. ESTIMATIVA.";
    var fotosTip =
      mp === "amazon"
        ? "Amazon: pelo menos 5 imagens (ideal 7+), fundo branco na principal. ESTIMATIVA."
        : "Publique ≥6 fotos (ângulos, detalhe, uso). ESTIMATIVA.";
    var bulletsLabel =
      mp === "amazon"
        ? "Bullets (Amazon) preenchidos"
        : "Atributos do anúncio preenchidos";
    var bulletsTip =
      mp === "amazon"
        ? "Preencha 5 bullets com benefícios + specs. Sem keyword stuffing. ESTIMATIVA."
        : "Complete atributos/ficha técnica (cor, material, voltagem, etc.). ESTIMATIVA.";
    var freteTip =
      mp === "amazon"
        ? "Defina FBA/FBM e deixe o prazo claro na oferta. ESTIMATIVA."
        : mp === "ml"
          ? "Configure frete grátis / Full / Flex e comunique no anúncio. ESTIMATIVA."
          : "Deixe frete/fulfillment definido e comunicável ao comprador. ESTIMATIVA.";

    return [
      {
        id: "tituloKeywords",
        label: "Título com palavra-chave principal no início",
        weight: 12,
        tip: "Coloque a keyword de busca no começo do título (sem spam). ESTIMATIVA."
      },
      {
        id: "tituloLength",
        label: "Título no tamanho recomendado do marketplace",
        weight: 8,
        tip: tituloLenTip
      },
      {
        id: "fotosMinimas",
        label: mp === "amazon" ? "≥5 fotos no anúncio" : "≥6 fotos no anúncio",
        weight: 10,
        tip: fotosTip
      },
      {
        id: "fotoPrincipalClara",
        label: "Foto principal com fundo limpo / produto destacado",
        weight: 8,
        tip: "Use fundo limpo, boa luz e produto centralizado na capa. ESTIMATIVA."
      },
      {
        id: "descricaoCompleta",
        label: "Descrição com benefícios + especificações",
        weight: 10,
        tip: "Escreva benefícios + specs (medidas, materiais, garantia). ESTIMATIVA."
      },
      {
        id: "bulletsOuAtributos",
        label: bulletsLabel,
        weight: 9,
        tip: bulletsTip
      },
      {
        id: "categoriaCorreta",
        label: "Categoria correta",
        weight: 9,
        tip: "Categoria errada mata impressão orgânica — revise no catálogo. ESTIMATIVA."
      },
      {
        id: "eanOuGtin",
        label: "EAN/GTIN quando aplicável",
        weight: 6,
        tip: "Informe EAN/GTIN se o produto tiver código de barras. ESTIMATIVA."
      },
      {
        id: "precoCompetitivo",
        label: "Preço alinhado à concorrência (estimado)",
        weight: 8,
        tip: "Compare 3–5 anúncios similares e ajuste preço/kit. ESTIMATIVA — não é ranking oficial."
      },
      {
        id: "freteClaro",
        label: "Frete / Full / Fulfillment definido",
        weight: 7,
        tip: freteTip
      },
      {
        id: "faqRespostas",
        label: "FAQ ou respostas a perguntas comuns",
        weight: 6,
        tip: "Antecipe dúvidas (tamanho, compatibilidade, prazo). ESTIMATIVA."
      },
      {
        id: "estoqueVariacoes",
        label: "Estoque + variações (cor/tamanho) cadastradas",
        weight: 7,
        tip: "Cadastre estoque e variações que o comprador espera. ESTIMATIVA."
      }
    ];
  }

  function badgeChecklistAnuncio(score) {
    if (score >= 80) return "VERDE";
    if (score >= 50) return "AMARELO";
    return "VERMELHO";
  }

  function parseChecklistChecks(input, items) {
    var checks = {};
    var i;
    for (i = 0; i < items.length; i++) checks[items[i].id] = false;
    if (!input) return checks;
    var raw = input.checks != null ? input.checks : input.checked;
    if (Array.isArray(raw)) {
      raw.forEach(function (id) {
        var key = String(id);
        if (checks.hasOwnProperty(key)) checks[key] = true;
      });
      return checks;
    }
    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach(function (key) {
        if (checks.hasOwnProperty(key)) {
          var v = raw[key];
          checks[key] = v === true || v === 1 || v === "1" || v === "true" || v === "on";
        }
      });
    }
    return checks;
  }

  function buildChecklistAnuncioAdvice(r) {
    var mp = checklistAnuncioMarketplaceLabel(r.marketplace);
    if (r.badge === "VERDE") {
      return (
        "Checklist SEO ~" +
        r.score +
        "/100 no " +
        mp +
        ". Anúncio bem preparado — revise periodicamente título, fotos e preço. ESTIMATIVA — não é ranking oficial."
      );
    }
    if (r.badge === "AMARELO") {
      var top = (r.missing || []).slice(0, 3).map(function (m) { return m.label; });
      return (
        "Score " +
        r.score +
        "/100 no " +
        mp +
        ". Priorize: " +
        (top.length ? top.join("; ") : "itens em falta") +
        ". ESTIMATIVA."
      );
    }
    return (
      "Score baixo (" +
      r.score +
      "/100) no " +
      mp +
      ". Complete título, fotos e atributos antes de investir em Ads. ESTIMATIVA — não é ranking oficial."
    );
  }

  function joinChecklistAnuncioCopy(r) {
    if (!r) return "";
    var lines = [];
    lines.push(
      "Precifica — Checklist SEO de anúncio (" +
        checklistAnuncioMarketplaceLabel(r.marketplace) +
        ")"
    );
    lines.push("Score: " + r.score + "/" + r.maxScore + " · Badge: " + (r.badge || "—"));
    lines.push("Marcados: " + r.checkedCount + "/" + r.totalCount);
    if (r.missing && r.missing.length) {
      lines.push("Pendências:");
      r.missing.forEach(function (m) {
        lines.push("- [" + m.id + "] " + m.label + " — " + m.tip);
      });
    } else {
      lines.push("Nenhuma pendência na checklist.");
    }
    if (r.advice) lines.push(r.advice);
    lines.push(r.disclaimer || "ESTIMATIVA");
    return lines.join("\n");
  }

  function calculateChecklistAnuncio(input) {
    input = input || {};
    var marketplace = normalizeChecklistMarketplace(input.marketplace);
    var items = checklistAnuncioItems(marketplace);
    var checks = parseChecklistChecks(input, items);
    var disclaimer =
      "ESTIMATIVA — checklist de prontidão SEO no navegador; não é ranking oficial do marketplace nem auditoria certificada.";

    var maxWeight = 0;
    var gotWeight = 0;
    var checkedCount = 0;
    var missing = [];
    var i;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      maxWeight += it.weight;
      if (checks[it.id]) {
        gotWeight += it.weight;
        checkedCount += 1;
      } else {
        missing.push({ id: it.id, label: it.label, tip: it.tip, weight: it.weight });
      }
    }
    var score = maxWeight > 0 ? Math.round((gotWeight / maxWeight) * 100) : 0;
    var badge = badgeChecklistAnuncio(score);
    var result = {
      ok: true,
      marketplace: marketplace,
      score: score,
      maxScore: 100,
      badge: badge,
      checkedCount: checkedCount,
      totalCount: items.length,
      missing: missing,
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.advice = buildChecklistAnuncioAdvice(result);
    result.copyText = joinChecklistAnuncioCopy(result);
    return result;
  }

  function mountChecklistAnuncio(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "checklistanunciogen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Checklist SEO de anúncio · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quanto seu anúncio está pronto para ranquear (estimativa)"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "cka-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "amazon", label: "Amazon" },
          { value: "magalu", label: "Magalu" },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    panel.appendChild(fields);

    var listWrap = el("div", { class: "checklistanuncio__list", id: "cka-list" });
    panel.appendChild(listWrap);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Marque o que já está ok no anúncio. Score = pontos marcados ÷ total × 100. Não é ranking oficial. ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    var checkState = {};

    function rebuildList() {
      var mp = document.getElementById("cka-mp").value;
      var items = checklistAnuncioItems(mp);
      var prev = checkState;
      checkState = {};
      listWrap.innerHTML = "";
      items.forEach(function (it) {
        checkState[it.id] = !!prev[it.id];
        var lab = el("label", { class: "field field--wide checklistanuncio__item" });
        var row = el("span", { class: "checklistanuncio__row" });
        var cb = el("input", {
          type: "checkbox",
          id: "cka-" + it.id,
          "data-cka-id": it.id
        });
        cb.checked = checkState[it.id];
        cb.addEventListener("change", function () {
          checkState[it.id] = !!cb.checked;
          render();
        });
        row.appendChild(cb);
        row.appendChild(
          el(
            "span",
            { class: "field__label" },
            it.label + " (" + it.weight + " pts)"
          )
        );
        lab.appendChild(row);
        listWrap.appendChild(lab);
      });
    }

    function read() {
      return {
        marketplace: document.getElementById("cka-mp").value,
        checks: checkState
      };
    }

    function render() {
      var r = calculateChecklistAnuncio(read());
      out.innerHTML = "";
      var loss = r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Score SEO · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__price" + (loss ? " is-loss" : "") },
          String(r.score) + "/100"
        )
      );
      var grid = el("div", { class: "result-card__grid" });
      function row(k, v) {
        var d = el("div");
        d.appendChild(el("span", { class: "muted" }, k));
        d.appendChild(el("strong", null, v));
        grid.appendChild(d);
      }
      row("Marketplace", checklistAnuncioMarketplaceLabel(r.marketplace));
      row("Marcados", r.checkedCount + " / " + r.totalCount);
      row("Badge", r.badge);
      card.appendChild(grid);
      card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      if (r.missing && r.missing.length) {
        var missTitle = el("p", { class: "result-card__label" }, "Pendências (dicas)");
        card.appendChild(missTitle);
        var ul = el("ul", { class: "checklistanuncio__missing" });
        r.missing.forEach(function (m) {
          ul.appendChild(el("li", null, m.label + " — " + m.tip));
        });
        card.appendChild(ul);
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinChecklistAnuncioCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    var mpEl = document.getElementById("cka-mp");
    if (mpEl) {
      mpEl.addEventListener("change", function () {
        rebuildList();
        render();
      });
    }
    rebuildList();
    render();
  }



  function normalizeBreakevenAdsMarketplace(raw) {
    return normalizePrecoMinimoMarketplace(raw);
  }

  function breakevenAdsMarketplaceLabel(id) {
    return precoMinimoAdsMarketplaceLabel(id);
  }

  function defaultTaxaBreakevenAds(marketplace) {
    return defaultTaxaPrecoMinimoAds(marketplace);
  }

  function badgeBreakevenAds(r) {
    if (!r || !r.ok) return "VERMELHO";
    var hasPedidos =
      r.pedidosAtuaisDia != null &&
      r.pedidosAtuaisDia === r.pedidosAtuaisDia &&
      r.pedidosAtuaisDia >= 0 &&
      r._hasPedidosAtuais;
    if (hasPedidos) {
      var lucro = r.lucroLiquidoDiaEstimado;
      var cob = r.coberturaPct;
      if (lucro != null && lucro < 0) return "VERMELHO";
      if (lucro != null && lucro >= 0 && cob != null && cob >= 120) return "VERDE";
      if (lucro != null && lucro >= 0) return "AMARELO";
      return "AMARELO";
    }
    var ratio =
      r.contribuicaoPorPedido > 0 ? r.gastoAdsDiario / r.contribuicaoPorPedido : Infinity;
    if (ratio <= 10) return "VERDE";
    if (ratio <= 30) return "AMARELO";
    return "VERMELHO";
  }

  function buildBreakevenAdsAdvice(r) {
    var mp = breakevenAdsMarketplaceLabel(r.marketplace);
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "Com " +
      formatBRL(r.gastoAdsDiario) +
      "/dia de Ads no " +
      mp +
      " e contribuição de " +
      formatBRL(r.contribuicaoPorPedido) +
      "/pedido, você precisa de cerca de " +
      r.pedidosBreakEven +
      " pedido(s)/dia para empatar (exato " +
      (Math.round(r.pedidosBreakEvenExact * 100) / 100) +
      "). ";
    if (r._hasPedidosAtuais) {
      if (r.lucroLiquidoDiaEstimado != null && r.lucroLiquidoDiaEstimado >= 0) {
        base +=
          "Com " +
          r.pedidosAtuaisDia +
          " pedido(s) atuais, lucro líquido estimado " +
          formatBRL(r.lucroLiquidoDiaEstimado) +
          " (cobertura ~" +
          Math.round(r.coberturaPct) +
          "%). ";
      } else {
        base +=
          "Com " +
          r.pedidosAtuaisDia +
          " pedido(s) atuais, o Ads ainda come margem (lucro " +
          formatBRL(r.lucroLiquidoDiaEstimado) +
          "). Corte gasto ou suba contribuição. ";
      }
    } else if (r.badge === "VERMELHO") {
      base += "Gasto alto frente à contribuição unitária — revise bid, targeting ou margem. ";
    } else if (r.badge === "VERDE") {
      base += "Meta de pedidos diários parece alcançável. ";
    } else {
      base += "Monitore conversão e ACOS para não estourar o break-even. ";
    }
    return base + "ESTIMATIVA.";
  }

  function joinBreakevenAdsCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Break-even Ads diário · Precifica");
    lines.push("Marketplace: " + breakevenAdsMarketplaceLabel(r.marketplace || "ml"));
    if (r.ok) {
      lines.push("Gasto Ads/dia: " + formatBRL(r.gastoAdsDiario));
      lines.push("Contribuição/pedido: " + formatBRL(r.contribuicaoPorPedido));
      lines.push(
        "Pedidos p/ empatar: " +
          r.pedidosBreakEven +
          " (exato " +
          (Math.round(r.pedidosBreakEvenExact * 1000) / 1000) +
          ")"
      );
      if (r.receitaBreakEven != null) {
        lines.push("Receita break-even: " + formatBRL(r.receitaBreakEven));
      }
      if (r._hasPedidosAtuais) {
        lines.push("Pedidos atuais/dia: " + r.pedidosAtuaisDia);
        if (r.lucroLiquidoDiaEstimado != null) {
          lines.push("Lucro líquido/dia est.: " + formatBRL(r.lucroLiquidoDiaEstimado));
        }
        if (r.coberturaPct != null) {
          lines.push("Cobertura Ads: " + (Math.round(r.coberturaPct * 10) / 10) + "%");
        }
      }
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(r.disclaimer || "ESTIMATIVA — confirme no Ads console / Seller Center.");
    return lines.join("\n");
  }

  function calculateBreakevenAds(input) {
    input = input || {};
    var marketplace = normalizeBreakevenAdsMarketplace(input.marketplace);
    var gastoAdsDiario = toNumber(input.gastoAdsDiario);
    var contribuicaoPorPedido = toNumber(input.contribuicaoPorPedido);
    var precoVenda = toNumber(input.precoVenda);
    var custoProduto = toNumber(input.custoProduto);
    var freteUnitario = toNumber(input.freteUnitario);
    if (!(freteUnitario >= 0) || freteUnitario !== freteUnitario) freteUnitario = 0;

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = defaultTaxaBreakevenAds(marketplace);
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var hasPedidosAtuais =
      input.pedidosAtuaisDia != null &&
      input.pedidosAtuaisDia !== "" &&
      !isNaN(toNumber(input.pedidosAtuaisDia));
    var pedidosAtuaisDia = hasPedidosAtuais ? toNumber(input.pedidosAtuaisDia) : null;
    if (hasPedidosAtuais && (!(pedidosAtuaisDia >= 0) || pedidosAtuaisDia !== pedidosAtuaisDia)) {
      hasPedidosAtuais = false;
      pedidosAtuaisDia = null;
    }

    var disclaimer =
      "ESTIMATIVA — break-even de Ads no navegador; confirme gasto, contribuição e pedidos no Ads console / Seller Center. Não é conselho fiscal.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        marketplace: marketplace,
        gastoAdsDiario: gastoAdsDiario,
        contribuicaoPorPedido: contribuicaoPorPedido,
        precoVenda: precoVenda > 0 ? precoVenda : null,
        pedidosAtuaisDia: pedidosAtuaisDia,
        _hasPedidosAtuais: hasPedidosAtuais,
        pedidosBreakEven: null,
        pedidosBreakEvenExact: null,
        receitaBreakEven: null,
        lucroLiquidoDiaEstimado: null,
        coberturaPct: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinBreakevenAdsCopy(f);
      return f;
    }

    if (!(gastoAdsDiario > 0) || gastoAdsDiario !== gastoAdsDiario) {
      return fail("Informe o gasto de Ads por dia (R$) maior que zero.");
    }

    // Derive contribution if not provided (>0)
    if (!(contribuicaoPorPedido > 0) || contribuicaoPorPedido !== contribuicaoPorPedido) {
      if (
        precoVenda > 0 &&
        precoVenda === precoVenda &&
        custoProduto === custoProduto &&
        custoProduto >= 0 &&
        taxaMarketplacePct === taxaMarketplacePct &&
        taxaMarketplacePct >= 0
      ) {
        contribuicaoPorPedido =
          precoVenda - custoProduto - precoVenda * (taxaMarketplacePct / 100) - freteUnitario;
      }
    }

    if (!(contribuicaoPorPedido > 0) || contribuicaoPorPedido !== contribuicaoPorPedido) {
      return fail(
        "Informe a contribuição líquida por pedido (R$) > 0, ou preço/custo/taxa/frete para calcular (preço − custo − taxa − frete)."
      );
    }

    var pedidosBreakEvenExact = gastoAdsDiario / contribuicaoPorPedido;
    var pedidosBreakEven = Math.ceil(pedidosBreakEvenExact - 1e-12);
    if (pedidosBreakEven < 0) pedidosBreakEven = 0;

    var receitaBreakEven =
      precoVenda > 0 && precoVenda === precoVenda
        ? pedidosBreakEvenExact * precoVenda
        : null;

    var lucroLiquidoDiaEstimado = null;
    var coberturaPct = null;
    if (hasPedidosAtuais) {
      lucroLiquidoDiaEstimado = pedidosAtuaisDia * contribuicaoPorPedido - gastoAdsDiario;
      coberturaPct = (pedidosAtuaisDia * contribuicaoPorPedido / gastoAdsDiario) * 100;
    }

    var result = {
      ok: true,
      error: null,
      marketplace: marketplace,
      gastoAdsDiario: gastoAdsDiario,
      contribuicaoPorPedido: contribuicaoPorPedido,
      precoVenda: precoVenda > 0 ? precoVenda : null,
      pedidosAtuaisDia: pedidosAtuaisDia,
      _hasPedidosAtuais: hasPedidosAtuais,
      pedidosBreakEven: pedidosBreakEven,
      pedidosBreakEvenExact: pedidosBreakEvenExact,
      receitaBreakEven: receitaBreakEven,
      lucroLiquidoDiaEstimado: lucroLiquidoDiaEstimado,
      coberturaPct: coberturaPct,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeBreakevenAds(result);
    result.advice = buildBreakevenAdsAdvice(result);
    result.copyText = joinBreakevenAdsCopy(result);
    return result;
  }

  function mountBreakevenAds(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "breakevenadsgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Break-even Ads diário · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Com quanto de Ads por dia, quantos pedidos preciso para empatar?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "bea-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "amazon", label: "Amazon" },
          { value: "magalu", label: "Magalu" },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "bea-gasto",
        label: "Gasto Ads / dia (R$)",
        value: "100",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "bea-contrib",
        label: "Contribuição líquida / pedido (R$)",
        value: "20",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "bea-pedidos",
        label: "Pedidos atuais / dia (opcional)",
        value: "",
        step: "1",
        min: "0",
        placeholder: "ex.: 5"
      })
    );
    fields.appendChild(
      field({
        id: "bea-preco",
        label: "Preço de venda (R$, opcional)",
        value: "",
        step: "0.01",
        min: "0",
        placeholder: "para receita break-even"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Contribuição ≈ preço − custo − taxa do marketplace − frete unitário. Pedidos p/ empatar = ceil(gasto Ads ÷ contribuição). ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function read() {
      var pedidosRaw = document.getElementById("bea-pedidos").value;
      var precoRaw = document.getElementById("bea-preco").value;
      return {
        marketplace: document.getElementById("bea-mp").value,
        gastoAdsDiario: document.getElementById("bea-gasto").value,
        contribuicaoPorPedido: document.getElementById("bea-contrib").value,
        pedidosAtuaisDia: pedidosRaw === "" ? undefined : pedidosRaw,
        precoVenda: precoRaw === "" ? undefined : precoRaw
      };
    }

    function render() {
      var r = calculateBreakevenAds(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Pedidos p/ empatar · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            String(r.pedidosBreakEven) + " pedido(s)/dia"
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Marketplace", breakevenAdsMarketplaceLabel(r.marketplace));
        row("Gasto Ads/dia", formatBRL(r.gastoAdsDiario));
        row("Contribuição/pedido", formatBRL(r.contribuicaoPorPedido));
        row(
          "Exato",
          (Math.round(r.pedidosBreakEvenExact * 1000) / 1000).toLocaleString("pt-BR") + " pedidos"
        );
        if (r.receitaBreakEven != null) {
          row("Receita break-even", formatBRL(r.receitaBreakEven));
        }
        if (r._hasPedidosAtuais) {
          row("Pedidos atuais", String(r.pedidosAtuaisDia));
          row("Lucro líquido/dia", formatBRL(r.lucroLiquidoDiaEstimado));
          row("Cobertura Ads", (Math.round(r.coberturaPct * 10) / 10).toLocaleString("pt-BR") + "%");
        }
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinBreakevenAdsCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["bea-mp", "bea-gasto", "bea-contrib", "bea-pedidos", "bea-preco"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", render);
        node.addEventListener("change", render);
      }
    });
    render();
  }



  function normalizeRoiFreteGratisMarketplace(raw) {
    return normalizePrecoMinimoMarketplace(raw);
  }

  function roiFreteGratisMarketplaceLabel(id) {
    return precoMinimoAdsMarketplaceLabel(id);
  }

  function defaultTaxaRoiFreteGratis(marketplace) {
    return defaultTaxaPrecoMinimoAds(marketplace);
  }

  function badgeRoiFreteGratis(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.contribuicaoCom > 0)) return "VERMELHO";
    var delta = r.deltaLucro;
    if (delta !== delta) return "VERMELHO";
    if (delta < 0) return "VERMELHO";
    var base = Math.abs(r.lucroSem);
    if (!(base > 0)) base = 1;
    var near = Math.abs(delta) / base < 0.1;
    if (near) return "AMARELO";
    var lift = r.liftConversaoPct;
    var absurd =
      (lift != null && lift === lift && lift > 200) ||
      (r.conversaoComFreteGratis != null && r.conversaoComFreteGratis > 25);
    if (delta > 0 && absurd) return "AMARELO";
    if (delta > 0) return "VERDE";
    return "AMARELO";
  }

  function buildRoiFreteGratisAdvice(r) {
    var mp = roiFreteGratisMarketplaceLabel(r.marketplace);
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "No " +
      mp +
      ", sem frete grátis: contribuição " +
      formatBRL(r.contribuicaoSem) +
      "/pedido e lucro dia ~" +
      formatBRL(r.lucroSem) +
      ". Com frete grátis (absorve " +
      formatBRL(r.freteUnitario) +
      "): contribuição " +
      formatBRL(r.contribuicaoCom) +
      "/pedido e lucro dia ~" +
      formatBRL(r.lucroCom) +
      ". ";
    if (r.contribuicaoCom <= 0) {
      base +=
        "A contribuição com frete grátis fica ≤ 0 — absorver o frete come toda a margem. Não ofereça frete grátis nesse preço. ";
    } else if (r.deltaLucro > 0) {
      base +=
        "Delta de lucro +" +
        formatBRL(r.deltaLucro) +
        " — o lift de conversão (" +
        (Math.round(r.liftConversaoPct * 10) / 10) +
        "%) parece compensar o frete absorvido. ";
      if (r.badge === "AMARELO") {
        base += "Lift de conversão parece otimista demais — valide com teste A/B. ";
      }
    } else if (r.deltaLucro < 0) {
      base +=
        "Delta de lucro " +
        formatBRL(r.deltaLucro) +
        " — frete grátis piora o resultado com essas conversões. ";
      if (r.breakEvenConversaoCom != null) {
        base +=
          "Precisaria de ~" +
          (Math.round(r.breakEvenConversaoCom * 100) / 100) +
          "% de conversão com frete grátis para empatar. ";
      }
    } else {
      base += "Empate estimado — perto do break-even. ";
    }
    return base + "ESTIMATIVA.";
  }

  function joinRoiFreteGratisCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("ROI de frete grátis · Precifica");
    lines.push("Marketplace: " + roiFreteGratisMarketplaceLabel(r.marketplace || "ml"));
    if (r.ok) {
      lines.push("Preço: " + formatBRL(r.precoVenda));
      lines.push("Custo produto: " + formatBRL(r.custoProduto));
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "%");
      lines.push("Frete unitário absorvido: " + formatBRL(r.freteUnitario));
      lines.push("Visitas/dia: " + r.visitasDia);
      lines.push(
        "Conversão sem frete grátis: " +
          (Math.round(r.conversaoSemFreteGratis * 100) / 100) +
          "%"
      );
      lines.push(
        "Conversão com frete grátis: " +
          (Math.round(r.conversaoComFreteGratis * 100) / 100) +
          "%"
      );
      lines.push("Contribuição SEM: " + formatBRL(r.contribuicaoSem));
      lines.push("Contribuição COM: " + formatBRL(r.contribuicaoCom));
      lines.push("Pedidos SEM: " + (Math.round(r.pedidosSem * 1000) / 1000));
      lines.push("Pedidos COM: " + (Math.round(r.pedidosCom * 1000) / 1000));
      lines.push("Lucro dia SEM: " + formatBRL(r.lucroSem));
      lines.push("Lucro dia COM: " + formatBRL(r.lucroCom));
      lines.push("Delta lucro: " + formatBRL(r.deltaLucro));
      if (r.liftConversaoPct != null) {
        lines.push("Lift conversão: " + (Math.round(r.liftConversaoPct * 10) / 10) + "%");
      }
      if (r.breakEvenConversaoCom != null) {
        lines.push(
          "Break-even conversão COM: " +
            (Math.round(r.breakEvenConversaoCom * 100) / 100) +
            "%"
        );
      }
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — ROI de frete grátis no navegador; confirme conversão e frete real no Seller Center."
    );
    return lines.join("\n");
  }

  function calculateRoiFreteGratis(input) {
    input = input || {};
    var marketplace = normalizeRoiFreteGratisMarketplace(input.marketplace);
    var precoVenda = toNumber(input.precoVenda);
    var custoProduto = toNumber(input.custoProduto);
    var freteUnitario = toNumber(input.freteUnitario);
    var conversaoSemFreteGratis = toNumber(input.conversaoSemFreteGratis);
    var conversaoComFreteGratis = toNumber(input.conversaoComFreteGratis);

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = defaultTaxaRoiFreteGratis(marketplace);
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var visitasDia;
    if (input.visitasDia == null || input.visitasDia === "") {
      visitasDia = 100;
    } else {
      visitasDia = toNumber(input.visitasDia);
    }

    var disclaimer =
      "ESTIMATIVA — ROI de frete grátis no navegador; confirme conversão, frete real e taxas no Seller Center. Não é conselho fiscal.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        marketplace: marketplace,
        precoVenda: precoVenda,
        custoProduto: custoProduto,
        taxaMarketplacePct: taxaMarketplacePct,
        freteUnitario: freteUnitario,
        conversaoSemFreteGratis: conversaoSemFreteGratis,
        conversaoComFreteGratis: conversaoComFreteGratis,
        visitasDia: visitasDia,
        contribuicaoSem: null,
        contribuicaoCom: null,
        pedidosSem: null,
        pedidosCom: null,
        lucroSem: null,
        lucroCom: null,
        deltaLucro: null,
        liftConversaoPct: null,
        breakEvenConversaoCom: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinRoiFreteGratisCopy(f);
      return f;
    }

    if (!(precoVenda > 0) || precoVenda !== precoVenda) {
      return fail("Informe o preço de venda (R$) maior que zero.");
    }
    if (!(custoProduto >= 0) || custoProduto !== custoProduto) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(freteUnitario >= 0) || freteUnitario !== freteUnitario) {
      return fail("Informe o frete unitário a absorver (R$) ≥ 0.");
    }
    if (!(conversaoSemFreteGratis > 0) || conversaoSemFreteGratis !== conversaoSemFreteGratis) {
      return fail("Informe a conversão SEM frete grátis (%) maior que zero.");
    }
    if (!(conversaoComFreteGratis > 0) || conversaoComFreteGratis !== conversaoComFreteGratis) {
      return fail("Informe a conversão COM frete grátis (%) maior que zero.");
    }
    if (!(visitasDia > 0) || visitasDia !== visitasDia) {
      return fail("Informe as visitas/dia maior que zero (padrão 100).");
    }

    var taxaReais = precoVenda * (taxaMarketplacePct / 100);
    var contribuicaoSem = precoVenda - custoProduto - taxaReais;
    var contribuicaoCom = precoVenda - custoProduto - taxaReais - freteUnitario;

    var pedidosSem = visitasDia * (conversaoSemFreteGratis / 100);
    var pedidosCom = visitasDia * (conversaoComFreteGratis / 100);
    var lucroSem = pedidosSem * contribuicaoSem;
    var lucroCom = pedidosCom * contribuicaoCom;
    var deltaLucro = lucroCom - lucroSem;

    var liftConversaoPct = (conversaoComFreteGratis / conversaoSemFreteGratis - 1) * 100;

    var breakEvenConversaoCom = null;
    if (contribuicaoCom > 0 && visitasDia > 0) {
      var pedidosNeeded = lucroSem / contribuicaoCom;
      breakEvenConversaoCom = (pedidosNeeded / visitasDia) * 100;
      if (breakEvenConversaoCom < 0) breakEvenConversaoCom = 0;
    }

    var result = {
      ok: true,
      error: null,
      marketplace: marketplace,
      precoVenda: precoVenda,
      custoProduto: custoProduto,
      taxaMarketplacePct: taxaMarketplacePct,
      freteUnitario: freteUnitario,
      conversaoSemFreteGratis: conversaoSemFreteGratis,
      conversaoComFreteGratis: conversaoComFreteGratis,
      visitasDia: visitasDia,
      contribuicaoSem: contribuicaoSem,
      contribuicaoCom: contribuicaoCom,
      pedidosSem: pedidosSem,
      pedidosCom: pedidosCom,
      lucroSem: lucroSem,
      lucroCom: lucroCom,
      deltaLucro: deltaLucro,
      liftConversaoPct: liftConversaoPct,
      breakEvenConversaoCom: breakEvenConversaoCom,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeRoiFreteGratis(result);
    result.advice = buildRoiFreteGratisAdvice(result);
    result.copyText = joinRoiFreteGratisCopy(result);
    return result;
  }

  function mountRoiFreteGratis(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "roifretegratisgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "ROI de frete grátis · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Vale a pena oferecer frete grátis? Compare lucro com e sem absorver o frete."
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "rfg-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "amazon", label: "Amazon" },
          { value: "magalu", label: "Magalu" },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "rfg-preco",
        label: "Preço de venda (R$)",
        value: "100",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "rfg-custo",
        label: "Custo do produto (R$)",
        value: "40",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "rfg-taxa",
        label: "Taxa marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "rfg-frete",
        label: "Frete unitário a absorver (R$)",
        value: "12",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "rfg-conv-sem",
        label: "Conversão SEM frete grátis (%)",
        value: "2.5",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "rfg-conv-com",
        label: "Conversão COM frete grátis (%)",
        value: "4",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "rfg-visitas",
        label: "Visitas / dia (opcional)",
        value: "100",
        step: "1",
        min: "0",
        placeholder: "padrão 100"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "SEM: comprador paga frete (você não absorve). COM: você absorve o frete unitário e espera lift de conversão. Lucro dia = pedidos × contribuição. ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    var mpEl = document.getElementById("rfg-mp");
    var taxaEl = document.getElementById("rfg-taxa");
    if (mpEl && taxaEl) {
      mpEl.addEventListener("change", function () {
        taxaEl.value = String(defaultTaxaRoiFreteGratis(mpEl.value));
        render();
      });
    }

    function read() {
      var visitasRaw = document.getElementById("rfg-visitas").value;
      return {
        marketplace: document.getElementById("rfg-mp").value,
        precoVenda: document.getElementById("rfg-preco").value,
        custoProduto: document.getElementById("rfg-custo").value,
        taxaMarketplacePct: document.getElementById("rfg-taxa").value,
        freteUnitario: document.getElementById("rfg-frete").value,
        conversaoSemFreteGratis: document.getElementById("rfg-conv-sem").value,
        conversaoComFreteGratis: document.getElementById("rfg-conv-com").value,
        visitasDia: visitasRaw === "" ? undefined : visitasRaw
      };
    }

    function render() {
      var r = calculateRoiFreteGratis(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Delta lucro / dia · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var deltaLabel =
          (r.deltaLucro >= 0 ? "+" : "") + formatBRL(r.deltaLucro) + " / dia";
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            deltaLabel
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Marketplace", roiFreteGratisMarketplaceLabel(r.marketplace));
        row("Contribuição SEM", formatBRL(r.contribuicaoSem));
        row("Contribuição COM", formatBRL(r.contribuicaoCom));
        row("Pedidos SEM", (Math.round(r.pedidosSem * 100) / 100).toLocaleString("pt-BR"));
        row("Pedidos COM", (Math.round(r.pedidosCom * 100) / 100).toLocaleString("pt-BR"));
        row("Lucro dia SEM", formatBRL(r.lucroSem));
        row("Lucro dia COM", formatBRL(r.lucroCom));
        row(
          "Lift conversão",
          (Math.round(r.liftConversaoPct * 10) / 10).toLocaleString("pt-BR") + "%"
        );
        if (r.breakEvenConversaoCom != null) {
          row(
            "Break-even conv. COM",
            (Math.round(r.breakEvenConversaoCom * 100) / 100).toLocaleString("pt-BR") + "%"
          );
        }
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinRoiFreteGratisCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["rfg-mp", "rfg-preco", "rfg-custo", "rfg-taxa", "rfg-frete", "rfg-conv-sem", "rfg-conv-com", "rfg-visitas"].forEach(
      function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.addEventListener("input", render);
          node.addEventListener("change", render);
        }
      }
    );
    render();
  }




  function normalizeDescontoMaximoMarketplace(raw) {
    return normalizePrecoMinimoMarketplace(raw);
  }

  function descontoMaximoMarketplaceLabel(id) {
    return precoMinimoAdsMarketplaceLabel(id);
  }

  function defaultTaxaDescontoMaximo(marketplace) {
    return defaultTaxaPrecoMinimoAds(marketplace);
  }

  function badgeDescontoMaximo(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.descontoMaxReais > 0)) return "VERMELHO";
    if (!(r.margemAtualPct > r.margemMinimaPct)) {
      if (r.margemAtualPct < r.margemMinimaPct) return "VERMELHO";
      return "AMARELO";
    }
    if (r.descontoMaxPct >= 5 && r.margemAtualPct > r.margemMinimaPct) return "VERDE";
    if (r.descontoMaxPct > 0 && r.descontoMaxPct < 5) return "AMARELO";
    return "AMARELO";
  }

  function buildDescontoMaximoAdvice(r) {
    var mp = descontoMaximoMarketplaceLabel(r.marketplace);
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "No " +
      mp +
      ", preço atual " +
      formatBRL(r.precoAtual) +
      " tem margem ~" +
      (Math.round(r.margemAtualPct * 10) / 10) +
      "% (contribuição " +
      formatBRL(r.contribuicaoAtual) +
      "). Preço mínimo para " +
      (Math.round(r.margemMinimaPct * 10) / 10) +
      "% de margem: " +
      formatBRL(r.precoMinimo) +
      ". ";
    if (r.descontoMaxReais <= 0) {
      base +=
        "Sem folga para desconto — já está no (ou abaixo do) piso da margem mínima. Suba o preço ou corte custo/taxa/ads. ";
    } else if (r.descontoMaxPct >= 5) {
      base +=
        "Desconto máximo sem prejuízo: " +
        (Math.round(r.descontoMaxPct * 10) / 10) +
        "% (" +
        formatBRL(r.descontoMaxReais) +
        "). Dá para promover com margem mínima preservada. ";
    } else {
      base +=
        "Folga pequena: no máximo " +
        (Math.round(r.descontoMaxPct * 10) / 10) +
        "% (" +
        formatBRL(r.descontoMaxReais) +
        "). Perto do piso — promoção agressiva pode ir para o vermelho. ";
    }
    return base + "ESTIMATIVA.";
  }

  function joinDescontoMaximoCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Desconto máximo sem prejuízo · Precifica");
    lines.push("Marketplace: " + descontoMaximoMarketplaceLabel(r.marketplace || "ml"));
    if (r.ok) {
      lines.push("Preço atual: " + formatBRL(r.precoAtual));
      lines.push("Custo produto: " + formatBRL(r.custoProduto));
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "%");
      lines.push("Frete absorvido: " + formatBRL(r.freteAbsorvido));
      lines.push("Custo Ads unitário: " + formatBRL(r.custoAdsUnitario));
      lines.push("Margem mínima alvo: " + (Math.round(r.margemMinimaPct * 100) / 100) + "%");
      lines.push("Custos fixos unit.: " + formatBRL(r.custosFixosUnit));
      lines.push("Preço mínimo: " + formatBRL(r.precoMinimo));
      lines.push("Desconto máx. R$: " + formatBRL(r.descontoMaxReais));
      lines.push("Desconto máx. %: " + (Math.round(r.descontoMaxPct * 10) / 10) + "%");
      lines.push("Contribuição atual: " + formatBRL(r.contribuicaoAtual));
      lines.push("Margem atual: " + (Math.round(r.margemAtualPct * 10) / 10) + "%");
      lines.push("Contribuição no piso: " + formatBRL(r.contribuicaoMin));
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — desconto máximo sem prejuízo no navegador; confirme taxas e custos reais no Seller Center."
    );
    return lines.join("\n");
  }

  function calculateDescontoMaximo(input) {
    input = input || {};
    var marketplace = normalizeDescontoMaximoMarketplace(input.marketplace);
    var precoAtual = toNumber(input.precoAtual);
    var custoProduto = toNumber(input.custoProduto);

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = defaultTaxaDescontoMaximo(marketplace);
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var freteAbsorvido;
    if (input.freteAbsorvido == null || input.freteAbsorvido === "") {
      freteAbsorvido = 0;
    } else {
      freteAbsorvido = toNumber(input.freteAbsorvido);
    }

    var custoAdsUnitario;
    if (input.custoAdsUnitario == null || input.custoAdsUnitario === "") {
      custoAdsUnitario = 0;
    } else {
      custoAdsUnitario = toNumber(input.custoAdsUnitario);
    }

    var margemMinimaPct;
    if (input.margemMinimaPct == null || input.margemMinimaPct === "") {
      margemMinimaPct = 10;
    } else {
      margemMinimaPct = toNumber(input.margemMinimaPct);
    }

    var disclaimer =
      "ESTIMATIVA — desconto máximo sem prejuízo no navegador; confirme taxas, frete e ads reais no Seller Center. Não é conselho fiscal.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        marketplace: marketplace,
        precoAtual: precoAtual,
        custoProduto: custoProduto,
        taxaMarketplacePct: taxaMarketplacePct,
        freteAbsorvido: freteAbsorvido,
        custoAdsUnitario: custoAdsUnitario,
        margemMinimaPct: margemMinimaPct,
        custosFixosUnit: null,
        precoMinimo: null,
        descontoMaxReais: null,
        descontoMaxPct: null,
        contribuicaoAtual: null,
        margemAtualPct: null,
        contribuicaoMin: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinDescontoMaximoCopy(f);
      return f;
    }

    if (!(precoAtual > 0) || precoAtual !== precoAtual) {
      return fail("Informe o preço atual de venda (R$) maior que zero.");
    }
    if (!(custoProduto >= 0) || custoProduto !== custoProduto) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(freteAbsorvido >= 0) || freteAbsorvido !== freteAbsorvido) {
      return fail("Informe o frete absorvido (R$) ≥ 0.");
    }
    if (!(custoAdsUnitario >= 0) || custoAdsUnitario !== custoAdsUnitario) {
      return fail("Informe o custo de Ads unitário (R$) ≥ 0.");
    }
    if (!(margemMinimaPct >= 0) || margemMinimaPct !== margemMinimaPct) {
      return fail("Informe a margem mínima (%) ≥ 0.");
    }

    var t = taxaMarketplacePct / 100;
    var m = margemMinimaPct / 100;
    var denom = 1 - t - m;
    if (!(denom > 0)) {
      return fail(
        "Taxa + margem mínima ≥ 100% — impossível precificar com essa combinação. Reduza taxa ou margem alvo."
      );
    }

    var custosFixosUnit = custoProduto + freteAbsorvido + custoAdsUnitario;
    var precoMinimo = custosFixosUnit / denom;

    var taxaAtual = precoAtual * t;
    var contribuicaoAtual = precoAtual - taxaAtual - custosFixosUnit;
    var margemAtualPct = (contribuicaoAtual / precoAtual) * 100;

    var taxaMin = precoMinimo * t;
    var contribuicaoMin = precoMinimo - taxaMin - custosFixosUnit;

    var descontoMaxReais = Math.max(0, precoAtual - precoMinimo);
    var descontoMaxPct = precoAtual > 0 ? (descontoMaxReais / precoAtual) * 100 : 0;

    var result = {
      ok: true,
      error: null,
      marketplace: marketplace,
      precoAtual: precoAtual,
      custoProduto: custoProduto,
      taxaMarketplacePct: taxaMarketplacePct,
      freteAbsorvido: freteAbsorvido,
      custoAdsUnitario: custoAdsUnitario,
      margemMinimaPct: margemMinimaPct,
      custosFixosUnit: custosFixosUnit,
      precoMinimo: precoMinimo,
      descontoMaxReais: descontoMaxReais,
      descontoMaxPct: descontoMaxPct,
      contribuicaoAtual: contribuicaoAtual,
      margemAtualPct: margemAtualPct,
      contribuicaoMin: contribuicaoMin,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeDescontoMaximo(result);
    result.advice = buildDescontoMaximoAdvice(result);
    result.copyText = joinDescontoMaximoCopy(result);
    return result;
  }

  function mountDescontoMaximo(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "descontomaximogen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Desconto máximo sem prejuízo · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Qual o maior desconto (%) e em R$ que posso dar sem ficar no vermelho?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "dmx-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "amazon", label: "Amazon" },
          { value: "magalu", label: "Magalu" },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "dmx-preco",
        label: "Preço atual de venda (R$)",
        value: "100",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "dmx-custo",
        label: "Custo do produto (R$)",
        value: "40",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "dmx-taxa",
        label: "Taxa marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "dmx-frete",
        label: "Frete absorvido (R$)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    fields.appendChild(
      field({
        id: "dmx-ads",
        label: "Custo Ads unitário (R$)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    fields.appendChild(
      field({
        id: "dmx-margem",
        label: "Margem mínima desejada (%)",
        value: "10",
        step: "0.01",
        min: "0"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Preço mínimo = (custo + frete + ads) ÷ (1 − taxa% − margem%). Desconto máx. = preço atual − preço mínimo. ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    var mpEl = document.getElementById("dmx-mp");
    var taxaEl = document.getElementById("dmx-taxa");
    if (mpEl && taxaEl) {
      mpEl.addEventListener("change", function () {
        taxaEl.value = String(defaultTaxaDescontoMaximo(mpEl.value));
        render();
      });
    }

    function read() {
      var freteRaw = document.getElementById("dmx-frete").value;
      var adsRaw = document.getElementById("dmx-ads").value;
      var margemRaw = document.getElementById("dmx-margem").value;
      return {
        marketplace: document.getElementById("dmx-mp").value,
        precoAtual: document.getElementById("dmx-preco").value,
        custoProduto: document.getElementById("dmx-custo").value,
        taxaMarketplacePct: document.getElementById("dmx-taxa").value,
        freteAbsorvido: freteRaw === "" ? undefined : freteRaw,
        custoAdsUnitario: adsRaw === "" ? undefined : adsRaw,
        margemMinimaPct: margemRaw === "" ? undefined : margemRaw
      };
    }

    function render() {
      var r = calculateDescontoMaximo(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Desconto máximo · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          (Math.round(r.descontoMaxPct * 10) / 10).toLocaleString("pt-BR") +
          "% · " +
          formatBRL(r.descontoMaxReais);
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Marketplace", descontoMaximoMarketplaceLabel(r.marketplace));
        row("Preço mínimo", formatBRL(r.precoMinimo));
        row("Desconto máx. R$", formatBRL(r.descontoMaxReais));
        row(
          "Desconto máx. %",
          (Math.round(r.descontoMaxPct * 10) / 10).toLocaleString("pt-BR") + "%"
        );
        row("Margem atual", (Math.round(r.margemAtualPct * 10) / 10).toLocaleString("pt-BR") + "%");
        row("Contribuição atual", formatBRL(r.contribuicaoAtual));
        row("Contribuição no piso", formatBRL(r.contribuicaoMin));
        row("Custos fixos unit.", formatBRL(r.custosFixosUnit));
        row(
          "Margem mínima alvo",
          (Math.round(r.margemMinimaPct * 10) / 10).toLocaleString("pt-BR") + "%"
        );
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinDescontoMaximoCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["dmx-mp", "dmx-preco", "dmx-custo", "dmx-taxa", "dmx-frete", "dmx-ads", "dmx-margem"].forEach(
      function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.addEventListener("input", render);
          node.addEventListener("change", render);
        }
      }
    );
    render();
  }



  function normalizeMetaLucroMarketplace(raw) {
    return normalizePrecoMinimoMarketplace(raw);
  }

  function metaLucroMarketplaceLabel(id) {
    return precoMinimoAdsMarketplaceLabel(id);
  }

  function defaultTaxaMetaLucro(marketplace) {
    return defaultTaxaDescontoMaximo(marketplace);
  }

  function badgeMetaLucro(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.contribuicaoUnit > 0)) return "VERMELHO";
    var d = r.pedidosPorDia;
    if (!(d === d) || d == null) return "VERMELHO";
    if (d <= 5) return "VERDE";
    if (d <= 20) return "AMARELO";
    return "VERMELHO";
  }

  function buildMetaLucroAdvice(r) {
    var mp = metaLucroMarketplaceLabel(r.marketplace);
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "No " +
      mp +
      ", contribuição unitária " +
      formatBRL(r.contribuicaoUnit) +
      " (~" +
      (Math.round(r.margemUnitPct * 10) / 10) +
      "%). Para meta de " +
      formatBRL(r.metaLucroMensal) +
      (r.custosFixosMensais > 0
        ? " + custos fixos " + formatBRL(r.custosFixosMensais)
        : "") +
      " você precisa de ~" +
      r.pedidosNecessarios +
      " pedidos/mês (~" +
      (Math.round(r.pedidosPorDia * 10) / 10) +
      "/dia). ";
    if (r.badge === "VERDE") {
      base += "Meta alcançável com volume baixo — foque em converter bem o anúncio. ";
    } else if (r.badge === "AMARELO") {
      base +=
        "Volume moderado: revise Ads, preço ou custo para reduzir os pedidos necessários. ";
    } else {
      base +=
        "Volume alto (>20/dia) — suba contribuição (preço/custo/taxa/ads) ou baixe a meta. ";
    }
    return base + "ESTIMATIVA — não é conselho fiscal.";
  }

  function joinMetaLucroCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Meta de lucro mensal · Precifica");
    lines.push("Marketplace: " + metaLucroMarketplaceLabel(r.marketplace || "ml"));
    if (r.ok) {
      lines.push("Meta lucro mensal: " + formatBRL(r.metaLucroMensal));
      lines.push("Preço de venda: " + formatBRL(r.precoVenda));
      lines.push("Custo produto: " + formatBRL(r.custoProduto));
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "%");
      lines.push("Frete absorvido: " + formatBRL(r.freteAbsorvido));
      lines.push("Custo Ads unitário: " + formatBRL(r.custoAdsUnitario));
      lines.push("Custos fixos mensais: " + formatBRL(r.custosFixosMensais));
      lines.push("Contribuição unitária: " + formatBRL(r.contribuicaoUnit));
      lines.push("Margem unitária: " + (Math.round(r.margemUnitPct * 10) / 10) + "%");
      lines.push("Lucro necessário: " + formatBRL(r.lucroNecessario));
      lines.push("Pedidos necessários/mês: " + r.pedidosNecessarios);
      lines.push("Pedidos/dia (÷30): " + (Math.round(r.pedidosPorDia * 100) / 100));
      lines.push("Receita bruta necessária: " + formatBRL(r.receitaBrutaNecessaria));
      lines.push("Lucro estimado: " + formatBRL(r.lucroEstimado));
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — meta de lucro mensal no navegador; confirme taxas e custos reais. Não é conselho fiscal."
    );
    return lines.join("\n");
  }

  function calculateMetaLucro(input) {
    input = input || {};
    var marketplace = normalizeMetaLucroMarketplace(input.marketplace);
    var metaLucroMensal = toNumber(input.metaLucroMensal);
    var precoVenda = toNumber(input.precoVenda);
    var custoProduto = toNumber(input.custoProduto);

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = defaultTaxaMetaLucro(marketplace);
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var freteAbsorvido;
    if (input.freteAbsorvido == null || input.freteAbsorvido === "") {
      freteAbsorvido = 0;
    } else {
      freteAbsorvido = toNumber(input.freteAbsorvido);
    }

    var custoAdsUnitario;
    if (input.custoAdsUnitario == null || input.custoAdsUnitario === "") {
      custoAdsUnitario = 0;
    } else {
      custoAdsUnitario = toNumber(input.custoAdsUnitario);
    }

    var custosFixosMensais;
    if (input.custosFixosMensais == null || input.custosFixosMensais === "") {
      custosFixosMensais = 0;
    } else {
      custosFixosMensais = toNumber(input.custosFixosMensais);
    }

    var disclaimer =
      "ESTIMATIVA — meta de lucro mensal no navegador; confirme taxas, frete e ads reais no Seller Center. Não é conselho fiscal.";

    function fail(msg, extra) {
      extra = extra || {};
      var f = {
        ok: false,
        error: msg,
        marketplace: marketplace,
        metaLucroMensal: metaLucroMensal,
        precoVenda: precoVenda,
        custoProduto: custoProduto,
        taxaMarketplacePct: taxaMarketplacePct,
        freteAbsorvido: freteAbsorvido,
        custoAdsUnitario: custoAdsUnitario,
        custosFixosMensais: custosFixosMensais,
        contribuicaoUnit: extra.contribuicaoUnit != null ? extra.contribuicaoUnit : null,
        lucroNecessario: extra.lucroNecessario != null ? extra.lucroNecessario : null,
        pedidosNecessarios: null,
        receitaBrutaNecessaria: null,
        lucroEstimado: null,
        pedidosPorDia: null,
        margemUnitPct: extra.margemUnitPct != null ? extra.margemUnitPct : null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinMetaLucroCopy(f);
      return f;
    }

    if (!(metaLucroMensal > 0) || metaLucroMensal !== metaLucroMensal) {
      return fail("Informe a meta de lucro mensal (R$) maior que zero.");
    }
    if (!(precoVenda > 0) || precoVenda !== precoVenda) {
      return fail("Informe o preço de venda (R$) maior que zero.");
    }
    if (!(custoProduto >= 0) || custoProduto !== custoProduto) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(freteAbsorvido >= 0) || freteAbsorvido !== freteAbsorvido) {
      return fail("Informe o frete absorvido (R$) ≥ 0.");
    }
    if (!(custoAdsUnitario >= 0) || custoAdsUnitario !== custoAdsUnitario) {
      return fail("Informe o custo de Ads unitário (R$) ≥ 0.");
    }
    if (!(custosFixosMensais >= 0) || custosFixosMensais !== custosFixosMensais) {
      return fail("Informe os custos fixos mensais (R$) ≥ 0.");
    }

    var contribuicaoUnit =
      precoVenda -
      precoVenda * (taxaMarketplacePct / 100) -
      custoProduto -
      freteAbsorvido -
      custoAdsUnitario;
    var lucroNecessario = metaLucroMensal + custosFixosMensais;
    var margemUnitPct = precoVenda > 0 ? (contribuicaoUnit / precoVenda) * 100 : 0;

    if (!(contribuicaoUnit > 0)) {
      return fail(
        "Contribuição unitária negativa ou zero — preço não cobre taxa + custo + frete + Ads. Suba o preço ou corte custos.",
        { contribuicaoUnit: contribuicaoUnit, lucroNecessario: lucroNecessario, margemUnitPct: margemUnitPct }
      );
    }

    var pedidosNecessarios = Math.ceil(lucroNecessario / contribuicaoUnit);
    var receitaBrutaNecessaria = pedidosNecessarios * precoVenda;
    var lucroEstimado = pedidosNecessarios * contribuicaoUnit - custosFixosMensais;
    var pedidosPorDia = pedidosNecessarios / 30;

    var result = {
      ok: true,
      error: null,
      marketplace: marketplace,
      metaLucroMensal: metaLucroMensal,
      precoVenda: precoVenda,
      custoProduto: custoProduto,
      taxaMarketplacePct: taxaMarketplacePct,
      freteAbsorvido: freteAbsorvido,
      custoAdsUnitario: custoAdsUnitario,
      custosFixosMensais: custosFixosMensais,
      contribuicaoUnit: contribuicaoUnit,
      lucroNecessario: lucroNecessario,
      pedidosNecessarios: pedidosNecessarios,
      receitaBrutaNecessaria: receitaBrutaNecessaria,
      lucroEstimado: lucroEstimado,
      pedidosPorDia: pedidosPorDia,
      margemUnitPct: margemUnitPct,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeMetaLucro(result);
    result.advice = buildMetaLucroAdvice(result);
    result.copyText = joinMetaLucroCopy(result);
    return result;
  }

  function mountMetaLucro(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "metalucrogen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Meta de lucro mensal · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quantos pedidos por mês preciso para bater minha meta de lucro?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "mlu-mp",
        type: "select",
        label: "Marketplace",
        options: [
          { value: "ml", label: "Mercado Livre", selected: true },
          { value: "amazon", label: "Amazon" },
          { value: "magalu", label: "Magalu" },
          { value: "shopee", label: "Shopee" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "mlu-meta",
        label: "Meta de lucro mensal (R$)",
        value: "3000",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "mlu-preco",
        label: "Preço de venda (R$)",
        value: "100",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "mlu-custo",
        label: "Custo do produto (R$)",
        value: "40",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "mlu-taxa",
        label: "Taxa marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "mlu-frete",
        label: "Frete absorvido (R$)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    fields.appendChild(
      field({
        id: "mlu-ads",
        label: "Custo Ads unitário (R$)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    fields.appendChild(
      field({
        id: "mlu-fixos",
        label: "Custos fixos mensais (R$)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "aluguel, software… padrão 0"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Contribuição = preço − taxa − custo − frete − Ads. Pedidos = ceil((meta + fixos) ÷ contribuição). ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    var mpEl = document.getElementById("mlu-mp");
    var taxaEl = document.getElementById("mlu-taxa");
    if (mpEl && taxaEl) {
      mpEl.addEventListener("change", function () {
        taxaEl.value = String(defaultTaxaMetaLucro(mpEl.value));
        render();
      });
    }

    function read() {
      var freteRaw = document.getElementById("mlu-frete").value;
      var adsRaw = document.getElementById("mlu-ads").value;
      var fixosRaw = document.getElementById("mlu-fixos").value;
      var taxaRaw = document.getElementById("mlu-taxa").value;
      return {
        marketplace: document.getElementById("mlu-mp").value,
        metaLucroMensal: document.getElementById("mlu-meta").value,
        precoVenda: document.getElementById("mlu-preco").value,
        custoProduto: document.getElementById("mlu-custo").value,
        taxaMarketplacePct: taxaRaw === "" ? undefined : taxaRaw,
        freteAbsorvido: freteRaw === "" ? undefined : freteRaw,
        custoAdsUnitario: adsRaw === "" ? undefined : adsRaw,
        custosFixosMensais: fixosRaw === "" ? undefined : fixosRaw
      };
    }

    function render() {
      var r = calculateMetaLucro(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Meta de lucro · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          r.pedidosNecessarios.toLocaleString("pt-BR") +
          " pedidos/mês · ~" +
          (Math.round(r.pedidosPorDia * 10) / 10).toLocaleString("pt-BR") +
          "/dia";
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Marketplace", metaLucroMarketplaceLabel(r.marketplace));
        row("Contribuição unitária", formatBRL(r.contribuicaoUnit));
        row(
          "Margem unitária",
          (Math.round(r.margemUnitPct * 10) / 10).toLocaleString("pt-BR") + "%"
        );
        row("Lucro necessário", formatBRL(r.lucroNecessario));
        row("Pedidos/mês", String(r.pedidosNecessarios));
        row(
          "Pedidos/dia",
          (Math.round(r.pedidosPorDia * 100) / 100).toLocaleString("pt-BR")
        );
        row("Receita bruta necessária", formatBRL(r.receitaBrutaNecessaria));
        row("Lucro estimado", formatBRL(r.lucroEstimado));
        row("Custos fixos mensais", formatBRL(r.custosFixosMensais));
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinMetaLucroCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["mlu-mp", "mlu-meta", "mlu-preco", "mlu-custo", "mlu-taxa", "mlu-frete", "mlu-ads", "mlu-fixos"].forEach(
      function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.addEventListener("input", render);
          node.addEventListener("change", render);
        }
      }
    );
    render();
  }







  function badgeEstoqueMinimo(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (r.precisaComprarAgora) return "VERMELHO";
    var dias = r.diasAteRuptura;
    var lead = r.leadTimeDias;
    var cob = r.coberturaSegurancaDias;
    if (dias != null && dias === dias && lead != null && dias < lead) return "VERMELHO";
    var rop = r.pontoPedido;
    var atual = r.estoqueAtual;
    var alvo = r.estoqueAlvo;
    if (atual != null && rop != null && rop > 0 && atual > rop && atual <= rop * 1.2) {
      return "AMARELO";
    }
    if (
      dias != null &&
      dias === dias &&
      lead != null &&
      cob != null &&
      dias < lead + cob
    ) {
      return "AMARELO";
    }
    if (alvo != null && atual != null && atual >= alvo) return "VERDE";
    if (rop != null && atual != null && atual > rop * 1.2) return "VERDE";
    return "AMARELO";
  }

  function buildEstoqueMinimoAdvice(r) {
    if (!r.ok) return r.error || "Dados incompletos.";
    var base = "";
    if (r.precisaComprarAgora) {
      base =
        "Compre agora: estoque atual (" +
        r.estoqueAtual +
        ") ≤ ponto de pedido (" +
        r.pontoPedido +
        "). Sugestão: " +
        (Math.round(r.qtdSugeridaCompra * 10) / 10) +
        " un. para chegar ao alvo (" +
        (Math.round(r.estoqueAlvo * 10) / 10) +
        "). ";
    } else if (r.badge === "AMARELO") {
      base =
        "Atenção: estoque perto do ponto de pedido. Planeje a reposição antes da ruptura (~" +
        (Math.round(r.diasAteRuptura * 10) / 10) +
        " dias). ";
    } else {
      base =
        "Estoque confortável acima do alvo. Próximo pedido quando cair a " +
        r.pontoPedido +
        " un. ";
    }
    if (r.custoCapitalMensal != null && r.custoCapitalMensal === r.custoCapitalMensal) {
      base +=
        "Capital no alvo: " +
        formatBRL(r.capitalTravado) +
        " (~" +
        formatBRL(r.custoCapitalMensal) +
        "/mês de custo de capital). ";
    }
    return base + "ESTIMATIVA — não é conselho financeiro.";
  }

  function joinEstoqueMinimoCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Estoque mínimo / ponto de pedido · Precifica");
    if (r.ok) {
      lines.push("Vendas/dia: " + r.vendasPorDia);
      lines.push("Lead time (dias): " + r.leadTimeDias);
      lines.push("Cobertura segurança (dias): " + r.coberturaSegurancaDias);
      lines.push("Estoque atual: " + r.estoqueAtual);
      lines.push("Custo unitário: " + formatBRL(r.custoUnitario));
      if (r.precoVenda != null && r.precoVenda === r.precoVenda && r.precoVenda > 0) {
        lines.push("Preço de venda: " + formatBRL(r.precoVenda));
      }
      lines.push("Taxa capital mensal: " + (Math.round(r.taxaCapitalMensalPct * 100) / 100) + "%");
      lines.push("Demanda no lead time: " + (Math.round(r.demandaLead * 100) / 100));
      lines.push("Estoque de segurança: " + (Math.round(r.estoqueSeguranca * 100) / 100));
      lines.push("Ponto de pedido (ROP): " + r.pontoPedido);
      lines.push("Estoque mínimo sugerido: " + r.estoqueMinimoSugerido);
      lines.push("Estoque alvo: " + (Math.round(r.estoqueAlvo * 100) / 100));
      lines.push(
        "Dias até ruptura: " +
          (r.diasAteRuptura == null ? "—" : Math.round(r.diasAteRuptura * 100) / 100)
      );
      lines.push("Precisa comprar agora: " + (r.precisaComprarAgora ? "sim" : "não"));
      lines.push("Qtd sugerida compra: " + (Math.round(r.qtdSugeridaCompra * 100) / 100));
      lines.push("Capital travado (alvo): " + formatBRL(r.capitalTravado));
      lines.push("Custo capital mensal: " + formatBRL(r.custoCapitalMensal));
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — estoque mínimo / ponto de pedido no navegador; confirme lead time e demanda reais. Não é conselho financeiro."
    );
    return lines.join("\n");
  }

  function calculateEstoqueMinimo(input) {
    input = input || {};
    var vendasPorDia = toNumber(input.vendasPorDia);
    var leadTimeDias = toNumber(input.leadTimeDias);
    var coberturaSegurancaDias;
    if (input.coberturaSegurancaDias == null || input.coberturaSegurancaDias === "") {
      coberturaSegurancaDias = 7;
    } else {
      coberturaSegurancaDias = toNumber(input.coberturaSegurancaDias);
    }
    var estoqueAtual = toNumber(input.estoqueAtual);
    var custoUnitario = toNumber(input.custoUnitario);
    var precoVenda;
    if (input.precoVenda == null || input.precoVenda === "") {
      precoVenda = null;
    } else {
      precoVenda = toNumber(input.precoVenda);
    }
    var taxaCapitalMensalPct;
    if (input.taxaCapitalMensalPct == null || input.taxaCapitalMensalPct === "") {
      taxaCapitalMensalPct = 1;
    } else {
      taxaCapitalMensalPct = toNumber(input.taxaCapitalMensalPct);
    }

    var disclaimer =
      "ESTIMATIVA — estoque mínimo / ponto de pedido no navegador; confirme lead time, MOQ e demanda reais com o fornecedor. Não é conselho financeiro.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        vendasPorDia: vendasPorDia,
        leadTimeDias: leadTimeDias,
        coberturaSegurancaDias: coberturaSegurancaDias,
        estoqueAtual: estoqueAtual,
        custoUnitario: custoUnitario,
        precoVenda: precoVenda,
        taxaCapitalMensalPct: taxaCapitalMensalPct,
        demandaLead: null,
        estoqueSeguranca: null,
        pontoPedido: null,
        estoqueMinimoSugerido: null,
        estoqueAlvo: null,
        diasAteRuptura: null,
        precisaComprarAgora: null,
        qtdSugeridaCompra: null,
        capitalTravado: null,
        custoCapitalMensal: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinEstoqueMinimoCopy(f);
      return f;
    }

    if (!(vendasPorDia > 0) || vendasPorDia !== vendasPorDia) {
      return fail("Informe as vendas por dia (unidades) maiores que zero.");
    }
    if (!(leadTimeDias >= 0) || leadTimeDias !== leadTimeDias) {
      return fail("Informe o lead time (dias) ≥ 0.");
    }
    if (!(coberturaSegurancaDias >= 0) || coberturaSegurancaDias !== coberturaSegurancaDias) {
      return fail("Informe a cobertura de segurança (dias) ≥ 0.");
    }
    if (!(estoqueAtual >= 0) || estoqueAtual !== estoqueAtual) {
      return fail("Informe o estoque atual (unidades) ≥ 0.");
    }
    if (!(custoUnitario >= 0) || custoUnitario !== custoUnitario) {
      return fail("Informe o custo unitário (R$) ≥ 0.");
    }
    if (precoVenda != null && (!(precoVenda >= 0) || precoVenda !== precoVenda)) {
      return fail("Informe o preço de venda (R$) ≥ 0, ou deixe em branco.");
    }
    if (!(taxaCapitalMensalPct >= 0) || taxaCapitalMensalPct !== taxaCapitalMensalPct) {
      return fail("Informe a taxa de capital mensal (%) ≥ 0.");
    }

    var demandaLead = vendasPorDia * leadTimeDias;
    var estoqueSeguranca = vendasPorDia * coberturaSegurancaDias;
    var pontoPedido = Math.ceil(demandaLead + estoqueSeguranca);
    var estoqueMinimoSugerido = pontoPedido;
    var estoqueAlvo = pontoPedido + demandaLead;
    var diasAteRuptura = vendasPorDia > 0 ? estoqueAtual / vendasPorDia : null;
    var precisaComprarAgora = estoqueAtual <= pontoPedido;
    var qtdSugeridaCompra = Math.max(0, estoqueAlvo - estoqueAtual);
    var capitalTravado = estoqueAlvo * custoUnitario;
    var custoCapitalMensal = capitalTravado * (taxaCapitalMensalPct / 100);

    var result = {
      ok: true,
      error: null,
      vendasPorDia: vendasPorDia,
      leadTimeDias: leadTimeDias,
      coberturaSegurancaDias: coberturaSegurancaDias,
      estoqueAtual: estoqueAtual,
      custoUnitario: custoUnitario,
      precoVenda: precoVenda,
      taxaCapitalMensalPct: taxaCapitalMensalPct,
      demandaLead: demandaLead,
      estoqueSeguranca: estoqueSeguranca,
      pontoPedido: pontoPedido,
      estoqueMinimoSugerido: estoqueMinimoSugerido,
      estoqueAlvo: estoqueAlvo,
      diasAteRuptura: diasAteRuptura,
      precisaComprarAgora: precisaComprarAgora,
      qtdSugeridaCompra: qtdSugeridaCompra,
      capitalTravado: capitalTravado,
      custoCapitalMensal: custoCapitalMensal,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeEstoqueMinimo(result);
    result.advice = buildEstoqueMinimoAdvice(result);
    result.copyText = joinEstoqueMinimoCopy(result);
    return result;
  }

  function mountEstoqueMinimo(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "estoquegen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Estoque mínimo · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quantas unidades manter e quando pedir reposição?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "est-vendas",
        label: "Vendas por dia (unidades)",
        value: "10",
        step: "0.1",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "est-lead",
        label: "Lead time fornecedor (dias)",
        value: "5",
        step: "1",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "est-cob",
        label: "Cobertura de segurança (dias)",
        value: "7",
        step: "1",
        min: "0",
        placeholder: "padrão 7"
      })
    );
    fields.appendChild(
      field({
        id: "est-atual",
        label: "Estoque atual (unidades)",
        value: "150",
        step: "1",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "est-custo",
        label: "Custo unitário (R$)",
        value: "25",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "est-preco",
        label: "Preço de venda (R$) — opcional",
        value: "",
        step: "0.01",
        min: "0",
        placeholder: "opcional"
      })
    );
    fields.appendChild(
      field({
        id: "est-taxa",
        label: "Taxa de capital mensal (%)",
        value: "1",
        step: "0.01",
        min: "0",
        placeholder: "padrão 1%"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "ROP = ceil(vendas×lead + vendas×segurança). Alvo = ROP + demanda no lead. ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function read() {
      var cobRaw = document.getElementById("est-cob").value;
      var taxaRaw = document.getElementById("est-taxa").value;
      var precoRaw = document.getElementById("est-preco").value;
      return {
        vendasPorDia: document.getElementById("est-vendas").value,
        leadTimeDias: document.getElementById("est-lead").value,
        coberturaSegurancaDias: cobRaw === "" ? undefined : cobRaw,
        estoqueAtual: document.getElementById("est-atual").value,
        custoUnitario: document.getElementById("est-custo").value,
        precoVenda: precoRaw === "" ? undefined : precoRaw,
        taxaCapitalMensalPct: taxaRaw === "" ? undefined : taxaRaw
      };
    }

    function render() {
      var r = calculateEstoqueMinimo(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Estoque mínimo · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          "ROP " +
          r.pontoPedido.toLocaleString("pt-BR") +
          " un. · alvo " +
          (Math.round(r.estoqueAlvo * 10) / 10).toLocaleString("pt-BR");
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Demanda no lead time", (Math.round(r.demandaLead * 100) / 100).toLocaleString("pt-BR"));
        row("Estoque de segurança", (Math.round(r.estoqueSeguranca * 100) / 100).toLocaleString("pt-BR"));
        row("Ponto de pedido", String(r.pontoPedido));
        row("Estoque mínimo sugerido", String(r.estoqueMinimoSugerido));
        row("Estoque alvo", (Math.round(r.estoqueAlvo * 100) / 100).toLocaleString("pt-BR"));
        row(
          "Dias até ruptura",
          r.diasAteRuptura == null
            ? "—"
            : (Math.round(r.diasAteRuptura * 100) / 100).toLocaleString("pt-BR")
        );
        row("Precisa comprar agora", r.precisaComprarAgora ? "Sim" : "Não");
        row(
          "Qtd sugerida compra",
          (Math.round(r.qtdSugeridaCompra * 100) / 100).toLocaleString("pt-BR")
        );
        row("Capital travado (alvo)", formatBRL(r.capitalTravado));
        row("Custo capital / mês", formatBRL(r.custoCapitalMensal));
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinEstoqueMinimoCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["est-vendas", "est-lead", "est-cob", "est-atual", "est-custo", "est-preco", "est-taxa"].forEach(
      function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.addEventListener("input", render);
          node.addEventListener("change", render);
        }
      }
    );
    render();
  }




  /* ------------------------------------------------------------------ */
  /* Imposto Simples no preço (DAS / Simples Nacional no preço)          */
  /* ------------------------------------------------------------------ */
  /*
   * Math (seller estimate — aliquota informada pelo seller, NÃO tabela completa):
   *   taxaMarketplace = preco × taxaMarketplacePct/100
   *   das             = preco × aliquotaSimplesPct/100   // DAS sobre receita bruta
   *   custoTotal      = custoProduto + taxaMarketplace + freteAbsorvido + outrosCustos + das
   *   lucroLiquido    = preco − custoTotal
   *   margemLiquidaPct = lucroLiquido / preco × 100
   * Preço mínimo p/ margemMinimaDesejadaPct após taxa+DAS:
   *   Fixed = custoProduto + freteAbsorvido + outrosCustos
   *   t=taxa/100, a=aliquota/100, m=margemMin/100
   *   precoMinimo = Fixed / (1 − t − a − m)   se denom > 0; senão erro
   * DAS come do lucro bruto (antes do DAS):
   *   lucroBrutoAntesDas = preco − (custoProduto + taxaMarketplace + frete + outros)
   *   dasPctDoLucroBruto = das / lucroBrutoAntesDas × 100  (se lucroBruto > 0)
   * Badges: VERMELHO margem<0|inválido; AMARELO 0≤margem<alvo; VERDE margem≥alvo
   *   (preço < precoMinimo com lucro≥0 cai em AMARELO via margem < alvo)
   */

  function badgeImpostoSimples(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.margemLiquidaPct === r.margemLiquidaPct) || r.margemLiquidaPct < 0) return "VERMELHO";
    if (r.margemLiquidaPct < r.margemMinimaDesejadaPct) return "AMARELO";
    return "VERDE";
  }

  function buildImpostoSimplesAdvice(r) {
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "Preço " +
      formatBRL(r.precoVenda) +
      ": taxa marketplace " +
      formatBRL(r.taxaMarketplace) +
      " (" +
      (Math.round(r.taxaMarketplacePct * 100) / 100) +
      "%), DAS ~" +
      formatBRL(r.das) +
      " (" +
      (Math.round(r.aliquotaSimplesPct * 100) / 100) +
      "%). Lucro líquido " +
      formatBRL(r.lucroLiquido) +
      " (~" +
      (Math.round(r.margemLiquidaPct * 10) / 10) +
      "%). ";
    if (r.lucroBrutoAntesDas > 0 && r.dasPctDoLucroBruto != null) {
      base +=
        "O DAS come ~" +
        (Math.round(r.dasPctDoLucroBruto * 10) / 10) +
        "% do lucro bruto (antes do DAS). ";
    }
    base +=
      "Preço mínimo para " +
      (Math.round(r.margemMinimaDesejadaPct * 10) / 10) +
      "% líquido: " +
      formatBRL(r.precoMinimo) +
      ". ";
    if (r.gapPrecoVsMinimo > 0) {
      base += "Falta subir " + formatBRL(r.gapPrecoVsMinimo) + " para bater a margem alvo. ";
    } else if (r.gapPrecoVsMinimo < 0) {
      base += "Folga de " + formatBRL(-r.gapPrecoVsMinimo) + " acima do piso. ";
    } else {
      base += "No piso da margem mínima. ";
    }
    return base + "ESTIMATIVA — alíquota informada por você; não é a tabela completa do Simples.";
  }

  function joinImpostoSimplesCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Imposto Simples no preço · Precifica");
    if (r.ok) {
      lines.push("Preço venda: " + formatBRL(r.precoVenda));
      lines.push("Custo produto: " + formatBRL(r.custoProduto));
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "% → " + formatBRL(r.taxaMarketplace));
      lines.push("Frete absorvido: " + formatBRL(r.freteAbsorvido));
      lines.push("Outros custos: " + formatBRL(r.outrosCustos));
      lines.push("Alíquota Simples (DAS): " + (Math.round(r.aliquotaSimplesPct * 100) / 100) + "% → " + formatBRL(r.das));
      lines.push("Custo total: " + formatBRL(r.custoTotal));
      lines.push("Lucro líquido: " + formatBRL(r.lucroLiquido));
      lines.push("Margem líquida: " + (Math.round(r.margemLiquidaPct * 10) / 10) + "%");
      lines.push("Lucro bruto antes DAS: " + formatBRL(r.lucroBrutoAntesDas));
      if (r.dasPctDoLucroBruto != null) {
        lines.push("DAS % do lucro bruto: " + (Math.round(r.dasPctDoLucroBruto * 10) / 10) + "%");
      }
      lines.push("Margem mínima desejada: " + (Math.round(r.margemMinimaDesejadaPct * 100) / 100) + "%");
      lines.push("Preço mínimo: " + formatBRL(r.precoMinimo));
      lines.push("Gap vs preço atual: " + formatBRL(r.gapPrecoVsMinimo));
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — Imposto Simples no preço; alíquota informada pelo seller. Não é calculadora oficial do Simples nem conselho fiscal."
    );
    return lines.join("\n");
  }

  function calculateImpostoSimples(input) {
    input = input || {};
    var precoVenda = toNumber(input.precoVenda);
    var custoProduto = toNumber(input.custoProduto);

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = 16;
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var freteAbsorvido;
    if (input.freteAbsorvido == null || input.freteAbsorvido === "") {
      freteAbsorvido = 0;
    } else {
      freteAbsorvido = toNumber(input.freteAbsorvido);
    }

    var outrosCustos;
    if (input.outrosCustos == null || input.outrosCustos === "") {
      outrosCustos = 0;
    } else {
      outrosCustos = toNumber(input.outrosCustos);
    }

    var aliquotaSimplesPct;
    if (input.aliquotaSimplesPct == null || input.aliquotaSimplesPct === "") {
      aliquotaSimplesPct = 6;
    } else {
      aliquotaSimplesPct = toNumber(input.aliquotaSimplesPct);
    }

    var margemMinimaDesejadaPct;
    if (input.margemMinimaDesejadaPct == null || input.margemMinimaDesejadaPct === "") {
      margemMinimaDesejadaPct = 15;
    } else {
      margemMinimaDesejadaPct = toNumber(input.margemMinimaDesejadaPct);
    }

    var disclaimer =
      "ESTIMATIVA — Imposto Simples no preço no navegador. A alíquota do DAS é informada por você (anexo/faixa); isto NÃO calcula a tabela completa do Simples Nacional nem substitui contador. Não é conselho fiscal.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        precoVenda: precoVenda,
        custoProduto: custoProduto,
        taxaMarketplacePct: taxaMarketplacePct,
        freteAbsorvido: freteAbsorvido,
        outrosCustos: outrosCustos,
        aliquotaSimplesPct: aliquotaSimplesPct,
        margemMinimaDesejadaPct: margemMinimaDesejadaPct,
        taxaMarketplace: null,
        das: null,
        custoTotal: null,
        lucroLiquido: null,
        margemLiquidaPct: null,
        lucroBrutoAntesDas: null,
        dasPctDoLucroBruto: null,
        fixedCosts: null,
        precoMinimo: null,
        gapPrecoVsMinimo: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinImpostoSimplesCopy(f);
      return f;
    }

    if (!(precoVenda > 0) || precoVenda !== precoVenda) {
      return fail("Informe o preço de venda (R$) maior que zero.");
    }
    if (!(custoProduto >= 0) || custoProduto !== custoProduto) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(freteAbsorvido >= 0) || freteAbsorvido !== freteAbsorvido) {
      return fail("Informe o frete absorvido (R$) ≥ 0.");
    }
    if (!(outrosCustos >= 0) || outrosCustos !== outrosCustos) {
      return fail("Informe os outros custos (R$) ≥ 0.");
    }
    if (!(aliquotaSimplesPct >= 0) || aliquotaSimplesPct !== aliquotaSimplesPct) {
      return fail("Informe a alíquota efetiva do Simples/DAS (%) ≥ 0.");
    }
    if (!(margemMinimaDesejadaPct >= 0) || margemMinimaDesejadaPct !== margemMinimaDesejadaPct) {
      return fail("Informe a margem mínima desejada (%) ≥ 0.");
    }

    var t = taxaMarketplacePct / 100;
    var a = aliquotaSimplesPct / 100;
    var m = margemMinimaDesejadaPct / 100;
    var denom = 1 - t - a - m;
    if (!(denom > 0)) {
      return fail(
        "Taxa + DAS + margem mínima ≥ 100% — impossível precificar com essa combinação. Reduza taxa, alíquota ou margem alvo."
      );
    }

    var taxaMarketplace = precoVenda * t;
    var das = precoVenda * a;
    var custoTotal = custoProduto + taxaMarketplace + freteAbsorvido + outrosCustos + das;
    var lucroLiquido = precoVenda - custoTotal;
    var margemLiquidaPct = (lucroLiquido / precoVenda) * 100;

    var lucroBrutoAntesDas =
      precoVenda - (custoProduto + taxaMarketplace + freteAbsorvido + outrosCustos);
    var dasPctDoLucroBruto =
      lucroBrutoAntesDas > 0 ? (das / lucroBrutoAntesDas) * 100 : null;

    var fixedCosts = custoProduto + freteAbsorvido + outrosCustos;
    var precoMinimo = fixedCosts / denom;
    var gapPrecoVsMinimo = precoMinimo - precoVenda;

    var result = {
      ok: true,
      error: null,
      precoVenda: precoVenda,
      custoProduto: custoProduto,
      taxaMarketplacePct: taxaMarketplacePct,
      freteAbsorvido: freteAbsorvido,
      outrosCustos: outrosCustos,
      aliquotaSimplesPct: aliquotaSimplesPct,
      margemMinimaDesejadaPct: margemMinimaDesejadaPct,
      taxaMarketplace: taxaMarketplace,
      das: das,
      custoTotal: custoTotal,
      lucroLiquido: lucroLiquido,
      margemLiquidaPct: margemLiquidaPct,
      lucroBrutoAntesDas: lucroBrutoAntesDas,
      dasPctDoLucroBruto: dasPctDoLucroBruto,
      fixedCosts: fixedCosts,
      precoMinimo: precoMinimo,
      gapPrecoVsMinimo: gapPrecoVsMinimo,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeImpostoSimples(result);
    result.advice = buildImpostoSimplesAdvice(result);
    result.copyText = joinImpostoSimplesCopy(result);
    return result;
  }

  function mountImpostoSimples(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "impostosimplesgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Imposto Simples no preço · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Depois da taxa, frete e DAS, qual a margem líquida real — e qual o preço mínimo?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "isp-preco",
        label: "Preço de venda (R$)",
        value: "100",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "isp-custo",
        label: "Custo do produto (R$)",
        value: "40",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "isp-taxa",
        label: "Taxa do marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0",
        placeholder: "padrão 16%"
      })
    );
    fields.appendChild(
      field({
        id: "isp-frete",
        label: "Frete absorvido (R$)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    fields.appendChild(
      field({
        id: "isp-outros",
        label: "Outros custos (R$) — embalagem etc.",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    fields.appendChild(
      field({
        id: "isp-aliq",
        label: "Alíquota efetiva Simples / DAS (%)",
        value: "6",
        step: "0.01",
        min: "0",
        placeholder: "padrão 6% — informe a sua"
      })
    );
    fields.appendChild(
      field({
        id: "isp-margem",
        label: "Margem líquida mínima desejada (%)",
        value: "15",
        step: "0.01",
        min: "0",
        placeholder: "padrão 15%"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "DAS = preço × alíquota informada. Preço mín. = (custo+frete+outros) ÷ (1 − taxa% − DAS% − margem%). ESTIMATIVA — não é a tabela completa do Simples."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function read() {
      var taxaRaw = document.getElementById("isp-taxa").value;
      var freteRaw = document.getElementById("isp-frete").value;
      var outrosRaw = document.getElementById("isp-outros").value;
      var aliqRaw = document.getElementById("isp-aliq").value;
      var margemRaw = document.getElementById("isp-margem").value;
      return {
        precoVenda: document.getElementById("isp-preco").value,
        custoProduto: document.getElementById("isp-custo").value,
        taxaMarketplacePct: taxaRaw === "" ? undefined : taxaRaw,
        freteAbsorvido: freteRaw === "" ? undefined : freteRaw,
        outrosCustos: outrosRaw === "" ? undefined : outrosRaw,
        aliquotaSimplesPct: aliqRaw === "" ? undefined : aliqRaw,
        margemMinimaDesejadaPct: margemRaw === "" ? undefined : margemRaw
      };
    }

    function render() {
      var r = calculateImpostoSimples(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Imposto Simples · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          "Margem líquida " +
          (Math.round(r.margemLiquidaPct * 10) / 10).toLocaleString("pt-BR") +
          "% · " +
          formatBRL(r.lucroLiquido);
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Taxa marketplace", formatBRL(r.taxaMarketplace));
        row("DAS (Simples)", formatBRL(r.das));
        row("Custo total", formatBRL(r.custoTotal));
        row("Lucro líquido", formatBRL(r.lucroLiquido));
        row("Margem líquida", (Math.round(r.margemLiquidaPct * 10) / 10).toLocaleString("pt-BR") + "%");
        row("Lucro bruto antes DAS", formatBRL(r.lucroBrutoAntesDas));
        row(
          "DAS % do lucro bruto",
          r.dasPctDoLucroBruto == null
            ? "—"
            : (Math.round(r.dasPctDoLucroBruto * 10) / 10).toLocaleString("pt-BR") + "%"
        );
        row("Preço mínimo (margem alvo)", formatBRL(r.precoMinimo));
        row(
          "Gap vs preço atual",
          (r.gapPrecoVsMinimo > 0 ? "subir " : r.gapPrecoVsMinimo < 0 ? "folga " : "") +
            formatBRL(Math.abs(r.gapPrecoVsMinimo))
        );
        row("Badge", r.badge || "—");
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinImpostoSimplesCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["isp-preco", "isp-custo", "isp-taxa", "isp-frete", "isp-outros", "isp-aliq", "isp-margem"].forEach(
      function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.addEventListener("input", render);
          node.addEventListener("change", render);
        }
      }
    );
    render();
  }




  /* ------------------------------------------------------------------ */
  /* Capital de giro no marketplace                                       */
  /* ------------------------------------------------------------------ */
  /*
   * Model (ESTIMATIVA — cash locked in inventory + purchase lead + receivables):
   *   demandaDiaria       = pedidosPorMes / 30
   *   capitalEstoque      = demandaDiaria × estoqueCoberturaDias × custoProduto
   *   capitalLead         = demandaDiaria × leadTimeCompraDias × custoProduto
   *                         (money paid to supplier before stock sells)
   *   receitaLiquidaUnit  = ticketMedio × (1 − taxaMarketplacePct/100) − freteAbsorvidoPorPedido
   *   capitalReceber      = demandaDiaria × prazoRepasseDias × receitaLiquidaUnit
   *                         (platform payout float after sale)
   *   capitalGiroTotal    = capitalEstoque + capitalLead + capitalReceber
   *   diasCiclo           = leadTimeCompraDias + estoqueCoberturaDias + prazoRepasseDias
   *   giroAno             = 365 / diasCiclo  (if diasCiclo > 0)
   *   vendasMes           = pedidosPorMes × ticketMedio
   * Badges:
   *   VERMELHO — invalid inputs | receitaLiquidaUnit ≤ 0 |
   *              capitalGiroTotal ≤ 0 with pedidosPorMes > 0
   *   AMARELO  — diasCiclo > 45 OR capitalGiroTotal > vendasMes × 0.5
   *   VERDE    — otherwise
   */

  function badgeCapitalGiro(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.receitaLiquidaUnit === r.receitaLiquidaUnit) || r.receitaLiquidaUnit <= 0) return "VERMELHO";
    if (
      r.pedidosPorMes > 0 &&
      (!(r.capitalGiroTotal === r.capitalGiroTotal) || r.capitalGiroTotal <= 0)
    ) {
      return "VERMELHO";
    }
    if (r.diasCiclo > 45) return "AMARELO";
    if (r.vendasMes > 0 && r.capitalGiroTotal > r.vendasMes * 0.5) return "AMARELO";
    return "VERDE";
  }

  function buildCapitalGiroAdvice(r) {
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "Capital de giro estimado " +
      formatBRL(r.capitalGiroTotal) +
      " (estoque " +
      formatBRL(r.capitalEstoque) +
      " + lead " +
      formatBRL(r.capitalLead) +
      " + a receber " +
      formatBRL(r.capitalReceber) +
      "). Ciclo ~" +
      r.diasCiclo +
      " dias (~" +
      (Math.round(r.giroAno * 10) / 10) +
      " giros/ano). ";
    if (r.receitaLiquidaUnit <= 0) {
      base += "Receita líquida por pedido ≤ 0 — revise taxa/frete antes de girar estoque. ";
    } else if (r.diasCiclo > 45) {
      base += "Ciclo longo (>45 dias): negocie lead com fornecedor ou prazo de repasse. ";
    } else if (r.vendasMes > 0 && r.capitalGiroTotal > r.vendasMes * 0.5) {
      base += "Float pesado (>50% do faturamento mensal): reduza cobertura de estoque ou ticket em consignação. ";
    } else {
      base += "Float saudável vs vendas do mês. ";
    }
    return base + "ESTIMATIVA — não inclui impostos, ads, devoluções nem margem de segurança bancária.";
  }

  function joinCapitalGiroCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Capital de giro no marketplace · Precifica");
    if (r.ok) {
      lines.push("Ticket médio: " + formatBRL(r.ticketMedio));
      lines.push("Custo produto: " + formatBRL(r.custoProduto));
      lines.push("Pedidos/mês: " + r.pedidosPorMes);
      lines.push("Demanda diária: " + (Math.round(r.demandaDiaria * 100) / 100));
      lines.push("Lead time compra: " + r.leadTimeCompraDias + " dias");
      lines.push("Cobertura estoque: " + r.estoqueCoberturaDias + " dias");
      lines.push("Prazo repasse: " + r.prazoRepasseDias + " dias");
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "%");
      lines.push("Frete absorvido/pedido: " + formatBRL(r.freteAbsorvidoPorPedido));
      lines.push("Receita líquida/un: " + formatBRL(r.receitaLiquidaUnit));
      lines.push("Capital estoque: " + formatBRL(r.capitalEstoque));
      lines.push("Capital lead (trânsito): " + formatBRL(r.capitalLead));
      lines.push("Capital a receber: " + formatBRL(r.capitalReceber));
      lines.push("Capital de giro total: " + formatBRL(r.capitalGiroTotal));
      lines.push("Dias no ciclo: " + r.diasCiclo);
      lines.push("Giros/ano: " + (Math.round(r.giroAno * 100) / 100));
      lines.push("Vendas/mês: " + formatBRL(r.vendasMes));
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — Capital de giro no marketplace. Não é conselho financeiro."
    );
    return lines.join("\n");
  }

  function calculateCapitalGiro(input) {
    input = input || {};
    var ticketMedio = toNumber(input.ticketMedio);
    var custoProduto = toNumber(input.custoProduto);
    var pedidosPorMes = toNumber(input.pedidosPorMes);

    var leadTimeCompraDias;
    if (input.leadTimeCompraDias == null || input.leadTimeCompraDias === "") {
      leadTimeCompraDias = 15;
    } else {
      leadTimeCompraDias = toNumber(input.leadTimeCompraDias);
    }

    var estoqueCoberturaDias;
    if (input.estoqueCoberturaDias == null || input.estoqueCoberturaDias === "") {
      estoqueCoberturaDias = 20;
    } else {
      estoqueCoberturaDias = toNumber(input.estoqueCoberturaDias);
    }

    var prazoRepasseDias;
    if (input.prazoRepasseDias == null || input.prazoRepasseDias === "") {
      prazoRepasseDias = 14;
    } else {
      prazoRepasseDias = toNumber(input.prazoRepasseDias);
    }

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = 16;
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var freteAbsorvidoPorPedido;
    if (input.freteAbsorvidoPorPedido == null || input.freteAbsorvidoPorPedido === "") {
      freteAbsorvidoPorPedido = 0;
    } else {
      freteAbsorvidoPorPedido = toNumber(input.freteAbsorvidoPorPedido);
    }

    var disclaimer =
      "ESTIMATIVA — Capital de giro no marketplace no navegador. Modelo simples (estoque + lead + a receber). Não inclui impostos, ads, devoluções, chargebacks nem linha de crédito. Não é conselho financeiro.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        ticketMedio: ticketMedio,
        custoProduto: custoProduto,
        pedidosPorMes: pedidosPorMes,
        leadTimeCompraDias: leadTimeCompraDias,
        estoqueCoberturaDias: estoqueCoberturaDias,
        prazoRepasseDias: prazoRepasseDias,
        taxaMarketplacePct: taxaMarketplacePct,
        freteAbsorvidoPorPedido: freteAbsorvidoPorPedido,
        demandaDiaria: null,
        capitalEstoque: null,
        capitalLead: null,
        capitalReceber: null,
        capitalGiroTotal: null,
        diasCiclo: null,
        giroAno: null,
        receitaLiquidaUnit: null,
        vendasMes: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinCapitalGiroCopy(f);
      return f;
    }

    if (!(ticketMedio > 0) || ticketMedio !== ticketMedio) {
      return fail("Informe o ticket médio (R$) maior que zero.");
    }
    if (!(custoProduto >= 0) || custoProduto !== custoProduto) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(pedidosPorMes > 0) || pedidosPorMes !== pedidosPorMes) {
      return fail("Informe pedidos por mês maior que zero.");
    }
    if (!(leadTimeCompraDias >= 0) || leadTimeCompraDias !== leadTimeCompraDias) {
      return fail("Informe o lead time de compra (dias) ≥ 0.");
    }
    if (!(estoqueCoberturaDias >= 0) || estoqueCoberturaDias !== estoqueCoberturaDias) {
      return fail("Informe a cobertura de estoque (dias) ≥ 0.");
    }
    if (!(prazoRepasseDias >= 0) || prazoRepasseDias !== prazoRepasseDias) {
      return fail("Informe o prazo de repasse (dias) ≥ 0.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(freteAbsorvidoPorPedido >= 0) || freteAbsorvidoPorPedido !== freteAbsorvidoPorPedido) {
      return fail("Informe o frete absorvido por pedido (R$) ≥ 0.");
    }

    var demandaDiaria = pedidosPorMes / 30;
    var capitalEstoque = demandaDiaria * estoqueCoberturaDias * custoProduto;
    var capitalLead = demandaDiaria * leadTimeCompraDias * custoProduto;
    var receitaLiquidaUnit =
      ticketMedio * (1 - taxaMarketplacePct / 100) - freteAbsorvidoPorPedido;
    var capitalReceber = demandaDiaria * prazoRepasseDias * receitaLiquidaUnit;
    var capitalGiroTotal = capitalEstoque + capitalLead + capitalReceber;
    var diasCiclo = leadTimeCompraDias + estoqueCoberturaDias + prazoRepasseDias;
    var giroAno = diasCiclo > 0 ? 365 / diasCiclo : null;
    var vendasMes = pedidosPorMes * ticketMedio;

    var result = {
      ok: true,
      error: null,
      ticketMedio: ticketMedio,
      custoProduto: custoProduto,
      pedidosPorMes: pedidosPorMes,
      leadTimeCompraDias: leadTimeCompraDias,
      estoqueCoberturaDias: estoqueCoberturaDias,
      prazoRepasseDias: prazoRepasseDias,
      taxaMarketplacePct: taxaMarketplacePct,
      freteAbsorvidoPorPedido: freteAbsorvidoPorPedido,
      demandaDiaria: demandaDiaria,
      capitalEstoque: capitalEstoque,
      capitalLead: capitalLead,
      capitalReceber: capitalReceber,
      capitalGiroTotal: capitalGiroTotal,
      diasCiclo: diasCiclo,
      giroAno: giroAno,
      receitaLiquidaUnit: receitaLiquidaUnit,
      vendasMes: vendasMes,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeCapitalGiro(result);
    result.advice = buildCapitalGiroAdvice(result);
    result.copyText = joinCapitalGiroCopy(result);
    return result;
  }

  function mountCapitalGiro(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "capitalgirogen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Capital de giro · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quanto de capital fica travado — e em quantos dias o dinheiro volta?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "cg-ticket",
        label: "Ticket médio (R$)",
        value: "89",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "cg-custo",
        label: "Custo do produto (R$)",
        value: "35",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "cg-pedidos",
        label: "Pedidos por mês",
        value: "120",
        step: "1",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "cg-lead",
        label: "Lead time compra (dias)",
        value: "15",
        step: "1",
        min: "0",
        placeholder: "padrão 15"
      })
    );
    fields.appendChild(
      field({
        id: "cg-cob",
        label: "Cobertura de estoque (dias)",
        value: "20",
        step: "1",
        min: "0",
        placeholder: "padrão 20"
      })
    );
    fields.appendChild(
      field({
        id: "cg-prazo",
        label: "Prazo de repasse marketplace (dias)",
        value: "14",
        step: "1",
        min: "0",
        placeholder: "padrão 14 (ML/Shopee-like)"
      })
    );
    fields.appendChild(
      field({
        id: "cg-taxa",
        label: "Taxa do marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0",
        placeholder: "padrão 16%"
      })
    );
    fields.appendChild(
      field({
        id: "cg-frete",
        label: "Frete absorvido por pedido (R$)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Giro = estoque + lead (pago ao fornecedor) + a receber (float do marketplace). Ciclo = lead + cobertura + prazo. ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function read() {
      var leadRaw = document.getElementById("cg-lead").value;
      var cobRaw = document.getElementById("cg-cob").value;
      var prazoRaw = document.getElementById("cg-prazo").value;
      var taxaRaw = document.getElementById("cg-taxa").value;
      var freteRaw = document.getElementById("cg-frete").value;
      return {
        ticketMedio: document.getElementById("cg-ticket").value,
        custoProduto: document.getElementById("cg-custo").value,
        pedidosPorMes: document.getElementById("cg-pedidos").value,
        leadTimeCompraDias: leadRaw === "" ? undefined : leadRaw,
        estoqueCoberturaDias: cobRaw === "" ? undefined : cobRaw,
        prazoRepasseDias: prazoRaw === "" ? undefined : prazoRaw,
        taxaMarketplacePct: taxaRaw === "" ? undefined : taxaRaw,
        freteAbsorvidoPorPedido: freteRaw === "" ? undefined : freteRaw
      };
    }

    function render() {
      var r = calculateCapitalGiro(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Capital de giro · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          formatBRL(r.capitalGiroTotal) +
          " · ciclo " +
          r.diasCiclo +
          " dias";
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Demanda diária", (Math.round(r.demandaDiaria * 100) / 100).toLocaleString("pt-BR"));
        row("Capital estoque", formatBRL(r.capitalEstoque));
        row("Capital lead (trânsito)", formatBRL(r.capitalLead));
        row("Capital a receber", formatBRL(r.capitalReceber));
        row("Capital de giro total", formatBRL(r.capitalGiroTotal));
        row("Receita líquida / un", formatBRL(r.receitaLiquidaUnit));
        row("Dias no ciclo", String(r.diasCiclo));
        row(
          "Giros / ano",
          r.giroAno == null ? "—" : (Math.round(r.giroAno * 100) / 100).toLocaleString("pt-BR")
        );
        row("Vendas / mês", formatBRL(r.vendasMes));
        row("Badge", r.badge || "—");
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinCapitalGiroCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["cg-ticket", "cg-custo", "cg-pedidos", "cg-lead", "cg-cob", "cg-prazo", "cg-taxa", "cg-frete"].forEach(
      function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.addEventListener("input", render);
          node.addEventListener("change", render);
        }
      }
    );
    render();
  }



  function badgeCustoDevolucao(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.margemBrutaUnit === r.margemBrutaUnit) || r.margemBrutaUnit <= 0) return "VERMELHO";
    if (
      r.pedidosPorMes > 0 &&
      (!(r.lucroLiquidoAposDev === r.lucroLiquidoAposDev) || r.lucroLiquidoAposDev <= 0)
    ) {
      return "VERMELHO";
    }
    if (
      r.breakEvenTaxaDevPct > 0 &&
      r.taxaDevolucaoPct >= r.breakEvenTaxaDevPct
    ) {
      return "VERMELHO";
    }
    if (r.lucroBrutoMesSemDev > 0 && r.custoDevolucoesMes > r.lucroBrutoMesSemDev * 0.3) {
      return "AMARELO";
    }
    if (r.taxaDevolucaoPct > 10) return "AMARELO";
    return "VERDE";
  }

  function buildCustoDevolucaoAdvice(r) {
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "Cada devolução custa ~" +
      formatBRL(r.custoDiretoPorDevolucao) +
      " (produto + frete ida + frete volta + retrabalho). Em " +
      (Math.round(r.devolucoesMes * 100) / 100) +
      " devoluções/mês → " +
      formatBRL(r.custoDevolucoesMes) +
      " de custo. Lucro após devoluções: " +
      formatBRL(r.lucroLiquidoAposDev) +
      ". Taxa máxima antes de zerar (~break-even): " +
      (Math.round(r.breakEvenTaxaDevPct * 100) / 100) +
      "%. ";
    if (r.margemBrutaUnit <= 0) {
      base += "Margem bruta ≤ 0 — revise preço, taxa ou frete ida antes de escalar. ";
    } else if (r.lucroLiquidoAposDev <= 0) {
      base += "Devoluções já comem todo o lucro do mês. Reduza taxa de retorno ou custo direto. ";
    } else if (r.breakEvenTaxaDevPct > 0 && r.taxaDevolucaoPct >= r.breakEvenTaxaDevPct) {
      base += "Taxa de devolução ≥ break-even — margem zerada. ";
    } else if (r.lucroBrutoMesSemDev > 0 && r.custoDevolucoesMes > r.lucroBrutoMesSemDev * 0.3) {
      base += "Devoluções pesam >30% do lucro bruto: melhore descrição, fotos e qualidade. ";
    } else if (r.taxaDevolucaoPct > 10) {
      base += "Taxa de devolução >10% é alta para marketplace — investigue motivos no Seller Center. ";
    } else {
      base += "Custo de devolução sob controle vs margem. ";
    }
    return (
      base +
      "ESTIMATIVA — trata custo do produto como 100% perdido na devolução (conservador; sem salvage)."
    );
  }

  function joinCustoDevolucaoCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Custo de devolução no marketplace · Precifica");
    if (r.ok) {
      lines.push("Ticket médio: " + formatBRL(r.ticketMedio));
      lines.push("Custo produto: " + formatBRL(r.custoProduto));
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "%");
      lines.push("Frete ida/pedido: " + formatBRL(r.freteIdaPorPedido));
      lines.push("Frete volta/devolução: " + formatBRL(r.freteVoltaPorDevolucao));
      lines.push("Repacking/retrabalho: " + formatBRL(r.custoRepackingOuRetrabalho));
      lines.push("Taxa de devolução: " + (Math.round(r.taxaDevolucaoPct * 100) / 100) + "%");
      lines.push("Pedidos/mês: " + r.pedidosPorMes);
      lines.push("Receita líquida/un: " + formatBRL(r.receitaLiquidaUnit));
      lines.push("Margem bruta/un: " + formatBRL(r.margemBrutaUnit));
      lines.push("Custo direto/devolução: " + formatBRL(r.custoDiretoPorDevolucao));
      lines.push("Devoluções/mês: " + (Math.round(r.devolucoesMes * 100) / 100));
      lines.push("Custo devoluções/mês: " + formatBRL(r.custoDevolucoesMes));
      lines.push("Lucro bruto/mês (sem dev): " + formatBRL(r.lucroBrutoMesSemDev));
      lines.push("Lucro líquido após dev: " + formatBRL(r.lucroLiquidoAposDev));
      lines.push("Custo por pedido vendido: " + formatBRL(r.custoPorPedidoVendido));
      lines.push(
        "Break-even taxa devolução: " + (Math.round(r.breakEvenTaxaDevPct * 100) / 100) + "%"
      );
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — Custo de devolução no marketplace. Não é conselho financeiro."
    );
    return lines.join("\n");
  }

  function calculateCustoDevolucao(input) {
    input = input || {};
    var ticketMedio = toNumber(input.ticketMedio);
    var custoProduto = toNumber(input.custoProduto);
    var pedidosPorMes = toNumber(input.pedidosPorMes);

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = 16;
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var freteIdaPorPedido;
    if (input.freteIdaPorPedido == null || input.freteIdaPorPedido === "") {
      freteIdaPorPedido = 12;
    } else {
      freteIdaPorPedido = toNumber(input.freteIdaPorPedido);
    }

    var freteVoltaPorDevolucao;
    if (input.freteVoltaPorDevolucao == null || input.freteVoltaPorDevolucao === "") {
      freteVoltaPorDevolucao = 18;
    } else {
      freteVoltaPorDevolucao = toNumber(input.freteVoltaPorDevolucao);
    }

    var custoRepackingOuRetrabalho;
    if (input.custoRepackingOuRetrabalho == null || input.custoRepackingOuRetrabalho === "") {
      custoRepackingOuRetrabalho = 5;
    } else {
      custoRepackingOuRetrabalho = toNumber(input.custoRepackingOuRetrabalho);
    }

    var taxaDevolucaoPct;
    if (input.taxaDevolucaoPct == null || input.taxaDevolucaoPct === "") {
      taxaDevolucaoPct = 8;
    } else {
      taxaDevolucaoPct = toNumber(input.taxaDevolucaoPct);
    }

    var disclaimer =
      "ESTIMATIVA — Custo de devolução no marketplace no navegador. Modelo conservador: custo do produto 100% perdido + frete ida + frete volta + retrabalho. Não inclui chargeback, ads, impostos extras nem salvage parcial. Não é conselho financeiro.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        ticketMedio: ticketMedio,
        custoProduto: custoProduto,
        taxaMarketplacePct: taxaMarketplacePct,
        freteIdaPorPedido: freteIdaPorPedido,
        freteVoltaPorDevolucao: freteVoltaPorDevolucao,
        custoRepackingOuRetrabalho: custoRepackingOuRetrabalho,
        taxaDevolucaoPct: taxaDevolucaoPct,
        pedidosPorMes: pedidosPorMes,
        receitaLiquidaUnit: null,
        margemBrutaUnit: null,
        custoDiretoPorDevolucao: null,
        devolucoesMes: null,
        custoDevolucoesMes: null,
        lucroBrutoMesSemDev: null,
        lucroLiquidoAposDev: null,
        custoPorPedidoVendido: null,
        breakEvenTaxaDevPct: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinCustoDevolucaoCopy(f);
      return f;
    }

    if (!(ticketMedio > 0) || ticketMedio !== ticketMedio) {
      return fail("Informe o ticket médio (R$) maior que zero.");
    }
    if (!(custoProduto >= 0) || custoProduto !== custoProduto) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(pedidosPorMes > 0) || pedidosPorMes !== pedidosPorMes) {
      return fail("Informe pedidos por mês maior que zero.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(freteIdaPorPedido >= 0) || freteIdaPorPedido !== freteIdaPorPedido) {
      return fail("Informe o frete de ida por pedido (R$) ≥ 0.");
    }
    if (!(freteVoltaPorDevolucao >= 0) || freteVoltaPorDevolucao !== freteVoltaPorDevolucao) {
      return fail("Informe o frete de volta por devolução (R$) ≥ 0.");
    }
    if (
      !(custoRepackingOuRetrabalho >= 0) ||
      custoRepackingOuRetrabalho !== custoRepackingOuRetrabalho
    ) {
      return fail("Informe o custo de repacking/retrabalho (R$) ≥ 0.");
    }
    if (!(taxaDevolucaoPct >= 0) || taxaDevolucaoPct !== taxaDevolucaoPct) {
      return fail("Informe a taxa de devolução (%) ≥ 0.");
    }

    var receitaLiquidaUnit = ticketMedio * (1 - taxaMarketplacePct / 100);
    var margemBrutaUnit = receitaLiquidaUnit - custoProduto - freteIdaPorPedido;
    var custoDiretoPorDevolucao =
      custoProduto + freteIdaPorPedido + freteVoltaPorDevolucao + custoRepackingOuRetrabalho;
    var devolucoesMes = pedidosPorMes * (taxaDevolucaoPct / 100);
    var custoDevolucoesMes = devolucoesMes * custoDiretoPorDevolucao;
    var lucroBrutoMesSemDev = pedidosPorMes * margemBrutaUnit;
    var lucroLiquidoAposDev = lucroBrutoMesSemDev - custoDevolucoesMes;
    var custoPorPedidoVendido =
      pedidosPorMes > 0 ? custoDevolucoesMes / pedidosPorMes : null;
    var breakEvenTaxaDevPct =
      margemBrutaUnit > 0 && custoDiretoPorDevolucao > 0
        ? (margemBrutaUnit / custoDiretoPorDevolucao) * 100
        : 0;

    var result = {
      ok: true,
      error: null,
      ticketMedio: ticketMedio,
      custoProduto: custoProduto,
      taxaMarketplacePct: taxaMarketplacePct,
      freteIdaPorPedido: freteIdaPorPedido,
      freteVoltaPorDevolucao: freteVoltaPorDevolucao,
      custoRepackingOuRetrabalho: custoRepackingOuRetrabalho,
      taxaDevolucaoPct: taxaDevolucaoPct,
      pedidosPorMes: pedidosPorMes,
      receitaLiquidaUnit: receitaLiquidaUnit,
      margemBrutaUnit: margemBrutaUnit,
      custoDiretoPorDevolucao: custoDiretoPorDevolucao,
      devolucoesMes: devolucoesMes,
      custoDevolucoesMes: custoDevolucoesMes,
      lucroBrutoMesSemDev: lucroBrutoMesSemDev,
      lucroLiquidoAposDev: lucroLiquidoAposDev,
      custoPorPedidoVendido: custoPorPedidoVendido,
      breakEvenTaxaDevPct: breakEvenTaxaDevPct,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeCustoDevolucao(result);
    result.advice = buildCustoDevolucaoAdvice(result);
    result.copyText = joinCustoDevolucaoCopy(result);
    return result;
  }

  function mountCustoDevolucao(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "custodevolucaogen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Custo de devolução · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quanto custa de verdade cada devolução — e quantas matam a margem?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "cd-ticket",
        label: "Ticket médio (R$)",
        value: "89",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "cd-custo",
        label: "Custo do produto (R$)",
        value: "35",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "cd-taxa",
        label: "Taxa do marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0",
        placeholder: "padrão 16%"
      })
    );
    fields.appendChild(
      field({
        id: "cd-frete-ida",
        label: "Frete ida por pedido (R$)",
        value: "12",
        step: "0.01",
        min: "0",
        placeholder: "padrão 12"
      })
    );
    fields.appendChild(
      field({
        id: "cd-frete-volta",
        label: "Frete volta por devolução (R$)",
        value: "18",
        step: "0.01",
        min: "0",
        placeholder: "padrão 18"
      })
    );
    fields.appendChild(
      field({
        id: "cd-repack",
        label: "Repacking / retrabalho (R$)",
        value: "5",
        step: "0.01",
        min: "0",
        placeholder: "padrão 5"
      })
    );
    fields.appendChild(
      field({
        id: "cd-taxa-dev",
        label: "Taxa de devolução (%)",
        value: "8",
        step: "0.01",
        min: "0",
        placeholder: "padrão 8%"
      })
    );
    fields.appendChild(
      field({
        id: "cd-pedidos",
        label: "Pedidos por mês",
        value: "120",
        step: "1",
        min: "0"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Custo direto/devolução = produto + frete ida + frete volta + retrabalho (produto 100% perdido, conservador). Break-even = margem bruta ÷ custo direto. ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function read() {
      var taxaRaw = document.getElementById("cd-taxa").value;
      var idaRaw = document.getElementById("cd-frete-ida").value;
      var voltaRaw = document.getElementById("cd-frete-volta").value;
      var packRaw = document.getElementById("cd-repack").value;
      var taxaDevRaw = document.getElementById("cd-taxa-dev").value;
      return {
        ticketMedio: document.getElementById("cd-ticket").value,
        custoProduto: document.getElementById("cd-custo").value,
        taxaMarketplacePct: taxaRaw === "" ? undefined : taxaRaw,
        freteIdaPorPedido: idaRaw === "" ? undefined : idaRaw,
        freteVoltaPorDevolucao: voltaRaw === "" ? undefined : voltaRaw,
        custoRepackingOuRetrabalho: packRaw === "" ? undefined : packRaw,
        taxaDevolucaoPct: taxaDevRaw === "" ? undefined : taxaDevRaw,
        pedidosPorMes: document.getElementById("cd-pedidos").value
      };
    }

    function render() {
      var r = calculateCustoDevolucao(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Custo de devolução · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          formatBRL(r.custoDiretoPorDevolucao) +
          " / devolução · " +
          formatBRL(r.custoDevolucoesMes) +
          "/mês";
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Receita líquida / un", formatBRL(r.receitaLiquidaUnit));
        row("Margem bruta / un", formatBRL(r.margemBrutaUnit));
        row("Custo direto / devolução", formatBRL(r.custoDiretoPorDevolucao));
        row(
          "Devoluções / mês",
          (Math.round(r.devolucoesMes * 100) / 100).toLocaleString("pt-BR")
        );
        row("Custo devoluções / mês", formatBRL(r.custoDevolucoesMes));
        row("Lucro bruto / mês (sem dev)", formatBRL(r.lucroBrutoMesSemDev));
        row("Lucro líquido após dev", formatBRL(r.lucroLiquidoAposDev));
        row("Custo por pedido vendido", formatBRL(r.custoPorPedidoVendido));
        row(
          "Break-even taxa devolução",
          (Math.round(r.breakEvenTaxaDevPct * 100) / 100).toLocaleString("pt-BR") + "%"
        );
        row("Badge", r.badge || "—");
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinCustoDevolucaoCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    [
      "cd-ticket",
      "cd-custo",
      "cd-taxa",
      "cd-frete-ida",
      "cd-frete-volta",
      "cd-repack",
      "cd-taxa-dev",
      "cd-pedidos"
    ].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", render);
        node.addEventListener("change", render);
      }
    });
    render();
  }



  function badgePrazoRepasse(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.margemPorPedido === r.margemPorPedido) || r.margemPorPedido <= 0) return "VERMELHO";
    if (
      r.margemDia > 0 &&
      r.necessidadeCaixa === r.necessidadeCaixa &&
      r.necessidadeCaixa > r.margemDia * 60
    ) {
      return "VERMELHO";
    }
    if (r.prazoEfetivoDias >= 21) return "AMARELO";
    if (
      r.margemDia > 0 &&
      r.floatJaGasto === r.floatJaGasto &&
      r.floatJaGasto > r.margemDia * 30
    ) {
      return "AMARELO";
    }
    return "VERDE";
  }

  function buildPrazoRepasseAdvice(r) {
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "Com ~" +
      (Math.round(r.vendasPorDia * 100) / 100) +
      " vendas/dia e prazo efetivo de " +
      (Math.round(r.prazoEfetivoDias * 100) / 100) +
      " dias, você já gastou ~" +
      formatBRL(r.floatJaGasto) +
      " (produto+frete) antes do repasse e tem ~" +
      formatBRL(r.floatReceber) +
      " a receber líquido. Necessidade de caixa mínima: " +
      formatBRL(r.necessidadeCaixa) +
      ". ";
    if (r.margemPorPedido <= 0) {
      base += "Margem por pedido ≤ 0 — o float vira buraco: revise preço, taxa ou frete. ";
    } else if (r.margemDia > 0 && r.necessidadeCaixa > r.margemDia * 60) {
      base += "Caixa travado > 60 dias de margem diária — risco alto de sufoco no giro. ";
    } else if (r.prazoEfetivoDias >= 21) {
      base += "Prazo efetivo ≥ 21 dias: planeje capital extra ou priorize liquidação mais rápida. ";
    } else if (r.margemDia > 0 && r.floatJaGasto > r.margemDia * 30) {
      base += "Float gasto > 30 dias de margem diária — aperto de caixa provável no crescimento. ";
    } else {
      base += "Float de repasse sob controle vs margem diária. ";
    }
    return (
      base +
      "ESTIMATIVA — prazos reais variam por marketplace, tipo de anúncio e parcelamento; confirme no Seller Center."
    );
  }

  function joinPrazoRepasseCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Prazo de repasse / float de caixa · Precifica");
    if (r.ok) {
      lines.push("Vendas/dia: " + r.vendasPorDia);
      lines.push("Ticket médio: " + formatBRL(r.ticketMedio));
      lines.push("Prazo repasse (dias): " + r.prazoRepasseDias);
      lines.push(
        "Parceladas: " +
          (Math.round(r.percentualVendasParceladas * 100) / 100) +
          "% · atraso extra: " +
          r.atrasoExtraParcelamento +
          " dias"
      );
      lines.push(
        "Prazo efetivo (dias): " + (Math.round(r.prazoEfetivoDias * 100) / 100)
      );
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "%");
      lines.push("Custo produto/un: " + formatBRL(r.custoProdutoUnit));
      lines.push("Frete pago pelo seller/un: " + formatBRL(r.fretePagoPeloSellerUnit));
      lines.push("Receita bruta/dia: " + formatBRL(r.receitaBrutaDia));
      lines.push("Líquido/pedido após taxa: " + formatBRL(r.liquidoPorPedidoAposTaxa));
      lines.push("Caixa saída/pedido: " + formatBRL(r.caixaSaidaPorPedido));
      lines.push("Margem/pedido: " + formatBRL(r.margemPorPedido));
      lines.push("Float a receber: " + formatBRL(r.floatReceber));
      lines.push("Float já gasto: " + formatBRL(r.floatJaGasto));
      lines.push("Necessidade de caixa: " + formatBRL(r.necessidadeCaixa));
      lines.push("Dias até 1º repasse (efetivo): " + (Math.round(r.diasAtePrimeiroRepasse * 100) / 100));
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — Prazo de repasse / float de caixa. Não é conselho financeiro."
    );
    return lines.join("\n");
  }

  function calculatePrazoRepasse(input) {
    input = input || {};
    var vendasPorDia = toNumber(input.vendasPorDia);
    var ticketMedio = toNumber(input.ticketMedio);
    var custoProdutoUnit = toNumber(input.custoProdutoUnit);

    var prazoRepasseDias;
    if (input.prazoRepasseDias == null || input.prazoRepasseDias === "") {
      prazoRepasseDias = 14;
    } else {
      prazoRepasseDias = toNumber(input.prazoRepasseDias);
    }

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = 16;
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var fretePagoPeloSellerUnit;
    if (input.fretePagoPeloSellerUnit == null || input.fretePagoPeloSellerUnit === "") {
      fretePagoPeloSellerUnit = 12;
    } else {
      fretePagoPeloSellerUnit = toNumber(input.fretePagoPeloSellerUnit);
    }

    var percentualVendasParceladas;
    if (input.percentualVendasParceladas == null || input.percentualVendasParceladas === "") {
      percentualVendasParceladas = 0;
    } else {
      percentualVendasParceladas = toNumber(input.percentualVendasParceladas);
    }

    var atrasoExtraParcelamento;
    if (input.atrasoExtraParcelamento == null || input.atrasoExtraParcelamento === "") {
      atrasoExtraParcelamento = 0;
    } else {
      atrasoExtraParcelamento = toNumber(input.atrasoExtraParcelamento);
    }

    var disclaimer =
      "ESTIMATIVA — Prazo de repasse / float de caixa no marketplace no navegador. Modelo: float a receber = vendas/dia × prazo efetivo × líquido após taxa; float já gasto = vendas/dia × prazo efetivo × (custo+frete). Prazo efetivo = prazo + (% parceladas × atraso extra). Não inclui ads, impostos extras, chargeback nem variação por anúncio. Não é conselho financeiro.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        vendasPorDia: vendasPorDia,
        ticketMedio: ticketMedio,
        prazoRepasseDias: prazoRepasseDias,
        taxaMarketplacePct: taxaMarketplacePct,
        custoProdutoUnit: custoProdutoUnit,
        fretePagoPeloSellerUnit: fretePagoPeloSellerUnit,
        percentualVendasParceladas: percentualVendasParceladas,
        atrasoExtraParcelamento: atrasoExtraParcelamento,
        prazoEfetivoDias: null,
        receitaBrutaDia: null,
        liquidoPorPedidoAposTaxa: null,
        caixaSaidaPorPedido: null,
        margemPorPedido: null,
        margemDia: null,
        floatReceber: null,
        floatJaGasto: null,
        necessidadeCaixa: null,
        diasAtePrimeiroRepasse: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinPrazoRepasseCopy(f);
      return f;
    }

    if (!(vendasPorDia > 0) || vendasPorDia !== vendasPorDia) {
      return fail("Informe vendas por dia maior que zero.");
    }
    if (!(ticketMedio > 0) || ticketMedio !== ticketMedio) {
      return fail("Informe o ticket médio (R$) maior que zero.");
    }
    if (!(custoProdutoUnit >= 0) || custoProdutoUnit !== custoProdutoUnit) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(prazoRepasseDias >= 0) || prazoRepasseDias !== prazoRepasseDias) {
      return fail("Informe o prazo de repasse (dias) ≥ 0.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(fretePagoPeloSellerUnit >= 0) || fretePagoPeloSellerUnit !== fretePagoPeloSellerUnit) {
      return fail("Informe o frete pago pelo seller (R$) ≥ 0.");
    }
    if (
      !(percentualVendasParceladas >= 0) ||
      percentualVendasParceladas !== percentualVendasParceladas
    ) {
      return fail("Informe o % de vendas parceladas ≥ 0.");
    }
    if (!(atrasoExtraParcelamento >= 0) || atrasoExtraParcelamento !== atrasoExtraParcelamento) {
      return fail("Informe o atraso extra de parcelamento (dias) ≥ 0.");
    }

    var prazoEfetivoDias =
      prazoRepasseDias + (percentualVendasParceladas / 100) * atrasoExtraParcelamento;
    var receitaBrutaDia = vendasPorDia * ticketMedio;
    var liquidoPorPedidoAposTaxa = ticketMedio * (1 - taxaMarketplacePct / 100);
    var caixaSaidaPorPedido = custoProdutoUnit + fretePagoPeloSellerUnit;
    var margemPorPedido = liquidoPorPedidoAposTaxa - caixaSaidaPorPedido;
    var margemDia = vendasPorDia * margemPorPedido;
    var floatReceber = vendasPorDia * prazoEfetivoDias * liquidoPorPedidoAposTaxa;
    var floatJaGasto = vendasPorDia * prazoEfetivoDias * caixaSaidaPorPedido;
    var necessidadeCaixa = floatJaGasto;
    var diasAtePrimeiroRepasse = prazoEfetivoDias;

    var result = {
      ok: true,
      error: null,
      vendasPorDia: vendasPorDia,
      ticketMedio: ticketMedio,
      prazoRepasseDias: prazoRepasseDias,
      taxaMarketplacePct: taxaMarketplacePct,
      custoProdutoUnit: custoProdutoUnit,
      fretePagoPeloSellerUnit: fretePagoPeloSellerUnit,
      percentualVendasParceladas: percentualVendasParceladas,
      atrasoExtraParcelamento: atrasoExtraParcelamento,
      prazoEfetivoDias: prazoEfetivoDias,
      receitaBrutaDia: receitaBrutaDia,
      liquidoPorPedidoAposTaxa: liquidoPorPedidoAposTaxa,
      caixaSaidaPorPedido: caixaSaidaPorPedido,
      margemPorPedido: margemPorPedido,
      margemDia: margemDia,
      floatReceber: floatReceber,
      floatJaGasto: floatJaGasto,
      necessidadeCaixa: necessidadeCaixa,
      diasAtePrimeiroRepasse: diasAtePrimeiroRepasse,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgePrazoRepasse(result);
    result.advice = buildPrazoRepasseAdvice(result);
    result.copyText = joinPrazoRepasseCopy(result);
    return result;
  }

  function mountPrazoRepasse(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "prazorepassegen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Prazo de repasse · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quando o marketplace paga — e quanto de caixa fica travado no float?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "pr-preset",
        label: "Preset de marketplace (prazo)",
        type: "select",
        options: [
          { value: "14", label: "Mercado Livre · ~14 dias", selected: true },
          { value: "7", label: "Shopee · ~7 dias (rápido)" },
          { value: "14-shopee", label: "Shopee · ~14 dias" },
          { value: "14-amz", label: "Amazon BR · ~14 dias" },
          { value: "21", label: "Amazon BR / parcelado · ~21 dias" },
          { value: "custom", label: "Livre (usar campo abaixo)" }
        ]
      })
    );
    fields.appendChild(
      field({
        id: "pr-vendas",
        label: "Vendas por dia",
        value: "8",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "pr-ticket",
        label: "Ticket médio (R$)",
        value: "89",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "pr-prazo",
        label: "Prazo de repasse (dias)",
        value: "14",
        step: "1",
        min: "0",
        placeholder: "padrão 14"
      })
    );
    fields.appendChild(
      field({
        id: "pr-taxa",
        label: "Taxa do marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0",
        placeholder: "padrão 16%"
      })
    );
    fields.appendChild(
      field({
        id: "pr-custo",
        label: "Custo do produto / un (R$)",
        value: "35",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "pr-frete",
        label: "Frete pago pelo seller / un (R$)",
        value: "12",
        step: "0.01",
        min: "0",
        placeholder: "padrão 12"
      })
    );
    fields.appendChild(
      field({
        id: "pr-parc-pct",
        label: "% vendas parceladas (opcional)",
        value: "0",
        step: "0.01",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    fields.appendChild(
      field({
        id: "pr-parc-atraso",
        label: "Atraso extra parcelamento (dias)",
        value: "0",
        step: "1",
        min: "0",
        placeholder: "padrão 0"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Float a receber = vendas/dia × prazo efetivo × líquido após taxa. Float já gasto = vendas/dia × prazo efetivo × (custo+frete). Prazo efetivo = prazo + (% parceladas × atraso extra). ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    var PRESET_DAYS = {
      "14": 14,
      "7": 7,
      "14-shopee": 14,
      "14-amz": 14,
      "21": 21
    };

    function applyPreset() {
      var preset = document.getElementById("pr-preset");
      var prazo = document.getElementById("pr-prazo");
      if (!preset || !prazo) return;
      var v = preset.value;
      if (v !== "custom" && PRESET_DAYS[v] != null) {
        prazo.value = String(PRESET_DAYS[v]);
      }
    }

    function read() {
      var prazoRaw = document.getElementById("pr-prazo").value;
      var taxaRaw = document.getElementById("pr-taxa").value;
      var freteRaw = document.getElementById("pr-frete").value;
      var parcPctRaw = document.getElementById("pr-parc-pct").value;
      var parcAtrasoRaw = document.getElementById("pr-parc-atraso").value;
      return {
        vendasPorDia: document.getElementById("pr-vendas").value,
        ticketMedio: document.getElementById("pr-ticket").value,
        prazoRepasseDias: prazoRaw === "" ? undefined : prazoRaw,
        taxaMarketplacePct: taxaRaw === "" ? undefined : taxaRaw,
        custoProdutoUnit: document.getElementById("pr-custo").value,
        fretePagoPeloSellerUnit: freteRaw === "" ? undefined : freteRaw,
        percentualVendasParceladas: parcPctRaw === "" ? undefined : parcPctRaw,
        atrasoExtraParcelamento: parcAtrasoRaw === "" ? undefined : parcAtrasoRaw
      };
    }

    function render() {
      var r = calculatePrazoRepasse(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Prazo de repasse · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          formatBRL(r.necessidadeCaixa) +
          " travados · " +
          (Math.round(r.diasAtePrimeiroRepasse * 100) / 100) +
          " dias";
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Receita bruta / dia", formatBRL(r.receitaBrutaDia));
        row("Líquido / pedido após taxa", formatBRL(r.liquidoPorPedidoAposTaxa));
        row("Caixa saída / pedido", formatBRL(r.caixaSaidaPorPedido));
        row("Margem / pedido", formatBRL(r.margemPorPedido));
        row(
          "Prazo efetivo",
          (Math.round(r.prazoEfetivoDias * 100) / 100).toLocaleString("pt-BR") + " dias"
        );
        row("Float a receber", formatBRL(r.floatReceber));
        row("Float já gasto", formatBRL(r.floatJaGasto));
        row("Necessidade de caixa", formatBRL(r.necessidadeCaixa));
        row(
          "Dias até 1º repasse",
          (Math.round(r.diasAtePrimeiroRepasse * 100) / 100).toLocaleString("pt-BR")
        );
        row("Badge", r.badge || "—");
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinPrazoRepasseCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    var presetNode = document.getElementById("pr-preset");
    if (presetNode) {
      presetNode.addEventListener("change", function () {
        applyPreset();
        render();
      });
    }

    [
      "pr-vendas",
      "pr-ticket",
      "pr-prazo",
      "pr-taxa",
      "pr-custo",
      "pr-frete",
      "pr-parc-pct",
      "pr-parc-atraso"
    ].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", render);
        node.addEventListener("change", render);
      }
    });
    render();
  }



  function badgeCustoEmbalagem(r) {
    if (!r || !r.ok) return "VERMELHO";
    if (!(r.margemComEmbalagem === r.margemComEmbalagem) || r.margemComEmbalagem <= 0) return "VERMELHO";
    if (
      r.margemSemEmbalagem > 0 &&
      r.embalagemPctSobreMargem === r.embalagemPctSobreMargem &&
      r.embalagemPctSobreMargem >= 40
    ) {
      return "VERMELHO";
    }
    if (
      r.margemSemEmbalagem > 0 &&
      r.embalagemPctSobreMargem === r.embalagemPctSobreMargem &&
      r.embalagemPctSobreMargem >= 20
    ) {
      return "AMARELO";
    }
    if (
      r.embalagemPctSobrePreco === r.embalagemPctSobrePreco &&
      r.embalagemPctSobrePreco >= 5
    ) {
      return "AMARELO";
    }
    return "VERDE";
  }

  function buildCustoEmbalagemAdvice(r) {
    if (!r.ok) return r.error || "Dados incompletos.";
    var base =
      "Embalagem de " +
      formatBRL(r.custoEmbalagemUnit) +
      " por pedido come ~" +
      (Math.round(r.embalagemPctSobrePreco * 100) / 100) +
      "% do preço";
    if (r.embalagemPctSobreMargem != null && r.embalagemPctSobreMargem === r.embalagemPctSobreMargem) {
      base +=
        " e ~" +
        (Math.round(r.embalagemPctSobreMargem * 100) / 100) +
        "% da margem antes da embalagem";
    }
    base +=
      ". Margem com embalagem: " +
      formatBRL(r.margemComEmbalagem) +
      ". Impacto/mês (~" +
      r.vendasPorMes +
      " vendas): " +
      formatBRL(r.impactoMes) +
      ". Teto p/ margem zero: " +
      formatBRL(r.tetoEmbalagemParaMargemZero) +
      "; teto p/ meta " +
      (Math.round(r.metaMargemPct * 100) / 100) +
      "%: " +
      formatBRL(r.tetoEmbalagemParaMetaPct) +
      ". ";
    if (r.margemComEmbalagem <= 0) {
      base += "Margem com embalagem ≤ 0 — embalagem fura o lucro: reduza caixa/proteção ou suba o preço. ";
    } else if (
      r.margemSemEmbalagem > 0 &&
      r.embalagemPctSobreMargem >= 40
    ) {
      base += "Embalagem ≥ 40% da margem — risco alto de erodir o lucro. ";
    } else if (
      r.margemSemEmbalagem > 0 &&
      r.embalagemPctSobreMargem >= 20
    ) {
      base += "Embalagem ≥ 20% da margem — revise fornecedor de caixa ou padronize kit. ";
    } else if (r.embalagemPctSobrePreco >= 5) {
      base += "Embalagem ≥ 5% do preço — peso alto no ticket; busque alternativa mais barata. ";
    } else {
      base += "Custo de embalagem sob controle vs margem. ";
    }
    return (
      base +
      "ESTIMATIVA — confira preços reais de caixa, fita, plástico e etiqueta com o seu fornecedor."
    );
  }

  function joinCustoEmbalagemCopy(r) {
    r = r || {};
    var lines = [];
    lines.push("Custo de embalagem no marketplace · Precifica");
    if (r.ok) {
      lines.push("Preço de venda: " + formatBRL(r.precoVenda));
      lines.push("Taxa marketplace: " + (Math.round(r.taxaMarketplacePct * 100) / 100) + "%");
      lines.push("Custo produto: " + formatBRL(r.custoProduto));
      lines.push("Frete pago pelo seller: " + formatBRL(r.fretePagoPeloSeller));
      lines.push("Custo embalagem / un: " + formatBRL(r.custoEmbalagemUnit));
      if (r.caixa != null || r.fita != null || r.protecao != null || r.etiqueta != null) {
        lines.push(
          "Breakdown: caixa " +
            formatBRL(r.caixa || 0) +
            " · fita " +
            formatBRL(r.fita || 0) +
            " · proteção " +
            formatBRL(r.protecao || 0) +
            " · etiqueta " +
            formatBRL(r.etiqueta || 0)
        );
      }
      lines.push("Vendas/mês: " + r.vendasPorMes);
      lines.push("Meta margem %: " + (Math.round(r.metaMargemPct * 100) / 100) + "%");
      lines.push("Líquido após taxa: " + formatBRL(r.liquidoAposTaxa));
      lines.push("Custo variável s/ embalagem: " + formatBRL(r.custoVariavelSemEmbalagem));
      lines.push("Margem s/ embalagem: " + formatBRL(r.margemSemEmbalagem));
      lines.push("Margem c/ embalagem: " + formatBRL(r.margemComEmbalagem));
      lines.push(
        "Embalagem % preço: " + (Math.round(r.embalagemPctSobrePreco * 100) / 100) + "%"
      );
      if (r.embalagemPctSobreMargem != null && r.embalagemPctSobreMargem === r.embalagemPctSobreMargem) {
        lines.push(
          "Embalagem % margem: " + (Math.round(r.embalagemPctSobreMargem * 100) / 100) + "%"
        );
      }
      lines.push("Impacto / mês: " + formatBRL(r.impactoMes));
      lines.push("Teto embalagem (margem zero): " + formatBRL(r.tetoEmbalagemParaMargemZero));
      lines.push("Teto embalagem (meta): " + formatBRL(r.tetoEmbalagemParaMetaPct));
      lines.push("Badge: " + (r.badge || "—"));
      if (r.advice) lines.push(r.advice);
    } else {
      lines.push("Erro: " + (r.error || "dados inválidos"));
    }
    lines.push(
      r.disclaimer ||
        "ESTIMATIVA — Custo de embalagem no marketplace. Não é conselho financeiro."
    );
    return lines.join("\n");
  }

  function calculateCustoEmbalagem(input) {
    input = input || {};
    var precoVenda = toNumber(input.precoVenda);
    var custoProduto = toNumber(input.custoProduto);

    var taxaMarketplacePct;
    if (input.taxaMarketplacePct == null || input.taxaMarketplacePct === "") {
      taxaMarketplacePct = 16;
    } else {
      taxaMarketplacePct = toNumber(input.taxaMarketplacePct);
    }

    var fretePagoPeloSeller;
    if (input.fretePagoPeloSeller == null || input.fretePagoPeloSeller === "") {
      fretePagoPeloSeller = 12;
    } else {
      fretePagoPeloSeller = toNumber(input.fretePagoPeloSeller);
    }

    var vendasPorMes;
    if (input.vendasPorMes == null || input.vendasPorMes === "") {
      vendasPorMes = 200;
    } else {
      vendasPorMes = toNumber(input.vendasPorMes);
    }

    var metaMargemPct;
    if (input.metaMargemPct == null || input.metaMargemPct === "") {
      metaMargemPct = 15;
    } else {
      metaMargemPct = toNumber(input.metaMargemPct);
    }

    var caixa = null;
    var fita = null;
    var protecao = null;
    var etiqueta = null;
    var hasParts = false;
    if (input.caixa != null && input.caixa !== "") {
      caixa = toNumber(input.caixa);
      hasParts = true;
    }
    if (input.fita != null && input.fita !== "") {
      fita = toNumber(input.fita);
      hasParts = true;
    }
    if (input.protecao != null && input.protecao !== "") {
      protecao = toNumber(input.protecao);
      hasParts = true;
    }
    if (input.etiqueta != null && input.etiqueta !== "") {
      etiqueta = toNumber(input.etiqueta);
      hasParts = true;
    }

    var custoEmbalagemUnit;
    if (hasParts) {
      custoEmbalagemUnit =
        (caixa === caixa && caixa != null ? caixa : 0) +
        (fita === fita && fita != null ? fita : 0) +
        (protecao === protecao && protecao != null ? protecao : 0) +
        (etiqueta === etiqueta && etiqueta != null ? etiqueta : 0);
    } else if (input.custoEmbalagemUnit == null || input.custoEmbalagemUnit === "") {
      custoEmbalagemUnit = NaN;
    } else {
      custoEmbalagemUnit = toNumber(input.custoEmbalagemUnit);
    }

    var disclaimer =
      "ESTIMATIVA — Custo de embalagem no marketplace no navegador. Modelo: líquido após taxa = preço × (1 − taxa%); margem s/ embalagem = líquido − (produto+frete); margem c/ embalagem = margem s/ embalagem − embalagem/un; teto meta = líquido − (produto+frete) − (preço × meta%). Não inclui ads, impostos extras nem perda/quebra. Não é conselho financeiro.";

    function fail(msg) {
      var f = {
        ok: false,
        error: msg,
        precoVenda: precoVenda,
        taxaMarketplacePct: taxaMarketplacePct,
        custoProduto: custoProduto,
        fretePagoPeloSeller: fretePagoPeloSeller,
        custoEmbalagemUnit: custoEmbalagemUnit,
        vendasPorMes: vendasPorMes,
        metaMargemPct: metaMargemPct,
        caixa: caixa,
        fita: fita,
        protecao: protecao,
        etiqueta: etiqueta,
        liquidoAposTaxa: null,
        custoVariavelSemEmbalagem: null,
        margemSemEmbalagem: null,
        margemComEmbalagem: null,
        embalagemPctSobrePreco: null,
        embalagemPctSobreMargem: null,
        impactoMes: null,
        perdaMargemMes: null,
        tetoEmbalagemParaMargemZero: null,
        tetoEmbalagemParaMetaPct: null,
        badge: "VERMELHO",
        advice: msg,
        disclaimer: disclaimer,
        copyText: ""
      };
      f.copyText = joinCustoEmbalagemCopy(f);
      return f;
    }

    if (!(precoVenda > 0) || precoVenda !== precoVenda) {
      return fail("Informe o preço de venda (R$) maior que zero.");
    }
    if (!(custoProduto >= 0) || custoProduto !== custoProduto) {
      return fail("Informe o custo do produto (R$) ≥ 0.");
    }
    if (!(taxaMarketplacePct >= 0) || taxaMarketplacePct !== taxaMarketplacePct) {
      return fail("Informe a taxa do marketplace (%) ≥ 0.");
    }
    if (!(fretePagoPeloSeller >= 0) || fretePagoPeloSeller !== fretePagoPeloSeller) {
      return fail("Informe o frete pago pelo seller (R$) ≥ 0.");
    }
    if (!(custoEmbalagemUnit >= 0) || custoEmbalagemUnit !== custoEmbalagemUnit) {
      return fail("Informe o custo de embalagem por unidade (R$) ≥ 0.");
    }
    if (!(vendasPorMes > 0) || vendasPorMes !== vendasPorMes) {
      return fail("Informe vendas por mês maior que zero.");
    }
    if (!(metaMargemPct >= 0) || metaMargemPct !== metaMargemPct) {
      return fail("Informe a meta de margem (%) ≥ 0.");
    }
    if (hasParts) {
      if (caixa != null && (!(caixa >= 0) || caixa !== caixa)) {
        return fail("Informe o custo da caixa (R$) ≥ 0.");
      }
      if (fita != null && (!(fita >= 0) || fita !== fita)) {
        return fail("Informe o custo da fita (R$) ≥ 0.");
      }
      if (protecao != null && (!(protecao >= 0) || protecao !== protecao)) {
        return fail("Informe o custo da proteção (R$) ≥ 0.");
      }
      if (etiqueta != null && (!(etiqueta >= 0) || etiqueta !== etiqueta)) {
        return fail("Informe o custo da etiqueta (R$) ≥ 0.");
      }
    }

    var liquidoAposTaxa = precoVenda * (1 - taxaMarketplacePct / 100);
    var custoVariavelSemEmbalagem = custoProduto + fretePagoPeloSeller;
    var margemSemEmbalagem = liquidoAposTaxa - custoVariavelSemEmbalagem;
    var margemComEmbalagem = margemSemEmbalagem - custoEmbalagemUnit;
    var embalagemPctSobrePreco = (custoEmbalagemUnit / precoVenda) * 100;
    var embalagemPctSobreMargem =
      margemSemEmbalagem > 0 ? (custoEmbalagemUnit / margemSemEmbalagem) * 100 : null;
    var impactoMes = vendasPorMes * custoEmbalagemUnit;
    var perdaMargemMes = impactoMes;
    var tetoEmbalagemParaMargemZero = margemSemEmbalagem;
    var tetoEmbalagemParaMetaPct =
      liquidoAposTaxa - custoVariavelSemEmbalagem - precoVenda * (metaMargemPct / 100);

    var result = {
      ok: true,
      error: null,
      precoVenda: precoVenda,
      taxaMarketplacePct: taxaMarketplacePct,
      custoProduto: custoProduto,
      fretePagoPeloSeller: fretePagoPeloSeller,
      custoEmbalagemUnit: custoEmbalagemUnit,
      vendasPorMes: vendasPorMes,
      metaMargemPct: metaMargemPct,
      caixa: caixa,
      fita: fita,
      protecao: protecao,
      etiqueta: etiqueta,
      liquidoAposTaxa: liquidoAposTaxa,
      custoVariavelSemEmbalagem: custoVariavelSemEmbalagem,
      margemSemEmbalagem: margemSemEmbalagem,
      margemComEmbalagem: margemComEmbalagem,
      embalagemPctSobrePreco: embalagemPctSobrePreco,
      embalagemPctSobreMargem: embalagemPctSobreMargem,
      impactoMes: impactoMes,
      perdaMargemMes: perdaMargemMes,
      tetoEmbalagemParaMargemZero: tetoEmbalagemParaMargemZero,
      tetoEmbalagemParaMetaPct: tetoEmbalagemParaMetaPct,
      badge: "AMARELO",
      advice: "",
      disclaimer: disclaimer,
      copyText: ""
    };
    result.badge = badgeCustoEmbalagem(result);
    result.advice = buildCustoEmbalagemAdvice(result);
    result.copyText = joinCustoEmbalagemCopy(result);
    return result;
  }

  function mountCustoEmbalagem(root) {
    if (!root || typeof document === "undefined") return;
    root.innerHTML = "";
    root.classList.add("freightgen", "tacosgen", "custoembalagemgen");

    var panel = el("div", { class: "freightgen__panel titlegen__panel" });
    panel.appendChild(
      el("p", { class: "freightgen__kicker titlegen__kicker" }, "Custo de embalagem · ESTIMATIVA")
    );
    panel.appendChild(
      el(
        "h2",
        { class: "freightgen__title titlegen__title" },
        "Quanto a embalagem come da margem — e qual o teto para não furar o lucro?"
      )
    );

    var fields = el("div", { class: "freightgen__fields titlegen__fields" });
    fields.appendChild(
      field({
        id: "ce-preco",
        label: "Preço de venda (R$)",
        value: "89",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "ce-taxa",
        label: "Taxa do marketplace (%)",
        value: "16",
        step: "0.01",
        min: "0",
        placeholder: "padrão 16%"
      })
    );
    fields.appendChild(
      field({
        id: "ce-custo",
        label: "Custo do produto (R$)",
        value: "35",
        step: "0.01",
        min: "0"
      })
    );
    fields.appendChild(
      field({
        id: "ce-frete",
        label: "Frete pago pelo seller (R$)",
        value: "12",
        step: "0.01",
        min: "0",
        placeholder: "padrão 12"
      })
    );
    fields.appendChild(
      field({
        id: "ce-emb",
        label: "Custo embalagem / un (R$)",
        value: "3.5",
        step: "0.01",
        min: "0",
        placeholder: "caixa+fita+plástico+etiqueta"
      })
    );
    fields.appendChild(
      field({
        id: "ce-vendas",
        label: "Vendas por mês",
        value: "200",
        step: "1",
        min: "0",
        placeholder: "padrão 200"
      })
    );
    fields.appendChild(
      field({
        id: "ce-meta",
        label: "Meta de margem (% do preço)",
        value: "15",
        step: "0.01",
        min: "0",
        placeholder: "padrão 15%"
      })
    );
    fields.appendChild(
      field({
        id: "ce-caixa",
        label: "Caixa / saco (R$) — opcional",
        value: "",
        step: "0.01",
        min: "0",
        placeholder: "soma no total"
      })
    );
    fields.appendChild(
      field({
        id: "ce-fita",
        label: "Fita (R$) — opcional",
        value: "",
        step: "0.01",
        min: "0",
        placeholder: "soma no total"
      })
    );
    fields.appendChild(
      field({
        id: "ce-protecao",
        label: "Proteção / plástico (R$) — opcional",
        value: "",
        step: "0.01",
        min: "0",
        placeholder: "soma no total"
      })
    );
    fields.appendChild(
      field({
        id: "ce-etiqueta",
        label: "Etiqueta (R$) — opcional",
        value: "",
        step: "0.01",
        min: "0",
        placeholder: "soma no total"
      })
    );
    panel.appendChild(fields);
    panel.appendChild(
      el(
        "p",
        { class: "freightgen__hint titlegen__hint" },
        "Se preencher o breakdown (caixa/fita/proteção/etiqueta), o total de embalagem vira a soma. Margem c/ embalagem = (líquido após taxa − produto − frete) − embalagem. ESTIMATIVA."
      )
    );
    root.appendChild(panel);

    var out = el("div", { class: "freightgen__out", "aria-live": "polite" });
    root.appendChild(out);

    function anyPartsFilled() {
      return ["ce-caixa", "ce-fita", "ce-protecao", "ce-etiqueta"].some(function (id) {
        var n = document.getElementById(id);
        return n && String(n.value).trim() !== "";
      });
    }

    function syncFromParts() {
      if (!anyPartsFilled()) return;
      var sum = 0;
      ["ce-caixa", "ce-fita", "ce-protecao", "ce-etiqueta"].forEach(function (id) {
        var n = document.getElementById(id);
        var v = n && String(n.value).trim() !== "" ? toNumber(n.value) : 0;
        if (v === v) sum += v;
      });
      var emb = document.getElementById("ce-emb");
      if (emb) emb.value = String(Math.round(sum * 100) / 100);
    }

    function read() {
      var taxaRaw = document.getElementById("ce-taxa").value;
      var freteRaw = document.getElementById("ce-frete").value;
      var vendasRaw = document.getElementById("ce-vendas").value;
      var metaRaw = document.getElementById("ce-meta").value;
      var payload = {
        precoVenda: document.getElementById("ce-preco").value,
        taxaMarketplacePct: taxaRaw === "" ? undefined : taxaRaw,
        custoProduto: document.getElementById("ce-custo").value,
        fretePagoPeloSeller: freteRaw === "" ? undefined : freteRaw,
        vendasPorMes: vendasRaw === "" ? undefined : vendasRaw,
        metaMargemPct: metaRaw === "" ? undefined : metaRaw
      };
      if (anyPartsFilled()) {
        var caixa = document.getElementById("ce-caixa").value;
        var fita = document.getElementById("ce-fita").value;
        var protecao = document.getElementById("ce-protecao").value;
        var etiqueta = document.getElementById("ce-etiqueta").value;
        if (caixa !== "") payload.caixa = caixa;
        if (fita !== "") payload.fita = fita;
        if (protecao !== "") payload.protecao = protecao;
        if (etiqueta !== "") payload.etiqueta = etiqueta;
      } else {
        payload.custoEmbalagemUnit = document.getElementById("ce-emb").value;
      }
      return payload;
    }

    function render() {
      var r = calculateCustoEmbalagem(read());
      out.innerHTML = "";
      var loss = !r.ok || r.badge === "VERMELHO";
      var card = el(
        "article",
        { class: "result-card" + (loss ? " result-card--loss" : "") }
      );
      card.appendChild(
        el(
          "p",
          { class: "result-card__label" },
          "Custo de embalagem · " + (r.badge || "—") + " · ESTIMATIVA"
        )
      );
      if (!r.ok) {
        card.appendChild(el("p", { class: "result-card__price is-loss" }, "—"));
        card.appendChild(el("p", { class: "result-card__hint" }, r.error || "Dados incompletos"));
      } else {
        var headline =
          formatBRL(r.margemComEmbalagem) +
          " margem · " +
          (Math.round(r.embalagemPctSobrePreco * 100) / 100).toLocaleString("pt-BR") +
          "% do preço";
        card.appendChild(
          el(
            "p",
            { class: "result-card__price" + (loss ? " is-loss" : "") },
            headline
          )
        );
        var grid = el("div", { class: "result-card__grid" });
        function row(k, v) {
          var d = el("div");
          d.appendChild(el("span", { class: "muted" }, k));
          d.appendChild(el("strong", null, v));
          grid.appendChild(d);
        }
        row("Líquido após taxa", formatBRL(r.liquidoAposTaxa));
        row("Custo variável s/ embalagem", formatBRL(r.custoVariavelSemEmbalagem));
        row("Margem s/ embalagem", formatBRL(r.margemSemEmbalagem));
        row("Custo embalagem / un", formatBRL(r.custoEmbalagemUnit));
        row("Margem c/ embalagem", formatBRL(r.margemComEmbalagem));
        row(
          "Embalagem % preço",
          (Math.round(r.embalagemPctSobrePreco * 100) / 100).toLocaleString("pt-BR") + "%"
        );
        row(
          "Embalagem % margem",
          r.embalagemPctSobreMargem == null
            ? "—"
            : (Math.round(r.embalagemPctSobreMargem * 100) / 100).toLocaleString("pt-BR") + "%"
        );
        row("Impacto / mês", formatBRL(r.impactoMes));
        row("Teto (margem zero)", formatBRL(r.tetoEmbalagemParaMargemZero));
        row(
          "Teto (meta " + (Math.round(r.metaMargemPct * 100) / 100) + "%)",
          formatBRL(r.tetoEmbalagemParaMetaPct)
        );
        row("Badge", r.badge || "—");
        card.appendChild(grid);
        card.appendChild(el("p", { class: "result-card__hint" }, r.advice));
      }
      out.appendChild(card);

      var actions = el("div", { class: "freightgen__actions" });
      var btn = el("button", { type: "button", class: "btn btn--solid" }, "Copiar resumo");
      btn.addEventListener("click", function () {
        var text = r.copyText || joinCustoEmbalagemCopy(r);
        copyText(text)
          .then(function () {
            toast("Resumo copiado.");
          })
          .catch(function () {
            toast("Copia o resumo na mão.");
          });
      });
      actions.appendChild(btn);
      out.appendChild(actions);
    }

    ["ce-caixa", "ce-fita", "ce-protecao", "ce-etiqueta"].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", function () {
          syncFromParts();
          render();
        });
        node.addEventListener("change", function () {
          syncFromParts();
          render();
        });
      }
    });

    [
      "ce-preco",
      "ce-taxa",
      "ce-custo",
      "ce-frete",
      "ce-emb",
      "ce-vendas",
      "ce-meta"
    ].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) {
        node.addEventListener("input", render);
        node.addEventListener("change", render);
      }
    });
    render();
  }


  function wireGlobalUi() {
    document.querySelectorAll("[data-precifica-calc]").forEach(function (node) {
      mountCalculator(node, { preset: node.getAttribute("data-preset") || "" });
    });

    document.querySelectorAll("[data-precifica-compare]").forEach(function (node) {
      mountCompare(node);
    });

    document.querySelectorAll("[data-precifica-title]").forEach(function (node) {
      mountTitle(node);
    });

    document.querySelectorAll("[data-precifica-freight]").forEach(function (node) {
      mountFreight(node);
    });

    document.querySelectorAll("[data-precifica-desc]").forEach(function (node) {
      mountDesc(node);
    });

    document.querySelectorAll("[data-precifica-sheet]").forEach(function (node) {
      mountSheet(node);
    });

    document.querySelectorAll("[data-precifica-equilibrio]").forEach(function (node) {
      mountEquilibrium(node);
    });

    document.querySelectorAll("[data-precifica-tacos]").forEach(function (node) {
      mountTacos(node);
    });

    document.querySelectorAll("[data-precifica-keywords]").forEach(function (node) {
      mountKeywords(node);
    });

    document.querySelectorAll("[data-precifica-kit]").forEach(function (node) {
      mountKitCombo(node);
    });

    document.querySelectorAll("[data-precifica-bullets]").forEach(function (node) {
      mountAmazonBullets(node);
    });

    document.querySelectorAll("[data-precifica-bid]").forEach(function (node) {
      mountMlBid(node);
    });

    document.querySelectorAll("[data-precifica-variacoes]").forEach(function (node) {
      mountMlVariations(node);
    });

    document.querySelectorAll("[data-precifica-ab-titulo]").forEach(function (node) {
      mountAbTitleTest(node);
    });

    document.querySelectorAll("[data-precifica-faq]").forEach(function (node) {
      mountListingFaq(node);
    });

    document.querySelectorAll("[data-precifica-campanhas]").forEach(function (node) {
      mountAdCampaigns(node);
    });

    document.querySelectorAll("[data-precifica-preco-minimo]").forEach(function (node) {
      mountPrecoMinimoAds(node);
    });

    document.querySelectorAll("[data-precifica-checklist]").forEach(function (node) {
      mountChecklistAnuncio(node);
    });

    document.querySelectorAll("[data-precifica-breakeven-ads]").forEach(function (node) {
      mountBreakevenAds(node);
    });

    document.querySelectorAll("[data-precifica-roi-frete-gratis]").forEach(function (node) {
      mountRoiFreteGratis(node);
    });

    document.querySelectorAll("[data-precifica-desconto-maximo]").forEach(function (node) {
      mountDescontoMaximo(node);
    });

    document.querySelectorAll("[data-precifica-meta-lucro]").forEach(function (node) {
      mountMetaLucro(node);
    });

    document.querySelectorAll("[data-precifica-estoque-minimo]").forEach(function (node) {
      mountEstoqueMinimo(node);
    });

    document.querySelectorAll("[data-precifica-imposto-simples]").forEach(function (node) {
      mountImpostoSimples(node);
    });

    document.querySelectorAll("[data-precifica-capital-giro]").forEach(function (node) {
      mountCapitalGiro(node);
    });

    document.querySelectorAll("[data-precifica-custo-devolucao]").forEach(function (node) {
      mountCustoDevolucao(node);
    });

    document.querySelectorAll("[data-precifica-prazo-repasse]").forEach(function (node) {
      mountPrazoRepasse(node);
    });

    document.querySelectorAll("[data-precifica-custo-embalagem]").forEach(function (node) {
      mountCustoEmbalagem(node);
    });


    document.querySelectorAll("[data-pix-key]").forEach(function (node) {
      node.textContent = pixKey();
    });

    document.querySelectorAll("[data-copy-pix]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        copyText(pixKey())
          .then(function () {
            toast("Chave PIX copiada.");
          })
          .catch(function () {
            toast("Copia a chave PIX na mão.");
          });
      });
    });

    var modal = document.getElementById("pdf-modal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closePdfNudge();
      });
      var printBtn = modal.querySelector("[data-print]");
      var close = modal.querySelector("[data-print-close]");
      if (printBtn) {
        printBtn.addEventListener("click", function () {
          closePdfNudge();
          window.print();
        });
      }
      if (close) close.addEventListener("click", closePdfNudge);
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePdfNudge();
    });

    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wireGlobalUi);
    } else {
      wireGlobalUi();
    }
  }

  return {
    PRESETS: PRESETS,
    FEE_DISCLAIMER: FEE_DISCLAIMER,
    ML_SIMULATOR: ML_SIMULATOR,
    ML_BANDS: ML_BANDS,
    PIX_KEY: PIX_KEY,
    pixKey: pixKey,
    toNumber: toNumber,
    costTotal: costTotal,
    feeParamsFor: feeParamsFor,
    marketplaceFeeReais: marketplaceFeeReais,
    forwardByMargin: forwardByMargin,
    forwardByProfit: forwardByProfit,
    reverse: reverseCalc,
    calculate: calculate,
    formatBRL: formatBRL,
    formatPct: formatPct,
    buildSummary: buildSummary,
    runTests: runTests,
    mountCalculator: mountCalculator,
    mountCompare: mountCompare,
    mountTitle: mountTitle,
    mountFreight: mountFreight,
    mountDesc: mountDesc,
    mountSheet: mountSheet,
    mountEquilibrium: mountEquilibrium,
    mountTacos: mountTacos,
    acosPct: acosPct,
    tacosPct: tacosPct,
    profitAfterAds: profitAfterAds,
    maxAdSpendAtMargin: maxAdSpendAtMargin,
    calculateTacos: calculateTacos,
    contributionPerUnit: contributionPerUnit,
    breakEvenUnits: breakEvenUnits,
    projectedProfit: projectedProfit,
    calculateEquilibrium: calculateEquilibrium,
    parseSheet: parseSheet,
    priceSheet: priceSheet,
    sheetToCsv: sheetToCsv,
    sheetToCsvBom: sheetToCsvBom,
    SHEET_MAX: SHEET_MAX,
    generateMlTitles: generateMlTitles,
    generateMlKeywords: generateMlKeywords,
    mountKeywords: mountKeywords,
    priceKitCombo: priceKitCombo,
    mountKitCombo: mountKitCombo,
    generateAmazonBullets: generateAmazonBullets,
    mountAmazonBullets: mountAmazonBullets,
    joinAmazonBulletsCopy: joinAmazonBulletsCopy,
    simulateMlBid: simulateMlBid,
    estimateMlBid: estimateMlBid,
    mountMlBid: mountMlBid,
    generateMlVariations: generateMlVariations,
    mountMlVariations: mountMlVariations,
    joinMlVariationBlock: joinMlVariationBlock,
    scoreAbTitles: scoreAbTitles,
    mountAbTitleTest: mountAbTitleTest,
    joinAbChecklist: joinAbChecklist,
    generateListingFaq: generateListingFaq,
    mountListingFaq: mountListingFaq,
    joinListingFaqCopy: joinListingFaqCopy,
    compareAdCampaigns: compareAdCampaigns,
    mountAdCampaigns: mountAdCampaigns,
    joinAdCampaignsCopy: joinAdCampaignsCopy,
    calculatePrecoMinimoAds: calculatePrecoMinimoAds,
    mountPrecoMinimoAds: mountPrecoMinimoAds,
    joinPrecoMinimoAdsCopy: joinPrecoMinimoAdsCopy,
    defaultTaxaPrecoMinimoAds: defaultTaxaPrecoMinimoAds,
    checklistAnuncioItems: checklistAnuncioItems,
    calculateChecklistAnuncio: calculateChecklistAnuncio,
    mountChecklistAnuncio: mountChecklistAnuncio,
    joinChecklistAnuncioCopy: joinChecklistAnuncioCopy,
    badgeChecklistAnuncio: badgeChecklistAnuncio,
    calculateBreakevenAds: calculateBreakevenAds,
    mountBreakevenAds: mountBreakevenAds,
    joinBreakevenAdsCopy: joinBreakevenAdsCopy,
    badgeBreakevenAds: badgeBreakevenAds,
    calculateRoiFreteGratis: calculateRoiFreteGratis,
    mountRoiFreteGratis: mountRoiFreteGratis,
    joinRoiFreteGratisCopy: joinRoiFreteGratisCopy,
    badgeRoiFreteGratis: badgeRoiFreteGratis,
    calculateDescontoMaximo: calculateDescontoMaximo,
    mountDescontoMaximo: mountDescontoMaximo,
    joinDescontoMaximoCopy: joinDescontoMaximoCopy,
    badgeDescontoMaximo: badgeDescontoMaximo,
    calculateMetaLucro: calculateMetaLucro,
    mountMetaLucro: mountMetaLucro,
    joinMetaLucroCopy: joinMetaLucroCopy,
    badgeMetaLucro: badgeMetaLucro,
    calculateEstoqueMinimo: calculateEstoqueMinimo,
    mountEstoqueMinimo: mountEstoqueMinimo,
    joinEstoqueMinimoCopy: joinEstoqueMinimoCopy,
    badgeEstoqueMinimo: badgeEstoqueMinimo,
    calculateImpostoSimples: calculateImpostoSimples,
    mountImpostoSimples: mountImpostoSimples,
    joinImpostoSimplesCopy: joinImpostoSimplesCopy,
    badgeImpostoSimples: badgeImpostoSimples,
    calculateCapitalGiro: calculateCapitalGiro,
    mountCapitalGiro: mountCapitalGiro,
    joinCapitalGiroCopy: joinCapitalGiroCopy,
    badgeCapitalGiro: badgeCapitalGiro,
    calculateCustoDevolucao: calculateCustoDevolucao,
    mountCustoDevolucao: mountCustoDevolucao,
    joinCustoDevolucaoCopy: joinCustoDevolucaoCopy,
    badgeCustoDevolucao: badgeCustoDevolucao,
    buildCustoDevolucaoAdvice: buildCustoDevolucaoAdvice,
    calculatePrazoRepasse: calculatePrazoRepasse,
    mountPrazoRepasse: mountPrazoRepasse,
    joinPrazoRepasseCopy: joinPrazoRepasseCopy,
    badgePrazoRepasse: badgePrazoRepasse,
    buildPrazoRepasseAdvice: buildPrazoRepasseAdvice,
    calculateCustoEmbalagem: calculateCustoEmbalagem,
    mountCustoEmbalagem: mountCustoEmbalagem,
    joinCustoEmbalagemCopy: joinCustoEmbalagemCopy,
    badgeCustoEmbalagem: badgeCustoEmbalagem,
    buildCustoEmbalagemAdvice: buildCustoEmbalagemAdvice,
    HOOK_MAX: HOOK_MAX,
    AMAZON_BULLET_SOFT: AMAZON_BULLET_SOFT,
    AMAZON_BULLET_HARD: AMAZON_BULLET_HARD,
    generateDescriptions: generateDescriptions,
    TITLE_MAX: TITLE_MAX,
    DESC_ML_MAX: DESC_ML_MAX,
    DESC_SHOPEE_MAX: DESC_SHOPEE_MAX,
    DESC_PREVIEW_MAX: DESC_PREVIEW_MAX,
    shopeeBands: shopeeBands,
    cubedKg: cubedKg,
    cubedWeight: cubedWeight,
    billedKg: billedKg,
    billedWeight: billedWeight,
    estimateFreightBRL: estimateFreightBRL,
    mlFreeShippingLikely: mlFreeShippingLikely,
    embedFreightInPrice: embedFreightInPrice,
    calculateFreight: calculateFreight,
    ML_FREE_SHIPPING_THRESHOLD: ML_FREE_SHIPPING_THRESHOLD
  };
});
