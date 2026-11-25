import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const out = process.argv[2];
const BASE = process.argv[3];
const list = JSON.parse(readFileSync("outputs/comptes-demo.json", "utf8"));
const a = (Array.isArray(list) ? list : Object.values(list)).find((x) => x.email === "demo-vendeuse@annona.fr");
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 180000 });
await p.locator('input[type="email"]').fill(a.email);
await p.locator('input[name="password"]').fill(a.password);
await p.getByRole("button", { name: "Se connecter" }).click();
await p.waitForURL((u) => u.pathname.startsWith("/shop"), { timeout: 180000, waitUntil: "commit" });
for (const path of ["/shop", "/shop/reception", "/shop/closing", "/shop/stock", "/shop/cakes", "/shop/settings"]) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForTimeout(800);
  // Paires d'éléments de texte visibles dont les boîtes se recouvrent (feuilles de texte seulement).
  const overlaps = await p.evaluate(() => {
    const leaves = [...document.querySelectorAll("main *, header *")].filter((el) => {
      if (!el.childNodes.length) return false;
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return text && r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.opacity !== "0";
    });
    const boxes = leaves.map((el) => ({ el, r: el.getBoundingClientRect(), t: el.textContent.trim().replace(/\s+/g, " ").slice(0, 40) }));
    const found = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (w > 4 && h > 4) found.push(`« ${A.t} » × « ${B.t} » (${Math.round(w)}×${Math.round(h)} px)`);
    }
    return found.slice(0, 6);
  });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await p.screenshot({ path: `${out}/pdv-tel${path.replace(/\//g, "-")}.png`, fullPage: true });
  console.log(path, "| débordement", overflow, "| chevauchements", overlaps.length, overlaps.join(" ; "));
}
await b.close();
