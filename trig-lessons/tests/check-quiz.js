// Quiz and concept-link check for every lesson page.
//
//   node tests/check-quiz.js
//
// 1. Concept map: every idea of each level points to a real part of that page; every link in the
//    lesson text, every quiz question and every quick check points to an idea that exists.
// 2. Question bank: builds every question 300 times; each version has a question, at least 2
//    different options, exactly one right answer and an explanation.
// 3. Quiz flow: takes a quiz with 2 wrong answers and checks colours, score, the review list,
//    "Show me where this is explained" (on this page or another level), "I understand" (back to
//    a new version of the question) and fixing a mistake.
// 4. Between levels: a link in Level 3's text opens the Level 1 table and comes back to the same
//    place; a Level 3 quiz mistake about the table opens Level 1 and comes back to the question.
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

// A tiny web server for dist/, so links like "../" open the lesson page as they do on the real site
// (opened as files, "../" would show a folder listing instead).
const http = require("http");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(dist, path.normalize(rel).replace(/^([/\\])+/, ""));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
let origin = "";
const url = (rel) => origin + "/" + (rel ? rel + "/" : "");

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const problems = [];
  const fresh = async (where) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problems.push(`${where}: script error: ${e.message}`));
    return page;
  };

  for (const file of pages) {
    const name = path.relative(dist, path.dirname(file)) || "level-1";
    const page = await fresh(name);
    await page.goto(url(path.relative(dist, path.dirname(file))));
    await page.waitForTimeout(300);
    await page.click("#modeBtn"); // show all steps (and the lab, practice and quiz)

    // 1 + 2. Concept map, links, and question bank
    const found = await page.evaluate(() => {
      const out = [];
      const T = window.__layoutTest, C = window.LessonLinks.CONCEPTS;
      const steps = [...document.querySelectorAll(".steps > li")];
      for (const c of Object.values(C)) {
        if (c.level !== T.level) continue;
        if (!steps[c.step]) out.push(`idea ${c.id}: step ${c.step + 1} doesn't exist`);
        else if (!steps[c.step].querySelector(c.focus)) out.push(`idea ${c.id}: "${c.focus}" not found in step ${c.step + 1}`);
      }
      document.querySelectorAll("a[data-concept]").forEach((a) => { if (!C[a.dataset.concept]) out.push(`text link to unknown idea "${a.dataset.concept}"`); });
      const ids = new Set();
      for (const g of T.quizBank) {
        if (ids.has(g.id)) out.push(`${g.id}: duplicate id`);
        ids.add(g.id);
        if (!C[g.concept]) out.push(`${g.id}: unknown idea "${g.concept}"`);
        if (g.also && !C[g.also]) out.push(`${g.id}: unknown "also" idea "${g.also}"`);
        for (let n = 0; n < 300; n++) {
          const q = g.make();
          if (!q.q || !q.why) { out.push(`${g.id}: missing question or explanation`); break; }
          if (!Array.isArray(q.options) || q.options.length < 2) { out.push(`${g.id}: fewer than 2 options`); break; }
          if (new Set(q.options).size !== q.options.length) { out.push(`${g.id}: repeated option ${JSON.stringify(q.options)}`); break; }
          if (!(q.correct >= 0 && q.correct < q.options.length)) { out.push(`${g.id}: right answer missing`); break; }
          if (q.options.some((o) => /NaN|undefined|Infinity/.test(String(o)))) { out.push(`${g.id}: bad option ${JSON.stringify(q.options)}`); break; }
        }
      }
      return { out, ideas: Object.values(C).filter((c) => c.level === T.level).length, links: document.querySelectorAll("a[data-concept]").length };
    });
    problems.push(...found.out.map((p) => `${name}: ${p}`));

    // 3. Quiz flow: questions 2 and 5 answered wrong.
    const quiz = page.locator("#quiz");
    const key = () => page.evaluate(() => window.__layoutTest.quizKey());
    await quiz.locator(".qz-start").click();
    const flow = [];
    for (let i = 0; i < 10; i++) {
      const opts = quiz.locator(".qz-opt");
      const right = await key();
      const choice = i === 1 || i === 4 ? (right + 1) % (await opts.count()) : right;
      await opts.nth(choice).click();
      flow.push((await opts.nth(choice).getAttribute("class")).includes("right") ? "R" : "W");
      await quiz.locator(".qz-nav button").click();
    }
    const big = (await quiz.locator(".qz-big").textContent()).replace(/\s+/g, " ").trim();
    const cells = await quiz.locator(".qz-cell").evaluateAll((cs) => cs.map((c) => (c.classList.contains("ok") ? "R" : c.classList.contains("bad") ? "W" : "?")).join(""));
    if (flow.join("") !== "RWRRWRRRRR") problems.push(`${name} quiz: colours were ${flow.join("")}, expected RWRRWRRRRR`);
    if (cells !== flow.join("")) problems.push(`${name} quiz: squares ${cells} don't match answers ${flow.join("")}`);
    if (!big.startsWith("8")) problems.push(`${name} quiz: score "${big}", expected 8 / 10`);
    if ((await quiz.locator(".qz-item").count()) !== 2) problems.push(`${name} quiz: expected 2 mistakes listed`);

    const before = page.url();
    await quiz.locator("[data-explain]").first().click();
    await page.waitForTimeout(900);
    const otherLevel = page.url().split("#")[0] !== before.split("#")[0];
    const shown = await page.evaluate(() => { const f = document.querySelector(".lesson-focus"); return !!(f && f.getClientRects().length); });
    if (!shown) problems.push(`${name} quiz: "Show me where this is explained" didn't highlight anything`);
    if (!(await page.locator(".kb-bar").isVisible())) problems.push(`${name} quiz: the "I understand" bar didn't appear`);
    await page.locator(".kb-bar .kb-back").click();
    await page.waitForTimeout(900);
    if (!/Try again/.test(await quiz.locator(".qz-top .eyebrow").textContent())) problems.push(`${name} quiz: "I understand" didn't open the question again`);
    if (await page.evaluate(() => !!document.querySelector(".lesson-focus"))) problems.push(`${name} quiz: highlight still there after "I understand"`);
    await quiz.locator(".qz-opt").nth(await key()).click();
    await quiz.locator("[data-back]").click();
    const fixed = await quiz.locator(".qz-item.is-fixed").count();
    const after = (await quiz.locator(".qz-big").textContent()).replace(/\s+/g, " ").trim();
    if (fixed !== 1) problems.push(`${name} quiz: ${fixed} marked fixed, expected 1`);
    if (after !== big) problems.push(`${name} quiz: first score changed from "${big}" to "${after}"`);
    console.log(`${name}: ${found.ideas} ideas, ${found.links} text links; quiz ${flow.join("")} = ${big}, explanation ${otherLevel ? "in another level" : "on this page"}, 1 fixed`);
    await page.context().close();
  }

  // 4a. Between levels: a text link in Level 3 opens the Level 1 table, then comes back.
  {
    const page = await fresh("level-3 text link");
    await page.goto(url("level-3"));
    await page.waitForTimeout(300);
    await page.click("#modeBtn");
    const link = page.locator('a[data-concept="l1-table"]').first();
    await link.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => Math.round(scrollY));
    await link.click();
    await page.waitForTimeout(1200);
    const there = await page.evaluate(() => ({
      level1: !location.pathname.includes("level-"),
      table: !!document.querySelector(".tablewrap.lesson-focus"),
      bar: document.querySelector(".kb-bar") && !document.querySelector(".kb-bar").hidden,
      text: document.querySelector(".kb-bar-text") && document.querySelector(".kb-bar-text").textContent,
      hash: location.hash,
    }));
    if (!there.level1 || !there.table || !there.bar) problems.push(`text link: expected Level 1 with the table highlighted and the bar shown, got ${JSON.stringify(there)}`);
    await page.locator(".kb-back").click();
    await page.waitForTimeout(1200);
    const back = await page.evaluate(() => ({ level3: location.pathname.includes("level-3"), scroll: Math.round(scrollY), hash: location.hash }));
    if (!back.level3 || Math.abs(back.scroll - scrollBefore) > 40) problems.push(`text link: expected back on Level 3 near scroll ${scrollBefore}, got ${JSON.stringify(back)}`);
    console.log(`text link: Level 3 → Level 1 table (${there.text}) → back to Level 3 at scroll ${back.scroll} (was ${scrollBefore})`);
    // "Stay here and keep reading" clears the way back
    await link.click();
    await page.waitForTimeout(1200);
    await page.locator(".kb-stay").click();
    const stayed = await page.evaluate(() => ({ bar: !document.querySelector(".kb-bar").hidden, focus: !!document.querySelector(".lesson-focus"), ticket: sessionStorage.getItem("trig-kb-ticket") }));
    if (stayed.bar || stayed.focus || stayed.ticket) problems.push(`"Stay here": expected bar, highlight and ticket gone, got ${JSON.stringify(stayed)}`);
    await page.context().close();
  }

  // 4b. Between levels: a Level 3 quiz mistake about the table opens Level 1, then back to the question.
  {
    const page = await fresh("level-3 quiz link");
    await page.goto(url("level-3"));
    await page.waitForTimeout(300);
    await page.click("#modeBtn");
    await page.evaluate(() => {
      const T = window.__layoutTest;
      const ids = ["backwards-table", ...T.quizBank.map((g) => g.id).filter((id) => id !== "backwards-table").slice(0, 9)];
      const items = ids.map((id, i) => {
        const inst = T.quizBank.find((g) => g.id === id).make();
        const pick = i === 0 ? (inst.correct + 1) % inst.options.length : inst.correct;
        return { id, inst, pick, ok: i !== 0, fixed: false };
      });
      T.quizApi.restore({ items });
      T.quizApi.showResults();
    });
    await page.locator("#quiz [data-explain]").first().click();
    await page.waitForTimeout(1200);
    const there = await page.evaluate(() => ({
      level1: !location.pathname.includes("level-"),
      table: !!document.querySelector(".tablewrap.lesson-focus"),
      back: document.querySelector(".kb-back") && document.querySelector(".kb-back").textContent,
    }));
    if (!there.level1 || !there.table || !/back to the question/.test(there.back || "")) problems.push(`quiz link: expected Level 1 table with "back to the question", got ${JSON.stringify(there)}`);
    await page.locator(".kb-back").click();
    await page.waitForTimeout(1200);
    const back = await page.evaluate(() => ({
      level3: location.pathname.includes("level-3"),
      title: document.querySelector("#quiz .qz-top .eyebrow") && document.querySelector("#quiz .qz-top .eyebrow").textContent,
    }));
    if (!back.level3 || !/Try again: question 1/.test(back.title || "")) problems.push(`quiz link: expected Level 3 "Try again: question 1", got ${JSON.stringify(back)}`);
    // Fix it, and the results remember the other 9 answers
    await page.locator("#quiz .qz-opt").nth(await page.evaluate(() => window.__layoutTest.quizKey())).click();
    await page.locator("#quiz [data-back]").click();
    const res = await page.evaluate(() => ({ score: document.querySelector("#quiz .qz-big").textContent.replace(/\s+/g, " ").trim(), fixed: document.querySelectorAll("#quiz .qz-cell.fixed").length, ok: document.querySelectorAll("#quiz .qz-cell.ok").length }));
    if (!res.score.startsWith("9") || res.fixed !== 1 || res.ok !== 9) problems.push(`quiz link: after fixing, expected 9 / 10 with 9 right and 1 fixed, got ${JSON.stringify(res)}`);
    console.log(`quiz link: Level 3 quiz → Level 1 table → back to "${back.title}" → fixed; results ${res.score}, ${res.ok} right + ${res.fixed} fixed`);
    await page.context().close();
  }

  // 4c. A quick check in Level 3 (one step at a time) links to the Level 1 table, then back to the same step.
  {
    const page = await fresh("level-3 quick check link");
    await page.goto(url("level-3"));
    await page.waitForTimeout(300);
    const cur = () => page.locator(".steps > li:not([hidden])");
    await cur().locator(".checkq-opts button", { hasText: /^An angle$/ }).click();
    await page.click("#nextBtn"); // step 2
    await cur().locator(".checkq-opts button", { hasText: /^60°$/ }).click(); // wrong on purpose
    const link = cur().locator(".checkq-fb a[data-concept]");
    if (!(await link.count())) problems.push("quick check: no 'Show me where this is explained' link after a wrong answer");
    else {
      await link.click();
      await page.waitForTimeout(1200);
      const there = await page.evaluate(() => ({ level1: !location.pathname.includes("level-"), table: !!document.querySelector(".tablewrap.lesson-focus") }));
      await page.locator(".kb-back").click();
      await page.waitForTimeout(1200);
      const back = await page.evaluate(() => ({ level3: location.pathname.includes("level-3"), step: document.querySelector("#stepCount").textContent }));
      if (!there.level1 || !there.table || !back.level3 || back.step !== "Step 2 of 7") problems.push(`quick check link: expected Level 1 table then back to Level 3 step 2, got ${JSON.stringify({ there, back })}`);
      console.log(`quick check link: Level 3 step 2 → Level 1 table → back to Level 3 "${back.step}"`);
    }
    await page.context().close();
  }

  await browser.close();
  server.close();
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    problems.forEach((p) => console.log("  - " + p));
    process.exit(1);
  }
  console.log("Concept map, quiz banks, quiz flow and links between levels OK.");
})();
