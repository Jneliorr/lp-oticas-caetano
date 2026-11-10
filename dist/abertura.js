"use strict";

{
  const opening = document.querySelector(".opening");
  const stage = opening.querySelector(".opening-stage");
  const visual = opening.querySelector(".opening-visual");
  const canvas = opening.querySelector(".opening-canvas");
  const cue = opening.querySelector(".opening-cue");
  const scrollMotion = matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 480px)");
  let frameRequest = 0;
  let initialized = false;

  function renderOpening() {
    frameRequest = 0;
    const bounds = opening.getBoundingClientRect();
    opening.classList.toggle("is-current", bounds.bottom > stage.offsetHeight * .52);
    if (initialized && bounds.bottom <= 0) {
      opening.classList.toggle("is-pinned", visual.classList.contains("is-live") && scrollMotion.matches);
      return;
    }

    const range = Math.max(1, opening.offsetHeight - stage.offsetHeight);
    const progress = scrollMotion.matches ? Math.min(1, Math.max(0, -bounds.top / range)) : 0;
    const separation = Math.min(1, Math.max(0, (progress - .06) / .71));
    const easing = separation * separation * (3 - 2 * separation);
    const painted = eyewearView.paint(canvas, "wayfarer", -.38 + .60 * easing, .15 + .13 * easing, easing);
    const pinned = painted && scrollMotion.matches;
    visual.classList.toggle("is-live", painted);
    opening.classList.toggle("is-pinned", pinned);
    cue.hidden = !pinned;
    initialized = true;
  }

  function scheduleOpening() {
    if (!frameRequest) frameRequest = requestAnimationFrame(renderOpening);
  }

  window.addEventListener("scroll", scheduleOpening, { passive: true });
  window.addEventListener("resize", scheduleOpening);
  scrollMotion.addEventListener("change", scheduleOpening);
  new ResizeObserver(scheduleOpening).observe(visual);
  scheduleOpening();

  const initialHash = location.hash;
  const initialTarget = document.getElementById(initialHash.slice(1));
  if (initialTarget) {
    window.addEventListener("load", async () => {
      await document.fonts.ready;
      // The pinned sections grow after initialization, moving deep links down the page.
      requestAnimationFrame(() => {
        if (location.hash === initialHash) initialTarget.scrollIntoView({ block: "start" });
      });
    }, { once: true });
  }
}
