# Sketchcoded site

The public landing page, guide and read-only example for Sketchcoded. Static HTML, CSS and JavaScript; no build step, account or backend is needed to view it.

## Files and configuration

- `index.html`, `guide.html` and `styles.css`: the landing page and guide.
- `links.js`: the public repository, projects page and demo addresses. Both the setup prompt and manual clone commands are generated from this configuration. A fork can replace these links without changing application code.
- `demo.html`, `demo.css` and `demo.js`: a read-only board and flow walker. Temporary frame movement resets on reload.
- `example/board.json` and `example/art/`: a curated snapshot of an authored board. The bundled example works without the local app or the original author's data.
- `assets/`: local images, icons and fonts. Fonts are not loaded from third parties.
- `_headers`: Cloudflare Pages cache and safety headers. Adapt these if another host uses a different format.
- `tools/stage-site.mjs`: copies only public website files into `.site-dist/` for deployment. Repository notes, maintenance tools and local configuration stay out of the published site.

The official example contains the author's original drawings of Sketchcoded. Do not replace them with agent-invented artwork. For a fork, choose a board and drawings you are authorized to publish.

## Work locally

Clone this repository into any directory; it does not need to be beside the app repository. Serve the directory with a static HTTP server. For example, with Python 3 installed:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

On Windows, the equivalent command is `py -3 -m http.server 8080 --bind 127.0.0.1`. Open http://127.0.0.1:8080. Serving over HTTP is needed for the demo to fetch its board JSON. Stop the server with Ctrl+C when finished.

Keep public copy consistent with the app's README and `docs/FUNCTIONALITY.md`. The app's general build checklist also applies to this site. Keep documentation as edited requirements and instructions, without raw conversation transcripts or personal environment details.

## Update the example

Optional: run the local Sketchcoded app with the intended board, then use Node 22.12 or later:

```sh
node tools/make-example.mjs --help
node tools/make-example.mjs --base http://127.0.0.1:5180 --board "My board"
node tools/make-example.mjs --base http://127.0.0.1:5180 --board-id "board-id-from-the-app"
```

The defaults are `http://127.0.0.1:5173` and the board named `Sketchcoded`, for the official example. Use the actual address printed by your app and your board name or ID. Duplicate names require `--board-id`. A fresh app installation does not contain the official source board; the committed public snapshot remains available without it.

The tool reads `/api/projects/:id/example`, copies the referenced drawings and writes the same standard-page descriptions used by Test flow. It omits isolated, undeveloped planning frames by default: frames with no drawing, delegated page, entry role, pin or authored connection. Their ideas and unused assets are omitted too. The full local board remains intact. Use `--include-planned` to publish the complete snapshot. It preserves the old example if a request fails. Review the generated files before committing and deploying them: source-folder paths are stripped by the app, but board descriptions and drawings are public content. No drawings or routes are invented by the exporter.

Run exporter and publishing regressions with `node --test`.

## Deploy with your own account

Any static host can serve the public HTML, CSS, JavaScript, `assets/` and `example/` files. Stage those files with Node 22.12 or later:

```sh
node tools/stage-site.mjs
```

Upload the contents of `.site-dist/`, preserving relative paths. This is a file-copy step, not a frontend build. Use the explicit public file list instead of relying on host-specific exclusion rules. Cloudflare Pages is one option:

1. Install or run Wrangler, authenticate to the intended account with `wrangler login`, and verify it with `wrangler whoami`.
2. Create or select your own Pages project. For a new project, run `wrangler pages project create YOUR_PROJECT_NAME` and choose its production branch.
3. From this repository, publish with your chosen project and branch:

   ```sh
   wrangler pages deploy .site-dist --project-name YOUR_PROJECT_NAME --branch main
   ```

Choose the project explicitly; no account credentials or hosting project are bundled. The official site at sketchcoded.com belongs to its maintainers; a fork uses its own project and domain. Connecting a custom domain is a separate hosting task. Preserve any existing email DNS records, including MX and SPF, and keep tokens and local Wrangler state out of Git.

## Verification

The 2026-09-28 review checked the homepage, guide and demo at actual Chromium tab zoom of 125%, 150%, 200% and 250%, at 1440×900 and 1280×720. The site uses fixed shells with scrolling panels. The app repository's `docs/REVIEW_2026-09-28.md` records navigation and layout evidence. Recheck affected pages after visual changes.

The portability follow-up passed the exporter regression (custom board ID and port, duplicate names, invalid asset paths and failed downloads), plus 16 homepage/guide checks across both laptop sizes and all four zoom levels. Setup commands and links follow a substituted fork configuration. Code wraps within the guide, and the scroll hint has a reserved rail so it cannot cover text. No browser runtime errors were reported.

The publishing regression verifies that staging excludes repository notes, tool scripts, local configuration and stale deployment files.

GitHub Actions runs these tools on Windows, macOS and Linux with Node 22.12 and 24. Text files use LF line endings across platforms.

The focused official example contains three original drawings and seven pages left to the AI. Boards and Review flow remain in the local planning backlog; they are omitted from the public example while isolated and undeveloped.
