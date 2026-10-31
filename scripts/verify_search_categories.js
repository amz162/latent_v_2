// Verify: StockSearch shows category chips; no React key warnings anywhere.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const warnings = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (/unique.*key|key prop/i.test(t)) warnings.push(t.slice(0, 300));
  });
  await page.goto("http://localhost:3000/?tab=signals_v2", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  const input = page.locator('input[placeholder*="Search stock" i]').first();
  await input.waitFor({ timeout: 10000 });
  await input.click({ timeout: 8000 });
  await input.fill("KASBM");
  await page.waitForTimeout(2000);
  const chip = await page.locator('span[title*="Modaraba"], span:has-text("MODARABAS")').first();
  const chipText = (await chip.count()) ? await chip.textContent() : "NO CHIP FOUND";
  console.log("KASBM chip:", JSON.stringify(chipText));
  // also check a government security + right + TFC render with categories
  for (const sym of ["12TB5", "MUGHALSC", "PIAA"]) {
    await input.fill(sym);
    await page.waitForTimeout(1500);
    const chips = await page.locator('span[title]').allTextContents();
    console.log(sym, "chips:", chips.slice(0, 3));
  }
  // AI Models tab: key-warning check after the key hardening
  await page.goto("http://localhost:3000/?tab=ai_model_signals", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log("KEY WARNINGS:", warnings.length);
  warnings.slice(0, 4).forEach((w) => console.log("WARN:", w.replace(/\n/g, " ")));
  await browser.close();
})();
