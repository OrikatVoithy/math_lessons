/*
 * The concept map: every idea in the course, explained once, in one place, with its own address.
 * Quiz questions, quick checks, practice feedback and links in the lesson text all point to an
 * idea here, so a mistake in Level 3 can open the exact part of Level 1 that explains it.
 * Shared by every lesson page; build.sh folds this file into each page.
 *
 * Each idea: [level, step (0 = step 1), CSS selector of the part inside that step, short title]
 *
 * LessonLinks.init({ level, steps, onReturn }) wires it up on a page:
 *   - links like <a data-concept="l1-table">…</a> open that idea;
 *   - open(id, { label, onBack, quiz }) jumps to an idea. On the same page it highlights the part
 *     and shows a bar to go back. On another page it saves a "return ticket" (where he was, and his
 *     quiz if he came from it) and goes there; that page highlights the part and offers
 *     "Back to where I was" or "Stay here and keep reading". Going back restores his place.
 *   - onReturn(ticket) is called when he comes back from another page with his quiz.
 */
(function () {
  const PATHS = { 1: "", 2: "level-2/", bk: "book-skills/", 3: "level-3/", 4: "level-4/", 5: "level-5/", e1: "electricity/", e2: "electricity-2/", e3: "electricity-3/", e4: "electricity-4/", e5: "electricity-5/", e6: "electricity-6/" };
  const NAMES = { 1: "Level 1", 2: "Level 2", bk: "Book skills", 3: "Level 3", 4: "Level 4", 5: "Level 5", exam: "Practice and exam", e1: "Electricity 1", e2: "Electricity 2", e3: "Electricity 3", e4: "Electricity 4", e5: "Electricity 5", e6: "Electricity 6" };
  const levelName = (l) => NAMES[l] || `Level ${l}`;
  const MAP = {
    // Electricity 1: What makes electricity flow?
    "e1-why": ["e1", 0, ".stepbody", "why a torch needs a button"],
    "e1-loop": ["e1", 1, ".maptable", "the water model of a circuit"],
    "e1-conditions": ["e1", 2, ".checks", "the two things current needs"],
    "e1-open-closed": ["e1", 2, "figure", "open and closed circuits"],
    "e1-push": ["e1", 3, ".stepbody", "why charges need a difference in push"],
    "e1-direction": ["e1", 4, ".dirbox", "which way current flows"],
    "e1-dc-ac": ["e1", 5, ".srcgrid", "direct and alternating current"],
    "e1-quantities": ["e1", 5, ".roadmap", "the four things we measure in a circuit"],
    "e1-torch": ["e1", 6, ".checks", "solving the torch problem"],
    // Electricity 2: Current
    "e2-why": ["e2", 0, ".stepbody", "which phone charger is faster"],
    "e2-idea": ["e2", 1, ".defs", "what current is: charge passing each second"],
    "e2-formula": ["e2", 2, ".bigeq", "current = charge ÷ time (I = Q ÷ t)"],
    "e2-units": ["e2", 2, ".unitbox", "1 ampere = 1 coulomb per second"],
    "e2-convert": ["e2", 2, ".example", "changing the time to seconds"],
    "e2-triangle": ["e2", 3, ".cover", "finding the charge or the time"],
    "e2-what-if": ["e2", 4, ".whatif", "what happens when the charge or time changes"],
    "e2-ammeter": ["e2", 5, ".stepbody", "the ammeter, connected in series"],
    "e2-chargers": ["e2", 6, ".checks", "why a 2 A charger is faster"],
    // Electricity 3: Potential difference
    "e3-why": ["e3", 0, ".stepbody", "why a socket is more dangerous than a battery"],
    "e3-level": ["e3", 1, ".stepbody", "electric potential: charges flow from higher to lower"],
    "e3-def": ["e3", 2, ".defbox", "what potential difference is"],
    "e3-formula": ["e3", 2, ".bigeq", "potential difference = work ÷ charge (V = W ÷ Q)"],
    "e3-units": ["e3", 2, ".unitbox", "1 volt = 1 joule per coulomb"],
    "e3-triangle": ["e3", 3, ".cover", "finding the work or the charge"],
    "e3-what-if": ["e3", 4, ".whatif", "what happens when the work or charge changes"],
    "e3-voltmeter": ["e3", 5, ".stepbody", "the voltmeter, connected in parallel"],
    "e3-compare": ["e3", 5, ".meters", "ammeter vs voltmeter"],
    "e3-socket": ["e3", 6, ".checks", "energy per coulomb: socket vs battery"],
    // Electricity 4: Resistance
    "e4-why": ["e4", 0, ".stepbody", "why the filament glows but the wires don't"],
    "e4-def": ["e4", 1, ".defbox", "what resistance is (ohms, ohmmeter)"],
    "e4-factors": ["e4", 2, ".factors", "the three factors: length, thickness, material"],
    "e4-resistivity": ["e4", 2, ".defbox", "resistivity"],
    "e4-compare": ["e4", 3, ".pair", "comparing the resistance of two wires"],
    "e4-materials": ["e4", 4, ".materials", "copper, tungsten and nichrome"],
    "e4-temp": ["e4", 4, ".stepbody", "temperature raises resistance"],
    "e4-rheostat": ["e4", 5, ".stepbody", "the sliding rheostat"],
    "e4-heat": ["e4", 6, ".checks", "why high resistance makes heat"],
    // Electricity 5: Ohm's law
    "e5-why": ["e5", 0, ".stepbody", "predicting the heater's current"],
    "e5-experiment": ["e5", 1, ".otable", "Ohm's experiment: V ÷ I stays the same"],
    "e5-law": ["e5", 2, ".defbox", "the statement of Ohm's law"],
    "e5-formula": ["e5", 2, ".bigeq", "current = voltage ÷ resistance (I = V ÷ R)"],
    "e5-triangle": ["e5", 3, ".cover", "finding V, I or R"],
    "e5-relations": ["e5", 4, ".whatif", "direct and inverse relationships in Ohm's law"],
    "e5-units": ["e5", 5, ".wheel", "how the units fit together"],
    "e5-multi": ["e5", 5, ".pair", "two-step problems"],
    "e5-heater": ["e5", 6, ".checks", "solving the heater problem"],
    // Electricity 6: Cells and batteries
    "e6-why": ["e6", 0, ".stepbody", "torch vs power bank"],
    "e6-emf": ["e6", 1, ".defbox", "electromotive force (emf)"],
    "e6-open-closed": ["e6", 2, ".checks", "emf vs terminal voltage, open and closed"],
    "e6-compare": ["e6", 2, ".meters", "potential difference vs emf"],
    "e6-connect": ["e6", 3, ".dirbox", "joining cells in series and in parallel"],
    "e6-activity": ["e6", 3, ".otable", "the book's activity: brightness and voltage"],
    "e6-rules": ["e6", 4, ".graphs", "emf rules for series and parallel cells"],
    "e6-mixed": ["e6", 5, ".unitbox", "mixed batteries"],
    "e6-design": ["e6", 5, ".recipe", "designing a battery for a target emf"],
    "e6-torch": ["e6", 6, ".checks", "why torches use series and power banks parallel"],
    // Level 1: What are sin, cos and tan?
    "l1-why": [1, 0, ".stepbody", "why we need sin, cos and tan"],
    "l1-theta": [1, 1, ".stepbody", "what θ is"],
    "l1-square-corner": [1, 1, "figure", "why θ is never the square corner"],
    "l1-sides": [1, 2, ".defs", "naming the sides: opposite, adjacent, hypotenuse"],
    "l1-swap": [1, 2, "figure", "why opposite and adjacent swap when θ moves"],
    "l1-same-shape": [1, 3, ".checks", "same angle, same shape"],
    "l1-ratios": [1, 4, ".trio", "sin, cos and tan (SOH CAH TOA)"],
    "l1-table": [1, 4, ".tablewrap", "the sin, cos and tan table"],
    "l1-read-row": [1, 4, ".readrow", "how to read a row of the table"],
    "l1-no-unit": [1, 4, ".boxes .example:first-child", "why sin, cos and tan have no unit"],
    "l1-ratio-times": [1, 4, ".boxes .example:last-child", "side you want = side you know × ratio"],
    "l1-recipe": [1, 5, ".recipe", "the three steps to use sin, cos and tan"],
    "l1-ladder": [1, 5, ".example", "the ladder example"],
    "l1-tree": [1, 6, ".checks", "solving the tree problem"],
    // Level 2: Find a missing side
    "l2-recap": [2, 0, ".checks", "the recap of SOH CAH TOA"],
    "l2-turn-around": [2, 1, ".stepbody", "turning the equation around"],
    "l2-multiply": [2, 1, ".pair .card:first-child", "? on top: multiply"],
    "l2-divide": [2, 1, ".pair .card:last-child", "? on the bottom: divide"],
    "l2-cover": [2, 2, ".cover", "cover-up triangles"],
    "l2-recipe": [2, 3, ".recipe", "the four steps to find a side"],
    "l2-shadow": [2, 3, ".pair .example:first-child", "the tree shadow example"],
    "l2-ladder-length": [2, 3, ".pair .example:last-child", "the ladder length example"],
    "l2-checks": [2, 4, ".checks", "checking a side makes sense"],
    // Book skills (between Levels 2 and 3): the school book's way of asking
    "bk-why": ["bk", 0, ".stepbody", "how the school book asks questions"],
    "bk-names": ["bk", 1, ".names", "naming corners, angles and sides with letters"],
    "bk-opposite": ["bk", 1, ".opprule", "finding the opposite side from the letters"],
    "bk-pythagoras": ["bk", 2, ".stepbody", "using Pythagoras to find the third side first"],
    "bk-triples": ["bk", 2, ".triples", "number families like 3, 4, 5"],
    "bk-fractions": ["bk", 3, ".fracbox", "writing ratios as simplified fractions"],
    "bk-roots": ["bk", 3, ".rootbox", "simplifying square roots"],
    "bk-from-ratio": ["bk", 4, ".stepbody", "drawing a triangle from one ratio"],
    "bk-both-angles": ["bk", 5, ".rules", "the rules for the two acute angles"],
    "bk-proof": ["bk", 5, ".proofwrap", "how to write a proof"],
    "bk-figures": ["bk", 6, ".stepbody", "figures with a height drawn inside"],
    // Level 3: Find a missing angle
    "l3-why": [3, 0, ".checks", "why we find angles"],
    "l3-backwards": [3, 1, ".stepbody", "going backwards from the ratio to the angle"],
    "l3-buttons": [3, 2, ".trio", "the sin⁻¹, cos⁻¹ and tan⁻¹ buttons"],
    "l3-minus-one": [3, 2, ".inout .example:first-child", "why the −1 is not a power"],
    "l3-in-out": [3, 2, ".inout .example:last-child", "a ratio goes in, an angle comes out"],
    "l3-graph": [3, 3, "figure", "why each ratio belongs to one angle"],
    "l3-recipe": [3, 4, ".recipe", "the four steps to find an angle"],
    "l3-ladder": [3, 4, ".pair .example:first-child", "the safe ladder example"],
    "l3-ramp": [3, 4, ".pair .example:last-child", "the wheelchair ramp example"],
    "l3-checks": [3, 5, ".checks", "checking an angle makes sense"],
    "l3-real": [3, 6, ".uses", "who finds angles in real life"],
    // Level 4: Special angles
    "l4-why": [4, 0, ".checks", "why 30°, 45° and 60° are special"],
    "l4-square": [4, 1, "figure", "45° from cutting a square"],
    "l4-pythagoras": [4, 1, ".pythag", "Pythagoras' rule"],
    "l4-45-values": [4, 1, ".values45", "sin, cos and tan of 45°"],
    "l4-equilateral": [4, 2, "figure", "30° and 60° from cutting an equilateral triangle"],
    "l4-30-60-values": [4, 2, ".values3060", "sin, cos and tan of 30° and 60°"],
    "l4-swap": [4, 3, ".stepbody", "why sin 30° is the same as cos 60°"],
    "l4-pattern": [4, 3, ".pattern", "the pattern in the special values"],
    "l4-exact": [4, 4, ".stepbody", "why exact values beat rounded ones"],
    "l4-recipe": [4, 5, ".recipe", "solving without a calculator"],
    "l4-ladder": [4, 5, ".pair .example:first-child", "finding a side with a special angle"],
    "l4-backwards": [4, 5, ".pair .example:last-child", "finding a special angle backwards"],
    "l4-real": [4, 6, ".uses", "where special angles appear in real life"],
    "l4-estimate": [4, 6, ".estimate", "estimating other angles from the special ones"],
    // Level 5: Heights and distances
    "l5-why": [5, 0, ".checks", "measuring things you can't reach"],
    "l5-elevation": [5, 1, ".stepbody", "the angle of elevation"],
    "l5-depression": [5, 2, ".stepbody", "the angle of depression"],
    "l5-equal-angles": [5, 2, "figure", "why the angle of depression equals the angle of elevation"],
    "l5-eye": [5, 3, ".stepbody", "adding your eye height"],
    "l5-draw": [5, 4, ".recipe", "drawing and solving a heights problem"],
    "l5-lighthouse": [5, 4, ".lighthouse", "the lighthouse example"],
    "l5-two": [5, 5, ".stepbody", "using two triangles"],
    "l5-flag": [5, 5, "figure", "the flagpole picture"],
    "l5-real": [5, 6, ".uses", "who measures heights and distances"],
    "l5-checks": [5, 6, ".sense5", "checking a height or distance makes sense"],
  };
  const CONCEPTS = {};
  for (const id in MAP) { const [level, step, focus, title] = MAP[id]; CONCEPTS[id] = { id, level, step, focus, title }; }
  const KEY = "trig-kb-ticket";

  function init(cfg) {
    const here = cfg.level;
    const steps = cfg.steps;
    const base = here === 1 ? "" : "../";
    const href = (id) => (CONCEPTS[id] ? base + PATHS[CONCEPTS[id].level] + "#c-" + id : "#");
    const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) { return null; } };
    const forget = () => { try { sessionStorage.removeItem(KEY); } catch (_) {} };
    const clearHash = () => { try { history.replaceState(null, "", location.pathname + location.search); } catch (_) {} };

    document.querySelectorAll("a[data-concept]").forEach((a) => a.setAttribute("href", href(a.dataset.concept)));

    const bar = document.createElement("div");
    bar.className = "kb-bar";
    bar.hidden = true;
    bar.innerHTML = '<span class="kb-bar-text"></span><div class="kb-bar-btns"><button type="button" class="primary kb-back"></button><button type="button" class="kb-stay">Stay here and keep reading</button></div>';
    document.body.append(bar);
    let onBack = null, onStay = null;
    function showBar(text, backLabel, back, stay) {
      bar.querySelector(".kb-bar-text").textContent = text;
      bar.querySelector(".kb-back").textContent = backLabel;
      onBack = back;
      onStay = stay;
      bar.hidden = false;
      document.body.classList.add("kb-bar-open");
    }
    function hideBar() { bar.hidden = true; document.body.classList.remove("kb-bar-open"); steps.clearFocus(); }
    bar.querySelector(".kb-back").addEventListener("click", () => { const f = onBack; hideBar(); if (f) f(); });
    bar.querySelector(".kb-stay").addEventListener("click", () => { const f = onStay; hideBar(); if (f) f(); });

    function open(id, opts = {}) {
      const c = CONCEPTS[id];
      if (!c) return;
      const quiz = opts.label === "quiz";
      if (c.level === here) {
        const scroll = window.scrollY, cur = steps.current();
        steps.explainAt(c.step, c.focus);
        showBar(quiz ? "Read the highlighted part. When it makes sense, go back and try again." : "Read the highlighted part. Then go back, or keep reading from here.",
          quiz ? "I understand: back to the question" : "Back to where I was",
          () => { if (opts.onBack) opts.onBack(); else { steps.goTo(cur); window.scrollTo({ top: scroll, behavior: "auto" }); } },
          null);
        return;
      }
      const ticket = { url: location.pathname + location.search, scroll: window.scrollY, cur: steps.current(), fromLevel: here, label: opts.label || "read", quiz: opts.quiz || null };
      try { sessionStorage.setItem(KEY, JSON.stringify(ticket)); } catch (_) {}
      location.href = href(id);
    }
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-concept]");
      if (!a) return;
      e.preventDefault();
      open(a.dataset.concept);
    });

    // Arriving here to read an idea, or coming back after reading one on another page.
    const hash = location.hash.slice(1);
    const arrived = hash.startsWith("c-") ? CONCEPTS[hash.slice(2)] : null;
    if (arrived && arrived.level === here) {
      const t = read();
      clearHash();
      setTimeout(() => {
        steps.explainAt(arrived.step, arrived.focus);
        if (!t) return;
        const quiz = t.label === "quiz";
        showBar(quiz ? `This explains your quiz question from ${levelName(t.fromLevel)}. When it makes sense, go back and try again.` : `You came here from ${levelName(t.fromLevel)}. Read the highlighted part.`,
          quiz ? "I understand: back to the question" : `Back to where I was (${levelName(t.fromLevel)})`,
          () => { location.href = t.url + "#back"; },
          forget);
      }, 60);
    } else if (hash === "back") {
      const t = read();
      clearHash();
      forget();
      if (t && t.url === location.pathname + location.search) {
        setTimeout(() => {
          if (t.quiz && cfg.onReturn) cfg.onReturn(t);
          else { steps.goTo(t.cur); window.scrollTo({ top: t.scroll, behavior: "auto" }); }
        }, 60);
      }
    }
    return { open, href };
  }

  window.LessonLinks = { init, CONCEPTS, levelName };
})();
