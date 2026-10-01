# Sketchcoded site

The landing page, guide and read-only example for [Sketchcoded](https://github.com/OscarBarreraGithub/sketchcoded), published at [sketchcoded.com](https://sketchcoded.com). Static HTML, CSS and JavaScript: no build step and no backend.

## Run it locally

Serve this folder over HTTP (the example loads its board as JSON):

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Then open http://127.0.0.1:8080. On Windows, use `py -3` in place of `python3`.

## What is here

- `index.html`, `guide.html`, `404.html` and `styles.css`: the pages.
- `demo.html`, `demo.css` and `demo.js`: the example, a board you can move around and test the flow on. Nothing is saved; a reload puts it back.
- `example/`: the board the example shows, exported from the author's own Sketchcoded board with its original drawings. Never replace them with invented artwork; a fork should publish a board it owns.
- `links.js`: the repository and project addresses, in one place.
- `assets/`: images and fonts. `assets/favicon.svg` is a copy of the app's logo, and `assets/board.png` is a screenshot of the app; retake it when the app's look changes.

## Update the example

With the Sketchcoded app running and the board arranged and zoomed the way the example should open:

```sh
node tools/make-example.mjs --base http://127.0.0.1:5173 --board "Sketchcoded"
```

It copies the board and its drawings into `example/` and leaves out frames that are not connected to anything. `tools/example-pages.json` lists frames to leave out by code, and gives each page without a drawing a one-line summary and what its author wants it to do, one line per idea. The tool names any idea that has no line yet. Check what it wrote before you commit: everything in `example/` is public.

## Publish

```sh
node tools/stage-site.mjs
npx wrangler pages deploy .site-dist --project-name YOUR_PROJECT --branch main
```

Deploy `.site-dist/`, which holds only the public files, never the repository itself. Any static host works. Choose the hosting project explicitly, and keep credentials out of Git. When connecting a domain, keep its existing email records (MX and SPF).

## Checks

`node --test` covers the export and staging tools. After a visual change, check every page against the app's build checklist (`docs/BUILD_CHECKLIST.md` in the app repository): measure text and click targets at 100% zoom, try real browser zoom from 125% up to 500% in laptop-sized windows and on a phone, and make sure nothing overlaps and the example's flow reaches every page and comes back.

## License

The code is MIT licensed; see [LICENSE](LICENSE). The hand drawings in `example/art/` and the logo in `assets/` are the author's own and are not covered by it.
