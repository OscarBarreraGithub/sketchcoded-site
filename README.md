# Sketchcoded site

The public landing page for [Sketchcoded](../sketchcoded), the local app that turns sketches into a connected, playable app plan. Static HTML and CSS, no build step.

- `index.html`: the landing page as drawn on 2026-09-25: name and tagline, the example frame, the setup prompt with a copy button, the runs-local line, guide, GitHub and projects links. On narrow screens the setup block sits below the example frame.
- `guide.html`: what it is, the example, set up, the automatic checks, build rules, what the AI gets, and an FAQ.
- `links.js`: every external address in one place. The setup prompt is generated from the GitHub address so they never drift.
- `styles.css`: the app's palette and type (DM Sans, Newsreader, Caveat), bundled in `assets/fonts` so the page loads nothing from third parties.
- `demo.html`, `demo.css`, `demo.js`: the example board, read only and public. The cork board with its frames, pins and coloured yarn: pan it, zoom it, drag a frame, and click any screen to walk its flow from there. Nothing is editable and nothing is saved, so a reload puts every frame back.
- `tools/make-example.mjs`, `example/board.json`, `example/art/*`: the example is **the real Sketchcoded board**, with its own hand drawings, pins and yarn, taken straight from the running app:

  ```sh
  node tools/make-example.mjs                 # the board named Sketchcoded on localhost:5173
  node tools/make-example.mjs --board "Name"  # a different board
  ```

  It copies the drawings and writes the board as JSON. Run it when the board changes and commit what it writes; visitors get the committed files, so there is still no build step. Nothing is invented: the frames, the drawings, the pins and their words, the yarn and the colour names are the user's. Frames that have no drawing yet show what they are waiting for, because that is what a board looks like while it is being made.
- `_headers`: cache and safety headers for Cloudflare Pages. `.assetsignore` keeps this repository's own files out of the deployment.
- `assets/board.png`: the example image on the landing page.

## Work on it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8080
```

Keep the copy consistent with the app repository's `README.md` and `docs/FUNCTIONALITY.md`. When the GitHub repository or the projects page moves, change `links.js` only.

## Deploy

The site is a Cloudflare Pages project called `sketchcoded`, served at
[sketchcoded.com](https://sketchcoded.com) and www, with `sketchcoded.pages.dev` as its own
address. The domain is registered at Namecheap and uses Cloudflare's nameservers
(`ophelia.ns.cloudflare.com`, `razvan.ns.cloudflare.com`); Namecheap's email forwarding records
(five MX and the SPF TXT) were carried over and still work.

```sh
wrangler pages deploy . --project-name sketchcoded --branch main
```

Any other static host works too: copy the folder as it is.
