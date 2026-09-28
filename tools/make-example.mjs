/** Export an authored board from any local Sketchcoded instance into the public example. */
import { mkdir, mkdtemp, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { curateExample } from "./curate-example.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function makeExample({
  base = "http://127.0.0.1:5173",
  board = "Sketchcoded",
  boardId,
  includePlanned = false,
  out = path.join(root, "example"),
} = {}) {
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("--base must be an HTTP or HTTPS app address.");
  const origin = base.replace(/\/$/, "");
  const get = async (route) => {
    const response = await fetch(`${origin}${route}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`Could not read ${route}: HTTP ${response.status}.`);
    return response;
  };
  let id = boardId;
  if (!id) {
    const boards = await (await get("/api/projects")).json();
    const matches = boards.filter((item) => item.name === board);
    if (matches.length !== 1)
      throw new Error(
        matches.length
          ? `Several boards are named ${JSON.stringify(board)}. Select one with --board-id.`
          : `No board named ${JSON.stringify(board)} at ${origin}. Choose a name with --board or an ID with --board-id.`,
      );
    id = matches[0].id;
  }
  const snapshot = await (
    await get(`/api/projects/${encodeURIComponent(id)}/example`)
  ).json();
  for (const key of ["assets", "screens", "pins", "transitions", "ideas"])
    if (!Array.isArray(snapshot[key]))
      throw new Error(`Invalid example snapshot: ${key} is missing.`);
  const project = includePlanned ? snapshot : curateExample(snapshot);

  // Download into a sibling staging directory. Failed requests never erase the published copy.
  const stage = await mkdtemp(path.join(path.dirname(out), ".example-"));
  const next = path.join(stage, "next");
  const previous = path.join(stage, "previous");
  let movedPrevious = false;
  let cleanup = true;
  try {
    await mkdir(path.join(next, "art"), { recursive: true });
    for (const asset of project.assets) {
      if (!/^[a-f0-9]{64}\.webp$/.test(asset.file))
        throw new Error("Invalid asset filename in example snapshot.");
      const response = await get(`/assets/${asset.file}`);
      await writeFile(
        path.join(next, "art", asset.file),
        Buffer.from(await response.arrayBuffer()),
      );
    }
    await writeFile(
      path.join(next, "board.json"),
      `${JSON.stringify(project, null, 2)}\n`,
    );
    try {
      await rename(out, previous);
      movedPrevious = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await rename(next, out);
    } catch (error) {
      if (movedPrevious) {
        try {
          await rename(previous, out);
        } catch (rollback) {
          cleanup = false;
          throw new AggregateError(
            [error, rollback],
            `Could not install the example. The previous copy is preserved at ${previous}.`,
          );
        }
      }
      throw error;
    }
    return project;
  } finally {
    if (cleanup) await rm(stage, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const { values } = parseArgs({
      options: {
        base: { type: "string" },
        board: { type: "string" },
        "board-id": { type: "string" },
        "include-planned": { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    });
    if (values.help) {
      console.log(`Export a board's own drawings, pins and yarn into example/.

node tools/make-example.mjs --base http://127.0.0.1:5180 --board "My board"
node tools/make-example.mjs --base http://127.0.0.1:5180 --board-id "board-id"

Defaults: app http://127.0.0.1:5173, board named Sketchcoded.
Use the running app's address and your own board name or ID. No hosting account is needed.
Isolated, undeveloped planning frames are omitted. Use --include-planned for the full snapshot.`);
    } else {
      if (values.board && values["board-id"])
        throw new Error("Choose --board or --board-id, not both.");
      for (const key of ["base", "board", "board-id"])
        if (values[key] !== undefined && !values[key].trim())
          throw new Error(`--${key} cannot be empty.`);
      const board = await makeExample({
        base: values.base,
        board: values.board,
        boardId: values["board-id"],
        includePlanned: values["include-planned"],
      });
      const drawn = board.screens.filter((screen) => screen.assetId).length;
      console.log(
        `example: “${board.name}” · ${board.screens.length} frames (${drawn} drawn) · ${board.pins.length} pins · ${board.transitions.length} threads · ${board.ideas.length} ideas · ${board.assets.length} drawings`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
