"use strict";

{
  const section = document.querySelector(".focus-section");
  const layout = section.querySelector(".focus-layout");
  const scene = section.querySelector(".focus-scene");
  const art = scene.querySelector(".focus-art");
  const lenses = art.querySelector("#focus-lens-cutout");
  const frames = art.querySelector(".focus-frames");
  const instructions = section.querySelector("#focus-instructions");
  const toggle = section.querySelector(".focus-toggle");
  const toggleText = toggle.querySelector("span");
  const status = section.querySelector(".focus-state");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const frameTravel = 330;

  let scrollDriven;
  let headerHeight = 0;
  let lastProgress = -1;
  let wearing = false;
  let frameRequest = 0;

  function paint(progress) {
    if (progress === lastProgress) return;
    lastProgress = progress;
    const transform = `translate(0 ${frameTravel * (1 - progress)})`;
    frames.setAttribute("transform", transform);
    lenses.setAttribute("transform", transform);
    scene.style.setProperty("--focus-strength", Math.max(0, (progress - .5) * 2));

    const nextWearing = progress === 1;
    if (nextWearing !== wearing) {
      wearing = nextWearing;
      toggleText.textContent = wearing ? "Tirar os óculos" : "Colocar os óculos";
      status.textContent = wearing ? "Com óculos" : "Sem óculos";
    }
  }

  function scrollRange() {
    const top = section.getBoundingClientRect().top + window.scrollY;
    return {
      start: top + section.clientTop - headerHeight,
      // Reserve the end of the pinned section for the fully clear portrait.
      travel: (section.clientHeight - layout.offsetHeight) * .72
    };
  }

  function syncFromScroll() {
    frameRequest = 0;
    if (!scrollDriven) return;

    const { start, travel } = scrollRange();
    const offset = window.scrollY - start;
    // Account for fractional layout pixels at the sticky boundaries.
    if (offset <= 1) paint(0);
    else if (offset >= travel - 1) paint(1);
    else paint(offset / travel);
  }

  function scheduleScrollSync() {
    if (scrollDriven && !frameRequest) frameRequest = requestAnimationFrame(syncFromScroll);
  }

  function configureScroll() {
    headerHeight = parseFloat(getComputedStyle(section).scrollMarginTop);
    const fits = layout.offsetHeight + headerHeight <= window.innerHeight + 1;
    const nextMode = !reducedMotion.matches && fits;
    if (nextMode !== scrollDriven) {
      scrollDriven = nextMode;
      section.classList.toggle("is-scroll-driven", scrollDriven);
      instructions.textContent = scrollDriven
        ? "Role a página para encaixar a armação."
        : "Compare o retrato com e sem óculos.";
      if (!scrollDriven) paint(wearing ? 1 : 0);
    }
    scheduleScrollSync();
  }

  toggle.addEventListener("click", () => {
    if (!scrollDriven) {
      paint(wearing ? 0 : 1);
      return;
    }

    const { start, travel } = scrollRange();
    window.scrollTo({ top: Math.round(wearing ? start : start + travel), behavior: "smooth" });
  });

  paint(0);
  art.removeAttribute("hidden");
  scene.classList.add("is-ready");
  instructions.hidden = false;
  toggle.hidden = false;
  status.hidden = false;

  window.addEventListener("scroll", scheduleScrollSync, { passive: true });
  window.addEventListener("resize", configureScroll);
  reducedMotion.addEventListener("change", configureScroll);
  new ResizeObserver(configureScroll).observe(layout);
  configureScroll();
}
