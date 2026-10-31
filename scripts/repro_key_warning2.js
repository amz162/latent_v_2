// Repro 2: visit every tab, interact with StockSearch inputs, capture key warnings.
const { chromium } = require("playwright");

const TABS = ["", "signals_v2", "portfolio", "technical_analysis", "ai_model_signals",
  "calculators", "pattern_finder", "pattern_finder_financial", "dividends", "strategy", "execute", "tracker"];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const warnings = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (/unique.*key|key prop/i.test(t)) warnings.push(t.slice(0, 500));
  });
  for (const tab of TABS) {
    const url = tab ? `http://localhost:3000/?tab=${tab}` : "http://localhost:3000/";
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2500);
      // open any stock-search input and type to force dropdown render
      const input = page.locator('input[placeholder*="Search stock"], input[placeholder*="symbol" i], input[placeholder*="Search" i]').first();
      if (await input.count() > 0) {
        try {
          await input.click({ timeout: 4000 });
          await input.fill("ENGR", { timeout: 4000 });
          await page.waitForTimeout(1500);
          await input.fill("", { timeout: 2000 });
          await page.keyboard.press("Escape");
        } catch {}
      }
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1200);
    } catch (e) { console.log("tab error", tab, String(e).slice(0, 80)); }
  }
  console.log("KEY WARNINGS TOTAL:", warnings.length);
  const uniq = [...new Set(warnings)];
  uniq.slice(0, 8).forEach((w, i) => console.log(`[${i}]`, w.replace(/\n/g, " | ")));
  await browser.close();
})();
