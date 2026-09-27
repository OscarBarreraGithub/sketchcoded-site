/**
 * Takes the example board for this site from the real thing: the Sketchcoded board in the running
 * app, with its own hand drawings, its pins and its yarn.
 *
 *   node tools/make-example.mjs                     # the board named Sketchcoded on localhost:5173
 *   node tools/make-example.mjs --board "Some name" # a different board
 *   node tools/make-example.mjs --base http://127.0.0.1:5175
 *
 * It writes `example/board.json` and copies each drawing into `example/art/`. Run it when the
 * board changes and commit what it writes; visitors get the committed files, so the site keeps its
 * promise of no build step.
 *
 * Nothing here invents anything. The frames, the drawings, the pins, their words, the yarn, the
 * colours and where everything sits on the cork are the user's. The demo is read only, so the copy
 * leaves out what a reader cannot use: the review's findings and the saved viewport.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'example');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const base = arg('base', 'http://127.0.0.1:5173').replace(/\/$/, '');
const wanted = arg('board', 'Sketchcoded');

const boards = await fetch(`${base}/api/projects`).then((r) => r.json());
const summary = boards.find((b) => b.name === wanted);
if (!summary) {
  console.error(
    `No board named ${JSON.stringify(wanted)} at ${base}. Found: ${boards.map((b) => b.name).join(', ') || 'none'}.`,
  );
  process.exit(1);
}
const project = await fetch(`${base}/api/projects/${summary.id}`).then((r) => r.json());

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'art'), { recursive: true });

// The drawings, kept exactly as the app stores them.
for (const asset of project.assets) {
  const image = await fetch(`${base}/assets/${asset.file}`);
  if (!image.ok) throw new Error(`Could not read ${asset.file}: ${image.status}`);
  await writeFile(path.join(out, 'art', asset.file), Buffer.from(await image.arrayBuffer()));
}

const board = {
  name: project.name,
  screens: project.screens,
  assets: project.assets,
  pins: project.pins,
  transitions: project.transitions,
  // An idea is what a frame is waiting for; the planned cards count them and the walk lists them.
  ideas: project.ideas.map(({ id, code, title, detail, screenId, pinId }) => ({
    id,
    code,
    title,
    detail,
    screenId,
    pinId,
  })),
  layout: project.layout,
  colorLabels: project.colorLabels,
};
await writeFile(path.join(out, 'board.json'), `${JSON.stringify(board, null, 2)}\n`);

const drawn = board.screens.filter((s) => s.assetId).length;
console.log(
  `example: “${board.name}” · ${board.screens.length} frames (${drawn} drawn, ${board.screens.length - drawn} waiting) · ${board.pins.length} pins · ${board.transitions.length} threads · ${board.ideas.length} ideas · ${board.assets.length} drawings`,
);
