// Verify: StockSearch shows category chips; no React key warnings on AI Models view.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const warnings = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (/unique.*key|key prop/i.test(t)) warnings.push(t.slice(0, 300));
  });
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  // enter the platform from the landing page
  const enter = page.locator("button:has-text('Enter'), a:has-text('Enter')").first();
  if (await enter.count()) { await enter.click({ timeout: 8000 }); await page.waitForTimeout(2500); }
  // open a view that renders StockSearch inline (Pattern Finder)
  const navBtn = page.locator("aside button").nth(6); // pattern_finder in NAV_ITEMS order
  await navBtn.click({ timeout: 8000 }).catch(async () => {
    await page.locator("text=Pattern").first().click({ timeout: 8000 });
  });
  await page.waitForTimeout(3000);
  const input = page.locator('input[placeholder*="PSX" i], input[placeholder*="Search stock" i], input[placeholder*="Search any" i]').first();
  await input.waitFor({ timeout: 12000 });
  await input.click();
  for (const sym of ["KASBM", "12TB5", "MUGHALSC", "PIAA"]) {
    await input.fill(sym);
    await page.waitForTimeout(1800);
    const chips = await page.locator("span[title]").allTextContents();
    const rows = await page.locator("button:has(span.font-mono)").allTextContents();
    console.log(sym, "→ rows:", JSON.stringify(rows.slice(0, 3)), "chips:", JSON.stringify(chips.slice(0, 3)));
  }
  // AI Models view — key-warning check
  await page.locator("aside button").nth(4).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(6000);
  console.log("KEY WARNINGS:", warnings.length);
  warnings.slice(0, 4).forEach((w) => console.log("WARN:", w.replace(/\n/g, " ")));
  await browser.close();
})();
