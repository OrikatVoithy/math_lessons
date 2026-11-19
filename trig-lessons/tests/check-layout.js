// Layout check for the lesson pages.
//
//   node tests/check-layout.js [page.html]
//
// Draws every triangle the page can show (lab angles and sizes from both corners, and every
// practice triangle in every orientation, before and after answering), at desktop and phone
// width, in light and dark theme. It fails if any label overlaps another label or a line,
// any label spills outside its picture, the page scrolls sideways, or a text colour is too
// faint to read on its background. Screenshots go to tests/out/ for a final look.
//
// Needs Playwright with Chromium (preinstalled in Claude Code cloud sessions; elsewhere:
// npm i -D playwright && npx playwright install chromium).

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const page_ = path.resolve(process.argv[2] || path.join(__dirname, "..", "index.html"));
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

// Runs inside the page: returns problems found in every <svg> currently on screen.
function auditSvgs(context) {
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
  function axesOf(q) {
    return q.map((p, i) => { const n = q[(i + 1) % q.length]; return { x: -(n.y - p.y), y: n.x - p.x }; });
  }
  function overlaps(q1, q2) { // separating axis test for convex polygons
    for (const ax of [...axesOf(q1), ...axesOf(q2)]) {
      const pr = (q) => q.map((p) => p.x * ax.x + p.y * ax.y);
      const a = pr(q1), b = pr(q2);
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
    }
    return true;
  }
  function segHitsQuad(s, q) {
    const seg = [s.p, s.q, s.q, s.p]; // degenerate polygon works with the same test
    const len = Math.hypot(s.q.x - s.p.x, s.q.y - s.p.y);
    if (len < 0.5) return false;
    // shrink by the stroke half-width: treat the line as a thin rectangle
    const nx = -(s.q.y - s.p.y) / len * s.w / 2, ny = (s.q.x - s.p.x) / len * s.w / 2;
    const rect = [{ x: s.p.x + nx, y: s.p.y + ny }, { x: s.q.x + nx, y: s.q.y + ny }, { x: s.q.x - nx, y: s.q.y - ny }, { x: s.p.x - nx, y: s.p.y - ny }];
    return overlaps(s.w > 0 ? rect : seg, q);
  }

  document.querySelectorAll("svg[viewBox]").forEach((svg, si) => {
    if (!svg.getClientRects().length) return;
    const name = svg.id || svg.getAttribute("aria-label")?.slice(0, 40) || `svg#${si}`;
    const vb = svg.viewBox.baseVal;
    const texts = [...svg.querySelectorAll("text")].map((t) => ({ t, q: textQuad(svg, t), label: t.textContent.trim() })).filter((x) => x.q);
    const lines = [...svg.querySelectorAll("line")].map((l) => {
      const m = toRoot(svg, l);
      return { p: apply(m, +l.getAttribute("x1"), +l.getAttribute("y1")), q: apply(m, +l.getAttribute("x2"), +l.getAttribute("y2")), w: +(l.getAttribute("stroke-width") || 1) };
    });
    const handles = [...svg.querySelectorAll("circle.handle")].map((c) => circleQuad(svg, c));

    for (const a of texts) {
      for (const p of a.q) {
        if (p.x < vb.x - 0.5 || p.y < vb.y - 0.5 || p.x > vb.x + vb.width + 0.5 || p.y > vb.y + vb.height + 0.5) {
          problems.push(`${context} [${name}] "${a.label}" goes outside the picture`); break;
        }
      }
      for (const l of lines) if (segHitsQuad(l, a.q)) { problems.push(`${context} [${name}] "${a.label}" touches a line`); break; }
      for (const h of handles) if (overlaps(h, a.q)) problems.push(`${context} [${name}] "${a.label}" is under the drag handle`);
    }
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++)
        if (overlaps(texts[i].q, texts[j].q)) problems.push(`${context} [${name}] "${texts[i].label}" overlaps "${texts[j].label}"`);
  });
  if (document.documentElement.scrollWidth > innerWidth) problems.push(`${context} page scrolls sideways (${document.documentElement.scrollWidth}px > ${innerWidth}px)`);
  return problems;
}

// Runs inside the page: contrast of every text colour token against the backgrounds it sits on.
function auditContrast(theme) {
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
  return pairs.filter(([f, b, min]) => ratio(f, b) < min).map(([f, b, min]) => `${theme}: ${f} on ${b} contrast ${ratio(f, b).toFixed(2)} (needs ${min})`);
}

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  let drawings = 0;
  for (const [width, label] of [[1100, "desktop"], [390, "phone"]]) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
      page.on("pageerror", (e) => problems.push(`${label}/${theme} script error: ${e.message}`));
      await page.goto("file://" + page_);
      await page.waitForTimeout(500);
      const ctx = `${label}/${theme}`;
      await page.evaluate(`window.__audit = ${auditSvgs.toString()}`);

      problems.push(...await page.evaluate(auditContrast, ctx));
      problems.push(...await page.evaluate((c) => window.__audit(c), `${ctx} page`));
      await page.screenshot({ path: path.join(outDir, `${label}-${theme}.png`), fullPage: true });

      // Lab: every angle, smallest and largest size, from both corners.
      problems.push(...await page.evaluate((ctx) => {
        const T = window.__trigTest, out = [];
        for (const view of ["A", "B"]) for (let th = T.limits.minTheta; th <= T.limits.maxTheta; th += 1) for (const big of [false, true]) {
          T.setLab(th, big ? T.limits.maxL(th) : T.limits.minL, view);
          out.push(...window.__audit(`${ctx} lab view=${view} θ=${th} ${big ? "large" : "small"}`).filter((p) => p.includes("[lab]")));
        }
        T.setLab(Math.atan2(3, 4) * 180 / Math.PI, 200, "A");
        return out;
      }, ctx));
      drawings += 71 * 4;

      // Practice: every triangle, both leg orders, θ at either corner, flipped or not, before and after answering.
      problems.push(...await page.evaluate((ctx) => {
        const T = window.__trigTest, out = [];
        for (const triple of T.triples) for (const swap of [false, true]) for (const at of ["A", "B"]) for (const flip of [false, true]) {
          const tag = `${ctx} practice ${triple.join("-")} swap=${swap} θ@${at} flip=${flip}`;
          T.question({ triple, swap, at, flip });
          out.push(...window.__audit(`${tag} before`).filter((p) => p.includes("[mini]")));
          T.answer(0);
          out.push(...window.__audit(`${tag} after`).filter((p) => p.includes("[mini]") || p.includes("sideways")));
        }
        return out;
      }, ctx));
      drawings += 7 * 8 * 2;
      await page.locator("#mini").screenshot({ path: path.join(outDir, `${label}-${theme}-practice.png`) });
      await page.close();
    }
  }
  await browser.close();

  const unique = [...new Set(problems)];
  console.log(`Checked ${drawings} drawings at 2 widths × 2 themes.`);
  if (unique.length) {
    console.log(`\n${unique.length} problem(s):`);
    unique.slice(0, 80).forEach((p) => console.log("  - " + p));
    if (unique.length > 80) console.log(`  ... and ${unique.length - 80} more`);
    process.exit(1);
  }
  console.log("No overlaps, no clipping, no sideways scroll, all colour pairs readable.");
  console.log(`Screenshots: ${outDir}`);
})();
