"use strict";

{
  const controls = document.querySelector(".hero-controls");
  const buttons = Array.from(controls.querySelectorAll("button"));
  const slides = buttons.map(button => document.getElementById(button.getAttribute("aria-controls")));

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => {
      buttons.forEach((control, position) => {
        const selected = position === index;
        control.setAttribute("aria-pressed", String(selected));
        slides[position].hidden = !selected;
      });
    });
  });
  controls.hidden = false;
}
