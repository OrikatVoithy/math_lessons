/*
 * One step at a time, each step ending with a quick check, plus optional Arabic help.
 * Shared by every lesson page; build.sh folds this file into each page.
 *
 * The page provides this markup:
 *   #stepnav (#stepCount, #modeBtn, #dots)   step counter, "show all" switch, step dots
 *   .steps > li                               one per step
 *   #stepbtns (#prevBtn, #nextHint, #nextBtn) Back / Next under the current step
 *   #afterSteps                               shown once the last step is done (lab, practice, quiz)
 *   #arBtn                                    Arabic help button
 *
 * LessonSteps.mount({ storageKey, quiz, ar, renderTap }) returns { explainAt, clearFocus, current, goTo, prepare }.
 *   A quick check with several questions shows them one at a time, with a "Next question" button.
 *
 * How much explanation (Short / Normal / Detailed): the switch appears when the page has any
 * <div class="more"> blocks. In a step:
 *   <div class="in-short">…</div>  the step in two or three lines; shown only in Short
 *   <div class="more">…</div>      extra explanation and examples; shown only in Detailed
 *   class="d-extra"                 a part hidden in Short (plain paragraphs of .stepbody hide too)
 * The choice is shared by every level. When a link opens an idea, its step shows in full detail.
 *   quiz[i]: questions for step i. Each is
 *     { type: "choice", q, options: [[label, whyWrong|null], ...], correct, ok } or
 *     { type: "tap", q, correct, wrong: { id: whyWrong }, ok, ...anything renderTap needs }.
 *   ar[i]: short Arabic summary of step i (HTML).
 *   renderTap(q, onTap(id, element)) -> element: draws a tap-the-picture question.
 */
(function () {
  function mount(cfg) {
    const $ = (id) => document.getElementById(id);
    const stepEls = [...document.querySelectorAll(".steps > li")];
    const LAST = stepEls.length - 1;
    const quiz = cfg.quiz || [];
    const lesson = { mode: "one", cur: 0, reached: 0, finished: false };
    try { Object.assign(lesson, JSON.parse(localStorage.getItem(cfg.storageKey) || "{}")); } catch (_) {}
    lesson.cur = Math.min(Math.max(0, lesson.cur | 0), LAST);
    const save = () => { try { localStorage.setItem(cfg.storageKey, JSON.stringify(lesson)); } catch (_) {} };
    const solved = stepEls.map(() => new Set());
    const smooth = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

    function renderChecks(i) {
      const qs = quiz[i];
      const box = document.createElement("div");
      box.className = "checkq span";
      box.innerHTML = `<div class="checkq-head"><span class="badge">Quick check</span><span class="checkq-sub">${qs.length > 1 ? `${qs.length} questions, one at a time. Answer them` : "Answer it"} to unlock the next step.</span></div>`;
      const items = [];
      // Several questions: one at a time. Once a question is right, "Next question" shows the next one.
      const already = i < lesson.reached || lesson.finished;
      qs.forEach((q, qi) => {
        const item = document.createElement("div");
        item.className = "checkq-item";
        item.hidden = qi > 0 && !already;
        items.push(item);
        const qp = document.createElement("p");
        qp.className = "checkq-q";
        qp.innerHTML = (qs.length > 1 ? `<span class="qn">Question ${qi + 1} of ${qs.length}</span> ` : "") + q.q;
        item.append(qp);
        const fb = document.createElement("p");
        fb.className = "checkq-fb";
        fb.setAttribute("aria-live", "polite");
        const good = () => {
          solved[i].add(qi);
          fb.className = "checkq-fb good";
          fb.textContent = q.ok;
          const next = items[qi + 1];
          if (next && next.hidden) {
            const row = document.createElement("div");
            row.className = "checkq-next";
            row.innerHTML = '<button type="button" class="primary">Next question →</button>';
            row.querySelector("button").addEventListener("click", () => {
              row.remove();
              next.hidden = false;
              const b = next.querySelector("button, .tap");
              if (b) b.focus({ preventScroll: true });
              next.scrollIntoView({ behavior: smooth(), block: "nearest" });
            });
            item.append(row);
          }
          updateNav();
        };
        const bad = (why) => {
          fb.className = "checkq-fb bad";
          fb.textContent = "Not quite. " + why + " Try again.";
          // q.see: an idea from the concept map (maybe in an earlier level) that explains this question.
          if (q.see) {
            const a = document.createElement("a");
            a.className = "kb-link";
            a.dataset.concept = q.see;
            a.href = "#";
            a.textContent = "Show me where this is explained →";
            fb.append(" ", a);
          }
        };
        if (q.type === "tap") {
          item.append(cfg.renderTap(q, (id, g) => {
            if (solved[i].has(qi)) return;
            if (id === q.correct) { g.classList.add("right"); good(); }
            else { g.classList.add("wrong"); bad(q.wrong[id]); }
          }));
        } else {
          const opts = document.createElement("div");
          opts.className = "checkq-opts";
          q.options.forEach(([label, why], oi) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = label;
            b.addEventListener("click", () => {
              if (solved[i].has(qi)) return;
              if (oi === q.correct) { b.classList.add("right"); opts.querySelectorAll("button").forEach((x) => { x.disabled = true; }); good(); }
              else { b.classList.add("wrong"); b.disabled = true; bad(why); }
            });
            opts.append(b);
          });
          item.append(opts);
        }
        item.append(fb);
        box.append(item);
      });
      stepEls[i].append(box);
    }

    stepEls.forEach((li, i) => {
      if (cfg.ar && cfg.ar[i]) {
        const ar = document.createElement("div");
        ar.className = "ar-box";
        ar.lang = "ar";
        ar.dir = "rtl";
        ar.innerHTML = `<span class="ar-label">بالعربي</span>${cfg.ar[i]}`;
        li.append(ar);
      }
      if (quiz[i]) renderChecks(i);
    });

    const stepDone = (i) => !quiz[i] || solved[i].size === quiz[i].length || i < lesson.reached || lesson.finished;
    const showAllChecks = () => document.querySelectorAll(".checkq-item").forEach((it) => { it.hidden = false; });
    function updateNav() {
      const one = lesson.mode === "one";
      stepEls.forEach((li, i) => { li.hidden = one && i !== lesson.cur; });
      $("afterSteps").hidden = one && !lesson.finished;
      $("stepbtns").hidden = !one;
      $("dots").hidden = !one;
      $("stepCount").textContent = one ? `Step ${lesson.cur + 1} of ${stepEls.length}` : `All ${stepEls.length} steps`;
      $("modeBtn").textContent = one ? "Show all steps" : "Show one step at a time";
      $("prevBtn").disabled = lesson.cur === 0;
      const done = stepDone(lesson.cur);
      $("nextBtn").disabled = !done;
      $("nextBtn").textContent = lesson.cur === LAST ? "Finish: try it yourself →" : "Next step →";
      const left = quiz[lesson.cur] ? quiz[lesson.cur].length - solved[lesson.cur].size : 0;
      $("nextHint").textContent = done ? "" : left > 1 ? `Answer the ${left} quick check questions to go on.` : "Answer the quick check question to go on.";
      const open = (i) => i <= Math.max(lesson.reached, lesson.cur) || lesson.finished;
      $("dots").innerHTML = stepEls.map((_, i) =>
        `<button type="button" class="dot${i === lesson.cur ? " cur" : stepDone(i) && open(i) ? " done" : ""}" data-i="${i}"${open(i) ? "" : " disabled"} aria-label="Step ${i + 1}"${i === lesson.cur ? ' aria-current="step"' : ""}>${i + 1}</button>`).join("");
    }
    function go(i, scroll = true) {
      lesson.cur = i;
      lesson.reached = Math.max(lesson.reached, i);
      save();
      updateNav();
      if (scroll) $("stepnav").scrollIntoView({ behavior: smooth(), block: "start" });
    }
    $("dots").addEventListener("click", (e) => { const b = e.target.closest(".dot"); if (b && !b.disabled) go(+b.dataset.i); });
    $("prevBtn").addEventListener("click", () => go(lesson.cur - 1));
    $("nextBtn").addEventListener("click", () => {
      if (lesson.cur < LAST) { go(lesson.cur + 1); return; }
      lesson.finished = true;
      lesson.reached = LAST;
      save();
      updateNav();
      $("afterSteps").scrollIntoView({ behavior: smooth(), block: "start" });
    });
    $("modeBtn").addEventListener("click", () => { lesson.mode = lesson.mode === "one" ? "all" : "one"; save(); updateNav(); });
    updateNav();

    // Arabic help: the choice is shared by every level.
    let arOn = false;
    try { arOn = localStorage.getItem("trig-ar") === "1"; } catch (_) {}
    function setAr(on) { arOn = on; document.body.classList.toggle("ar-on", arOn); $("arBtn").setAttribute("aria-pressed", String(arOn)); }
    $("arBtn").addEventListener("click", () => {
      setAr(!arOn);
      try { localStorage.setItem("trig-ar", arOn ? "1" : "0"); } catch (_) {}
    });
    setAr(arOn);

    // Used by the level quiz: open a step and highlight the part that explains a question.
    function clearFocus() {
      document.querySelectorAll(".lesson-focus").forEach((e) => e.classList.remove("lesson-focus"));
      document.querySelectorAll(".show-more").forEach((e) => e.classList.remove("show-more"));
    }
    function explainAt(step, selector) {
      clearFocus();
      // Show that step without changing the place he has saved in this level.
      if (lesson.mode === "one") { lesson.cur = step; updateNav(); }
      const li = stepEls[step];
      li.classList.add("show-more"); // a link means "explain it in detail": show this step in full
      const target = (selector && li.querySelector(selector)) || li;
      target.classList.add("lesson-focus");
      target.scrollIntoView({ behavior: smooth(), block: "start" }); // scroll-margin in steps.css leaves room above
    }
    // Used by tests/check-layout.js: show every step, the lab, practice and Arabic help.
    function prepare() { lesson.mode = "all"; lesson.finished = true; setAr(true); showAllChecks(); setDetail("more"); updateNav(); }

    // How much explanation: Short / Normal / Detailed. Shared by every level.
    let detail = "normal";
    try { detail = localStorage.getItem("trig-detail") || "normal"; } catch (_) {}
    function setDetail(d) {
      detail = d;
      document.body.classList.toggle("detail-short", d === "short");
      document.body.classList.toggle("detail-more", d === "more");
      document.querySelectorAll('input[name="detail"]').forEach((r) => { r.checked = r.value === d; });
    }
    if (document.querySelector(".steps .more")) {
      const box = document.createElement("div");
      box.className = "detailbar";
      box.innerHTML = `<span class="label" id="detailLabel">How much explanation?</span>
        <div class="seg" role="radiogroup" aria-labelledby="detailLabel">
          <input type="radio" name="detail" id="dShort" value="short"><label for="dShort">Short</label>
          <input type="radio" name="detail" id="dNormal" value="normal"><label for="dNormal">Normal</label>
          <input type="radio" name="detail" id="dMore" value="more"><label for="dMore">Detailed</label>
        </div>`;
      $("stepnav").append(box);
      box.querySelectorAll("input").forEach((r) => r.addEventListener("change", () => {
        setDetail(r.value);
        try { localStorage.setItem("trig-detail", r.value); } catch (_) {}
      }));
      setDetail(detail);
    }

    const current = () => lesson.cur;
    function goTo(i) { lesson.cur = Math.min(Math.max(0, i | 0), LAST); updateNav(); }

    return { explainAt, clearFocus, current, goTo, prepare };
  }
  window.LessonSteps = { mount };
})();
