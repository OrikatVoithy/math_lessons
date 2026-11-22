/*
 * End-of-level quiz, shared by every lesson page; build.sh folds this file into each page.
 *
 * LessonQuiz.mount({ root, bank, count, storageKey, explain, alsoLabel })
 *   bank: [{ id, concept, also, make }]
 *     concept: the idea in the concept map (concepts.js) that explains the question; it can be
 *              in any level
 *     also:    optional second idea, shown as an "Also see" button
 *     make():  returns a fresh version of the question (new numbers each time):
 *              { q, options: [...], correct: index, why }
 *   explain(question, index, also): the page opens the idea (on this page or another one)
 *   alsoLabel(question): text for the "Also see" button
 * Returns { key, retry, serialize, restore } so the page can bring him back to his quiz after
 * reading an explanation on another page.
 *
 * Flow: 10 random questions. Each answer turns green or red at once, with the right answer
 * and why. At the end: the score, then every mistake with a button that jumps to its
 * explanation. "I understand" brings him back to a new version of that question.
 * The first score stays as it was; fixed mistakes are shown separately.
 */
(function () {
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const between = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  // Multiple choice with the options in a random order. Duplicate or equal-to-right wrong answers are dropped.
  function mc(q, right, wrongs, why) {
    const options = shuffle([right, ...wrongs.filter((w, i, all) => w !== right && all.indexOf(w) === i)]);
    return { q, options, correct: options.indexOf(right), why };
  }
  // Lengths: one decimal at most, plus the unit.
  const len = (x, unit = " m") => String(parseFloat(x.toFixed(1))) + unit;

  function mount(cfg) {
    const root = cfg.root;
    const count = Math.min(cfg.count || 10, cfg.bank.length);
    const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
    let best = null;
    try { const v = localStorage.getItem(cfg.storageKey); if (v !== null) best = +v; } catch (_) {}
    let run = null;
    let current = null; // the question on screen (tests read its right answer)

    const score = () => run.items.filter((it) => it.ok).length;
    const state = (it) => (it.pick == null ? "" : it.ok ? "ok" : it.fixed ? "fixed" : "bad");
    const stateWord = { "": "not answered yet", ok: "right", bad: "wrong", fixed: "wrong, now fixed" };
    const cells = (cur) => `<ol class="qz-cells" aria-label="Your answers">${run.items.map((it, k) =>
      `<li class="qz-cell ${state(it)}${k === cur ? " cur" : ""}"><span class="sr">Question ${k + 1}: ${stateWord[state(it)]}</span><span aria-hidden="true">${k + 1}</span></li>`).join("")}</ol>`;
    const questionBlock = (inst) =>
      `<p class="qz-q">${inst.q}</p><div class="qz-opts">${inst.options.map((o, k) => `<button type="button" class="qz-opt" data-k="${k}">${o}</button>`).join("")}</div><div class="qz-why" aria-live="polite"></div>`;

    function onAnswer(inst, done) {
      current = inst;
      const opts = [...root.querySelectorAll(".qz-opt")];
      opts.forEach((b) => b.addEventListener("click", () => {
        const k = +b.dataset.k;
        const ok = k === inst.correct;
        opts.forEach((x) => { x.disabled = true; if (+x.dataset.k === inst.correct) x.classList.add("right"); });
        if (!ok) b.classList.add("wrong");
        const why = root.querySelector(".qz-why");
        why.className = "qz-why " + (ok ? "good" : "bad");
        why.innerHTML = (ok ? "<b>Correct!</b> " : `<b>Not quite.</b> The right answer is <b>${inst.options[inst.correct]}</b>. `) + inst.why;
        done(k, ok);
      }));
    }

    function start() {
      run = null;
      root.innerHTML = `<div class="qz-card">
        <p>${count} questions from the whole lesson, in a random order. Right answers turn <b class="qz-g">green</b>, wrong answers turn <b class="qz-r">red</b>. At the end you can go back to the explanation for each mistake, then try it again.</p>
        ${best != null ? `<p class="qz-best">Your best score so far: <b>${best} / ${count}</b></p>` : ""}
        <div class="qz-nav"><button type="button" class="primary qz-start">Start the quiz</button></div></div>`;
      root.querySelector(".qz-start").addEventListener("click", begin);
    }

    function begin() {
      run = { items: shuffle(cfg.bank.slice()).slice(0, count).map((g) => ({ g, inst: g.make(), pick: null, ok: false, fixed: false })) };
      ask(0);
    }

    function ask(i) {
      const it = run.items[i];
      root.innerHTML = `<div class="qz-card">
        <div class="qz-top"><span class="eyebrow">Question ${i + 1} of ${run.items.length}</span><span class="qz-score">Score: <b>${score()}</b></span></div>
        ${cells(i)}${questionBlock(it.inst)}<div class="qz-nav"></div></div>`;
      onAnswer(it.inst, (k, ok) => {
        it.pick = k;
        it.ok = ok;
        root.querySelector(".qz-cells").outerHTML = cells(i);
        root.querySelector(".qz-score b").textContent = score();
        const last = i === run.items.length - 1;
        const nav = root.querySelector(".qz-nav");
        nav.innerHTML = `<button type="button" class="primary">${last ? "See my score" : "Next question →"}</button>`;
        const b = nav.querySelector("button");
        b.addEventListener("click", () => { if (last) results(true); else ask(i + 1); });
        b.focus({ preventScroll: true });
      });
    }

    function results(first) {
      const s = score();
      if (first && (best == null || s > best)) { best = s; try { localStorage.setItem(cfg.storageKey, String(s)); } catch (_) {} }
      const wrong = run.items.map((it, k) => ({ it, k })).filter(({ it }) => !it.ok);
      const left = wrong.filter(({ it }) => !it.fixed).length;
      const msg = s === run.items.length ? "Perfect score! You really know this level."
        : left === 0 ? "You fixed every mistake. Well done!"
        : `Now let's fix ${left === 1 ? "your mistake" : `your ${left} mistakes`}. For each one, read the explanation, then try a new version of the question.`;
      root.innerHTML = `<div class="qz-card">
        <div class="qz-result"><span class="qz-big">${s}<small> / ${run.items.length}</small></span><p>${msg}</p></div>
        ${cells(-1)}
        ${wrong.length ? `<ol class="qz-review">${wrong.map(({ it, k }) => `<li class="qz-item${it.fixed ? " is-fixed" : ""}">
          <span class="qz-tag">${it.fixed ? "Fixed ✓" : `Question ${k + 1}`}</span>
          <p class="qz-q">${it.inst.q}</p>
          <p class="qz-yours">You chose: <b>${it.inst.options[it.pick]}</b></p>
          <p class="qz-right">Right answer: <b>${it.inst.options[it.inst.correct]}</b></p>
          <p>${it.inst.why}</p>
          ${it.fixed ? "" : `<div class="qz-actions"><button type="button" class="primary" data-explain="${k}">Show me where this is explained</button><button type="button" data-retry="${k}">Try it again now</button>${it.g.also && cfg.alsoLabel ? `<button type="button" class="qz-also" data-also="${k}">${cfg.alsoLabel(it.g)}</button>` : ""}</div>`}
        </li>`).join("")}</ol>` : ""}
        <div class="qz-nav"><button type="button" class="qz-again">Start a new quiz</button></div></div>`;
      root.querySelectorAll("[data-explain]").forEach((b) => b.addEventListener("click", () => explain(+b.dataset.explain)));
      root.querySelectorAll("[data-also]").forEach((b) => b.addEventListener("click", () => explain(+b.dataset.also, true)));
      root.querySelectorAll("[data-retry]").forEach((b) => b.addEventListener("click", () => retry(+b.dataset.retry)));
      root.querySelector(".qz-again").addEventListener("click", begin);
      if (!first) root.scrollIntoView({ behavior: smooth(), block: "start" });
    }

    function explain(k, also = false) {
      cfg.explain(run.items[k].g, k, also);
    }

    function retry(k) {
      const it = run.items[k];
      const inst = it.g.make(); // a new version: same idea, new numbers
      root.innerHTML = `<div class="qz-card">
        <div class="qz-top"><span class="eyebrow">Try again: question ${k + 1}</span><span class="qz-score">Same idea, new numbers</span></div>
        ${questionBlock(inst)}<div class="qz-nav"></div></div>`;
      root.scrollIntoView({ behavior: smooth(), block: "start" });
      onAnswer(inst, (pickK, ok) => {
        if (ok) it.fixed = true;
        const nav = root.querySelector(".qz-nav");
        nav.innerHTML = ok
          ? '<button type="button" class="primary" data-back>Back to my results</button>'
          : '<button type="button" class="primary" data-x>Show me where this is explained</button><button type="button" data-r>Try another version</button><button type="button" data-back>Back to my results</button>';
        nav.querySelector("[data-back]").addEventListener("click", () => results(false));
        if (!ok) {
          nav.querySelector("[data-x]").addEventListener("click", () => explain(k));
          nav.querySelector("[data-r]").addEventListener("click", () => retry(k));
        }
        nav.querySelector("button").focus({ preventScroll: true });
      });
    }

    start();
    // Save and restore a quiz in progress, so he can read an explanation on another page and come back.
    const serialize = () => ({ items: run.items.map((it) => ({ id: it.g.id, inst: it.inst, pick: it.pick, ok: it.ok, fixed: it.fixed })) });
    function restore(state) {
      const items = state.items.map((x) => ({ g: cfg.bank.find((g) => g.id === x.id), inst: x.inst, pick: x.pick, ok: x.ok, fixed: x.fixed }));
      if (items.some((it) => !it.g)) { start(); return false; }
      run = { items };
      return true;
    }

    return {
      key: () => (current ? current.correct : null), // used by tests/check-quiz.js
      retry: (k) => retry(k),
      serialize,
      restore,
      showResults: () => results(false), // used by tests/check-quiz.js
    };
  }

  window.LessonQuiz = { mount, mc, pick, between, shuffle, len };
})();
