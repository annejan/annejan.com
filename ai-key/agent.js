// Easter egg: click the big Ai three times and it comes to life, Clippy style. Our own character
// and drawing (the Ai from ai.svg), not Microsoft's Clippy. Nothing inline, so the strict CSP holds.
(() => {
  "use strict";
  const mark = document.querySelector(".intro .mark-button");
  if (!mark) return;

  const QUIPS = [
    "It looks like you're about to paste your clipboard into the cloud. Would you like to keep it on your laptop instead?",
    "Hi! I'm not Clippy. I'm 9 billion parameters, living in a corner of the chip your laptop wasn't using anyway.",
    "I run on the NPU. I don't phone home. I don't even know your Wi-Fi password.",
    "It looks like you're reading a letter from the tax office. Shall I explain it like you're twelve?",
    "I was trained on half the internet, and now I'm not allowed to touch it. Honestly? Relaxing.",
    "Your GPU is busy playing video. I live in the part of the chip that used to just sit there looking expensive.",
    "Need a translation? I'm rough, but I'm local. Some of my mistakes are funny.",
    "My memory is a folder of JSON files on your own disk. Delete it and I've never met you. Try that with the cloud.",
  ];

  const NS = "http://www.w3.org/2000/svg";
  let clicks = 0, clickTimer = 0, agent = null, text = null, order = [], next = 0;

  // Three clicks within a second and a half wake it up.
  mark.addEventListener("click", () => {
    clicks += 1;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clicks = 0; }, 1500);
    if (clicks >= 3) {
      clicks = 0;
      open();
    }
  });

  // The Ai as live SVG, so the dot can bounce on its own.
  function drawAi() {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "24 -4 486 778");
    svg.setAttribute("aria-hidden", "true");
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "stroke");
    for (const d of ["M78 640 Q190 380 392 190", "M392 190 Q384 470 394 720", "M112 470 Q250 452 392 454"]) {
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      g.appendChild(path);
    }
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", "dot");
    dot.setAttribute("cx", "440");
    dot.setAttribute("cy", "64");
    dot.setAttribute("r", "56");
    svg.append(g, dot);
    return svg;
  }

  function button(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function build() {
    agent = document.createElement("div");
    agent.className = "agent";
    agent.setAttribute("role", "dialog");
    agent.setAttribute("aria-label", "The Ai says");
    agent.hidden = true;

    const balloon = document.createElement("div");
    balloon.className = "balloon";
    text = document.createElement("p");
    text.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "buttons";
    actions.append(button("Another one", say), button("Keep it local", close));
    balloon.append(text, actions);

    const figure = document.createElement("div");
    figure.className = "figure";
    figure.appendChild(drawAi());
    figure.addEventListener("click", say);

    agent.append(balloon, figure);
    document.body.appendChild(agent);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && agent && !agent.hidden) close();
    });
  }

  function say() {
    if (next >= order.length) {  // a new shuffled round, so no quip repeats before all are seen
      order = QUIPS.map((_, i) => i).sort(() => Math.random() - 0.5);
      next = 0;
    }
    agent.classList.remove("talking");
    void agent.offsetWidth;  // restart the bounce
    agent.classList.add("talking");
    text.textContent = QUIPS[order[next++]];
  }

  function open() {
    if (!agent) build();
    if (!agent.hidden) return say();
    agent.hidden = false;
    requestAnimationFrame(() => agent.classList.add("in"));
    say();
    agent.querySelector("button").focus({ preventScroll: true });
  }

  function close() {
    agent.classList.remove("in");
    setTimeout(() => { agent.hidden = true; }, 400);
    mark.focus({ preventScroll: true });
  }

  // Second easter egg: type "poep", "poop" or "shit" anywhere on the page. The big Ai pulls up
  // its left leg, strains, and drops one. The <img> is swapped for the same drawing as live SVG
  // (same viewBox and paths as ai.svg) for the few seconds it takes.
  const WORDS = ["poep", "poop", "shit"];
  let typed = "", busy = false;

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    const t = e.target;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    typed = (typed + e.key.toLowerCase()).slice(-4);
    if (WORDS.includes(typed)) {
      typed = "";
      poop();
    }
  });

  function svgEl(name, attrs) {
    const el = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // The live copy of ai.svg, plus the drop, its landing spot and the smell, hidden until needed.
  function drawMark() {
    const svg = svgEl("svg", { viewBox: "36 8 462 754", class: "mark live", "aria-hidden": "true" });
    const g = svgEl("g", { class: "stroke" });
    const leg = svgEl("path", { d: "M78 640 Q190 380 392 190", class: "leg" });
    g.append(leg, svgEl("path", { d: "M392 190 Q384 470 394 720" }), svgEl("path", { d: "M112 470 Q250 452 392 454" }));
    const dot = svgEl("circle", { cx: "440", cy: "64", r: "50", class: "dot" });
    // A soft-serve swirl in the same hand-drawn line, hanging under the end of the crossbar
    const drop = svgEl("g", { class: "drop" });
    for (const d of ["M54 666 Q110 646 166 666", "M62 636 Q110 598 158 636", "M76 602 Q110 570 144 602", "M92 570 Q110 546 128 570", "M114 542 Q128 524 108 518"]) {
      drop.appendChild(svgEl("path", { d }));
    }
    const smell = svgEl("g", { class: "smell" });
    for (const x of [72, 112, 152]) smell.appendChild(svgEl("path", { d: `M${x} 560 q14 -18 0 -36 q-14 -18 0 -36` }));
    svg.append(g, drop, smell, dot);
    return { svg, leg };
  }

  function poop() {
    if (busy) return;
    busy = true;
    const img = mark.querySelector("img.mark");
    const { svg, leg } = drawMark();
    img.style.display = "none";  // .intro .mark sets display, so the hidden attribute would not do
    mark.appendChild(svg);

    // Pull the leg up from its foot to just under the crossbar: hide that much of its start.
    const len = leg.getTotalLength();
    let cut = 0;
    while (cut < len && leg.getPointAtLength(cut).y > 486) cut += 4;
    leg.style.strokeDasharray = `${len} ${len}`;
    leg.style.strokeDashoffset = "0";

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps = still
      ? [[0, "squat out down stink"], [3000, "done"]]
      : [[50, "squat"], [700, "strain"], [1100, "out"], [1900, "down"], [2300, "stink"], [4600, "done"]];
    for (const [ms, cls] of steps) {
      setTimeout(() => {
        for (const c of cls.split(" ")) svg.classList.add(c);
        if (cls.includes("squat")) leg.style.strokeDashoffset = `${-cut}`;
        if (cls === "done") leg.style.strokeDashoffset = "0";
      }, ms);
    }
    if (agent && !agent.hidden) {
      text.textContent = "Excuse me. Even a local model has to go sometimes. Nothing left the laptop, though.";
    }
    setTimeout(() => {
      svg.remove();
      img.style.display = "";
      busy = false;
    }, (still ? 3000 : 4600) + 900);
  }
})();
