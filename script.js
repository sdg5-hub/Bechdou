const scrollButtons = document.querySelectorAll("[data-scroll]");

scrollButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selector = button.getAttribute("data-scroll");
    const target = selector ? document.querySelector(selector) : null;

    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
