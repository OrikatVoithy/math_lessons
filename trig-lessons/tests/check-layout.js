// Layout check for every lesson page.
//
//   node tests/check-layout.js
//
// Builds the site (build.sh), then opens each built page at desktop and phone width, in light
// and dark theme. Every page lists the drawings it can show through window.__layoutTest
// (cases + show), and the check draws all of them. It fails if any label overlaps another
// label or a line, any label spills outside its picture, the page scrolls sideways, a text
// colour is too faint to read, or a script throws. Screenshots go to tests/out/.
//
// Needs Playwright with Chromium (preinstalled in Claude Code cloud sessions; elsewhere:
// npm i -D playwright && npx playwright install chromium).

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

execFileSync("sh", [path.join(root, "build.sh")], { stdio: "inherit" });
const pages = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (f === "index.html") pages.push(full);
  }
})(path.join(root, "dist"));
pages.sort();

// Runs inside the page: problems in the <svg>s on screen (all, or only those with the given ids).
function auditSvgs(context, onlyIds) {
  const problems = [];
  const PAD = 1.5; // ignore touches smaller than this many SVG units
  const toRoot = (svg, node) => svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
  const apply = (m, x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
  function textQuad(svg, t) {
    const b = t.getBBox();
    if (!b.width || !b.height) return null;
    const m = toRoot(svg, t);
    const x0 = b.x + PAD, y0 = b.y + PAD, x1 = b.x + b.width - PAD, y1 = b.y + b.height - PAD;
    return [apply(m, x0, y0), apply(m, x1, y0), apply(m, x1, y1), apply(m, x0, y1)];
  }
  function circleQuad(svg, c) {
    const m = toRoot(svg, c), r = +c.getAttribute("r") - PAD, cx = +c.getAttribute("cx"), cy = +c.getAttribute("cy");
    return [apply(m, cx - r, cy - r), apply(m, cx + r, cy - r), apply(m, cx + r, cy + r), apply(m, cx - r, cy + r)];
  }
  const axesOf = (q) => q.map((p, i) => { const n = q[(i + 1) % q.length]; return { x: -(n.y - p.y), y: n.x - p.x }; });
  function overlaps(q1, q2) { // separating axis test for convex polygons
    for (const ax of [...axesOf(q1), ...axesOf(q2)]) {
      const pr = (q) => q.map((p) => p.x * ax.x + p.y * ax.y);
      const a = pr(q1), b = pr(q2);
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
    }
    return true;
  }
  function segHitsQuad(s, q) { // the line as a thin rectangle of its stroke width
    const len = Math.hypot(s.q.x - s.p.x, s.q.y - s.p.y);
    if (len < 0.5) return false;
    const nx = -(s.q.y - s.p.y) / len * s.w / 2, ny = (s.q.x - s.p.x) / len * s.w / 2;
    return overlaps([{ x: s.p.x + nx, y: s.p.y + ny }, { x: s.q.x + nx, y: s.q.y + ny }, { x: s.q.x - nx, y: s.q.y - ny }, { x: s.p.x - nx, y: s.p.y - ny }], q);
  }
  const svgs = onlyIds ? onlyIds.map((id) => document.getElementById(id)).filter(Boolean) : [...document.querySelectorAll("svg[viewBox]")];
  svgs.forEach((svg, si) => {
    if (!svg.getClientRects().length) return;
    const name = svg.id || svg.getAttribute("aria-label")?.slice(0, 40) || `svg#${si}`;
    const vb = svg.viewBox.baseVal;
    const texts = [...svg.querySelectorAll("text")].map((t) => ({ q: textQuad(svg, t), label: t.textContent.trim() })).filter((x) => x.q);
    const lines = [...svg.querySelectorAll("line")].map((l) => {
      const m = toRoot(svg, l);
      return { p: apply(m, +l.getAttribute("x1"), +l.getAttribute("y1")), q: apply(m, +l.getAttribute("x2"), +l.getAttribute("y2")), w: +(l.getAttribute("stroke-width") || 1) };
    });
    const handles = [...svg.querySelectorAll("circle.handle")].map((c) => circleQuad(svg, c));
    for (const a of texts) {
      if (a.q.some((p) => p.x < vb.x - 0.5 || p.y < vb.y - 0.5 || p.x > vb.x + vb.width + 0.5 || p.y > vb.y + vb.height + 0.5))
        problems.push(`${context} [${name}] "${a.label}" goes outside the picture`);
      if (lines.some((l) => segHitsQuad(l, a.q))) problems.push(`${context} [${name}] "${a.label}" touches a line`);
      if (handles.some((h) => overlaps(h, a.q))) problems.push(`${context} [${name}] "${a.label}" is under the drag handle`);
    }
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++)
        if (overlaps(texts[i].q, texts[j].q)) problems.push(`${context} [${name}] "${texts[i].label}" overlaps "${texts[j].label}"`);
  });
  if (document.documentElement.scrollWidth > innerWidth) problems.push(`${context} page scrolls sideways (${document.documentElement.scrollWidth}px > ${innerWidth}px)`);
  return problems;
}

// Runs inside the page: contrast of every text colour token against the backgrounds it sits on.
function auditContrast(context) {
  const css = getComputedStyle(document.documentElement);
  const hex = (n) => css.getPropertyValue(n).trim();
  const lum = (h) => {
    const v = h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [
    ["--ink", "--paper", 4.5], ["--ink", "--surface", 4.5], ["--muted", "--paper", 4.5], ["--muted", "--surface", 4.5],
    ["--opp", "--surface", 3], ["--adj", "--surface", 3], ["--hyp", "--surface", 3], ["--angle", "--surface", 3],
    ["--opp", "--paper", 3], ["--adj", "--paper", 3], ["--hyp", "--paper", 3], ["--angle", "--paper", 3],
    ["--good", "--good-bg", 4.5], ["--bad", "--bad-bg", 4.5], ["--surface", "--ink", 4.5],
  ];
  return pairs.filter(([f, b, min]) => ratio(f, b) < min).map(([f, b, min]) => `${context}: ${f} on ${b} contrast ${ratio(f, b).toFixed(2)} (needs ${min})`);
}

// Runs inside the page: the colours as actually drawn. Every visible piece of text (page text and
// SVG labels) is compared with the background behind it. Catches a missing colour rule, where
// text falls back to black on the dark theme.
function auditDrawnContrast(context) {
  const rgb = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: v.slice(0, 3), a: v.length > 3 ? v[3] : 1 }; };
  const lum = (v) => { const [r, g, b] = v.map((x) => x / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      if (e instanceof SVGElement && !(e instanceof SVGSVGElement)) continue;
      const b = rgb(getComputedStyle(e).backgroundColor);
      if (b && b.a > 0.5) return b.c;
    }
    return rgb(getComputedStyle(document.body).backgroundColor).c;
  };
  const seen = new Set(), out = [];
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]"); };
  const check = (e, colour, label) => {
    const f = rgb(colour);
    if (!f || f.a < 0.5) return;
    const r = ratio(f.c, bgOf(e));
    const key = label + colour;
    if (r < 3 && !seen.has(key)) { seen.add(key); out.push(`${context}: "${label}" is hard to read (${colour}, contrast ${r.toFixed(2)})`); }
  };
  document.querySelectorAll("svg text").forEach((t) => { if (visible(t) && t.textContent.trim()) check(t, getComputedStyle(t).fill, t.textContent.trim().slice(0, 30)); });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const e = n.parentElement;
    if (!n.textContent.trim() || !e || e.closest("svg, script, style") || !visible(e)) continue;
    check(e, getComputedStyle(e).color, n.textContent.trim().slice(0, 30));
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  let drawings = 0;
  for (const file of pages) {
    const pageName = path.relative(path.join(root, "dist"), path.dirname(file)) || "level-1";
    for (const [width, label] of [[1100, "desktop"], [390, "phone"]]) {
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
        const ctx = `${pageName} ${label}/${theme}`;
        page.on("pageerror", (e) => problems.push(`${ctx} script error: ${e.message}`));
        await page.goto("file://" + file);
        await page.waitForTimeout(400);
        await page.evaluate(`window.__audit = ${auditSvgs.toString()}`);
        // Pages that show content in stages (one step at a time) reveal everything for the check.
        await page.evaluate(() => window.__layoutTest && window.__layoutTest.prepare && window.__layoutTest.prepare());
        await page.waitForTimeout(250); // let button colour changes finish

        problems.push(...await page.evaluate(auditContrast, ctx));
        problems.push(...await page.evaluate(auditDrawnContrast, ctx));
        problems.push(...await page.evaluate((c) => window.__audit(c), `${ctx} page`));
        await page.screenshot({ path: path.join(outDir, `${pageName}-${label}-${theme}.png`), fullPage: true });

        const res = await page.evaluate((ctx) => {
          const T = window.__layoutTest;
          if (!T) return { count: 0, out: [`${ctx}: page has no window.__layoutTest hook, so its drawings were not checked`] };
          const out = [], cases = T.cases();
          for (const c of cases) { T.show(c); out.push(...window.__audit(`${ctx} ${c.name}`, T.svgs)); }
          return { count: cases.length, out };
        }, ctx);
        problems.push(...res.out);
        drawings += res.count;
        await page.close();
      }
    }
  }
  await browser.close();

  const unique = [...new Set(problems)];
  console.log(`Checked ${pages.length} page(s), ${drawings} drawings, at 2 widths × 2 themes.`);
  if (unique.length) {
    console.log(`\n${unique.length} problem(s):`);
    unique.slice(0, 80).forEach((p) => console.log("  - " + p));
    if (unique.length > 80) console.log(`  ... and ${unique.length - 80} more`);
    process.exit(1);
  }
  console.log("No overlaps, no clipping, no sideways scroll, no script errors, all colour pairs readable.");
  console.log(`Screenshots: ${outDir}`);
})();
