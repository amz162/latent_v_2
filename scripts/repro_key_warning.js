// Repro: capture React "unique key prop" warnings on the AI Models tab.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const warnings = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (/unique.*key|key prop/i.test(t)) warnings.push(t.slice(0, 400));
  });
  await page.goto("http://localhost:3000/?tab=ai_model_signals", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(6000);
  // scroll through the page to force all lazy renders
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(3000);
  console.log("KEY WARNINGS:", warnings.length);
  warnings.slice(0, 6).forEach((w, i) => console.log(`[${i}]`, w.replace(/\n/g, " | ")));
  await browser.close();
})();
