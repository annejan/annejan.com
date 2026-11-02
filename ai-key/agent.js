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
})();
