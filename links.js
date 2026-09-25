// Every external address the site points at, in one place. Edit here, nowhere else.
window.SKETCHCODED_LINKS = {
  // The public repository. Confirm once it exists on GitHub.
  github: 'https://github.com/OscarBarreraGithub/sketchcoded',
  // Where "See more projects" goes.
  projects: 'https://sketchcoded.com/projects',
  // The read-only demo. Until it exists, the guide explains how to run the example locally.
  demo: 'guide.html#example',
};
document.querySelectorAll('[data-link]').forEach((el) => {
  const href = window.SKETCHCODED_LINKS[el.dataset.link];
  if (href) el.setAttribute('href', href);
});
// The setup prompt is generated from the GitHub address so the two never drift apart.
const prompt = `Set up Sketchcoded on this computer. Clone ${window.SKETCHCODED_LINKS.github}, run npm install, then npm run dev. It needs Node 22.12 or later. When http://127.0.0.1:5173 responds, open it in my browser. The first launch opens the Little chat example board.`;
document.querySelectorAll('[data-prompt]').forEach((el) => (el.textContent = prompt));
document.querySelectorAll('[data-copy-prompt]').forEach((button) => {
  const label = button.textContent;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy the text';
    }
    setTimeout(() => (button.textContent = label), 2200);
  });
});
