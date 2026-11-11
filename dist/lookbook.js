"use strict";

const conveyor = document.querySelector(".conveyor");
const stickyStage = document.querySelector(".conveyor-sticky");
const catalogWindow = document.querySelector(".catalog-window");
const track = document.querySelector(".track");
const slides = [...document.querySelectorAll(".slide")];
const frameButtons = [...document.querySelectorAll("[data-frame]")];
const stepButtons = [...document.querySelectorAll("[data-step]")];
const frameLabel = document.querySelector("#frame-label");
const status = document.querySelector("#catalog-status");
const meter = document.querySelector(".conveyor-meter span");
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const tallViewport = matchMedia("(min-height: 520px)");
const finePointer = matchMedia("(pointer: fine)");

const slideStates = slides.map(element => {
  const planes = Object.fromEntries([...element.querySelectorAll("[data-plane]")].map(plane => [plane.dataset.plane, plane]));
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  planes.image.append(canvas);
  return { element, stage: element.querySelector(".slide-stage"), planes, canvas, pointerX: 0, pointerY: 0, targetX: 0, targetY: 0 };
});

let frameRequest = 0;
let activeIndex = -1;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function schedulePaint() {
  if (!frameRequest) frameRequest = requestAnimationFrame(updateCatalog);
}

function paintSlide(state, local) {
  const { planes, pointerX: x, pointerY: y } = state;
  const turn = clamp(local + .5);
  const yaw = .58 - turn * 2.64 + x * .13;
  const live = eyewearView.paint(state.canvas, state.element.dataset.model, yaw, .18 - y * .10);
  planes.image.classList.toggle("is-live", live);
  planes.image.style.transform = `translate(-50%, -50%) translate3d(${local * -4 - x * 2}%, ${Math.sin(local) * 12 - y * 12}px, 30px) rotateY(${live ? 0 : (turn - .5) * 42 + x * 5.8}deg)`;
  planes.ground.style.transform = `translate3d(${local * -90 + x * 17}px, ${y * 14}px, -150px)`;
  planes.number.style.transform = `translate3d(${local * 52 + x * 26}px, ${y * 19}px, 20px)`;
  planes.title.style.transform = `translate3d(${local * -26 + x * 13}px, ${y * 7}px, 28px)`;
  planes.caption.style.transform = `translate3d(${x * 9}px, ${y * 9}px, 20px)`;
  planes.spec.style.transform = `translate3d(${x * 16}px, ${y * 13}px, 40px)`;
}

function selectActive(index) {
  if (activeIndex === index) return;
  activeIndex = index;
  const frame = String(index + 1).padStart(2, "0");
  const count = String(slides.length).padStart(2, "0");
  const label = `${frame} / ${count} — ${slides[index].dataset.title}`;
  frameLabel.textContent = label;
  status.textContent = `Modelo ${index + 1} de ${slides.length}, ${slides[index].dataset.title}`;
  frameButtons.forEach((button, i) => {
    if (i === index) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  stepButtons[0].setAttribute("aria-disabled", String(index === 0));
  stepButtons[1].setAttribute("aria-disabled", String(index === slides.length - 1));
  slides.forEach((slide, i) => slide.setAttribute("aria-hidden", String(i !== index)));
}

function updateCatalog() {
  frameRequest = 0;
  if (!conveyor.classList.contains("is-pinned")) return;

  const rect = conveyor.getBoundingClientRect();
  if (rect.top >= innerHeight || rect.bottom <= 0) return;
  const range = Math.max(1, conveyor.offsetHeight - stickyStage.offsetHeight);
  const progress = clamp(-rect.top / range);
  const phase = progress * slides.length - .5;
  const current = Math.floor(phase);
  const transition = clamp((phase - current - .38) / .24);
  const position = clamp(current + transition * transition * (3 - 2 * transition), 0, slides.length - 1);
  const travel = Math.max(0, track.scrollWidth - catalogWindow.clientWidth);
  track.style.transform = `translate3d(${-position / (slides.length - 1) * travel}px, 0, 0)`;
  meter.style.transform = `scaleX(${(1 + progress * (slides.length - 1)) / slides.length})`;
  selectActive(Math.round(position));

  let pointerMoving = false;
  slideStates.forEach((state, index) => {
    state.pointerX += (state.targetX - state.pointerX) * .14;
    state.pointerY += (state.targetY - state.pointerY) * .14;
    pointerMoving ||= Math.abs(state.targetX - state.pointerX) + Math.abs(state.targetY - state.pointerY) > .002;
    const local = phase - index;
    if (Math.abs(position - index) < 1) paintSlide(state, local);
  });
  if (pointerMoving) schedulePaint();
}

function configureMotion() {
  const pinned = !motionPreference.matches && tallViewport.matches;
  conveyor.classList.toggle("is-pinned", pinned);
  activeIndex = -1;
  if (pinned) schedulePaint();
  else {
    track.style.removeProperty("transform");
    slideStates.forEach(state => {
      state.element.removeAttribute("aria-hidden");
      state.planes.image.classList.remove("is-live");
      state.pointerX = state.pointerY = state.targetX = state.targetY = 0;
      Object.values(state.planes).forEach(plane => plane.style.removeProperty("transform"));
    });
  }
}

function goToFrame(index) {
  const nextIndex = clamp(index, 0, slides.length - 1);
  const top = scrollY + conveyor.getBoundingClientRect().top;
  const range = conveyor.offsetHeight - stickyStage.offsetHeight;
  window.scrollTo({ top: top + (nextIndex + .5) / slides.length * range, behavior: "smooth" });
}

frameButtons.forEach(button => button.addEventListener("click", () => goToFrame(Number(button.dataset.frame))));
stepButtons.forEach(button => button.addEventListener("click", () => {
  if (button.getAttribute("aria-disabled") !== "true") goToFrame(activeIndex + Number(button.dataset.step));
}));

conveyor.addEventListener("keydown", event => {
  if (!conveyor.classList.contains("is-pinned") || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  let destination;
  switch (event.key) {
    case "ArrowRight": destination = activeIndex + 1; break;
    case "ArrowLeft": destination = activeIndex - 1; break;
    case "Home": destination = 0; break;
    case "End": destination = slides.length - 1; break;
    default: return;
  }
  event.preventDefault();
  goToFrame(destination);
});

slideStates.forEach(state => {
  state.stage.addEventListener("pointermove", event => {
    if (!conveyor.classList.contains("is-pinned") || !finePointer.matches || event.pointerType === "touch") return;
    const rect = state.stage.getBoundingClientRect();
    state.targetX = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
    state.targetY = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
    schedulePaint();
  });
  state.stage.addEventListener("pointerleave", () => {
    state.targetX = state.targetY = 0;
    schedulePaint();
  });
});

addEventListener("scroll", schedulePaint, { passive: true });
addEventListener("resize", schedulePaint);
motionPreference.addEventListener("change", configureMotion);
tallViewport.addEventListener("change", configureMotion);
new ResizeObserver(schedulePaint).observe(catalogWindow);
configureMotion();

const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.querySelector(".mobile-nav");
const mobileViewport = matchMedia("(max-width: 920px)");
menuToggle.hidden = false;

function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  mobileNav.hidden = true;
}

menuToggle.addEventListener("click", () => {
  const expanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!expanded));
  mobileNav.hidden = expanded;
});
mobileNav.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
document.addEventListener("click", event => {
  if (!mobileNav.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !mobileNav.hidden) {
    closeMenu();
    menuToggle.focus();
  }
});
mobileViewport.addEventListener("change", closeMenu);

const navLinks = [...document.querySelectorAll("[data-section]")];
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => {
      if (link.dataset.section === entry.target.id) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  });
}, { rootMargin: "-25% 0px -65% 0px" });
navLinks.forEach(link => sectionObserver.observe(document.getElementById(link.dataset.section)));
