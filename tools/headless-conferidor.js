// Checagem headless do conferidor: node tools/headless-conferidor.js <BASE_URL> [screenshot.png]
const { chromium } = require("/usr/local/lib/node_modules/playwright-core");
const path = require("path");
const BASE = (process.argv[2] || "http://127.0.0.1:8765").replace(/\/$/, "");
const SHOT = process.argv[3];
const EX = path.join(__dirname, "..", "exemplos");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const out = { base: BASE };
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    const resp = await page.goto(BASE + "/conferidor-repasse-ml.html", { waitUntil: "load" });
    out.status = resp.status();
    out.privacy = await page.textContent("[data-cr-privacy]");
    out.pixKey = (await page.textContent("[data-pix-key]")).trim();
    // 1) botão de exemplo
    await page.click("[data-cr-example]");
    await page.waitForSelector("[data-conferidor-repasse][data-state=done]", { timeout: 15000 });
    out.example = {
      total: (await page.textContent("[data-cr-total]")).trim(),
      rows: await page.$$eval("[data-cr-table] tbody tr", (t) => t.map((r) => r.getAttribute("data-status"))),
      checks: await page.$$eval("[data-cr-checks] li", (l) => l.length),
      status: (await page.textContent("[data-cr-status]")).trim()
    };
    // 2) upload real de arquivos (XLSX + CSV), contando requisições de rede durante a conferência
    await page.click("text=Limpar");
    const reqs = [];
    page.on("request", (r) => reqs.push(r.url()));
    await page.setInputFiles("[data-cr-input=venda]", path.join(EX, "conferidor-ml-exemplo-por-venda.xlsx"));
    await page.setInputFiles("[data-cr-input=liberacao]", path.join(EX, "conferidor-ml-exemplo-por-liberacao.csv"));
    await page.waitForSelector("[data-conferidor-repasse][data-state=done]", { timeout: 15000 });
    out.upload = {
      total: (await page.textContent("[data-cr-total]")).trim(),
      rows: await page.$$eval("[data-cr-table] tbody tr", (t) => t.length),
      requests: reqs
    };
    // 3) download do CSV
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-cr-download]")]);
    out.download = dl.suggestedFilename();
    if (SHOT) await page.screenshot({ path: SHOT, fullPage: false });
    out.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    out.errors = errors;
    const offsite = reqs.filter((u) => !u.startsWith(BASE) && !u.startsWith("blob:") && !u.startsWith("data:"));
    out.pass = out.status === 200 && /não saem do navegador/.test(out.privacy) && out.example.rows.length === 14 &&
      out.example.rows[0] === "atrasada" && out.example.checks === 2 && out.upload.rows === 14 &&
      out.example.total === out.upload.total && offsite.length === 0 && errors.length === 0 && !out.overflowX;
    out.offsite = offsite;
  } catch (e) { out.error = String(e); out.pass = false; }
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.pass ? 0 : 1);
})();
