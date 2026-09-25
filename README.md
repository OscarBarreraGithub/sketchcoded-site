# Sketchcoded site

The public landing page for [Sketchcoded](../sketchcoded), the local app that turns sketches into a connected, playable app plan. Static HTML and CSS, no build step.

- `index.html`: the landing page as drawn on 2026-09-25: name and tagline, the example frame, the setup prompt with a copy button, the runs-local line, guide, GitHub and projects links. On narrow screens the setup block sits below the example frame.
- `guide.html`: what it is, the example, set up, the automatic checks, build rules, what the AI gets, and an FAQ.
- `links.js`: every external address in one place. The setup prompt is generated from the GitHub address so they never drift.
- `styles.css`: the app's palette and type (DM Sans, Newsreader, Caveat), bundled in `assets/fonts` so the page loads nothing from third parties.
- `assets/board.png`: the example image, a screenshot of the Sketchcoded board planning this site.

## Work on it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8080
```

Keep the copy consistent with the app repository's `README.md` and `docs/FUNCTIONALITY.md`. When the GitHub repository or the projects page moves, change `links.js` only.

## Deploy

Any static host works: copy the folder as is. The intended home is sketchcoded.com.
