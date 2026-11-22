// Quiz check for every lesson page.
//
//   node tests/check-quiz.js
//
// 1. Question bank: builds every question 300 times and checks each version has a question,
//    at least 2 different options, exactly one right answer, and an explanation, and that the
//    part of the lesson it links back to exists.
// 2. Quiz flow: takes a quiz answering some questions wrong, then checks the colours, the score,
//    the review list, "show me where this is explained" (opens the right step, highlights it,
//    shows the bar), "I understand" (a new version of the question) and fixing a mistake.
//
// Run build.sh first (check-layout.js does). Needs Playwright with Chromium.

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const dist = path.join(__dirname, "..", "dist");
const pages = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (f === "index.html") pages.push(full);
  }
})(dist);
pages.sort();

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  for (const file of pages) {
    const name = path.relative(dist, path.dirname(file)) || "level-1";
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    page.on("pageerror", (e) => problems.push(`${name}: script error: ${e.message}`));
    await page.goto("file://" + file);
    await page.waitForTimeout(300);

    // 1. Question bank
    const bankProblems = await page.evaluate(() => {
      const out = [];
      const bank = window.__layoutTest && window.__layoutTest.quizBank;
      if (!bank) return ["page has no quizBank in window.__layoutTest"];
      const steps = [...document.querySelectorAll(".steps > li")];
      const ids = new Set();
      for (const g of bank) {
        if (ids.has(g.id)) out.push(`${g.id}: duplicate id`);
        ids.add(g.id);
        if (!steps[g.section]) out.push(`${g.id}: links to step ${g.section + 1}, which doesn't exist`);
        else if (g.focus && !steps[g.section].querySelector(g.focus)) out.push(`${g.id}: "${g.focus}" not found in step ${g.section + 1}`);
        for (let n = 0; n < 300; n++) {
          const q = g.make();
          if (!q.q || !q.why) { out.push(`${g.id}: missing question or explanation`); break; }
          if (!Array.isArray(q.options) || q.options.length < 2) { out.push(`${g.id}: fewer than 2 options: ${JSON.stringify(q.options)}`); break; }
          if (new Set(q.options).size !== q.options.length) { out.push(`${g.id}: repeated option: ${JSON.stringify(q.options)}`); break; }
          if (!(q.correct >= 0 && q.correct < q.options.length)) { out.push(`${g.id}: right answer missing`); break; }
          if (q.options.some((o) => /NaN|undefined|Infinity/.test(String(o)))) { out.push(`${g.id}: bad option ${JSON.stringify(q.options)}`); break; }
        }
      }
      return out.map((p) => p);
    });
    problems.push(...bankProblems.map((p) => `${name} bank: ${p}`));

    // 2. Quiz flow: show everything, then take a quiz with questions 2 and 5 answered wrong.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(300);
    await page.click("#modeBtn"); // show all steps, which also shows the lab, practice and quiz
    const quiz = page.locator("#quiz");
    const key = () => page.evaluate(() => window.__layoutTest.quizKey());
    await quiz.locator(".qz-start").click();
    const flow = [];
    for (let i = 0; i < 10; i++) {
      const opts = quiz.locator(".qz-opt");
      const right = await key();
      const choice = i === 1 || i === 4 ? (right + 1) % (await opts.count()) : right;
      await opts.nth(choice).click();
      const cls = await opts.nth(choice).getAttribute("class");
      flow.push(cls.includes("right") ? "R" : "W");
      await quiz.locator(".qz-nav button").click(); // next question, or "See my score" after the last
    }
    const big = (await quiz.locator(".qz-big").textContent()).replace(/\s+/g, " ").trim();
    const cellStates = await quiz.locator(".qz-cell").evaluateAll((cs) => cs.map((c) => (c.classList.contains("ok") ? "R" : c.classList.contains("bad") ? "W" : "?")).join(""));
    const reviewCount = await quiz.locator(".qz-item").count();
    if (flow.join("") !== "RWRRWRRRRR") problems.push(`${name} flow: colours after answering were ${flow.join("")}, expected RWRRWRRRRR`);
    if (cellStates !== flow.join("")) problems.push(`${name} flow: result squares ${cellStates} don't match the answers ${flow.join("")}`);
    if (!big.startsWith("8")) problems.push(`${name} flow: score shows "${big}", expected 8 / 10`);
    if (reviewCount !== 2) problems.push(`${name} flow: ${reviewCount} mistakes listed, expected 2`);

    await quiz.locator("[data-explain]").first().click();
    await page.waitForTimeout(400);
    const focused = await page.evaluate(() => {
      const f = document.querySelector(".lesson-focus");
      const li = f && f.closest(".steps > li");
      return { visible: !!(f && f.getClientRects().length), step: li ? [...document.querySelectorAll(".steps > li")].indexOf(li) + 1 : null };
    });
    if (!focused.visible) problems.push(`${name} flow: "Show me where this is explained" didn't highlight anything visible`);
    if (!(await page.locator(".qz-bar").isVisible())) problems.push(`${name} flow: the "I understand" bar didn't appear`);
    await page.locator(".qz-bar .qz-back").click();
    if (!/Try again/.test(await quiz.locator(".qz-top .eyebrow").textContent())) problems.push(`${name} flow: "I understand" didn't open the question again`);
    if (await page.evaluate(() => !!document.querySelector(".lesson-focus"))) problems.push(`${name} flow: highlight still there after "I understand"`);
    if (await page.locator(".qz-bar").isVisible()) problems.push(`${name} flow: bar still showing after "I understand"`);
    await quiz.locator(".qz-opt").nth(await key()).click();
    await quiz.locator("[data-back]").click();
    const fixedItems = await quiz.locator(".qz-item.is-fixed").count();
    const fixedCells = await quiz.locator(".qz-cell.fixed").count();
    const scoreAfter = (await quiz.locator(".qz-big").textContent()).replace(/\s+/g, " ").trim();
    if (fixedItems !== 1 || fixedCells !== 1) problems.push(`${name} flow: after fixing one, ${fixedItems} marked fixed in the list and ${fixedCells} squares (expected 1 and 1)`);
    if (scoreAfter !== big) problems.push(`${name} flow: first score changed from "${big}" to "${scoreAfter}" (it should stay)`);
    console.log(`${name}: answers ${flow.join("")}, score ${big}, ${reviewCount} mistakes listed, link opened step ${focused.step}, 1 fixed`);
    await page.close();
  }
  await browser.close();
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    problems.forEach((p) => console.log("  - " + p));
    process.exit(1);
  }
  console.log("Quiz banks and quiz flow OK on every page.");
})();
