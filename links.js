// Every external address the site points at, in one place. Edit here, nowhere else.
window.SKETCHCODED_LINKS = {
  // The public repository. Forks can point this to their own repository.
  github: "https://github.com/OscarBarreraGithub/sketchcoded",
  // Where "See more projects" goes.
  projects: "https://sciencewithagents.com",
  // The example board, read only: move the frames, walk the flow, nothing is saved.
  demo: "demo.html",
};
document.querySelectorAll("[data-link]").forEach((el) => {
  const href = window.SKETCHCODED_LINKS[el.dataset.link];
  if (href) el.setAttribute("href", href);
});
// The setup prompt is generated from the GitHub address so the two never drift apart.
const prompt = `Set up Sketchcoded on this computer. Clone ${window.SKETCHCODED_LINKS.github}, use Node 22.12 or later, run npm ci, then npm run dev. Reuse a running instance of this checkout; otherwise, if port 5173 is busy, use npm run dev -- --port 0. Open the local address printed by the server in my browser.`;
const commands = `git clone ${window.SKETCHCODED_LINKS.github.replace(/\.git\/?$/, "").replace(/\/$/, "")}.git sketchcoded
cd sketchcoded
npm ci
npm run dev`;
document.querySelectorAll("[data-setup-commands]").forEach((el) => {
  el.textContent = commands;
});
document
  .querySelectorAll("[data-prompt]")
  .forEach((el) => (el.textContent = prompt));
document.querySelectorAll("[data-copy-prompt]").forEach((button) => {
  const label = button.textContent;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Select and copy the text";
    }
    setTimeout(() => (button.textContent = label), 2200);
  });
});

(() => {
  const panel = document.querySelector(".site-scroll");
  const hint = document.querySelector(".site-scroll-hint");
  if (!panel || !hint) return;
  // The arrow says there is more below until the visitor starts scrolling.
  const update = () => {
    hint.hidden =
      panel.scrollTop > 2 ||
      panel.scrollHeight - panel.clientHeight - panel.scrollTop < 3;
  };
  panel.addEventListener("scroll", update);
  hint.addEventListener("click", () =>
    panel.scrollBy({ top: panel.clientHeight * 0.7, behavior: "smooth" }),
  );
  new ResizeObserver(update).observe(panel);
  for (const child of panel.children) new ResizeObserver(update).observe(child);
  update();
})();
